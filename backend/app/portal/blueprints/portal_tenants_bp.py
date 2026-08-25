"""Portal tenants blueprint — tenant CRUD and metrics.

Routes:
    GET    /api/v1/portal/tenants              — list user's tenants
    POST   /api/v1/portal/tenants              — create a new tenant
    GET    /api/v1/portal/tenants/<slug>       — get tenant details
    DELETE /api/v1/portal/tenants/<slug>       — soft-delete a tenant
    GET    /api/v1/portal/tenants/<slug>/metrics — get tenant metrics
"""

import re
from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from ..auth.decorators import platform_auth_required
from ..models import Tenant, TenantMetrics
from ..platform_db import get_platform_session

portal_tenants_bp = Blueprint("portal_tenants", __name__)

# Slug validation
_SLUG_RE = re.compile(r"^[a-z][a-z0-9-]{2,30}[a-z0-9]$")

RESERVED_SLUGS = {
    "www", "api", "portal", "admin", "app", "mail", "ftp",
    "static", "assets", "cdn", "docs", "help", "support",
    "billing", "status", "blog", "demo", "test", "staging",
    "default", "platform", "system", "login", "register",
}

# Max tenants per user
MAX_TENANTS_PER_USER = 5


def _error(code: str, message: str, field: str | None = None, status: int = 400):
    body = {"error": {"code": code, "message": message}}
    if field:
        body["error"]["field"] = field
    return jsonify(body), status


def _validate_slug(slug: str) -> str | None:
    """Validate a tenant slug. Returns error message or None if valid."""
    if not slug:
        return "Slug is required."
    if not _SLUG_RE.match(slug):
        return "Slug must be 4-32 characters, lowercase alphanumeric with hyphens, starting with a letter."
    if slug in RESERVED_SLUGS:
        return f"'{slug}' is a reserved name and cannot be used."
    return None


@portal_tenants_bp.get("/tenants")
@platform_auth_required
def list_tenants():
    """List all tenants owned by the current platform user.

    Responses:
        200  [{ id, slug, name, status, domain, plan, created_at }]
    """
    session = get_platform_session()
    try:
        tenants = (
            session.query(Tenant)
            .filter_by(owner_id=g.platform_user_id)
            .filter(Tenant.status != "deleted")
            .order_by(Tenant.created_at.asc())
            .all()
        )
        return jsonify([
            {
                "id": str(t.id),
                "slug": t.slug,
                "name": t.name,
                "status": t.status,
                "domain": t.domain,
                "plan": t.plan,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tenants
        ]), 200
    finally:
        session.close()


@portal_tenants_bp.post("/tenants")
@platform_auth_required
def create_tenant():
    """Create a new tenant (triggers provisioning).

    Request body (JSON):
        slug  (str, required) — unique identifier, e.g. "my-company"
        name  (str, required) — display name, e.g. "My Company LLC"

    Responses:
        201  { id, slug, name, status, domain }
        400  validation error
        409  slug already taken
        429  too many tenants
    """
    data = request.get_json(silent=True) or {}
    slug = (data.get("slug") or "").strip().lower()
    name = (data.get("name") or "").strip()

    # Validate slug
    slug_error = _validate_slug(slug)
    if slug_error:
        return _error("VALIDATION_ERROR", slug_error, field="slug")

    if not name:
        return _error("VALIDATION_ERROR", "Name is required.", field="name")

    session = get_platform_session()
    try:
        # Check tenant limit
        user_tenant_count = (
            session.query(Tenant)
            .filter_by(owner_id=g.platform_user_id)
            .filter(Tenant.status != "deleted")
            .count()
        )
        if user_tenant_count >= MAX_TENANTS_PER_USER:
            return _error(
                "LIMIT_REACHED",
                f"You can have at most {MAX_TENANTS_PER_USER} tenants.",
                status=429,
            )

        # Check slug uniqueness
        existing = session.query(Tenant).filter_by(slug=slug).first()
        if existing:
            return _error("SLUG_TAKEN", f"'{slug}' is already in use.", field="slug", status=409)

        # Provision the tenant
        from ..services.provisioning_service import ProvisioningService

        provisioner = ProvisioningService()
        tenant = provisioner.create_tenant(
            slug=slug,
            name=name,
            owner=g.platform_user,
            session=session,
        )

        return jsonify({
            "id": str(tenant.id),
            "slug": tenant.slug,
            "name": tenant.name,
            "status": tenant.status,
            "domain": tenant.domain,
        }), 201
    except Exception as e:
        session.rollback()
        return _error("PROVISIONING_ERROR", str(e), status=500)
    finally:
        session.close()


@portal_tenants_bp.get("/tenants/<slug>")
@platform_auth_required
def get_tenant(slug: str):
    """Get details for a specific tenant.

    Responses:
        200  { id, slug, name, status, domain, plan, created_at }
        404  tenant not found
    """
    session = get_platform_session()
    try:
        tenant = (
            session.query(Tenant)
            .filter_by(slug=slug, owner_id=g.platform_user_id)
            .first()
        )
        if tenant is None:
            return _error("NOT_FOUND", "Tenant not found.", status=404)

        return jsonify({
            "id": str(tenant.id),
            "slug": tenant.slug,
            "name": tenant.name,
            "status": tenant.status,
            "domain": tenant.domain,
            "plan": tenant.plan,
            "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
        }), 200
    finally:
        session.close()


@portal_tenants_bp.delete("/tenants/<slug>")
@platform_auth_required
def delete_tenant(slug: str):
    """Soft-delete a tenant.

    Sets status to 'deleted' and records deleted_at timestamp.
    The database and bucket are retained for a grace period.

    Responses:
        200  { message }
        404  tenant not found
    """
    session = get_platform_session()
    try:
        tenant = (
            session.query(Tenant)
            .filter_by(slug=slug, owner_id=g.platform_user_id)
            .filter(Tenant.status != "deleted")
            .first()
        )
        if tenant is None:
            return _error("NOT_FOUND", "Tenant not found.", status=404)

        tenant.status = "deleted"
        tenant.deleted_at = datetime.now(timezone.utc)
        session.commit()

        # Invalidate the tenant cache so requests to this subdomain are rejected
        from ...tenant import invalidate_tenant_cache
        invalidate_tenant_cache()

        return jsonify({"message": f"Tenant '{slug}' has been deleted."}), 200
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@portal_tenants_bp.get("/tenants/<slug>/metrics")
@platform_auth_required
def get_tenant_metrics(slug: str):
    """Get live usage metrics for a tenant.

    Queries the tenant database directly for up-to-date counts.

    Responses:
        200  { users_count, job_sites_count, jobs_count, estimates_count, invoices_count }
        404  tenant not found
    """
    import os
    from sqlalchemy import create_engine, text

    session = get_platform_session()
    try:
        tenant = (
            session.query(Tenant)
            .filter_by(slug=slug, owner_id=g.platform_user_id)
            .first()
        )
        if tenant is None:
            return _error("NOT_FOUND", "Tenant not found.", status=404)

        # Build the tenant DB URL
        base_url = os.environ.get(
            "BASE_DATABASE_URL",
            "postgresql://sitekeeper:sitekeeper@localhost:5434",
        )
        tenant_db_url = f"{base_url}/{tenant.database_name}"

        # Query the tenant DB directly for live metrics
        engine = create_engine(tenant_db_url)
        try:
            with engine.connect() as conn:
                users_count = conn.execute(text("SELECT COUNT(*) FROM users")).scalar() or 0
                job_sites_count = conn.execute(text("SELECT COUNT(*) FROM job_sites")).scalar() or 0
                jobs_count = conn.execute(text("SELECT COUNT(*) FROM jobs")).scalar() or 0
                estimates_count = conn.execute(text("SELECT COUNT(*) FROM estimates")).scalar() or 0
                invoices_count = conn.execute(text("SELECT COUNT(*) FROM invoices")).scalar() or 0
        finally:
            engine.dispose()

        return jsonify({
            "users_count": users_count,
            "job_sites_count": job_sites_count,
            "jobs_count": jobs_count,
            "estimates_count": estimates_count,
            "invoices_count": invoices_count,
        }), 200
    finally:
        session.close()
