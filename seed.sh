#!/usr/bin/env bash
# =============================================================================
# SiteKeeper — Seed Development Database
#
# Populates the local dev database with realistic dummy data for manual testing.
# Drops all existing data first (clean slate).
#
# Usage:
#   ./seed.sh
#
# After seeding, log in with:
#   Email:    demo@sitekeeper.com
#   Password: demo1234
#
# Prerequisites:
#   - Docker containers running (docker compose up -d)
#   - Backend venv exists (backend/venv)
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; NC='\033[0m'

echo -e "${GREEN}▶ Seeding development database...${NC}"

cd "$(dirname "$0")/backend"
DATABASE_URL="${DATABASE_URL:-postgresql://sitekeeper:sitekeeper@localhost:5434/sitekeeper}" \
    venv/bin/python seed_data.py

echo ""
echo -e "${GREEN}▶ Seed complete. Start the backend and frontend to test.${NC}"
