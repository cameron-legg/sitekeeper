"""Job sites blueprint.

Routes:
    GET    /api/v1/job-sites           — list all job sites for the current user
    POST   /api/v1/job-sites           — create a new job site
    GET    /api/v1/job-sites/<id>      — get a single job site
    PUT    /api/v1/job-sites/<id>      — update a job site
    DELETE /api/v1/job-sites/<id>      — delete a job site
"""

from flask import Blueprint, g, jsonify, request

from ..auth.decorators import auth_required
from ..services.job_site_service import JobSiteService, NotFoundError
from .helpers import error_response, not_found, server_error

job_sites_bp = Blueprint("job_sites", __name__)
_service = JobSiteService()


def _serialize_site(site, job_count: int = 0, active_job_count: int = 0) -> dict:
    return {
        "id": str(site.id),
        "user_id": str(site.user_id),
        "name": site.name,
        "description": site.description,
        "address": site.address,
        "primary_contact_id": str(site.primary_contact_id) if site.primary_contact_id else None,
        "job_count": job_count,
        "active_job_count": active_job_count,
        "created_at": site.created_at.isoformat() if site.created_at else None,
        "updated_at": site.updated_at.isoformat() if site.updated_at else None,
    }


@job_sites_bp.get("/job-sites")
@auth_required
def list_job_sites():
    """List all job sites for the authenticated user."""
    user_id = g.current_user_id
    try:
        entries = _service.list_for_user(user_id)
        return jsonify([_serialize_site(e["site"], e["job_count"], e["active_job_count"]) for e in entries]), 200
    except Exception:
        return server_error()


@job_sites_bp.post("/job-sites")
@auth_required
def create_job_site():
    """Create a new job site."""
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    if not name:
        return error_response("VALIDATION_ERROR", "Name is required.", field="name")

    description = data.get("description")
    address = data.get("address")

    try:
        site = _service.create(user_id=user_id, name=name, description=description, address=address)
        job_count = 0
        return jsonify(_serialize_site(site, job_count)), 201
    except Exception:
        return server_error()


@job_sites_bp.get("/job-sites/<site_id>")
@auth_required
def get_job_site(site_id: str):
    """Get a single job site by id."""
    user_id = g.current_user_id
    try:
        site = _service.get(site_id, user_id)
        # Fetch job count for the detail view too
        from ..repositories.job_site_repo import SQLAlchemyJobSiteRepository
        repo = SQLAlchemyJobSiteRepository()
        job_count = repo.count_jobs(site_id)
        return jsonify(_serialize_site(site, job_count)), 200
    except NotFoundError:
        return not_found("Job site")
    except Exception:
        return server_error()


@job_sites_bp.put("/job-sites/<site_id>")
@auth_required
def update_job_site(site_id: str):
    """Update a job site."""
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}

    name = data.get("name")
    description = data.get("description")
    address = data.get("address")

    if name is not None and not str(name).strip():
        return error_response("VALIDATION_ERROR", "Name cannot be empty.", field="name")

    try:
        site = _service.update(
            site_id=site_id,
            user_id=user_id,
            name=str(name).strip() if name is not None else None,
            description=description,
            address=address,
        )
        from ..repositories.job_site_repo import SQLAlchemyJobSiteRepository
        repo = SQLAlchemyJobSiteRepository()
        job_count = repo.count_jobs(site_id)
        return jsonify(_serialize_site(site, job_count)), 200
    except NotFoundError:
        return not_found("Job site")
    except Exception:
        return server_error()


@job_sites_bp.delete("/job-sites/<site_id>")
@auth_required
def delete_job_site(site_id: str):
    """Delete a job site and all its children."""
    user_id = g.current_user_id
    try:
        _service.delete(site_id, user_id)
        return "", 204
    except NotFoundError:
        return not_found("Job site")
    except Exception:
        return server_error()
