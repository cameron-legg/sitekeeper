"""Business info service — get and update tenant-level business settings."""

from ...models import BusinessInfo, User
from ..repositories.business_info_repo import (
    IBusinessInfoRepository,
    SQLAlchemyBusinessInfoRepository,
)


class NotFoundError(Exception):
    """Raised when the business info row does not exist."""


class BusinessInfoService:
    """Business logic for tenant-level business information."""

    def __init__(self, repo: IBusinessInfoRepository | None = None):
        self._repo = repo or SQLAlchemyBusinessInfoRepository()

    def get_business_info(self) -> dict:
        """Return the business info for the current tenant."""
        info = self._repo.get()
        if info is None:
            raise NotFoundError("Business info not found.")
        return _serialize(info)

    def update_business_info(self, data: dict) -> dict:
        """Update business info fields and return the updated record.

        Only provided keys are updated. Unknown keys are ignored.
        """
        info = self._repo.get()
        if info is None:
            raise NotFoundError("Business info not found.")

        allowed = (
            "business_name", "state", "payment_method",
            "business_address", "business_phone", "business_email",
            "owner_user_id", "default_hourly_rate",
        )
        for key in allowed:
            if key in data:
                setattr(info, key, data[key])

        info = self._repo.update(info)
        return _serialize(info)

    def get_owner_name(self) -> str | None:
        """Return the business owner's name, or None if not set."""
        info = self._repo.get()
        if info is None or info.owner_user_id is None:
            return None
        owner = User.query.filter_by(id=info.owner_user_id).first()
        return owner.name if owner else None


def _serialize(info: BusinessInfo) -> dict:
    owner_name = None
    if info.owner is not None:
        owner_name = info.owner.name
    return {
        "id": str(info.id),
        "business_name": info.business_name,
        "state": info.state,
        "payment_method": info.payment_method,
        "business_address": info.business_address,
        "business_phone": info.business_phone,
        "business_email": info.business_email,
        "owner_user_id": str(info.owner_user_id) if info.owner_user_id else None,
        "owner_name": owner_name,
        "default_hourly_rate": str(info.default_hourly_rate) if info.default_hourly_rate is not None else None,
    }
