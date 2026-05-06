"""Multi-tenant resolution and database routing.

Each tenant is identified by their subdomain (e.g. 'nocoresources' from
'nocoresources.entouch.org'). The tenant config maps subdomains to their
dedicated database and MinIO bucket.

On each request, middleware extracts the tenant from the Host header and
binds SQLAlchemy to the correct database for that request.
"""

import json
import logging
import os
from pathlib import Path

from flask import g, request
from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker

logger = logging.getLogger(__name__)

# Path to the tenant registry file
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

# Cache of loaded tenant configs
_tenants_cache: dict | None = None
_tenants_mtime: float = 0

# Cache of per-tenant SQLAlchemy engines
_engines: dict = {}


def _load_tenants() -> dict:
    """Load and cache the tenants registry from disk.

    The file is re-read if it has been modified since last load.
    """
    global _tenants_cache, _tenants_mtime

    try:
        mtime = os.path.getmtime(TENANTS_FILE)
    except OSError:
        logger.warning("Tenants file not found at %s — using empty registry", TENANTS_FILE)
        _tenants_cache = {}
        return _tenants_cache

    if _tenants_cache is not None and mtime <= _tenants_mtime:
        return _tenants_cache

    with open(TENANTS_FILE, "r") as f:
        _tenants_cache = json.load(f)
    _tenants_mtime = mtime
    logger.info("Loaded %d tenant(s) from %s", len(_tenants_cache), TENANTS_FILE)
    return _tenants_cache


def get_tenant_config(slug: str) -> dict | None:
    """Get configuration for a tenant by slug. Returns None if not found."""
    tenants = _load_tenants()
    return tenants.get(slug)


def resolve_tenant_slug() -> str:
    """Extract the tenant slug from the current request's Host header.

    Examples:
        nocoresources.entouch.org → 'nocoresources'
        localhost:5000 → DEFAULT_TENANT
        entouch.org → 'default'
    """
    host = request.host.split(":")[0]  # Strip port

    # Local development — no subdomain
    if host in ("localhost", "127.0.0.1"):
        return DEFAULT_TENANT

    # Production: extract subdomain from *.entouch.org
    parts = host.split(".")
    if len(parts) >= 3:
        # e.g. ['nocoresources', 'entouch', 'org']
        return parts[0]

    # Bare domain (entouch.org) — treat as default
    return DEFAULT_TENANT


def get_tenant_database_url(slug: str) -> str:
    """Build the database URL for a given tenant slug."""
    config = get_tenant_config(slug)
    if config and "database_url" in config:
        return config["database_url"]

    # Convention: database name is sk_<slug>
    db_name = f"sk_{slug}"
    return f"{BASE_DATABASE_URL}/{db_name}"


def get_tenant_bucket(slug: str) -> str:
    """Get the MinIO bucket name for a given tenant."""
    config = get_tenant_config(slug)
    if config and "bucket" in config:
        return config["bucket"]
    return f"{slug}-pdfs"


def get_engine_for_tenant(slug: str):
    """Get or create a SQLAlchemy engine for the given tenant."""
    if slug not in _engines:
        url = get_tenant_database_url(slug)
        _engines[slug] = create_engine(url, pool_size=5, max_overflow=10, pool_recycle=300)
        logger.info("Created database engine for tenant '%s'", slug)
    return _engines[slug]


def init_tenant_middleware(app):
    """Register before/after request hooks for tenant resolution.

    This sets up per-request tenant context:
    - g.tenant_slug: the resolved tenant identifier
    - g.tenant_config: the tenant's configuration dict
    - Binds the SQLAlchemy session to the tenant's database engine
    """
    from .extensions import db

    @app.before_request
    def resolve_tenant():
        slug = resolve_tenant_slug()
        config = get_tenant_config(slug)

        if config is None and slug != DEFAULT_TENANT:
            # Unknown tenant — could return 404, but for now fall through
            # to default so the health endpoint still works
            logger.warning("Unknown tenant slug: '%s'", slug)

        g.tenant_slug = slug
        g.tenant_config = config or {}

        # Bind SQLAlchemy session to the tenant's engine
        engine = get_engine_for_tenant(slug)
        db.session.bind = engine

    @app.teardown_appcontext
    def remove_session(exception=None):
        db.session.remove()
