"""Flask extension instances.

Extensions are instantiated here without being bound to a specific app.
They are registered with the app inside the ``create_app`` factory via
``extension.init_app(app)``, which keeps the application factory pattern
clean and makes it easy to use the same extension instances across the
codebase without circular imports.
"""

from flask_bcrypt import Bcrypt
from flask_sqlalchemy import SQLAlchemy

# SQLAlchemy ORM instance — import ``db`` wherever models or queries are needed
db = SQLAlchemy()

# Flask-Bcrypt instance — import ``bcrypt`` in the auth service for hashing
bcrypt = Bcrypt()
