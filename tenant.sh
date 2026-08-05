#!/usr/bin/env bash
# =============================================================================
# SiteKeeper — Tenant Management Script
#
# Usage:
#   ./tenant.sh create <slug> [--name "Display Name"]
#   ./tenant.sh delete <slug>
#   ./tenant.sh list
#
# Examples:
#   ./tenant.sh create nocoresources --name "NoCo Resources"
#   ./tenant.sh delete nocoresources
#   ./tenant.sh list
#
# This script runs locally and SSHs to the production server to:
#   - Create/delete PostgreSQL databases
#   - Create/delete MinIO buckets
#   - Update tenants.json
#   - Add/remove nginx configs
#   - Restart the API service
# =============================================================================

set -euo pipefail

# ── Default target (can be overridden with --target entouch) ─────────────────
DEPLOY_TARGET="jobsyte"

# Parse --target from any position in args
ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --target) DEPLOY_TARGET="$2"; shift 2 ;;
        *) ARGS+=("$1"); shift ;;
    esac
done
set -- "${ARGS[@]+"${ARGS[@]}"}"

case "$DEPLOY_TARGET" in
    jobsyte)
        SSH_HOST="jobsyteprod"
        BASE_DOMAIN="jobsyte.app"
        ;;
    entouch)
        SSH_HOST="awspantrypix"
        BASE_DOMAIN="entouch.org"
        ;;
    *)
        echo "Unknown target: $DEPLOY_TARGET. Use 'jobsyte' or 'entouch'." >&2
        exit 1
        ;;
esac

APP_DIR="/home/sitekeeper/app"
DB_PORT=5435
DB_USER="sitekeeper"
DB_PASS="sitekeeper"
SERVICE="sitekeeperapi"

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}▶ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $*${NC}"; }
die()   { echo -e "${RED}✗ $*${NC}"; exit 1; }

# ── Argument parsing ──────────────────────────────────────────────────────────
ACTION="${1:-}"
SLUG="${2:-}"
NAME=""

# Parse optional --name flag
shift 2 2>/dev/null || true
while [[ $# -gt 0 ]]; do
    case "$1" in
        --name) NAME="$2"; shift 2 ;;
        *) shift ;;
    esac
done

[[ -z "$ACTION" ]] && die "Usage: $0 <create|delete|list> [slug] [--name \"Name\"]"
[[ "$ACTION" == "list" ]] || [[ -n "$SLUG" ]] || die "Usage: $0 <create|delete> <slug>"

# Validate slug format
if [[ -n "$SLUG" ]]; then
    if ! [[ "$SLUG" =~ ^[a-z][a-z0-9-]*[a-z0-9]$ ]]; then
        die "Slug must be lowercase alphanumeric with hyphens (e.g. 'nocoresources')"
    fi
fi

# =============================================================================
# LIST
# =============================================================================
cmd_list() {
    info "Current tenants:"
    echo ""
    ssh "$SSH_HOST" "sudo -u sitekeeper bash -c '
        cd $APP_DIR/backend &&
        $APP_DIR/backend/venv/bin/python -c \"
import json
with open(\\\"tenants.json\\\") as f:
    tenants = json.load(f)
header = \\\"{:<20} {:<25} {:<35} {:<25}\\\".format(\\\"Slug\\\", \\\"Name\\\", \\\"Domain\\\", \\\"Database\\\")
print(header)
print(\\\"-\\\" * 105)
for slug, cfg in tenants.items():
    db = cfg.get(\\\"database_url\\\", \\\"\\\").split(\\\"/\\\")[-1]
    row = \\\"{:<20} {:<25} {:<35} {:<25}\\\".format(slug, cfg.get(\\\"name\\\", \\\"\\\"), cfg.get(\\\"domain\\\", \\\"\\\"), db)
    print(row)
\"
    '"
}

# =============================================================================
# CREATE
# =============================================================================
cmd_create() {
    local db_name="sk_${SLUG}"
    local bucket="${SLUG}-pdfs"
    local media_bucket="${SLUG}-media"
    local domain="${SLUG}.${BASE_DOMAIN}"
    local db_url="postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${db_name}"
    [[ -z "$NAME" ]] && NAME=$(echo "$SLUG" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')

    info "Creating tenant: $SLUG"
    echo "  Domain:       $domain"
    echo "  Database:     $db_name"
    echo "  PDF Bucket:   $bucket"
    echo "  Media Bucket: $media_bucket"
    echo "  Name:         $NAME"
    echo ""

    # 1. Check if tenant already exists
    info "Checking if tenant already exists..."
    EXISTS=$(ssh "$SSH_HOST" "sudo -u sitekeeper bash -c '
        cd $APP_DIR/backend &&
        $APP_DIR/backend/venv/bin/python -c \"
import json
with open(\\\"tenants.json\\\") as f:
    tenants = json.load(f)
print(\\\"yes\\\" if \\\"$SLUG\\\" in tenants else \\\"no\\\")
\"
    '")
    [[ "$EXISTS" == "yes" ]] && die "Tenant '$SLUG' already exists!"

    # 2. Create database
    info "Creating database '$db_name'..."
    ssh "$SSH_HOST" "sudo -u sitekeeper docker exec app-db-1 psql -U $DB_USER -c \"CREATE DATABASE $db_name;\" 2>&1" || {
        warn "Database may already exist — continuing..."
    }

    # 3. Run migrations
    info "Running migrations on '$db_name'..."
    ssh "$SSH_HOST" "sudo -u sitekeeper bash -c '
        cd $APP_DIR/backend &&
        DATABASE_URL=$db_url $APP_DIR/backend/venv/bin/alembic upgrade head 2>&1
    '"

    # 4. Create MinIO buckets (PDFs + Media)
    info "Creating MinIO buckets '$bucket' and '$media_bucket'..."
    ssh "$SSH_HOST" "sudo -u sitekeeper bash -c '
        cd $APP_DIR/backend &&
        set -a && source .env && set +a &&
        timeout 15 $APP_DIR/backend/venv/bin/python -c \"
from minio import Minio
import os
client = Minio(
    os.environ.get(\\\"MINIO_ENDPOINT\\\", \\\"localhost:9000\\\"),
    access_key=os.environ.get(\\\"MINIO_ACCESS_KEY\\\", \\\"minioadmin\\\"),
    secret_key=os.environ.get(\\\"MINIO_SECRET_KEY\\\", \\\"minioadmin\\\"),
    secure=False
)
for bkt in [\\\"$bucket\\\", \\\"$media_bucket\\\"]:
    if not client.bucket_exists(bkt):
        client.make_bucket(bkt)
        print(f\\\"Created bucket: {bkt}\\\")
    else:
        print(f\\\"Bucket already exists: {bkt}\\\")
\"
    '" || warn "MinIO bucket creation failed — you can create them manually later."

    # 5. Update tenants.json
    info "Registering tenant in tenants.json..."
    ssh "$SSH_HOST" "sudo -u sitekeeper bash -c '
        cd $APP_DIR/backend &&
        $APP_DIR/backend/venv/bin/python -c \"
import json
with open(\\\"tenants.json\\\") as f:
    tenants = json.load(f)
tenants[\\\"$SLUG\\\"] = {
    \\\"database_url\\\": \\\"$db_url\\\",
    \\\"bucket\\\": \\\"$bucket\\\",
    \\\"media_bucket\\\": \\\"$media_bucket\\\",
    \\\"domain\\\": \\\"$domain\\\",
    \\\"name\\\": \\\"$NAME\\\"
}
with open(\\\"tenants.json\\\", \\\"w\\\") as f:
    json.dump(tenants, f, indent=4)
print(\\\"Tenant registered.\\\")
\"
    '"

    # 6. Add nginx config
    info "Adding nginx config for $domain..."
    ssh "$SSH_HOST" "sudo bash -c '
        cat > /etc/nginx/sites-available/$domain << NGINX
server {
    listen 80;
    server_name $domain;
    return 301 https://\\\$host\\\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $domain;

    ssl_certificate /etc/letsencrypt/live/$BASE_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$BASE_DOMAIN/privkey.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:5002;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_read_timeout 120s;
        client_max_body_size 25M;
    }

    location / {
        root /var/www/sitekeeper/html;
        index index.html;
        try_files \\\$uri \\\$uri/ /index.html;
    }
}
NGINX
        ln -sf /etc/nginx/sites-available/$domain /etc/nginx/sites-enabled/$domain
        nginx -t && systemctl reload nginx
    '"

    # 7. Update CORS_ORIGINS
    info "Adding $domain to CORS_ORIGINS..."
    ssh "$SSH_HOST" "sudo -u sitekeeper bash -c '
        cd $APP_DIR/backend &&
        if ! grep -q \"$domain\" .env; then
            sed -i \"s|^CORS_ORIGINS=\\(.*\\)|CORS_ORIGINS=\\1,https://$domain|\" .env
        fi
    '"

    # 8. Restart API
    info "Restarting API service..."
    ssh "$SSH_HOST" "sudo systemctl restart $SERVICE"
    sleep 2
    ssh "$SSH_HOST" "sudo systemctl is-active $SERVICE" \
        && info "API service is running." \
        || die "API service failed to start!"

    # 9. Verify
    info "Verifying..."
    RESULT=$(ssh "$SSH_HOST" "curl -s http://127.0.0.1:5002/api/v1/health -H 'Host: $domain'")
    echo "  $RESULT"

    echo ""
    info "Tenant '$SLUG' created successfully!"
    info "  URL: https://$domain"
    info "  Users can register at https://$domain and will have a completely isolated environment."
}

# =============================================================================
# DELETE
# =============================================================================
cmd_delete() {
    local db_name="sk_${SLUG}"
    local bucket="${SLUG}-pdfs"
    local media_bucket="${SLUG}-media"
    local domain="${SLUG}.${BASE_DOMAIN}"

    [[ "$SLUG" == "default" ]] && die "Cannot delete the default tenant!"

    info "Deleting tenant: $SLUG ($domain)"
    echo ""

    # Confirm
    read -p "  Are you sure? This will DELETE the database and all data. Type '$SLUG' to confirm: " CONFIRM
    [[ "$CONFIRM" != "$SLUG" ]] && die "Aborted."
    echo ""

    # 1. Remove nginx config
    info "Removing nginx config..."
    ssh "$SSH_HOST" "sudo bash -c '
        rm -f /etc/nginx/sites-enabled/$domain
        rm -f /etc/nginx/sites-available/$domain
        nginx -t && systemctl reload nginx
    '" || warn "nginx cleanup had issues — continuing..."

    # 2. Remove from tenants.json
    info "Removing from tenants.json..."
    ssh "$SSH_HOST" "sudo -u sitekeeper bash -c '
        cd $APP_DIR/backend &&
        $APP_DIR/backend/venv/bin/python -c \"
import json
with open(\\\"tenants.json\\\") as f:
    tenants = json.load(f)
tenants.pop(\\\"$SLUG\\\", None)
with open(\\\"tenants.json\\\", \\\"w\\\") as f:
    json.dump(tenants, f, indent=4)
print(\\\"Tenant removed from registry.\\\")
\"
    '"

    # 3. Remove from CORS_ORIGINS
    info "Removing from CORS_ORIGINS..."
    ssh "$SSH_HOST" "sudo -u sitekeeper bash -c '
        cd $APP_DIR/backend &&
        sed -i \"s|,https://$domain||g\" .env
    '"

    # 4. Drop database
    info "Dropping database '$db_name'..."
    ssh "$SSH_HOST" "sudo -u sitekeeper docker exec app-db-1 psql -U $DB_USER -c \"DROP DATABASE IF EXISTS $db_name;\" 2>&1"

    # 5. Remove MinIO buckets (requires emptying first)
    info "Removing MinIO buckets '$bucket' and '$media_bucket'..."
    ssh "$SSH_HOST" "sudo -u sitekeeper bash -c '
        cd $APP_DIR/backend &&
        set -a && source .env && set +a &&
        timeout 15 $APP_DIR/backend/venv/bin/python -c \"
from minio import Minio
from minio.deleteobjects import DeleteObject
import os
client = Minio(
    os.environ.get(\\\"MINIO_ENDPOINT\\\", \\\"localhost:9000\\\"),
    access_key=os.environ.get(\\\"MINIO_ACCESS_KEY\\\", \\\"minioadmin\\\"),
    secret_key=os.environ.get(\\\"MINIO_SECRET_KEY\\\", \\\"minioadmin\\\"),
    secure=False
)
for bucket in [\\\"$bucket\\\", \\\"$media_bucket\\\"]:
    if client.bucket_exists(bucket):
        objects = client.list_objects(bucket, recursive=True)
        delete_list = [DeleteObject(obj.object_name) for obj in objects]
        if delete_list:
            errors = client.remove_objects(bucket, delete_list)
            for err in errors:
                print(f\\\"Error deleting {err}\\\")
        client.remove_bucket(bucket)
        print(f\\\"Removed bucket: {bucket}\\\")
    else:
        print(f\\\"Bucket not found: {bucket}\\\")
\"
    '" || warn "MinIO cleanup had issues — buckets may need manual removal."

    # 6. Restart API
    info "Restarting API service..."
    ssh "$SSH_HOST" "sudo systemctl restart $SERVICE"

    echo ""
    info "Tenant '$SLUG' deleted."
    info "  Database '$db_name' dropped."
    info "  Bucket '$bucket' removed."
    info "  Nginx config removed."
}

# =============================================================================
# RUN
# =============================================================================
case "$ACTION" in
    create) cmd_create ;;
    delete) cmd_delete ;;
    list)   cmd_list ;;
    *)      die "Usage: $0 <create|delete|list> [slug] [--name \"Name\"]" ;;
esac
