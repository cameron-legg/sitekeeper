"""Add document metadata fields to estimates and invoices.

Adds:
- document_numbers table for auto-increment tracking
- Metadata columns on estimates/invoices: document_number, document_date,
  bill_to, company_name, user_name, user_phone, user_email, payment_method,
  business_address, worksite_address, notes, and show_* visibility flags
- address column on users table (for profile business address)

Revision ID: 009
Revises: 008
Create Date: 2026-05-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Document number tracking table ---
    op.create_table(
        "document_numbers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_type", sa.String(20), nullable=False),  # 'estimate' or 'invoice'
        sa.Column("next_number", sa.Integer(), nullable=False, server_default="1"),
    )
    # Seed one row per type
    op.execute("""
        INSERT INTO document_numbers (id, document_type, next_number)
        VALUES (gen_random_uuid(), 'estimate', 1), (gen_random_uuid(), 'invoice', 1)
    """)

    # --- Add address to users (business address for profile) ---
    op.add_column("users", sa.Column("address", sa.String(500), nullable=True))

    # --- Estimate metadata columns ---
    estimate_cols = [
        sa.Column("document_number", sa.String(50), nullable=True),
        sa.Column("document_date", sa.Date(), nullable=True),
        sa.Column("bill_to", sa.Text(), nullable=True),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column("user_name", sa.String(255), nullable=True),
        sa.Column("user_phone", sa.String(50), nullable=True),
        sa.Column("user_email", sa.String(255), nullable=True),
        sa.Column("payment_method", sa.String(255), nullable=True),
        sa.Column("business_address", sa.String(500), nullable=True),
        sa.Column("worksite_address", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        # Visibility flags — default True (show everything)
        sa.Column("show_document_number", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_document_date", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_bill_to", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_company_name", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_user_name", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_user_phone", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_user_email", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_payment_method", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_business_address", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_worksite_address", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_notes", sa.Boolean(), nullable=False, server_default="true"),
    ]
    for col in estimate_cols:
        op.add_column("estimates", col)

    # --- Invoice metadata columns (identical) ---
    invoice_cols = [
        sa.Column("document_number", sa.String(50), nullable=True),
        sa.Column("document_date", sa.Date(), nullable=True),
        sa.Column("bill_to", sa.Text(), nullable=True),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column("user_name", sa.String(255), nullable=True),
        sa.Column("user_phone", sa.String(50), nullable=True),
        sa.Column("user_email", sa.String(255), nullable=True),
        sa.Column("payment_method", sa.String(255), nullable=True),
        sa.Column("business_address", sa.String(500), nullable=True),
        sa.Column("worksite_address", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("show_document_number", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_document_date", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_bill_to", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_company_name", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_user_name", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_user_phone", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_user_email", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_payment_method", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_business_address", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_worksite_address", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_notes", sa.Boolean(), nullable=False, server_default="true"),
    ]
    for col in invoice_cols:
        op.add_column("invoices", col)


def downgrade() -> None:
    # Drop invoice metadata columns
    for col_name in [
        "document_number", "document_date", "bill_to", "company_name",
        "user_name", "user_phone", "user_email", "payment_method",
        "business_address", "worksite_address", "notes",
        "show_document_number", "show_document_date", "show_bill_to",
        "show_company_name", "show_user_name", "show_user_phone",
        "show_user_email", "show_payment_method", "show_business_address",
        "show_worksite_address", "show_notes",
    ]:
        op.drop_column("invoices", col_name)

    # Drop estimate metadata columns
    for col_name in [
        "document_number", "document_date", "bill_to", "company_name",
        "user_name", "user_phone", "user_email", "payment_method",
        "business_address", "worksite_address", "notes",
        "show_document_number", "show_document_date", "show_bill_to",
        "show_company_name", "show_user_name", "show_user_phone",
        "show_user_email", "show_payment_method", "show_business_address",
        "show_worksite_address", "show_notes",
    ]:
        op.drop_column("estimates", col_name)

    # Drop address from users
    op.drop_column("users", "address")

    # Drop document_numbers table
    op.drop_table("document_numbers")
