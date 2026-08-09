"""Document field settings blueprint — tenant-level field visibility configuration.

Routes:
    GET  /api/v1/settings/document-fields/<document_type>
    PUT  /api/v1/settings/document-fields/<document_type>
"""

from flask import Blueprint, jsonify, request

from ..auth.decorators import auth_required
from ...extensions import db
from ...models import DocumentFieldSettings
from .helpers import error_response, server_error

document_settings_bp = Blueprint("document_settings", __name__)

# All configurable fields for estimates and invoices
CONFIGURABLE_FIELDS = [
    {"key": "document_number", "label": "Document #"},
    {"key": "document_date", "label": "Date"},
    {"key": "bill_to", "label": "Bill To"},
    {"key": "worksite_address", "label": "Worksite Address"},
    {"key": "company_name", "label": "Business Name"},
    {"key": "user_name", "label": "Owner / Worker Name"},
    {"key": "business_address", "label": "Business Address"},
    {"key": "user_phone", "label": "Phone"},
    {"key": "user_email", "label": "Email"},
    {"key": "payment_method", "label": "Payment Method"},
    {"key": "notes", "label": "Additional Notes"},
    {"key": "photos", "label": "Photos"},
    {"key": "tax_rate", "label": "Sales Tax Rate"},
]

VALID_VISIBILITIES = ("always_show", "additional", "disabled")
VALID_DOCUMENT_TYPES = ("estimate", "invoice")


def _get_settings_map(document_type: str) -> dict[str, dict]:
    """Return current settings as a dict keyed by field_key."""
    rows = DocumentFieldSettings.query.filter_by(document_type=document_type).all()
    return {row.field_key: {"visibility": row.visibility, "pdf_visible": row.pdf_visible} for row in rows}


@document_settings_bp.get("/settings/document-fields/<document_type>")
@auth_required
def get_document_field_settings(document_type: str):
    """Return field settings for the given document type.

    Returns a list of fields with their current visibility and pdf_visible settings.
    Fields not yet in the database default to always_show + pdf_visible=true.
    """
    if document_type not in VALID_DOCUMENT_TYPES:
        return error_response("VALIDATION_ERROR", "document_type must be 'estimate' or 'invoice'.", field="document_type")

    try:
        settings_map = _get_settings_map(document_type)
        result = []
        for field in CONFIGURABLE_FIELDS:
            setting = settings_map.get(field["key"], {"visibility": "always_show", "pdf_visible": True})
            result.append({
                "key": field["key"],
                "label": field["label"],
                "visibility": setting["visibility"],
                "pdf_visible": setting["pdf_visible"],
            })
        return jsonify(result), 200
    except Exception:
        return server_error()


@document_settings_bp.put("/settings/document-fields/<document_type>")
@auth_required
def update_document_field_settings(document_type: str):
    """Update field settings for the given document type.

    Request body: { "fields": [ { "key": "...", "visibility": "...", "pdf_visible": bool }, ... ] }
    """
    if document_type not in VALID_DOCUMENT_TYPES:
        return error_response("VALIDATION_ERROR", "document_type must be 'estimate' or 'invoice'.", field="document_type")

    data = request.get_json(silent=True) or {}
    fields = data.get("fields", [])
    if not isinstance(fields, list):
        return error_response("VALIDATION_ERROR", "fields must be an array.", field="fields")

    valid_keys = {f["key"] for f in CONFIGURABLE_FIELDS}

    try:
        for field_data in fields:
            key = field_data.get("key", "")
            if key not in valid_keys:
                continue
            visibility = field_data.get("visibility", "always_show")
            if visibility not in VALID_VISIBILITIES:
                continue
            pdf_visible = bool(field_data.get("pdf_visible", True))

            # Upsert
            row = DocumentFieldSettings.query.filter_by(
                document_type=document_type, field_key=key
            ).first()
            if row:
                row.visibility = visibility
                row.pdf_visible = pdf_visible
            else:
                row = DocumentFieldSettings(
                    document_type=document_type,
                    field_key=key,
                    visibility=visibility,
                    pdf_visible=pdf_visible,
                )
                db.session.add(row)

        db.session.commit()

        # Return updated settings
        settings_map = _get_settings_map(document_type)
        result = []
        for field in CONFIGURABLE_FIELDS:
            setting = settings_map.get(field["key"], {"visibility": "always_show", "pdf_visible": True})
            result.append({
                "key": field["key"],
                "label": field["label"],
                "visibility": setting["visibility"],
                "pdf_visible": setting["pdf_visible"],
            })
        return jsonify(result), 200
    except Exception:
        return server_error()
