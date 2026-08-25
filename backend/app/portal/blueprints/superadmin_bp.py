"""Superadmin blueprint — system-wide admin panel endpoints.

Routes:
    POST /api/v1/superadmin/login     — authenticate with superadmin credentials
    GET  /api/v1/superadmin/tenants   — get all tenants with live metrics (on demand)
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

            # Paid invoice total (sum of all invoices with status = 'paid')
            paid_total = conn.execute(
                text("SELECT COALESCE(SUM(total_cost), 0) FROM invoices WHERE status = 'paid'")
            ).scalar()
            metrics["paid_invoice_total"] = float(paid_total or 0)

            # Total user count as proxy for "logins" (we don't track login events yet)
            metrics["logins"] = metrics["employees"]

            # Database size in MB
            db_size = conn.execute(
                text("SELECT pg_database_size(current_database())")
            ).scalar()
            metrics["db_size_mb"] = round((db_size or 0) / (1024 * 1024), 2)

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
