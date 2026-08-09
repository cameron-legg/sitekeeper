"""Conversion service — converts an Estimate into a new Invoice (v2)."""

from datetime import date

from ...models import DocumentNumber, Invoice, LineItem, LineItemEntry
from ..estimates.repository import IEstimateRepository, SQLAlchemyEstimateRepository
from .repository import IInvoiceRepository, SQLAlchemyInvoiceRepository
from ...core.repositories.job_repo import IJobRepository, SQLAlchemyJobRepository
from ...core.repositories.job_site_repo import IJobSiteRepository, SQLAlchemyJobSiteRepository


class NotFoundError(Exception):
    pass


class ConversionService:

    def __init__(
        self,
        estimate_repo: IEstimateRepository | None = None,
        invoice_repo: IInvoiceRepository | None = None,
        job_repo: IJobRepository | None = None,
        site_repo: IJobSiteRepository | None = None,
    ):
        self._estimate_repo = estimate_repo or SQLAlchemyEstimateRepository()
        self._invoice_repo = invoice_repo or SQLAlchemyInvoiceRepository()
        self._job_repo = job_repo or SQLAlchemyJobRepository()
        self._site_repo = site_repo or SQLAlchemyJobSiteRepository()

    def convert(self, estimate_id: str, user_id: str) -> Invoice:
        estimate = self._estimate_repo.get_by_id(estimate_id)
        if estimate is None:
            raise NotFoundError(f"Estimate {estimate_id} not found.")

        job = self._job_repo.get_by_id(str(estimate.job_id))
        if job is None:
            raise NotFoundError(f"Estimate {estimate_id} not found.")
        site = self._site_repo.get_by_id(str(job.job_site_id), user_id)
        if site is None:
            raise NotFoundError(f"Estimate {estimate_id} not found.")

        # Assign a new invoice document number
        doc_num_row = DocumentNumber.query.filter_by(document_type="invoice").first()
        invoice_number = None
        if doc_num_row:
            invoice_number = str(doc_num_row.next_number)
            doc_num_row.next_number += 1

        # Create the new invoice — copy tax_rate from the source estimate
        invoice = self._invoice_repo.create(Invoice(
            job_id=str(estimate.job_id),
            title=estimate.title,
            delivered=False,
            status="drafting",
            source_estimate_id=estimate_id,
            tax_rate=estimate.tax_rate,
            document_number=invoice_number,
            document_date=date.today(),
            # Copy document metadata from estimate
            bill_to=estimate.bill_to,
            company_name=estimate.company_name,
            user_name=estimate.user_name,
            user_phone=estimate.user_phone,
            user_email=estimate.user_email,
            payment_method=estimate.payment_method,
            business_address=estimate.business_address,
            worksite_address=estimate.worksite_address,
            notes=estimate.notes,
            # Copy visibility flags
            show_document_number=estimate.show_document_number,
            show_document_date=estimate.show_document_date,
            show_bill_to=estimate.show_bill_to,
            show_company_name=estimate.show_company_name,
            show_user_name=estimate.show_user_name,
            show_user_phone=estimate.show_user_phone,
            show_user_email=estimate.show_user_email,
            show_payment_method=estimate.show_payment_method,
            show_business_address=estimate.show_business_address,
            show_worksite_address=estimate.show_worksite_address,
            show_notes=estimate.show_notes,
        ))

        # Deep copy: line items + their entries
        for src_item in self._estimate_repo.get_line_items(estimate_id):
            new_item = LineItem(
                parent_id=str(invoice.id),
                parent_type="invoice",
                name=src_item.name,
                notes=src_item.notes,
                hourly_rate=src_item.hourly_rate,
                sort_order=src_item.sort_order,
            )
            new_item = self._invoice_repo.add_line_item(new_item)

            for src_entry in src_item.entries:
                new_entry = LineItemEntry(
                    line_item_id=str(new_item.id),
                    entry_type=src_entry.entry_type,
                    name=src_entry.name,
                    notes=src_entry.notes,
                    url=src_entry.url,
                    unit_price=src_entry.unit_price,
                    quantity=src_entry.quantity,
                    hours=src_entry.hours,
                    sort_order=src_entry.sort_order,
                )
                self._invoice_repo.add_entry(new_entry)

        # Copy document photo attachments
        from ...models import DocumentPhoto
        from ...extensions import db

        src_photos = (
            DocumentPhoto.query
            .filter_by(document_id=estimate_id, document_type="estimate")
            .order_by(DocumentPhoto.sort_order)
            .all()
        )
        for dp in src_photos:
            db.session.add(DocumentPhoto(
                document_id=str(invoice.id),
                document_type="invoice",
                photo_id=str(dp.photo_id),
                sort_order=dp.sort_order,
            ))
        if src_photos:
            db.session.commit()

        return invoice
