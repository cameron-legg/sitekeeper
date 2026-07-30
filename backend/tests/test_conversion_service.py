"""Tests for ConversionService — estimate to invoice conversion."""

from decimal import Decimal

import pytest

from app.services.conversion_service import ConversionService, NotFoundError


class TestEstimateToInvoiceConversion:
    """Test converting an estimate into an invoice."""

    def test_basic_conversion(self, app_context, sample_job_hierarchy, create_estimate,
                              create_line_item, create_entry, create_document_number):
        """Convert an estimate with line items and entries to an invoice."""
        create_document_number("invoice", 1)
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id, title="Bathroom Remodel", tax_rate=Decimal("8.5"))
        item = create_line_item(parent_id=estimate.id, parent_type="estimate",
                                name="Shower Install", hourly_rate=Decimal("75.00"))
        create_entry(line_item_id=item.id, entry_type="material",
                     name="Shower Unit", unit_price=Decimal("450.00"), quantity=Decimal("1"))
        create_entry(line_item_id=item.id, entry_type="hours",
                     name="Installation", hours=Decimal("6"))

        service = ConversionService()
        invoice = service.convert(str(estimate.id), str(user.id))

        assert invoice.title == "Bathroom Remodel"
        assert invoice.tax_rate == Decimal("8.5")
        assert invoice.source_estimate_id == estimate.id
        assert invoice.status == "drafting"
        assert invoice.delivered is False
        assert invoice.document_number == "1"

    def test_line_items_deep_copied(self, app_context, sample_job_hierarchy, create_estimate,
                                    create_line_item, create_entry, create_document_number):
        """Line items and entries are fully copied to the invoice."""
        create_document_number("invoice", 1)
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id, title="Test")

        item1 = create_line_item(parent_id=estimate.id, parent_type="estimate",
                                 name="Item A", hourly_rate=Decimal("60.00"), sort_order=0)
        create_entry(line_item_id=item1.id, entry_type="material",
                     name="Material 1", unit_price=Decimal("10.00"), quantity=Decimal("5"))
        create_entry(line_item_id=item1.id, entry_type="hours",
                     name="Labor 1", hours=Decimal("2"))

        item2 = create_line_item(parent_id=estimate.id, parent_type="estimate",
                                 name="Item B", hourly_rate=Decimal("80.00"), sort_order=1)
        create_entry(line_item_id=item2.id, entry_type="material",
                     name="Material 2", unit_price=Decimal("25.00"), quantity=Decimal("3"))

        service = ConversionService()
        invoice = service.convert(str(estimate.id), str(user.id))

        # Verify line items were copied
        from app.repositories.invoice_repo import SQLAlchemyInvoiceRepository
        repo = SQLAlchemyInvoiceRepository()
        invoice_items = repo.get_line_items(str(invoice.id))

        assert len(invoice_items) == 2
        assert invoice_items[0].name == "Item A"
        assert invoice_items[0].hourly_rate == Decimal("60.00")
        assert invoice_items[0].parent_type == "invoice"
        assert len(invoice_items[0].entries) == 2
        assert invoice_items[1].name == "Item B"
        assert len(invoice_items[1].entries) == 1

    def test_entries_are_independent_copies(self, app_context, sample_job_hierarchy,
                                            create_estimate, create_line_item, create_entry,
                                            create_document_number):
        """Modifying invoice entries doesn't affect original estimate entries."""
        create_document_number("invoice", 1)
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id, title="Test")
        item = create_line_item(parent_id=estimate.id, parent_type="estimate",
                                name="Item", hourly_rate=Decimal("50.00"))
        original_entry = create_entry(line_item_id=item.id, entry_type="material",
                                      name="Widget", unit_price=Decimal("99.00"),
                                      quantity=Decimal("1"))

        service = ConversionService()
        invoice = service.convert(str(estimate.id), str(user.id))

        # Get the copied entry on the invoice
        from app.repositories.invoice_repo import SQLAlchemyInvoiceRepository
        repo = SQLAlchemyInvoiceRepository()
        invoice_items = repo.get_line_items(str(invoice.id))
        invoice_entry = invoice_items[0].entries[0]

        # They should have the same data but different IDs
        assert invoice_entry.name == "Widget"
        assert invoice_entry.unit_price == Decimal("99.00")
        assert invoice_entry.id != original_entry.id

    def test_metadata_copied(self, app_context, sample_job_hierarchy, create_estimate,
                             create_document_number):
        """Document metadata is copied from estimate to invoice."""
        create_document_number("invoice", 1)
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id, title="Test")
        # Set metadata on the estimate
        estimate.bill_to = "Client Name"
        estimate.company_name = "My Biz"
        estimate.notes = "Important note"
        estimate.show_notes = False
        from app.extensions import db as _db
        _db.session.flush()

        service = ConversionService()
        invoice = service.convert(str(estimate.id), str(user.id))

        assert invoice.bill_to == "Client Name"
        assert invoice.company_name == "My Biz"
        assert invoice.notes == "Important note"
        assert invoice.show_notes is False

    def test_convert_nonexistent_estimate_raises(self, app_context, sample_job_hierarchy):
        """Converting a nonexistent estimate raises NotFoundError."""
        user = sample_job_hierarchy["user"]
        service = ConversionService()

        with pytest.raises(NotFoundError):
            service.convert("00000000-0000-0000-0000-000000000000", str(user.id))

    def test_convert_empty_estimate(self, app_context, sample_job_hierarchy, create_estimate,
                                    create_document_number):
        """Convert an estimate with no line items."""
        create_document_number("invoice", 1)
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id, title="Empty")

        service = ConversionService()
        invoice = service.convert(str(estimate.id), str(user.id))

        assert invoice.title == "Empty"
        from app.repositories.invoice_repo import SQLAlchemyInvoiceRepository
        repo = SQLAlchemyInvoiceRepository()
        items = repo.get_line_items(str(invoice.id))
        assert len(items) == 0
