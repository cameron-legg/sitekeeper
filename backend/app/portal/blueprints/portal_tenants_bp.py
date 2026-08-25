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
    """Get usage metrics for a tenant.

    Returns the most recent metrics snapshot.

    Responses:
        200  { users_count, logins_30d, job_sites_count, jobs_count, storage_bytes, recorded_at }
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

        latest_metrics = (
            session.query(TenantMetrics)
            .filter_by(tenant_id=tenant.id)
            .order_by(TenantMetrics.recorded_at.desc())
            .first()
        )

        if latest_metrics is None:
            return jsonify({
                "users_count": 0,
                "logins_30d": 0,
                "job_sites_count": 0,
                "jobs_count": 0,
                "storage_bytes": 0,
                "recorded_at": None,
            }), 200

        return jsonify({
            "users_count": latest_metrics.users_count,
            "logins_30d": latest_metrics.logins_30d,
            "job_sites_count": latest_metrics.job_sites_count,
            "jobs_count": latest_metrics.jobs_count,
            "storage_bytes": latest_metrics.storage_bytes,
            "recorded_at": latest_metrics.recorded_at.isoformat(),
        }), 200
    finally:
        session.close()
