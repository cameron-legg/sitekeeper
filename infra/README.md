# SiteKeeper — Multi-Tenant Infrastructure

Each client (business) gets a fully isolated environment:
- Their own subdomain: `<client>.entouch.org`
- Their own Docker Compose stack (backend, frontend, database, minio)
- Completely separate data — no cross-client access

## Directory layout on the server

```
/home/sitekeeper/
├── app/                    # This repo (source code)
├── tenants/
│   ├── nocoresources/      # One directory per client
│   │   ├── .env            # Client-specific env vars
│   │   └── docker-compose.yml  (generated from template)
│   ├── anotherclient/
│   │   ├── .env
│   │   └── docker-compose.yml
│   └── ...
└── nginx/
    └── conf.d/
        ├── nocoresources.conf  # Auto-generated per-client nginx config
        └── anotherclient.conf
```

## Quick start

### Add a new client
```bash
./infra/manage-tenant.sh create nocoresources
```
This will:
1. Create the tenant directory with `.env` and `docker-compose.yml`
2. Build and start the containers
3. Run database migrations
4. Generate the nginx config
5. Obtain an SSL certificate via certbot
6. Reload nginx

### Remove a client
```bash
./infra/manage-tenant.sh destroy nocoresources
```

### Deploy updates to all tenants
```bash
./infra/deploy-all.sh
```

### Deploy updates to a single tenant
```bash
./infra/deploy-tenant.sh nocoresources
```

## Port allocation

Each tenant gets a unique port range. The management script auto-assigns:
- API port: 6000 + (tenant_index * 10)
- DB port: 6001 + (tenant_index * 10)
- MinIO port: 6002 + (tenant_index * 10)
- MinIO console: 6003 + (tenant_index * 10)

## Adding the Dockerfile (backend)

The backend Dockerfile packages the Flask app with gunicorn. The frontend
is built locally (or in CI) and served as static files by the per-tenant
nginx sidecar.
