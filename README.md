# SiteKeeper — Contractor Management App

A mobile-first app for small contractors to manage job sites, jobs, contacts, estimates, and invoices.

**Stack:** Expo (React Native) · Python Flask · PostgreSQL 16 · Docker Compose

---

## Prerequisites

| Tool | Version |
|------|---------|
| [Docker](https://www.docker.com/products/docker-desktop/) + Compose plugin | any recent |
| [Node.js](https://nodejs.org/) | 20+ |
| Python | 3.11+ |

---

## Quick start

### 1. Start the databases

```bash
docker compose up -d
```

Two PostgreSQL 16 containers start:

| Service | Host port | Database | Purpose |
|---------|-----------|----------|---------|
| `db` | **5434** | `sitekeeper` | Development |
| `db_test` | **5433** | `sitekeeper_test` | Integration tests |

> Port 5434 is used for the dev database to avoid conflicts with any local PostgreSQL installation on the default port 5432.

### 2. Set up and run the backend

See **[backend/README.md](backend/README.md)** for the full guide, including:
- Virtual environment setup
- Environment variable configuration
- Running migrations
- Starting the Flask server
- Running tests

Short version (Linux / macOS):

```bash
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env   # then edit JWT_SECRET
backend/venv/bin/alembic -c backend/alembic.ini upgrade head
flask --app backend/app run
```

### 3. Set up and run the frontend

```bash
npm install --prefix frontend
npx expo start --prefix frontend
```

Or from inside the `frontend/` directory:

```bash
npm install
npx expo start
```

Press `a` for Android emulator, `i` for iOS simulator, or `w` for web.

---

## Project structure

```
.
├── backend/
│   ├── app/                # Flask application (factory, models, blueprints, services)
│   ├── migrations/         # Alembic migration scripts
│   ├── tests/              # Pytest test suite
│   ├── alembic.ini         # Alembic configuration
│   ├── requirements.txt    # Pinned Python dependencies
│   ├── .env.example        # Dev environment template
│   ├── .env.test.example   # Test environment template
│   └── README.md           # Backend-specific documentation ← start here
├── frontend/
│   ├── src/
│   │   ├── api/            # Axios client and TanStack Query hooks
│   │   ├── components/     # Shared React Native components
│   │   ├── navigation/     # React Navigation structure
│   │   ├── screens/        # Screen components
│   │   └── store/          # Zustand client state
│   ├── App.tsx             # Expo entry point
│   └── package.json
├── docker-compose.yml      # PostgreSQL dev and test containers
└── README.md               # This file
```

---

## Spec and design documents

The full requirements, system design, and implementation task list live in:

```
.kiro/specs/contractor-management-app/
├── requirements.md   # Functional requirements and acceptance criteria
├── design.md         # Architecture, data models, API design, correctness properties
└── tasks.md          # Ordered implementation task list
```

---

## Production deployment

The app is live at **https://entouch.org**.

### Prerequisites

- SSH access via the `awspantrypix` alias (`~/.ssh/config` entry pointing at the server)
- `rsync` installed locally
- `npx` / Node available locally (for the Expo web build)

### Deploy

```bash
# Full deploy — pull code, migrate DB, rebuild + upload frontend
./deploy.sh

# Frontend only (no backend changes)
./deploy.sh frontend

# Backend only (new code or migrations, skip frontend rebuild)
./deploy.sh backend
```

The script handles everything: `git pull` on the server, `pip install`, Alembic migrations, gunicorn restart, Expo web build, and `rsync` to the web root.

### What lives where on the server

| Component | Location |
|---|---|
| Code | `/home/sitekeeper/app` (git clone) |
| Python venv | `/home/sitekeeper/app/backend/venv` |
| Backend `.env` | `/home/sitekeeper/app/backend/.env` |
| Web root | `/var/www/sitekeeper/html` |
| API service | `sitekeeperapi` (systemd, gunicorn on port 5002) |
| Database | Docker container `app-db-1` (PostgreSQL 16, port 5435) |
| nginx config | `/etc/nginx/sites-available/entouch.org` |
| SSL cert | `/etc/letsencrypt/live/entouch.org/` (auto-renews) |

### Common operations

```bash
# Tail API logs
ssh awspantrypix "sudo journalctl -u sitekeeperapi -f"

# Restart API
ssh awspantrypix "sudo systemctl restart sitekeeperapi"

# Run migrations manually
ssh awspantrypix "sudo -u sitekeeper bash -c '
  cd /home/sitekeeper/app/backend &&
  DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5435/sitekeeper \
  /home/sitekeeper/app/backend/venv/bin/alembic upgrade head
'"

# Restart DB container (if it goes down)
ssh awspantrypix "sudo -u sitekeeper docker compose -f /home/sitekeeper/app/docker-compose.prod.yml up -d"
```

> The server also hosts `pantrypix.app` and `matrix.pantrypix.app`. Don't touch their nginx configs, systemd services, or ports 5001/5433/5434.
