"""Add business_info table and remove business fields from users.

Creates a tenant-level business_info table with fields that were previously
per-user: state, company_name (now business_name), payment_method, address.
Also adds business_phone and business_email.

Removes state, company_name, payment_method, and address from users table.
Keeps phone on users (personal phone for each employee).

Does NOT modify any existing estimate/invoice rows — their snapshotted
metadata remains intact.

Revision ID: 010
Revises: 009
Create Date: 2026-05-23
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Create business_info table (one row per tenant database) ---
    op.create_table(
        "business_info",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_name", sa.String(255), nullable=True),
        sa.Column("state", sa.String(2), nullable=True),
        sa.Column("payment_method", sa.String(255), nullable=True),
        sa.Column("business_address", sa.String(500), nullable=True),
        sa.Column("business_phone", sa.String(50), nullable=True),
        sa.Column("business_email", sa.String(255), nullable=True),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # Seed a single row so GET always returns something
    op.execute("""
        INSERT INTO business_info (id, business_name, state, payment_method, business_address, business_phone, business_email)
        SELECT gen_random_uuid(),
               (SELECT company_name FROM users WHERE role = 'admin' LIMIT 1),
               (SELECT state FROM users WHERE role = 'admin' LIMIT 1),
               (SELECT payment_method FROM users WHERE role = 'admin' LIMIT 1),
               (SELECT address FROM users WHERE role = 'admin' LIMIT 1),
               (SELECT phone FROM users WHERE role = 'admin' LIMIT 1),
               (SELECT email FROM users WHERE role = 'admin' LIMIT 1)
    """)

    # --- Remove business fields from users (keep phone) ---
    op.drop_column("users", "state")
    op.drop_column("users", "company_name")
    op.drop_column("users", "payment_method")
    op.drop_column("users", "address")


def downgrade() -> None:
    # Re-add columns to users
    op.add_column("users", sa.Column("address", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("payment_method", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("company_name", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("state", sa.String(2), nullable=True))

    # Drop business_info table
    op.drop_table("business_info")
