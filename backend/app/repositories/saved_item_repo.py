"""Saved item repository — interface and SQLAlchemy implementation (v2)."""

from abc import ABC, abstractmethod

from ..extensions import db
from ..models import SavedItem, SavedItemEntry


class ISavedItemRepository(ABC):

    @abstractmethod
    def get_all_for_user(self, user_id: str) -> list[SavedItem]: ...

    @abstractmethod
    def get_by_id(self, item_id: str, user_id: str) -> SavedItem | None: ...

    @abstractmethod
    def create(self, item: SavedItem) -> SavedItem: ...

    @abstractmethod
    def update(self, item: SavedItem) -> SavedItem: ...

    @abstractmethod
    def delete(self, item_id: str, user_id: str) -> None: ...

    @abstractmethod
    def add_entry(self, entry: SavedItemEntry) -> SavedItemEntry: ...

    @abstractmethod
    def update_entry(self, entry: SavedItemEntry) -> SavedItemEntry: ...

    @abstractmethod
    def delete_entry(self, entry_id: str) -> None: ...

    @abstractmethod
    def get_entry_by_id(self, entry_id: str) -> SavedItemEntry | None: ...

    @abstractmethod
    def get_all_entries_for_user(self, user_id: str) -> list[SavedItemEntry]: ...


class SQLAlchemySavedItemRepository(ISavedItemRepository):

    def get_all_for_user(self, user_id: str) -> list[SavedItem]:
        return (
            SavedItem.query.filter_by(user_id=user_id)
            .order_by(SavedItem.created_at.desc())
            .all()
        )

    def get_by_id(self, item_id: str, user_id: str) -> SavedItem | None:
        return SavedItem.query.filter_by(id=item_id, user_id=user_id).first()

    def create(self, item: SavedItem) -> SavedItem:
        db.session.add(item)
        db.session.commit()
        db.session.refresh(item)
        return item

    def update(self, item: SavedItem) -> SavedItem:
        db.session.commit()
        db.session.refresh(item)
        return item

    def delete(self, item_id: str, user_id: str) -> None:
        item = SavedItem.query.filter_by(id=item_id, user_id=user_id).first()
        if item:
            db.session.delete(item)
            db.session.commit()

    def add_entry(self, entry: SavedItemEntry) -> SavedItemEntry:
        db.session.add(entry)
        db.session.commit()
        db.session.refresh(entry)
        return entry

    def update_entry(self, entry: SavedItemEntry) -> SavedItemEntry:
        db.session.commit()
        db.session.refresh(entry)
        return entry

    def delete_entry(self, entry_id: str) -> None:
        entry = SavedItemEntry.query.filter_by(id=entry_id).first()
        if entry:
            db.session.delete(entry)
            db.session.commit()

    def get_entry_by_id(self, entry_id: str) -> SavedItemEntry | None:
        return SavedItemEntry.query.filter_by(id=entry_id).first()

    def get_all_entries_for_user(self, user_id: str) -> list[SavedItemEntry]:
        return (
            SavedItemEntry.query
            .join(SavedItem, SavedItemEntry.saved_item_id == SavedItem.id)
            .filter(SavedItem.user_id == user_id)
            .order_by(SavedItemEntry.name.asc())
            .all()
        )
