# JobSyte — Server Migration Guide

Complete documentation for migrating from the current AWS server (`awspantrypix` / `entouch.org`) to the new dedicated server (`jobsyteprod` / `jobsyte.app`).

---

## Overview

| | Old Server | New Server |
|---|---|---|
| **SSH alias** | `awspantrypix` | `jobsyteprod` |
| **Domain** | `entouch.org` | `jobsyte.app` |
| **Tenant example** | `nocoresources.entouch.org` | `nocoresources.jobsyte.app` |
| **SSL** | Let's Encrypt wildcard (manual certbot) | Let's Encrypt wildcard (automated via Cloudflare DNS plugin) |
| **OS** | Ubuntu 22.04 | Ubuntu 24.04 LTS (clean install) |
| **Shared with** | pantrypix.app, matrix.pantrypix.app | Nothing — dedicated to JobSyte |

**Key changes from old setup:**
- Domain changes from `entouch.org` → `jobsyte.app`
- SSL via Cloudflare DNS + Let's Encrypt (free wildcard, auto-renews every 90 days, zero manual intervention)
- Fresh server with latest LTS versions of all software
- New GitHub deploy key (fresh keypair)
- Old server (`awspantrypix`) remains fully operational — nothing is removed or stopped
- Deploy scripts updated to support BOTH servers (target via argument)
- All production configuration (nginx configs, systemd service, docker-compose) lives in the repo

**Important:** The old `awspantrypix` server continues to run. pantrypix.app and all its services are untouched. You can continue deploying SiteKeeper to both servers.

---

## Production Configuration (Lives in the Repo)

All production server configuration is version-controlled in the repository:

| Config | Repo Location | Purpose |
|--------|---------------|---------|
| Docker services | `docker-compose.prod.yml` | PostgreSQL + MinIO containers |
| Nginx (main) | `infra/nginx/jobsyte.app` | Bare domain + www nginx config |
| Nginx (tenants) | `infra/nginx/nocoresources.jobsyte.app` | Per-tenant nginx config |
| Systemd service | `infra/sitekeeperapi.service` | gunicorn service definition |
| Backup script | `infra/backup-db.sh` | Daily pg_dump for all tenants |
| MinIO init | `infra/init-minio-buckets.sh` | Creates all tenant buckets |
| Deploy script | `deploy.sh` | Automated deployment (supports both servers) |
| Tenant management | `tenant.sh` | Create/delete tenants (supports both servers) |
| Tenant registry | `backend/tenants.json` | Tenant → database/bucket/domain mapping |

The only files that live ONLY on the server (not in the repo):
- `backend/.env` — contains secrets (JWT_SECRET, MINIO keys, OPENAI_API_KEY)
- `/etc/ssl/cloudflare.ini` — Cloudflare API token for SSL cert automation

---

## Current Server Inventory (what we're migrating FROM)

| Component | Details |
|-----------|---------|
| **Databases** | `sitekeeper` (default tenant), `sk_nocoresources` (NoCo Resources) |
| **MinIO buckets** | `sitekeeper-pdfs`, `sitekeeper-media`, `nocoresources-pdfs`, `nocoresources-media` |
| **MinIO data** | ~97 MB (PDFs + job photos) |
| **DB backups** | `/home/sitekeeper/backups/` (11 MB — daily, pre-deploy, manual) |
| **Frontend build** | `/var/www/sitekeeper/html/` (3.2 MB Expo web export) |
| **Backend** | Flask + gunicorn (3 workers), Python venv, 59 packages |

### Data Sizes

| What | Size | Transfer Time (100 Mbps) |
|------|------|--------------------------|
| Database backups (all) | 11 MB | < 1 sec |
| MinIO data (PDFs + photos) | 97 MB | ~8 sec |
| Frontend build | 3.2 MB | < 1 sec |
| Git repo (fresh clone) | ~50 MB | ~4 sec |
| **Total data to transfer** | **~110 MB** | **< 15 sec** |

---

## Target Software Versions (Latest LTS)

| Software | Version | Notes |
|----------|---------|-------|
| **Ubuntu** | 24.04 LTS | Clean install on `jobsyteprod` |
| **PostgreSQL** | 17 | Latest stable (Docker `postgres:17-alpine`) |
| **Python** | 3.12 | Ships with Ubuntu 24.04 |
| **Node.js** | 22 LTS | For frontend builds only |
| **Docker** | Latest stable | Via official Docker apt repo |
| **Docker Compose** | v2 (plugin) | Comes with Docker install |
| **nginx** | Latest in Ubuntu 24.04 repos | Reverse proxy + static files |
| **MinIO** | Latest (`minio/minio`) | S3-compatible object storage |
| **gunicorn** | Latest | Python WSGI server (installed in backend venv, not system-wide) |

---

## Pre-Migration Checklist

- [ ] New server `jobsyteprod` provisioned and accessible via `ssh jobsyteprod`
- [ ] `jobsyte.app` domain registered (GoDaddy remains the registrar)
- [ ] Cloudflare account created, `jobsyte.app` added (free plan)
- [ ] GoDaddy nameservers changed to Cloudflare's (and propagated)
- [ ] Cloudflare API token created (scoped to Zone DNS Edit for jobsyte.app)
- [ ] You have the production secrets from old server (JWT_SECRET, MINIO keys, OPENAI_API_KEY)
- [ ] DNS records NOT pointed to new server yet (do that in Phase 2 / Phase 9)

---

## Phase 1: Set Up the New Server

The `jobsyteprod` server is a clean slate.

### 1.1 System update and base packages

```bash
ssh jobsyteprod

sudo apt update && sudo apt upgrade -y
sudo apt install -y \
  curl \
  git \
  rsync \
  ufw \
  software-properties-common \
  unzip
```

### 1.2 Create the sitekeeper user

```bash
sudo adduser --system --group --shell /bin/bash sitekeeper
sudo usermod -aG www-data sitekeeper
sudo mkdir -p /home/sitekeeper/.ssh
sudo chmod 700 /home/sitekeeper/.ssh
sudo chown sitekeeper:sitekeeper /home/sitekeeper/.ssh
```

### 1.3 Install Docker (latest stable)

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker sitekeeper
```

### 1.4 Install Python 3.12

```bash
sudo apt install -y python3 python3-venv python3-pip
python3 --version  # Should be 3.12.x on Ubuntu 24.04
```

### 1.5 Install Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should be 22.x
```

### 1.6 Install nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 1.7 Install PostgreSQL client 17 (for backups/restore)

```bash
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/keyrings/pgdg.gpg
sudo apt update
sudo apt install -y postgresql-client-17
```

### 1.8 Configure firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Phase 2: SSL — Cloudflare DNS + Let's Encrypt Wildcard (Automated)

Instead of GoDaddy certs with manual renewal, we use Cloudflare as the DNS provider and certbot's Cloudflare plugin to get free wildcard certs that renew automatically.

### 2.1 Move DNS to Cloudflare (keep GoDaddy as registrar)

1. Sign up for a free Cloudflare account at https://cloudflare.com
2. Add `jobsyte.app` as a site (free plan is fine)
3. Cloudflare will scan existing records and give you two nameservers, e.g.:
   - `ada.ns.cloudflare.com`
   - `ben.ns.cloudflare.com`
4. Go to GoDaddy → My Domains → `jobsyte.app` → DNS → Nameservers
5. Change from "Default" to "Custom" and enter the two Cloudflare nameservers
6. Wait for propagation (can take 1-24 hours, usually under an hour)
7. Cloudflare dashboard will show the site as "Active" once nameservers are confirmed

### 2.2 Add DNS records in Cloudflare

Once the site is active in Cloudflare, add these A records:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | NEW_SERVER_IP | DNS only (grey cloud) |
| A | `*` | NEW_SERVER_IP | DNS only (grey cloud) |

**Important:** Set proxy status to "DNS only" (grey cloud icon), not "Proxied" (orange cloud). We want Cloudflare for DNS only, not as a reverse proxy — nginx handles that directly.

### 2.3 Create a Cloudflare API token

1. Cloudflare dashboard → My Profile → API Tokens
2. Click **Create Token**
3. Use the **Edit zone DNS** template
4. Set permissions: Zone → DNS → Edit
5. Set zone resources: Include → Specific zone → `jobsyte.app`
6. Create the token and copy it (you won't see it again)

### 2.4 Install certbot + Cloudflare plugin on the server

```bash
ssh jobsyteprod

sudo apt install -y certbot python3-certbot-dns-cloudflare
```

### 2.5 Store the Cloudflare API token

```bash
sudo mkdir -p /etc/ssl/cloudflare
sudo tee /etc/ssl/cloudflare/cloudflare.ini << 'EOF'
dns_cloudflare_api_token = YOUR_CLOUDFLARE_API_TOKEN_HERE
EOF
sudo chmod 600 /etc/ssl/cloudflare/cloudflare.ini
```

### 2.6 Get the wildcard certificate

```bash
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/ssl/cloudflare/cloudflare.ini \
  -d 'jobsyte.app' \
  -d '*.jobsyte.app' \
  --cert-name jobsyte.app
```

Certbot will automatically create a DNS TXT record via the Cloudflare API, validate, and issue the cert. No manual steps.

### 2.7 Verify the certificate

```bash
sudo certbot certificates
# Should show:
#   Certificate Name: jobsyte.app
#   Domains: jobsyte.app *.jobsyte.app
#   Expiry Date: (about 90 days from now)
```

### 2.8 Certificate file locations

| File | Path | Used in nginx as |
|------|------|------------------|
| Full chain | `/etc/letsencrypt/live/jobsyte.app/fullchain.pem` | `ssl_certificate` |
| Private key | `/etc/letsencrypt/live/jobsyte.app/privkey.pem` | `ssl_certificate_key` |

### 2.9 Auto-renewal (already set up)

Certbot installs a systemd timer that runs twice daily and renews any cert within 30 days of expiry. Verify it's active:

```bash
sudo systemctl status certbot.timer
# Should show: active (waiting)
```

To also reload nginx after renewal, add a deploy hook:

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh << 'EOF'
#!/bin/bash
systemctl reload nginx
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

That's it — no more manual renewals, no more expired cert emergencies. The cert renews silently every ~60 days and nginx picks it up automatically.

---

## Phase 3: Deploy Application Code

### 3.1 Generate GitHub deploy key

```bash
sudo -u sitekeeper ssh-keygen -t ed25519 -f /home/sitekeeper/.ssh/github -N "" -C "jobsyteprod-deploy"
sudo cat /home/sitekeeper/.ssh/github.pub
```

Add the public key as a **Deploy Key** on GitHub:
- Repo → Settings → Deploy Keys → Add deploy key
- Title: `jobsyteprod`
- Key: (paste public key)
- Allow write access: No

### 3.2 Configure SSH for GitHub

```bash
sudo -u sitekeeper tee /home/sitekeeper/.ssh/config << 'EOF'
Host github.com
  IdentityFile /home/sitekeeper/.ssh/github
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF
sudo chmod 600 /home/sitekeeper/.ssh/config
sudo chown sitekeeper:sitekeeper /home/sitekeeper/.ssh/config
```

### 3.3 Clone the repo

```bash
sudo -u sitekeeper git clone git@github.com:YOUR_ORG/SiteKeeper.git /home/sitekeeper/app
```

---

## Phase 4: Start Docker Services

### 4.1 Start containers (PostgreSQL 17 + MinIO)

```bash
cd /home/sitekeeper/app
sudo -u sitekeeper docker compose -f docker-compose.prod.yml up -d
sleep 5
sudo -u sitekeeper docker compose -f docker-compose.prod.yml ps
```

Both `app-db-1` and `app-minio-1` should show as running.

---

## Phase 5: Set Up Python Virtual Environment

All backend Python code runs inside an isolated virtual environment. This keeps dependencies separate from the system Python and ensures reproducible installs. **Never install backend packages with system pip.**

```bash
cd /home/sitekeeper/app/backend

# Create the virtual environment
sudo -u sitekeeper python3 -m venv venv

# Upgrade pip inside the venv
sudo -u sitekeeper venv/bin/pip install --upgrade pip

# Install all backend dependencies + gunicorn (production WSGI server)
sudo -u sitekeeper venv/bin/pip install -r requirements.txt gunicorn
```

After this, all backend commands use the venv explicitly:
- **Run the app:** `venv/bin/gunicorn -w 3 -b 127.0.0.1:5002 "app:create_app()"`
- **Run migrations:** `venv/bin/alembic upgrade head`
- **Run scripts:** `venv/bin/python seed_data.py`
- **Install packages:** `venv/bin/pip install <package>`

The systemd service (`infra/sitekeeperapi.service`) has `ExecStart` pointing to `venv/bin/gunicorn` and adds `venv/bin` to the PATH, so the running API always uses the venv.

---

## Phase 6: Migrate Data

### 6.1 Take a fresh backup on the old server

```bash
ssh awspantrypix "sudo -u sitekeeper /home/sitekeeper/app/infra/backup-db.sh manual"
```

### 6.2 Copy backups to the new server

```bash
rsync -avz awspantrypix:/home/sitekeeper/backups/ /tmp/sk-backups/
rsync -avz /tmp/sk-backups/ jobsyteprod:/home/sitekeeper/backups/
ssh jobsyteprod "sudo chown -R sitekeeper:sitekeeper /home/sitekeeper/backups"
```

### 6.3 Create tenant databases and restore

```bash
ssh jobsyteprod

# Create the nocoresources database
sudo -u sitekeeper docker exec app-db-1 psql -U sitekeeper -c "CREATE DATABASE sk_nocoresources;"

# Find the latest manual backup
LATEST_DEFAULT=$(ls -t /home/sitekeeper/backups/manual/*_sitekeeper.sql.gz | head -1)
LATEST_NOCO=$(ls -t /home/sitekeeper/backups/manual/*_sk_nocoresources.sql.gz | head -1)

# Restore default tenant
sudo -u sitekeeper pg_restore -h localhost -p 5435 -U sitekeeper -d sitekeeper --clean --if-exists "$LATEST_DEFAULT"

# Restore nocoresources tenant
sudo -u sitekeeper pg_restore -h localhost -p 5435 -U sitekeeper -d sk_nocoresources --clean --if-exists "$LATEST_NOCO"

# Verify
sudo -u sitekeeper docker exec app-db-1 psql -U sitekeeper -c "\l"
```

### 6.4 Copy MinIO data (PDFs + photos)

```bash
# On old server: tar up the MinIO volume
ssh awspantrypix "sudo tar -czf /tmp/minio-data.tar.gz -C /var/lib/docker/volumes/app_minio_data/_data ."

# Copy to new server
scp awspantrypix:/tmp/minio-data.tar.gz /tmp/
scp /tmp/minio-data.tar.gz jobsyteprod:/tmp/

# On new server: extract into MinIO volume
ssh jobsyteprod
NEW_MINIO_VOL=$(sudo docker volume inspect app_minio_data --format '{{.Mountpoint}}')
sudo tar -xzf /tmp/minio-data.tar.gz -C "$NEW_MINIO_VOL"
sudo chown -R 1000:1000 "$NEW_MINIO_VOL"

# Restart MinIO
sudo -u sitekeeper docker compose -f /home/sitekeeper/app/docker-compose.prod.yml restart minio

# Verify
sudo -u sitekeeper docker exec app-minio-1 ls /data/
# Should show: nocoresources-media  nocoresources-pdfs  sitekeeper-media  sitekeeper-pdfs

# Clean up
sudo rm /tmp/minio-data.tar.gz
```

---

## Phase 7: Configure the Application

### 7.1 Create the production .env

```bash
sudo -u sitekeeper tee /home/sitekeeper/app/backend/.env << 'EOF'
DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5435/sitekeeper
JWT_SECRET=PASTE_EXISTING_JWT_SECRET_HERE
JWT_EXPIRY_SECONDS=8640000
CORS_ORIGINS=https://jobsyte.app,https://www.jobsyte.app,https://nocoresources.jobsyte.app
FLASK_APP=app

# Multi-tenant settings
BASE_DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5435
TENANTS_FILE=/home/sitekeeper/app/backend/tenants.json
DEFAULT_TENANT=default

# Landing mode
LANDING_MODE=true

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=PASTE_MINIO_ACCESS_KEY
MINIO_SECRET_KEY=PASTE_MINIO_SECRET_KEY
MINIO_BUCKET_NAME=sitekeeper-pdfs
MINIO_USE_SSL=false

# OpenAI
OPENAI_API_KEY=PASTE_OPENAI_KEY
OPENAI_MODEL=gpt-4o-mini
EOF

sudo chmod 600 /home/sitekeeper/app/backend/.env
sudo chown sitekeeper:sitekeeper /home/sitekeeper/app/backend/.env
```

**Copy secrets from old server:** `JWT_SECRET` MUST match or existing tokens break.

### 7.2 Update tenants.json for new domain

```bash
sudo -u sitekeeper tee /home/sitekeeper/app/backend/tenants.json << 'EOF'
{
    "default": {
        "database_url": "postgresql://sitekeeper:sitekeeper@localhost:5435/sitekeeper",
        "bucket": "sitekeeper-pdfs",
        "media_bucket": "sitekeeper-media",
        "domain": "jobsyte.app",
        "name": "JobSyte (Default)"
    },
    "nocoresources": {
        "database_url": "postgresql://sitekeeper:sitekeeper@localhost:5435/sk_nocoresources",
        "bucket": "nocoresources-pdfs",
        "media_bucket": "nocoresources-media",
        "domain": "nocoresources.jobsyte.app",
        "name": "NoCo Resources"
    }
}
EOF
```

### 7.3 Run Alembic migrations (verify schema)

```bash
cd /home/sitekeeper/app/backend
sudo -u sitekeeper bash -c 'set -a && source .env && set +a && venv/bin/alembic upgrade head'
sudo -u sitekeeper bash -c 'DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5435/sk_nocoresources venv/bin/alembic upgrade head'
```

---

## Phase 8: Set Up Services

### 8.1 Install the systemd service

```bash
sudo cp /home/sitekeeper/app/infra/sitekeeperapi.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sitekeeperapi
sudo systemctl start sitekeeperapi
sudo systemctl status sitekeeperapi
```

### 8.2 Build and deploy the frontend

```bash
cd /home/sitekeeper/app/frontend
sudo -u sitekeeper npm ci
sudo mkdir -p /var/www/sitekeeper/html
sudo -u sitekeeper EXPO_PUBLIC_API_URL="" npx --yes expo export --platform web --output-dir /var/www/sitekeeper/html
sudo chown -R www-data:www-data /var/www/sitekeeper/html/
```

### 8.3 Configure nginx

Install the configs from the repo:

```bash
# Main domain
sudo cp /home/sitekeeper/app/infra/nginx/jobsyte.app /etc/nginx/sites-available/jobsyte.app
sudo ln -sf /etc/nginx/sites-available/jobsyte.app /etc/nginx/sites-enabled/

# Tenant: nocoresources
sudo cp /home/sitekeeper/app/infra/nginx/nocoresources.jobsyte.app /etc/nginx/sites-available/nocoresources.jobsyte.app
sudo ln -sf /etc/nginx/sites-available/nocoresources.jobsyte.app /etc/nginx/sites-enabled/

# Remove default
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

### 8.4 Set up the backup cron

```bash
sudo mkdir -p /home/sitekeeper/backups
sudo chown sitekeeper:sitekeeper /home/sitekeeper/backups

# Add daily backup cron
(sudo -u sitekeeper crontab -l 2>/dev/null; echo '0 3 * * * cd /home/sitekeeper && /home/sitekeeper/app/infra/backup-db.sh daily >> /home/sitekeeper/backups/backup.log 2>&1') | sudo -u sitekeeper crontab -
```

---

## Phase 9: DNS Configuration

DNS is managed via Cloudflare (set up in Phase 2). The A records should already be in place from step 2.2. If you deferred pointing DNS until the server was ready, add/update them now:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | NEW_SERVER_IP | DNS only (grey cloud) |
| A | `*` | NEW_SERVER_IP | DNS only (grey cloud) |

This wildcard covers all current and future tenant subdomains. No additional DNS changes needed when creating new tenants.

---

## Phase 10: Verification

```bash
# Landing page (bare domain)
curl -s https://jobsyte.app/api/v1/context
# Expected: {"mode":"landing"}

# Tenant mode (subdomain)
curl -s https://nocoresources.jobsyte.app/api/v1/context
# Expected: {"mode":"tenant","tenant_slug":"nocoresources","tenant_name":"NoCo Resources"}

# Health check
curl -s https://jobsyte.app/api/v1/health
# Expected: {"status":"ok","tenant":"default"}

# Frontend loads
curl -s -o /dev/null -w '%{http_code}' https://jobsyte.app/
# Expected: 200

# Tenant login page loads
curl -s -o /dev/null -w '%{http_code}' https://nocoresources.jobsyte.app/login
# Expected: 200
```

---

## Phase 11: Post-Migration Validation

- [ ] Log in on `nocoresources.jobsyte.app` with existing credentials
- [ ] Verify all job sites, jobs, estimates, invoices are visible
- [ ] Generate a PDF (tests MinIO + backend)
- [ ] Upload a photo to a job (tests MinIO media bucket)
- [ ] Test the AI assistant (verifies OpenAI key)
- [ ] Create a new estimate (verifies DB writes)
- [ ] Run a manual backup: `sudo -u sitekeeper /home/sitekeeper/app/infra/backup-db.sh manual`
- [ ] Verify next morning that daily cron backup ran (check `backup.log`)
- [ ] Deploy from local using `./deploy.sh --target jobsyte` and verify it works

---

## Deploy Scripts — Dual Target Support

Both `deploy.sh` and `tenant.sh` support deploying to either server via a `--target` flag:

### deploy.sh usage

```bash
./deploy.sh                        # deploys to jobsyteprod (default, new server)
./deploy.sh --target jobsyte       # deploys to jobsyteprod
./deploy.sh --target entouch       # deploys to awspantrypix (old server)
./deploy.sh backend --target entouch   # backend-only to old server
./deploy.sh frontend --target jobsyte  # frontend-only to new server
```

### tenant.sh usage

```bash
./tenant.sh list                           # lists tenants on jobsyteprod (default)
./tenant.sh list --target entouch          # lists tenants on awspantrypix
./tenant.sh create mycompany --target jobsyte --name "My Company"
```

### Configuration per target

The scripts use a target config block:

| Target | SSH Host | Domain | API URL |
|--------|----------|--------|---------|
| `jobsyte` (default) | `jobsyteprod` | `jobsyte.app` | `https://jobsyte.app` |
| `entouch` | `awspantrypix` | `entouch.org` | `https://entouch.org` |

Both targets share:
- `APP_DIR="/home/sitekeeper/app"`
- `WEB_ROOT="/var/www/sitekeeper/html"`
- `SERVICE="sitekeeperapi"`
- `DB_PORT=5435`

---

## Code Changes Required for Migration

These changes should be made in the repo before (or as part of) the migration:

### Files to update

| File | Change |
|------|--------|
| `docker-compose.prod.yml` | Update postgres image to `postgres:17-alpine` |
| `deploy.sh` | Add `--target` flag with jobsyte/entouch configs |
| `tenant.sh` | Add `--target` flag with jobsyte/entouch configs |
| `backend/tenants.json` | Update domains (done on new server only, old keeps old domains) |
| `frontend/src/navigation/RootNavigator.tsx` | Add `https://jobsyte.app` to `linking.prefixes` |
| `.kiro/steering/deployment.md` | Update with new server info |
| `README.md` | Update live URL references |

### Files to create (new)

| File | Purpose |
|------|---------|
| `infra/nginx/jobsyte.app` | nginx config for bare domain |
| `infra/nginx/nocoresources.jobsyte.app` | nginx config for nocoresources tenant |
| `infra/sitekeeperapi.service` | systemd unit file (already exists at `/etc/systemd/system/` on old server, bring into repo) |

### Key point: backend code doesn't need changes

The tenant resolution logic extracts subdomains from the Host header generically — it doesn't hardcode `entouch.org`. The frontend uses relative URLs in production. So the actual application code works on any domain out of the box.

---

## Nginx Configs (for the repo at `infra/nginx/`)

### `infra/nginx/jobsyte.app`

```nginx
server {
    listen 80;
    server_name jobsyte.app www.jobsyte.app;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name jobsyte.app www.jobsyte.app;

    ssl_certificate     /etc/letsencrypt/live/jobsyte.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jobsyte.app/privkey.pem;

    root /var/www/sitekeeper/html;
    index index.html;

    location /api/ {
        proxy_pass         http://127.0.0.1:5002/api/;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        client_max_body_size 25M;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### `infra/nginx/nocoresources.jobsyte.app`

```nginx
server {
    listen 80;
    server_name nocoresources.jobsyte.app;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name nocoresources.jobsyte.app;

    ssl_certificate     /etc/letsencrypt/live/jobsyte.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jobsyte.app/privkey.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:5002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        client_max_body_size 25M;
    }

    location / {
        root /var/www/sitekeeper/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Rollback Plan

The old server (`awspantrypix`) remains fully operational. Nothing is stopped, removed, or modified there.

If something goes wrong:
1. Don't point DNS for `jobsyte.app` (or remove the records)
2. Old server at `entouch.org` continues working as before
3. Users can keep using `nocoresources.entouch.org`

Once you're satisfied the new server is stable (recommend 1-2 weeks):
- Optionally redirect `entouch.org` → `jobsyte.app` for old bookmarks
- The old server's SiteKeeper can be decommissioned at your discretion
- pantrypix.app and its services on `awspantrypix` are completely unaffected

---

## Quick Reference: After Migration

| Action | Command |
|--------|---------|
| Deploy to new server | `./deploy.sh --target jobsyte` |
| Deploy to old server | `./deploy.sh --target entouch` |
| Check API health (new) | `curl https://jobsyte.app/api/v1/health` |
| Check API logs (new) | `ssh jobsyteprod "sudo journalctl -u sitekeeperapi -f"` |
| Restart API (new) | `ssh jobsyteprod "sudo systemctl restart sitekeeperapi"` |
| Run backup (new) | `ssh jobsyteprod "sudo -u sitekeeper /home/sitekeeper/app/infra/backup-db.sh manual"` |
| Create tenant (new) | `./tenant.sh create myco --target jobsyte --name "My Company"` |
| Renew SSL | Automatic (certbot timer). Manual: `sudo certbot renew && sudo systemctl reload nginx` |
