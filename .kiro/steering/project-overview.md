---
inclusion: always
---

# SiteKeeper — Project Overview

SiteKeeper is a multi-tenant, mobile-first contractor management app built with Expo (React Native) + Python Flask + PostgreSQL. Each client business gets an isolated environment at `<slug>.entouch.org`.

## Stack
- **Frontend**: Expo SDK 54 (React Native), React Navigation 7, TanStack Query, Zustand, Axios
- **Backend**: Python Flask 3.x, SQLAlchemy 2.x, Alembic, flask-bcrypt, PyJWT, flask-cors
- **Database**: PostgreSQL 16 in Docker (dev: port 5434, test: port 5433, prod: port 5435)
- **Storage**: MinIO (S3-compatible) for PDF blob storage
- **Auth**: Email + password via IAuthService interface (pluggable for future OAuth)
- **Multi-tenancy**: Subdomain-based routing, per-tenant databases and MinIO buckets

## Multi-Tenant Architecture
- Each tenant has a subdomain (`nocoresources.entouch.org`), a database (`sk_nocoresources`), and a MinIO bucket (`nocoresources-pdfs`)
- The backend resolves the tenant from the `Host` header via `app/tenant.py`
- Flask-SQLAlchemy's engine is swapped per-request to route queries to the correct DB
- Tenant registry: `backend/tenants.json`
- Management script: `./tenant.sh create|delete|list`

## User Access Model
- First user to register on a tenant → admin (auto-approved)
- Subsequent users → member (pending approval)
- Admin approves users via `PATCH /api/v1/admin/users/<id>`
- Approved users see ALL data in the tenant (shared access, no per-user filtering)
- Unapproved users get 403 on all protected endpoints
- Auth decorator injects `g.current_user_id`, `g.current_user_role`, `g.current_user_is_approved`

## Project structure
```
/
├── backend/          # Flask API
│   ├── app/
│   │   ├── auth/         # IAuthService, EmailPasswordAuthService, auth_required decorator
│   │   ├── blueprints/   # Flask route blueprints (one per resource + admin_bp)
│   │   ├── repositories/ # Repository interfaces + SQLAlchemy implementations
│   │   ├── services/     # Business logic layer
│   │   ├── tenant.py     # Multi-tenant middleware (Host → DB engine swap)
│   │   ├── minio_client.py # MinIO with per-tenant bucket support (with_bucket)
│   │   ├── models.py     # SQLAlchemy ORM models (User has role + is_approved)
│   │   ├── extensions.py # db, bcrypt instances
│   │   └── __init__.py   # create_app factory
│   ├── migrations/       # Alembic migration scripts (007 = tenant roles)
│   ├── manage_tenant.py  # Server-side tenant creation CLI
│   ├── tenants.json      # Tenant registry
│   ├── tests/            # pytest test suite
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── .env.example      # Copy to .env and set JWT_SECRET
│   └── .flaskenv         # Sets FLASK_APP, host, port automatically
├── frontend/         # Expo app
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts       # Axios (relative URLs on web for multi-tenant)
│   │   │   ├── hooks/          # TanStack Query hooks per resource + useAdmin
│   │   │   └── types.ts        # Shared API response types (includes TenantUser)
│   │   ├── components/         # Shared components (MarkdownEditor, LineItemEditor)
│   │   ├── navigation/         # RootNavigator, types, navigationRef
│   │   ├── screens/
│   │   │   ├── auth/           # LoginScreen, RegisterScreen
│   │   │   └── app/            # All authenticated screens (includes AdminUsersScreen)
│   │   └── store/              # Zustand auth store (token, userId, role, isApproved)
│   ├── App.tsx                 # Entry point with registerRootComponent
│   └── .env                    # EXPO_PUBLIC_API_URL (set to LAN IP for device testing)
├── infra/
│   └── add-tenant-nginx.sh    # Server-side nginx config helper
├── docker-compose.yml          # Dev containers (PostgreSQL + MinIO)
├── docker-compose.prod.yml     # Prod containers
├── deploy.sh                   # Deploy script (migrates ALL tenant DBs)
├── tenant.sh                   # Tenant management (create/delete/list)
├── TENANTS.md                  # Tenant management documentation
└── README.md
```

## Running the project

### Start databases + MinIO
```bash
docker compose up -d
```

### Start backend (from project root)
```bash
source backend/venv/bin/activate
cd backend && flask run
# or without activating: backend/venv/bin/flask run --host=0.0.0.0 --port=5000
```

### Start frontend
```bash
npx expo start --clear   # from frontend/ directory
```

### Physical device testing
Set `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:5000` in `frontend/.env` and restart Expo with `--clear`.

## Production

- **Live URL**: https://entouch.org (default tenant)
- **Tenant example**: https://nocoresources.entouch.org
- **Server SSH alias**: `awspantrypix`
- **Deploy script**: `./deploy.sh` (run from project root, migrates all tenant DBs)
- **Tenant management**: `./tenant.sh create|delete|list`
- **Full deployment details**: see `.kiro/steering/deployment.md`
- **Tenant documentation**: see `TENANTS.md`

Never commit `backend/.env` or any file containing `JWT_SECRET`. The production `.env` lives only on the server at `/home/sitekeeper/app/backend/.env`.
