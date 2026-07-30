"""Tests for EstimateService — CRUD, line items, entries, metadata."""

from decimal import Decimal

import pytest

from app.services.estimate_service import EstimateService, NotFoundError


class TestEstimateServiceCRUD:
    """Test basic estimate create/read/update/delete."""

    def test_create_estimate(self, app_context, sample_job_hierarchy, create_document_number):
        """Create an estimate with default fields."""
        create_document_number("estimate", 1)
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        service = EstimateService()

        estimate = service.create(
            job_id=str(job.id),
            user_id=str(user.id),
            title="Kitchen Remodel",
            tax_rate=Decimal("8.25"),
        )

        assert estimate.title == "Kitchen Remodel"
        assert estimate.tax_rate == Decimal("8.25")
        assert estimate.delivered is False
        assert estimate.document_number == "1"

    def test_create_increments_document_number(self, app_context, sample_job_hierarchy, create_document_number):
        """Document number auto-increments on each create."""
        create_document_number("estimate", 10)
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        service = EstimateService()

        e1 = service.create(str(job.id), str(user.id), "First")
        e2 = service.create(str(job.id), str(user.id), "Second")

        assert e1.document_number == "10"
        assert e2.document_number == "11"

    def test_get_estimate(self, app_context, sample_job_hierarchy, create_estimate):
        """Retrieve an existing estimate."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id, title="Roof Repair")
        service = EstimateService()

        result = service.get(str(estimate.id), str(user.id))
        assert result.title == "Roof Repair"

    def test_get_nonexistent_estimate_raises(self, app_context, sample_job_hierarchy):
        """Getting a nonexistent estimate raises NotFoundError."""
        user = sample_job_hierarchy["user"]
        service = EstimateService()

        with pytest.raises(NotFoundError):
            service.get("00000000-0000-0000-0000-000000000000", str(user.id))

    def test_update_estimate_title(self, app_context, sample_job_hierarchy, create_estimate):
        """Update estimate title."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id, title="Old Title")
        service = EstimateService()

        updated = service.update(str(estimate.id), str(user.id), title="New Title")
        assert updated.title == "New Title"

    def test_update_estimate_delivered(self, app_context, sample_job_hierarchy, create_estimate):
        """Mark estimate as delivered."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id)
        service = EstimateService()

        updated = service.update(str(estimate.id), str(user.id), delivered=True)
        assert updated.delivered is True

    def test_update_tax_rate(self, app_context, sample_job_hierarchy, create_estimate):
        """Set and clear tax rate."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id, tax_rate=Decimal("7.5"))
        service = EstimateService()

        # Set new rate
        updated = service.update(str(estimate.id), str(user.id), tax_rate=Decimal("9.0"))
        assert updated.tax_rate == Decimal("9.0")

        # Clear rate
        cleared = service.update(str(estimate.id), str(user.id), clear_tax=True)
        assert cleared.tax_rate is None

    def test_delete_estimate(self, app_context, sample_job_hierarchy, create_estimate):
        """Delete an estimate."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id)
        service = EstimateService()

        service.delete(str(estimate.id), str(user.id))
        with pytest.raises(NotFoundError):
            service.get(str(estimate.id), str(user.id))

    def test_list_estimates_for_job(self, app_context, sample_job_hierarchy, create_estimate):
        """List all estimates for a job."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        create_estimate(job_id=job.id, title="Est 1")
        create_estimate(job_id=job.id, title="Est 2")
        service = EstimateService()

        estimates = service.list_for_job(str(job.id), str(user.id))
        assert len(estimates) == 2


class TestEstimateLineItems:
    """Test line item CRUD on estimates."""

    def test_add_line_item(self, app_context, sample_job_hierarchy, create_estimate):
        """Add a line item to an estimate."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id)
        service = EstimateService()

        item = service.add_line_item(
            str(estimate.id), str(user.id),
            name="Toilet Replacement",
            hourly_rate=Decimal("85.00"),
        )
        assert item.name == "Toilet Replacement"
        assert item.hourly_rate == Decimal("85.00")
        assert item.parent_type == "estimate"

    def test_get_line_items(self, app_context, sample_job_hierarchy, create_estimate, create_line_item):
        """Retrieve line items for an estimate."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id)
        create_line_item(parent_id=estimate.id, parent_type="estimate", name="Item A")
        create_line_item(parent_id=estimate.id, parent_type="estimate", name="Item B")
        service = EstimateService()

        items = service.get_line_items(str(estimate.id), str(user.id))
        assert len(items) == 2

    def test_update_line_item(self, app_context, sample_job_hierarchy, create_estimate, create_line_item):
        """Update a line item's name and hourly rate."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id)
        item = create_line_item(parent_id=estimate.id, parent_type="estimate")
        service = EstimateService()

        updated = service.update_line_item(
            str(estimate.id), str(item.id), str(user.id),
            name="Updated Name", hourly_rate=Decimal("100.00"),
        )
        assert updated.name == "Updated Name"
        assert updated.hourly_rate == Decimal("100.00")

    def test_delete_line_item(self, app_context, sample_job_hierarchy, create_estimate, create_line_item):
        """Delete a line item."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id)
        item = create_line_item(parent_id=estimate.id, parent_type="estimate")
        service = EstimateService()

        service.delete_line_item(str(estimate.id), str(item.id), str(user.id))
        items = service.get_line_items(str(estimate.id), str(user.id))
        assert len(items) == 0


class TestEstimateEntries:
    """Test entry CRUD within line items."""

    def test_add_material_entry(self, app_context, sample_job_hierarchy, create_estimate, create_line_item):
        """Add a material entry to a line item."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id)
        item = create_line_item(parent_id=estimate.id, parent_type="estimate")
        service = EstimateService()

        entry = service.add_entry(
            str(estimate.id), str(item.id), str(user.id),
            entry_type="material", name="Copper Pipe",
            unit_price=Decimal("12.50"), quantity=Decimal("10"),
        )
        assert entry.entry_type == "material"
        assert entry.name == "Copper Pipe"
        assert entry.unit_price == Decimal("12.50")
        assert entry.quantity == Decimal("10")

    def test_add_hours_entry(self, app_context, sample_job_hierarchy, create_estimate, create_line_item):
        """Add an hours entry."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id)
        item = create_line_item(parent_id=estimate.id, parent_type="estimate")
        service = EstimateService()

        entry = service.add_entry(
            str(estimate.id), str(item.id), str(user.id),
            entry_type="hours", name="Installation Labor",
            hours=Decimal("6.5"),
        )
        assert entry.entry_type == "hours"
        assert entry.hours == Decimal("6.5")

    def test_add_fee_entry(self, app_context, sample_job_hierarchy, create_estimate, create_line_item):
        """Add a fee entry."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id)
        item = create_line_item(parent_id=estimate.id, parent_type="estimate")
        service = EstimateService()

        entry = service.add_entry(
            str(estimate.id), str(item.id), str(user.id),
            entry_type="fee", name="Disposal Fee",
            unit_price=Decimal("75.00"), quantity=Decimal("1"),
        )
        assert entry.entry_type == "fee"
        assert entry.unit_price == Decimal("75.00")

    def test_update_entry(self, app_context, sample_job_hierarchy, create_estimate, create_line_item, create_entry):
        """Update an entry's price and quantity."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id)
        item = create_line_item(parent_id=estimate.id, parent_type="estimate")
        entry = create_entry(line_item_id=item.id, entry_type="material",
                             unit_price=Decimal("10.00"), quantity=Decimal("2"))
        service = EstimateService()

        updated = service.update_entry(
            str(estimate.id), str(item.id), str(entry.id), str(user.id),
            unit_price=Decimal("15.00"), quantity=Decimal("5"),
        )
        assert updated.unit_price == Decimal("15.00")
        assert updated.quantity == Decimal("5")

    def test_delete_entry(self, app_context, sample_job_hierarchy, create_estimate, create_line_item, create_entry):
        """Delete a single entry from a line item."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id)
        item = create_line_item(parent_id=estimate.id, parent_type="estimate")
        entry = create_entry(line_item_id=item.id)
        service = EstimateService()

        service.delete_entry(str(estimate.id), str(item.id), str(entry.id), str(user.id))
        items = service.get_line_items(str(estimate.id), str(user.id))
        # Line item still exists but has no entries
        assert len(items[0].entries) == 0


class TestEstimateMetadata:
    """Test document metadata on estimates."""

    def test_metadata_override_on_create(self, app_context, sample_job_hierarchy, create_document_number):
        """Metadata fields can be overridden at creation time."""
        create_document_number("estimate", 1)
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        service = EstimateService()

        estimate = service.create(
            str(job.id), str(user.id), "Test",
            metadata={
                "bill_to": "Custom Client",
                "company_name": "My Company",
                "notes": "Payment due in 30 days",
            },
        )
        assert estimate.bill_to == "Custom Client"
        assert estimate.company_name == "My Company"
        assert estimate.notes == "Payment due in 30 days"

    def test_update_metadata(self, app_context, sample_job_hierarchy, create_estimate):
        """Metadata fields can be updated after creation."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        estimate = create_estimate(job_id=job.id)
        service = EstimateService()

        updated = service.update(
            str(estimate.id), str(user.id),
            metadata={
                "bill_to": "Updated Client",
                "show_payment_method": False,
            },
        )
        assert updated.bill_to == "Updated Client"
        assert updated.show_payment_method is False
