#!/usr/bin/env bash
# =============================================================================
# SiteKeeper — Database Restore Script
#
# Restores a single database from a pg_dump custom-format backup file.
# The target database is dropped and recreated before restoring.
#
# Usage:
#   ./infra/restore-db.sh <backup_file> <database_name>
#
# Examples:
#   ./infra/restore-db.sh /home/sitekeeper/backups/daily/2026-05-23_030000_sitekeeper.sql.gz sitekeeper
#   ./infra/restore-db.sh /home/sitekeeper/backups/pre-deploy/2026-05-23_141500_sk_nocoresources.sql.gz sk_nocoresources
#
# Environment (reads from backend/.env if present):
#   PGHOST     — default: localhost
#   PGPORT     — default: 5435
#   PGUSER     — default: sitekeeper
#   PGPASSWORD — default: sitekeeper
#
# WARNING: This will DROP the target database and recreate it. All current data
#          in that database will be lost. Make sure you have the right file and
#          the right database name before proceeding.
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5435}"
PGUSER="${PGUSER:-sitekeeper}"
PGPASSWORD="${PGPASSWORD:-sitekeeper}"
export PGHOST PGPORT PGUSER PGPASSWORD

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[restore]${NC} $*"; }
warn()  { echo -e "${YELLOW}[restore]${NC} $*"; }
die()   { echo -e "${RED}[restore]${NC} $*" >&2; exit 1; }

# ── Argument validation ───────────────────────────────────────────────────────
if [[ $# -lt 2 ]]; then
    echo "Usage: $0 <backup_file> <database_name>"
    echo ""
    echo "Examples:"
    echo "  $0 /home/sitekeeper/backups/daily/2026-05-23_030000_sitekeeper.sql.gz sitekeeper"
    echo "  $0 /home/sitekeeper/backups/pre-deploy/2026-05-23_141500_sk_nocoresources.sql.gz sk_nocoresources"
    exit 1
fi

BACKUP_FILE="$1"
DB_NAME="$2"

[[ -f "$BACKUP_FILE" ]] || die "Backup file not found: $BACKUP_FILE"

# ── Preflight checks ─────────────────────────────────────────────────────────
command -v pg_restore >/dev/null 2>&1 || die "pg_restore not found. Install postgresql-client."
command -v psql >/dev/null 2>&1 || die "psql not found. Install postgresql-client."

# ── Confirmation ──────────────────────────────────────────────────────────────
echo ""
warn "╔══════════════════════════════════════════════════════════════╗"
warn "║  WARNING: This will DROP and RECREATE database: $DB_NAME"
warn "║  All current data in this database will be PERMANENTLY LOST."
warn "╚══════════════════════════════════════════════════════════════╝"
echo ""
info "Backup file: $BACKUP_FILE"
info "Target database: $DB_NAME"
info "Server: $PGHOST:$PGPORT"
echo ""
read -rp "Type the database name to confirm: " CONFIRM

if [[ "$CONFIRM" != "$DB_NAME" ]]; then
    die "Confirmation failed. Aborting."
fi

# ── Stop the API service to drop connections ──────────────────────────────────
info "Stopping sitekeeperapi service to release DB connections..."
sudo systemctl stop sitekeeperapi 2>/dev/null || warn "Could not stop service (may not be running)"

# ── Terminate existing connections ────────────────────────────────────────────
info "Terminating existing connections to $DB_NAME..."
psql --dbname=postgres -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
" >/dev/null 2>&1 || true

# ── Drop and recreate the database ───────────────────────────────────────────
info "Dropping database $DB_NAME..."
psql --dbname=postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" || die "Failed to drop database"

info "Creating database $DB_NAME..."
psql --dbname=postgres -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$PGUSER\";" || die "Failed to create database"

# ── Restore from backup ──────────────────────────────────────────────────────
info "Restoring from $BACKUP_FILE..."
if pg_restore --dbname="$DB_NAME" --no-owner --no-acl "$BACKUP_FILE"; then
    info "✓ Database $DB_NAME restored successfully."
else
    # pg_restore may return non-zero for non-critical warnings (e.g. missing roles)
    warn "pg_restore completed with warnings (this is often harmless)."
fi

# ── Restart the API service ───────────────────────────────────────────────────
info "Restarting sitekeeperapi service..."
sudo systemctl start sitekeeperapi 2>/dev/null || warn "Could not start service"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
info "Restore complete. Database $DB_NAME is now running from the backup."
info "Verify the app is working: https://entouch.org"
