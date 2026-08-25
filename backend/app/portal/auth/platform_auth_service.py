"""Platform authentication service.

Handles signup and login for platform users (control-plane accounts).
Uses the shared_auth primitives for JWT and password operations.
Tokens include a 'platform: true' claim to distinguish them from tenant tokens.
"""

import re
from dataclasses import dataclass

from ...shared_auth import AuthError, check_password, hash_password, issue_token, validate_token
from ..models import PlatformUser
from ..platform_db import get_platform_session

# Simple but robust email regex (same as tenant auth)
_EMAIL_RE = re.compile(
    r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
)

_INVALID_CREDENTIALS_MSG = "Invalid credentials."


@dataclass
class PlatformAuthResult:
    """Returned on successful platform registration or login."""

    user_id: str
    token: str
    name: str | None = None
    email: str | None = None


class PlatformAuthService:
    """Authenticates platform users — separate from tenant auth."""

    def register(self, email: str, password: str, name: str | None = None) -> PlatformAuthResult:
        """Create a new platform user account.

        Raises:
            AuthError (INVALID_EMAIL): email format is invalid.
            AuthError (EMAIL_IN_USE): email already registered.
            AuthError (VALIDATION_ERROR): password too short.
        """
        email = email.strip().lower()

        if not _EMAIL_RE.match(email):
            raise AuthError("Email address is invalid.", code="INVALID_EMAIL")

        if not password or len(password) < 6:
            raise AuthError(
                "Password must be at least 6 characters.", code="VALIDATION_ERROR"
            )

        session = get_platform_session()
        try:
            existing = session.query(PlatformUser).filter_by(email=email).first()
            if existing is not None:
                raise AuthError(
                    "Email address is already in use.", code="EMAIL_IN_USE"
                )

            pw_hash = hash_password(password)
            user = PlatformUser(
                email=email,
                password_hash=pw_hash,
                name=name,
            )
            session.add(user)
            session.commit()

            token = issue_token(str(user.id), extra_claims={"platform": True})
            return PlatformAuthResult(
                user_id=str(user.id),
                token=token,
                name=user.name,
                email=user.email,
            )
        except AuthError:
            session.rollback()
            raise
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def login(self, email: str, password: str) -> PlatformAuthResult:
        """Authenticate an existing platform user.

        Raises:
            AuthError (INVALID_CREDENTIALS): credentials are wrong.
        """
        email = email.strip().lower()

        session = get_platform_session()
        try:
            user = session.query(PlatformUser).filter_by(email=email).first()

            if user is None or not check_password(password, user.password_hash):
                raise AuthError(_INVALID_CREDENTIALS_MSG, code="INVALID_CREDENTIALS")

            token = issue_token(str(user.id), extra_claims={"platform": True})
            return PlatformAuthResult(
                user_id=str(user.id),
                token=token,
                name=user.name,
                email=user.email,
            )
        finally:
            session.close()

    def validate_token(self, token: str) -> str:
        """Validate a platform JWT and return the user_id.

        Requires the 'platform' claim to be True. Rejects tenant tokens.

        Raises:
            AuthError (TOKEN_EXPIRED): token has expired.
            AuthError (TOKEN_INVALID): token is invalid or not a platform token.
        """
        payload = validate_token(token)

        if not payload.get("platform"):
            raise AuthError("Not a platform token.", code="TOKEN_INVALID")

        return payload["sub"]
