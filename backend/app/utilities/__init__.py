"""Utilities registry — toggleable feature modules.

Each utility can be independently enabled or disabled per tenant via
the 'utilities' key in tenants.json.
"""

ALL_UTILITY_IDS = [
    "contacts",
    "estimates",
    "invoices",
    "notes",
    "time_tracking",
    "photos",
    "pdf",
    "saved_items",
    "ai_assistant",
]


def register_all_utilities(app):
    """Register all utility blueprints with the Flask app.

    All blueprints are registered at startup regardless of tenant config.
    Per-tenant gating happens at request time via the @utility_required decorator.
    """
    from .contacts.blueprint import contacts_bp
    from .notes.blueprint import notes_bp
    from .estimates.blueprint import estimates_bp
    from .invoices.blueprint import invoices_bp
    from .invoices.conversion_blueprint import conversion_bp
    from .time_tracking.blueprint import time_entries_bp
    from .photos.blueprint import job_photos_bp
    from .pdf.blueprint import pdf_bp
    from .saved_items.blueprint import saved_items_bp
    from .ai_assistant.blueprint import ai_bp

    app.register_blueprint(contacts_bp, url_prefix="/api/v1")
    app.register_blueprint(notes_bp, url_prefix="/api/v1")
    app.register_blueprint(estimates_bp, url_prefix="/api/v1")
    app.register_blueprint(invoices_bp, url_prefix="/api/v1")
    app.register_blueprint(conversion_bp, url_prefix="/api/v1")
    app.register_blueprint(time_entries_bp, url_prefix="/api/v1")
    app.register_blueprint(job_photos_bp, url_prefix="/api/v1")
    app.register_blueprint(pdf_bp, url_prefix="/api/v1")
    app.register_blueprint(saved_items_bp, url_prefix="/api/v1")
    app.register_blueprint(ai_bp, url_prefix="/api/v1")


def get_enabled_utilities(tenant_config: dict | None) -> set | None:
    """Return the set of enabled utility IDs for a tenant.

    Returns None if all utilities should be enabled (backwards-compatible default).
    """
    if tenant_config is None:
        return None
    utils = tenant_config.get("utilities")
    if utils is None:
        return None  # All enabled
    return set(utils)
