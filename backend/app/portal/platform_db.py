"""Dedicated connection to the platform database (sk_platform).

This engine is initialized once at app startup and provides a session
factory for portal operations. It is completely independent from the
tenant engine-swap mechanism in tenant.py — per-request engine swaps
never affect the platform connection.

Usage:
    from app.portal.platform_db import get_platform_session

    session = get_platform_session()
    try:
        user = session.query(PlatformUser).filter_by(email=email).first()
        ...
        session.commit()
    finally:
        session.close()
"""

import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, scoped_session, sessionmaker

logger = logging.getLogger(__name__)

_engine = None
_session_factory = None


def init_platform_db(app):
    """Initialize the platform DB engine. Called once from create_app().

    Reads PLATFORM_DATABASE_URL from app config. If not set, the platform
    portal features will be unavailable (graceful degradation for local dev
    without the platform DB).
    """
    global _engine, _session_factory

    url = app.config.get("PLATFORM_DATABASE_URL")
    if not url:
        logger.warning(
            "PLATFORM_DATABASE_URL not configured — platform portal features disabled."
        )
        return

    _engine = create_engine(
        url,
        pool_size=3,
        max_overflow=5,
        pool_recycle=300,
        pool_pre_ping=True,
    )
    _session_factory = scoped_session(sessionmaker(bind=_engine))
    logger.info("Platform database engine initialized: %s", url.split("@")[-1])


def get_platform_session() -> Session:
    """Get a scoped session bound to the platform database.

    Returns:
        A SQLAlchemy Session instance.

    Raises:
        RuntimeError: If the platform DB has not been initialized.
    """
    if _session_factory is None:
        raise RuntimeError(
            "Platform database not initialized. "
            "Set PLATFORM_DATABASE_URL in your environment."
        )
    return _session_factory()


def remove_platform_session():
    """Remove the current scoped session (call at end of request if needed)."""
    if _session_factory is not None:
        _session_factory.remove()


def get_platform_engine():
    """Get the raw platform engine (for Alembic or raw SQL operations).

    Returns:
        The SQLAlchemy Engine instance, or None if not initialized.
    """
    return _engine


def is_platform_db_available() -> bool:
    """Check whether the platform database connection is configured."""
    return _engine is not None
