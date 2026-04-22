"""Invoice service — CRUD with line item and entry management (v2)."""

from decimal import Decimal

from ..models import Invoice, LineItem, LineItemEntry
from ..repositories.invoice_repo import IInvoiceRepository, SQLAlchemyInvoiceRepository
from ..repositories.job_repo import IJobRepository, SQLAlchemyJobRepository
from ..repositories.job_site_repo import IJobSiteRepository, SQLAlchemyJobSiteRepository
from .estimate_service import compute_line_item_totals


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

    # ------------------------------------------------------------------
    # Invoice CRUD
    # ------------------------------------------------------------------

    def list_for_job(self, job_id: str, user_id: str) -> list[Invoice]:
        self._verify_job_access(job_id, user_id)
        return self._invoice_repo.get_for_job(job_id)

    def get(self, invoice_id: str, user_id: str) -> Invoice:
        return self._verify_invoice_access(invoice_id, user_id)

    def create(self, job_id: str, user_id: str, title: str, delivered: bool = False,
               source_estimate_id: str | None = None) -> Invoice:
        self._verify_job_access(job_id, user_id)
        return self._invoice_repo.create(Invoice(
            job_id=job_id, title=title, delivered=delivered,
            source_estimate_id=source_estimate_id,
        ))

    def update(self, invoice_id: str, user_id: str, title: str | None = None,
               delivered: bool | None = None) -> Invoice:
        invoice = self._verify_invoice_access(invoice_id, user_id)
        if title is not None:
            invoice.title = title
        if delivered is not None:
            invoice.delivered = delivered
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
        return self._invoice_repo.add_line_item(item)

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
        return self._invoice_repo.update_line_item(item)

    def delete_line_item(self, invoice_id: str, item_id: str, user_id: str) -> None:
        self._verify_invoice_access(invoice_id, user_id)
        self._verify_line_item(invoice_id, item_id)
        self._invoice_repo.delete_line_item(item_id)

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
        return self._invoice_repo.add_entry(entry)

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
        return self._invoice_repo.update_entry(entry)

    def delete_entry(self, invoice_id: str, item_id: str, entry_id: str, user_id: str) -> None:
        self._verify_invoice_access(invoice_id, user_id)
        self._verify_line_item(invoice_id, item_id)
        entry = self._invoice_repo.get_entry_by_id(entry_id)
        if entry is None or str(entry.line_item_id) != item_id:
            raise NotFoundError(f"Entry {entry_id} not found.")
        self._invoice_repo.delete_entry(entry_id)

    # ------------------------------------------------------------------
    # Totals
    # ------------------------------------------------------------------

    def calculate_total(self, invoice_id: str, user_id: str) -> Decimal:
        items = self.get_line_items(invoice_id, user_id)
        return sum(
            compute_line_item_totals(item)["total_cost"] for item in items
        )
