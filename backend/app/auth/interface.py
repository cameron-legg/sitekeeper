# Compatibility shim — redirects to new location
from app.core.auth.interface import *  # noqa: F401,F403
from app.core.auth.interface import AuthError, AuthResult, IAuthService  # noqa: F401
