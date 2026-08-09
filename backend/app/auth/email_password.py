# Compatibility shim — redirects to new location
from app.core.auth.email_password import *  # noqa: F401,F403
from app.core.auth.email_password import EmailPasswordAuthService  # noqa: F401
