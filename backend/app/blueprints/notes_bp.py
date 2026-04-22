"""Notes blueprint.

Routes:
    GET    /api/v1/jobs/<id>/notes              — list notes for a job (newest first)
    POST   /api/v1/jobs/<id>/notes              — create a note
    PUT    /api/v1/jobs/<id>/notes/<note_id>    — update a note
    DELETE /api/v1/jobs/<id>/notes/<note_id>    — delete a note
"""

from flask import Blueprint, g, jsonify, request

from ..auth.decorators import auth_required
from ..services.note_service import NoteService, NotFoundError
from .helpers import error_response, not_found, server_error

notes_bp = Blueprint("notes", __name__)
_service = NoteService()


def _serialize_note(note) -> dict:
    return {
        "id": str(note.id),
        "job_id": str(note.job_id),
        "body": note.body,
        "created_at": note.created_at.isoformat() if note.created_at else None,
        "updated_at": note.updated_at.isoformat() if note.updated_at else None,
    }


@notes_bp.get("/jobs/<job_id>/notes")
@auth_required
def list_notes(job_id: str):
    user_id = g.current_user_id
    try:
        notes = _service.list_for_job(job_id, user_id)
        return jsonify([_serialize_note(n) for n in notes]), 200
    except NotFoundError:
        return not_found("Job")
    except Exception:
        return server_error()


@notes_bp.post("/jobs/<job_id>/notes")
@auth_required
def create_note(job_id: str):
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}

    body = data.get("body", "")
    if not body:
        return error_response("VALIDATION_ERROR", "Body is required.", field="body")

    try:
        note = _service.create(job_id=job_id, user_id=user_id, body=body)
        return jsonify(_serialize_note(note)), 201
    except NotFoundError:
        return not_found("Job")
    except Exception:
        return server_error()


@notes_bp.put("/jobs/<job_id>/notes/<note_id>")
@auth_required
def update_note(job_id: str, note_id: str):
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}

    body = data.get("body", "")
    if not body:
        return error_response("VALIDATION_ERROR", "Body is required.", field="body")

    try:
        note = _service.update(
            note_id=note_id, job_id=job_id, user_id=user_id, body=body
        )
        return jsonify(_serialize_note(note)), 200
    except NotFoundError:
        return not_found("Note")
    except Exception:
        return server_error()


@notes_bp.delete("/jobs/<job_id>/notes/<note_id>")
@auth_required
def delete_note(job_id: str, note_id: str):
    user_id = g.current_user_id
    try:
        _service.delete(note_id=note_id, job_id=job_id, user_id=user_id)
        return "", 204
    except NotFoundError:
        return not_found("Note")
    except Exception:
        return server_error()
