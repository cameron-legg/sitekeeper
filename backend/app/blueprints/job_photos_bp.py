"""Job photos blueprint — upload, list, download, and delete photos.

Routes:
    GET    /api/v1/jobs/<job_id>/photos          — list photos for a job
    POST   /api/v1/jobs/<job_id>/photos          — upload a photo (multipart/form-data)
    GET    /api/v1/photos/<photo_id>             — download photo binary
    DELETE /api/v1/photos/<photo_id>             — delete a photo
"""

from flask import Blueprint, Response, g, jsonify, request

from ..auth.decorators import auth_required
from ..services.job_photo_service import (
    JobPhotoService,
    NotFoundError,
    ValidationError,
)
from .helpers import error_response, not_found, server_error

job_photos_bp = Blueprint("job_photos", __name__)
_service = JobPhotoService()


def _serialize_photo(photo) -> dict:
    return {
        "id": str(photo.id),
        "job_id": str(photo.job_id),
        "uploaded_by": str(photo.uploaded_by) if photo.uploaded_by else None,
        "filename": photo.filename,
        "content_type": photo.content_type,
        "file_size": photo.file_size,
        "created_at": photo.created_at.isoformat() if photo.created_at else None,
    }


@job_photos_bp.get("/jobs/<job_id>/photos")
@auth_required
def list_photos(job_id: str):
    """List all photos for a job."""
    user_id = g.current_user_id
    try:
        photos = _service.list_photos(job_id, user_id)
        return jsonify([_serialize_photo(p) for p in photos]), 200
    except NotFoundError:
        return not_found("Job")
    except Exception:
        return server_error()


@job_photos_bp.post("/jobs/<job_id>/photos")
@auth_required
def upload_photo(job_id: str):
    """Upload a photo to a job.

    Expects multipart/form-data with a 'file' field.
    """
    user_id = g.current_user_id

    if "file" not in request.files:
        return error_response("VALIDATION_ERROR", "No file provided.", field="file")

    file = request.files["file"]
    if not file.filename:
        return error_response("VALIDATION_ERROR", "Filename is required.", field="file")

    file_data = file.read()
    content_type = file.content_type or "application/octet-stream"
    filename = file.filename

    try:
        photo = _service.upload_photo(
            job_id=job_id,
            user_id=user_id,
            file_data=file_data,
            filename=filename,
            content_type=content_type,
        )
        return jsonify(_serialize_photo(photo)), 201
    except NotFoundError:
        return not_found("Job")
    except ValidationError as exc:
        return error_response("VALIDATION_ERROR", str(exc))
    except RuntimeError as exc:
        return server_error(str(exc))
    except Exception:
        return server_error()


@job_photos_bp.get("/photos/<photo_id>")
@auth_required
def download_photo(photo_id: str):
    """Download a photo's binary data."""
    user_id = g.current_user_id
    try:
        data, filename, content_type = _service.download_photo(photo_id, user_id)
        return Response(
            data,
            status=200,
            content_type=content_type,
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Cache-Control": "private, max-age=86400",
            },
        )
    except NotFoundError:
        return not_found("Photo")
    except RuntimeError as exc:
        return server_error(str(exc))
    except Exception:
        return server_error()


@job_photos_bp.delete("/photos/<photo_id>")
@auth_required
def delete_photo(photo_id: str):
    """Delete a photo."""
    user_id = g.current_user_id
    try:
        _service.delete_photo(photo_id, user_id)
        return "", 204
    except NotFoundError:
        return not_found("Photo")
    except RuntimeError as exc:
        return server_error(str(exc))
    except Exception:
        return server_error()
