"""PDF service — orchestrates PDF generation and download for estimates and invoices."""

import logging
from datetime import datetime, timezone
from decimal import Decimal

from flask import current_app

from ..extensions import db
from ..minio_client import MinioStorage
from ..models import Estimate, Invoice
from ..pdf_generator import (
    PdfData,
    PdfHoursEntry,
    PdfLineItem,
    PdfMaterialEntry,
    build_pdf,
)
from .estimate_service import EstimateService, compute_line_item_totals
from .invoice_service import InvoiceService
from .profile_service import ProfileService

logger = logging.getLogger(__name__)


class NotFoundError(Exception):
    """Raised when a requested resource does not exist or is not accessible."""


class PdfService:
    """Orchestrates PDF generation, storage, and download.

    Follows the existing service pattern with optional dependency injection
    for testability.
    """

    def __init__(
        self,
        estimate_service: EstimateService | None = None,
        invoice_service: InvoiceService | None = None,
        profile_service: ProfileService | None = None,
        minio_storage: MinioStorage | None = None,
    ):
        self._estimate_service = estimate_service or EstimateService()
        self._invoice_service = invoice_service or InvoiceService()
        self._profile_service = profile_service or ProfileService()
        self._minio_storage = minio_storage

    def _get_minio_storage(self) -> MinioStorage:
        """Return the MinIO storage instance, using the tenant's bucket.

        Falls back to current_app.minio_storage. If a tenant is active,
        the storage instance is scoped to the tenant's bucket.
        """
        from flask import g
        from ..tenant import get_tenant_bucket

        storage = self._minio_storage or getattr(current_app, "minio_storage", None)
        if storage is None:
            raise RuntimeError("MinIO storage is not available.")

        # If we have a tenant context, use their bucket
        tenant_slug = getattr(g, "tenant_slug", None)
        if tenant_slug:
            bucket = get_tenant_bucket(tenant_slug)
            if bucket != storage.bucket_name:
                return storage.with_bucket(bucket)

        return storage

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _resolve_primary_contact(job) -> str | None:
        """Resolve the primary contact name: job's primary_contact first,
        then fall back to the job_site's primary_contact."""
        if job.primary_contact is not None:
            return job.primary_contact.name
        job_site = job.job_site
        if job_site is not None and job_site.primary_contact is not None:
            return job_site.primary_contact.name
        return None

    @staticmethod
    def _get_job_site_address(job) -> str | None:
        """Get the address from the job's parent job_site."""
        job_site = job.job_site
        if job_site is not None:
            return job_site.address
        return None

    @staticmethod
    def _build_pdf_line_items(line_items) -> list[PdfLineItem]:
        """Convert ORM LineItem objects to PdfLineItem dataclasses."""
        pdf_items = []
        for item in line_items:
            hourly_rate = item.hourly_rate or Decimal("0")
            material_entries = []
            hours_entries = []

            for entry in item.entries:
                if entry.entry_type == "material":
                    up = entry.unit_price or Decimal("0")
                    qty = entry.quantity or Decimal("0")
                    material_entries.append(
                        PdfMaterialEntry(
                            name=entry.name,
                            unit_price=up,
                            quantity=qty,
                            total=up * qty,
                        )
                    )
                elif entry.entry_type == "hours":
                    hrs = entry.hours or Decimal("0")
                    hours_entries.append(
                        PdfHoursEntry(
                            name=entry.name,
                            hours=hrs,
                            hourly_rate=hourly_rate,
                            total=hrs * hourly_rate,
                        )
                    )

            pdf_items.append(
                PdfLineItem(
                    name=item.name,
                    hourly_rate=item.hourly_rate,
                    material_entries=material_entries,
                    hours_entries=hours_entries,
                )
            )
        return pdf_items

    # ------------------------------------------------------------------
    # Generate
    # ------------------------------------------------------------------

    def generate_estimate_pdf(self, estimate_id: str, user_id: str) -> dict:
        """Generate a PDF for an estimate, store in MinIO, update DB columns.

        Returns a dict with pdf_status and pdf_generated_at.
        """
        # Load estimate data
        estimate = self._estimate_service.get(estimate_id, user_id)
        line_items = self._estimate_service.get_line_items(estimate_id, user_id)
        totals = self._estimate_service.calculate_totals(estimate_id, user_id)
        profile = self._profile_service.get_profile(user_id)

        # Resolve primary contact and job site address
        job = estimate.job
        bill_to_name = self._resolve_primary_contact(job)
        job_site_address = self._get_job_site_address(job)

        # Build PdfData
        pdf_data = PdfData(
            document_type="Estimate",
            title=estimate.title,
            company_name=profile.get("company_name"),
            user_name=profile.get("name"),
            user_phone=profile.get("phone"),
            user_email=profile.get("email", ""),
            payment_method=profile.get("payment_method"),
            bill_to_name=bill_to_name,
            job_site_address=job_site_address,
            line_items=self._build_pdf_line_items(line_items),
            tax_rate=estimate.tax_rate,
            subtotal=totals["subtotal"],
            tax_amount=totals["tax_amount"],
            total=totals["total"],
        )

        # Generate PDF bytes
        pdf_bytes = build_pdf(pdf_data)

        # Upload to MinIO
        storage = self._get_minio_storage()
        object_key = f"estimates/{estimate_id}.pdf"
        try:
            storage.upload(object_key, pdf_bytes)
        except Exception:
            logger.exception("Failed to upload estimate PDF to MinIO")
            raise RuntimeError("Failed to store PDF. Please try again.")

        # Update DB columns
        now = datetime.now(timezone.utc)
        estimate.pdf_generated_at = now
        estimate.pdf_object_key = object_key
        db.session.commit()

        return {
            "pdf_status": "current",
            "pdf_generated_at": now.isoformat(),
        }

    def generate_invoice_pdf(self, invoice_id: str, user_id: str) -> dict:
        """Generate a PDF for an invoice, store in MinIO, update DB columns.

        Returns a dict with pdf_status and pdf_generated_at.
        """
        # Load invoice data
        invoice = self._invoice_service.get(invoice_id, user_id)
        line_items = self._invoice_service.get_line_items(invoice_id, user_id)
        totals = self._invoice_service.calculate_totals(invoice_id, user_id)
        profile = self._profile_service.get_profile(user_id)

        # Resolve primary contact and job site address
        job = invoice.job
        bill_to_name = self._resolve_primary_contact(job)
        job_site_address = self._get_job_site_address(job)

        # Build PdfData
        pdf_data = PdfData(
            document_type="Invoice",
            title=invoice.title,
            company_name=profile.get("company_name"),
            user_name=profile.get("name"),
            user_phone=profile.get("phone"),
            user_email=profile.get("email", ""),
            payment_method=profile.get("payment_method"),
            bill_to_name=bill_to_name,
            job_site_address=job_site_address,
            line_items=self._build_pdf_line_items(line_items),
            tax_rate=invoice.tax_rate,
            subtotal=totals["subtotal"],
            tax_amount=totals["tax_amount"],
            total=totals["total"],
        )

        # Generate PDF bytes
        pdf_bytes = build_pdf(pdf_data)

        # Upload to MinIO
        storage = self._get_minio_storage()
        object_key = f"invoices/{invoice_id}.pdf"
        try:
            storage.upload(object_key, pdf_bytes)
        except Exception:
            logger.exception("Failed to upload invoice PDF to MinIO")
            raise RuntimeError("Failed to store PDF. Please try again.")

        # Update DB columns
        now = datetime.now(timezone.utc)
        invoice.pdf_generated_at = now
        invoice.pdf_object_key = object_key
        db.session.commit()

        return {
            "pdf_status": "current",
            "pdf_generated_at": now.isoformat(),
        }

    # ------------------------------------------------------------------
    # Download
    # ------------------------------------------------------------------

    def download_estimate_pdf(
        self, estimate_id: str, user_id: str
    ) -> tuple[bytes, str]:
        """Return (pdf_bytes, filename) for an estimate's stored PDF."""
        estimate = self._estimate_service.get(estimate_id, user_id)

        if estimate.pdf_object_key is None:
            raise NotFoundError("No PDF has been generated for this estimate.")

        storage = self._get_minio_storage()
        try:
            pdf_bytes = storage.download(estimate.pdf_object_key)
        except Exception:
            logger.exception("Failed to download estimate PDF from MinIO")
            raise RuntimeError("Failed to retrieve PDF. Please try again.")

        filename = f"estimate-{estimate.title}.pdf"
        return pdf_bytes, filename

    def download_invoice_pdf(
        self, invoice_id: str, user_id: str
    ) -> tuple[bytes, str]:
        """Return (pdf_bytes, filename) for an invoice's stored PDF."""
        invoice = self._invoice_service.get(invoice_id, user_id)

        if invoice.pdf_object_key is None:
            raise NotFoundError("No PDF has been generated for this invoice.")

        storage = self._get_minio_storage()
        try:
            pdf_bytes = storage.download(invoice.pdf_object_key)
        except Exception:
            logger.exception("Failed to download invoice PDF from MinIO")
            raise RuntimeError("Failed to retrieve PDF. Please try again.")

        filename = f"invoice-{invoice.title}.pdf"
        return pdf_bytes, filename
