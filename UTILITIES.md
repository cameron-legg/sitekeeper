# Utilities Architecture

SiteKeeper uses a modular "utilities" architecture that allows each tenant to enable or disable feature modules independently. This keeps the app flexible — tenants only see the features they need.

## Concepts

### Core (always on)

Core modules are active for every tenant and cannot be turned off:

- **Auth** — Registration, login, JWT tokens
- **Admin** — User approval and role management
- **Job Sites** — Top-level project containers
- **Jobs** — Work items within a site (status, assignments)
- **Settings** — Profile, business info, document field configuration
- **Tenant middleware** — Database routing, MinIO bucket routing
- **Context** — App mode detection (landing vs tenant)

### Utilities (toggleable per tenant)

Each utility is a self-contained feature module with its own backend (blueprint, service, repository) and frontend (screens, hooks, components):

| ID | Description |
|----|-------------|
| `contacts` | Contact management, attach contacts to sites/jobs |
| `estimates` | Estimates with line items, entries, tax |
| `invoices` | Invoices, status workflow, estimate-to-invoice conversion |
| `notes` | Markdown notes on jobs |
| `time_tracking` | Clock in/out, manual time entry |
| `photos` | Job photos and document photo attachments |
| `pdf` | PDF generation for estimates and invoices |
| `saved_items` | Reusable line item templates (item library) |
| `ai_assistant` | AI chat with tool calling |

### Dependencies

Some utilities depend on others:

- `estimates` requires `pdf` (for PDF generation)
- `invoices` requires `pdf` (for PDF generation)
- `invoices` optionally uses `estimates` (for estimate-to-invoice conversion)
- `ai_assistant` interacts with all other utilities (tools are filtered based on what's enabled)

If you enable `estimates` but disable `pdf`, estimate PDF generation will fail. Ensure dependencies are also enabled.

---

## How Toggling Works

### Backend

1. On each request, the tenant middleware resolves the tenant from the `Host` header and reads its config from `tenants.json`.
2. `g.enabled_utilities` is set to the tenant's utility list (or `None` = all enabled).
3. All utility blueprints are registered at app startup (routes always exist).
4. The `@utility_required("utility_id")` decorator on routes returns HTTP 403 with code `UTILITY_DISABLED` if the utility is off for the current tenant.

### Frontend

1. On boot, the app calls `GET /api/v1/context` which returns the tenant's enabled utilities list.
2. `useEnabledUtilities()` hook provides the list to the app.
3. **RootNavigator** only registers screens from enabled utilities.
4. **JobDetailScreen** only renders tabs from enabled utilities.
5. If a utility is disabled, its screens/tabs/buttons simply don't appear.

### Database

The database schema is identical for all tenants regardless of which utilities are enabled. All tables always exist. Disabling a utility just hides the API routes and UI — the data stays untouched. Re-enabling a utility makes existing data visible again.

---

## Configuring Utilities

### In `backend/tenants.json`

Add a `utilities` key to any tenant entry with an array of enabled utility IDs:

```json
{
  "default": {
    "database_url": "postgresql://sitekeeper:sitekeeper@localhost:5435/sitekeeper",
    "bucket": "sitekeeper",
    "domain": "jobsyte.app",
    "name": "JobSyte (Default)",
    "utilities": [
      "contacts",
      "estimates",
      "invoices",
      "notes",
      "time_tracking",
      "photos",
      "pdf",
      "saved_items",
      "ai_assistant"
    ]
  }
}
```

**Rules:**

- If the `utilities` key is **omitted**, all utilities are enabled (backwards-compatible default).
- If the `utilities` key is present, only the listed utilities are active.
- The key is an array of string IDs matching the table above.

### Local Development

In local dev, requests from `localhost` resolve to the `default` tenant. To test utility toggling:

1. Open `backend/tenants.json`
2. Add a `utilities` array to the `"default"` entry with only the utilities you want active
3. Restart the Flask backend (or it picks up changes on next request since the file is re-read on modification)
4. Refresh the frontend — disabled utilities will disappear from the UI

**Example — disable time tracking and AI:**

```json
{
  "default": {
    "database_url": "postgresql://sitekeeper:sitekeeper@localhost:5434/sitekeeper",
    "bucket": "sitekeeper",
    "domain": "jobsyte.app",
    "name": "JobSyte (Default)",
    "utilities": [
      "contacts",
      "estimates",
      "invoices",
      "notes",
      "photos",
      "pdf",
      "saved_items"
    ]
  }
}
```

**To re-enable all utilities**, either:
- Add all IDs back to the array, or
- Remove the `utilities` key entirely (same effect)

### Testing a Specific Tenant

If you want to test a non-default tenant locally, you can add it to your `/etc/hosts`:

```
127.0.0.1  nocoresources.localhost
```

Then access the app at `http://nocoresources.localhost:8081` (frontend) / port 5000 (backend). The tenant middleware will resolve `nocoresources` from the subdomain and apply that tenant's utility config.

---

## Project Structure

```
backend/app/
├── core/                    # Always-on modules
│   ├── auth/                # JWT auth, decorators
│   ├── blueprints/          # Core API routes (auth, admin, jobs, sites, settings)
│   ├── services/            # Core business logic
│   └── repositories/        # Core data access
├── utilities/               # Toggleable modules
│   ├── __init__.py          # Registry, register_all_utilities()
│   ├── decorators.py        # @utility_required decorator
│   ├── contacts/            # blueprint.py, service.py, repository.py
│   ├── estimates/           # blueprint.py, service.py, repository.py
│   ├── invoices/            # blueprint.py, service.py, conversion_*.py, repository.py
│   ├── notes/               # blueprint.py, service.py, repository.py
│   ├── time_tracking/       # blueprint.py, service.py, repository.py
│   ├── photos/              # blueprint.py, service.py, repository.py
│   ├── pdf/                 # blueprint.py, service.py
│   ├── saved_items/         # blueprint.py, service.py, repository.py
│   └── ai_assistant/        # blueprint.py, service.py
├── models.py                # All SQLAlchemy models (shared, not split)
├── extensions.py            # db, bcrypt
├── config.py                # App config
├── tenant.py                # Multi-tenant middleware + utility gating
└── __init__.py              # App factory

frontend/src/
├── core/                    # Always-on pieces
│   ├── api/                 # client.ts, types.ts, hooks/ (core hooks)
│   ├── navigation/          # RootNavigator, types, navigationRef
│   ├── screens/             # Core screens (Home, JobDetail, Settings, etc.)
│   ├── store/               # Zustand auth store
│   └── config/              # App constants
└── utilities/               # Toggleable modules
    ├── index.ts             # Registry, manifests, useEnabledUtilities()
    ├── contacts/            # screens/, components/, hooks/
    ├── estimates/           # screens/, components/, hooks/
    ├── invoices/            # screens/, components/, hooks/
    ├── notes/               # components/, hooks/
    ├── time_tracking/       # hooks/
    ├── photos/              # components/, hooks/
    ├── pdf/                 # hooks/
    ├── saved_items/         # screens/, hooks/
    └── ai_assistant/        # components/, hooks/
```

---

## Adding a New Utility

### Backend

1. Create `backend/app/utilities/<name>/` with `__init__.py`, `blueprint.py`, `service.py`, `repository.py`
2. Add models to `backend/app/models.py` (or a new migration)
3. Add the `@utility_required("<name>")` decorator to all routes in the blueprint
4. Register the blueprint in `backend/app/utilities/__init__.py` → `register_all_utilities()`
5. Add the utility ID to `ALL_UTILITY_IDS` in `backend/app/utilities/__init__.py`

### Frontend

1. Create `frontend/src/utilities/<name>/` with screens/, components/, hooks/ as needed
2. Add a manifest entry to `ALL_UTILITIES` in `frontend/src/utilities/index.ts`
3. Declare screens, jobDetailTabs, and settingsItems in the manifest

### Enable It

Add the new utility ID to any tenant's `utilities` array in `tenants.json` (or leave the key absent to auto-enable everything).

---

## API Behavior When Disabled

When a utility is disabled for a tenant, its API routes return:

```json
{
  "error": {
    "code": "UTILITY_DISABLED",
    "message": "The '<utility_id>' feature is not enabled for this account."
  }
}
```

HTTP status: **403**

The frontend should never hit these routes because disabled utility UI is not rendered. The 403 is a safety net for direct API calls or stale cached pages.
