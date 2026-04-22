"""Shared helpers for blueprint error responses."""

from flask import jsonify


def error_response(
    code: str,
    message: str,
    field: str | None = None,
    status: int = 400,
):
    """Return a consistent JSON error envelope."""
    body: dict = {"error": {"code": code, "message": message}}
    if field is not None:
        body["error"]["field"] = field
    return jsonify(body), status


def not_found(resource: str = "Resource"):
    return error_response("NOT_FOUND", f"{resource} not found.", status=404)


def unauthorized():
    return error_response("UNAUTHORIZED", "Authentication required.", status=401)


def server_error(message: str = "An unexpected error occurred."):
    return error_response("SERVER_ERROR", message, status=500)
