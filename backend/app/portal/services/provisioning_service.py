"""Tenant provisioning service — pure Python, no shell commands.

Handles the full lifecycle of creating a new tenant:
1. Create PostgreSQL database
2. Run Alembic migrations on the new database
3. Create the admin user (copy credentials from platform user)
4. Create MinIO bucket
5. Register tenant in the platform database

All operations use Python libraries directly (psycopg2, alembic, minio SDK).
"""

import logging
import os
import uuid
from pathlib import Path

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from flask import current_app
from sqlalchemy.orm import Session

from ..models import PlatformUser, Tenant

logger = logging.getLogger(__name__)

# Path to the tenant alembic config (for running migrations on new DBs)
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent.parent
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"

# Base domain (read from env or default)
BASE_DOMAIN = os.environ.get("BASE_DOMAIN", "jobsyte.app")


class ProvisioningError(Exception):
    """Raised when tenant provisioning fails."""

    pass


class ProvisioningService:
    """Creates and provisions new tenant environments."""

    def create_tenant(
        self,
        slug: str,
        name: str,
        owner: PlatformUser,
        session: Session,
    ) -> Tenant:
        """Provision a new tenant end-to-end.

        Args:
            slug: Validated tenant slug (e.g. "my-company").
            name: Display name (e.g. "My Company LLC").
            owner: The PlatformUser creating this tenant.
            session: The platform DB session to use for the Tenant record.

        Returns:
            The created Tenant object (already committed to platform DB).

        Raises:
            ProvisioningError: If any step fails.
        """
        database_name = f"sk_{slug.replace('-', '_')}"
        bucket = slug
        domain = f"{slug}.{BASE_DOMAIN}"

        logger.info("Provisioning tenant '%s' (db=%s, bucket=%s)", slug, database_name, bucket)

        # 1. Create the Tenant record first (status=provisioning)
        tenant = Tenant(
            id=uuid.uuid4(),
            slug=slug,
            name=name,
            owner_id=owner.id,
            status="provisioning",
            database_name=database_name,
            bucket=bucket,
            domain=domain,
        )
        session.add(tenant)
        session.flush()  # Get the ID assigned

        try:
            # 2. Create PostgreSQL database
            self._create_database(database_name)

            # 3. Run Alembic migrations
            self._run_migrations(database_name)

            # 4. Create admin user in the new tenant DB
            self._create_admin_user(database_name, owner)

            # 5. Create MinIO bucket
            self._create_bucket(bucket)

            # 6. Mark tenant as active
            tenant.status = "active"
            session.commit()

            # 7. Invalidate the tenant cache
            from ...tenant import invalidate_tenant_cache
            invalidate_tenant_cache()

            logger.info("Tenant '%s' provisioned successfully.", slug)
            return tenant

        except Exception as e:
            logger.error("Provisioning failed for '%s': %s", slug, e)
            # Mark as failed but keep the record
            tenant.status = "provisioning"
            session.commit()
            raise ProvisioningError(f"Tenant provisioning failed: {e}") from e

    def _create_database(self, database_name: str) -> None:
        """Create a new PostgreSQL database using psycopg2."""
        # Build the admin connection URL (connects to 'postgres' db)
        base_url = current_app.config.get(
            "BASE_DATABASE_URL",
            os.environ.get("BASE_DATABASE_URL", "postgresql://sitekeeper:sitekeeper@localhost:5434"),
        )
        # Parse components for psycopg2
        # base_url format: postgresql://user:pass@host:port
        from urllib.parse import urlparse
        parsed = urlparse(base_url)

        conn = psycopg2.connect(
            host=parsed.hostname,
            port=parsed.port or 5432,
            user=parsed.username,
            password=parsed.password,
            dbname="postgres",
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)

        try:
            cur = conn.cursor()
            # Check if database already exists
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (database_name,))
            if cur.fetchone():
                logger.info("Database '%s' already exists — skipping creation.", database_name)
            else:
                # Use double-quote escaping for the identifier (safe — slug is validated)
                cur.execute(f'CREATE DATABASE "{database_name}"')
                logger.info("Created database '%s'.", database_name)
            cur.close()
        finally:
            conn.close()

    def _run_migrations(self, database_name: str) -> None:
        """Run Alembic migrations on the new tenant database."""
        from alembic import command
        from alembic.config import Config

        base_url = current_app.config.get(
            "BASE_DATABASE_URL",
            os.environ.get("BASE_DATABASE_URL", "postgresql://sitekeeper:sitekeeper@localhost:5434"),
        )
        tenant_db_url = f"{base_url}/{database_name}"

        # The tenant migrations/env.py reads DATABASE_URL from the environment
        # and uses it to override sqlalchemy.url. We need to temporarily set it
        # to point at the new tenant database.
        original_db_url = os.environ.get("DATABASE_URL")
        os.environ["DATABASE_URL"] = tenant_db_url

        try:
            alembic_cfg = Config(str(ALEMBIC_INI))
            alembic_cfg.set_main_option("sqlalchemy.url", tenant_db_url)
            alembic_cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))

            command.upgrade(alembic_cfg, "head")
            logger.info("Migrations applied to '%s'.", database_name)
        except Exception as e:
            raise ProvisioningError(f"Migration failed for {database_name}: {e}") from e
        finally:
            # Restore the original DATABASE_URL
            if original_db_url is not None:
                os.environ["DATABASE_URL"] = original_db_url
            else:
                os.environ.pop("DATABASE_URL", None)

    def _create_admin_user(self, database_name: str, owner: PlatformUser) -> None:
        """Create the first admin user in the new tenant database.

        Copies the email and password_hash from the platform user so they
        can log in immediately with the same credentials.
        """
        from sqlalchemy import create_engine, text

        base_url = current_app.config.get(
            "BASE_DATABASE_URL",
            os.environ.get("BASE_DATABASE_URL", "postgresql://sitekeeper:sitekeeper@localhost:5434"),
        )
        tenant_db_url = f"{base_url}/{database_name}"
        engine = create_engine(tenant_db_url)

        try:
            with engine.connect() as conn:
                # Insert the admin user directly
                user_id = str(uuid.uuid4())
                conn.execute(
                    text("""
                        INSERT INTO users (id, email, password_hash, name, role, is_approved)
                        VALUES (:id, :email, :password_hash, :name, 'admin', true)
                        ON CONFLICT (email) DO NOTHING
                    """),
                    {
                        "id": user_id,
                        "email": owner.email,
                        "password_hash": owner.password_hash,
                        "name": owner.name or "",
                    },
                )
                conn.commit()
                logger.info("Created admin user '%s' in '%s'.", owner.email, database_name)
        finally:
            engine.dispose()

    def _create_bucket(self, bucket_name: str) -> None:
        """Create a MinIO bucket for the tenant."""
        try:
            storage = current_app.minio_storage
            if storage is None:
                logger.warning("MinIO not available — skipping bucket creation for '%s'.", bucket_name)
                return

            # Access the underlying minio client
            client = storage.client
            if not client.bucket_exists(bucket_name):
                client.make_bucket(bucket_name)
                logger.info("Created MinIO bucket '%s'.", bucket_name)
            else:
                logger.info("MinIO bucket '%s' already exists.", bucket_name)
        except Exception as e:
            # Non-fatal — bucket can be created manually later
            logger.warning("Could not create MinIO bucket '%s': %s", bucket_name, e)
