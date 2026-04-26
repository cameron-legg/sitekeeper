"""Add tax_rate to estimates and invoices.

Revision ID: 003
Revises: 002
Create Date: 2026-04-26

tax_rate is stored as a decimal percentage (e.g. 8.5 means 8.5%).
NULL means no tax applies. Tax is calculated only on material entries.
"""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "estimates",
        sa.Column("tax_rate", sa.Numeric(6, 4), nullable=True),
    )
    op.add_column(
        "invoices",
        sa.Column("tax_rate", sa.Numeric(6, 4), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("invoices", "tax_rate")
    op.drop_column("estimates", "tax_rate")
