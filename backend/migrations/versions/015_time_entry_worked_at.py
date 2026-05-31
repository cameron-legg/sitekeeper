"""Add worked_at column to time_entries for manual hour date tracking.

For clock-in/out entries, the clock_in timestamp serves as the date reference.
For manual entries, worked_at stores the date/time the work was performed.

Revision ID: 015
Revises: 014
Create Date: 2026-05-31
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "time_entries",
        sa.Column("worked_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("time_entries", "worked_at")
