"""Application error hierarchy.

These exceptions let route/service/repository code raise domain errors that
the global error handler (registered in create_app) turns into consistent
JSON responses.

Design:
- ``AppError`` is the base. It carries an error ``code``, a human ``message``,
  an optional ``field`` (for validation), and an HTTP ``status``.
- Subclasses fill in sensible defaults for common cases.
- 4xx errors are considered *expected* (the caller's fault) and are NOT
  written to the backend_error_log — that table is reserved for real bugs.
- Anything that is a 5xx (``AppError`` with status >= 500) or any exception
  that is NOT an ``AppError`` (a bare ``KeyError``, ``IntegrityError``, etc.)
  is treated as an unexpected server error, logged with a full stack trace,
  and returned to the client as a generic 500.

This formalizes the ad-hoc ``ValidationError`` / ``NotFoundError`` classes
that previously lived inside individual services.
"""

from __future__ import annotations


class AppError(Exception):
    """Base class for expected application errors.

    Attributes:
        message: Human-readable message safe to show the user.
        code: Machine-readable error code for the response envelope.
        status: HTTP status code to return.
        field: Optional field name for validation errors.
    """

    code = "APP_ERROR"
    status = 400

    def __init__(
        self,
        message: str = "",
        code: str | None = None,
        status: int | None = None,
        field: str | None = None,
    ):
        super().__init__(message or self.__class__.__name__)
        self.message = message or "An error occurred."
        if code is not None:
            self.code = code
        if status is not None:
            self.status = status
        self.field = field

    @property
    def is_server_error(self) -> bool:
        """True if this should be logged as a server error (5xx)."""
        return self.status >= 500

    def to_dict(self) -> dict:
        body: dict = {"code": self.code, "message": self.message}
        if self.field is not None:
            body["field"] = self.field
        return body


class ValidationError(AppError):
    """The request was malformed or failed a business rule (400)."""

    code = "VALIDATION_ERROR"
    status = 400


class NotFoundError(AppError):
    """A referenced resource does not exist (404)."""

    code = "NOT_FOUND"
    status = 404

    def __init__(self, resource: str = "Resource", **kwargs):
        super().__init__(message=f"{resource} not found.", **kwargs)


class AuthorizationError(AppError):
    """The caller is authenticated but not allowed to do this (403)."""

    code = "FORBIDDEN"
    status = 403


class ServerError(AppError):
    """An unexpected server-side failure (500). Logged with a stack trace."""

    code = "SERVER_ERROR"
    status = 500

    def __init__(self, message: str = "An unexpected error occurred.", **kwargs):
        super().__init__(message=message, **kwargs)
