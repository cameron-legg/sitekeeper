# Deployment — SiteKeeper on entouch.org

## Server overview

| Thing | Detail |
|---|---|
| SSH alias | `awspantrypix` |
| Domains | `https://entouch.org`, `https://<slug>.entouch.org` |
| App user | `sitekeeper` |
| Code path | `/home/sitekeeper/app` |
| Web root | `/var/www/sitekeeper/html` |
| API service | `sitekeeperapi` (systemd) |
| API port | `127.0.0.1:5002` (gunicorn, 3 workers) |
| DB container | `app-db-1` (postgres:16-alpine, `127.0.0.1:5435`) |
| MinIO container | `app-minio-1` (port 9000) |
| Compose file | `/home/sitekeeper/app/docker-compose.prod.yml` |
| nginx configs | `/etc/nginx/sites-available/entouch.org` + per-tenant configs |
| SSL cert | Wildcard `*.entouch.org` at `/etc/letsencrypt/live/entouch.org/` |
| Tenant registry | `/home/sitekeeper/app/backend/tenants.json` |

## Multi-Tenant Architecture

Each client (business) gets an isolated environment on the same server:
- **Separate database**: `sk_<slug>` on the shared Postgres instance
- **Separate MinIO bucket**: `<slug>-pdfs` on the shared MinIO instance
- **Separate subdomain**: `<slug>.entouch.org` routed by nginx
- **Shared backend**: single gunicorn process resolves tenant from Host header, swaps DB engine per-request, restores default engine between requests
- **Shared frontend**: same SPA served to all tenants (uses relative API URLs in production, explicit URL in local dev)

### Tenant management (from local machine)
```bash
./tenant.sh create <slug> --name "Display Name"   # Create tenant
./tenant.sh delete <slug>                          # Delete tenant (destructive!)
./tenant.sh list                                   # List all tenants
```

See [TENANTS.md](../../TENANTS.md) for full documentation.

### Current tenants
| Slug | Domain | Database |
|------|--------|----------|
| default | entouch.org | sitekeeper |
| nocoresources | nocoresources.entouch.org | sk_nocoresources |

## Deploying changes

### Full deploy (backend + frontend)
```bash
./deploy.sh
```

### Frontend only (no backend changes)
```bash
./deploy.sh frontend
```

### Backend only (code + migrations, no frontend rebuild)
```bash
./deploy.sh backend
```

The deploy script:
1. `git pull` on the server as the `sitekeeper` user
2. `pip install` any new dependencies
3. Runs `alembic upgrade head` against **ALL tenant databases** (reads from `tenants.json`)
4. Restarts the `sitekeeperapi` systemd service
5. Builds the Expo web bundle locally
6. `rsync`s the `frontend/dist/` output to `/var/www/sitekeeper/html/`

## Manual steps (when needed)

### Restart the API without redeploying
```bash
ssh awspantrypix "sudo systemctl restart sitekeeperapi"
```

### Check API logs
```bash
ssh awspantrypix "sudo journalctl -u sitekeeperapi -f"
```

### Check nginx logs
```bash
ssh awspantrypix "sudo tail -f /var/log/nginx/error.log"
```

### Run migrations manually (single tenant)
```bash
ssh awspantrypix "sudo -u sitekeeper bash -c '
  cd /home/sitekeeper/app/backend &&
  DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5435/sk_nocoresources \
  /home/sitekeeper/app/backend/venv/bin/alembic upgrade head
'"
```

### Restart the DB container (if it goes down)
```bash
ssh awspantrypix "sudo -u sitekeeper docker compose -f /home/sitekeeper/app/docker-compose.prod.yml up -d"
```

### Edit the backend .env on the server
```bash
ssh awspantrypix "sudo -u sitekeeper nano /home/sitekeeper/app/backend/.env"
ssh awspantrypix "sudo systemctl restart sitekeeperapi"
```

## Production environment variables

File: `/home/sitekeeper/app/backend/.env`

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://sitekeeper:sitekeeper@localhost:5435/sitekeeper` |
| `JWT_SECRET` | (set at deploy time — do not commit) |
| `JWT_EXPIRY_SECONDS` | `8640000` |
| `CORS_ORIGINS` | `https://entouch.org,https://www.entouch.org,https://nocoresources.entouch.org` |
| `FLASK_APP` | `app` |
| `BASE_DATABASE_URL` | `postgresql://sitekeeper:sitekeeper@localhost:5435` |
| `TENANTS_FILE` | `/home/sitekeeper/app/backend/tenants.json` |
| `DEFAULT_TENANT` | `default` |
| `MINIO_ENDPOINT` | `localhost:9000` |
| `MINIO_ACCESS_KEY` | (set at deploy time) |
| `MINIO_SECRET_KEY` | (set at deploy time) |
| `MINIO_BUCKET_NAME` | `sitekeeper-pdfs` |
| `MINIO_USE_SSL` | `false` |

## Adding a new migration

1. Create the migration file locally in `backend/migrations/versions/`
2. Run `./deploy.sh backend` — Alembic will apply it to ALL tenant databases automatically

Never modify existing migration files. Always create a new numbered one.

## SSL Certificate (Wildcard)

The wildcard cert covers `*.entouch.org` and `entouch.org`. Since DNS is on Squarespace (no API), renewal is manual every 90 days:

```bash
ssh awspantrypix
sudo certbot certonly --manual --preferred-challenges dns \
  -d '*.entouch.org' -d 'entouch.org' \
  --cert-name entouch.org --force-renewal
```

Update the `_acme-challenge.entouch.org` TXT record in Squarespace DNS with the value certbot shows, wait for propagation, then press Enter.

Long-term: migrate DNS to Cloudflare for automated wildcard renewals via `certbot-dns-cloudflare`.

## nginx config

Each tenant gets its own nginx config at `/etc/nginx/sites-available/<slug>.entouch.org`:
- HTTP → 301 redirect to HTTPS
- `/api/*` → proxied to gunicorn on port 5002
- Everything else → SPA (`/var/www/sitekeeper/html/index.html`)
- SSL cert at `/etc/letsencrypt/live/entouch.org/` (wildcard)

To add a new tenant's nginx config manually:
```bash
ssh awspantrypix "sudo /home/sitekeeper/app/infra/add-tenant-nginx.sh <slug>"
```

## Other apps on the same server

The server also hosts `pantrypix.app` and `matrix.pantrypix.app`. Do not touch:
- `/etc/nginx/sites-enabled/pantrypix.app`
- `/etc/nginx/sites-enabled/matrix.pantrypix.app`
- `/etc/systemd/system/pantrypixapi.service`
- Port `5001` (pantrypix gunicorn)
- Ports `5433`, `5434` (pantrypix DB containers)
- `/etc/ssl/pantrypix/` (pantrypix certs)
