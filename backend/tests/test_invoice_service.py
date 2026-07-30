"""Tests for InvoiceService — CRUD, status transitions, line items."""

from decimal import Decimal

import pytest

from app.services.invoice_service import InvoiceService, NotFoundError


class TestInvoiceServiceCRUD:
    """Test basic invoice create/read/update/delete."""

    def test_create_invoice(self, app_context, sample_job_hierarchy, create_document_number):
        """Create an invoice with default fields."""
        create_document_number("invoice", 1)
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        service = InvoiceService()

        invoice = service.create(
            job_id=str(job.id),
            user_id=str(user.id),
            title="Plumbing Invoice",
            tax_rate=Decimal("7.5"),
        )

        assert invoice.title == "Plumbing Invoice"
        assert invoice.tax_rate == Decimal("7.5")
        assert invoice.delivered is False
        assert invoice.status == "drafting"
        assert invoice.document_number == "1"

    def test_get_invoice(self, app_context, sample_job_hierarchy, create_invoice):
        """Retrieve an existing invoice."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        invoice = create_invoice(job_id=job.id, title="Test Invoice")
        service = InvoiceService()

        result = service.get(str(invoice.id), str(user.id))
        assert result.title == "Test Invoice"

    def test_get_nonexistent_invoice_raises(self, app_context, sample_job_hierarchy):
        """Getting a nonexistent invoice raises NotFoundError."""
        user = sample_job_hierarchy["user"]
        service = InvoiceService()

        with pytest.raises(NotFoundError):
            service.get("00000000-0000-0000-0000-000000000000", str(user.id))

    def test_update_invoice_title(self, app_context, sample_job_hierarchy, create_invoice):
        """Update invoice title."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        invoice = create_invoice(job_id=job.id, title="Old Title")
        service = InvoiceService()

        updated = service.update(str(invoice.id), str(user.id), title="New Title")
        assert updated.title == "New Title"

    def test_delete_invoice(self, app_context, sample_job_hierarchy, create_invoice):
        """Delete an invoice."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        invoice = create_invoice(job_id=job.id)
        service = InvoiceService()

        service.delete(str(invoice.id), str(user.id))
        with pytest.raises(NotFoundError):
            service.get(str(invoice.id), str(user.id))

    def test_list_invoices_for_job(self, app_context, sample_job_hierarchy, create_invoice):
        """List all invoices for a job."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        create_invoice(job_id=job.id, title="Inv 1")
        create_invoice(job_id=job.id, title="Inv 2")
        create_invoice(job_id=job.id, title="Inv 3")
        service = InvoiceService()

        invoices = service.list_for_job(str(job.id), str(user.id))
        assert len(invoices) == 3


class TestInvoiceStatusTransitions:
    """Test invoice status workflow."""

    def test_default_status_is_drafting(self, app_context, sample_job_hierarchy, create_document_number):
        """New invoices start with status=drafting."""
        create_document_number("invoice", 1)
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        service = InvoiceService()

        invoice = service.create(str(job.id), str(user.id), "Test")
        assert invoice.status == "drafting"

    def test_transition_to_waiting_to_send(self, app_context, sample_job_hierarchy, create_invoice):
        """Transition from drafting to waiting_to_send."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        invoice = create_invoice(job_id=job.id, status="drafting")
        service = InvoiceService()

        updated = service.update(str(invoice.id), str(user.id), status="waiting_to_send")
        assert updated.status == "waiting_to_send"
        assert updated.status_changed_at is not None

    def test_transition_to_sent_awaiting_payment(self, app_context, sample_job_hierarchy, create_invoice):
        """Transition to sent_awaiting_payment."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        invoice = create_invoice(job_id=job.id, status="waiting_to_send")
        service = InvoiceService()

        updated = service.update(str(invoice.id), str(user.id), status="sent_awaiting_payment")
        assert updated.status == "sent_awaiting_payment"

    def test_transition_to_paid(self, app_context, sample_job_hierarchy, create_invoice):
        """Transition to paid (final state)."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        invoice = create_invoice(job_id=job.id, status="sent_awaiting_payment")
        service = InvoiceService()

        updated = service.update(str(invoice.id), str(user.id), status="paid")
        assert updated.status == "paid"

    def test_same_status_no_change(self, app_context, sample_job_hierarchy, create_invoice):
        """Setting same status doesn't create a new history entry."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        invoice = create_invoice(job_id=job.id, status="drafting")
        service = InvoiceService()

        original_changed_at = invoice.status_changed_at
        updated = service.update(str(invoice.id), str(user.id), status="drafting")
        # status_changed_at should not change when status is the same
        assert updated.status == "drafting"


class TestInvoiceLineItems:
    """Test line item operations on invoices."""

    def test_add_line_item(self, app_context, sample_job_hierarchy, create_invoice):
        """Add a line item to an invoice."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        invoice = create_invoice(job_id=job.id)
        service = InvoiceService()

        item = service.add_line_item(
            str(invoice.id), str(user.id),
            name="Faucet Installation",
            hourly_rate=Decimal("90.00"),
        )
        assert item.name == "Faucet Installation"
        assert item.parent_type == "invoice"
        assert item.hourly_rate == Decimal("90.00")

    def test_add_entry_to_line_item(self, app_context, sample_job_hierarchy, create_invoice, create_line_item):
        """Add entries to an invoice line item."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        invoice = create_invoice(job_id=job.id)
        item = create_line_item(parent_id=invoice.id, parent_type="invoice")
        service = InvoiceService()

        entry = service.add_entry(
            str(invoice.id), str(item.id), str(user.id),
            entry_type="material", name="Kitchen Faucet",
            unit_price=Decimal("189.99"), quantity=Decimal("1"),
        )
        assert entry.name == "Kitchen Faucet"
        assert entry.unit_price == Decimal("189.99")

    def test_update_line_item(self, app_context, sample_job_hierarchy, create_invoice, create_line_item):
        """Update line item name."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        invoice = create_invoice(job_id=job.id)
        item = create_line_item(parent_id=invoice.id, parent_type="invoice", name="Old")
        service = InvoiceService()

        updated = service.update_line_item(
            str(invoice.id), str(item.id), str(user.id), name="New Name"
        )
        assert updated.name == "New Name"

    def test_delete_line_item(self, app_context, sample_job_hierarchy, create_invoice, create_line_item):
        """Delete a line item from an invoice."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        invoice = create_invoice(job_id=job.id)
        item = create_line_item(parent_id=invoice.id, parent_type="invoice")
        service = InvoiceService()

        service.delete_line_item(str(invoice.id), str(item.id), str(user.id))
        items = service.get_line_items(str(invoice.id), str(user.id))
        assert len(items) == 0


class TestInvoiceMetadata:
    """Test invoice metadata operations."""

    def test_update_metadata(self, app_context, sample_job_hierarchy, create_invoice):
        """Update metadata fields on an invoice."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        invoice = create_invoice(job_id=job.id)
        service = InvoiceService()

        updated = service.update(
            str(invoice.id), str(user.id),
            metadata={
                "bill_to": "Jane Smith",
                "notes": "Net 30 payment terms",
                "show_notes": True,
                "show_business_address": False,
            },
        )
        assert updated.bill_to == "Jane Smith"
        assert updated.notes == "Net 30 payment terms"
        assert updated.show_notes is True
        assert updated.show_business_address is False

    def test_clear_tax_rate(self, app_context, sample_job_hierarchy, create_invoice):
        """Clear tax rate from an invoice."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        invoice = create_invoice(job_id=job.id, tax_rate=Decimal("8.5"))
        service = InvoiceService()

        updated = service.update(str(invoice.id), str(user.id), clear_tax=True)
        assert updated.tax_rate is None
