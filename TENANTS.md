# Tenant Management

SiteKeeper supports multiple isolated client environments (tenants). Each tenant gets their own subdomain, database, and storage bucket while sharing the same server infrastructure.

## Architecture

| Component | Shared or Isolated |
|-----------|-------------------|
| Server (EC2) | Shared |
| Nginx | Shared (one config per tenant) |
| Gunicorn / Flask backend | Shared (routes by Host header) |
| Frontend (Expo web SPA) | Shared (same bundle for all tenants) |
| PostgreSQL instance | Shared (one database per tenant) |
| MinIO instance | Shared (one bucket per tenant) |
| SSL certificate | Shared (wildcard `*.entouch.org`) |

## Prerequisites

- SSH access to the server (`ssh awspantrypix`)
- Wildcard DNS: `*.entouch.org` A record pointing to `3.22.90.167`
- Wildcard SSL cert at `/etc/letsencrypt/live/entouch.org/` (see main README for setup)

---

## Creating a Tenant

From your local machine (project root):

```bash
./tenant.sh create <slug> --name "Display Name"
```

### Example

```bash
./tenant.sh create nocoresources --name "NoCo Resources"
```

### What this does

1. **Creates a PostgreSQL database** (`sk_nocoresources`) on the existing Postgres container
2. **Runs all Alembic migrations** against the new database
3. **Creates a MinIO bucket** (`nocoresources-pdfs`) for PDF storage
4. **Registers the tenant** in `backend/tenants.json`
5. **Adds an nginx config** at `/etc/nginx/sites-available/nocoresources.entouch.org`
6. **Adds the subdomain to CORS_ORIGINS** in the backend `.env`
7. **Restarts the API service** so it picks up the new tenant
8. **Verifies** the health endpoint responds with the correct tenant

### Result

- Tenant is live at `https://<slug>.entouch.org`
- The first user to register becomes the **admin** (auto-approved)
- Subsequent users register but are **pending** until the admin approves them
- All approved users share access to all data in that tenant's database

### Naming rules

- Slug must be lowercase alphanumeric with hyphens (e.g. `nocoresources`, `smith-plumbing`)
- Must start and end with a letter or number
- This becomes the subdomain: `<slug>.entouch.org`

---

## Deleting a Tenant

From your local machine (project root):

```bash
./tenant.sh delete <slug>
```

### Example

```bash
./tenant.sh delete nocoresources
```

You will be prompted to type the slug to confirm (this is destructive and irreversible).

### What this does

1. **Removes the nginx config** and reloads nginx
2. **Removes the tenant** from `backend/tenants.json`
3. **Removes the subdomain from CORS_ORIGINS** in the backend `.env`
4. **Drops the PostgreSQL database** (`sk_nocoresources`) — all data is permanently deleted
5. **Removes the MinIO bucket** and all stored PDFs
6. **Restarts the API service**

### Warning

This permanently destroys all data for that tenant: users, job sites, jobs, estimates, invoices, notes, and PDFs. There is no undo.

---

## Listing Tenants

```bash
./tenant.sh list
```

Shows all configured tenants with their slug, display name, domain, and database name.

---

## Deploying Updates

After making code changes, deploy to all tenants at once:

```bash
./deploy.sh           # backend + frontend
./deploy.sh backend   # backend only (pulls code, migrates ALL tenant DBs, restarts API)
./deploy.sh frontend  # frontend only (builds Expo web, uploads to server)
```

The deploy script automatically runs migrations against every database listed in `tenants.json`.

---

## How Tenant Isolation Works

1. User visits `nocoresources.entouch.org`
2. Nginx routes the request to gunicorn (port 5002)
3. Flask middleware reads the `Host` header → extracts slug `nocoresources`
4. Looks up `nocoresources` in `tenants.json` → gets the database URL
5. Swaps the SQLAlchemy engine to point at `sk_nocoresources`
6. All queries for that request hit the tenant's database
7. MinIO operations use the tenant's bucket (`nocoresources-pdfs`)

Each tenant's database is completely independent. Users, data, and files never cross tenant boundaries.

---

## User Access Model

| Role | Auto-approved | Can access data | Can manage users |
|------|--------------|-----------------|-----------------|
| Admin (first user) | Yes | Yes | Yes |
| Member (approved) | No | Yes | No |
| Member (pending) | No | No (403) | No |

- The **first user** to register on a new tenant becomes the admin
- The admin can approve or revoke other users via ☰ → Manage Users
- Pending users can log in but get a 403 on all data endpoints until approved
