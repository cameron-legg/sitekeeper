"""Email + password authentication service.

Concrete implementation of IAuthService using:
- bcrypt (via flask-bcrypt) for password hashing — bcrypt generates a unique
  per-password salt internally, so no separate salt column is needed.
- PyJWT for issuing and validating JWT access tokens.
"""

import re
from datetime import datetime, timezone, timedelta

import jwt
from flask import current_app

from ...extensions import bcrypt, db
from ...models import User
from .interface import AuthError, AuthResult, IAuthService

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

        password_hash = bcrypt.generate_password_hash(password).decode("utf-8")
        user = User(email=email, password_hash=password_hash)

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

        token = self._issue_token(str(user.id))
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

        if user is None or not bcrypt.check_password_hash(
            user.password_hash, password
        ):
            raise AuthError(_INVALID_CREDENTIALS_MSG, code="INVALID_CREDENTIALS")

        token = self._issue_token(str(user.id))
        return AuthResult(
            user_id=str(user.id),
            token=token,
            role=user.role,
            is_approved=user.is_approved,
        )

    def validate_token(self, token: str) -> str:
        """Decode and validate a JWT, returning the user_id.

        Raises:
            AuthError (code TOKEN_EXPIRED): token has expired.
            AuthError (code TOKEN_INVALID): token is malformed or tampered.
        """
        secret = current_app.config["JWT_SECRET"]
        try:
            payload = jwt.decode(token, secret, algorithms=["HS256"])
            return payload["sub"]
        except jwt.ExpiredSignatureError:
            raise AuthError("Token has expired.", code="TOKEN_EXPIRED")
        except (jwt.InvalidTokenError, KeyError):
            raise AuthError("Invalid token.", code="TOKEN_INVALID")

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _issue_token(self, user_id: str) -> str:
        """Create a signed JWT for the given user_id."""
        secret = current_app.config["JWT_SECRET"]
        expiry_seconds = current_app.config["JWT_EXPIRY_SECONDS"]
        now = datetime.now(tz=timezone.utc)
        payload = {
            "sub": user_id,
            "iat": now,
            "exp": now + timedelta(seconds=expiry_seconds),
        }
        return jwt.encode(payload, secret, algorithm="HS256")
