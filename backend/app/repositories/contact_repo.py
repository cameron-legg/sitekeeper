# Compatibility shim
from app.utilities.contacts.repository import *  # noqa: F401,F403
from app.utilities.contacts.repository import IContactRepository, SQLAlchemyContactRepository  # noqa: F401
