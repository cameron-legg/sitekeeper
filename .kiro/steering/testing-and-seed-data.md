---
inclusion: auto
---

# Testing & Seed Data

## Test Suite

### Running Tests

```bash
cd backend
DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5433/sitekeeper_test \
    JWT_SECRET=test-secret \
    venv/bin/python -m pytest tests/ --tb=short
```

Or shorter (relies on defaults in conftest.py):

```bash
cd backend
DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5433/sitekeeper_test \
    JWT_SECRET=test-secret venv/bin/python -m pytest
```

### Prerequisites

- Docker `db_test` container running on port 5433 (`docker compose up -d`)
- Backend venv with dependencies installed

### How Tests Work

1. **Session setup** (runs once per `pytest` invocation):
   - Connects to the `postgres` database on the test Postgres instance (port 5433)
   - Drops and recreates `sitekeeper_test` database
   - Runs all Alembic migrations (`alembic upgrade head`) against the fresh DB
   - This ensures tests always run against the **real schema** from migrations

2. **Per-test isolation** (runs after every test):
   - All tables are truncated with `CASCADE` after each test
   - Foreign key checks are temporarily disabled during truncation
   - Each test starts with a completely empty database

3. **Factory fixtures** (in `tests/conftest.py`):
   - `create_user`, `create_job_site`, `create_job`, `create_estimate`, `create_invoice`
   - `create_line_item`, `create_entry`, `create_contact`
   - `create_saved_item`, `create_saved_entry`, `create_document_number`
   - `admin_user`, `member_user`, `pending_user` — pre-built convenience users
   - `sample_job_hierarchy` — creates a user → job site → job chain
   - `auth_headers` — generates valid JWT Bearer headers

### Test Files

| File | What it tests |
|------|---------------|
| `test_financial_calculations.py` | `compute_line_item_totals`, `compute_totals_with_tax`, Hypothesis property tests |
| `test_estimate_service.py` | Estimate CRUD, line items, entries, metadata, document numbers |
| `test_invoice_service.py` | Invoice CRUD, status transitions, line items, metadata |
| `test_conversion_service.py` | Estimate → invoice deep copy, independence, metadata |
| `test_auth.py` | Registration, login, JWT validation, bcrypt, error codes |
| `test_contact_service.py` | Contact CRUD, site/job association, inheritance, effective primary |
| `test_saved_items_service.py` | Library CRUD, entries, standalone, populate (copy) logic |
| `test_api_endpoints.py` | HTTP integration: auth, protected routes, CRUD endpoints |
| `test_tenant.py` | Slug resolution from Host header (unit tests, no DB) |

### Deploy Integration

The `deploy.sh` script runs `run_tests()` before any deployment. If tests fail, the deploy is aborted. Tests run locally against the `db_test` container — they never touch production.

### Adding New Tests

1. Create a file in `backend/tests/` named `test_<feature>.py`
2. Use the factory fixtures from `conftest.py` to set up data
3. Use `app_context` fixture for service-level tests
4. Use `client` fixture for HTTP-level integration tests
5. Financial tests can use plain mock objects (no DB needed) — see `_MockLineItem` pattern

### Important Notes

- Tests use the **test database on port 5433** — never the dev DB (5434) or prod DB (5435)
- The test DB password is hardcoded as `sitekeeper` (matches docker-compose `db_test` service)
- `JWT_SECRET=test-secret` must be passed or tokens won't validate
- Hypothesis property-based tests in `test_financial_calculations.py` generate random inputs to verify invariants (e.g. total = subtotal + tax)
- The `TestingConfig` class in `app/config.py` sets `TESTING=True` which skips MinIO init and tenant middleware

---

## Seed Data

### Running the Seed Script

```bash
./seed.sh
```

This populates the **dev database** (port 5434) with realistic data for manual testing.

### What It Does

1. Truncates all tables (clean slate)
2. Creates:
   - 3 users: admin (`demo@sitekeeper.com` / `demo1234`), approved member, pending member
   - Business info (Mitchell Plumbing & Remodel, Boulder CO)
   - 5 job sites with contacts and primary contacts
   - 10 jobs across all statuses
   - 3 detailed estimates with line items, entries, and tax
   - 3 invoices at different workflow stages with status history
   - 4 markdown notes
   - 3 saved items in Item Library + 4 standalone Materials Library entries
   - 9 time entries (including 1 active clock-in)
   - Document number trackers and field settings

### Login Credentials

| Email | Password | Role | Approved |
|-------|----------|------|----------|
| `demo@sitekeeper.com` | `demo1234` | admin | yes |
| `mike@sitekeeper.com` | `demo1234` | member | yes |
| `pending@sitekeeper.com` | `demo1234` | member | no (403) |

### Key Files

| File | Purpose |
|------|---------|
| `backend/seed_data.py` | Python script with all seed data |
| `seed.sh` | Shell wrapper (sets DATABASE_URL, runs the script) |

### Re-seeding

Run `./seed.sh` anytime to reset to a fresh state. It's idempotent — truncates everything first.

### Targeting a Different Database

```bash
DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5434/some_other_db \
    backend/venv/bin/python backend/seed_data.py
```
