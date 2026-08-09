#!/usr/bin/env bash
# =============================================================================
# SiteKeeper — Production Deploy Script
#
# Usage:
#   ./deploy.sh                          # deploy both to jobsyteprod (default)
#   ./deploy.sh frontend                 # frontend only to jobsyteprod
#   ./deploy.sh backend                  # backend only to jobsyteprod
#   ./deploy.sh --target entouch         # deploy both to awspantrypix
#   ./deploy.sh backend --target entouch # backend only to awspantrypix
#   ./deploy.sh --target jobsyte         # deploy both to jobsyteprod (explicit)
#
# One-time local setup required:
#   1. Add servers to ~/.ssh/config:
#        Host jobsyteprod
#            HostName <new-server-ip>
#            User ubuntu
#            IdentityFile ~/.ssh/<your-key>
#        Host awspantrypix
#            HostName <old-server-ip>
#            User ubuntu
#            IdentityFile ~/.ssh/<your-key>
#   2. Ensure rsync is installed locally (brew install rsync / apt install rsync)
#   3. Ensure npx is available (comes with Node.js)
#
# The script assumes:
#   - The repo is already cloned at /home/sitekeeper/app on the server
#   - The backend venv exists at /home/sitekeeper/app/backend/venv
#   - The DB container is running (docker compose -f docker-compose.prod.yml up -d)
#   - The sitekeeperapi systemd service exists and is enabled
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}▶ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $*${NC}"; }
die()     { echo -e "${RED}✗ $*${NC}"; exit 1; }

# ── Argument parsing ──────────────────────────────────────────────────────────
DEPLOY_TARGET="jobsyte"
TARGET="all"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --target) DEPLOY_TARGET="$2"; shift 2 ;;
        all|frontend|backend) TARGET="$1"; shift ;;
        *) die "Usage: $0 [all|frontend|backend] [--target jobsyte|entouch]" ;;
    esac
done

# ── Per-target configuration ─────────────────────────────────────────────────
case "$DEPLOY_TARGET" in
    jobsyte)
        SSH_HOST="jobsyteprod"
        API_URL="https://jobsyte.app"
        ;;
    entouch)
        SSH_HOST="awspantrypix"
        API_URL="https://entouch.org"
        ;;
    *)
        die "Unknown target: $DEPLOY_TARGET. Use 'jobsyte' or 'entouch'."
        ;;
esac

APP_DIR="/home/sitekeeper/app"
WEB_ROOT="/var/www/sitekeeper/html"
SERVICE="sitekeeperapi"

info "Deploy target: $DEPLOY_TARGET ($SSH_HOST) — mode: $TARGET"

# =============================================================================
# PRE-DEPLOY TESTS
# =============================================================================
run_tests() {
    info "Running full test suite (all tests must pass before deployment)..."

    # 1. Backend tests (pytest)
    info "  [1/3] Backend tests (pytest)..."
    local test_db_url="postgresql://sitekeeper:sitekeeper@localhost:5433/sitekeeper_test"
    if ! (cd backend && DATABASE_URL="$test_db_url" JWT_SECRET="test-secret" \
        venv/bin/python -m pytest tests/ --tb=short -q); then
        die "Backend tests failed — aborting deployment."
    fi
    info "  Backend tests passed ✓"

    # 2. Frontend tests (jest)
    info "  [2/3] Frontend tests (jest)..."
    if ! (cd frontend && npx jest --no-coverage --passWithNoTests); then
        die "Frontend tests failed — aborting deployment."
    fi
    info "  Frontend tests passed ✓"

    # 3. E2E tests (playwright)
    info "  [3/3] E2E tests (playwright)..."
    if ! (cd e2e && npx playwright test --reporter=line); then
        die "E2E tests failed — aborting deployment."
    fi
    info "  E2E tests passed ✓"

    info "  All tests passed!"

    info "Seeding dev database with sample data..."
    ./seed.sh
}

# =============================================================================
# PRE-DEPLOY BACKUP
# =============================================================================
run_pre_deploy_backup() {
    info "Running pre-deploy database backup..."
    ssh "$SSH_HOST" "
        sudo -u sitekeeper bash -c '$APP_DIR/infra/backup-db.sh pre-deploy'
    " && info "  Pre-deploy backup complete." \
      || warn "  Pre-deploy backup failed (continuing with deploy)."
}

# =============================================================================
# BACKEND
# =============================================================================
deploy_backend() {
    info "Deploying backend..."

    info "  Pulling latest code on server..."
    ssh "$SSH_HOST" "
        sudo -u sitekeeper bash -c 'cd $APP_DIR && git checkout -- backend/tenants.json' &&
        GIT_SSH_COMMAND='ssh -i /home/sitekeeper/.ssh/github' \
        sudo -u sitekeeper git -C $APP_DIR pull --ff-only 2>&1
    "

    info "  Ensuring Docker containers are running (DB + MinIO)..."
    ssh "$SSH_HOST" "
        sudo -u sitekeeper docker compose -f $APP_DIR/docker-compose.prod.yml up -d --no-recreate 2>&1
    "

    info "  Installing/updating Python dependencies..."
    ssh "$SSH_HOST" "
        sudo -u sitekeeper $APP_DIR/backend/venv/bin/pip install -q \
            -r $APP_DIR/backend/requirements.txt gunicorn 2>&1 | tail -3
    "

    info "  Running database migrations (all tenants)..."
    ssh "$SSH_HOST" "
        sudo -u sitekeeper bash -c '
            cd $APP_DIR/backend &&
            set -a && source .env && set +a &&
            for db_url in \$(python3 -c \"
import json
with open(\\\"tenants.json\\\") as f:
    tenants = json.load(f)
for t in tenants.values():
    print(t[\\\"database_url\\\"])
\"); do
                echo \"  Migrating: \$db_url\"
                DATABASE_URL=\"\$db_url\" $APP_DIR/backend/venv/bin/alembic upgrade head 2>&1
            done
        '
    "

    info "  Ensuring all MinIO buckets exist..."
    ssh "$SSH_HOST" "
        sudo -u sitekeeper bash $APP_DIR/infra/init-minio-buckets.sh 2>&1 | tail -10
    " && info "  All buckets ready." \
      || warn "  Bucket creation had issues (non-fatal, check logs)."

    info "  Running storage migrations..."
    ssh "$SSH_HOST" "
        sudo -u sitekeeper bash -c '
            cd $APP_DIR &&
            set -a && source backend/.env && set +a &&
            backend/venv/bin/python infra/storage_migrations/runner.py 2>&1
        '
    " && info "  Storage migrations complete." \
      || warn "  Storage migrations had issues (check logs)."

    info "  Restarting API service..."
    ssh "$SSH_HOST" "sudo systemctl restart $SERVICE"
    sleep 2
    ssh "$SSH_HOST" "sudo systemctl is-active $SERVICE" \
        && info "  API service is running." \
        || die "API service failed to start — check: ssh $SSH_HOST 'sudo journalctl -u $SERVICE -n 30'"
}

# =============================================================================
# FRONTEND
# =============================================================================
deploy_frontend() {
    info "Building frontend for web (API_URL=$API_URL)..."

    (cd frontend && EXPO_PUBLIC_API_URL="$API_URL" npx --yes expo export --platform web \
        --output-dir dist)

    [[ -f frontend/dist/index.html ]] || die "Build failed — frontend/dist/index.html not found."

    info "  Uploading to server..."
    rsync -az --delete frontend/dist/ "$SSH_HOST":/tmp/sitekeeper_dist/

    info "  Installing into web root..."
    ssh "$SSH_HOST" "
        sudo rsync -a --delete /tmp/sitekeeper_dist/ $WEB_ROOT/ &&
        sudo chown -R www-data:www-data $WEB_ROOT/
    "

    info "  Verifying..."
    STATUS=$(ssh "$SSH_HOST" "curl -sk -o /dev/null -w '%{http_code}' \
        --resolve entouch.org:443:127.0.0.1 https://entouch.org/")
    [[ "$STATUS" == "200" ]] \
        && info "  Frontend live at https://entouch.org (HTTP $STATUS)" \
        || warn "  Unexpected HTTP status: $STATUS"
}

# =============================================================================
# RUN
# =============================================================================
case "$TARGET" in
    all)      run_tests; run_pre_deploy_backup; deploy_backend; deploy_frontend ;;
    backend)  run_tests; run_pre_deploy_backup; deploy_backend ;;
    frontend) run_tests; deploy_frontend ;;
esac

info "Deploy complete."
