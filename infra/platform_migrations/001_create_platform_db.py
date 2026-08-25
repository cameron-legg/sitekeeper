"""Platform Migration 001: Create the sk_platform database and run schema migrations.

This migration:
1. Creates the sk_platform PostgreSQL database (if it doesn't exist)
2. Runs Alembic migrations using alembic_platform.ini to create the schema

Idempotent: safe to run multiple times.
"""

import logging
import os
import subprocess
import sys
from pathlib import Path

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

logger = logging.getLogger("platform_migrations.001")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"


def _get_admin_connection_params() -> dict:
    """Get connection parameters for the Postgres admin database."""
    base_url = os.environ.get(
        "BASE_DATABASE_URL",
        "postgresql://sitekeeper:sitekeeper@localhost:5434",
    )
    from urllib.parse import urlparse
    parsed = urlparse(base_url)
    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 5432,
        "user": parsed.username or "sitekeeper",
        "password": parsed.password or "sitekeeper",
    }


def upgrade() -> None:
    """Create sk_platform database and run Alembic migrations."""
    platform_db_name = "sk_platform"

    # Parse the platform URL to get the DB name (in case it's overridden)
    platform_url = os.environ.get("PLATFORM_DATABASE_URL", "")
    if platform_url:
        from urllib.parse import urlparse
        parsed = urlparse(platform_url)
        if parsed.path:
            platform_db_name = parsed.path.lstrip("/")

    # Step 1: Create the database
    logger.info("Creating database '%s' (if not exists)...", platform_db_name)
    params = _get_admin_connection_params()

    conn = psycopg2.connect(dbname="postgres", **params)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (platform_db_name,))
        if cur.fetchone():
            logger.info("  Database '%s' already exists.", platform_db_name)
        else:
            cur.execute(f'CREATE DATABASE "{platform_db_name}"')
            logger.info("  Created database '%s'.", platform_db_name)
        cur.close()
    finally:
        conn.close()

    # Step 2: Run Alembic migrations for the platform schema
    logger.info("Running platform schema migrations...")
    alembic_ini = BACKEND_DIR / "alembic_platform.ini"

    env = os.environ.copy()
    if not env.get("PLATFORM_DATABASE_URL"):
        # Build it from BASE_DATABASE_URL
        base = env.get("BASE_DATABASE_URL", "postgresql://sitekeeper:sitekeeper@localhost:5434")
        env["PLATFORM_DATABASE_URL"] = f"{base}/{platform_db_name}"

    # Use the venv python if available, otherwise sys.executable
    python = str(BACKEND_DIR / "venv" / "bin" / "python")
    if not os.path.exists(python):
        python = sys.executable

    result = subprocess.run(
        [python, "-m", "alembic", "-c", str(alembic_ini), "upgrade", "head"],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        logger.error("  Alembic migration failed:\n%s", result.stderr)
        raise RuntimeError(f"Platform migration failed: {result.stderr}")

    logger.info("  Platform schema migrations applied successfully.")
