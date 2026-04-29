"""Add address column to job_sites table.

Revision ID: 005
Revises: 004
Create Date: 2026-04-28

Adds an address text column to job_sites for storing the physical
location of the job site.
"""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_sites", sa.Column("address", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("job_sites", "address")
