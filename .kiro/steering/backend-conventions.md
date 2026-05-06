---
inclusion: always
---

# Backend Conventions

## Architecture layers (always follow this order)
1. **Route (Blueprint)** — HTTP in/out, input validation, auth middleware only
2. **Service** — business logic, domain rules
3. **Repository** — database queries via SQLAlchemy, no business logic

Never put business logic in blueprints. Never put HTTP concerns in services.

## Multi-Tenant Awareness
- The tenant is resolved from the `Host` header by middleware in `app/tenant.py`
- `db.engines[None]` is swapped per-request to the tenant's database engine
- All queries automatically hit the correct tenant database — no manual filtering needed
- MinIO operations use the tenant's bucket via `storage.with_bucket(tenant_bucket)`
- Tenant config lives in `backend/tenants.json`

## Adding a new resource
1. Add SQLAlchemy model to `backend/app/models.py`
2. Create `backend/migrations/versions/NNN_description.py` (Alembic migration)
3. Create `backend/app/repositories/<resource>_repo.py` with interface + SQLAlchemy impl
4. Create `backend/app/services/<resource>_service.py`
5. Create `backend/app/blueprints/<resource>_bp.py`
6. Register blueprint in `backend/app/__init__.py` under `/api/v1`

## Key patterns

### Data access (shared within tenant)
All approved users in a tenant see ALL data. Repositories do NOT filter by `user_id` for reads — the tenant database boundary IS the access boundary. The `user_id` is still stored on resources (e.g. `JobSite.user_id`) to track who created what, but it's not used for access control.

### Auth
Protect routes with `@auth_required`. The decorator:
- Validates the JWT token
- Loads the user from the database
- Blocks unapproved users with 403 (`NOT_APPROVED`)
- Injects `g.current_user_id`, `g.current_user_role`, `g.current_user_is_approved`

### Admin endpoints
Admin-only routes use `@auth_required` + `@_admin_required` (checks `g.current_user_role == "admin"`).
See `admin_bp.py` for the pattern.

### Error responses
Always use the consistent envelope:
```json
{"error": {"code": "VALIDATION_ERROR", "message": "...", "field": "email"}}
```
Use `from .helpers import error_response, not_found, server_error` in blueprints.

### Migrations
- Run from project root: `backend/venv/bin/alembic -c backend/alembic.ini upgrade head`
- `./deploy.sh backend` runs migrations against ALL tenant databases automatically
- Always write both `upgrade()` and `downgrade()` functions
- Never modify existing migration files — create a new one

### Python venv
Always use `backend/venv/bin/python` and `backend/venv/bin/pip`. Never use system Python for this project.

## User model
- `role`: `"admin"` or `"member"` — first user to register on a tenant is admin
- `is_approved`: `True` or `False` — admin auto-approved, members need admin approval
- Profile fields: `name`, `state`, `company_name`, `phone`, `payment_method`

## Line item v2 model
LineItems are named groups (e.g. "Toilet Replacement") with sub-entries:
- **Material entry**: `unit_price × quantity = cost`
- **Hours entry**: `hours × parent_line_item.hourly_rate = cost`
- `total_cost` and `total_hours` are computed by `compute_line_item_totals(item)` in `estimate_service.py`
