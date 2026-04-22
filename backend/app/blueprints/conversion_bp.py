"""Conversion blueprint.

Routes:
    POST /api/v1/estimates/<id>/convert-to-invoice — convert an estimate to an invoice
"""

from flask import Blueprint, g, jsonify

from ..auth.decorators import auth_required
from ..services.conversion_service import ConversionService, NotFoundError
from .helpers import not_found, server_error

conversion_bp = Blueprint("conversion", __name__)
_service = ConversionService()


def _serialize_invoice(invoice) -> dict:
    return {
        "id": str(invoice.id),
        "job_id": str(invoice.job_id),
        "title": invoice.title,
        "delivered": invoice.delivered,
        "source_estimate_id": str(invoice.source_estimate_id) if invoice.source_estimate_id else None,
        "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
        "updated_at": invoice.updated_at.isoformat() if invoice.updated_at else None,
    }


@conversion_bp.post("/estimates/<estimate_id>/convert-to-invoice")
@auth_required
def convert_to_invoice(estimate_id: str):
    """Convert an estimate to a new invoice, copying all line items."""
    user_id = g.current_user_id
    try:
        invoice = _service.convert(estimate_id=estimate_id, user_id=user_id)
        return jsonify(_serialize_invoice(invoice)), 201
    except NotFoundError:
        return not_found("Estimate")
    except Exception:
        return server_error()
