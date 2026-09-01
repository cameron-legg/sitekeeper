# Platform Portal & Superadmin

## Self-Service Tenant Creation

Users can create their own tenant (organization) through the platform portal at the bare domain (`jobsyte.app`).

### User Flow

1. Visit `jobsyte.app`
2. Click "Get Started" on the landing page
3. Create a platform account (email + password + name)
4. After login, the portal dashboard appears
5. Click "Create Organization"
6. Enter a slug (URL identifier, e.g. `my-company`) and a display name
7. The system provisions the tenant automatically:
   - Creates a new PostgreSQL database (`sk_<slug>`)
   - Runs all schema migrations
   - Creates an admin user in the tenant DB (using the same email/password)
   - Creates a MinIO storage bucket
   - Registers the tenant in the platform database
8. Once complete, the user can click "Open" to visit `<slug>.jobsyte.app` and log in with the same credentials

### Slug Rules

- Must be 4-32 characters
- Lowercase letters, numbers, and hyphens only
- Must start with a letter
- Cannot use reserved words (www, api, portal, admin, app, etc.)
- Must be unique across all tenants

### Limits

- Maximum 5 tenants per platform user
- Provisioning takes a few seconds (runs synchronously)

### Tenant Deletion

Users can soft-delete their tenants from the portal dashboard. Deleted tenants:
- Immediately stop resolving (requests to that subdomain get an unknown tenant warning)
- Retain their database and bucket for a grace period
- Cannot be re-created with the same slug until fully purged

### Platform Credentials vs Tenant Credentials

The platform account and tenant account start with the same email/password (credentials are copied at provisioning time). After that, they are independent — changing your password on the platform doesn't change it on the tenant, and vice versa.

---

## Superadmin Panel

The superadmin panel is a hidden system administration page for managing all tenants across the platform.

### Access

Navigate directly to `jobsyte.app/admin` (not linked from anywhere in the UI).

- **Username:** `superadmin`
- **Password:** Set via the `SUPERADMIN_PASSWORD` environment variable on the server

### Setting the Password

On the production server:

```bash
ssh jobsyteprod "sudo -u sitekeeper bash -c 'echo \"SUPERADMIN_PASSWORD=your-password-here\" >> /home/sitekeeper/app/backend/.env'"
ssh jobsyteprod "sudo systemctl restart sitekeeperapi"
```

To rotate the password, update the value in `.env` and restart the API.

### Features

#### Tenant Metrics Table

Click "Fetch Metrics" to query all tenant databases on demand. The table shows:

| Column | Description |
|--------|-------------|
| Tenant | Display name |
| Admin Email | First admin user's email |
| Users | Total registered users on the tenant |
| Invoices | Total invoices created |
| Estimates | Total estimates created |
| Sites | Total job sites |
| Jobs | Total jobs |
| Paid Total | Sum of all paid invoice line item costs |
| Logins | Total user count (login tracking not yet implemented) |
| DB (MB) | PostgreSQL database size |
| Files (MB) | MinIO bucket size (all stored files) |

Metrics are only fetched when you click the button — no background polling.

#### Tenant Impersonation

Each tenant row has a "Login" button. Clicking it:

1. Generates a valid tenant JWT for that tenant's admin user
2. Opens the tenant app in a new browser tab
3. Automatically authenticates you as that tenant's admin

This lets you view any tenant's environment without needing their password or being a registered user on that tenant. The token is a standard tenant JWT — indistinguishable from a normal login.

### Security

- The superadmin panel is protected by a single shared password stored as an environment variable
- Superadmin JWTs include a `superadmin: true` claim and cannot be used to access tenant or portal routes
- Impersonation generates a regular tenant token (no special claims) — it works because the user already exists in the tenant DB
- The `/admin` path is not discoverable through the UI — you must know to navigate there directly

### API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/v1/superadmin/login` | None (validates password) | Returns a superadmin JWT |
| `GET /api/v1/superadmin/tenants` | Superadmin JWT | Returns all tenants with live metrics |
| `POST /api/v1/superadmin/impersonate` | Superadmin JWT | Returns a tenant JWT for the specified slug |
