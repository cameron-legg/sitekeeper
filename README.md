# SiteKeeper — Contractor Management App

A multi-tenant, mobile-first app for small contractors to manage job sites, jobs, contacts, estimates, and invoices. Each client business gets their own isolated environment at `<client>.entouch.org`.

**Stack:** Expo (React Native) · Python Flask · PostgreSQL 16 · MinIO · Docker Compose

---

## Prerequisites

| Tool | Version |
|------|---------|
| [Docker](https://www.docker.com/products/docker-desktop/) + Compose plugin | any recent |
| [Node.js](https://nodejs.org/) | 20+ |
| Python | 3.11+ |

---

## Quick start

### 1. Start the databases and MinIO

```bash
docker compose up -d
```

Services started:

| Service | Host port | Purpose |
|---------|-----------|---------|
| `db` | **5434** | Development PostgreSQL |
| `db_test` | **5433** | Integration test PostgreSQL |
| `minio` | **9000** (API), **9001** (console) | PDF blob storage |

### 2. Set up and run the backend

See **[backend/README.md](backend/README.md)** for the full guide.

Short version:

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

Press `w` for web, `a` for Android, `i` for iOS.

---

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── auth/           # IAuthService, EmailPasswordAuthService, auth_required
│   │   ├── blueprints/     # Flask route blueprints (one per resource + admin_bp)
│   │   ├── repositories/   # Repository interfaces + SQLAlchemy implementations
│   │   ├── services/       # Business logic layer
│   │   ├── tenant.py       # Multi-tenant middleware (Host header → DB routing)
│   │   ├── minio_client.py # MinIO storage with per-tenant bucket support
│   │   ├── models.py       # SQLAlchemy ORM models (User has role + is_approved)
│   │   ├── extensions.py   # db, bcrypt instances
│   │   └── __init__.py     # create_app factory
│   ├── migrations/         # Alembic migration scripts
│   ├── manage_tenant.py    # CLI for creating tenants (server-side)
│   ├── tenants.json        # Tenant registry (slug → database URL + bucket)
│   ├── tests/              # Pytest test suite
│   ├── alembic.ini
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts       # Axios (relative URLs on web for multi-tenant)
│   │   │   ├── hooks/          # TanStack Query hooks (including useAdmin)
│   │   │   └── types.ts        # Shared API response types
│   │   ├── components/         # Shared components
│   │   ├── navigation/         # RootNavigator, types, navigationRef
│   │   ├── screens/
│   │   │   ├── auth/           # LoginScreen, RegisterScreen
│   │   │   └── app/            # All authenticated screens (including AdminUsersScreen)
│   │   └── store/              # Zustand auth store (token, userId, role, isApproved)
│   ├── App.tsx
│   └── .env
├── infra/
│   └── add-tenant-nginx.sh    # Helper to add nginx config for a tenant
├── docker-compose.yml          # Dev: PostgreSQL + MinIO
├── docker-compose.prod.yml     # Prod: PostgreSQL + MinIO
├── deploy.sh                   # Deploy backend + frontend (migrates all tenants)
├── tenant.sh                   # Create / delete / list tenants
├── TENANTS.md                  # Full tenant management documentation
└── README.md                   # This file
```

---

## Multi-Tenant Architecture

Each client business gets a fully isolated environment:

| Component | Isolation |
|-----------|-----------|
| Subdomain | `<slug>.entouch.org` |
| Database | `sk_<slug>` on shared PostgreSQL |
| File storage | `<slug>-pdfs` bucket on shared MinIO |
| Users | Completely separate per tenant |

The backend resolves the tenant from the `Host` header and routes all queries to the correct database. See **[TENANTS.md](TENANTS.md)** for full documentation.

### Tenant management

```bash
./tenant.sh create mycompany --name "My Company"   # Create a new tenant
./tenant.sh delete mycompany                        # Delete (destructive!)
./tenant.sh list                                    # List all tenants
```

### User access model

| Role | Auto-approved | Can access data | Can manage users |
|------|--------------|-----------------|-----------------|
| Admin (first user to register) | Yes | Yes | Yes (☰ → Manage Users) |
| Member (approved by admin) | No | Yes | No |
| Member (pending) | No | No (403) | No |

---

## Production deployment

The app is live at **https://entouch.org** with tenant subdomains (e.g. `nocoresources.entouch.org`).

### Deploy

```bash
./deploy.sh            # Full deploy (backend + frontend, migrates ALL tenant DBs)
./deploy.sh backend    # Backend only
./deploy.sh frontend   # Frontend only
```

### Server overview

| Component | Location |
|---|---|
| Code | `/home/sitekeeper/app` |
| Tenant registry | `/home/sitekeeper/app/backend/tenants.json` |
| Backend `.env` | `/home/sitekeeper/app/backend/.env` |
| Web root | `/var/www/sitekeeper/html` |
| API service | `sitekeeperapi` (systemd, gunicorn on port 5002) |
| Database | Docker `app-db-1` (PostgreSQL 16, port 5435) |
| MinIO | Docker `app-minio-1` (port 9000) |
| nginx configs | `/etc/nginx/sites-available/<domain>` |
| SSL cert | `/etc/letsencrypt/live/entouch.org/` (wildcard `*.entouch.org`) |

### Common operations

```bash
ssh awspantrypix "sudo journalctl -u sitekeeperapi -f"          # Tail API logs
ssh awspantrypix "sudo systemctl restart sitekeeperapi"          # Restart API
ssh awspantrypix "sudo nginx -t && sudo systemctl reload nginx"  # Reload nginx
```

> The server also hosts `pantrypix.app` and `matrix.pantrypix.app`. Don't touch their configs, services, or ports (5001, 5433, 5434).

---

## Documentation

| Document | Contents |
|----------|----------|
| [TENANTS.md](TENANTS.md) | Tenant creation, deletion, architecture details |
| [backend/README.md](backend/README.md) | Backend setup, testing, API reference |
| `.kiro/steering/deployment.md` | Full deployment procedures and server details |
| `.kiro/steering/backend-conventions.md` | Code conventions for the Flask backend |
| `.kiro/steering/frontend-conventions.md` | Code conventions for the Expo frontend |
