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

    def list_all_entries_for_user(self, user_id: str) -> list:
        """Return all saved item entries in the tenant as a flat list (both standalone and grouped)."""
        return self._saved_item_repo.get_all_entries()

    def add_entry(self, item_id: str, user_id: str, entry_type: str, name: str,
                  notes: str | None = None, url: str | None = None,
                  unit_price: Decimal | None = None, quantity: Decimal | None = None,
                  hours: Decimal | None = None, sort_order: int = 0) -> SavedItemEntry:
        item = self._saved_item_repo.get_by_id(item_id, user_id)
        if item is None:
            raise NotFoundError(f"Saved item {item_id} not found.")
        if entry_type not in ("material", "hours", "fee"):
            raise ValidationError("entry_type must be 'material', 'hours', or 'fee'.")
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
    # Standalone entry CRUD (Materials Library — no parent SavedItem)
    # ------------------------------------------------------------------

    def update_standalone_entry(self, entry_id: str, user_id: str,
                                name: str | None = None, notes: str | None = None,
                                url: str | None = None, unit_price: Decimal | None = None,
                                quantity: Decimal | None = None, hours: Decimal | None = None) -> SavedItemEntry:
        entry = self._saved_item_repo.get_entry_by_id(entry_id)
        if entry is None:
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
        return self._saved_item_repo.update_entry(entry)

    def delete_standalone_entry(self, entry_id: str, user_id: str) -> dict:
        """Delete an entry. Returns info about whether it was part of an item."""
        entry = self._saved_item_repo.get_entry_by_id(entry_id)
        if entry is None:
            raise NotFoundError(f"Entry {entry_id} not found.")
        parent_item_name = None
        if entry.saved_item_id is not None:
            parent = self._saved_item_repo.get_by_id(str(entry.saved_item_id), user_id)
            if parent:
                parent_item_name = parent.name
        self._saved_item_repo.delete_entry(entry_id)
        return {"deleted": True, "parent_item_name": parent_item_name}

    def assign_entry_to_item(self, item_id: str, entry_id: str, user_id: str) -> SavedItemEntry:
        """Assign an existing entry to a SavedItem (set its saved_item_id)."""
        item = self._saved_item_repo.get_by_id(item_id, user_id)
        if item is None:
            raise NotFoundError(f"Saved item {item_id} not found.")
        entry = self._saved_item_repo.get_entry_by_id(entry_id)
        if entry is None:
            raise NotFoundError(f"Entry {entry_id} not found.")
        entry.saved_item_id = item_id
        return self._saved_item_repo.update_entry(entry)

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

        # Touch parent so pdf_status becomes stale
        from datetime import datetime, timezone
        parent.updated_at = datetime.now(tz=timezone.utc)
        if parent_type == "estimate":
            self._estimate_repo.update(parent)
        else:
            self._invoice_repo.update(parent)

        return line_item

    # ------------------------------------------------------------------
    # Save a single entry to the Materials Library (standalone, no SavedItem)
    # ------------------------------------------------------------------

    def save_entry_to_library(self, user_id: str, entry_type: str, name: str,
                              notes: str | None = None, url: str | None = None,
                              unit_price: Decimal | None = None,
                              quantity: Decimal | None = None,
                              hours: Decimal | None = None) -> SavedItemEntry:
        """Create a standalone SavedItemEntry (no parent SavedItem)."""
        if entry_type not in ("material", "hours", "fee"):
            raise ValidationError("entry_type must be 'material', 'hours', or 'fee'.")
        entry = SavedItemEntry(
            saved_item_id=None,
            user_id=user_id,
            entry_type=entry_type,
            name=name,
            notes=notes,
            url=url,
            unit_price=unit_price,
            quantity=quantity,
            hours=hours,
            sort_order=0,
        )
        return self._saved_item_repo.add_entry(entry)

    # ------------------------------------------------------------------
    # Copy a SavedItemEntry into an existing LineItem
    # ------------------------------------------------------------------

    def populate_entry(self, saved_entry_id: str, user_id: str,
                       line_item_id: str, parent_id: str,
                       parent_type: str) -> LineItemEntry:
        """Copy a single SavedItemEntry into an existing LineItem as a new LineItemEntry."""
        if parent_type not in ("estimate", "invoice"):
            raise ValidationError("parent_type must be 'estimate' or 'invoice'.")

        # Verify the saved entry exists and belongs to the user
        saved_entry = self._saved_item_repo.get_entry_by_id(saved_entry_id)
        if saved_entry is None:
            raise NotFoundError(f"Saved entry {saved_entry_id} not found.")
        # Verify ownership via the parent saved item
        saved_item = self._saved_item_repo.get_by_id(str(saved_entry.saved_item_id), user_id)
        if saved_item is None:
            raise NotFoundError(f"Saved entry {saved_entry_id} not found.")

        # Verify the target line item exists and belongs to the user
        if parent_type == "estimate":
            parent = self._estimate_repo.get_by_id(parent_id)
            if parent is None:
                raise NotFoundError(f"Estimate {parent_id} not found.")
            repo = self._estimate_repo
        else:
            parent = self._invoice_repo.get_by_id(parent_id)
            if parent is None:
                raise NotFoundError(f"Invoice {parent_id} not found.")
            repo = self._invoice_repo

        new_entry = LineItemEntry(
            line_item_id=line_item_id,
            entry_type=saved_entry.entry_type,
            name=saved_entry.name,
            notes=saved_entry.notes,
            url=saved_entry.url,
            unit_price=saved_entry.unit_price,
            quantity=saved_entry.quantity,
            hours=saved_entry.hours,
            sort_order=0,
        )
        result = repo.add_entry(new_entry)

        # Touch parent so pdf_status becomes stale
        from datetime import datetime, timezone
        parent.updated_at = datetime.now(tz=timezone.utc)
        if parent_type == "estimate":
            self._estimate_repo.update(parent)
        else:
            self._invoice_repo.update(parent)

        return result
