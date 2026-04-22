"""Pytest configuration and shared fixtures for the backend test suite."""

import pytest

from app import create_app
from app.config import TestingConfig


@pytest.fixture(scope="session")
def app():
    """Create a Flask application instance configured for testing.

    Uses ``TestingConfig`` which points to the ``db_test`` PostgreSQL
    container (port 5433).  The ``DATABASE_URL`` environment variable
    can override this when running tests in CI or other environments.
    """
    flask_app = create_app(TestingConfig)
    yield flask_app


@pytest.fixture()
def client(app):
    """Return a Flask test client for making HTTP requests in tests."""
    return app.test_client()


@pytest.fixture()
def app_context(app):
    """Push an application context so that ``current_app`` and ``g`` work."""
    with app.app_context():
        yield app
