"""Add PDF columns to estimates and invoices tables.

Revision ID: 006
Revises: 005
Create Date: 2026-05-15

Adds pdf_generated_at (TIMESTAMPTZ) and pdf_object_key (TEXT) columns
to both estimates and invoices tables for PDF generation tracking.
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "estimates",
        sa.Column("pdf_generated_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "estimates",
        sa.Column("pdf_object_key", sa.Text(), nullable=True),
    )
    op.add_column(
        "invoices",
        sa.Column("pdf_generated_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "invoices",
        sa.Column("pdf_object_key", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("invoices", "pdf_object_key")
    op.drop_column("invoices", "pdf_generated_at")
    op.drop_column("estimates", "pdf_object_key")
    op.drop_column("estimates", "pdf_generated_at")
