"""Add time_entries table for tracking employee hours on jobs.

A time entry can be:
  - A clock-in/clock-out pair (clock_in + clock_out timestamps, hours computed)
  - A manual entry (hours field set directly, no clock_in/clock_out)

Revision ID: 014
Revises: 013
Create Date: 2026-05-31
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "time_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("clock_in", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("clock_out", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("hours", sa.Numeric(8, 4), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_time_entries_job_id", "time_entries", ["job_id"])
    op.create_index("ix_time_entries_user_id", "time_entries", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_time_entries_user_id")
    op.drop_index("ix_time_entries_job_id")
    op.drop_table("time_entries")
