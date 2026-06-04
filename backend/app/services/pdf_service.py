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

    def _load_document_photos(self, document_id: str, document_type: str) -> list[bytes]:
        """Load photo bytes for all photos attached to a document.

        Returns a list of raw image bytes, skipping any that fail to download.
        """
        from ..models import DocumentPhoto
        from ..services.job_photo_service import _get_media_bucket

        doc_photos = (
            DocumentPhoto.query
            .filter_by(document_id=document_id, document_type=document_type)
            .order_by(DocumentPhoto.sort_order)
            .all()
        )

        if not doc_photos:
            return []

        # Get media storage
        storage = self._minio_storage or getattr(current_app, "minio_storage", None)
        if storage is None:
            return []

        from flask import g
        media_bucket = _get_media_bucket()
        media_storage = storage.with_bucket(media_bucket)

        images = []
        for dp in doc_photos:
            if dp.photo is None:
                continue
            try:
                img_bytes = media_storage.download(dp.photo.object_key)
                images.append(img_bytes)
            except Exception:
                logger.warning(
                    "Failed to load photo %s for document %s PDF",
                    dp.photo_id, document_id,
                )
        return images

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

        # Use document's stored metadata (already populated from business_info on creation)
        # Fall back to business_info for any fields that are still None (legacy documents)
        profile = self._profile_service.get_profile(user_id)
        from .business_info_service import BusinessInfoService
        biz_service = BusinessInfoService()
        try:
            biz = biz_service.get_business_info()
        except Exception:
            biz = {}
        job = estimate.job

        # Resolve values: document override > business_info/profile default > job/site default
        bill_to = estimate.bill_to or self._resolve_primary_contact(job)
        worksite = estimate.worksite_address or self._get_job_site_address(job)
        owner_name = biz.get("owner_name") or biz_service.get_owner_name()

        # Build PdfData
        pdf_data = PdfData(
            document_type="Estimate",
            title=estimate.title,
            company_name=estimate.company_name or biz.get("business_name"),
            user_name=estimate.user_name or owner_name or profile.get("name"),
            user_phone=estimate.user_phone or biz.get("business_phone"),
            user_email=estimate.user_email or biz.get("business_email", ""),
            payment_method=estimate.payment_method or biz.get("payment_method"),
            bill_to_name=bill_to,
            job_site_address=worksite,
            line_items=self._build_pdf_line_items(line_items),
            tax_rate=estimate.tax_rate,
            subtotal=totals["subtotal"],
            tax_amount=totals["tax_amount"],
            total=totals["total"],
            # New fields
            document_number=estimate.document_number,
            document_date=estimate.document_date.isoformat() if estimate.document_date else None,
            business_address=estimate.business_address or biz.get("business_address"),
            notes=estimate.notes,
            # Visibility flags
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
        )

        # Load attached photos
        pdf_data.photo_images = self._load_document_photos(estimate_id, "estimate")

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

        # Use document's stored metadata, fall back to business_info
        profile = self._profile_service.get_profile(user_id)
        from .business_info_service import BusinessInfoService
        biz_service = BusinessInfoService()
        try:
            biz = biz_service.get_business_info()
        except Exception:
            biz = {}
        job = invoice.job

        bill_to = invoice.bill_to or self._resolve_primary_contact(job)
        worksite = invoice.worksite_address or self._get_job_site_address(job)
        owner_name = biz.get("owner_name") or biz_service.get_owner_name()

        # Build PdfData
        pdf_data = PdfData(
            document_type="Invoice",
            title=invoice.title,
            company_name=invoice.company_name or biz.get("business_name"),
            user_name=invoice.user_name or owner_name or profile.get("name"),
            user_phone=invoice.user_phone or biz.get("business_phone"),
            user_email=invoice.user_email or biz.get("business_email", ""),
            payment_method=invoice.payment_method or biz.get("payment_method"),
            bill_to_name=bill_to,
            job_site_address=worksite,
            line_items=self._build_pdf_line_items(line_items),
            tax_rate=invoice.tax_rate,
            subtotal=totals["subtotal"],
            tax_amount=totals["tax_amount"],
            total=totals["total"],
            # New fields
            document_number=invoice.document_number,
            document_date=invoice.document_date.isoformat() if invoice.document_date else None,
            business_address=invoice.business_address or biz.get("business_address"),
            notes=invoice.notes,
            # Visibility flags
            show_document_number=invoice.show_document_number,
            show_document_date=invoice.show_document_date,
            show_bill_to=invoice.show_bill_to,
            show_company_name=invoice.show_company_name,
            show_user_name=invoice.show_user_name,
            show_user_phone=invoice.show_user_phone,
            show_user_email=invoice.show_user_email,
            show_payment_method=invoice.show_payment_method,
            show_business_address=invoice.show_business_address,
            show_worksite_address=invoice.show_worksite_address,
            show_notes=invoice.show_notes,
        )

        # Load attached photos
        pdf_data.photo_images = self._load_document_photos(invoice_id, "invoice")

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
