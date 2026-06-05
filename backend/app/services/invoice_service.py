"""Invoice service — CRUD with line item and entry management (v2)."""

from datetime import date, datetime, timezone
from decimal import Decimal

from ..extensions import db
from ..models import DocumentNumber, Invoice, LineItem, LineItemEntry
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
               tax_rate: Decimal | None = None, metadata: dict | None = None) -> Invoice:
        job = self._verify_job_access(job_id, user_id)
        invoice = Invoice(
            job_id=job_id, title=title, delivered=delivered,
            source_estimate_id=source_estimate_id, tax_rate=tax_rate,
        )
        # Auto-assign document number
        doc_num_row = DocumentNumber.query.filter_by(document_type="invoice").first()
        if doc_num_row:
            invoice.document_number = str(doc_num_row.next_number)
            doc_num_row.next_number += 1
        # Auto-set document date to today
        invoice.document_date = date.today()
        # Apply explicit metadata overrides first
        if metadata:
            self._apply_metadata(invoice, metadata)
        # Auto-populate any remaining None fields from profile and job context
        self._populate_defaults(invoice, user_id, job)
        return self._invoice_repo.create(invoice)

    def update(self, invoice_id: str, user_id: str, title: str | None = None,
               delivered: bool | None = None, status: str | None = None,
               tax_rate: Decimal | None = None,
               clear_tax: bool = False, metadata: dict | None = None) -> Invoice:
        invoice = self._verify_invoice_access(invoice_id, user_id)
        if title is not None:
            invoice.title = title
        if delivered is not None:
            invoice.delivered = delivered
        if status is not None:
            invoice.status = status
        if clear_tax:
            invoice.tax_rate = None
        elif tax_rate is not None:
            invoice.tax_rate = tax_rate
        if metadata:
            self._apply_metadata(invoice, metadata)
        return self._invoice_repo.update(invoice)

    @staticmethod
    def _apply_metadata(doc, metadata: dict) -> None:
        """Apply metadata fields to an invoice document."""
        META_FIELDS = (
            "document_number", "document_date", "bill_to", "company_name",
            "user_name", "user_phone", "user_email", "payment_method",
            "business_address", "worksite_address", "notes",
            "show_document_number", "show_document_date", "show_bill_to",
            "show_company_name", "show_user_name", "show_user_phone",
            "show_user_email", "show_payment_method", "show_business_address",
            "show_worksite_address", "show_notes",
        )
        for key in META_FIELDS:
            if key in metadata:
                value = metadata[key]
                if key == "document_date" and isinstance(value, str):
                    try:
                        value = date.fromisoformat(value)
                    except ValueError:
                        continue
                setattr(doc, key, value)

    @staticmethod
    def _populate_defaults(doc, user_id: str, job) -> None:
        """Fill in any still-None metadata fields from business info, profile, and job context."""
        from .profile_service import ProfileService
        from .business_info_service import BusinessInfoService
        try:
            profile = ProfileService().get_profile(user_id)
        except Exception:
            profile = {}
        biz_service = BusinessInfoService()
        try:
            biz = biz_service.get_business_info()
        except Exception:
            biz = {}

        # Business-level defaults (from tenant business_info)
        if doc.company_name is None and biz.get("business_name"):
            doc.company_name = biz["business_name"]
        if doc.payment_method is None and biz.get("payment_method"):
            doc.payment_method = biz["payment_method"]
        if doc.business_address is None and biz.get("business_address"):
            doc.business_address = biz["business_address"]

        # Owner name (from business_info owner, not the creating user)
        if doc.user_name is None:
            owner_name = biz.get("owner_name") or biz_service.get_owner_name()
            if owner_name:
                doc.user_name = owner_name
            elif profile.get("name"):
                doc.user_name = profile["name"]
        if doc.user_phone is None and biz.get("business_phone"):
            doc.user_phone = biz["business_phone"]
        if doc.user_email is None and biz.get("business_email"):
            doc.user_email = biz["business_email"]

        if doc.bill_to is None and job:
            if job.primary_contact is not None:
                doc.bill_to = job.primary_contact.name
            elif job.job_site and job.job_site.primary_contact:
                doc.bill_to = job.job_site.primary_contact.name
        if doc.worksite_address is None and job and job.job_site:
            doc.worksite_address = job.job_site.address

    def populate_defaults(self, invoice_id: str, user_id: str) -> Invoice:
        """Re-populate all metadata fields from business info, profile, and job context (overwrites current values)."""
        invoice = self._verify_invoice_access(invoice_id, user_id)
        job = self._job_repo.get_by_id(str(invoice.job_id))

        from .profile_service import ProfileService
        from .business_info_service import BusinessInfoService
        try:
            profile = ProfileService().get_profile(user_id)
        except Exception:
            profile = {}
        biz_service = BusinessInfoService()
        try:
            biz = biz_service.get_business_info()
        except Exception:
            biz = {}

        invoice.company_name = biz.get("business_name")
        # Use owner name, fall back to creating user's name
        owner_name = biz.get("owner_name") or biz_service.get_owner_name()
        invoice.user_name = owner_name or profile.get("name")
        invoice.user_phone = biz.get("business_phone")
        invoice.user_email = biz.get("business_email")
        invoice.payment_method = biz.get("payment_method")
        invoice.business_address = biz.get("business_address")
        invoice.document_date = date.today()

        if job:
            if job.primary_contact is not None:
                invoice.bill_to = job.primary_contact.name
            elif job.job_site and job.job_site.primary_contact:
                invoice.bill_to = job.job_site.primary_contact.name
            else:
                invoice.bill_to = None
            if job.job_site:
                invoice.worksite_address = job.job_site.address
            else:
                invoice.worksite_address = None

        if not invoice.document_number:
            doc_num_row = DocumentNumber.query.filter_by(document_type="invoice").first()
            if doc_num_row:
                invoice.document_number = str(doc_num_row.next_number)
                doc_num_row.next_number += 1

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
