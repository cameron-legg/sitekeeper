"""Alembic environment configuration.

Integrates with the Flask app factory so that:
- The database URL is read from the Flask config (which reads from .env).
- All SQLAlchemy models are imported before autogenerate runs, so Alembic
  can detect the full schema.
"""

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# ---------------------------------------------------------------------------
# Make sure the backend package is importable when running alembic from the
# backend/ directory (e.g. `alembic -c alembic.ini upgrade head`).
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402
import app.models  # noqa: E402, F401 — import side-effect registers all models

# ---------------------------------------------------------------------------
# Alembic Config object — gives access to values in alembic.ini
# ---------------------------------------------------------------------------
config = context.config

# Interpret the config file for Python logging if present
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ---------------------------------------------------------------------------
# Build a minimal Flask app to extract the database URL from Flask config.
# If DATABASE_URL is set in the environment, use it directly (allows running
# migrations against any tenant database).
# ---------------------------------------------------------------------------
flask_app = create_app({"TESTING": True})  # TESTING=True skips MinIO + tenant middleware

# Allow DATABASE_URL env var to override the Flask config
db_url = os.environ.get("DATABASE_URL") or flask_app.config["SQLALCHEMY_DATABASE_URI"]
config.set_main_option("sqlalchemy.url", db_url)

target_metadata = db.metadata


# ---------------------------------------------------------------------------
# Run migrations
# ---------------------------------------------------------------------------


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no live DB connection needed)."""
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
    """Run migrations in 'online' mode (connects to the database)."""
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
