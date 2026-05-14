"""Contacts blueprint.

Routes:
    GET    /api/v1/job-sites/<id>/contacts              — list contacts for a job site
    POST   /api/v1/job-sites/<id>/contacts              — create & add contact to job site
    DELETE /api/v1/job-sites/<id>/contacts/<contact_id> — remove contact from job site
    POST   /api/v1/job-sites/<id>/contacts/<contact_id>/set-primary — set primary contact
    GET    /api/v1/jobs/<id>/contacts                   — list contacts for a job
    POST   /api/v1/jobs/<id>/contacts                   — create & add contact to job
    DELETE /api/v1/jobs/<id>/contacts/<contact_id>      — remove contact from job
    POST   /api/v1/jobs/<id>/contacts/<contact_id>/set-primary — set primary contact
    GET    /api/v1/jobs/<id>/contacts/effective-primary — get effective primary contact
    PATCH  /api/v1/contacts/<contact_id>                — update a contact's fields
"""

from flask import Blueprint, g, jsonify, request

from ..auth.decorators import auth_required
from ..services.contact_service import ContactService, NotFoundError
from .helpers import error_response, not_found, server_error

contacts_bp = Blueprint("contacts", __name__)
_service = ContactService()


def _serialize_contact(contact) -> dict:
    return {
        "id": str(contact.id),
        "name": contact.name,
        "phone": contact.phone,
        "email": contact.email,
        "mailing_address": contact.mailing_address,
        "notes": contact.notes,
        "created_at": contact.created_at.isoformat() if contact.created_at else None,
    }


# ---------------------------------------------------------------------------
# Job site contacts
# ---------------------------------------------------------------------------

@contacts_bp.get("/job-sites/<site_id>/contacts")
@auth_required
def list_job_site_contacts(site_id: str):
    user_id = g.current_user_id
    try:
        contacts = _service.get_contacts_for_job_site(site_id, user_id)
        return jsonify([_serialize_contact(c) for c in contacts]), 200
    except NotFoundError:
        return not_found("Job site")
    except Exception:
        return server_error()


@contacts_bp.post("/job-sites/<site_id>/contacts")
@auth_required
def add_contact_to_job_site(site_id: str):
    """Create a new contact and associate it with the job site."""
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    if not name:
        return error_response("VALIDATION_ERROR", "Name is required.", field="name")

    try:
        contact = _service.create_contact(
            name=name,
            phone=data.get("phone"),
            email=data.get("email"),
            mailing_address=data.get("mailing_address"),
            notes=data.get("notes"),
        )
        _service.add_contact_to_job_site(site_id, user_id, str(contact.id))
        return jsonify(_serialize_contact(contact)), 201
    except NotFoundError:
        return not_found("Job site")
    except Exception:
        return server_error()


@contacts_bp.delete("/job-sites/<site_id>/contacts/<contact_id>")
@auth_required
def remove_contact_from_job_site(site_id: str, contact_id: str):
    user_id = g.current_user_id
    try:
        _service.remove_contact_from_job_site(site_id, user_id, contact_id)
        return "", 204
    except NotFoundError:
        return not_found("Job site")
    except Exception:
        return server_error()


@contacts_bp.post("/job-sites/<site_id>/contacts/<contact_id>/set-primary")
@auth_required
def set_primary_for_job_site(site_id: str, contact_id: str):
    user_id = g.current_user_id
    try:
        _service.set_primary_for_job_site(site_id, user_id, contact_id)
        return jsonify({"message": "Primary contact updated."}), 200
    except NotFoundError:
        return not_found("Job site")
    except Exception:
        return server_error()


# ---------------------------------------------------------------------------
# Job contacts
# ---------------------------------------------------------------------------

@contacts_bp.get("/jobs/<job_id>/contacts")
@auth_required
def list_job_contacts(job_id: str):
    user_id = g.current_user_id
    try:
        items = _service.get_contacts_for_job(job_id, user_id)
        return jsonify([
            {**_serialize_contact(item["contact"]), "inherited": item["inherited"]}
            for item in items
        ]), 200
    except NotFoundError:
        return not_found("Job")
    except Exception:
        return server_error()


@contacts_bp.post("/jobs/<job_id>/contacts")
@auth_required
def add_contact_to_job(job_id: str):
    """Create a new contact and associate it with the job."""
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    if not name:
        return error_response("VALIDATION_ERROR", "Name is required.", field="name")

    try:
        contact = _service.create_contact(
            name=name,
            phone=data.get("phone"),
            email=data.get("email"),
            mailing_address=data.get("mailing_address"),
            notes=data.get("notes"),
        )
        _service.add_contact_to_job(job_id, user_id, str(contact.id))
        return jsonify(_serialize_contact(contact)), 201
    except NotFoundError:
        return not_found("Job")
    except Exception:
        return server_error()


@contacts_bp.delete("/jobs/<job_id>/contacts/<contact_id>")
@auth_required
def remove_contact_from_job(job_id: str, contact_id: str):
    user_id = g.current_user_id
    try:
        _service.remove_contact_from_job(job_id, user_id, contact_id)
        return "", 204
    except NotFoundError:
        return not_found("Job")
    except Exception:
        return server_error()


@contacts_bp.post("/jobs/<job_id>/contacts/<contact_id>/set-primary")
@auth_required
def set_primary_for_job(job_id: str, contact_id: str):
    user_id = g.current_user_id
    try:
        _service.set_primary_for_job(job_id, user_id, contact_id)
        return jsonify({"message": "Primary contact updated."}), 200
    except NotFoundError:
        return not_found("Job")
    except Exception:
        return server_error()


@contacts_bp.get("/jobs/<job_id>/contacts/effective-primary")
@auth_required
def get_effective_primary_contact(job_id: str):
    """Return the effective primary contact for a job with its source."""
    user_id = g.current_user_id
    try:
        result = _service.get_effective_primary_contact(job_id, user_id)
        if result is None:
            return jsonify({"contact": None, "source": None}), 200
        return jsonify({
            "contact": _serialize_contact(result["contact"]),
            "source": result["source"],
        }), 200
    except NotFoundError:
        return not_found("Job")
    except Exception:
        return server_error()


# ---------------------------------------------------------------------------
# Contact update (shared — not scoped to a parent)
# ---------------------------------------------------------------------------

@contacts_bp.patch("/contacts/<contact_id>")
@auth_required
def update_contact(contact_id: str):
    """Update fields on an existing contact."""
    data = request.get_json(silent=True) or {}

    name = data.get("name")
    if name is not None:
        name = str(name).strip()
        if not name:
            return error_response("VALIDATION_ERROR", "Name cannot be empty.", field="name")

    try:
        contact = _service.update_contact(
            contact_id=contact_id,
            name=name,
            phone=data.get("phone"),
            email=data.get("email"),
            mailing_address=data.get("mailing_address"),
            notes=data.get("notes"),
        )
        return jsonify(_serialize_contact(contact)), 200
    except NotFoundError:
        return not_found("Contact")
    except Exception:
        return server_error()
