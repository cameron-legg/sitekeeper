"""Auth decorators for protecting Flask routes.

Usage:
    from app.auth.decorators import auth_required

    @app.route("/api/v1/protected")
    @auth_required
    def protected():
        user_id = g.current_user_id
        ...
"""

from functools import wraps

from flask import g, jsonify, request

from .email_password import EmailPasswordAuthService
from .interface import AuthError

# Module-level service instance — stateless, safe to share
_auth_service = EmailPasswordAuthService()


def auth_required(f):
    """Decorator that validates the Bearer JWT and injects current_user_id.

    On success: sets ``flask.g.current_user_id`` to the authenticated user's
    UUID string and calls the wrapped view function.

    On failure: returns a 401 JSON response without calling the view.
    """

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return (
                jsonify(
                    {
                        "error": {
                            "code": "MISSING_TOKEN",
                            "message": "Authorization header missing or malformed.",
                        }
                    }
                ),
                401,
            )

        token = auth_header[len("Bearer "):]
        try:
            user_id = _auth_service.validate_token(token)
        except AuthError as exc:
            return (
                jsonify({"error": {"code": exc.code, "message": exc.message}}),
                401,
            )

        g.current_user_id = user_id
        return f(*args, **kwargs)

    return decorated
