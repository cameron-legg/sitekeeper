# Deployment — SiteKeeper on entouch.org

## Architecture: Multi-Tenant Isolated Environments

Each client (business) gets a fully isolated Docker Compose stack at `<client>.entouch.org`.
Each stack contains: backend (Flask/gunicorn), frontend (Expo web/nginx), PostgreSQL, MinIO.
Tenants share no data — each has its own database and storage.

See `infra/README.md` for full details.

### Tenant management
```bash
# Add a new client
./infra/manage-tenant.sh create nocoresources   # → nocoresources.entouch.org

# Deploy updates to one tenant
./infra/deploy-tenant.sh nocoresources

# Deploy updates to ALL tenants
./infra/deploy-all.sh

# Remove a client
./infra/manage-tenant.sh destroy nocoresources
```

## Server overview

| Thing | Detail |
|---|---|
| SSH alias | `awspantrypix` |
| Domain | `https://entouch.org` |
| App user | `sitekeeper` |
| Code path | `/home/sitekeeper/app` |
| Tenants path | `/home/sitekeeper/tenants/<name>/` |
| Port range | `6000+` (each tenant gets 5 ports in blocks of 10) |
| nginx configs | `/etc/nginx/sites-available/<name>.entouch.org` |
| SSL certs | Let's Encrypt per subdomain, auto-renews via certbot |

## Deploying changes

### Deploy a single tenant
```bash
./infra/deploy-tenant.sh <tenant-name>
```
This pulls latest code, rebuilds the Docker images, and restarts the tenant's containers.
Migrations run automatically on container start via `backend/entrypoint.sh`.

### Deploy all tenants
```bash
./infra/deploy-all.sh
```

### Legacy deploy (single-instance, deprecated)
The old `./deploy.sh` still works for the original `entouch.org` monolith if needed during migration.

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
