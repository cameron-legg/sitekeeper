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
    # Defaults to all origins in development; restrict this in production.
    # In production, set to "https://*.entouch.org" pattern or list all tenant domains.
    cors_origins = app.config.get("CORS_ORIGINS", "*")
    if cors_origins == "*":
        origins = "*"
    else:
        origins = [o.strip() for o in cors_origins.split(",")]
    CORS(app, origins=origins, supports_credentials=True)

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

    # Register all blueprints under /api/v1
    from .blueprints.auth_bp import auth_bp
    from .blueprints.job_sites_bp import job_sites_bp
    from .blueprints.jobs_bp import jobs_bp
    from .blueprints.contacts_bp import contacts_bp
    from .blueprints.notes_bp import notes_bp
    from .blueprints.estimates_bp import estimates_bp
    from .blueprints.invoices_bp import invoices_bp
    from .blueprints.conversion_bp import conversion_bp
    from .blueprints.saved_items_bp import saved_items_bp
    from .blueprints.profile_bp import profile_bp
    from .blueprints.pdf_bp import pdf_bp
    from .blueprints.admin_bp import admin_bp
    from .blueprints.ai_bp import ai_bp
    from .blueprints.business_info_bp import business_info_bp
    from .blueprints.time_entries_bp import time_entries_bp

    app.register_blueprint(auth_bp, url_prefix="/api/v1")
    app.register_blueprint(job_sites_bp, url_prefix="/api/v1")
    app.register_blueprint(jobs_bp, url_prefix="/api/v1")
    app.register_blueprint(contacts_bp, url_prefix="/api/v1")
    app.register_blueprint(notes_bp, url_prefix="/api/v1")
    app.register_blueprint(estimates_bp, url_prefix="/api/v1")
    app.register_blueprint(invoices_bp, url_prefix="/api/v1")
    app.register_blueprint(conversion_bp, url_prefix="/api/v1")
    app.register_blueprint(saved_items_bp, url_prefix="/api/v1")
    app.register_blueprint(profile_bp, url_prefix="/api/v1")
    app.register_blueprint(pdf_bp, url_prefix="/api/v1")
    app.register_blueprint(admin_bp, url_prefix="/api/v1")
    app.register_blueprint(ai_bp, url_prefix="/api/v1")
    app.register_blueprint(business_info_bp, url_prefix="/api/v1")
    app.register_blueprint(time_entries_bp, url_prefix="/api/v1")

    # Health check endpoint (used by deploy scripts and load balancers)
    @app.route("/api/v1/health")
    def health():
        tenant = getattr(g, "tenant_slug", "unknown")
        return {"status": "ok", "tenant": tenant}

    return app
