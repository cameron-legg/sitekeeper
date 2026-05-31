"""Jobs blueprint.

Routes:
    GET    /api/v1/job-sites/<id>/jobs  — list jobs for a site
    POST   /api/v1/job-sites/<id>/jobs  — create a job in a site
    GET    /api/v1/jobs/<id>            — get a single job
    PUT    /api/v1/jobs/<id>            — full update of a job
    PATCH  /api/v1/jobs/<id>            — partial update of a job
    DELETE /api/v1/jobs/<id>            — delete a job
"""

from flask import Blueprint, g, jsonify, request

from ..auth.decorators import auth_required
from ..services.job_service import _UNSET, JobService, NotFoundError, ValidationError
from .helpers import error_response, not_found, server_error

jobs_bp = Blueprint("jobs", __name__)
_service = JobService()


def _serialize_job(job) -> dict:
    return {
        "id": str(job.id),
        "job_site_id": str(job.job_site_id),
        "name": job.name,
        "status": job.status,
        "description": job.description,
        "default_hourly_rate": str(job.default_hourly_rate) if job.default_hourly_rate is not None else None,
        "primary_contact_id": str(job.primary_contact_id) if job.primary_contact_id else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
        "employees": [
            {"id": str(u.id), "name": u.name, "email": u.email}
            for u in job.employees
        ],
    }


@jobs_bp.get("/job-sites/<site_id>/jobs")
@auth_required
def list_jobs(site_id: str):
    """List all jobs for the given job site."""
    user_id = g.current_user_id
    try:
        jobs = _service.list_for_site(site_id, user_id)
        return jsonify([_serialize_job(j) for j in jobs]), 200
    except NotFoundError:
        return not_found("Job site")
    except Exception:
        return server_error()


@jobs_bp.post("/job-sites/<site_id>/jobs")
@auth_required
def create_job(site_id: str):
    """Create a new job within the given job site."""
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    if not name:
        return error_response("VALIDATION_ERROR", "Name is required.", field="name")

    status = data.get("status", "pending")
    description = data.get("description")

    try:
        job = _service.create(
            site_id=site_id,
            user_id=user_id,
            name=name,
            status=status,
            description=description,
        )
        return jsonify(_serialize_job(job)), 201
    except NotFoundError:
        return not_found("Job site")
    except ValidationError as exc:
        return error_response("VALIDATION_ERROR", str(exc), field="status")
    except Exception:
        return server_error()


@jobs_bp.get("/jobs/<job_id>")
@auth_required
def get_job(job_id: str):
    """Get a single job by id."""
    user_id = g.current_user_id
    try:
        job = _service.get(job_id, user_id)
        return jsonify(_serialize_job(job)), 200
    except NotFoundError:
        return not_found("Job")
    except Exception:
        return server_error()


@jobs_bp.put("/jobs/<job_id>")
@auth_required
def update_job(job_id: str):
    """Full update of a job (all fields replaced)."""
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    if not name:
        return error_response("VALIDATION_ERROR", "Name is required.", field="name")

    status = data.get("status", "pending")
    description = data.get("description")

    # finished_at: explicit key presence matters
    finished_at = _UNSET
    if "finished_at" in data:
        finished_at = data["finished_at"]
        if finished_at is not None:
            # Parse ISO string to datetime if provided as string
            from datetime import datetime, timezone
            try:
                finished_at = datetime.fromisoformat(finished_at.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                return error_response(
                    "VALIDATION_ERROR",
                    "finished_at must be a valid ISO 8601 datetime string or null.",
                    field="finished_at",
                )

    try:
        job = _service.update(
            job_id=job_id,
            user_id=user_id,
            name=name,
            status=status,
            description=description,
            finished_at=finished_at,
        )
        return jsonify(_serialize_job(job)), 200
    except NotFoundError:
        return not_found("Job")
    except ValidationError as exc:
        return error_response("VALIDATION_ERROR", str(exc), field="status")
    except Exception:
        return server_error()


@jobs_bp.patch("/jobs/<job_id>")
@auth_required
def patch_job(job_id: str):
    """Partial update of a job — only provided fields are changed."""
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}

    name = data.get("name")
    if name is not None:
        name = str(name).strip()
        if not name:
            return error_response("VALIDATION_ERROR", "Name cannot be empty.", field="name")

    status = data.get("status")
    description = data.get("description")

    finished_at = _UNSET
    if "finished_at" in data:
        finished_at = data["finished_at"]
        if finished_at is not None:
            from datetime import datetime, timezone
            try:
                finished_at = datetime.fromisoformat(finished_at.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                return error_response(
                    "VALIDATION_ERROR",
                    "finished_at must be a valid ISO 8601 datetime string or null.",
                    field="finished_at",
                )

    default_hourly_rate = _UNSET
    if "default_hourly_rate" in data:
        raw = data["default_hourly_rate"]
        if raw is None:
            default_hourly_rate = None
        else:
            from decimal import Decimal, InvalidOperation
            try:
                default_hourly_rate = Decimal(str(raw))
            except (InvalidOperation, ValueError):
                return error_response("VALIDATION_ERROR", "Must be a valid number.", field="default_hourly_rate")

    try:
        job = _service.update(
            job_id=job_id,
            user_id=user_id,
            name=name,
            status=status,
            description=description,
            finished_at=finished_at,
            default_hourly_rate=default_hourly_rate,
        )
        return jsonify(_serialize_job(job)), 200
    except NotFoundError:
        return not_found("Job")
    except ValidationError as exc:
        return error_response("VALIDATION_ERROR", str(exc), field="status")
    except Exception:
        return server_error()


@jobs_bp.delete("/jobs/<job_id>")
@auth_required
def delete_job(job_id: str):
    """Delete a job and all its children."""
    user_id = g.current_user_id
    try:
        _service.delete(job_id, user_id)
        return "", 204
    except NotFoundError:
        return not_found("Job")
    except Exception:
        return server_error()


# ── Employee assignment endpoints ──────────────────────────────────────────────


@jobs_bp.put("/jobs/<job_id>/employees")
@auth_required
def set_job_employees(job_id: str):
    """Replace the full list of employees assigned to a job.

    Request body: {"employee_ids": ["uuid1", "uuid2", ...]}
    Only approved users in the tenant can be assigned.
    """
    from ..extensions import db
    from ..models import User

    user_id = g.current_user_id
    try:
        job = _service.get(job_id, user_id)
    except NotFoundError:
        return not_found("Job")
    except Exception:
        return server_error()

    data = request.get_json(silent=True) or {}
    employee_ids = data.get("employee_ids", [])

    if not isinstance(employee_ids, list):
        return error_response("VALIDATION_ERROR", "employee_ids must be an array.", field="employee_ids")

    # Fetch only approved users matching the provided IDs
    if employee_ids:
        users = User.query.filter(
            User.id.in_(employee_ids),
            User.is_approved == True,
        ).all()
    else:
        users = []

    job.employees = users
    db.session.commit()
    db.session.refresh(job)

    return jsonify(_serialize_job(job)), 200
