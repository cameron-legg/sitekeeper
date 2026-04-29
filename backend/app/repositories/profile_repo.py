"""User profile repository — interface and SQLAlchemy implementation."""

from abc import ABC, abstractmethod

from ..extensions import db
from ..models import User


class IProfileRepository(ABC):
    """Abstract interface for user profile persistence operations."""

    @abstractmethod
    def get_by_id(self, user_id: str) -> User | None:
        """Return the user with the given id, or None."""
        ...

    @abstractmethod
    def update(self, user: User) -> User:
        """Persist changes to an existing user and return the updated record."""
        ...


class SQLAlchemyProfileRepository(IProfileRepository):
    """SQLAlchemy-backed implementation of IProfileRepository."""

    def get_by_id(self, user_id: str) -> User | None:
        return User.query.filter_by(id=user_id).first()

    def update(self, user: User) -> User:
        db.session.commit()
        db.session.refresh(user)
        return user
