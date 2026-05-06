#!/usr/bin/env bash
# =============================================================================
# manage-tenant.sh — Create or destroy a tenant environment
#
# Usage:
#   ./infra/manage-tenant.sh create <tenant-name>
#   ./infra/manage-tenant.sh destroy <tenant-name>
#
# Example:
#   ./infra/manage-tenant.sh create nocoresources
#   → Creates nocoresources.entouch.org
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
BASE_DOMAIN="entouch.org"
TENANTS_DIR="/home/sitekeeper/tenants"
NGINX_CONF_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
APP_DIR="/home/sitekeeper/app"
PORT_BASE=6000
PORT_STEP=10  # Each tenant uses 5 ports starting at PORT_BASE + (index * PORT_STEP)

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}▶ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $*${NC}"; }
die()   { echo -e "${RED}✗ $*${NC}"; exit 1; }

# ── Argument parsing ──────────────────────────────────────────────────────────
ACTION="${1:-}"
TENANT="${2:-}"

[[ -z "$ACTION" || -z "$TENANT" ]] && die "Usage: $0 <create|destroy> <tenant-name>"
[[ "$ACTION" =~ ^(create|destroy)$ ]] || die "Action must be 'create' or 'destroy'"

# Validate tenant name (lowercase alphanumeric + hyphens only)
[[ "$TENANT" =~ ^[a-z0-9][a-z0-9-]*[a-z0-9]$ ]] || die "Tenant name must be lowercase alphanumeric with hyphens (e.g. 'nocoresources')"

DOMAIN="${TENANT}.${BASE_DOMAIN}"
TENANT_DIR="${TENANTS_DIR}/${TENANT}"

# ── Helper: get next available port block ─────────────────────────────────────
get_port_block() {
    local index=0
    if [[ -d "$TENANTS_DIR" ]]; then
        index=$(find "$TENANTS_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l)
    fi
    echo $((PORT_BASE + index * PORT_STEP))
}

# =============================================================================
# CREATE
# =============================================================================
create_tenant() {
    [[ -d "$TENANT_DIR" ]] && die "Tenant '$TENANT' already exists at $TENANT_DIR"

    info "Creating tenant: $TENANT ($DOMAIN)"

    # Allocate ports
    local base_port
    base_port=$(get_port_block)
    local api_port=$((base_port))
    local frontend_port=$((base_port + 1))
    local db_port=$((base_port + 2))
    local minio_port=$((base_port + 3))
    local minio_console_port=$((base_port + 4))

    info "  Allocated ports: API=$api_port, Frontend=$frontend_port, DB=$db_port, MinIO=$minio_port, Console=$minio_console_port"

    # Create tenant directory
    mkdir -p "$TENANT_DIR"

    # Generate a random JWT secret
    local jwt_secret
    jwt_secret=$(openssl rand -hex 32)

    # Write .env file
    cat > "$TENANT_DIR/.env" <<EOF
# Tenant: $TENANT
# Domain: $DOMAIN
TENANT_NAME=$TENANT
DOMAIN=$DOMAIN

# Ports (host-side, mapped to container ports)
API_PORT=$api_port
FRONTEND_PORT=$frontend_port
DB_PORT=$db_port
MINIO_PORT=$minio_port
MINIO_CONSOLE_PORT=$minio_console_port

# Secrets
JWT_SECRET=$jwt_secret
JWT_EXPIRY_SECONDS=8640000

# MinIO
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=$(openssl rand -hex 16)
MINIO_BUCKET_NAME=sitekeeper-pdfs

# Gunicorn
GUNICORN_WORKERS=2
EOF

    info "  Created $TENANT_DIR/.env"

    # Copy docker-compose template
    cp "$APP_DIR/infra/tenant-docker-compose.yml.template" "$TENANT_DIR/docker-compose.yml"
    info "  Created $TENANT_DIR/docker-compose.yml"

    # Start the containers
    info "  Building and starting containers..."
    (cd "$TENANT_DIR" && docker compose --env-file .env up -d --build)

    # Generate nginx config
    info "  Generating nginx config..."
    sed -e "s|TENANT_NAME|$TENANT|g" \
        -e "s|DOMAIN|$DOMAIN|g" \
        -e "s|API_PORT|$api_port|g" \
        -e "s|FRONTEND_PORT|$frontend_port|g" \
        "$APP_DIR/infra/tenant-nginx.conf.template" > "$NGINX_CONF_DIR/$DOMAIN"

    # Enable the site
    ln -sf "$NGINX_CONF_DIR/$DOMAIN" "$NGINX_ENABLED_DIR/$DOMAIN"

    # Wildcard cert (*.entouch.org) covers all tenant subdomains.
    # No per-tenant certbot needed. Ensure wildcard cert exists:
    if [[ ! -f "/etc/letsencrypt/live/entouch.org/fullchain.pem" ]]; then
        warn "  Wildcard cert not found at /etc/letsencrypt/live/entouch.org/"
        warn "  Run: certbot certonly --manual --preferred-challenges dns -d '*.entouch.org' -d entouch.org"
    fi

    # Reload nginx
    info "  Reloading nginx..."
    nginx -t && systemctl reload nginx

    info "Tenant '$TENANT' is live at https://$DOMAIN"
    info "  API:   https://$DOMAIN/api/v1/"
    info "  DB:    localhost:$db_port (user: sitekeeper, pass: sitekeeper)"
    info "  MinIO: localhost:$minio_console_port"
}

# =============================================================================
# DESTROY
# =============================================================================
destroy_tenant() {
    [[ ! -d "$TENANT_DIR" ]] && die "Tenant '$TENANT' does not exist"

    info "Destroying tenant: $TENANT ($DOMAIN)"

    # Stop and remove containers + volumes
    info "  Stopping containers..."
    (cd "$TENANT_DIR" && docker compose --env-file .env down -v) || true

    # Remove nginx config
    info "  Removing nginx config..."
    rm -f "$NGINX_CONF_DIR/$DOMAIN"
    rm -f "$NGINX_ENABLED_DIR/$DOMAIN"
    nginx -t && systemctl reload nginx

    # Remove tenant directory
    info "  Removing tenant directory..."
    rm -rf "$TENANT_DIR"

    # Optionally revoke cert
    info "  Note: SSL cert for $DOMAIN was NOT revoked. Run 'certbot delete --cert-name $DOMAIN' if desired."

    info "Tenant '$TENANT' destroyed."
}

# =============================================================================
# RUN
# =============================================================================
case "$ACTION" in
    create)  create_tenant ;;
    destroy) destroy_tenant ;;
esac
