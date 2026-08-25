"""Platform Migration 002: Seed tenants from tenants.json into sk_platform.

Reads the existing tenants.json file and inserts each tenant into the
platform database's `tenants` table. This preserves all existing tenants
during the migration from file-based to DB-based tenant management.

Legacy tenants are created with owner_id=NULL (they can be "claimed"
later when the owner creates a platform account).

Idempotent: skips tenants that already exist in the platform DB.
"""

import json
import logging
import os
import uuid
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

logger = logging.getLogger("platform_migrations.002")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"


def _get_platform_db_url() -> str:
    """Get the platform database URL."""
    url = os.environ.get("PLATFORM_DATABASE_URL", "")
    if not url:
        base = os.environ.get(
            "BASE_DATABASE_URL",
            "postgresql://sitekeeper:sitekeeper@localhost:5434",
        )
        url = f"{base}/sk_platform"
    return url


def _load_tenants_json() -> dict:
    """Load tenants from the JSON file."""
    tenants_file = os.environ.get(
        "TENANTS_FILE",
        str(BACKEND_DIR / "tenants.json"),
    )
    path = Path(tenants_file)
    if not path.exists():
        logger.warning("tenants.json not found at %s — nothing to seed.", path)
        return {}
    with open(path, "r") as f:
        return json.load(f)


def upgrade() -> None:
    """Seed tenants from tenants.json into the platform database."""
    tenants_json = _load_tenants_json()
    if not tenants_json:
        logger.info("No tenants to seed.")
        return

    logger.info("Seeding %d tenant(s) from tenants.json...", len(tenants_json))

    # Connect to the platform database
    platform_url = _get_platform_db_url()
    conn = psycopg2.connect(platform_url)

    try:
        cur = conn.cursor()

        # Get existing slugs to avoid duplicates
        cur.execute("SELECT slug FROM tenants")
        existing_slugs = {row[0] for row in cur.fetchall()}

        inserted = 0
        skipped = 0

        for slug, config in tenants_json.items():
            if slug in existing_slugs:
                logger.info("  Tenant '%s' already exists — skipping.", slug)
                skipped += 1
                continue

            # Derive fields from the config
            domain = config.get("domain", f"{slug}.jobsyte.app")
            bucket = config.get("bucket", slug)
            name = config.get("name", slug)

            # Derive database_name from database_url or convention
            db_url = config.get("database_url", "")
            if db_url:
                # Extract the database name from the URL
                database_name = db_url.rstrip("/").split("/")[-1]
            else:
                database_name = f"sk_{slug}" if slug != "default" else "sitekeeper"

            # Get enabled_utilities if present
            utilities = config.get("utilities")
            utilities_json = json.dumps(utilities) if utilities else None

            tenant_id = str(uuid.uuid4())

            cur.execute(
                """
                INSERT INTO tenants (id, slug, name, owner_id, status, plan,
                                     database_name, bucket, domain, enabled_utilities)
                VALUES (%s, %s, %s, NULL, 'active', 'free', %s, %s, %s, %s)
                """,
                (tenant_id, slug, name, database_name, bucket, domain, utilities_json),
            )
            inserted += 1
            logger.info("  Inserted tenant '%s' (db=%s, domain=%s).", slug, database_name, domain)

        conn.commit()
        logger.info("  Seeding complete: %d inserted, %d skipped.", inserted, skipped)

    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
