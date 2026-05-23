"""Business info blueprint — get and update tenant-level business settings.

Routes:
    GET  /api/v1/business-info
    PUT  /api/v1/business-info
"""

from flask import Blueprint, jsonify, request

from ..auth.decorators import auth_required
from ..services.business_info_service import BusinessInfoService, NotFoundError
from .helpers import not_found, server_error

business_info_bp = Blueprint("business_info", __name__)
_service = BusinessInfoService()


@business_info_bp.get("/business-info")
@auth_required
def get_business_info():
    """Return the tenant's business information.

    Responses:
        200  { id, business_name, state, payment_method, business_address, business_phone, business_email }
        404  business info not found
    """
    try:
        info = _service.get_business_info()
    except NotFoundError:
        return not_found("Business info")
    except Exception:
        return server_error()
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

    Responses:
        200  updated business info object
        404  business info not found
    """
    data = request.get_json(silent=True) or {}
    try:
        info = _service.update_business_info(data)
    except NotFoundError:
        return not_found("Business info")
    except Exception:
        return server_error()
    return jsonify(info), 200
