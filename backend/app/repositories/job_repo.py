# Compatibility shim
from app.core.repositories.job_repo import *  # noqa: F401,F403
from app.core.repositories.job_repo import IJobRepository, SQLAlchemyJobRepository  # noqa: F401
