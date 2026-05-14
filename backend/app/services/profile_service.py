"""User profile service — get and update profile settings."""

from ..models import User
from ..repositories.profile_repo import IProfileRepository, SQLAlchemyProfileRepository


class NotFoundError(Exception):
    """Raised when the user does not exist."""


class ProfileService:
    """Business logic for user profile management."""

    def __init__(self, repo: IProfileRepository | None = None):
        self._repo = repo or SQLAlchemyProfileRepository()

    def get_profile(self, user_id: str) -> dict:
        """Return the profile fields for the given user."""
        user = self._repo.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found.")
        return _serialize(user)

    def update_profile(self, user_id: str, data: dict) -> dict:
        """Update profile fields and return the updated profile.

        Only provided keys are updated. Unknown keys are ignored.
        """
        user = self._repo.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found.")

        allowed = ("name", "state", "company_name", "phone", "payment_method", "address")
        for key in allowed:
            if key in data:
                setattr(user, key, data[key])

        user = self._repo.update(user)
        return _serialize(user)


def _serialize(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "state": user.state,
        "company_name": user.company_name,
        "phone": user.phone,
        "payment_method": user.payment_method,
        "address": user.address,
    }
