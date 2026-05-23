"""Business info blueprint — get and update tenant-level business settings.

Routes:
    GET  /api/v1/business-info
    PUT  /api/v1/business-info
    GET  /api/v1/business-info/users  — list approved users (for owner picker)
"""

from flask import Blueprint, jsonify, request

from ..auth.decorators import auth_required
from ..models import User
from ..services.business_info_service import BusinessInfoService, NotFoundError
from .helpers import not_found, server_error

business_info_bp = Blueprint("business_info", __name__)
_service = BusinessInfoService()


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
    except Exception:
        return server_error()
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
