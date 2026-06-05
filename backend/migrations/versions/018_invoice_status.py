"""Add status column to invoices table.

Replaces the boolean 'delivered' field with a proper status workflow:
  - drafting (default)
  - waiting_to_send
  - sent_awaiting_payment
  - paid

Revision ID: 018
Revises: 017
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column(
            "status",
            sa.String(30),
            nullable=False,
            server_default="drafting",
        ),
    )
    # Migrate existing data: delivered=true → "paid", delivered=false → "drafting"
    op.execute(
        "UPDATE invoices SET status = 'sent_awaiting_payment' WHERE delivered = true"
    )
    op.execute(
        "UPDATE invoices SET status = 'drafting' WHERE delivered = false"
    )
    op.create_check_constraint(
        "ck_invoices_status",
        "invoices",
        "status IN ('drafting', 'waiting_to_send', 'sent_awaiting_payment', 'paid')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_invoices_status", "invoices")
    op.drop_column("invoices", "status")
