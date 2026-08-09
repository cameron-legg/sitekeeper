# Compatibility shim
from app.utilities.time_tracking.repository import *  # noqa: F401,F403
from app.utilities.time_tracking.repository import ITimeEntryRepository, SQLAlchemyTimeEntryRepository  # noqa: F401
