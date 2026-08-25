# Compatibility shim — redirects to new location
from app.core.auth.interface import *  # noqa: F401,F403
from app.core.auth.interface import AuthResult, IAuthService  # noqa: F401
from app.shared_auth.errors import AuthError  # noqa: F401
