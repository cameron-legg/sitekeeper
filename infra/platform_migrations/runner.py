#!/usr/bin/env python3
"""Platform infrastructure migrations runner.

Discovers numbered migration scripts in this directory, compares them against
the applied-state file, and executes any pending migrations in order.

Usage:
    python infra/platform_migrations/runner.py

Environment:
    Reads database credentials from the environment (same vars as the Flask app).

State file:
    infra/platform_migrations/platform_migrations_applied.json
    (server-side, git-ignored)
"""

import importlib.util
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
STATE_FILE = SCRIPT_DIR / "platform_migrations_applied.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("platform_migrations")


# ---------------------------------------------------------------------------
# State management
# ---------------------------------------------------------------------------


def _load_state() -> dict:
    """Load the applied migrations state from disk."""
    if not STATE_FILE.exists():
        return {"applied": []}
    with open(STATE_FILE, "r") as f:
        return json.load(f)


def _save_state(state: dict) -> None:
    """Persist the applied migrations state to disk."""
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)
        f.write("\n")


def _is_applied(state: dict, migration_id: str) -> bool:
    """Check if a migration has already been applied."""
    return any(m["id"] == migration_id for m in state["applied"])


def _mark_applied(state: dict, migration_id: str) -> None:
    """Record a migration as applied."""
    state["applied"].append({
        "id": migration_id,
        "applied_at": datetime.now(timezone.utc).isoformat(),
    })
    _save_state(state)


# ---------------------------------------------------------------------------
# Migration discovery
# ---------------------------------------------------------------------------


def _discover_migrations() -> list[tuple[str, Path]]:
    """Find all migration files in this directory, sorted by number.

    Migration files must match the pattern: NNN_description.py
    (where NNN is a zero-padded number). Files starting with _ are ignored.
    """
    migrations = []
    for path in sorted(SCRIPT_DIR.glob("[0-9]*.py")):
        migration_id = path.stem  # e.g. "001_create_platform_db"
        migrations.append((migration_id, path))
    return migrations


# ---------------------------------------------------------------------------
# Environment setup
# ---------------------------------------------------------------------------


def _load_env() -> None:
    """Load .env file if dotenv is available."""
    try:
        from dotenv import load_dotenv
        env_path = PROJECT_ROOT / "backend" / ".env"
        if env_path.exists():
            load_dotenv(env_path)
    except ImportError:
        pass


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------


def run() -> None:
    """Execute all pending platform infrastructure migrations."""
    logger.info("=== Platform Infrastructure Migrations ===")

    _load_env()

    state = _load_state()
    migrations = _discover_migrations()

    if not migrations:
        logger.info("No migration files found.")
        return

    pending = [(mid, path) for mid, path in migrations if not _is_applied(state, mid)]

    if not pending:
        logger.info("All %d migration(s) already applied. Nothing to do.", len(migrations))
        return

    logger.info(
        "Found %d migration(s) total, %d pending.",
        len(migrations),
        len(pending),
    )

    for migration_id, path in pending:
        logger.info("")
        logger.info("--- Running: %s ---", migration_id)

        # Load the migration module dynamically
        spec = importlib.util.spec_from_file_location(migration_id, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # Each migration must define an `upgrade()` function
        if not hasattr(module, "upgrade"):
            logger.error("Migration %s has no upgrade() function — skipping.", migration_id)
            continue

        try:
            module.upgrade()
        except Exception:
            logger.exception("Migration %s FAILED.", migration_id)
            sys.exit(1)

        _mark_applied(state, migration_id)
        logger.info("--- Completed: %s ---", migration_id)

    logger.info("")
    logger.info("=== All platform infrastructure migrations applied. ===")


if __name__ == "__main__":
    run()
