# Compatibility shim
from app.utilities.photos.repository import *  # noqa: F401,F403
from app.utilities.photos.repository import IJobPhotoRepository, SQLAlchemyJobPhotoRepository  # noqa: F401
