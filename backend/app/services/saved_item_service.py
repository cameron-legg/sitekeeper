"""Saved item service — CRUD with sub-entry support (v2)."""

from decimal import Decimal

from ..models import LineItem, LineItemEntry, SavedItem, SavedItemEntry
from ..repositories.estimate_repo import IEstimateRepository, SQLAlchemyEstimateRepository
from ..repositories.invoice_repo import IInvoiceRepository, SQLAlchemyInvoiceRepository
from ..repositories.saved_item_repo import ISavedItemRepository, SQLAlchemySavedItemRepository


class NotFoundError(Exception):
    pass


class ValidationError(Exception):
    pass


class SavedItemService:

    def __init__(
        self,
        saved_item_repo: ISavedItemRepository | None = None,
        estimate_repo: IEstimateRepository | None = None,
        invoice_repo: IInvoiceRepository | None = None,
    ):
        self._saved_item_repo = saved_item_repo or SQLAlchemySavedItemRepository()
        self._estimate_repo = estimate_repo or SQLAlchemyEstimateRepository()
        self._invoice_repo = invoice_repo or SQLAlchemyInvoiceRepository()

    # ------------------------------------------------------------------
    # SavedItem CRUD
    # ------------------------------------------------------------------

    def list_for_user(self, user_id: str) -> list[SavedItem]:
        return self._saved_item_repo.get_all_for_user(user_id)

    def get(self, item_id: str, user_id: str) -> SavedItem:
        item = self._saved_item_repo.get_by_id(item_id, user_id)
        if item is None:
            raise NotFoundError(f"Saved item {item_id} not found.")
        return item

    def create(self, user_id: str, name: str, notes: str | None = None,
               hourly_rate: Decimal | None = None) -> SavedItem:
        return self._saved_item_repo.create(SavedItem(
            user_id=user_id, name=name, notes=notes, hourly_rate=hourly_rate,
        ))

    def update(self, item_id: str, user_id: str, name: str | None = None,
               notes: str | None = None, hourly_rate: Decimal | None = None) -> SavedItem:
        item = self._saved_item_repo.get_by_id(item_id, user_id)
        if item is None:
            raise NotFoundError(f"Saved item {item_id} not found.")
        if name is not None:
            item.name = name
        if notes is not None:
            item.notes = notes
        if hourly_rate is not None:
            item.hourly_rate = hourly_rate
        return self._saved_item_repo.update(item)

    def delete(self, item_id: str, user_id: str) -> None:
        item = self._saved_item_repo.get_by_id(item_id, user_id)
        if item is None:
            raise NotFoundError(f"Saved item {item_id} not found.")
        self._saved_item_repo.delete(item_id, user_id)

    # ------------------------------------------------------------------
    # SavedItemEntry CRUD
    # ------------------------------------------------------------------

    def add_entry(self, item_id: str, user_id: str, entry_type: str, name: str,
                  notes: str | None = None, url: str | None = None,
                  unit_price: Decimal | None = None, quantity: Decimal | None = None,
                  hours: Decimal | None = None, sort_order: int = 0) -> SavedItemEntry:
        item = self._saved_item_repo.get_by_id(item_id, user_id)
        if item is None:
            raise NotFoundError(f"Saved item {item_id} not found.")
        if entry_type not in ("material", "hours"):
            raise ValidationError("entry_type must be 'material' or 'hours'.")
        entry = SavedItemEntry(
            saved_item_id=item_id, entry_type=entry_type, name=name,
            notes=notes, url=url, unit_price=unit_price, quantity=quantity,
            hours=hours, sort_order=sort_order,
        )
        return self._saved_item_repo.add_entry(entry)

    def update_entry(self, item_id: str, entry_id: str, user_id: str,
                     name: str | None = None, notes: str | None = None,
                     url: str | None = None, unit_price: Decimal | None = None,
                     quantity: Decimal | None = None, hours: Decimal | None = None,
                     sort_order: int | None = None) -> SavedItemEntry:
        item = self._saved_item_repo.get_by_id(item_id, user_id)
        if item is None:
            raise NotFoundError(f"Saved item {item_id} not found.")
        entry = self._saved_item_repo.get_entry_by_id(entry_id)
        if entry is None or str(entry.saved_item_id) != item_id:
            raise NotFoundError(f"Entry {entry_id} not found.")
        if name is not None:
            entry.name = name
        if notes is not None:
            entry.notes = notes
        if url is not None:
            entry.url = url
        if unit_price is not None:
            entry.unit_price = unit_price
        if quantity is not None:
            entry.quantity = quantity
        if hours is not None:
            entry.hours = hours
        if sort_order is not None:
            entry.sort_order = sort_order
        return self._saved_item_repo.update_entry(entry)

    def delete_entry(self, item_id: str, entry_id: str, user_id: str) -> None:
        item = self._saved_item_repo.get_by_id(item_id, user_id)
        if item is None:
            raise NotFoundError(f"Saved item {item_id} not found.")
        entry = self._saved_item_repo.get_entry_by_id(entry_id)
        if entry is None or str(entry.saved_item_id) != item_id:
            raise NotFoundError(f"Entry {entry_id} not found.")
        self._saved_item_repo.delete_entry(entry_id)

    # ------------------------------------------------------------------
    # Snapshot: copy saved item into a real LineItem
    # ------------------------------------------------------------------

    def populate_line_item(self, saved_item_id: str, user_id: str,
                           parent_id: str, parent_type: str) -> LineItem:
        if parent_type not in ("estimate", "invoice"):
            raise ValidationError("parent_type must be 'estimate' or 'invoice'.")

        saved = self._saved_item_repo.get_by_id(saved_item_id, user_id)
        if saved is None:
            raise NotFoundError(f"Saved item {saved_item_id} not found.")

        if parent_type == "estimate":
            parent = self._estimate_repo.get_by_id(parent_id)
            if parent is None:
                raise NotFoundError(f"Estimate {parent_id} not found.")
        else:
            parent = self._invoice_repo.get_by_id(parent_id)
            if parent is None:
                raise NotFoundError(f"Invoice {parent_id} not found.")

        line_item = LineItem(
            parent_id=parent_id, parent_type=parent_type,
            name=saved.name, notes=saved.notes, hourly_rate=saved.hourly_rate,
            sort_order=0,
        )

        if parent_type == "estimate":
            line_item = self._estimate_repo.add_line_item(line_item)
            repo = self._estimate_repo
        else:
            line_item = self._invoice_repo.add_line_item(line_item)
            repo = self._invoice_repo

        # Copy entries as independent snapshots
        for src in saved.entries:
            entry = LineItemEntry(
                line_item_id=str(line_item.id),
                entry_type=src.entry_type,
                name=src.name, notes=src.notes, url=src.url,
                unit_price=src.unit_price, quantity=src.quantity,
                hours=src.hours, sort_order=src.sort_order,
            )
            repo.add_entry(entry)

        return line_item
