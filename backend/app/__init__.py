"""Flask application factory."""

import logging

from flask import Flask, g
from flask_cors import CORS

from .config import Config
from .extensions import bcrypt, db

logger = logging.getLogger(__name__)


def create_app(config=None):
    """Create and configure the Flask application.

    Args:
        config: Optional configuration object or dict to override defaults.

    Returns:
        Configured Flask application instance.
    """
    app = Flask(__name__)

    # Load configuration from environment variables via Config class
    app.config.from_object(Config)

    # Allow caller to override specific config values (useful in tests)
    if config is not None:
        if isinstance(config, dict):
            app.config.update(config)
        else:
            app.config.from_object(config)

    # Initialise extensions
    db.init_app(app)
    bcrypt.init_app(app)

    # CORS — allow origins from CORS_ORIGINS env var (comma-separated).
    # flask-cors supports regex strings natively (e.g. r"https://.*\.jobsyte\.app").
    # Use a wildcard pattern to avoid needing to update CORS for each new tenant.
    cors_origins = app.config.get("CORS_ORIGINS", "*")
    if cors_origins == "*":
        origins = "*"
    else:
        origins = [o.strip() for o in cors_origins.split(",")]
    CORS(app, origins=origins, supports_credentials=True)

    # Platform database (sk_platform) — dedicated connection for portal features
    if not app.config.get("TESTING"):
        from .portal.platform_db import init_platform_db, remove_platform_session
        init_platform_db(app)

        @app.teardown_appcontext
        def _remove_platform_session(exception=None):
            remove_platform_session()

    # Multi-tenant middleware (skip in test mode for simplicity)
    if not app.config.get("TESTING"):
        from .tenant import init_tenant_middleware
        init_tenant_middleware(app)

    # Initialise MinIO storage (skip in test mode to avoid requiring MinIO)
    if not app.config.get("TESTING"):
        from .minio_client import MinioStorage

        minio_storage = MinioStorage(
            endpoint=app.config["MINIO_ENDPOINT"],
            access_key=app.config["MINIO_ACCESS_KEY"],
            secret_key=app.config["MINIO_SECRET_KEY"],
            bucket_name=app.config["MINIO_BUCKET_NAME"],
            use_ssl=app.config.get("MINIO_USE_SSL", False),
        )
        try:
            minio_storage.ensure_bucket()
        except Exception:
            logger.warning(
                "MinIO is unreachable — PDF features will be unavailable until MinIO is running."
            )
        app.minio_storage = minio_storage
    else:
        app.minio_storage = None

    # ── Core blueprints (always on) ──────────────────────────────────────
    from .core.blueprints.auth_bp import auth_bp
    from .core.blueprints.admin_bp import admin_bp
    from .core.blueprints.job_sites_bp import job_sites_bp
    from .core.blueprints.jobs_bp import jobs_bp
    from .core.blueprints.profile_bp import profile_bp
    from .core.blueprints.business_info_bp import business_info_bp
    from .core.blueprints.document_settings_bp import document_settings_bp
    from .core.blueprints.context_bp import context_bp

    app.register_blueprint(auth_bp, url_prefix="/api/v1")
    app.register_blueprint(admin_bp, url_prefix="/api/v1")
    app.register_blueprint(job_sites_bp, url_prefix="/api/v1")
    app.register_blueprint(jobs_bp, url_prefix="/api/v1")
    app.register_blueprint(profile_bp, url_prefix="/api/v1")
    app.register_blueprint(business_info_bp, url_prefix="/api/v1")
    app.register_blueprint(document_settings_bp, url_prefix="/api/v1")
    app.register_blueprint(context_bp, url_prefix="/api/v1")

    # ── Utility blueprints (toggleable per tenant) ───────────────────────
    from .utilities import register_all_utilities
    register_all_utilities(app)

    # ── Portal blueprints (platform control plane) ───────────────────────
    from .portal.blueprints.portal_auth_bp import portal_auth_bp
    from .portal.blueprints.portal_tenants_bp import portal_tenants_bp
    from .portal.blueprints.superadmin_bp import superadmin_bp

    app.register_blueprint(portal_auth_bp, url_prefix="/api/v1/portal")
    app.register_blueprint(portal_tenants_bp, url_prefix="/api/v1/portal")
    app.register_blueprint(superadmin_bp, url_prefix="/api/v1/superadmin")

    # ── Global error handling ────────────────────────────────────────────
    _register_error_handlers(app)

    # Health check endpoint
    @app.route("/api/v1/health")
    def health():
        tenant = getattr(g, "tenant_slug", "unknown")
        return {"status": "ok", "tenant": tenant}

    return app


def _register_error_handlers(app):
    """Register global handlers that convert exceptions into JSON envelopes.

    Two handlers:
    - AppError: expected domain errors (validation, not-found, etc.). 4xx are
      returned as-is and NOT logged; 5xx AppErrors are logged.
    - Exception: any unhandled exception (a real bug). Always logged to the
      tenant's backend_error_log with a full stack trace and returned as a
      generic 500 — unless the tenant has debug_errors enabled, in which case
      the error type + stack trace are included in the response.

    Every 5xx response carries a ``request_id`` so a user can quote it and we
    can find the exact logged row.
    """
    import traceback
    import uuid

    from flask import g, jsonify, request
    from werkzeug.exceptions import HTTPException

    from .errors import AppError

    def _tenant_wants_detail() -> bool:
        config = getattr(g, "tenant_config", None) or {}
        return bool(config.get("debug_errors"))

    def _log_server_error(exc: Exception, status_code: int) -> str:
        """Record a 5xx error to the tenant DB. Returns the request_id."""
        request_id = str(uuid.uuid4())
        stack = "".join(
            traceback.format_exception(type(exc), exc, exc.__traceback__)
        )
        # Always emit to the stdlib logger / journald as well.
        logger.error(
            "Unhandled error [%s] on %s %s: %s",
            request_id,
            request.method,
            request.path,
            exc,
        )
        try:
            from .error_logging import record_error

            record_error(
                request_id=request_id,
                error_type=type(exc).__name__,
                message=str(exc),
                stack_trace=stack,
                http_method=request.method,
                path=request.full_path.rstrip("?") if request.query_string else request.path,
                status_code=status_code,
                user_id=getattr(g, "current_user_id", None),
                tenant_slug=getattr(g, "tenant_slug", None),
                # Routes may stash extra structured context on g.error_context
                # (e.g. which estimate/line-item/entry was involved). Never put
                # secrets or PII here.
                context=getattr(g, "error_context", None),
            )
        except Exception:  # noqa: BLE001 — never let logging break the handler
            logger.exception("record_error raised (swallowed).")
        return request_id

    def _server_error_body(exc: Exception, request_id: str) -> dict:
        body: dict = {
            "code": "SERVER_ERROR",
            "message": "Something went wrong. Our team has been notified.",
            "request_id": request_id,
        }
        if _tenant_wants_detail():
            body["type"] = type(exc).__name__
            body["detail"] = str(exc)
            body["stack_trace"] = "".join(
                traceback.format_exception(type(exc), exc, exc.__traceback__)
            )
        return body

    @app.errorhandler(AppError)
    def _handle_app_error(exc: AppError):
        if exc.is_server_error:
            request_id = _log_server_error(exc, exc.status)
            return jsonify({"error": _server_error_body(exc, request_id)}), exc.status
        # Expected 4xx — return as-is, do not log.
        return jsonify({"error": exc.to_dict()}), exc.status

    @app.errorhandler(HTTPException)
    def _handle_http_exception(exc: HTTPException):
        # Preserve Flask/werkzeug HTTP errors (404 routing, 405, 413, etc.).
        # These are not application bugs, so they are not logged.
        code = exc.code or 500
        if code >= 500:
            request_id = _log_server_error(exc, code)
            return jsonify({"error": _server_error_body(exc, request_id)}), code
        return (
            jsonify(
                {
                    "error": {
                        "code": exc.name.upper().replace(" ", "_"),
                        "message": exc.description or exc.name,
                    }
                }
            ),
            code,
        )

    @app.errorhandler(Exception)
    def _handle_unexpected(exc: Exception):
        request_id = _log_server_error(exc, 500)
        return jsonify({"error": _server_error_body(exc, request_id)}), 500
