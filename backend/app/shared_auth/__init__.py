"""Shared authentication primitives.

This module provides JWT and password operations used by both
the tenant auth system and the platform portal auth system.
"""

from .errors import AuthError
from .jwt_service import issue_token, validate_token
from .password import check_password, hash_password

__all__ = [
    "AuthError",
    "issue_token",
    "validate_token",
    "hash_password",
    "check_password",
]
