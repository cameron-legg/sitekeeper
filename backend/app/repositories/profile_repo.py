# Compatibility shim
from app.core.repositories.profile_repo import *  # noqa: F401,F403
from app.core.repositories.profile_repo import IProfileRepository, SQLAlchemyProfileRepository  # noqa: F401
