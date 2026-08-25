"""Portal auth decorators for protecting platform routes.

Usage:
    from app.portal.auth.decorators import platform_auth_required

    @portal_bp.route("/portal/protected")
    @platform_auth_required
    def protected():
        user_id = g.platform_user_id
        ...
"""

from functools import wraps

from flask import g, jsonify, request

from ...shared_auth.errors import AuthError
from .platform_auth_service import PlatformAuthService

_platform_auth = PlatformAuthService()


def platform_auth_required(f):
    """Decorator that validates a platform Bearer JWT.

    On success: sets ``flask.g.platform_user_id`` and ``flask.g.platform_user``
    then calls the wrapped view function.

    On failure: returns a 401 JSON response without calling the view.
    """

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = None

        if auth_header.startswith("Bearer "):
            token = auth_header[len("Bearer "):]

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
            user_id = _platform_auth.validate_token(token)
        except AuthError as exc:
            return (
                jsonify({"error": {"code": exc.code, "message": exc.message}}),
                401,
            )

        # Load the platform user to make it available on g
        from ..models import PlatformUser
        from ..platform_db import get_platform_session

        session = get_platform_session()
        try:
            user = session.query(PlatformUser).filter_by(id=user_id).first()
            if user is None:
                return (
                    jsonify(
                        {
                            "error": {
                                "code": "USER_NOT_FOUND",
                                "message": "Platform user no longer exists.",
                            }
                        }
                    ),
                    401,
                )

            g.platform_user_id = str(user.id)
            g.platform_user = user
            g.platform_session = session
        except Exception:
            session.close()
            raise

        # Note: session is kept open during request so g.platform_user stays valid.
        # It's closed in the teardown registered by the app factory.
        return f(*args, **kwargs)

    return decorated
