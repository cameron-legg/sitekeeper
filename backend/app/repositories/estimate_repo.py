"""Estimate repository — interface and SQLAlchemy implementation (v2)."""

from abc import ABC, abstractmethod

from ..extensions import db
from ..models import Estimate, LineItem, LineItemEntry


class IEstimateRepository(ABC):

    @abstractmethod
    def get_for_job(self, job_id: str) -> list[Estimate]: ...

    @abstractmethod
    def get_by_id(self, estimate_id: str) -> Estimate | None: ...

    @abstractmethod
    def create(self, estimate: Estimate) -> Estimate: ...

    @abstractmethod
    def update(self, estimate: Estimate) -> Estimate: ...

    @abstractmethod
    def delete(self, estimate_id: str) -> None: ...

    @abstractmethod
    def get_line_items(self, estimate_id: str) -> list[LineItem]: ...

    @abstractmethod
    def get_line_item_by_id(self, item_id: str) -> LineItem | None: ...

    @abstractmethod
    def add_line_item(self, item: LineItem) -> LineItem: ...

    @abstractmethod
    def update_line_item(self, item: LineItem) -> LineItem: ...

    @abstractmethod
    def delete_line_item(self, item_id: str) -> None: ...

    @abstractmethod
    def add_entry(self, entry: LineItemEntry) -> LineItemEntry: ...

    @abstractmethod
    def update_entry(self, entry: LineItemEntry) -> LineItemEntry: ...

    @abstractmethod
    def delete_entry(self, entry_id: str) -> None: ...

    @abstractmethod
    def get_entry_by_id(self, entry_id: str) -> LineItemEntry | None: ...


class SQLAlchemyEstimateRepository(IEstimateRepository):

    def get_for_job(self, job_id: str) -> list[Estimate]:
        return (
            Estimate.query.filter_by(job_id=job_id)
            .order_by(Estimate.created_at.desc())
            .all()
        )

    def get_by_id(self, estimate_id: str) -> Estimate | None:
        return Estimate.query.filter_by(id=estimate_id).first()

    def create(self, estimate: Estimate) -> Estimate:
        db.session.add(estimate)
        db.session.commit()
        db.session.refresh(estimate)
        return estimate

    def update(self, estimate: Estimate) -> Estimate:
        db.session.commit()
        db.session.refresh(estimate)
        return estimate

    def delete(self, estimate_id: str) -> None:
        estimate = Estimate.query.filter_by(id=estimate_id).first()
        if estimate:
            db.session.delete(estimate)
            db.session.commit()

    def get_line_items(self, estimate_id: str) -> list[LineItem]:
        return (
            LineItem.query.filter_by(parent_id=estimate_id, parent_type="estimate")
            .order_by(LineItem.sort_order.asc(), LineItem.id.asc())
            .all()
        )

    def get_line_item_by_id(self, item_id: str) -> LineItem | None:
        return LineItem.query.filter_by(id=item_id, parent_type="estimate").first()

    def add_line_item(self, item: LineItem) -> LineItem:
        db.session.add(item)
        db.session.commit()
        db.session.refresh(item)
        return item

    def update_line_item(self, item: LineItem) -> LineItem:
        db.session.commit()
        db.session.refresh(item)
        return item

    def delete_line_item(self, item_id: str) -> None:
        item = LineItem.query.filter_by(id=item_id, parent_type="estimate").first()
        if item:
            db.session.delete(item)
            db.session.commit()

    def add_entry(self, entry: LineItemEntry) -> LineItemEntry:
        db.session.add(entry)
        db.session.commit()
        db.session.refresh(entry)
        return entry

    def update_entry(self, entry: LineItemEntry) -> LineItemEntry:
        db.session.commit()
        db.session.refresh(entry)
        return entry

    def delete_entry(self, entry_id: str) -> None:
        entry = LineItemEntry.query.filter_by(id=entry_id).first()
        if entry:
            db.session.delete(entry)
            db.session.commit()

    def get_entry_by_id(self, entry_id: str) -> LineItemEntry | None:
        return LineItemEntry.query.filter_by(id=entry_id).first()
