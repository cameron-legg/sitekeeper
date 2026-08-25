"""Email + password authentication service.

Concrete implementation of IAuthService using:
- bcrypt (via flask-bcrypt) for password hashing — bcrypt generates a unique
  per-password salt internally, so no separate salt column is needed.
- PyJWT for issuing and validating JWT access tokens.

All cryptographic operations are delegated to app.shared_auth so that
both tenant and platform auth share the same primitives.
"""

import re

from ...extensions import db
from ...models import User
from ...shared_auth import check_password, hash_password, issue_token, validate_token
from ...shared_auth.errors import AuthError
from .interface import AuthResult, IAuthService

# Re-export AuthError so existing imports from this module still work
AuthError = AuthError  # noqa: F811

# Simple but robust email regex (RFC 5321 local-part + domain)
_EMAIL_RE = re.compile(
    r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
)

_INVALID_CREDENTIALS_MSG = "Invalid credentials."


def _is_valid_email(email: str) -> bool:
    return bool(_EMAIL_RE.match(email))


class EmailPasswordAuthService(IAuthService):
    """Authenticates users with email + bcrypt-hashed password, issues JWTs."""

    def register(self, email: str, password: str) -> AuthResult:
        """Create a new account.

        Raises:
            AuthError (code INVALID_EMAIL): email format is invalid.
            AuthError (code EMAIL_IN_USE): email already registered.
        """
        email = email.strip().lower()

        if not _is_valid_email(email):
            raise AuthError("Email address is invalid.", code="INVALID_EMAIL")

        if User.query.filter_by(email=email).first() is not None:
            raise AuthError(
                "Email address is already in use.", code="EMAIL_IN_USE"
            )

        pw_hash = hash_password(password)
        user = User(email=email, password_hash=pw_hash)

        # First user in the database becomes admin and is auto-approved.
        # Subsequent users are members and must be approved by the admin.
        existing_user_count = User.query.count()
        if existing_user_count == 0:
            user.role = "admin"
            user.is_approved = True
        else:
            user.role = "member"
            user.is_approved = False

        db.session.add(user)
        db.session.commit()

        token = issue_token(str(user.id))
        return AuthResult(
            user_id=str(user.id),
            token=token,
            role=user.role,
            is_approved=user.is_approved,
        )

    def login(self, email: str, password: str) -> AuthResult:
        """Authenticate an existing user.

        Always raises the same generic error regardless of whether the email
        or password is wrong (Requirement 1.5).

        Raises:
            AuthError (code INVALID_CREDENTIALS): credentials are wrong.
        """
        email = email.strip().lower()
        user = User.query.filter_by(email=email).first()

        if user is None or not check_password(password, user.password_hash):
            raise AuthError(_INVALID_CREDENTIALS_MSG, code="INVALID_CREDENTIALS")

        token = issue_token(str(user.id))
        return AuthResult(
            user_id=str(user.id),
            token=token,
            role=user.role,
            is_approved=user.is_approved,
        )

    def validate_token(self, token: str) -> str:
        """Decode and validate a JWT, returning the user_id.

        Rejects tokens with the 'platform' claim (those are portal tokens
        and cannot be used for tenant access).

        Raises:
            AuthError (code TOKEN_EXPIRED): token has expired.
            AuthError (code TOKEN_INVALID): token is malformed or tampered.
        """
        payload = validate_token(token)

        # Reject platform portal tokens — they cannot access tenant routes
        if payload.get("platform"):
            raise AuthError("Invalid token.", code="TOKEN_INVALID")

        return payload["sub"]
