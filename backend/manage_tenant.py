#!/usr/bin/env python3
"""Tenant management CLI — create and list tenants.

Usage:
    python manage_tenant.py create <slug> --name "Display Name"
    python manage_tenant.py list

This script:
1. Creates a new PostgreSQL database for the tenant
2. Runs Alembic migrations on the new database
3. Creates a MinIO bucket for the tenant
4. Registers the tenant in tenants.json
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
TENANTS_FILE = SCRIPT_DIR / "tenants.json"
ALEMBIC_INI = SCRIPT_DIR / "alembic.ini"

# Database connection for admin operations (connects to 'postgres' db)
ADMIN_DB_URL = os.environ.get(
    "ADMIN_DATABASE_URL",
    "postgresql://sitekeeper:sitekeeper@localhost:5435/postgres",
)

# Base URL for tenant databases (without db name)
BASE_DB_URL = os.environ.get(
    "BASE_DATABASE_URL",
    "postgresql://sitekeeper:sitekeeper@localhost:5435",
)

# MinIO settings
MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "minioadmin")

# Domain
BASE_DOMAIN = os.environ.get("BASE_DOMAIN", "entouch.org")


def load_tenants() -> dict:
    """Load the tenants registry."""
    if TENANTS_FILE.exists():
        with open(TENANTS_FILE) as f:
            return json.load(f)
    return {}


def save_tenants(tenants: dict):
    """Save the tenants registry."""
    with open(TENANTS_FILE, "w") as f:
        json.dump(tenants, f, indent=4)
    print(f"  ✓ Updated {TENANTS_FILE}")


def create_database(db_name: str):
    """Create a new PostgreSQL database."""
    # Parse admin URL
    conn = psycopg2.connect(ADMIN_DB_URL)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    # Check if database already exists
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
    if cur.fetchone():
        print(f"  ⚠ Database '{db_name}' already exists — skipping creation")
    else:
        cur.execute(f'CREATE DATABASE "{db_name}"')
        print(f"  ✓ Created database '{db_name}'")

    cur.close()
    conn.close()


def run_migrations(db_url: str):
    """Run Alembic migrations against the given database URL."""
    env = os.environ.copy()
    env["DATABASE_URL"] = db_url

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(ALEMBIC_INI), "upgrade", "head"],
        cwd=str(SCRIPT_DIR),
        env=env,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(f"  ✗ Migration failed:\n{result.stderr}")
        sys.exit(1)
    else:
        print(f"  ✓ Migrations applied successfully")


def create_minio_bucket(bucket_name: str):
    """Create a MinIO bucket for the tenant."""
    try:
        from minio import Minio
        from minio.error import S3Error

        client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=False,
        )

        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)
            print(f"  ✓ Created MinIO bucket '{bucket_name}'")
        else:
            print(f"  ⚠ MinIO bucket '{bucket_name}' already exists")
    except Exception as e:
        print(f"  ⚠ Could not create MinIO bucket: {e}")
        print(f"    (You can create it manually later)")


def cmd_create(args):
    """Create a new tenant."""
    slug = args.slug.lower().strip()
    name = args.name or slug.replace("-", " ").title()

    # Validate slug
    if not slug.isalnum() and not all(c.isalnum() or c == "-" for c in slug):
        print("✗ Slug must be lowercase alphanumeric with hyphens only")
        sys.exit(1)

    tenants = load_tenants()
    if slug in tenants:
        print(f"✗ Tenant '{slug}' already exists")
        sys.exit(1)

    db_name = f"sk_{slug}"
    bucket_name = f"{slug}-pdfs"
    db_url = f"{BASE_DB_URL}/{db_name}"
    domain = f"{slug}.{BASE_DOMAIN}"

    print(f"Creating tenant: {slug}")
    print(f"  Domain:   {domain}")
    print(f"  Database: {db_name}")
    print(f"  Bucket:   {bucket_name}")
    print()

    # 1. Create database
    print("Step 1: Creating database...")
    create_database(db_name)

    # 2. Run migrations
    print("Step 2: Running migrations...")
    run_migrations(db_url)

    # 3. Create MinIO bucket
    print("Step 3: Creating MinIO bucket...")
    create_minio_bucket(bucket_name)

    # 4. Register in tenants.json
    print("Step 4: Registering tenant...")
    tenants[slug] = {
        "database_url": db_url,
        "bucket": bucket_name,
        "domain": domain,
        "name": name,
    }
    save_tenants(tenants)

    print()
    print(f"✓ Tenant '{slug}' created successfully!")
    print(f"  URL: https://{domain}")
    print()
    print("Next steps:")
    print(f"  1. Add nginx config for {domain} (see infra/add-tenant-nginx.sh)")
    print(f"  2. Restart the API service: sudo systemctl restart sitekeeperapi")


def cmd_list(args):
    """List all tenants."""
    tenants = load_tenants()
    if not tenants:
        print("No tenants configured.")
        return

    print(f"{'Slug':<20} {'Name':<25} {'Domain':<35} {'Database':<25}")
    print("-" * 105)
    for slug, config in tenants.items():
        print(
            f"{slug:<20} {config.get('name', ''):<25} "
            f"{config.get('domain', ''):<35} "
            f"{config.get('database_url', '').split('/')[-1]:<25}"
        )


def main():
    parser = argparse.ArgumentParser(description=f"{os.environ.get('APP_NAME', 'JobSyte')} tenant management")
    subparsers = parser.add_subparsers(dest="command")

    # create
    create_parser = subparsers.add_parser("create", help="Create a new tenant")
    create_parser.add_argument("slug", help="Tenant identifier (e.g. 'nocoresources')")
    create_parser.add_argument("--name", help="Display name (e.g. 'NoCo Resources')")

    # list
    subparsers.add_parser("list", help="List all tenants")

    args = parser.parse_args()

    if args.command == "create":
        cmd_create(args)
    elif args.command == "list":
        cmd_list(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
