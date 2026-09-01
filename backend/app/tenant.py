"""Multi-tenant resolution and database routing.

Each tenant is identified by their subdomain (e.g. 'nocoresources' from
'nocoresources.jobsyte.app'). The tenant config maps subdomains to their
dedicated database and MinIO bucket.

On each request, middleware extracts the tenant from the Host header and
swaps the SQLAlchemy engine so all queries (db.session and Model.query)
hit the correct tenant database.

Tenant data source priority:
1. Platform database (sk_platform.tenants table) — primary source
2. tenants.json file — fallback during migration period
"""

import json
import logging
import os
import time
from pathlib import Path

from flask import g, request
from sqlalchemy import create_engine

logger = logging.getLogger(__name__)

# Path to the tenant registry file (fallback during transition)
TENANTS_FILE = os.environ.get(
    "TENANTS_FILE",
    str(Path(__file__).resolve().parent.parent / "tenants.json"),
)

# Base connection URL (without database name) — used to construct per-tenant URLs
# e.g. "postgresql://sitekeeper:sitekeeper@localhost:5435"
BASE_DATABASE_URL = os.environ.get(
    "BASE_DATABASE_URL",
    "postgresql://sitekeeper:sitekeeper@localhost:5434",
)

# Fallback tenant slug when running locally without subdomains
DEFAULT_TENANT = os.environ.get("DEFAULT_TENANT", "default")

# ---------------------------------------------------------------------------
# Tenant cache — populated from platform DB or JSON fallback
# ---------------------------------------------------------------------------

# Cache: slug → config dict {database_url, bucket, domain, name, utilities}
_tenant_cache: dict = {}
_cache_updated_at: float = 0
CACHE_TTL_SECONDS = 60  # Refresh from platform DB every 60 seconds

# Cache of per-tenant SQLAlchemy engines
_engines: dict = {}

# Fallback: JSON file cache (used when platform DB is unavailable)
_json_cache: dict | None = None
_json_mtime: float = 0


def invalidate_tenant_cache():
    """Clear the tenant cache. Called after tenant creation or deletion."""
    global _tenant_cache, _cache_updated_at
    _tenant_cache = {}
    _cache_updated_at = 0


def _load_tenants_from_platform() -> dict | None:
    """Load active tenants from the platform database.

    Returns a dict in the same format as the old tenants.json:
        { slug: { database_url, bucket, domain, name, utilities } }

    Returns None if the platform DB is not available.
    """
    try:
        from .portal.platform_db import get_platform_session, is_platform_db_available

        if not is_platform_db_available():
            return None

        from .portal.models import Tenant

        session = get_platform_session()
        try:
            tenants = session.query(Tenant).filter_by(status="active").all()
            result = {}
            for t in tenants:
                result[t.slug] = {
                    "database_url": f"{BASE_DATABASE_URL}/{t.database_name}",
                    "bucket": t.bucket,
                    "domain": t.domain,
                    "name": t.name,
                    "utilities": t.enabled_utilities,
                    "debug_errors": bool(t.debug_errors),
                }
            return result
        finally:
            session.close()
    except Exception as e:
        logger.warning("Failed to load tenants from platform DB: %s", e)
        return None


def _load_tenants_from_json() -> dict:
    """Load tenants from the JSON file (fallback).

    The file is re-read if it has been modified since last load.
    """
    global _json_cache, _json_mtime

    try:
        mtime = os.path.getmtime(TENANTS_FILE)
    except OSError:
        logger.debug("Tenants file not found at %s", TENANTS_FILE)
        _json_cache = {}
        return _json_cache

    if _json_cache is not None and mtime <= _json_mtime:
        return _json_cache

    with open(TENANTS_FILE, "r") as f:
        _json_cache = json.load(f)
    _json_mtime = mtime
    logger.info("Loaded %d tenant(s) from %s", len(_json_cache), TENANTS_FILE)
    return _json_cache


def _load_tenants() -> dict:
    """Load tenants with platform DB as primary, JSON as fallback.

    Uses a time-based cache to avoid querying the platform DB on every request.
    """
    global _tenant_cache, _cache_updated_at

    now = time.time()
    if _tenant_cache and (now - _cache_updated_at) < CACHE_TTL_SECONDS:
        return _tenant_cache

    # Try platform DB first
    platform_tenants = _load_tenants_from_platform()
    if platform_tenants is not None:
        _tenant_cache = platform_tenants
        _cache_updated_at = now
        return _tenant_cache

    # Fallback to JSON file
    json_tenants = _load_tenants_from_json()
    _tenant_cache = json_tenants
    _cache_updated_at = now
    return _tenant_cache


def get_tenant_config(slug: str) -> dict | None:
    """Get configuration for a tenant by slug. Returns None if not found."""
    tenants = _load_tenants()
    return tenants.get(slug)


def resolve_tenant_slug() -> str:
    """Extract the tenant slug from the current request's Host header.

    Examples:
        nocoresources.jobsyte.app → 'nocoresources'
        localhost:5000 → DEFAULT_TENANT
        jobsyte.app → 'default'
        10.0.0.5:5000 → DEFAULT_TENANT (IP address)
        192.168.1.100:5000 → DEFAULT_TENANT (IP address)
    """
    host = request.host.split(":")[0]  # Strip port

    # Local development — no subdomain
    if host in ("localhost", "127.0.0.1"):
        return DEFAULT_TENANT

    # IP addresses (e.g. 10.0.0.5, 192.168.1.100) — treat as local dev
    if host.replace(".", "").isdigit():
        return DEFAULT_TENANT

    # Production: extract subdomain from *.domain.tld
    parts = host.split(".")
    if len(parts) >= 3:
        subdomain = parts[0]
        # 'www' is not a tenant — treat as default
        if subdomain == "www":
            return DEFAULT_TENANT
        return subdomain

    # Bare domain (jobsyte.app) — treat as default
    return DEFAULT_TENANT


def get_tenant_database_url(slug: str) -> str:
    """Build the database URL for a given tenant slug.

    For the DEFAULT_TENANT, returns None to signal that the app's
    SQLALCHEMY_DATABASE_URI should be used (supports local dev without
    needing tenants.json to match the local DB port).
    """
    if slug == DEFAULT_TENANT:
        # Use the app's configured DATABASE_URL (from .env / Config)
        # This avoids needing the platform DB to match local dev ports
        return None

    config = get_tenant_config(slug)
    if config and "database_url" in config:
        return config["database_url"]

    # Convention: database name is sk_<slug>
    db_name = f"sk_{slug}"
    return f"{BASE_DATABASE_URL}/{db_name}"


def get_tenant_bucket(slug: str) -> str:
    """Get the MinIO bucket name for a given tenant.

    Each tenant has a single unified bucket for all object storage
    (PDFs, photos, media). The convention is just the slug itself,
    with 'sitekeeper' for the default tenant.
    """
    config = get_tenant_config(slug)
    if config and "bucket" in config:
        return config["bucket"]
    # Convention: bucket name == slug (or 'sitekeeper' for default)
    if slug == DEFAULT_TENANT:
        return "sitekeeper"
    return slug


def get_engine_for_tenant(slug: str):
    """Get or create a SQLAlchemy engine for the given tenant.

    Returns None for the default tenant, signaling that the app's
    built-in engine (from SQLALCHEMY_DATABASE_URI) should be used.
    """
    url = get_tenant_database_url(slug)
    if url is None:
        # Default tenant uses the app's configured engine
        return None

    if slug not in _engines:
        _engines[slug] = create_engine(url, pool_size=5, max_overflow=10, pool_recycle=300)
        logger.info("Created database engine for tenant '%s'", slug)
    return _engines[slug]


def init_tenant_middleware(app):
    """Register before/after request hooks for tenant resolution.

    This sets up per-request tenant context:
    - g.tenant_slug: the resolved tenant identifier
    - g.tenant_config: the tenant's configuration dict

    The key mechanism: we swap Flask-SQLAlchemy's default engine
    (db.engines[None]) before each request so that all queries —
    both db.session.execute() and Model.query — route to the
    correct tenant database.

    This is safe with gunicorn sync workers (one request per worker
    at a time). For async/threaded workers, a more sophisticated
    approach would be needed.
    """
    from .extensions import db

    # Store the original app engine so we can restore it for default tenant requests
    _original_engine = None

    @app.before_request
    def resolve_tenant():
        nonlocal _original_engine

        slug = resolve_tenant_slug()
        config = get_tenant_config(slug)

        if config is None and slug != DEFAULT_TENANT:
            logger.warning("Unknown tenant slug: '%s'", slug)

        g.tenant_slug = slug
        g.tenant_config = config or {}

        # Set enabled utilities for this tenant (None = all enabled)
        from .utilities import get_enabled_utilities
        g.enabled_utilities = get_enabled_utilities(config)

        # Capture the original engine on first request
        if _original_engine is None:
            _original_engine = db.engines.get(None)

        # Swap the engine based on tenant
        engine = get_engine_for_tenant(slug)
        if engine is not None:
            # Non-default tenant: swap to tenant's engine
            db.session.remove()
            db.engines[None] = engine
        else:
            # Default tenant: restore the app's original engine
            # (in case a previous request swapped it to a different tenant)
            if db.engines.get(None) is not _original_engine:
                db.session.remove()
                db.engines[None] = _original_engine

    @app.teardown_appcontext
    def remove_session(exception=None):
        db.session.remove()
