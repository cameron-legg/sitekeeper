"""Business info repository — interface and SQLAlchemy implementation."""

from abc import ABC, abstractmethod

from ..extensions import db
from ..models import BusinessInfo


class IBusinessInfoRepository(ABC):
    """Abstract interface for business info persistence operations."""

    @abstractmethod
    def get(self) -> BusinessInfo | None:
        """Return the single business_info row, or None."""
        ...

    @abstractmethod
    def update(self, info: BusinessInfo) -> BusinessInfo:
        """Persist changes to the business info and return the updated record."""
        ...


class SQLAlchemyBusinessInfoRepository(IBusinessInfoRepository):
    """SQLAlchemy-backed implementation of IBusinessInfoRepository."""

    def get(self) -> BusinessInfo | None:
        return BusinessInfo.query.first()

    def update(self, info: BusinessInfo) -> BusinessInfo:
        db.session.commit()
        db.session.refresh(info)
        return info
