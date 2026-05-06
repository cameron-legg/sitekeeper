"""Invoice service — CRUD with line item and entry management (v2)."""

from datetime import datetime, timezone
from decimal import Decimal

from ..models import Invoice, LineItem, LineItemEntry
from ..repositories.invoice_repo import IInvoiceRepository, SQLAlchemyInvoiceRepository
from ..repositories.job_repo import IJobRepository, SQLAlchemyJobRepository
from ..repositories.job_site_repo import IJobSiteRepository, SQLAlchemyJobSiteRepository
from .estimate_service import compute_line_item_totals, compute_totals_with_tax


class NotFoundError(Exception):
    pass


class ValidationError(Exception):
    pass


class InvoiceService:

    def __init__(
        self,
        invoice_repo: IInvoiceRepository | None = None,
        job_repo: IJobRepository | None = None,
        site_repo: IJobSiteRepository | None = None,
    ):
        self._invoice_repo = invoice_repo or SQLAlchemyInvoiceRepository()
        self._job_repo = job_repo or SQLAlchemyJobRepository()
        self._site_repo = site_repo or SQLAlchemyJobSiteRepository()

    def _verify_job_access(self, job_id: str, user_id: str):
        job = self._job_repo.get_by_id(job_id)
        if job is None:
            raise NotFoundError(f"Job {job_id} not found.")
        site = self._site_repo.get_by_id(str(job.job_site_id), user_id)
        if site is None:
            raise NotFoundError(f"Job {job_id} not found.")
        return job

    def _verify_invoice_access(self, invoice_id: str, user_id: str) -> Invoice:
        invoice = self._invoice_repo.get_by_id(invoice_id)
        if invoice is None:
            raise NotFoundError(f"Invoice {invoice_id} not found.")
        self._verify_job_access(str(invoice.job_id), user_id)
        return invoice

    def _verify_line_item(self, invoice_id: str, item_id: str) -> LineItem:
        item = self._invoice_repo.get_line_item_by_id(item_id)
        if item is None or str(item.parent_id) != invoice_id:
            raise NotFoundError(f"Line item {item_id} not found.")
        return item

    def _touch_invoice(self, invoice_id: str) -> None:
        """Bump the invoice's updated_at so pdf_status becomes 'stale'."""
        invoice = self._invoice_repo.get_by_id(invoice_id)
        if invoice:
            invoice.updated_at = datetime.now(tz=timezone.utc)
            self._invoice_repo.update(invoice)

    # ------------------------------------------------------------------
    # Invoice CRUD
    # ------------------------------------------------------------------

    def list_for_job(self, job_id: str, user_id: str) -> list[Invoice]:
        self._verify_job_access(job_id, user_id)
        return self._invoice_repo.get_for_job(job_id)

    def get(self, invoice_id: str, user_id: str) -> Invoice:
        return self._verify_invoice_access(invoice_id, user_id)

    def create(self, job_id: str, user_id: str, title: str, delivered: bool = False,
               source_estimate_id: str | None = None,
               tax_rate: Decimal | None = None) -> Invoice:
        self._verify_job_access(job_id, user_id)
        return self._invoice_repo.create(Invoice(
            job_id=job_id, title=title, delivered=delivered,
            source_estimate_id=source_estimate_id, tax_rate=tax_rate,
        ))

    def update(self, invoice_id: str, user_id: str, title: str | None = None,
               delivered: bool | None = None, tax_rate: Decimal | None = None,
               clear_tax: bool = False) -> Invoice:
        invoice = self._verify_invoice_access(invoice_id, user_id)
        if title is not None:
            invoice.title = title
        if delivered is not None:
            invoice.delivered = delivered
        if clear_tax:
            invoice.tax_rate = None
        elif tax_rate is not None:
            invoice.tax_rate = tax_rate
        return self._invoice_repo.update(invoice)

    def delete(self, invoice_id: str, user_id: str) -> None:
        self._verify_invoice_access(invoice_id, user_id)
        self._invoice_repo.delete(invoice_id)

    # ------------------------------------------------------------------
    # Line item CRUD
    # ------------------------------------------------------------------

    def get_line_items(self, invoice_id: str, user_id: str) -> list[LineItem]:
        self._verify_invoice_access(invoice_id, user_id)
        return self._invoice_repo.get_line_items(invoice_id)

    def add_line_item(self, invoice_id: str, user_id: str, name: str,
                      notes: str | None = None, hourly_rate: Decimal | None = None,
                      sort_order: int = 0) -> LineItem:
        self._verify_invoice_access(invoice_id, user_id)
        item = LineItem(
            parent_id=invoice_id, parent_type="invoice",
            name=name, notes=notes, hourly_rate=hourly_rate, sort_order=sort_order,
        )
        result = self._invoice_repo.add_line_item(item)
        self._touch_invoice(invoice_id)
        return result

    def update_line_item(self, invoice_id: str, item_id: str, user_id: str,
                         name: str | None = None, notes: str | None = None,
                         hourly_rate: Decimal | None = None,
                         sort_order: int | None = None) -> LineItem:
        self._verify_invoice_access(invoice_id, user_id)
        item = self._verify_line_item(invoice_id, item_id)
        if name is not None:
            item.name = name
        if notes is not None:
            item.notes = notes
        if hourly_rate is not None:
            item.hourly_rate = hourly_rate
        if sort_order is not None:
            item.sort_order = sort_order
        result = self._invoice_repo.update_line_item(item)
        self._touch_invoice(invoice_id)
        return result

    def delete_line_item(self, invoice_id: str, item_id: str, user_id: str) -> None:
        self._verify_invoice_access(invoice_id, user_id)
        self._verify_line_item(invoice_id, item_id)
        self._invoice_repo.delete_line_item(item_id)
        self._touch_invoice(invoice_id)

    # ------------------------------------------------------------------
    # Entry CRUD
    # ------------------------------------------------------------------

    def add_entry(self, invoice_id: str, item_id: str, user_id: str,
                  entry_type: str, name: str, notes: str | None = None,
                  url: str | None = None, unit_price: Decimal | None = None,
                  quantity: Decimal | None = None, hours: Decimal | None = None,
                  sort_order: int = 0) -> LineItemEntry:
        self._verify_invoice_access(invoice_id, user_id)
        self._verify_line_item(invoice_id, item_id)
        if entry_type not in ("material", "hours"):
            raise ValidationError("entry_type must be 'material' or 'hours'.")
        entry = LineItemEntry(
            line_item_id=item_id, entry_type=entry_type, name=name,
            notes=notes, url=url, unit_price=unit_price, quantity=quantity,
            hours=hours, sort_order=sort_order,
        )
        result = self._invoice_repo.add_entry(entry)
        self._touch_invoice(invoice_id)
        return result

    def update_entry(self, invoice_id: str, item_id: str, entry_id: str,
                     user_id: str, name: str | None = None, notes: str | None = None,
                     url: str | None = None, unit_price: Decimal | None = None,
                     quantity: Decimal | None = None, hours: Decimal | None = None,
                     sort_order: int | None = None) -> LineItemEntry:
        self._verify_invoice_access(invoice_id, user_id)
        self._verify_line_item(invoice_id, item_id)
        entry = self._invoice_repo.get_entry_by_id(entry_id)
        if entry is None or str(entry.line_item_id) != item_id:
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
        result = self._invoice_repo.update_entry(entry)
        self._touch_invoice(invoice_id)
        return result

    def delete_entry(self, invoice_id: str, item_id: str, entry_id: str, user_id: str) -> None:
        self._verify_invoice_access(invoice_id, user_id)
        self._verify_line_item(invoice_id, item_id)
        entry = self._invoice_repo.get_entry_by_id(entry_id)
        if entry is None or str(entry.line_item_id) != item_id:
            raise NotFoundError(f"Entry {entry_id} not found.")
        self._invoice_repo.delete_entry(entry_id)
        self._touch_invoice(invoice_id)

    # ------------------------------------------------------------------
    # Totals
    # ------------------------------------------------------------------

    def calculate_totals(self, invoice_id: str, user_id: str) -> dict:
        """Return full tax breakdown for the invoice."""
        invoice = self._verify_invoice_access(invoice_id, user_id)
        items = self._invoice_repo.get_line_items(invoice_id)
        return compute_totals_with_tax(items, invoice.tax_rate)

    def calculate_total(self, invoice_id: str, user_id: str) -> Decimal:
        """Convenience: return just the grand total (subtotal + tax)."""
        return self.calculate_totals(invoice_id, user_id)["total"]
