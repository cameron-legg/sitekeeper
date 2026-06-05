"""Add status_changed_at to invoices and invoice_status_history table.

Tracks when each status transition occurred for audit/display purposes.

Revision ID: 019
Revises: 018
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add status_changed_at to invoices (when current status was set)
    op.add_column(
        "invoices",
        sa.Column(
            "status_changed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            server_default=sa.text("now()"),
        ),
    )
    # Backfill: set status_changed_at = updated_at for existing rows
    op.execute("UPDATE invoices SET status_changed_at = updated_at WHERE status_changed_at IS NULL")

    # Status history table
    op.create_table(
        "invoice_status_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("invoice_id", UUID(as_uuid=True), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("changed_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_invoice_status_history_invoice", "invoice_status_history", ["invoice_id", "changed_at"])


def downgrade() -> None:
    op.drop_index("ix_invoice_status_history_invoice")
    op.drop_table("invoice_status_history")
    op.drop_column("invoices", "status_changed_at")
