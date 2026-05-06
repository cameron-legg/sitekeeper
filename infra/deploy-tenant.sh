#!/usr/bin/env bash
# =============================================================================
# deploy-tenant.sh — Deploy latest code to a single tenant
#
# Usage:
#   ./infra/deploy-tenant.sh <tenant-name>
#
# This rebuilds the backend and frontend containers with the latest code
# and restarts the tenant's stack.
# =============================================================================

set -euo pipefail

TENANTS_DIR="/home/sitekeeper/tenants"
APP_DIR="/home/sitekeeper/app"

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}▶ $*${NC}"; }
die()  { echo -e "${RED}✗ $*${NC}"; exit 1; }

TENANT="${1:-}"
[[ -z "$TENANT" ]] && die "Usage: $0 <tenant-name>"

TENANT_DIR="${TENANTS_DIR}/${TENANT}"
[[ -d "$TENANT_DIR" ]] || die "Tenant '$TENANT' not found at $TENANT_DIR"

# Source tenant env to get the domain
source "$TENANT_DIR/.env"

info "Deploying latest code to tenant: $TENANT ($DOMAIN)"

# Pull latest code
info "  Pulling latest code..."
GIT_SSH_COMMAND='ssh -i /home/sitekeeper/.ssh/github' \
    git -C "$APP_DIR" pull --ff-only

# Rebuild and restart containers
info "  Rebuilding containers..."
(cd "$TENANT_DIR" && docker compose --env-file .env build --no-cache)

info "  Restarting containers..."
(cd "$TENANT_DIR" && docker compose --env-file .env up -d)

# Wait for backend to be healthy
info "  Waiting for backend to be ready..."
for i in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:${API_PORT}/api/v1/health" > /dev/null 2>&1; then
        info "  Backend is healthy."
        break
    fi
    sleep 2
done

info "Deploy complete for $TENANT → https://$DOMAIN"
