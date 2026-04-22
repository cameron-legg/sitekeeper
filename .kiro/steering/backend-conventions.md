---
inclusion: always
---

# Backend Conventions

## Architecture layers (always follow this order)
1. **Route (Blueprint)** — HTTP in/out, input validation, auth middleware only
2. **Service** — business logic, ownership checks, domain rules
3. **Repository** — database queries via SQLAlchemy, no business logic

Never put business logic in blueprints. Never put HTTP concerns in services.

## Adding a new resource
1. Add SQLAlchemy model to `backend/app/models.py`
2. Create `backend/migrations/versions/NNN_description.py` (Alembic migration)
3. Create `backend/app/repositories/<resource>_repo.py` with interface + SQLAlchemy impl
4. Create `backend/app/services/<resource>_service.py`
5. Create `backend/app/blueprints/<resource>_bp.py`
6. Register blueprint in `backend/app/__init__.py` under `/api/v1`

## Key patterns

### Ownership enforcement
All repository queries filter by `user_id`. Resources belonging to another user return **404** (not 403) to avoid leaking existence.

### Error responses
Always use the consistent envelope:
```json
{"error": {"code": "VALIDATION_ERROR", "message": "...", "field": "email"}}
```
Use `from .helpers import error_response, not_found, server_error` in blueprints.

### Auth
Protect routes with `@auth_required`. The decorator injects `g.current_user_id`.

### Migrations
- Run from project root: `backend/venv/bin/alembic -c backend/alembic.ini upgrade head`
- Always write both `upgrade()` and `downgrade()` functions
- Never modify existing migration files — create a new one

### Python venv
Always use `backend/venv/bin/python` and `backend/venv/bin/pip`. Never use system Python for this project.

## Line item v2 model
LineItems are named groups (e.g. "Toilet Replacement") with sub-entries:
- **Material entry**: `unit_price × quantity = cost`
- **Hours entry**: `hours × parent_line_item.hourly_rate = cost`
- `total_cost` and `total_hours` are computed by `compute_line_item_totals(item)` in `estimate_service.py`
