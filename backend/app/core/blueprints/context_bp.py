"""Context blueprint — public endpoint for app mode detection.

Returns whether the current request is hitting a tenant or the public
landing page. The frontend calls this on boot to decide which UI to show.

Routes:
    GET /api/v1/context
"""

from flask import Blueprint, current_app, g, jsonify

from ...tenant import get_tenant_config, resolve_tenant_slug

context_bp = Blueprint("context", __name__)


@context_bp.get("/context")
def get_context():
    """Return the app mode for the current request.

    No authentication required — this is called before the user logs in.

    Responses:
        200  { mode: "tenant", tenant_slug, tenant_name }
        200  { mode: "landing", tenants: [...] }
    """
    slug = getattr(g, "tenant_slug", None) or resolve_tenant_slug()
    default_tenant = current_app.config.get("DEFAULT_TENANT", "default")
    landing_mode = current_app.config.get("LANDING_MODE", False)

    # If the request resolved to the default tenant AND landing mode is on,
    # return landing mode (no tenant list exposed for privacy).
    if slug == default_tenant and landing_mode:
        return jsonify({
            "mode": "landing",
        })

    # Otherwise, return tenant mode
    config = get_tenant_config(slug) or {}
    return jsonify({
        "mode": "tenant",
        "tenant_slug": slug,
        "tenant_name": config.get("name", slug),
        "utilities": config.get("utilities"),  # None = all enabled
    })
