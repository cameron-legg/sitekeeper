#!/usr/bin/env bash
# =============================================================================
# SiteKeeper — Full Test Suite
#
# Runs all three test layers in sequence:
#   1. Backend (pytest) — service logic, financial calculations, API endpoints
#   2. Frontend (jest) — unit tests for hooks, stores, data structures
#   3. E2E (playwright) — browser tests against the running app
#
# Usage:
#   ./test.sh            # run all three layers
#   ./test.sh backend    # backend only
#   ./test.sh frontend   # frontend only
#   ./test.sh e2e        # E2E only (requires backend + frontend running)
#
# Prerequisites:
#   - Docker containers running (docker compose up -d)
#   - For E2E: backend and frontend dev servers must be running
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}▶ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $*${NC}"; }
die()   { echo -e "${RED}✗ $*${NC}"; exit 1; }

TARGET="${1:-all}"
[[ "$TARGET" =~ ^(all|backend|frontend|e2e)$ ]] || die "Usage: $0 [all|backend|frontend|e2e]"

FAILURES=0

# =============================================================================
# BACKEND TESTS (pytest)
# =============================================================================
run_backend_tests() {
    info "Running backend tests (pytest)..."
    local test_db_url="postgresql://sitekeeper:sitekeeper@localhost:5433/sitekeeper_test"

    if (cd backend && DATABASE_URL="$test_db_url" JWT_SECRET="test-secret" \
        venv/bin/python -m pytest tests/ --tb=short -q); then
        info "  Backend tests passed ✓"
    else
        echo -e "${RED}  Backend tests FAILED ✗${NC}"
        FAILURES=$((FAILURES + 1))
    fi
    echo ""
}

# =============================================================================
# FRONTEND TESTS (jest)
# =============================================================================
run_frontend_tests() {
    info "Running frontend tests (jest)..."

    if (cd frontend && npx jest --no-coverage --passWithNoTests); then
        info "  Frontend tests passed ✓"
    else
        echo -e "${RED}  Frontend tests FAILED ✗${NC}"
        FAILURES=$((FAILURES + 1))
    fi
    echo ""
}

# =============================================================================
# E2E TESTS (playwright)
# =============================================================================
run_e2e_tests() {
    info "Running E2E tests (playwright)..."

    # Check if frontend and backend are reachable
    if ! curl -s -o /dev/null -w '' http://localhost:8081 2>/dev/null; then
        warn "  Frontend not running on localhost:8081 — skipping E2E tests."
        warn "  Start it with: cd frontend && npx expo start --web"
        return
    fi
    if ! curl -s -o /dev/null -w '' http://localhost:5000/api/v1/health 2>/dev/null; then
        warn "  Backend not running on localhost:5000 — skipping E2E tests."
        warn "  Start it with: cd backend && flask run"
        return
    fi

    if (cd e2e && npx playwright test --reporter=line); then
        info "  E2E tests passed ✓"
    else
        echo -e "${RED}  E2E tests FAILED ✗${NC}"
        FAILURES=$((FAILURES + 1))
    fi
    echo ""
}

# =============================================================================
# RUN
# =============================================================================
echo ""
info "╔══════════════════════════════════════╗"
info "║   SiteKeeper — Full Test Suite       ║"
info "╚══════════════════════════════════════╝"
echo ""

case "$TARGET" in
    all)      run_backend_tests; run_frontend_tests; run_e2e_tests ;;
    backend)  run_backend_tests ;;
    frontend) run_frontend_tests ;;
    e2e)      run_e2e_tests ;;
esac

# =============================================================================
# SUMMARY
# =============================================================================
if [[ $FAILURES -eq 0 ]]; then
    info "═══════════════════════════════════════"
    info "  All tests passed! ✓"
    info "═══════════════════════════════════════"
else
    echo -e "${RED}═══════════════════════════════════════${NC}"
    echo -e "${RED}  $FAILURES test suite(s) failed ✗${NC}"
    echo -e "${RED}═══════════════════════════════════════${NC}"
    exit 1
fi
