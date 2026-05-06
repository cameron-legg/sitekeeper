#!/usr/bin/env bash
# =============================================================================
# deploy-all.sh — Deploy latest code to ALL tenants
#
# Usage:
#   ./infra/deploy-all.sh
#
# Pulls latest code once, then rebuilds and restarts every tenant.
# =============================================================================

set -euo pipefail

TENANTS_DIR="/home/sitekeeper/tenants"
APP_DIR="/home/sitekeeper/app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}▶ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
die()  { echo -e "${RED}✗ $*${NC}"; exit 1; }

[[ -d "$TENANTS_DIR" ]] || die "No tenants directory found at $TENANTS_DIR"

# Pull latest code once
info "Pulling latest code..."
GIT_SSH_COMMAND='ssh -i /home/sitekeeper/.ssh/github' \
    git -C "$APP_DIR" pull --ff-only

# Deploy each tenant
TENANTS=$(find "$TENANTS_DIR" -mindepth 1 -maxdepth 1 -type d -exec basename {} \;)

if [[ -z "$TENANTS" ]]; then
    warn "No tenants found in $TENANTS_DIR"
    exit 0
fi

FAILED=""
for tenant in $TENANTS; do
    info "Deploying: $tenant"
    TENANT_DIR="${TENANTS_DIR}/${tenant}"

    source "$TENANT_DIR/.env"

    # Rebuild and restart
    (cd "$TENANT_DIR" && docker compose --env-file .env build --no-cache && docker compose --env-file .env up -d) || {
        warn "  Failed to deploy $tenant"
        FAILED="$FAILED $tenant"
        continue
    }

    info "  $tenant deployed → https://$DOMAIN"
done

if [[ -n "$FAILED" ]]; then
    warn "The following tenants failed to deploy:$FAILED"
    exit 1
fi

info "All tenants deployed successfully."
