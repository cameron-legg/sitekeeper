"""Business info blueprint — get and update tenant-level business settings.

Routes:
    GET  /api/v1/business-info
    PUT  /api/v1/business-info
    GET  /api/v1/business-info/users  — list approved users (for owner picker)
    POST /api/v1/business-info/logo   — upload business logo
    GET  /api/v1/business-info/logo   — retrieve business logo image
    DELETE /api/v1/business-info/logo — remove business logo
"""

import io
import logging

from flask import Blueprint, Response, current_app, g, jsonify, request
from PIL import Image

from ..auth.decorators import auth_required
from ...extensions import db
from ...models import BusinessInfo, User
from ..services.business_info_service import BusinessInfoService, NotFoundError
from .helpers import error_response, not_found, server_error

logger = logging.getLogger(__name__)

business_info_bp = Blueprint("business_info", __name__)
_service = BusinessInfoService()

# Logo constraints
LOGO_MAX_WIDTH = 400  # pixels — fits well in the PDF header area
LOGO_MAX_HEIGHT = 150  # pixels
LOGO_OBJECT_KEY = "branding/logo.png"
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}


@business_info_bp.get("/business-info")
@auth_required
def get_business_info():
    """Return the tenant's business information.

    Responses:
        200  { id, business_name, state, payment_method, business_address,
               business_phone, business_email, owner_user_id, owner_name }
        404  business info not found
    """
    try:
        info = _service.get_business_info()
    except NotFoundError:
        return not_found("Business info")
    # Unexpected errors propagate to the global handler for logging.
    return jsonify(info), 200


@business_info_bp.put("/business-info")
@auth_required
def update_business_info():
    """Update the tenant's business information.

    Request body (JSON) — all fields optional:
        business_name    (str | null)
        state            (str | null)  — 2-letter US state code
        payment_method   (str | null)
        business_address (str | null)
        business_phone   (str | null)
        business_email   (str | null)
        owner_user_id    (str | null)  — UUID of the business owner user

    Responses:
        200  updated business info object
        404  business info not found
    """
    data = request.get_json(silent=True) or {}
    try:
        info = _service.update_business_info(data)
    except NotFoundError:
        return not_found("Business info")
    # Unexpected errors propagate to the global handler for logging.
    return jsonify(info), 200


@business_info_bp.get("/business-info/users")
@auth_required
def list_users_for_picker():
    """Return a lightweight list of approved users for the owner picker.

    Responses:
        200  [{ id, name, email }]
    """
    users = User.query.filter_by(is_approved=True).order_by(User.name).all()
    return jsonify([
        {"id": str(u.id), "name": u.name, "email": u.email}
        for u in users
    ]), 200


# ---------------------------------------------------------------------------
# Logo upload / retrieval / delete
# ---------------------------------------------------------------------------


def _get_tenant_storage():
    """Return a MinIO storage instance scoped to the current tenant's bucket."""
    from ...tenant import get_tenant_bucket

    storage = getattr(current_app, "minio_storage", None)
    if storage is None:
        raise RuntimeError("MinIO storage is not available.")

    tenant_slug = getattr(g, "tenant_slug", None)
    if tenant_slug:
        bucket = get_tenant_bucket(tenant_slug)
        if bucket != storage.bucket_name:
            return storage.with_bucket(bucket)
    return storage


def _resize_logo(image_bytes: bytes, content_type: str) -> bytes:
    """Resize the uploaded image to fit within LOGO_MAX_WIDTH x LOGO_MAX_HEIGHT.

    Maintains aspect ratio. Converts to PNG for consistent rendering in PDFs.
    """
    img = Image.open(io.BytesIO(image_bytes))

    # Convert to RGBA (handles CMYK, palette, etc.)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA")

    # Resize only if larger than the max dimensions
    img.thumbnail((LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT), Image.LANCZOS)

    # Save as PNG for consistent quality
    output = io.BytesIO()
    img.save(output, format="PNG", optimize=True)
    return output.getvalue()


@business_info_bp.post("/business-info/logo")
@auth_required
def upload_logo():
    """Upload a business logo image.

    Accepts multipart/form-data with a 'logo' file field.
    The image is resized to fit within 400x150 px and stored as PNG in MinIO.

    Responses:
        200  { logo_url: "..." }
        400  invalid file type or missing file
        500  storage error
    """
    if "logo" not in request.files:
        return error_response("VALIDATION_ERROR", "No file provided. Upload a 'logo' field.", field="logo")

    file = request.files["logo"]
    if not file.filename:
        return error_response("VALIDATION_ERROR", "Empty file.", field="logo")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_IMAGE_TYPES:
        return error_response(
            "VALIDATION_ERROR",
            "Unsupported image type. Use PNG, JPEG, GIF, or WebP.",
            field="logo",
        )

    try:
        raw_bytes = file.read()
        if len(raw_bytes) > 10 * 1024 * 1024:  # 10 MB limit on raw upload
            return error_response("VALIDATION_ERROR", "File too large. Maximum 10 MB.", field="logo")

        # Resize and convert to standardized PNG
        logo_bytes = _resize_logo(raw_bytes, content_type)

        # Upload to MinIO
        storage = _get_tenant_storage()
        storage.upload(LOGO_OBJECT_KEY, logo_bytes, content_type="image/png")

        # Update business_info record
        info = BusinessInfo.query.first()
        if info is None:
            return not_found("Business info")
        info.logo_object_key = LOGO_OBJECT_KEY
        db.session.commit()

        return jsonify({"logo_url": "/api/v1/business-info/logo"}), 200
    except RuntimeError as exc:
        return server_error(str(exc))
    except Exception:
        logger.exception("Failed to upload logo")
        return server_error()


@business_info_bp.get("/business-info/logo")
@auth_required
def get_logo():
    """Retrieve the business logo image.

    Responses:
        200  image/png bytes
        404  no logo uploaded
    """
    info = BusinessInfo.query.first()
    if info is None or not info.logo_object_key:
        return not_found("Logo")

    try:
        storage = _get_tenant_storage()
        logo_bytes = storage.download(info.logo_object_key)
        return Response(
            logo_bytes,
            status=200,
            content_type="image/png",
            headers={"Cache-Control": "public, max-age=3600"},
        )
    except Exception:
        logger.exception("Failed to download logo from MinIO")
        return not_found("Logo")


@business_info_bp.delete("/business-info/logo")
@auth_required
def delete_logo():
    """Remove the business logo.

    Deletes the file from MinIO and clears the reference in the database.

    Responses:
        204  logo deleted
        404  no logo to delete
    """
    info = BusinessInfo.query.first()
    if info is None or not info.logo_object_key:
        return not_found("Logo")

    try:
        storage = _get_tenant_storage()
        storage.delete(info.logo_object_key)
    except Exception:
        logger.warning("Failed to delete logo from MinIO (may already be gone)")

    info.logo_object_key = None
    db.session.commit()
    return "", 204
