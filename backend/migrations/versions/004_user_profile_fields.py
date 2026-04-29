"""Add profile fields to users table.

Revision ID: 004
Revises: 003
Create Date: 2026-04-28

Adds name, state, company_name, phone, and payment_method columns
to the users table for contractor profile settings.
"""

from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("name", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("state", sa.String(2), nullable=True))
    op.add_column("users", sa.Column("company_name", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("payment_method", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "payment_method")
    op.drop_column("users", "phone")
    op.drop_column("users", "company_name")
    op.drop_column("users", "state")
    op.drop_column("users", "name")
