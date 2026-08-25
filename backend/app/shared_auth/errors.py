"""Shared auth error types."""


class AuthError(Exception):
    """Raised by auth service methods when an operation fails."""

    def __init__(self, message: str, code: str = "AUTH_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code
