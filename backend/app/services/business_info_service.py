"""Business info service — get and update tenant-level business settings."""

from ..models import BusinessInfo
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
        )
        for key in allowed:
            if key in data:
                setattr(info, key, data[key])

        info = self._repo.update(info)
        return _serialize(info)


def _serialize(info: BusinessInfo) -> dict:
    return {
        "id": str(info.id),
        "business_name": info.business_name,
        "state": info.state,
        "payment_method": info.payment_method,
        "business_address": info.business_address,
        "business_phone": info.business_phone,
        "business_email": info.business_email,
    }
