#!/usr/bin/env bash
# =============================================================================
# SiteKeeper — Database Backup Script
#
# Dumps all tenant databases (discovered from tenants.json) using pg_dump over
# TCP to localhost:5435. Backups are stored OUTSIDE Docker volumes so they
# survive container recreation.
#
# Usage:
#   ./infra/backup-db.sh                  # daily backup (stored in daily/)
#   ./infra/backup-db.sh pre-deploy       # pre-deploy backup (stored in pre-deploy/)
#   ./infra/backup-db.sh manual           # ad-hoc backup (stored in manual/)
#
# Environment (reads from backend/.env if present):
#   PGHOST     — default: localhost
#   PGPORT     — default: 5435
#   PGUSER     — default: sitekeeper
#   PGPASSWORD — default: sitekeeper
#
# Retention:
#   daily/       — 30 days
#   pre-deploy/  — 90 days
#   manual/      — never auto-pruned
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
TENANTS_FILE="$APP_DIR/backend/tenants.json"
BACKUP_ROOT="/home/sitekeeper/backups"

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5435}"
PGUSER="${PGUSER:-sitekeeper}"
PGPASSWORD="${PGPASSWORD:-sitekeeper}"
export PGHOST PGPORT PGUSER PGPASSWORD

# ── Label (subdirectory) ──────────────────────────────────────────────────────
LABEL="${1:-daily}"
BACKUP_DIR="$BACKUP_ROOT/$LABEL"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[backup]${NC} $*"; }
warn()  { echo -e "${YELLOW}[backup]${NC} $*"; }
die()   { echo -e "${RED}[backup]${NC} $*" >&2; exit 1; }

# ── Preflight checks ─────────────────────────────────────────────────────────
command -v pg_dump >/dev/null 2>&1 || die "pg_dump not found. Install postgresql-client."
command -v python3 >/dev/null 2>&1 || die "python3 not found."
[[ -f "$TENANTS_FILE" ]] || die "Tenants file not found: $TENANTS_FILE"

# ── Create backup directory ───────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Discover databases from tenants.json ──────────────────────────────────────
DATABASES=$(python3 -c "
import json, urllib.parse
with open('$TENANTS_FILE') as f:
    tenants = json.load(f)
for slug, cfg in tenants.items():
    url = cfg['database_url']
    # Extract database name from the URL
    db_name = url.rsplit('/', 1)[-1]
    print(db_name)
")

if [[ -z "$DATABASES" ]]; then
    die "No databases found in $TENANTS_FILE"
fi

# ── Run pg_dump for each database ─────────────────────────────────────────────
info "Starting backup (label=$LABEL, timestamp=$TIMESTAMP)"
FAILED=0

for DB_NAME in $DATABASES; do
    OUTFILE="$BACKUP_DIR/${TIMESTAMP}_${DB_NAME}.sql.gz"
    info "  Dumping $DB_NAME → $OUTFILE"

    if pg_dump --dbname="$DB_NAME" --format=custom --compress=6 > "$OUTFILE" 2>/dev/null; then
        SIZE=$(du -h "$OUTFILE" | cut -f1)
        info "  ✓ $DB_NAME ($SIZE)"
    else
        warn "  ✗ Failed to dump $DB_NAME"
        rm -f "$OUTFILE"
        FAILED=$((FAILED + 1))
    fi
done

# ── Prune old backups ─────────────────────────────────────────────────────────
prune_dir() {
    local dir="$1" days="$2"
    if [[ -d "$dir" ]]; then
        local count
        count=$(find "$dir" -maxdepth 1 -name "*.sql.gz" -mtime +"$days" 2>/dev/null | wc -l || true)
        if [[ "$count" -gt 0 ]]; then
            info "  Pruning $count file(s) older than $days days from $dir"
            find "$dir" -maxdepth 1 -name "*.sql.gz" -mtime +"$days" -delete 2>/dev/null
        fi
    fi
}

prune_dir "$BACKUP_ROOT/daily" 30
prune_dir "$BACKUP_ROOT/pre-deploy" 90
# manual/ is never auto-pruned

# ── Summary ───────────────────────────────────────────────────────────────────
TOTAL=$(echo "$DATABASES" | wc -w)
SUCCESS=$((TOTAL - FAILED))

if [[ "$FAILED" -eq 0 ]]; then
    info "Backup complete: $SUCCESS/$TOTAL databases backed up to $BACKUP_DIR"
else
    warn "Backup finished with errors: $SUCCESS/$TOTAL succeeded, $FAILED failed"
    exit 1
fi
