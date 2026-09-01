"""Fail-safe recording of backend errors into the current tenant database.

The global error handler calls :func:`record_error` when an unhandled 5xx
exception bubbles out of a request. The error is stored in the tenant's OWN
database (the ``backend_error_log`` table) — co-located with the tenant it
belongs to, and read only by the platform/superadmin panel.

Why a dedicated session instead of ``db.session``:
    When a request fails, its ``db.session`` is usually in a broken /
    rolled-back state, so writing the log through it would fail too. We open
    a short-lived session bound to the SAME engine that the tenant middleware
    swapped in for this request (``db.engines[None]``), commit just the log
    row, and close it. This keeps the write independent of the failed request
    transaction.

Golden rule: recording an error must NEVER raise. If anything goes wrong we
fall back to the stdlib logger so one error can't become two.
"""

from __future__ import annotations

import logging
import uuid

from flask import g

from .extensions import db
from .models import BackendErrorLog

logger = logging.getLogger(__name__)


def record_error(
    *,
    request_id: str,
    error_type: str,
    message: str,
    stack_trace: str,
    http_method: str | None,
    path: str | None,
    status_code: int,
    user_id: str | None,
    tenant_slug: str | None,
    context: dict | None = None,
) -> None:
    """Persist a single error row to the current tenant's database.

    All arguments are keyword-only for clarity at the call site. This function
    swallows every exception — it must not add a second failure on top of the
    one being reported.
    """
    from sqlalchemy.orm import Session

    session = None
    try:
        # Bind to the engine the tenant middleware selected for THIS request.
        engine = db.engines.get(None)
        if engine is None:
            logger.warning("No engine bound; cannot persist backend error log.")
            return

        session = Session(bind=engine)
        row = BackendErrorLog(
            id=uuid.uuid4(),
            request_id=_as_uuid(request_id),
            tenant_slug=tenant_slug,
            error_type=(error_type or "")[:255],
            message=message,
            stack_trace=stack_trace,
            http_method=(http_method or "")[:10] or None,
            path=path,
            status_code=status_code,
            user_id=_as_uuid(user_id),
            context=context,
        )
        session.add(row)
        session.commit()
    except Exception:  # noqa: BLE001 — logging must never raise
        logger.exception("Failed to write backend_error_log row (swallowed).")
        if session is not None:
            try:
                session.rollback()
            except Exception:  # noqa: BLE001
                pass
    finally:
        if session is not None:
            try:
                session.close()
            except Exception:  # noqa: BLE001
                pass


def _as_uuid(value: str | None):
    """Coerce a string to a UUID, returning None on failure."""
    if not value:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None
