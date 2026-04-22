"""Auth service interface.

Defines the contract that all authentication implementations must satisfy.
Swap out ``EmailPasswordAuthService`` for any other provider (OAuth, SSO, etc.)
without touching any other part of the codebase.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


class AuthError(Exception):
    """Raised by auth service methods when an operation fails."""

    def __init__(self, message: str, code: str = "AUTH_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code


@dataclass
class AuthResult:
    """Returned on successful registration or login."""

    user_id: str
    token: str


class IAuthService(ABC):
    """Abstract base class for authentication providers."""

    @abstractmethod
    def register(self, email: str, password: str) -> AuthResult:
        """Create a new user account and return a session token.

        Raises:
            AuthError: If the email is already in use or invalid.
        """
        ...

    @abstractmethod
    def login(self, email: str, password: str) -> AuthResult:
        """Authenticate an existing user and return a session token.

        Raises:
            AuthError: If credentials are invalid (generic message — does not
                       reveal which field is wrong).
        """
        ...

    @abstractmethod
    def validate_token(self, token: str) -> str:
        """Validate a JWT and return the user_id encoded in it.

        Raises:
            AuthError: If the token is missing, expired, or malformed.
        """
        ...
