"""Admin blueprint — tenant user management endpoints.

Routes:
    GET    /api/v1/admin/users          — List all users in the tenant
    PATCH  /api/v1/admin/users/<id>     — Update a user's approval status
"""

from flask import Blueprint, g, jsonify, request

from ..auth.decorators import auth_required
from ...extensions import db
from ...models import User
from .helpers import error_response

admin_bp = Blueprint("admin", __name__)


def _admin_required(f):
    """Additional check that the current user is an admin."""
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        if getattr(g, "current_user_role", None) != "admin":
            return (
                jsonify(
                    {
                        "error": {
                            "code": "FORBIDDEN",
                            "message": "Admin access required.",
                        }
                    }
                ),
                403,
            )
        return f(*args, **kwargs)

    return decorated


@admin_bp.get("/admin/users")
@auth_required
@_admin_required
def list_users():
    """List all users in the current tenant database."""
    users = User.query.order_by(User.created_at.asc()).all()
    return jsonify(
        [
            {
                "id": str(u.id),
                "email": u.email,
                "name": u.name,
                "role": u.role,
                "is_approved": u.is_approved,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    ), 200


@admin_bp.patch("/admin/users/<user_id>")
@auth_required
@_admin_required
def update_user(user_id: str):
    """Update a user's approval status or role.

    Request body (JSON):
        is_approved (bool, optional) — grant or revoke access
        role        (str, optional)  — 'admin' or 'member'
    """
    current_user_id = g.current_user_id

    # Prevent admin from modifying themselves
    if user_id == current_user_id:
        return error_response(
            "VALIDATION_ERROR", "You cannot modify your own account.", status=400
        )

    user = User.query.filter_by(id=user_id).first()
    if user is None:
        return (
            jsonify({"error": {"code": "NOT_FOUND", "message": "User not found."}}),
            404,
        )

    data = request.get_json(silent=True) or {}

    if "is_approved" in data:
        user.is_approved = bool(data["is_approved"])

    if "role" in data:
        if data["role"] not in ("admin", "member"):
            return error_response(
                "VALIDATION_ERROR",
                "Role must be 'admin' or 'member'.",
                field="role",
            )
        user.role = data["role"]

    db.session.commit()

    return jsonify(
        {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "is_approved": user.is_approved,
        }
    ), 200
