# Platform Portal — Implementation Plan

## Overview

Build a self-service tenant management portal that replaces shell-script-based tenant provisioning with a database-driven, API-powered system. Users sign up on the platform, create/manage their tenants, and get provisioned automatically — no SSH, no shell scripts, no manual nginx changes.

---

## Phase 1: Infrastructure Foundation

### 1.1 Nginx Wildcard Migration (Deploy-Time Script)

**Current state on `jobsyteprod`:**

```
/etc/nginx/sites-available/
├── default                    # Ubuntu default (commented out, not enabled)
├── jobsyte.app                # bare domain + www → gunicorn + SPA
├── nocoresources.jobsyte.app  # tenant → same gunicorn + same SPA
├── camtest.jobsyte.app        # tenant → same gunicorn + same SPA
├── tilecraft.jobsyte.app      # tenant → same gunicorn + same SPA
├── demo.jobsyte.app           # tenant → same gunicorn + same SPA

/etc/nginx/sites-enabled/      # symlinks to all except 'default'
```

All tenant configs are **identical** (same SSL cert, same proxy, same SPA root) — only `server_name` differs. The SSL cert is already a wildcard at `/etc/letsencrypt/live/jobsyte.app/`.

**Target state:** Single wildcard config:

```nginx
# /etc/nginx/sites-available/jobsyte.app-wildcard
server {
    listen 80;
    server_name jobsyte.app www.jobsyte.app *.jobsyte.app;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name jobsyte.app www.jobsyte.app *.jobsyte.app;

    ssl_certificate /etc/letsencrypt/live/jobsyte.app/fullchain.pem;
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

**Migration script:** `infra/platform_migrations/001_nginx_wildcard.py`

This script will:
1. Write the wildcard config to `/etc/nginx/sites-available/jobsyte.app-wildcard`
2. Remove symlinks from `/etc/nginx/sites-enabled/` for all per-tenant configs:
   - `jobsyte.app`
   - `nocoresources.jobsyte.app`
   - `camtest.jobsyte.app`
   - `tilecraft.jobsyte.app`
   - `demo.jobsyte.app`
3. Create symlink for the new wildcard config in `/etc/nginx/sites-enabled/`
4. Run `nginx -t` to validate
5. Run `systemctl reload nginx`
6. Archive (don't delete) old configs to `/etc/nginx/sites-available/archived/`

**Important:** This script requires `sudo` — it will be run via SSH during deploy as: `sudo bash infra/platform_migrations/run_nginx.sh` (a thin bash wrapper around the Python logic, or directly as a bash script since it's mostly file operations).

Actually, since this touches nginx (needs sudo, needs to be idempotent, runs on server), it makes more sense as a **standalone bash script** at `infra/migrate_nginx_wildcard.sh` that gets invoked once during the deploy that introduces the platform. The platform_migrations runner (Python) handles the platform DB stuff.

### 1.2 Platform Database (`sk_platform`)

**New database** on the same Postgres instance (port 5435 prod, port 5434 dev).

**Models** (`backend/app/portal/models.py`):

```python
class PlatformUser(platform_db.Model):
    __tablename__ = "platform_users"
    
    id              = Column(UUID, PK, default=uuid4)
    email           = Column(String(255), unique, not null)
    password_hash   = Column(Text, not null)
    name            = Column(String(255), nullable)
    phone           = Column(String(50), nullable)
    stripe_customer_id = Column(String(255), nullable)  # future
    created_at      = Column(Timestamp, default=now)
    updated_at      = Column(Timestamp, default=now, onupdate=now)

class Tenant(platform_db.Model):
    __tablename__ = "tenants"
    
    id              = Column(UUID, PK, default=uuid4)
    slug            = Column(String(50), unique, not null)
    name            = Column(String(255), not null)
    owner_id        = Column(UUID, FK → platform_users.id, nullable)
    status          = Column(String(20), not null, default="active")
                      # active | provisioning | suspended | deleted
    plan            = Column(String(20), default="free")
    database_name   = Column(String(100), not null)     # sk_<slug>
    bucket          = Column(String(100), not null)     # <slug>
    domain          = Column(String(255), not null)     # <slug>.jobsyte.app
    enabled_utilities = Column(JSONB, nullable)         # null = all
    created_at      = Column(Timestamp, default=now)
    deleted_at      = Column(Timestamp, nullable)

class TenantMetrics(platform_db.Model):
    __tablename__ = "tenant_metrics"
    
    id              = Column(UUID, PK, default=uuid4)
    tenant_id       = Column(UUID, FK → tenants.id)
    recorded_at     = Column(Date, not null)
    users_count     = Column(Integer, default=0)
    logins_30d      = Column(Integer, default=0)
    job_sites_count = Column(Integer, default=0)
    jobs_count      = Column(Integer, default=0)
    storage_bytes   = Column(BigInteger, default=0)
    # Unique constraint: (tenant_id, recorded_at)
```

### 1.3 Separate Alembic Environment for Platform

```
backend/
├── alembic.ini                      # existing — tenant schema
├── alembic_platform.ini             # NEW — platform schema
├── migrations/                      # existing — tenant migrations
│   ├── env.py                       # uses DATABASE_URL, imports app.models
│   └── versions/
└── platform_migrations/             # NEW — platform migrations
    ├── env.py                       # uses PLATFORM_DATABASE_URL, imports app.portal.models
    ├── script.py.mako
    └── versions/
        └── 001_initial_platform.py  # creates platform_users, tenants, tenant_metrics
```

**`alembic_platform.ini`:**
```ini
[alembic]
script_location = %(here)s/platform_migrations
prepend_sys_path = .
sqlalchemy.url = driver://user:pass@localhost/dbname
# (overridden by env.py reading PLATFORM_DATABASE_URL)
```

**`platform_migrations/env.py`:**
- Imports `app.portal.models` (only platform models)
- Reads `PLATFORM_DATABASE_URL` from env
- Uses its own `target_metadata` from the platform models
- Completely independent from tenant migrations

### 1.4 New Environment Variables

Add to `backend/.env`:
```
PLATFORM_DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5434/sk_platform
```

Add to production `.env`:
```
PLATFORM_DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5435/sk_platform
```

---

## Phase 2: Shared Auth Abstraction

### 2.1 Current Auth Architecture

The auth code currently lives at `backend/app/core/auth/` with:
- `interface.py` — `IAuthService` ABC, `AuthResult`, `AuthError`
- `email_password.py` — `EmailPasswordAuthService` implements `IAuthService`
- `decorators.py` — `auth_required` decorator

**The problem:** `EmailPasswordAuthService` is tightly coupled to the tenant `User` model (imports `from ...models import User`). The `auth_required` decorator also imports `User` directly and checks `user.is_approved` (a tenant-specific concept).

### 2.2 Shared Auth Design

Move the core auth primitives (JWT issuance, password hashing, token validation) into a shared module that both tenant and portal code can use. Keep the user-loading and business rules (approval checks, role injection) in their respective decorators.

**New structure:**

```
backend/app/
├── shared_auth/                        # NEW — shared primitives
│   ├── __init__.py
│   ├── jwt_service.py                  # issue_token(), validate_token() — no User model dep
│   ├── password.py                     # hash_password(), check_password() — thin wrappers
│   └── errors.py                       # AuthError (reexported)
├── core/
│   └── auth/
│       ├── interface.py                # IAuthService (unchanged)
│       ├── email_password.py           # EmailPasswordAuthService (uses shared_auth internally)
│       └── decorators.py               # auth_required (tenant: loads User, checks is_approved)
└── portal/
    └── auth/
        ├── portal_auth_service.py      # register/login against PlatformUser
        └── decorators.py               # platform_auth_required (loads PlatformUser, no approval check)
```

### 2.3 `shared_auth/jwt_service.py`

Extracted from `EmailPasswordAuthService._issue_token()` and `validate_token()`:

```python
"""Shared JWT operations — used by both tenant auth and portal auth."""

from datetime import datetime, timezone, timedelta
import jwt
from flask import current_app
from .errors import AuthError


def issue_token(subject: str, extra_claims: dict = None) -> str:
    """Issue a signed JWT for the given subject (user ID).
    
    Args:
        subject: The user ID string to encode in the 'sub' claim.
        extra_claims: Optional dict of additional claims (e.g. {"platform": True}).
    """
    secret = current_app.config["JWT_SECRET"]
    expiry_seconds = current_app.config["JWT_EXPIRY_SECONDS"]
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(seconds=expiry_seconds),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, secret, algorithm="HS256")


def validate_token(token: str) -> dict:
    """Decode and validate a JWT. Returns the full payload dict.
    
    Raises:
        AuthError: TOKEN_EXPIRED or TOKEN_INVALID.
    """
    secret = current_app.config["JWT_SECRET"]
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise AuthError("Token has expired.", code="TOKEN_EXPIRED")
    except (jwt.InvalidTokenError, KeyError):
        raise AuthError("Invalid token.", code="TOKEN_INVALID")
```

### 2.4 `shared_auth/password.py`

```python
"""Shared password hashing — used by both tenant and portal auth."""

from ..extensions import bcrypt


def hash_password(password: str) -> str:
    """Hash a password using bcrypt. Returns the hash string."""
    return bcrypt.generate_password_hash(password).decode("utf-8")


def check_password(password: str, password_hash: str) -> bool:
    """Verify a password against a bcrypt hash."""
    return bcrypt.check_password_hash(password_hash, password)
```

### 2.5 How Each Side Uses Shared Auth

**Tenant `EmailPasswordAuthService` (refactored):**
```python
from app.shared_auth.jwt_service import issue_token, validate_token
from app.shared_auth.password import hash_password, check_password

class EmailPasswordAuthService(IAuthService):
    def register(self, email, password):
        # ... same logic but calls hash_password() and issue_token(user_id)
    
    def login(self, email, password):
        # ... same logic but calls check_password() and issue_token(user_id)
    
    def validate_token(self, token):
        payload = validate_token(token)  # shared function
        return payload["sub"]            # return user_id
```

**Portal `PlatformAuthService` (new):**
```python
from app.shared_auth.jwt_service import issue_token, validate_token
from app.shared_auth.password import hash_password, check_password
from app.portal.models import PlatformUser

class PlatformAuthService:
    def register(self, email, password, name=None):
        # Validate email, check uniqueness in platform_users table
        # Hash password, create PlatformUser
        # Issue token with extra_claims={"platform": True}
    
    def login(self, email, password):
        # Look up PlatformUser, verify password
        # Issue token with extra_claims={"platform": True}
    
    def validate_token(self, token):
        payload = validate_token(token)  # shared function
        if not payload.get("platform"):
            raise AuthError("Not a platform token.", code="TOKEN_INVALID")
        return payload["sub"]
```

### 2.6 Decorator Isolation

**Tenant `auth_required`** (existing, minor refactor):
- Extracts Bearer token
- Calls `validate_token()` → gets payload
- Rejects tokens with `platform: True` claim (portal tokens can't access tenant routes)
- Loads `User` from the tenant DB
- Checks `is_approved`
- Sets `g.current_user_id`, `g.current_user_role`, `g.current_user_is_approved`

**Portal `platform_auth_required`** (new):
- Extracts Bearer token
- Calls `validate_token()` → gets payload
- Requires `platform: True` claim (tenant tokens can't access portal routes)
- Loads `PlatformUser` from platform DB
- No approval check (platform users are always active)
- Sets `g.platform_user_id`, `g.platform_user`

This ensures complete token isolation — a tenant user cannot access portal endpoints and vice versa.

---

## Phase 3: Backend — Portal Module

### 3.1 File Structure

```
backend/app/portal/
├── __init__.py
├── models.py                        # PlatformUser, Tenant, TenantMetrics (SQLAlchemy models)
├── platform_db.py                   # Dedicated engine + scoped session for sk_platform
├── auth/
│   ├── __init__.py
│   ├── platform_auth_service.py     # register, login, validate (against PlatformUser)
│   └── decorators.py               # platform_auth_required
├── blueprints/
│   ├── __init__.py
│   ├── portal_auth_bp.py           # POST /signup, POST /login, GET /me
│   └── portal_tenants_bp.py        # CRUD tenants, GET metrics
└── services/
    ├── __init__.py
    ├── provisioning_service.py      # Create DB, run Alembic, create bucket, copy creds
    ├── teardown_service.py          # Soft-delete, archive
    └── metrics_service.py           # Aggregate from tenant DBs
```

### 3.2 Platform DB Connection (`portal/platform_db.py`)

A dedicated SQLAlchemy engine that is NEVER affected by per-request tenant engine swaps:

```python
"""Dedicated connection to the platform database (sk_platform).

This engine is initialized once at app startup and provides a session
factory for portal operations. It is completely independent from the
tenant engine-swap mechanism in tenant.py.
"""

from flask import current_app
from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker

_engine = None
_session_factory = None


def init_platform_db(app):
    """Initialize the platform DB engine. Called once from create_app()."""
    global _engine, _session_factory
    url = app.config["PLATFORM_DATABASE_URL"]
    _engine = create_engine(url, pool_size=3, max_overflow=5, pool_recycle=300)
    _session_factory = scoped_session(sessionmaker(bind=_engine))


def get_platform_session():
    """Get a scoped session bound to the platform database."""
    return _session_factory()


def get_platform_engine():
    """Get the raw platform engine (for Alembic, etc.)."""
    return _engine
```

### 3.3 Portal Auth Endpoints

```
POST /api/v1/portal/auth/signup
    Body: { email, password, name }
    Response: { user_id, token, name }

POST /api/v1/portal/auth/login
    Body: { email, password }
    Response: { user_id, token, name }

GET /api/v1/portal/auth/me
    Headers: Authorization: Bearer <platform-token>
    Response: { id, email, name, created_at }
```

### 3.4 Tenant Management Endpoints

```
GET    /api/v1/portal/tenants
    → List all tenants owned by the current platform user
    Response: [{ id, slug, name, status, domain, plan, created_at }]

POST   /api/v1/portal/tenants
    Body: { slug, name }
    → Validate slug, provision DB + bucket + creds, return tenant
    Response: { id, slug, name, status, domain } (status may be "provisioning" or "active")

GET    /api/v1/portal/tenants/:slug
    → Get tenant details including status
    Response: { id, slug, name, status, domain, plan, created_at, metrics? }

DELETE /api/v1/portal/tenants/:slug
    → Soft-delete (set status="deleted", deleted_at=now)
    Response: { message: "Tenant deleted" }

GET    /api/v1/portal/tenants/:slug/metrics
    → Get usage metrics (latest from TenantMetrics table)
    Response: { users_count, logins_30d, job_sites_count, jobs_count, storage_bytes }
```

### 3.5 Provisioning Service (Pure Python, No Shell)

```python
class ProvisioningService:
    """Handles the full lifecycle of tenant creation — no shell commands."""

    def create_tenant(self, slug: str, name: str, owner: PlatformUser) -> Tenant:
        """
        Steps:
        1. Validate slug:
           - Regex: ^[a-z][a-z0-9-]{2,30}[a-z0-9]$
           - Not in RESERVED_SLUGS
           - Not already taken in platform DB
        
        2. Create PostgreSQL database:
           - psycopg2 connect to admin DB (postgres)
           - CREATE DATABASE sk_<slug>
        
        3. Run Alembic migrations on new DB:
           - alembic.config.Config("alembic.ini")
           - Override sqlalchemy.url to point at new DB
           - alembic.command.upgrade(config, "head")
        
        4. Create admin user in tenant DB:
           - Connect to sk_<slug>
           - INSERT into users: email=owner.email, password_hash=owner.password_hash,
             role='admin', is_approved=True
           - This copies credentials from PlatformUser → tenant User
        
        5. Create MinIO bucket:
           - minio.make_bucket(slug)
        
        6. Register tenant in platform DB:
           - INSERT into tenants: slug, name, owner_id, database_name, bucket, domain, status='active'
        
        7. Clear tenant cache in tenant.py middleware
        
        Return the Tenant object.
        """

    def delete_tenant(self, tenant: Tenant) -> None:
        """
        1. Set tenant.status = "deleted"
        2. Set tenant.deleted_at = now()
        3. Clear tenant cache
        
        The database and bucket remain for the retention period.
        A future cleanup job can drop them after 30 days.
        """
```

### 3.6 Tenant Middleware Update (`tenant.py`)

Replace `tenants.json` reading with platform DB queries:

```python
# Key changes:

# 1. Add a cached lookup function that queries sk_platform
_tenant_cache: dict = {}   # slug → config dict
_cache_updated_at: float = 0
CACHE_TTL_SECONDS = 60

def _load_tenants_from_platform() -> dict:
    """Query all active tenants from the platform database.
    
    Returns a dict in the same format as the old tenants.json:
    { slug: { database_url, bucket, domain, name, utilities } }
    """
    global _tenant_cache, _cache_updated_at
    now = time.time()
    if _tenant_cache and (now - _cache_updated_at) < CACHE_TTL_SECONDS:
        return _tenant_cache
    
    from app.portal.platform_db import get_platform_session
    from app.portal.models import Tenant
    
    session = get_platform_session()
    try:
        tenants = session.query(Tenant).filter_by(status="active").all()
        _tenant_cache = {}
        for t in tenants:
            _tenant_cache[t.slug] = {
                "database_url": f"{BASE_DATABASE_URL}/{t.database_name}",
                "bucket": t.bucket,
                "domain": t.domain,
                "name": t.name,
                "utilities": t.enabled_utilities,
            }
        _cache_updated_at = now
    finally:
        session.close()
    
    return _tenant_cache

def invalidate_tenant_cache():
    """Called by ProvisioningService after creating/deleting a tenant."""
    global _tenant_cache, _cache_updated_at
    _tenant_cache = {}
    _cache_updated_at = 0

# 2. Replace _load_tenants() calls with _load_tenants_from_platform()
# 3. Keep default tenant handling the same (uses app's configured DATABASE_URL)
```

### 3.7 Context Endpoint Update

Add `mode: "portal"` to the context response:

```python
@context_bp.get("/context")
def get_context():
    slug = getattr(g, "tenant_slug", None) or resolve_tenant_slug()
    default_tenant = current_app.config.get("DEFAULT_TENANT", "default")
    landing_mode = current_app.config.get("LANDING_MODE", False)

    if slug == default_tenant and landing_mode:
        # Check if there's a valid platform token in the request
        # If yes → mode: "portal" (user is logged into the platform)
        # If no → mode: "landing" (public landing page)
        token = _extract_token_from_request()
        if token and _is_valid_platform_token(token):
            return jsonify({"mode": "portal"})
        return jsonify({"mode": "landing"})

    config = get_tenant_config(slug) or {}
    return jsonify({
        "mode": "tenant",
        "tenant_slug": slug,
        "tenant_name": config.get("name", slug),
        "utilities": config.get("utilities"),
    })
```

### 3.8 Blueprint Registration in App Factory

```python
# In create_app():

# Initialize platform DB connection
from .portal.platform_db import init_platform_db
init_platform_db(app)

# Register portal blueprints
from .portal.blueprints.portal_auth_bp import portal_auth_bp
from .portal.blueprints.portal_tenants_bp import portal_tenants_bp
app.register_blueprint(portal_auth_bp, url_prefix="/api/v1/portal")
app.register_blueprint(portal_tenants_bp, url_prefix="/api/v1/portal")
```

---

## Phase 4: Frontend — Portal UI

### 4.1 File Structure

```
frontend/src/portal/
├── screens/
│   ├── PortalSignupScreen.tsx
│   ├── PortalLoginScreen.tsx
│   ├── PortalDashboardScreen.tsx    # list tenants + create button
│   ├── CreateTenantScreen.tsx       # slug input + name + validation
│   └── TenantDetailScreen.tsx       # metrics, status, delete button
├── api/
│   └── hooks/
│       ├── usePortalAuth.ts         # signup, login, me mutations
│       └── usePortalTenants.ts      # list, create, delete, metrics queries
├── store/
│   └── portalAuthStore.ts           # Zustand: platformToken, platformUser
└── navigation/
    └── PortalStack.tsx              # Stack navigator for portal screens
```

### 4.2 Navigation Integration

In `RootNavigator.tsx`, add portal routing:

```tsx
// Pseudocode:
const { mode } = useContext();  // from GET /api/v1/context
const platformToken = usePortalAuthStore(s => s.token);
const tenantToken = useAuthStore(s => s.token);

if (mode === "landing" && !platformToken) → LandingScreen (existing)
if (mode === "landing" && platformToken) → PortalStack
if (mode === "portal") → PortalStack
if (mode === "tenant" && tenantToken) → AppStack (existing)
if (mode === "tenant" && !tenantToken) → AuthStack (existing)
```

### 4.3 Portal Auth Store (`portalAuthStore.ts`)

```typescript
interface PortalAuthState {
  token: string | null;
  userId: string | null;
  name: string | null;
  setAuth: (token: string, userId: string, name: string) => void;
  clearAuth: () => void;
}
```

Stored separately from the tenant auth store. Uses AsyncStorage with a different key prefix (e.g. `@portal_token`).

### 4.4 User Flow

1. `jobsyte.app` → Landing page (existing)
2. "Get Started" button → `PortalSignupScreen`
3. After signup → `PortalDashboardScreen` (empty state: "Create your first organization")
4. "Create Organization" → `CreateTenantScreen`
   - Slug input (live validation: regex + availability check)
   - Name input
   - Submit → shows provisioning spinner
5. On success → redirect to `<slug>.jobsyte.app/login`
   - User can log in immediately (same email/password)
6. Dashboard also shows existing tenants with:
   - Status badge (active/provisioning/suspended)
   - "Open" button → redirect to tenant subdomain
   - "Metrics" button → `TenantDetailScreen`
   - "Delete" button → confirmation → soft delete

---

## Phase 5: Data Migration — tenants.json → Platform DB

### 5.1 Infrastructure Migration Runner

Following the exact same pattern as `infra/storage_migrations/runner.py`:

```
infra/platform_migrations/
├── __init__.py
├── runner.py                            # discovers + runs numbered scripts
├── platform_migrations_applied.json     # state file (server-side, git-ignored)
├── 001_create_platform_db.py            # CREATE DATABASE sk_platform + run alembic
├── 002_seed_tenants_from_json.py        # read tenants.json → INSERT into tenants table
└── 003_nginx_wildcard.sh                # replace per-tenant nginx with wildcard (bash)
```

### 5.2 Migration 001: Create Platform Database

```python
def upgrade():
    """
    1. Connect to postgres admin DB
    2. CREATE DATABASE sk_platform (if not exists)
    3. Run: alembic -c alembic_platform.ini upgrade head
    """
```

### 5.3 Migration 002: Seed Tenants from JSON

```python
def upgrade():
    """
    1. Read backend/tenants.json
    2. For each tenant, INSERT into sk_platform.tenants:
       - slug, name, database_name (sk_<slug>), bucket, domain
       - owner_id = NULL (legacy tenants, no platform user yet)
       - status = "active"
    3. Skip if tenants already exist in platform DB (idempotent)
    """
```

This preserves all existing tenants. They work immediately after migration.

### 5.4 Migration 003: Nginx Wildcard

A bash script (since it needs sudo and system-level operations):

```bash
#!/usr/bin/env bash
# infra/platform_migrations/003_nginx_wildcard.sh
#
# Replaces per-tenant nginx configs with a single wildcard.
# Idempotent — checks if wildcard already exists before acting.

set -euo pipefail

WILDCARD_CONF="/etc/nginx/sites-available/jobsyte.app-wildcard"

# Already done?
if [[ -f "$WILDCARD_CONF" ]]; then
    echo "Wildcard config already exists — skipping."
    exit 0
fi

# Archive old configs
mkdir -p /etc/nginx/sites-available/archived
for conf in jobsyte.app nocoresources.jobsyte.app camtest.jobsyte.app tilecraft.jobsyte.app demo.jobsyte.app; do
    if [[ -f "/etc/nginx/sites-available/$conf" ]]; then
        mv "/etc/nginx/sites-available/$conf" "/etc/nginx/sites-available/archived/$conf"
    fi
    rm -f "/etc/nginx/sites-enabled/$conf"
done

# Write wildcard config
cat > "$WILDCARD_CONF" << 'NGINX'
server {
    listen 80;
    server_name jobsyte.app www.jobsyte.app *.jobsyte.app;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name jobsyte.app www.jobsyte.app *.jobsyte.app;

    ssl_certificate /etc/letsencrypt/live/jobsyte.app/fullchain.pem;
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
NGINX

# Enable
ln -sf "$WILDCARD_CONF" /etc/nginx/sites-enabled/jobsyte.app-wildcard

# Test + reload
nginx -t && systemctl reload nginx
echo "Wildcard nginx config installed successfully."
```

### 5.5 Transition Strategy

The migration runner is integrated into `deploy.sh`:

```bash
# In deploy_backend():
info "  Running platform infrastructure migrations..."
ssh "$SSH_HOST" "
    sudo -u sitekeeper bash -c '
        cd $APP_DIR &&
        set -a && source backend/.env && set +a &&
        backend/venv/bin/python infra/platform_migrations/runner.py 2>&1
    '
"

# The nginx migration needs sudo, so it's run separately:
info "  Running nginx migration (if needed)..."
ssh "$SSH_HOST" "
    sudo bash $APP_DIR/infra/platform_migrations/003_nginx_wildcard.sh 2>&1
" || true
```

---

## Phase 6: Deploy Script Updates

### 6.1 Updated `deploy_backend()` Flow

```bash
deploy_backend() {
    # 1. Git pull (existing)
    # 2. Docker up (existing)
    # 3. Pip install (existing)
    
    # 4. NEW: Run platform DB migrations (Alembic for sk_platform)
    info "  Running platform database migrations..."
    ssh "$SSH_HOST" "
        sudo -u sitekeeper bash -c '
            cd $APP_DIR/backend &&
            set -a && source .env && set +a &&
            PLATFORM_DATABASE_URL=\$PLATFORM_DATABASE_URL \
            $APP_DIR/backend/venv/bin/alembic -c alembic_platform.ini upgrade head 2>&1
        '
    "
    
    # 5. NEW: Run platform infrastructure migrations (runner.py)
    info "  Running platform infrastructure migrations..."
    ssh "$SSH_HOST" "
        sudo -u sitekeeper bash -c '
            cd $APP_DIR &&
            set -a && source backend/.env && set +a &&
            backend/venv/bin/python infra/platform_migrations/runner.py 2>&1
        '
    "
    
    # 6. CHANGED: Read tenant DB URLs from platform DB instead of tenants.json
    info "  Running tenant database migrations (all active tenants)..."
    ssh "$SSH_HOST" "
        sudo -u sitekeeper bash -c '
            cd $APP_DIR/backend &&
            set -a && source .env && set +a &&
            for db_url in \$(venv/bin/python -c \"
import sys; sys.path.insert(0, \\\".\\\")
from app.portal.platform_db import get_platform_engine
from app.portal.models import Tenant
from sqlalchemy.orm import Session
from app import create_app
app = create_app({\\\"TESTING\\\": True})
with app.app_context():
    from app.portal.platform_db import get_platform_session
    session = get_platform_session()
    for t in session.query(Tenant).filter(Tenant.status==\\\"active\\\").all():
        print(f\\\"postgresql://sitekeeper:sitekeeper@localhost:5435/{t.database_name}\\\")
    session.close()
\"); do
                echo \"  Migrating: \$db_url\"
                DATABASE_URL=\"\$db_url\" $APP_DIR/backend/venv/bin/alembic upgrade head 2>&1
            done
        '
    "
    
    # 7. MinIO buckets (existing)
    # 8. Storage migrations (existing)
    
    # 9. NEW: Nginx wildcard migration (needs sudo)
    info "  Ensuring nginx wildcard config..."
    ssh "$SSH_HOST" "
        sudo bash $APP_DIR/infra/platform_migrations/003_nginx_wildcard.sh 2>&1
    " || true
    
    # 10. Restart API (existing)
}
```

### 6.2 CORS Simplification

After migration, replace static `CORS_ORIGINS` with dynamic resolution:

```python
# In create_app():
# Instead of reading a comma-separated string, derive origins from platform DB
# Or simpler: use a regex origin pattern matching *.jobsyte.app

from flask_cors import CORS
CORS(app, origins=[r"https://.*\.jobsyte\.app", "https://jobsyte.app", "https://www.jobsyte.app"],
     supports_credentials=True)
```

This eliminates the need to update `.env` CORS on every new tenant.

---

## Phase 7: Cleanup & Deprecation

### 7.1 Files to Remove (after migration is stable and verified)

| File | Replaced by |
|------|-------------|
| `backend/tenants.json` | `sk_platform.tenants` table |
| `backend/manage_tenant.py` | `ProvisioningService` |
| `tenant.sh` | Portal API + `ProvisioningService` |
| `infra/add-tenant-nginx.sh` | Wildcard nginx (no per-tenant config needed) |
| Per-tenant nginx configs on server | Archived to `/etc/nginx/sites-available/archived/` |

### 7.2 Files to Update

| File | Change |
|------|--------|
| `backend/app/tenant.py` | Query platform DB instead of JSON |
| `backend/app/config.py` | Add `PLATFORM_DATABASE_URL` |
| `backend/app/__init__.py` | Init platform DB, register portal blueprints |
| `backend/app/core/auth/email_password.py` | Use `shared_auth` internally |
| `backend/app/core/auth/decorators.py` | Reject platform tokens, use shared JWT validation |
| `frontend/src/navigation/RootNavigator.tsx` | Add portal routing logic |
| `deploy.sh` | Read tenant list from platform DB, add platform migration steps |
| `infra/backup-db.sh` | Include `sk_platform` in backups |
| `.env.example` | Document `PLATFORM_DATABASE_URL` |
| `docker-compose.yml` | (No changes needed — same Postgres instance) |

---

## Phase 8: Additional Recommendations

### 8.1 Slug Reservation

```python
RESERVED_SLUGS = {
    "www", "api", "portal", "admin", "app", "mail", "ftp",
    "static", "assets", "cdn", "docs", "help", "support",
    "billing", "status", "blog", "demo", "test", "staging",
    "default", "platform", "system",
}
```

### 8.2 Rate Limiting

- Max 3 tenants per platform user (configurable)
- Max 1 tenant creation per 10 minutes per user
- Max 5 signup attempts per IP per hour

### 8.3 Metrics Collection (Nightly Cron)

`infra/collect_metrics.py` — runs as a systemd timer daily:

```python
"""For each active tenant, query their DB and write a TenantMetrics row."""
# Count users, job_sites, jobs
# Check MinIO bucket size
# Write to sk_platform.tenant_metrics
```

### 8.4 Tenant "Claiming" for Legacy Tenants

Legacy tenants (seeded from JSON) have `owner_id = NULL`. When a platform user signs up with the same email as an existing tenant admin, offer them the option to "claim" that tenant (link it to their platform account).

### 8.5 Health Endpoint for Tenants

The portal dashboard can show a green/red dot per tenant:
- Hit `GET /api/v1/health` on each tenant's domain
- Or query the tenant DB directly from the platform backend

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Shell injection | Zero shell execution — all provisioning is pure Python (psycopg2, alembic SDK, minio SDK) |
| Token confusion | Platform tokens have `platform: true` claim; tenant decorator rejects them; portal decorator requires them |
| Slug injection | Strict regex validation + reserved word list + uniqueness check against DB |
| Resource exhaustion | Rate limits on signup + tenant creation; max tenants per user |
| Cross-tenant data access | Engine swap per-request (unchanged); platform DB is separate connection |
| Credential security | Password hashes copied (never plaintext); shared hashing ensures compatibility |
| DB credential isolation | Same Postgres role (acceptable for single-server); future: per-tenant roles |
| Soft delete | Tenants are never hard-deleted immediately; retention period before cleanup |

---

## Implementation Order

| Step | Description | Dependencies | Risk |
|------|-------------|--------------|------|
| 1 | Create `shared_auth/` module (extract JWT + password primitives) | None | Low — pure refactor |
| 2 | Refactor existing auth to use `shared_auth/` | Step 1 | Low — behavior unchanged |
| 3 | Create `sk_platform` DB + `alembic_platform.ini` + platform models | None | Low — additive |
| 4 | Build `portal/platform_db.py` (dedicated engine) | Step 3 | Low — additive |
| 5 | Build `portal/auth/` (PlatformAuthService + decorator) | Steps 1, 4 | Low — new code |
| 6 | Build portal blueprints (auth + tenants) | Steps 4, 5 | Low — new code |
| 7 | Build `ProvisioningService` | Steps 4, 6 | Medium — creates real DBs |
| 8 | Build infrastructure migration runner + scripts (001, 002, 003) | Steps 3, 7 | Medium — touches server |
| 9 | Update `tenant.py` to read from platform DB (with JSON fallback) | Steps 4, 8 | Medium — core middleware |
| 10 | Update `deploy.sh` | Steps 8, 9 | Low — script change |
| 11 | Build frontend portal screens + navigation | Steps 5, 6 | Low — new code |
| 12 | Deploy to production (runs migrations, applies nginx wildcard) | All above | Medium — coordinated |
| 13 | Verify all tenants work, remove JSON fallback | Step 12 | Low — cleanup |
| 14 | Remove legacy files (tenants.json, tenant.sh, manage_tenant.py) | Step 13 | Low — cleanup |

---

## Local Development Notes

- Dev uses port 5434 (not 5435 like prod)
- `sk_platform` DB needs to be created locally: `createdb -p 5434 -U sitekeeper sk_platform`
- Or add it to docker-compose.yml init (Postgres creates `sitekeeper` by default; add a script to create `sk_platform` on first boot)
- Platform migrations run with: `cd backend && DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5434/sk_platform venv/bin/alembic -c alembic_platform.ini upgrade head`
- Tenant middleware in dev with no `sk_platform` DB yet: falls back to `tenants.json` (transition behavior)
