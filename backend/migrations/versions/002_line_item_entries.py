"""Line item entries — restructure line_items and saved_items for sub-item support.

Revision ID: 002
Revises: 001
Create Date: 2026-04-21
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # line_items — drop old columns, add hourly_rate
    # ------------------------------------------------------------------
    op.drop_column("line_items", "price")
    op.drop_column("line_items", "url")
    op.drop_column("line_items", "hours")
    op.add_column(
        "line_items",
        sa.Column("hourly_rate", sa.Numeric(12, 4), nullable=True),
    )

    # ------------------------------------------------------------------
    # line_item_entries — new table
    # ------------------------------------------------------------------
    op.create_table(
        "line_item_entries",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "line_item_id",
            UUID(as_uuid=True),
            sa.ForeignKey("line_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entry_type", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("unit_price", sa.Numeric(12, 4), nullable=True),
        sa.Column("quantity", sa.Numeric(12, 4), nullable=True),
        sa.Column("hours", sa.Numeric(12, 4), nullable=True),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.CheckConstraint(
            "entry_type IN ('material', 'hours')",
            name="ck_line_item_entries_type",
        ),
    )

    # ------------------------------------------------------------------
    # saved_items — drop old columns, add hourly_rate
    # ------------------------------------------------------------------
    op.drop_column("saved_items", "price")
    op.drop_column("saved_items", "url")
    op.drop_column("saved_items", "hours")
    op.add_column(
        "saved_items",
        sa.Column("hourly_rate", sa.Numeric(12, 4), nullable=True),
    )

    # ------------------------------------------------------------------
    # saved_item_entries — new table
    # ------------------------------------------------------------------
    op.create_table(
        "saved_item_entries",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "saved_item_id",
            UUID(as_uuid=True),
            sa.ForeignKey("saved_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entry_type", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("unit_price", sa.Numeric(12, 4), nullable=True),
        sa.Column("quantity", sa.Numeric(12, 4), nullable=True),
        sa.Column("hours", sa.Numeric(12, 4), nullable=True),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.CheckConstraint(
            "entry_type IN ('material', 'hours')",
            name="ck_saved_item_entries_type",
        ),
    )


def downgrade() -> None:
    op.drop_table("saved_item_entries")
    op.drop_column("saved_items", "hourly_rate")
    op.add_column("saved_items", sa.Column("hours", sa.Numeric(12, 4), nullable=True))
    op.add_column("saved_items", sa.Column("url", sa.Text(), nullable=True))
    op.add_column("saved_items", sa.Column("price", sa.Numeric(12, 4), nullable=True))

    op.drop_table("line_item_entries")
    op.drop_column("line_items", "hourly_rate")
    op.add_column("line_items", sa.Column("hours", sa.Numeric(12, 4), nullable=True))
    op.add_column("line_items", sa.Column("url", sa.Text(), nullable=True))
    op.add_column(
        "line_items",
        sa.Column("price", sa.Numeric(12, 4), nullable=False, server_default=sa.text("0")),
    )
