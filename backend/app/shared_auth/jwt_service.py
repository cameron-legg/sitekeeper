"""Shared JWT operations — used by both tenant auth and portal auth.

Provides token issuance and validation without any dependency on
specific User models. Each auth system adds its own claims
(e.g. platform: true for portal tokens).
"""

from datetime import datetime, timedelta, timezone

import jwt
from flask import current_app

from .errors import AuthError


def issue_token(subject: str, extra_claims: dict | None = None) -> str:
    """Issue a signed JWT for the given subject (user ID).

    Args:
        subject: The user ID string to encode in the 'sub' claim.
        extra_claims: Optional dict of additional claims (e.g. {"platform": True}).

    Returns:
        Encoded JWT string.
    """
    secret = current_app.config["JWT_SECRET"]
    expiry_seconds = current_app.config["JWT_EXPIRY_SECONDS"]
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(seconds=expiry_seconds),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, secret, algorithm="HS256")


def validate_token(token: str) -> dict:
    """Decode and validate a JWT. Returns the full payload dict.

    The caller is responsible for checking any domain-specific claims
    (e.g. verifying the 'platform' claim for portal tokens).

    Returns:
        The decoded payload dictionary.

    Raises:
        AuthError: TOKEN_EXPIRED if the token has expired.
        AuthError: TOKEN_INVALID if the token is malformed or tampered.
    """
    secret = current_app.config["JWT_SECRET"]
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise AuthError("Token has expired.", code="TOKEN_EXPIRED")
    except (jwt.InvalidTokenError, KeyError):
        raise AuthError("Invalid token.", code="TOKEN_INVALID")
