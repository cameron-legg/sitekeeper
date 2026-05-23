"""Add default_hourly_rate to business_info, job_sites, and jobs.

Implements an inheritance chain:
  business_info.default_hourly_rate → job_sites.default_hourly_rate → jobs.default_hourly_rate

Values are copied downstream at creation time. Existing rows get NULL
(no default until explicitly set by the user).

Revision ID: 012
Revises: 011
Create Date: 2026-05-23
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("business_info", sa.Column("default_hourly_rate", sa.Numeric(12, 4), nullable=True))
    op.add_column("job_sites", sa.Column("default_hourly_rate", sa.Numeric(12, 4), nullable=True))
    op.add_column("jobs", sa.Column("default_hourly_rate", sa.Numeric(12, 4), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "default_hourly_rate")
    op.drop_column("job_sites", "default_hourly_rate")
    op.drop_column("business_info", "default_hourly_rate")
