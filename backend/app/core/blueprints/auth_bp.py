"""Auth blueprint — registration and login endpoints.

Routes:
    POST /api/v1/auth/register
    POST /api/v1/auth/login
"""

from flask import Blueprint, jsonify, request

from ..auth.email_password import EmailPasswordAuthService
from ..auth.interface import AuthError


auth_bp = Blueprint("auth", __name__)
_auth_service = EmailPasswordAuthService()


def _error(code: str, message: str, field: str | None = None, status: int = 400):
    body = {"error": {"code": code, "message": message}}
    if field:
        body["error"]["field"] = field
    return jsonify(body), status


@auth_bp.post("/auth/register")
def register():
    """Create a new user account.

    Request body (JSON):
        email    (str, required)
        password (str, required)

    Responses:
        201  { user_id, token }
        400  invalid email format
        409  email already in use
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email", "")
    password = data.get("password", "")

    if not email:
        return _error("VALIDATION_ERROR", "Email is required.", field="email")
    if not password:
        return _error("VALIDATION_ERROR", "Password is required.", field="password")

    try:
        result = _auth_service.register(email, password)
    except AuthError as exc:
        status = 409 if exc.code == "EMAIL_IN_USE" else 400
        field = "email" if exc.code in ("EMAIL_IN_USE", "INVALID_EMAIL") else None
        return _error(exc.code, exc.message, field=field, status=status)

    return jsonify({"user_id": result.user_id, "token": result.token, "role": result.role, "is_approved": result.is_approved}), 201


@auth_bp.post("/auth/login")
def login():
    """Authenticate an existing user.

    Request body (JSON):
        email    (str, required)
        password (str, required)

    Responses:
        200  { user_id, token, role, is_approved }
        401  invalid credentials (generic — does not reveal which field is wrong)
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email", "")
    password = data.get("password", "")

    try:
        result = _auth_service.login(email, password)
    except AuthError as exc:
        return _error(exc.code, exc.message, status=401)

    return jsonify({"user_id": result.user_id, "token": result.token, "role": result.role, "is_approved": result.is_approved}), 200
