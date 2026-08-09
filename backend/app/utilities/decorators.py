"""Utility gating decorator.

Used on blueprint routes to return 403 when the utility is disabled
for the current tenant.
"""

from functools import wraps

from flask import g, jsonify


def utility_required(utility_id: str):
    """Guard that blocks requests if the utility is disabled for the tenant."""

    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            enabled = getattr(g, "enabled_utilities", None)
            # None means "all enabled" (backwards compat / default tenant)
            if enabled is not None and utility_id not in enabled:
                return jsonify({
                    "error": {
                        "code": "UTILITY_DISABLED",
                        "message": f"The '{utility_id}' feature is not enabled for this account.",
                    }
                }), 403
            return f(*args, **kwargs)

        return wrapped

    return decorator
