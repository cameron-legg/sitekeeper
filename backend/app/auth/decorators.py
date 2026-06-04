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

    On success: sets ``flask.g.current_user_id``, ``flask.g.current_user_role``,
    and ``flask.g.current_user_is_approved`` then calls the wrapped view function.

    On failure: returns a 401 JSON response without calling the view.
    """

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = None

        if auth_header.startswith("Bearer "):
            token = auth_header[len("Bearer "):]
        else:
            # Fall back to ?token= query parameter (used by <Image> components
            # that cannot set custom headers, e.g. React Native on web)
            token = request.args.get("token")

        if not token:
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
        try:
            user_id = _auth_service.validate_token(token)
        except AuthError as exc:
            return (
                jsonify({"error": {"code": exc.code, "message": exc.message}}),
                401,
            )

        # Load user to check role and approval status
        from ..models import User
        user = User.query.filter_by(id=user_id).first()
        if user is None:
            return (
                jsonify({"error": {"code": "USER_NOT_FOUND", "message": "User no longer exists."}}),
                401,
            )

        if not user.is_approved:
            return (
                jsonify({"error": {"code": "NOT_APPROVED", "message": "Your account is pending approval by the admin."}}),
                403,
            )

        g.current_user_id = user_id
        g.current_user_role = user.role
        g.current_user_is_approved = user.is_approved
        return f(*args, **kwargs)

    return decorated
