"""Profile blueprint — get and update user profile settings.

Routes:
    GET  /api/v1/profile
    PUT  /api/v1/profile
"""

from flask import Blueprint, g, jsonify, request

from ..auth.decorators import auth_required
from ..services.profile_service import NotFoundError, ProfileService
from .helpers import not_found, server_error

profile_bp = Blueprint("profile", __name__)
_service = ProfileService()


@profile_bp.get("/profile")
@auth_required
def get_profile():
    """Return the current user's profile settings.

    Responses:
        200  { id, email, name, phone }
        404  user not found (should not happen for authenticated users)
    """
    try:
        profile = _service.get_profile(g.current_user_id)
    except NotFoundError:
        return not_found("User")
    except Exception:
        return server_error()
    return jsonify(profile), 200


@profile_bp.put("/profile")
@auth_required
def update_profile():
    """Update the current user's profile settings.

    Request body (JSON) — all fields optional:
        name   (str | null)
        phone  (str | null)

    Responses:
        200  updated profile object
        404  user not found
    """
    data = request.get_json(silent=True) or {}
    try:
        profile = _service.update_profile(g.current_user_id, data)
    except NotFoundError:
        return not_found("User")
    except Exception:
        return server_error()
    return jsonify(profile), 200
