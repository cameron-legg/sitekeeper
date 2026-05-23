"""Add owner_user_id to business_info.

Allows selecting a user as the business owner whose name appears
on estimates/invoices by default.

Revision ID: 011
Revises: 010
Create Date: 2026-05-23
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "business_info",
        sa.Column("owner_user_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_business_info_owner_user",
        "business_info",
        "users",
        ["owner_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    # Default to the admin user
    op.execute("""
        UPDATE business_info
        SET owner_user_id = (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
    """)


def downgrade() -> None:
    op.drop_constraint("fk_business_info_owner_user", "business_info", type_="foreignkey")
    op.drop_column("business_info", "owner_user_id")
