"""Add 'fee' to line_item_entries entry_type check constraint.

Revision ID: 021
Revises: 020
"""

from alembic import op


revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade():
    # Drop old check constraint and add new one with 'fee' included
    op.drop_constraint("ck_line_item_entries_type", "line_item_entries", type_="check")
    op.create_check_constraint(
        "ck_line_item_entries_type",
        "line_item_entries",
        "entry_type IN ('material', 'hours', 'fee')",
    )
    # Also update saved_item_entries constraint
    op.drop_constraint("ck_saved_item_entries_type", "saved_item_entries", type_="check")
    op.create_check_constraint(
        "ck_saved_item_entries_type",
        "saved_item_entries",
        "entry_type IN ('material', 'hours', 'fee')",
    )


def downgrade():
    op.drop_constraint("ck_line_item_entries_type", "line_item_entries", type_="check")
    op.create_check_constraint(
        "ck_line_item_entries_type",
        "line_item_entries",
        "entry_type IN ('material', 'hours')",
    )
    op.drop_constraint("ck_saved_item_entries_type", "saved_item_entries", type_="check")
    op.create_check_constraint(
        "ck_saved_item_entries_type",
        "saved_item_entries",
        "entry_type IN ('material', 'hours')",
    )
