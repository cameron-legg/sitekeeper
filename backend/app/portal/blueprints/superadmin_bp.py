"""Superadmin blueprint — system-wide admin panel endpoints.

Routes:
    POST /api/v1/superadmin/login        — authenticate with superadmin credentials
    GET  /api/v1/superadmin/tenants      — get all tenants with live metrics (on demand)
    POST /api/v1/superadmin/impersonate  — get a tenant token to log in as that tenant's admin
"""

import os
import logging
from functools import wraps

from flask import Blueprint, current_app, g, jsonify, request
from sqlalchemy import create_engine, text

from ...shared_auth import issue_token, validate_token, AuthError
from ..models import Tenant
from ..platform_db import get_platform_session

logger = logging.getLogger(__name__)

superadmin_bp = Blueprint("superadmin", __name__)


def _error(code: str, message: str, status: int = 400):
    return jsonify({"error": {"code": code, "message": message}}), status


def superadmin_required(f):
    """Decorator that validates a superadmin JWT."""

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = None

        if auth_header.startswith("Bearer "):
            token = auth_header[len("Bearer "):]

        if not token:
            return _error("MISSING_TOKEN", "Authorization required.", status=401)

        try:
            payload = validate_token(token)
        except AuthError as exc:
            return _error(exc.code, exc.message, status=401)

        if not payload.get("superadmin"):
            return _error("FORBIDDEN", "Superadmin access required.", status=403)

        g.superadmin = True
        return f(*args, **kwargs)

    return decorated


@superadmin_bp.post("/login")
def login():
    """Authenticate as superadmin.

    Request body (JSON):
        username (str) — must be "superadmin"
        password (str) — must match SUPERADMIN_PASSWORD env var

    Responses:
        200  { token }
        401  invalid credentials
    """
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    expected_password = current_app.config.get("SUPERADMIN_PASSWORD") or os.environ.get("SUPERADMIN_PASSWORD", "")

    if not expected_password:
        return _error("DISABLED", "Superadmin login is not configured.", status=403)

    if username != "superadmin" or password != expected_password:
        return _error("INVALID_CREDENTIALS", "Invalid credentials.", status=401)

    token = issue_token("superadmin", extra_claims={"superadmin": True})
    return jsonify({"token": token}), 200


@superadmin_bp.get("/tenants")
@superadmin_required
def list_all_tenants():
    """Get all active tenants with live metrics from their databases.

    This is an expensive operation — queries each tenant DB.
    Only called when the admin explicitly fetches/refreshes.

    Responses:
        200  [{ slug, name, admin_email, employees, invoices, estimates,
                 job_sites, jobs, paid_invoice_total, logins, db_size_mb, bucket_size_mb }]
    """
    base_url = current_app.config.get(
        "BASE_DATABASE_URL",
        os.environ.get("BASE_DATABASE_URL", "postgresql://sitekeeper:sitekeeper@localhost:5434"),
    )

    session = get_platform_session()
    try:
        tenants = session.query(Tenant).filter_by(status="active").all()

        results = []
        for tenant in tenants:
            tenant_db_url = f"{base_url}/{tenant.database_name}"
            metrics = _fetch_tenant_metrics(tenant_db_url, tenant.database_name, tenant.bucket)
            metrics["slug"] = tenant.slug
            metrics["name"] = tenant.name
            results.append(metrics)

        return jsonify(results), 200
    finally:
        session.close()


@superadmin_bp.get("/tenants/<slug>/errors")
@superadmin_required
def list_tenant_errors(slug: str):
    """Get the backend error log for a single tenant (paginated, newest first).

    Query params:
        limit  (int, default 50, max 200)
        offset (int, default 0)

    Responses:
        200  { total, limit, offset, errors: [ ... ] }
        404  tenant not found
    """
    try:
        limit = min(int(request.args.get("limit", 50)), 200)
    except (TypeError, ValueError):
        limit = 50
    try:
        offset = max(int(request.args.get("offset", 0)), 0)
    except (TypeError, ValueError):
        offset = 0

    # Resolve the tenant's database from the platform DB.
    session = get_platform_session()
    try:
        tenant = session.query(Tenant).filter_by(slug=slug).first()
        if tenant is None:
            return _error("NOT_FOUND", f"Tenant '{slug}' not found.", status=404)
        database_name = tenant.database_name
        tenant_name = tenant.name
    finally:
        session.close()

    base_url = current_app.config.get(
        "BASE_DATABASE_URL",
        os.environ.get("BASE_DATABASE_URL", "postgresql://sitekeeper:sitekeeper@localhost:5434"),
    )
    tenant_db_url = f"{base_url}/{database_name}"

    try:
        engine = create_engine(tenant_db_url)
        try:
            with engine.connect() as conn:
                total = conn.execute(
                    text("SELECT COUNT(*) FROM backend_error_log")
                ).scalar() or 0

                rows = conn.execute(
                    text(
                        """
                        SELECT id, request_id, tenant_slug, error_type, message,
                               stack_trace, http_method, path, status_code,
                               user_id, context, created_at
                        FROM backend_error_log
                        ORDER BY created_at DESC
                        LIMIT :limit OFFSET :offset
                        """
                    ),
                    {"limit": limit, "offset": offset},
                ).mappings().all()
        finally:
            engine.dispose()
    except Exception as e:
        logger.warning("Failed to fetch errors for %s: %s", database_name, e)
        return _error("QUERY_FAILED", "Failed to read the tenant error log.", status=500)

    errors = [
        {
            "id": str(r["id"]),
            "request_id": str(r["request_id"]) if r["request_id"] else None,
            "tenant_slug": r["tenant_slug"],
            "error_type": r["error_type"],
            "message": r["message"],
            "stack_trace": r["stack_trace"],
            "http_method": r["http_method"],
            "path": r["path"],
            "status_code": r["status_code"],
            "user_id": str(r["user_id"]) if r["user_id"] else None,
            "context": r["context"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]

    return jsonify({
        "slug": slug,
        "name": tenant_name,
        "total": total,
        "limit": limit,
        "offset": offset,
        "errors": errors,
    }), 200


def _fetch_tenant_metrics(db_url: str, db_name: str, bucket: str) -> dict:
    """Query a single tenant database for metrics."""
    metrics = {
        "admin_email": None,
        "employees": 0,
        "invoices": 0,
        "estimates": 0,
        "job_sites": 0,
        "jobs": 0,
        "paid_invoice_total": 0.0,
        "logins": 0,
        "db_size_mb": 0.0,
        "bucket_size_mb": 0.0,
        "error_count": 0,
    }

    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            # Admin email (first admin user)
            row = conn.execute(
                text("SELECT email FROM users WHERE role = 'admin' AND is_approved = true ORDER BY created_at LIMIT 1")
            ).fetchone()
            metrics["admin_email"] = row[0] if row else None

            # Employee count (all users)
            metrics["employees"] = conn.execute(text("SELECT COUNT(*) FROM users")).scalar() or 0

            # Invoices
            metrics["invoices"] = conn.execute(text("SELECT COUNT(*) FROM invoices")).scalar() or 0

            # Estimates
            metrics["estimates"] = conn.execute(text("SELECT COUNT(*) FROM estimates")).scalar() or 0

            # Job sites
            metrics["job_sites"] = conn.execute(text("SELECT COUNT(*) FROM job_sites")).scalar() or 0

            # Jobs
            metrics["jobs"] = conn.execute(text("SELECT COUNT(*) FROM jobs")).scalar() or 0

            # Paid invoice total — computed from line item entries for invoices with status = 'paid'
            paid_total = conn.execute(
                text("""
                    SELECT COALESCE(SUM(
                        CASE
                            WHEN e.entry_type = 'material' THEN COALESCE(e.unit_price, 0) * COALESCE(e.quantity, 0)
                            WHEN e.entry_type = 'hours' THEN COALESCE(e.hours, 0) * COALESCE(li.hourly_rate, 0)
                            WHEN e.entry_type = 'fee' THEN COALESCE(e.unit_price, 0) * COALESCE(e.quantity, 1)
                            ELSE 0
                        END
                    ), 0)
                    FROM invoices i
                    JOIN line_items li ON li.parent_id = i.id AND li.parent_type = 'invoice'
                    JOIN line_item_entries e ON e.line_item_id = li.id
                    WHERE i.status = 'paid'
                """)
            ).scalar()
            metrics["paid_invoice_total"] = float(paid_total or 0)

            # Total user count as proxy for "logins" (we don't track login events yet)
            metrics["logins"] = metrics["employees"]

            # Database size in MB
            db_size = conn.execute(
                text("SELECT pg_database_size(current_database())")
            ).scalar()
            metrics["db_size_mb"] = round((db_size or 0) / (1024 * 1024), 2)

        # Backend error count — separate connection so a missing table (very
        # old tenant DBs not yet migrated) can't poison the metrics above.
        try:
            with engine.connect() as conn:
                metrics["error_count"] = conn.execute(
                    text("SELECT COUNT(*) FROM backend_error_log")
                ).scalar() or 0
        except Exception:
            metrics["error_count"] = 0

        engine.dispose()
    except Exception as e:
        logger.warning("Failed to fetch metrics for %s: %s", db_name, e)

    # Bucket size — query MinIO
    try:
        storage = current_app.minio_storage
        if storage and storage.client:
            total_bytes = 0
            for obj in storage.client.list_objects(bucket, recursive=True):
                total_bytes += obj.size or 0
            metrics["bucket_size_mb"] = round(total_bytes / (1024 * 1024), 2)
    except Exception as e:
        logger.warning("Failed to get bucket size for %s: %s", bucket, e)

    return metrics


@superadmin_bp.post("/impersonate")
@superadmin_required
def impersonate():
    """Generate a tenant token to log in as the tenant's admin.

    Finds the first admin user in the specified tenant's database and issues
    a regular tenant JWT for that user. The superadmin can then use this token
    to access the tenant's app as if they were that admin.

    Request body (JSON):
        slug (str, required) — the tenant slug to impersonate

    Responses:
        200  { token, user_id, email, domain }
        404  tenant not found
        404  no admin user found in tenant
    """
    data = request.get_json(silent=True) or {}
    slug = (data.get("slug") or "").strip()

    if not slug:
        return _error("VALIDATION_ERROR", "Slug is required.", status=400)

    # Find the tenant in the platform DB
    session = get_platform_session()
    try:
        tenant = session.query(Tenant).filter_by(slug=slug, status="active").first()
        if tenant is None:
            return _error("NOT_FOUND", f"Tenant '{slug}' not found.", status=404)

        domain = tenant.domain
        database_name = tenant.database_name
    finally:
        session.close()

    # Connect to the tenant DB and find the first admin
    base_url = current_app.config.get(
        "BASE_DATABASE_URL",
        os.environ.get("BASE_DATABASE_URL", "postgresql://sitekeeper:sitekeeper@localhost:5434"),
    )
    tenant_db_url = f"{base_url}/{database_name}"

    try:
        engine = create_engine(tenant_db_url)
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    "SELECT id, email FROM users "
                    "WHERE role = 'admin' AND is_approved = true "
                    "ORDER BY created_at LIMIT 1"
                )
            ).fetchone()

        engine.dispose()

        if row is None:
            return _error("NOT_FOUND", f"No admin user found in tenant '{slug}'.", status=404)

        user_id = str(row[0])
        email = row[1]

    except Exception as e:
        logger.error("Failed to query tenant DB for impersonation: %s", e)
        return _error("INTERNAL_ERROR", "Failed to access tenant database.", status=500)

    # Issue a regular tenant token (no superadmin or platform claim)
    token = issue_token(user_id)

    return jsonify({
        "token": token,
        "user_id": user_id,
        "email": email,
        "domain": domain,
    }), 200
