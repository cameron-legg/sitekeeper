# SiteKeeper — Backend

Python Flask REST API backed by PostgreSQL 16. All database infrastructure runs in Docker.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | |
| Docker + Compose plugin | any recent | `docker compose` (v2 syntax) |
| Git | any | |

---

## First-time setup

### 1. Start the PostgreSQL containers

From the **project root** (where `docker-compose.yml` lives):

```bash
docker compose up -d
```

This starts two containers:

| Service | Host port | Database | Used for |
|---------|-----------|----------|----------|
| `db` | **5434** | `sitekeeper` | Development |
| `db_test` | **5433** | `sitekeeper_test` | Integration tests |

> **Why 5434?** Port 5432 is the PostgreSQL default and may already be in use by a local installation. The dev container is mapped to 5434 to avoid conflicts.

Verify both containers are running:

```bash
docker compose ps
```

### 2. Create the Python virtual environment

```bash
python3 -m venv backend/venv
```

### 3. Activate the virtual environment

```bash
# Linux / macOS
source backend/venv/bin/activate

# Windows (PowerShell)
backend\venv\Scripts\Activate.ps1

# Windows (cmd)
backend\venv\Scripts\activate.bat
```

Your prompt will show `(venv)` when active.

### 4. Install dependencies

```bash
pip install -r backend/requirements.txt
```

### 5. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set at minimum:

```dotenv
DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5434/sitekeeper
JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRY_SECONDS=3600
```

> **Security:** Never commit a real `JWT_SECRET` to source control. Generate one with:
> ```bash
> python3 -c "import secrets; print(secrets.token_hex(32))"
> ```

### 6. Run database migrations

```bash
DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5434/sitekeeper \
  backend/venv/bin/alembic -c backend/alembic.ini upgrade head
```

Or, if the venv is activated and you are inside the `backend/` directory:

```bash
alembic upgrade head
```

You should see:

```
INFO  [alembic.runtime.migration] Running upgrade  -> 001, Initial schema ...
```

### 7. Start the development server

```bash
# From the project root, with the venv activated:
FLASK_APP=backend/app FLASK_DEBUG=1 \
  DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5434/sitekeeper \
  JWT_SECRET=your-secret \
  flask run --host=0.0.0.0 --port=5000
```

Or create a `backend/.flaskenv` file (loaded automatically by Flask):

```dotenv
FLASK_APP=app
FLASK_DEBUG=1
```

Then from inside `backend/`:

```bash
source venv/bin/activate
flask run
```

The API is available at **http://localhost:5000**.

---

## Day-to-day development

### Start the databases (if not already running)

```bash
docker compose up -d db
```

### Activate the venv

```bash
source backend/venv/bin/activate
```

### Run the server

```bash
flask run          # from inside backend/ with venv active
```

> **Testing on a physical device?** Flask must bind to all interfaces so your phone can reach it over the LAN. The `.flaskenv` file sets `FLASK_RUN_HOST=0.0.0.0` automatically. Also set `EXPO_PUBLIC_API_URL` in `frontend/.env` to your machine's LAN IP (e.g. `http://192.168.1.x:5000`) instead of `localhost`.

### Stop the databases

```bash
docker compose stop
```

---

## Running tests

### Unit / property-based tests (no database required)

```bash
backend/venv/bin/pytest backend/tests/ -v
```

### Integration tests (requires `db_test` container)

```bash
docker compose up -d db_test

DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5433/sitekeeper_test \
  backend/venv/bin/pytest backend/tests/ -v
```

The test configuration in `backend/tests/conftest.py` reads `DATABASE_URL` from the environment and falls back to the `db_test` container defaults.

---

## Database migrations

Alembic manages schema changes. Migration files live in `backend/migrations/versions/`.

### Apply all pending migrations

```bash
backend/venv/bin/alembic -c backend/alembic.ini upgrade head
```

### Roll back the last migration

```bash
backend/venv/bin/alembic -c backend/alembic.ini downgrade -1
```

### Check current migration state

```bash
backend/venv/bin/alembic -c backend/alembic.ini current
```

### Generate a new migration (after changing models)

```bash
backend/venv/bin/alembic -c backend/alembic.ini revision \
  --autogenerate -m "describe your change"
```

Always review the generated file in `backend/migrations/versions/` before applying it.

---

## API overview

All endpoints are prefixed with `/api/v1`. Every route except auth requires a `Bearer` JWT in the `Authorization` header.

| Resource | Base path |
|----------|-----------|
| Auth | `/api/v1/auth` |
| Job Sites | `/api/v1/job-sites` |
| Jobs | `/api/v1/jobs` |
| Contacts | `/api/v1/job-sites/<id>/contacts`, `/api/v1/jobs/<id>/contacts` |
| Notes | `/api/v1/jobs/<id>/notes` |
| Estimates | `/api/v1/estimates` |
| Invoices | `/api/v1/invoices` |
| Conversion | `/api/v1/estimates/<id>/convert-to-invoice` |
| Saved Items | `/api/v1/saved-items` |

### Quick smoke test

```bash
# Register
curl -s -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}' | python3 -m json.tool

# Login
curl -s -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}' | python3 -m json.tool
```

Copy the `token` from the login response and use it as:

```bash
TOKEN="<paste token here>"

curl -s http://localhost:5000/api/v1/job-sites \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

---

## Project structure

```
backend/
├── app/
│   ├── __init__.py          # Flask app factory (create_app)
│   ├── config.py            # Config and TestingConfig classes
│   ├── extensions.py        # db (SQLAlchemy) and bcrypt instances
│   ├── models.py            # All SQLAlchemy ORM models
│   ├── auth/
│   │   ├── interface.py     # IAuthService ABC + AuthResult + AuthError
│   │   ├── email_password.py# EmailPasswordAuthService (bcrypt + JWT)
│   │   └── decorators.py    # @auth_required route decorator
│   ├── blueprints/
│   │   ├── helpers.py       # Shared error_response / not_found helpers
│   │   ├── auth_bp.py       # POST /auth/register, /auth/login
│   │   ├── job_sites_bp.py  # CRUD /job-sites
│   │   ├── jobs_bp.py       # CRUD /jobs
│   │   ├── contacts_bp.py   # Contacts for sites and jobs
│   │   ├── notes_bp.py      # Notes for jobs
│   │   ├── estimates_bp.py  # Estimates + line items
│   │   ├── invoices_bp.py   # Invoices + line items
│   │   ├── conversion_bp.py # Estimate → Invoice conversion
│   │   └── saved_items_bp.py# Saved item library
│   ├── repositories/        # Repository interfaces + SQLAlchemy impls
│   └── services/            # Business logic layer
├── migrations/
│   ├── env.py               # Alembic environment (reads Flask config)
│   └── versions/
│       └── 001_initial_schema.py
├── tests/
│   └── conftest.py          # Pytest fixtures (app, client, app_context)
├── alembic.ini              # Alembic configuration
├── requirements.txt         # Pinned Python dependencies
├── .env.example             # Dev environment template
└── .env.test.example        # Test environment template
```

---

## Environment variable reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://sitekeeper:sitekeeper@localhost:5434/sitekeeper` | PostgreSQL connection string |
| `JWT_SECRET` | `change-me-in-production` | Secret used to sign JWTs — **change this** |
| `JWT_EXPIRY_SECONDS` | `3600` | Token lifetime (seconds) |
| `FLASK_DEBUG` | `0` | Set to `1` to enable debug mode and auto-reload |

---

## Troubleshooting

**`connection refused` on port 5434**
The `db` container is not running. Run `docker compose up -d db`.

**`alembic: command not found`**
The venv is not activated, or you are running `alembic` without the full path. Use `backend/venv/bin/alembic` or activate the venv first.

**`ModuleNotFoundError: No module named 'app'`**
Run Flask from inside the `backend/` directory, or set `FLASK_APP=backend/app` when running from the project root.

**Port 5434 already in use**
Another process is using that port. Either stop it or change the host port in `docker-compose.yml` and update `DATABASE_URL` in `.env` to match.
