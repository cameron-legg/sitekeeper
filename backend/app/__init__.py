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

    app.register_blueprint(portal_auth_bp, url_prefix="/api/v1/portal")
    app.register_blueprint(portal_tenants_bp, url_prefix="/api/v1/portal")

    # Health check endpoint
    @app.route("/api/v1/health")
    def health():
        tenant = getattr(g, "tenant_slug", "unknown")
        return {"status": "ok", "tenant": tenant}

    return app
