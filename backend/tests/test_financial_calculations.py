"""Tests for financial calculation functions.

Covers:
- compute_line_item_totals (material, hours, fee entries)
- compute_totals_with_tax (subtotals, tax on materials only, multi-item)
- Edge cases: zero values, None values, large numbers, rounding
"""

from decimal import Decimal

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.services.estimate_service import compute_line_item_totals, compute_totals_with_tax


# ---------------------------------------------------------------------------
# Helper: lightweight mock objects for pure computation tests (no DB needed)
# ---------------------------------------------------------------------------


class _MockEntry:
    """Minimal entry object for compute functions."""
    def __init__(self, entry_type, unit_price=None, quantity=None, hours=None):
        self.entry_type = entry_type
        self.unit_price = unit_price
        self.quantity = quantity
        self.hours = hours


class _MockLineItem:
    """Minimal line item object for compute functions."""
    def __init__(self, hourly_rate, entries):
        self.hourly_rate = hourly_rate
        self.entries = entries


def _make_line_item(hourly_rate, entries):
    """Create a mock LineItem with given entries (no DB, no SQLAlchemy)."""
    mock_entries = [
        _MockEntry(
            entry_type=e["entry_type"],
            unit_price=e.get("unit_price"),
            quantity=e.get("quantity"),
            hours=e.get("hours"),
        )
        for e in entries
    ]
    return _MockLineItem(hourly_rate=hourly_rate, entries=mock_entries)


# ===========================================================================
# compute_line_item_totals
# ===========================================================================


class TestComputeLineItemTotals:
    """Unit tests for compute_line_item_totals."""

    def test_single_material_entry(self):
        """Basic: unit_price * quantity."""
        item = _make_line_item(
            hourly_rate=Decimal("50.00"),
            entries=[
                {"entry_type": "material", "unit_price": Decimal("25.50"), "quantity": Decimal("3")},
            ],
        )
        result = compute_line_item_totals(item)
        assert result["total_cost"] == Decimal("76.50")
        assert result["total_hours"] == Decimal("0")
        assert result["material_cost"] == Decimal("76.50")
        assert result["fee_cost"] == Decimal("0")

    def test_single_hours_entry(self):
        """Hours entry: hours * hourly_rate."""
        item = _make_line_item(
            hourly_rate=Decimal("75.00"),
            entries=[
                {"entry_type": "hours", "hours": Decimal("4")},
            ],
        )
        result = compute_line_item_totals(item)
        assert result["total_cost"] == Decimal("300.00")
        assert result["total_hours"] == Decimal("4")
        assert result["material_cost"] == Decimal("0")
        assert result["fee_cost"] == Decimal("0")

    def test_single_fee_entry(self):
        """Fee entry: unit_price * quantity (defaults qty=1 if None)."""
        item = _make_line_item(
            hourly_rate=Decimal("50.00"),
            entries=[
                {"entry_type": "fee", "unit_price": Decimal("100.00"), "quantity": Decimal("1")},
            ],
        )
        result = compute_line_item_totals(item)
        assert result["total_cost"] == Decimal("100.00")
        assert result["total_hours"] == Decimal("0")
        assert result["material_cost"] == Decimal("0")
        assert result["fee_cost"] == Decimal("100.00")

    def test_fee_with_no_quantity_defaults_to_one(self):
        """Fee with quantity=None should default to 1."""
        item = _make_line_item(
            hourly_rate=Decimal("50.00"),
            entries=[
                {"entry_type": "fee", "unit_price": Decimal("200.00"), "quantity": None},
            ],
        )
        result = compute_line_item_totals(item)
        assert result["fee_cost"] == Decimal("200.00")

    def test_mixed_entries(self):
        """Multiple entries of different types sum correctly."""
        item = _make_line_item(
            hourly_rate=Decimal("60.00"),
            entries=[
                {"entry_type": "material", "unit_price": Decimal("10.00"), "quantity": Decimal("5")},
                {"entry_type": "material", "unit_price": Decimal("3.50"), "quantity": Decimal("10")},
                {"entry_type": "hours", "hours": Decimal("2.5")},
                {"entry_type": "fee", "unit_price": Decimal("50.00"), "quantity": Decimal("1")},
            ],
        )
        result = compute_line_item_totals(item)
        # Materials: 50 + 35 = 85
        assert result["material_cost"] == Decimal("85.00")
        # Hours: 2.5 * 60 = 150
        assert result["total_hours"] == Decimal("2.5")
        # Fee: 50
        assert result["fee_cost"] == Decimal("50.00")
        # Total: 85 + 150 + 50 = 285
        assert result["total_cost"] == Decimal("285.00")

    def test_zero_hourly_rate(self):
        """Hours entry with zero hourly_rate = zero cost."""
        item = _make_line_item(
            hourly_rate=Decimal("0"),
            entries=[
                {"entry_type": "hours", "hours": Decimal("8")},
            ],
        )
        result = compute_line_item_totals(item)
        assert result["total_cost"] == Decimal("0")
        assert result["total_hours"] == Decimal("8")

    def test_none_hourly_rate_treated_as_zero(self):
        """None hourly_rate treated as zero."""
        item = _make_line_item(
            hourly_rate=None,
            entries=[
                {"entry_type": "hours", "hours": Decimal("3")},
            ],
        )
        result = compute_line_item_totals(item)
        assert result["total_cost"] == Decimal("0")
        assert result["total_hours"] == Decimal("3")

    def test_none_material_fields_treated_as_zero(self):
        """None unit_price or quantity → 0."""
        item = _make_line_item(
            hourly_rate=Decimal("50.00"),
            entries=[
                {"entry_type": "material", "unit_price": None, "quantity": Decimal("5")},
                {"entry_type": "material", "unit_price": Decimal("10.00"), "quantity": None},
            ],
        )
        result = compute_line_item_totals(item)
        assert result["total_cost"] == Decimal("0")
        assert result["material_cost"] == Decimal("0")

    def test_empty_entries(self):
        """Line item with no entries = all zeros."""
        item = _make_line_item(hourly_rate=Decimal("100.00"), entries=[])
        result = compute_line_item_totals(item)
        assert result["total_cost"] == Decimal("0")
        assert result["total_hours"] == Decimal("0")
        assert result["material_cost"] == Decimal("0")
        assert result["fee_cost"] == Decimal("0")

    def test_large_values(self):
        """Verify no overflow with large realistic values."""
        item = _make_line_item(
            hourly_rate=Decimal("250.00"),
            entries=[
                {"entry_type": "material", "unit_price": Decimal("9999.99"), "quantity": Decimal("100")},
                {"entry_type": "hours", "hours": Decimal("1000")},
            ],
        )
        result = compute_line_item_totals(item)
        # Materials: 9999.99 * 100 = 999,999
        assert result["material_cost"] == Decimal("999999.00")
        # Hours: 1000 * 250 = 250,000
        assert result["total_cost"] == Decimal("1249999.00")

    def test_fractional_quantities(self):
        """Fractional quantities compute correctly."""
        item = _make_line_item(
            hourly_rate=Decimal("50.00"),
            entries=[
                {"entry_type": "material", "unit_price": Decimal("7.99"), "quantity": Decimal("2.5")},
            ],
        )
        result = compute_line_item_totals(item)
        assert result["total_cost"] == Decimal("19.975")
        assert result["material_cost"] == Decimal("19.975")


# ===========================================================================
# compute_totals_with_tax
# ===========================================================================


class TestComputeTotalsWithTax:
    """Unit tests for compute_totals_with_tax."""

    def test_no_tax(self):
        """Tax rate = None means no tax."""
        item = _make_line_item(
            hourly_rate=Decimal("60.00"),
            entries=[
                {"entry_type": "material", "unit_price": Decimal("100.00"), "quantity": Decimal("1")},
                {"entry_type": "hours", "hours": Decimal("2")},
            ],
        )
        result = compute_totals_with_tax([item], None)
        assert result["subtotal"] == Decimal("220.00")
        assert result["tax_amount"] == Decimal("0")
        assert result["total"] == Decimal("220.00")
        assert result["taxable_amount"] == Decimal("100.00")

    def test_zero_tax_rate(self):
        """Explicit zero tax rate produces zero tax."""
        item = _make_line_item(
            hourly_rate=Decimal("50.00"),
            entries=[
                {"entry_type": "material", "unit_price": Decimal("200.00"), "quantity": Decimal("1")},
            ],
        )
        result = compute_totals_with_tax([item], Decimal("0"))
        assert result["tax_amount"] == Decimal("0")
        assert result["total"] == Decimal("200.00")

    def test_standard_tax_rate(self):
        """8.5% tax on materials only (not hours or fees)."""
        item = _make_line_item(
            hourly_rate=Decimal("75.00"),
            entries=[
                {"entry_type": "material", "unit_price": Decimal("100.00"), "quantity": Decimal("2")},
                {"entry_type": "hours", "hours": Decimal("3")},
                {"entry_type": "fee", "unit_price": Decimal("50.00"), "quantity": Decimal("1")},
            ],
        )
        result = compute_totals_with_tax([item], Decimal("8.5"))
        # Materials: 100 * 2 = 200 (taxable)
        # Hours: 3 * 75 = 225 (not taxable)
        # Fee: 50 (not taxable)
        # Subtotal: 200 + 225 + 50 = 475
        assert result["subtotal"] == Decimal("475.00")
        assert result["taxable_amount"] == Decimal("200.00")
        # Tax: 200 * 8.5 / 100 = 17.0000
        assert result["tax_amount"] == Decimal("17.0000")
        # Total: 475 + 17 = 492
        assert result["total"] == Decimal("492.0000")

    def test_labor_cost_breakdown(self):
        """labor_cost = subtotal - materials - fees."""
        item = _make_line_item(
            hourly_rate=Decimal("80.00"),
            entries=[
                {"entry_type": "material", "unit_price": Decimal("50.00"), "quantity": Decimal("4")},
                {"entry_type": "hours", "hours": Decimal("5")},
                {"entry_type": "fee", "unit_price": Decimal("100.00"), "quantity": Decimal("1")},
            ],
        )
        result = compute_totals_with_tax([item], Decimal("10"))
        # Materials: 200, Hours: 400, Fee: 100
        assert result["labor_cost"] == Decimal("400.00")
        assert result["fee_cost"] == Decimal("100.00")
        assert result["labor_and_fees"] == Decimal("500.00")
        assert result["total_hours"] == Decimal("5")

    def test_multiple_line_items(self):
        """Multiple line items are summed correctly."""
        item1 = _make_line_item(
            hourly_rate=Decimal("60.00"),
            entries=[
                {"entry_type": "material", "unit_price": Decimal("30.00"), "quantity": Decimal("2")},
                {"entry_type": "hours", "hours": Decimal("1")},
            ],
        )
        item2 = _make_line_item(
            hourly_rate=Decimal("80.00"),
            entries=[
                {"entry_type": "material", "unit_price": Decimal("15.00"), "quantity": Decimal("4")},
                {"entry_type": "hours", "hours": Decimal("2")},
            ],
        )
        result = compute_totals_with_tax([item1, item2], Decimal("7"))
        # Item1: materials=60, hours=60 → 120
        # Item2: materials=60, hours=160 → 220
        # Subtotal: 340
        assert result["subtotal"] == Decimal("340.00")
        # Taxable materials: 60 + 60 = 120
        assert result["taxable_amount"] == Decimal("120.00")
        # Tax: 120 * 7/100 = 8.4000
        assert result["tax_amount"] == Decimal("8.4000")
        assert result["total"] == Decimal("348.4000")
        assert result["total_hours"] == Decimal("3")

    def test_empty_items_list(self):
        """Empty items list = all zeros."""
        result = compute_totals_with_tax([], Decimal("10"))
        assert result["subtotal"] == Decimal("0")
        assert result["tax_amount"] == Decimal("0")
        assert result["total"] == Decimal("0")

    def test_high_tax_rate(self):
        """Edge case: very high tax rate."""
        item = _make_line_item(
            hourly_rate=Decimal("50.00"),
            entries=[
                {"entry_type": "material", "unit_price": Decimal("1000.00"), "quantity": Decimal("1")},
            ],
        )
        result = compute_totals_with_tax([item], Decimal("25"))
        # Tax: 1000 * 25/100 = 250
        assert result["tax_amount"] == Decimal("250.0000")
        assert result["total"] == Decimal("1250.0000")

    def test_tax_only_on_materials_not_fees(self):
        """Verify fees are NOT taxed (same as hours)."""
        item = _make_line_item(
            hourly_rate=Decimal("0"),
            entries=[
                {"entry_type": "fee", "unit_price": Decimal("500.00"), "quantity": Decimal("1")},
            ],
        )
        result = compute_totals_with_tax([item], Decimal("10"))
        # Fee is not taxable, so tax = 0
        assert result["taxable_amount"] == Decimal("0")
        assert result["tax_amount"] == Decimal("0")
        assert result["total"] == Decimal("500.00")


# ===========================================================================
# Hypothesis property-based tests
# ===========================================================================


class TestFinancialProperties:
    """Property-based tests for financial invariants."""

    @given(
        unit_price=st.decimals(min_value=0, max_value=100000, places=2, allow_nan=False, allow_infinity=False),
        quantity=st.decimals(min_value=0, max_value=1000, places=2, allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=100)
    def test_material_cost_is_nonnegative(self, unit_price, quantity):
        """Material cost should always be >= 0."""
        item = _make_line_item(
            hourly_rate=Decimal("0"),
            entries=[{"entry_type": "material", "unit_price": unit_price, "quantity": quantity}],
        )
        result = compute_line_item_totals(item)
        assert result["total_cost"] >= Decimal("0")
        assert result["material_cost"] >= Decimal("0")

    @given(
        hours=st.decimals(min_value=0, max_value=1000, places=2, allow_nan=False, allow_infinity=False),
        rate=st.decimals(min_value=0, max_value=1000, places=2, allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=100)
    def test_labor_cost_equals_hours_times_rate(self, hours, rate):
        """Labor cost = hours * hourly_rate (exactly)."""
        item = _make_line_item(
            hourly_rate=rate,
            entries=[{"entry_type": "hours", "hours": hours}],
        )
        result = compute_line_item_totals(item)
        assert result["total_cost"] == hours * rate

    @given(
        tax_rate=st.decimals(min_value=0, max_value=50, places=2, allow_nan=False, allow_infinity=False),
        material_cost=st.decimals(min_value=0, max_value=100000, places=2, allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=100)
    def test_total_equals_subtotal_plus_tax(self, tax_rate, material_cost):
        """total = subtotal + tax_amount (invariant)."""
        item = _make_line_item(
            hourly_rate=Decimal("0"),
            entries=[{"entry_type": "material", "unit_price": material_cost, "quantity": Decimal("1")}],
        )
        result = compute_totals_with_tax([item], tax_rate)
        assert result["total"] == result["subtotal"] + result["tax_amount"]

    @given(
        tax_rate=st.decimals(min_value=0, max_value=50, places=2, allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=50)
    def test_tax_is_nonnegative(self, tax_rate):
        """Tax should never be negative."""
        item = _make_line_item(
            hourly_rate=Decimal("50.00"),
            entries=[
                {"entry_type": "material", "unit_price": Decimal("100.00"), "quantity": Decimal("1")},
                {"entry_type": "hours", "hours": Decimal("2")},
            ],
        )
        result = compute_totals_with_tax([item], tax_rate)
        assert result["tax_amount"] >= Decimal("0")
