# Deployment — SiteKeeper on entouch.org

## Server overview

| Thing | Detail |
|---|---|
| SSH alias | `awspantrypix` |
| Domain | `https://entouch.org` |
| App user | `sitekeeper` |
| Code path | `/home/sitekeeper/app` |
| Web root | `/var/www/sitekeeper/html` |
| API service | `sitekeeperapi` (systemd) |
| API port | `127.0.0.1:5002` (gunicorn, 3 workers) |
| DB container | `app-db-1` (postgres:16-alpine, `127.0.0.1:5435`) |
| Compose file | `/home/sitekeeper/app/docker-compose.prod.yml` |
| nginx config | `/etc/nginx/sites-available/entouch.org` |
| SSL cert | Let's Encrypt (wildcard pending, per-domain for now) |

## Multi-Tenant Architecture

Each client (business) gets an isolated environment on the same server:
- **Separate database**: `sk_<slug>` on the shared Postgres instance
- **Separate MinIO bucket**: `<slug>-pdfs` on the shared MinIO instance
- **Separate subdomain**: `<slug>.entouch.org` routed by nginx
- **Shared backend**: single gunicorn process resolves tenant from Host header
- **Shared frontend**: same SPA served to all tenants

### Tenant registry
File: `/home/sitekeeper/app/backend/tenants.json`

### Adding a new tenant
```bash
# On the server:
cd /home/sitekeeper/app/backend
DATABASE_URL=... venv/bin/python manage_tenant.py create <slug> --name "Display Name"
sudo /home/sitekeeper/app/infra/add-tenant-nginx.sh <slug>
sudo systemctl restart sitekeeperapi
```

Or manually:
1. Create database: `docker exec app-db-1 psql -U sitekeeper -c "CREATE DATABASE sk_<slug>;"`
2. Run migrations: `DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5435/sk_<slug> venv/bin/alembic upgrade head`
3. Create MinIO bucket (via Python or mc client)
4. Add entry to `tenants.json`
5. Add nginx config: `sudo /home/sitekeeper/app/infra/add-tenant-nginx.sh <slug>`
6. Add subdomain to CORS_ORIGINS in `.env`
7. Restart: `sudo systemctl restart sitekeeperapi`

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

The script:
1. `git pull` on the server as the `sitekeeper` user
2. `pip install` any new dependencies
3. Runs `alembic upgrade head` for any new migrations
4. Restarts the `sitekeeperapi` systemd service
5. Builds the Expo web bundle with `EXPO_PUBLIC_API_URL=https://entouch.org` baked in
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

### Run migrations manually
```bash
ssh awspantrypix "sudo -u sitekeeper bash -c '
  cd /home/sitekeeper/app/backend &&
  DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5435/sitekeeper \
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
| `CORS_ORIGINS` | `https://entouch.org,https://www.entouch.org` |
| `FLASK_APP` | `app` |

## Adding a new migration

1. Create the migration file locally in `backend/migrations/versions/`
2. Run `./deploy.sh backend` — Alembic will apply it automatically

Never modify existing migration files. Always create a new numbered one.

## nginx config

The nginx config at `/etc/nginx/sites-available/entouch.org` routes:
- `GET /api/*` → proxied to gunicorn on port 5002
- Everything else → SPA (`/var/www/sitekeeper/html/index.html`)
- HTTP → 301 redirect to HTTPS
- SSL cert at `/etc/letsencrypt/live/entouch.org/`

To edit nginx config:
```bash
ssh awspantrypix "sudo nano /etc/nginx/sites-available/entouch.org"
ssh awspantrypix "sudo nginx -t && sudo systemctl reload nginx"
```

## Other apps on the same server

The server also hosts `pantrypix.app` and `matrix.pantrypix.app`. Do not touch:
- `/etc/nginx/sites-enabled/pantrypix.app`
- `/etc/nginx/sites-enabled/matrix.pantrypix.app`
- `/etc/systemd/system/pantrypixapi.service`
- Port `5001` (pantrypix gunicorn)
- Ports `5433`, `5434` (pantrypix DB containers)
- `/etc/ssl/pantrypix/` (pantrypix certs)
