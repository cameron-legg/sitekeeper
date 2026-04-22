"""Conversion service — converts an Estimate into a new Invoice (v2)."""

from ..models import Invoice, LineItem, LineItemEntry
from ..repositories.estimate_repo import IEstimateRepository, SQLAlchemyEstimateRepository
from ..repositories.invoice_repo import IInvoiceRepository, SQLAlchemyInvoiceRepository
from ..repositories.job_repo import IJobRepository, SQLAlchemyJobRepository
from ..repositories.job_site_repo import IJobSiteRepository, SQLAlchemyJobSiteRepository


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

        invoice = self._invoice_repo.create(Invoice(
            job_id=str(estimate.job_id),
            title=estimate.title,
            delivered=False,
            source_estimate_id=estimate_id,
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

        return invoice
