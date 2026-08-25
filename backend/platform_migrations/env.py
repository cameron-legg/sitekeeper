"""Alembic environment for the platform database (sk_platform).

This is completely independent from the tenant migrations in migrations/env.py.
It imports only the portal models and targets PLATFORM_DATABASE_URL.
"""

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Ensure the backend package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import platform models so Alembic can detect the schema
from app.portal.models import PlatformBase  # noqa: E402

# Alembic Config object
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Use PLATFORM_DATABASE_URL from environment
db_url = os.environ.get(
    "PLATFORM_DATABASE_URL",
    "postgresql://sitekeeper:sitekeeper@localhost:5434/sk_platform",
)
config.set_main_option("sqlalchemy.url", db_url)

# Target the platform models metadata (not the tenant models)
target_metadata = PlatformBase.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
