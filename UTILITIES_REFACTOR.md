# Utilities Architecture — Refactor Plan

## Overview

This document describes the plan to reorganize SiteKeeper into a modular "utilities" architecture where each feature module can be independently enabled or disabled per tenant.

## Goals

1. **Per-tenant feature toggling** — Each tenant configures which utilities are active. Disabled utilities return errors on backend and are invisible on frontend.
2. **Additive development** — New utilities are added as new folders without modifying core files.
3. **Clean separation** — Each utility is self-contained: its models, service, repository, blueprint, screens, hooks, and components all live together.
4. **Zero behavior change** — This is a structural refactor. All existing functionality continues to work identically for tenants with all utilities enabled.

---

## Architecture

### Core (always on, every tenant)

| Concern | What's included |
|---------|----------------|
| Auth | Registration, login, JWT, `auth_required` decorator |
| Admin | User approval, role management |
| Tenant | Multi-tenant middleware, DB routing, MinIO bucket routing |
| Job Sites | CRUD job sites (the top-level container) |
| Jobs | CRUD jobs within sites, status workflow, employee assignment |
| Settings | Profile, business info, document settings/numbering |
| Context | App mode detection endpoint (landing vs tenant) |
| Infrastructure | Extensions (db, bcrypt), config, MinIO client, helpers |

### Utilities (toggleable per tenant)

| ID | Description | Depends on |
|----|-------------|-----------|
| `contacts` | Contact management, attach to sites/jobs | — |
| `estimates` | Estimates with line items and entries | `pdf` |
| `invoices` | Invoices, status workflow, estimate conversion | `pdf`, optionally `estimates` for conversion |
| `notes` | Markdown notes on jobs | — |
| `time_tracking` | Clock in/out, manual time entries | — |
| `photos` | Job photos, document photos (MinIO) | — |
| `pdf` | PDF generation for estimates/invoices | — |
| `saved_items` | Reusable line item templates (library) | — |
| `ai_assistant` | AI chat with tool calling | all others (reads from enabled utilities) |


---

## Folder Structure

### Backend

```
backend/
├── app/
│   ├── __init__.py                    # create_app factory (loads core + utilities)
│   ├── config.py                      # App configuration
│   ├── extensions.py                  # db, bcrypt instances
│   ├── tenant.py                      # Multi-tenant middleware + utility gating
│   ├── minio_client.py                # MinIO storage
│   │
│   ├── core/                          # Always-on modules
│   │   ├── __init__.py
│   │   ├── auth/                      # Auth module (unchanged)
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   └── decorators.py          # auth_required, admin_required
│   │   ├── models.py                  # Core models: User, JobSite, Job, + association tables
│   │   ├── blueprints/
│   │   │   ├── __init__.py
│   │   │   ├── helpers.py             # error_response, not_found, server_error
│   │   │   ├── auth_bp.py
│   │   │   ├── admin_bp.py
│   │   │   ├── job_sites_bp.py
│   │   │   ├── jobs_bp.py
│   │   │   ├── profile_bp.py
│   │   │   ├── business_info_bp.py
│   │   │   ├── document_settings_bp.py
│   │   │   └── context_bp.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── job_site_service.py
│   │   │   ├── job_service.py
│   │   │   ├── profile_service.py
│   │   │   ├── business_info_service.py
│   │   │   └── document_settings_service.py
│   │   └── repositories/
│   │       ├── __init__.py
│   │       ├── job_site_repo.py
│   │       ├── job_repo.py
│   │       ├── profile_repo.py
│   │       └── business_info_repo.py
│   │
│   └── utilities/                     # Toggleable modules
│       ├── __init__.py                # Registry: ALL_UTILITIES, register_all(), get_enabled()
│       ├── decorators.py              # @utility_required("utility_id") decorator
│       │
│       ├── contacts/
│       │   ├── __init__.py            # UTILITY_ID, register(app), DEPENDENCIES
│       │   ├── models.py             # Contact model, job_site_contacts, job_contacts tables
│       │   ├── blueprint.py
│       │   ├── service.py
│       │   └── repository.py
│       │
│       ├── estimates/
│       │   ├── __init__.py
│       │   ├── models.py             # Estimate, LineItem, LineItemEntry
│       │   ├── blueprint.py
│       │   ├── service.py
│       │   └── repository.py
│       │
│       ├── invoices/
│       │   ├── __init__.py
│       │   ├── models.py             # Invoice, InvoiceStatusHistory (reuses LineItem/Entry)
│       │   ├── blueprint.py          # Includes conversion endpoints
│       │   ├── service.py            # Includes conversion logic
│       │   └── repository.py
│       │
│       ├── notes/
│       │   ├── __init__.py
│       │   ├── models.py             # Note
│       │   ├── blueprint.py
│       │   ├── service.py
│       │   └── repository.py
│       │
│       ├── time_tracking/
│       │   ├── __init__.py
│       │   ├── models.py             # TimeEntry
│       │   ├── blueprint.py
│       │   ├── service.py
│       │   └── repository.py
│       │
│       ├── photos/
│       │   ├── __init__.py
│       │   ├── models.py             # JobPhoto, DocumentPhoto
│       │   ├── blueprint.py
│       │   ├── service.py
│       │   └── repository.py
│       │
│       ├── pdf/
│       │   ├── __init__.py
│       │   ├── blueprint.py
│       │   └── service.py
│       │
│       ├── saved_items/
│       │   ├── __init__.py
│       │   ├── models.py             # SavedItem, SavedItemEntry
│       │   ├── blueprint.py
│       │   ├── service.py
│       │   └── repository.py
│       │
│       └── ai_assistant/
│           ├── __init__.py
│           ├── blueprint.py
│           └── service.py
```


### Frontend

```
frontend/src/
├── core/                              # Always-on pieces
│   ├── api/
│   │   ├── client.ts                  # Axios instance
│   │   └── types.ts                   # Shared type definitions
│   ├── navigation/
│   │   ├── RootNavigator.tsx          # Dynamic screen registration from utilities
│   │   ├── types.ts                   # Core screen param types
│   │   └── navigationRef.ts
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── RegisterScreen.tsx
│   │   └── app/
│   │       ├── HomeScreen.tsx         # Renders utility-contributed sections
│   │       ├── SettingsScreen.tsx     # Renders utility-contributed settings items
│   │       ├── ProfileSettingsScreen.tsx
│   │       ├── BusinessInfoScreen.tsx
│   │       ├── JobSiteDetailScreen.tsx
│   │       ├── JobDetailScreen.tsx    # Renders utility-contributed tabs
│   │       └── AdminUsersScreen.tsx
│   ├── store/
│   │   └── authStore.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useAdmin.ts
│   │   ├── useProfile.ts
│   │   ├── useBusinessInfo.ts
│   │   ├── useDocumentSettings.ts
│   │   ├── useAppContext.ts
│   │   ├── useJobSites.ts
│   │   └── useJobs.ts
│   └── config/
│       └── app.ts
│
├── utilities/                         # Toggleable modules
│   ├── index.ts                       # Registry + useEnabledUtilities() hook
│   │
│   ├── contacts/
│   │   ├── index.ts                   # Utility manifest
│   │   ├── screens/
│   │   │   └── ContactEditorScreen.tsx
│   │   ├── components/
│   │   │   └── ContactsTab.tsx
│   │   └── hooks/
│   │       └── useContacts.ts
│   │
│   ├── estimates/
│   │   ├── index.ts
│   │   ├── screens/
│   │   │   ├── EstimateEditorScreen.tsx
│   │   │   ├── EstimateSettingsScreen.tsx
│   │   │   └── EditEstimateOptionsScreen.tsx
│   │   ├── components/
│   │   │   ├── EstimatesTab.tsx
│   │   │   ├── LineItemEditor.tsx
│   │   │   └── LineItemFormModal.tsx
│   │   └── hooks/
│   │       └── useEstimates.ts
│   │
│   ├── invoices/
│   │   ├── index.ts
│   │   ├── screens/
│   │   │   ├── InvoiceEditorScreen.tsx
│   │   │   ├── InvoiceManagementScreen.tsx
│   │   │   ├── InvoiceSettingsScreen.tsx
│   │   │   └── EditInvoiceOptionsScreen.tsx
│   │   ├── components/
│   │   │   └── InvoicesTab.tsx
│   │   └── hooks/
│   │       └── useInvoices.ts
│   │
│   ├── notes/
│   │   ├── index.ts
│   │   ├── components/
│   │   │   ├── NotesTab.tsx
│   │   │   └── MarkdownEditor.tsx
│   │   └── hooks/
│   │       └── useNotes.ts
│   │
│   ├── time_tracking/
│   │   ├── index.ts
│   │   ├── components/
│   │   │   └── TimeTrackingSection.tsx  # Clock in/out UI (shown on JobDetail)
│   │   └── hooks/
│   │       └── useTimeEntries.ts
│   │
│   ├── photos/
│   │   ├── index.ts
│   │   ├── components/
│   │   │   ├── MediaTab.tsx
│   │   │   └── DocumentPhotoPicker.tsx
│   │   └── hooks/
│   │       └── usePhotos.ts
│   │
│   ├── pdf/
│   │   ├── index.ts
│   │   └── hooks/
│   │       └── usePdf.ts
│   │
│   ├── saved_items/
│   │   ├── index.ts
│   │   ├── screens/
│   │   │   ├── SavedItemsScreen.tsx
│   │   │   ├── SavedItemEditorScreen.tsx
│   │   │   └── MaterialsLibraryScreen.tsx
│   │   └── hooks/
│   │       └── useSavedItems.ts
│   │
│   └── ai_assistant/
│       ├── index.ts
│       ├── components/
│       │   ├── AIChatBubble.tsx
│       │   └── AIProvider.tsx
│       └── hooks/
│           └── useAI.ts
│
├── App.tsx
└── ...
```


---

## Toggle Mechanism

### Tenant Configuration

`tenants.json` gets a new `utilities` key per tenant:

```json
{
  "default": {
    "database_url": "postgresql://...",
    "bucket": "sitekeeper",
    "domain": "jobsyte.app",
    "name": "JobSyte (Default)",
    "utilities": [
      "contacts", "estimates", "invoices", "notes",
      "time_tracking", "photos", "pdf", "saved_items", "ai_assistant"
    ]
  },
  "nocoresources": {
    "database_url": "postgresql://...",
    "bucket": "nocoresources",
    "domain": "nocoresources.jobsyte.app",
    "name": "NoCo Resources",
    "utilities": [
      "contacts", "estimates", "invoices", "notes",
      "photos", "pdf", "saved_items"
    ]
  }
}
```

If the `utilities` key is **omitted**, all utilities are enabled (backwards-compatible default).

### Backend Gating

All utility blueprints are registered at app startup (so Flask knows the routes exist). The toggle happens per-request:

1. **Tenant middleware** (`tenant.py`) resolves the tenant and sets `g.enabled_utilities` from the tenant config.
2. Each utility blueprint decorates its routes with `@utility_required("utility_id")`.
3. If the utility is disabled for the current tenant, the decorator returns:

```json
{"error": {"code": "UTILITY_DISABLED", "message": "This feature is not enabled."}}
```

with HTTP 403.

**Implementation** (`backend/app/utilities/decorators.py`):

```python
from functools import wraps
from flask import g, jsonify

def utility_required(utility_id: str):
    """Guard that blocks requests if the utility is disabled for the tenant."""
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            enabled = getattr(g, "enabled_utilities", None)
            # None means "all enabled" (backwards compat / default tenant)
            if enabled is not None and utility_id not in enabled:
                return jsonify({
                    "error": {
                        "code": "UTILITY_DISABLED",
                        "message": f"The '{utility_id}' feature is not enabled for this account.",
                    }
                }), 403
            return f(*args, **kwargs)
        return wrapped
    return decorator
```

**Tenant middleware addition** (in `tenant.py`):

```python
# Inside resolve_tenant() before_request hook:
g.enabled_utilities = config.get("utilities") if config else None
# None = all enabled (backwards compat)
```

### Frontend Gating

1. The **context endpoint** is extended to return the enabled utilities list:

```json
{
  "mode": "tenant",
  "tenant_slug": "nocoresources",
  "tenant_name": "NoCo Resources",
  "utilities": ["contacts", "estimates", "invoices", "notes", "photos", "pdf", "saved_items"]
}
```

2. A **`useEnabledUtilities()` hook** provides this to the app:

```typescript
// frontend/src/utilities/index.ts
export function useEnabledUtilities(): string[] {
  const { data } = useAppContext();
  // If no utilities key, all are enabled
  return data?.utilities ?? ALL_UTILITY_IDS;
}

export function useIsUtilityEnabled(id: string): boolean {
  const enabled = useEnabledUtilities();
  return enabled.includes(id);
}
```

3. **RootNavigator** dynamically registers screens from enabled utilities only.
4. **JobDetailScreen** dynamically renders tabs from enabled utilities only.
5. **HomeScreen / SettingsScreen** conditionally render menu items based on enabled utilities.


---

## Frontend Utility Manifest Pattern

Each utility's `index.ts` exports a manifest that the core uses for dynamic registration:

```typescript
// frontend/src/utilities/estimates/index.ts
import EstimateEditorScreen from './screens/EstimateEditorScreen';
import EstimateSettingsScreen from './screens/EstimateSettingsScreen';
import EditEstimateOptionsScreen from './screens/EditEstimateOptionsScreen';
import { EstimatesTab } from './components/EstimatesTab';

export const estimatesUtility = {
  id: 'estimates',
  
  // Screens to register in the navigator
  screens: [
    { name: 'EstimateEditor', component: EstimateEditorScreen, options: { headerShown: true, title: 'Estimate' } },
    { name: 'EstimateSettings', component: EstimateSettingsScreen, options: { headerShown: true, title: 'Estimate Settings' } },
    { name: 'EditEstimateOptions', component: EditEstimateOptionsScreen, options: { headerShown: true, title: 'Edit Estimate Options' } },
  ],

  // Tabs contributed to JobDetailScreen
  jobDetailTabs: [
    { key: 'estimates', label: 'Estimates', component: EstimatesTab },
  ],

  // Items contributed to SettingsScreen
  settingsItems: [
    { key: 'estimate-settings', label: 'Estimate Defaults', screen: 'EstimateSettings' },
  ],
};
```

The registry collects all manifests:

```typescript
// frontend/src/utilities/index.ts
import { contactsUtility } from './contacts';
import { estimatesUtility } from './estimates';
import { invoicesUtility } from './invoices';
import { notesUtility } from './notes';
import { timeTrackingUtility } from './time_tracking';
import { photosUtility } from './photos';
import { pdfUtility } from './pdf';
import { savedItemsUtility } from './saved_items';
import { aiAssistantUtility } from './ai_assistant';

export const ALL_UTILITIES = [
  contactsUtility,
  estimatesUtility,
  invoicesUtility,
  notesUtility,
  timeTrackingUtility,
  photosUtility,
  pdfUtility,
  savedItemsUtility,
  aiAssistantUtility,
];

export const ALL_UTILITY_IDS = ALL_UTILITIES.map(u => u.id);
```

---

## Dependency Enforcement

Utilities can declare dependencies:

```python
# backend/app/utilities/estimates/__init__.py
UTILITY_ID = "estimates"
DEPENDENCIES = ["pdf"]  # Requires pdf utility to also be enabled
```

The utility registry validates at boot time (or when loading tenant config) that if a utility is enabled, its dependencies are also enabled. If not, it logs a warning. On the frontend, the same validation can happen — or we simply trust that `tenants.json` is configured correctly (admin UI would enforce this in the future).

For **invoice → estimate conversion**: the conversion endpoint is part of the invoices utility. If `estimates` is disabled but `invoices` is enabled, the conversion endpoint returns an error explaining that estimates must be enabled. This is a soft dependency — invoices work fine without estimates, you just can't convert.

---

## Shared Models Strategy

### LineItem / LineItemEntry

These are used by both Estimates and Invoices (and by extension, PDF). Options:

**Option A (recommended):** Keep LineItem/LineItemEntry in the **estimates** utility since that's where they originated. Invoices imports them from estimates. If only invoices is enabled (no estimates), we still need these models — so they actually belong in a shared location.

**Option B (chosen):** Create a small shared `line_items` sub-module within `utilities/` that both estimates and invoices reference:

```
backend/app/utilities/
├── _shared/
│   └── line_item_models.py    # LineItem, LineItemEntry
├── estimates/
│   ├── models.py              # Estimate (imports LineItem from _shared)
│   ...
├── invoices/
│   ├── models.py              # Invoice (imports LineItem from _shared)
│   ...
```

This way neither estimates nor invoices "owns" the shared data structure, and either can be enabled independently.

---

## Migration Strategy (Alembic)

Migrations stay in the existing `backend/migrations/` folder — unchanged. The migration files reference table names, not Python module paths, so the refactor of where model classes live doesn't affect Alembic at all.

New migrations continue to be created in the same folder. No migration is needed for the structural refactor itself — the database schema doesn't change.

SQLAlchemy model imports will need to be consolidated so that `alembic env.py` can still discover all models for autogeneration. This is handled by importing all utility models in a single `backend/app/models_registry.py`:

```python
# backend/app/models_registry.py
# Import all models so Alembic can see them for autogenerate
from .core.models import *
from .utilities._shared.line_item_models import *
from .utilities.contacts.models import *
from .utilities.estimates.models import *
from .utilities.invoices.models import *
from .utilities.notes.models import *
from .utilities.time_tracking.models import *
from .utilities.photos.models import *
from .utilities.saved_items.models import *
```


---

## Execution Plan (Phases)

### Phase 1: Backend Core Extraction

**Goal:** Move always-on pieces into `backend/app/core/` without breaking anything.

Steps:
1. Create `backend/app/core/` directory structure.
2. Move `auth/` module into `core/auth/`.
3. Create `core/models.py` with User, JobSite, Job, and the `job_employees` association table.
4. Move `job_sites_bp.py`, `jobs_bp.py`, `admin_bp.py`, `profile_bp.py`, `business_info_bp.py`, `document_settings_bp.py`, `context_bp.py`, `auth_bp.py` into `core/blueprints/`.
5. Move `job_site_service.py`, `job_service.py`, `profile_service.py`, `business_info_service.py` into `core/services/`.
6. Move `job_site_repo.py`, `job_repo.py`, `profile_repo.py`, `business_info_repo.py` into `core/repositories/`.
7. Move `helpers.py` into `core/blueprints/helpers.py`.
8. Update all imports in moved files.
9. Update `__init__.py` (app factory) to import from new locations.
10. Verify: `flask run` starts, all core endpoints respond.

### Phase 2: Backend Utility Infrastructure

**Goal:** Create the utility framework (registry, decorator, tenant integration).

Steps:
1. Create `backend/app/utilities/__init__.py` with `ALL_UTILITIES`, `register_all_utilities(app)`, `get_enabled_utilities(config)`.
2. Create `backend/app/utilities/decorators.py` with `@utility_required(utility_id)`.
3. Create `backend/app/utilities/_shared/line_item_models.py` with LineItem and LineItemEntry.
4. Update `tenant.py` to set `g.enabled_utilities` from tenant config.
5. Verify: no routes blocked yet (all utilities enabled by default), app still works.

### Phase 3: Backend Utility Extraction (one at a time)

**Goal:** Move each utility into its own folder. Do these one at a time, verifying after each.

Order (least dependencies first):
1. **notes** — simple, no dependencies on other utilities
2. **contacts** — mostly standalone (has association tables with core models)
3. **time_tracking** — standalone
4. **photos** — standalone (uses MinIO from core)
5. **saved_items** — standalone
6. **pdf** — depends on MinIO (core), used by estimates/invoices
7. **estimates** — depends on pdf, uses _shared line items
8. **invoices** — depends on pdf, uses _shared line items, optional estimate conversion
9. **ai_assistant** — depends on all others (calls their services)

For each utility:
1. Create the utility folder with `__init__.py`, `models.py`, `blueprint.py`, `service.py`, `repository.py`.
2. Move the relevant code from the old flat locations.
3. Add `@utility_required(UTILITY_ID)` to all routes in the blueprint.
4. Register the utility in `utilities/__init__.py`.
5. Update the app factory to call `register_all_utilities(app)`.
6. Update imports anywhere that references the moved files.
7. Verify: routes still work, no import errors.

### Phase 4: Frontend Core Extraction

**Goal:** Move always-on frontend pieces into `frontend/src/core/`.

Steps:
1. Create `frontend/src/core/` directory structure.
2. Move `api/client.ts`, `api/types.ts` → `core/api/`.
3. Move `navigation/` → `core/navigation/`.
4. Move `store/` → `core/store/`.
5. Move core hooks (`useAuth`, `useAdmin`, `useProfile`, `useBusinessInfo`, `useDocumentSettings`, `useAppContext`, `useJobSites`, `useJobs`) → `core/hooks/`.
6. Move core screens (`HomeScreen`, `SettingsScreen`, `ProfileSettingsScreen`, `BusinessInfoScreen`, `JobSiteDetailScreen`, `JobDetailScreen`, `AdminUsersScreen`, auth screens) → `core/screens/`.
7. Update all imports.
8. Verify: `npx expo start` compiles, app loads.

### Phase 5: Frontend Utility Extraction

**Goal:** Move each utility's frontend pieces into `frontend/src/utilities/<name>/`.

Order (same as backend):
1. **notes**
2. **contacts**
3. **time_tracking**
4. **photos**
5. **saved_items**
6. **pdf**
7. **estimates**
8. **invoices**
9. **ai_assistant**

For each:
1. Create the utility folder with `index.ts` (manifest), `screens/`, `components/`, `hooks/`.
2. Move the relevant files.
3. Export the utility manifest from `index.ts`.
4. Register in `frontend/src/utilities/index.ts`.
5. Update imports.
6. Verify: app compiles.

### Phase 6: Dynamic Registration (Frontend)

**Goal:** Make the navigator and core screens consume utility manifests dynamically.

Steps:
1. Extend the context endpoint to return `utilities` list.
2. Create `useEnabledUtilities()` hook.
3. Refactor `RootNavigator.tsx` to dynamically register screens from enabled utility manifests.
4. Refactor `JobDetailScreen.tsx` to dynamically render tabs from enabled utility manifests.
5. Refactor `HomeScreen.tsx` to conditionally render utility-specific menu items.
6. Refactor `SettingsScreen.tsx` to conditionally render utility-specific settings items.
7. Handle the AI bubble: only render `AIProvider` if `ai_assistant` is enabled.
8. Verify: disable a utility in `tenants.json`, confirm its screens/tabs/buttons disappear.

### Phase 7: Integration Testing

**Goal:** Validate the full toggle mechanism end-to-end.

Steps:
1. Create a test tenant in `tenants.json` with a subset of utilities.
2. Verify disabled utility API routes return 403 with `UTILITY_DISABLED`.
3. Verify frontend hides disabled utility UI.
4. Verify enabled utilities work exactly as before.
5. Verify all utilities enabled = identical behavior to pre-refactor.
6. Run existing test suite (all should pass with all utilities enabled).
7. Deploy to a staging tenant to validate in production-like environment.


---

## AI Assistant Considerations

The AI assistant is special because it calls across all other utilities (creating estimates, notes, contacts, etc. via tool calling). When a utility is disabled:

1. **Tool definitions**: The AI service should only include tool schemas for enabled utilities. At the start of each chat request, filter the `TOOLS` list based on `g.enabled_utilities`.
2. **Tool execution**: If somehow a disabled tool is called (model hallucination), the execution handler should return a clear error message that gets fed back to the model.
3. **System prompt**: Update the system prompt dynamically to only mention capabilities from enabled utilities.

This keeps the AI from offering to do things the tenant can't do.

---

## Context Endpoint Changes

The existing `GET /api/v1/context` endpoint is extended:

```python
@context_bp.get("/context")
def get_context():
    slug = getattr(g, "tenant_slug", None) or resolve_tenant_slug()
    config = get_tenant_config(slug) or {}
    
    # ... existing mode logic ...

    return jsonify({
        "mode": "tenant",
        "tenant_slug": slug,
        "tenant_name": config.get("name", slug),
        "utilities": config.get("utilities"),  # None = all enabled
    })
```

The frontend interprets `null`/missing as "all enabled" for backwards compatibility.

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Import breakage during move | Do one module at a time, run the app after each |
| Alembic can't find models | `models_registry.py` imports everything |
| Circular imports | Utilities only import from core, never from each other (except _shared) |
| Frontend bundle size unchanged | Tree-shaking won't help much since all utilities are in the bundle — but unused screens won't render. Future: code splitting per utility. |
| AI service calling disabled services | Filter tool list per-request based on `g.enabled_utilities` |
| Job model references (time_entries, notes, etc.) | Keep SQLAlchemy relationships in the utility model files using `backref` on the utility side, not on Job |

---

## Relationship Ownership Rule

To avoid core models importing utility models, relationships are defined on the **utility side** only:

```python
# In utilities/notes/models.py
class Note(db.Model):
    __tablename__ = "notes"
    job_id = Column(UUID, ForeignKey("jobs.id", ondelete="CASCADE"))
    # This creates Note.job AND Job.notes
    job = relationship("Job", backref=backref("notes", cascade="all, delete-orphan"))
```

The core `Job` model does NOT have `notes = relationship(...)` anymore. SQLAlchemy's `backref` handles it from the utility side. This means:
- Core doesn't know about utilities at import time.
- When a utility is loaded, its models add the relationship to the Job class.
- If a utility is never imported (hypothetically), the relationship simply doesn't exist on Job.

In practice, all utility models are always imported (via `models_registry.py`) because Alembic needs them and the DB tables exist regardless of whether the utility is enabled. The toggle is purely at the API/UI layer.

---

## File Deletion Plan

After all moves are complete, the following old locations are deleted:

```
# Old flat blueprint files (moved to core/blueprints/ or utilities/*)
backend/app/blueprints/  (entire directory)

# Old flat service files (moved to core/services/ or utilities/*)
backend/app/services/  (entire directory)

# Old flat repository files (moved to core/repositories/ or utilities/*)
backend/app/repositories/  (entire directory)

# Old monolithic models.py (split into core/models.py + utility models)
backend/app/models.py

# Old flat frontend locations
frontend/src/api/hooks/  (moved to core/hooks/ or utilities/*/hooks/)
frontend/src/components/  (moved to utilities/*/components/)
frontend/src/screens/app/  (split into core/screens/ and utilities/*/screens/)
```

---

## Future Enhancements (out of scope for this refactor)

- **Admin UI for toggling utilities** — Instead of editing `tenants.json`, admins toggle utilities from a settings page.
- **Per-utility migrations** — Each utility could manage its own migration chain (complex, not needed now since tables are always present).
- **Lazy loading / code splitting** — Frontend dynamically imports utility bundles only when enabled (reduces initial bundle for tenants with fewer utilities).
- **Utility marketplace** — Third-party or custom utilities that can be installed per-tenant.
- **Utility-scoped permissions** — Beyond on/off, granular permissions within a utility (e.g. "can view estimates but not create").
