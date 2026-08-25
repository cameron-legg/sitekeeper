"""Portal auth blueprint — platform user signup and login.

Routes:
    POST /api/v1/portal/auth/signup   — create a platform account
    POST /api/v1/portal/auth/login    — authenticate and get a platform token
    GET  /api/v1/portal/auth/me       — get current platform user profile
"""

from flask import Blueprint, g, jsonify, request

from ...shared_auth.errors import AuthError
from ..auth.decorators import platform_auth_required
from ..auth.platform_auth_service import PlatformAuthService

portal_auth_bp = Blueprint("portal_auth", __name__)
_auth_service = PlatformAuthService()


def _error(code: str, message: str, field: str | None = None, status: int = 400):
    body = {"error": {"code": code, "message": message}}
    if field:
        body["error"]["field"] = field
    return jsonify(body), status


@portal_auth_bp.post("/auth/signup")
def signup():
    """Create a new platform user account.

    Request body (JSON):
        email    (str, required)
        password (str, required)
        name     (str, optional)

    Responses:
        201  { user_id, token, name, email }
        400  validation error
        409  email already in use
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email", "")
    password = data.get("password", "")
    name = data.get("name")

    if not email:
        return _error("VALIDATION_ERROR", "Email is required.", field="email")
    if not password:
        return _error("VALIDATION_ERROR", "Password is required.", field="password")

    try:
        result = _auth_service.register(email, password, name=name)
    except AuthError as exc:
        status = 409 if exc.code == "EMAIL_IN_USE" else 400
        field = "email" if exc.code in ("EMAIL_IN_USE", "INVALID_EMAIL") else None
        return _error(exc.code, exc.message, field=field, status=status)

    return jsonify({
        "user_id": result.user_id,
        "token": result.token,
        "name": result.name,
        "email": result.email,
    }), 201


@portal_auth_bp.post("/auth/login")
def login():
    """Authenticate a platform user.

    Request body (JSON):
        email    (str, required)
        password (str, required)

    Responses:
        200  { user_id, token, name, email }
        401  invalid credentials
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email", "")
    password = data.get("password", "")

    try:
        result = _auth_service.login(email, password)
    except AuthError as exc:
        return _error(exc.code, exc.message, status=401)

    return jsonify({
        "user_id": result.user_id,
        "token": result.token,
        "name": result.name,
        "email": result.email,
    }), 200


@portal_auth_bp.get("/auth/me")
@platform_auth_required
def me():
    """Get the current platform user's profile.

    Requires a valid platform Bearer token.

    Responses:
        200  { id, email, name, created_at }
    """
    user = g.platform_user
    return jsonify({
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }), 200
