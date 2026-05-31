"""Time entries blueprint — clock in/out and manual hour tracking.

Routes:
    GET    /api/v1/jobs/<job_id>/time-entries       — list all time entries for a job
    POST   /api/v1/jobs/<job_id>/time-entries/clock-in   — clock in current user
    POST   /api/v1/jobs/<job_id>/time-entries/clock-out  — clock out current user
    POST   /api/v1/jobs/<job_id>/time-entries       — add manual hours
    GET    /api/v1/jobs/<job_id>/time-entries/status — get current user's clock status
    DELETE /api/v1/time-entries/<entry_id>           — delete a time entry
"""

from flask import Blueprint, g, jsonify, request

from ..auth.decorators import auth_required
from ..services.time_entry_service import (
    TimeEntryService,
    NotFoundError,
    ValidationError,
)
from .helpers import error_response, not_found, server_error

time_entries_bp = Blueprint("time_entries", __name__)
_service = TimeEntryService()


def _serialize_entry(entry) -> dict:
    return {
        "id": str(entry.id),
        "job_id": str(entry.job_id),
        "user_id": str(entry.user_id),
        "user_name": entry.user.name if entry.user else None,
        "user_email": entry.user.email if entry.user else None,
        "clock_in": entry.clock_in.isoformat() if entry.clock_in else None,
        "clock_out": entry.clock_out.isoformat() if entry.clock_out else None,
        "hours": str(entry.hours) if entry.hours is not None else None,
        "worked_at": entry.worked_at.isoformat() if entry.worked_at else None,
        "note": entry.note,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
        "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
    }


@time_entries_bp.get("/jobs/<job_id>/time-entries")
@auth_required
def list_time_entries(job_id: str):
    """List all time entries for a job."""
    try:
        entries = _service.list_for_job(job_id)
        return jsonify([_serialize_entry(e) for e in entries]), 200
    except Exception:
        return server_error()


@time_entries_bp.get("/jobs/<job_id>/time-entries/status")
@auth_required
def get_clock_status(job_id: str):
    """Get the current user's clock-in status for this job."""
    from ..repositories.time_entry_repo import SQLAlchemyTimeEntryRepository

    user_id = g.current_user_id
    repo = SQLAlchemyTimeEntryRepository()
    active = repo.get_active_for_user_and_job(user_id, job_id)
    if active:
        return jsonify({
            "clocked_in": True,
            "entry": _serialize_entry(active),
        }), 200
    return jsonify({"clocked_in": False, "entry": None}), 200


@time_entries_bp.post("/jobs/<job_id>/time-entries/clock-in")
@auth_required
def clock_in(job_id: str):
    """Clock in the current user on this job."""
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}
    note = data.get("note")

    try:
        entry = _service.clock_in(job_id, user_id, note=note)
        return jsonify(_serialize_entry(entry)), 201
    except ValidationError as exc:
        return error_response("VALIDATION_ERROR", str(exc))
    except Exception:
        return server_error()


@time_entries_bp.post("/jobs/<job_id>/time-entries/clock-out")
@auth_required
def clock_out(job_id: str):
    """Clock out the current user on this job."""
    user_id = g.current_user_id

    try:
        entry = _service.clock_out(job_id, user_id)
        return jsonify(_serialize_entry(entry)), 200
    except ValidationError as exc:
        return error_response("VALIDATION_ERROR", str(exc))
    except Exception:
        return server_error()


@time_entries_bp.post("/jobs/<job_id>/time-entries")
@auth_required
def add_manual_entry(job_id: str):
    """Add a manual time entry (hours worked without clock in/out).

    Request body:
        hours    (number, required) — hours worked
        note     (string, optional) — description of work
        worked_at (string, optional) — ISO 8601 datetime of when work was done (defaults to now)
    """
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}

    raw_hours = data.get("hours")
    if raw_hours is None:
        return error_response("VALIDATION_ERROR", "Hours is required.", field="hours")

    from decimal import Decimal, InvalidOperation

    try:
        hours = Decimal(str(raw_hours))
    except (InvalidOperation, ValueError):
        return error_response("VALIDATION_ERROR", "Hours must be a valid number.", field="hours")

    note = data.get("note")

    # Parse optional worked_at datetime
    worked_at = None
    if data.get("worked_at"):
        from datetime import datetime
        try:
            worked_at = datetime.fromisoformat(data["worked_at"].replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return error_response(
                "VALIDATION_ERROR",
                "worked_at must be a valid ISO 8601 datetime string.",
                field="worked_at",
            )

    try:
        entry = _service.add_manual(job_id, user_id, hours, note=note, worked_at=worked_at)
        return jsonify(_serialize_entry(entry)), 201
    except ValidationError as exc:
        return error_response("VALIDATION_ERROR", str(exc), field="hours")
    except Exception:
        return server_error()


@time_entries_bp.delete("/time-entries/<entry_id>")
@auth_required
def delete_time_entry(entry_id: str):
    """Delete a time entry (users can only delete their own)."""
    user_id = g.current_user_id

    try:
        _service.delete(entry_id, user_id)
        return "", 204
    except NotFoundError:
        return not_found("Time entry")
    except ValidationError as exc:
        return error_response("FORBIDDEN", str(exc), status=403)
    except Exception:
        return server_error()
