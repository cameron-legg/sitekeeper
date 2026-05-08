"""Make saved_item_id nullable on saved_item_entries.

This allows entries to exist standalone in the Materials Library without
requiring a parent SavedItem (Item Library entry).

Revision ID: 008
Revises: 007
Create Date: 2026-05-07
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "saved_item_entries",
        "saved_item_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=True,
    )
    # Add user_id column for standalone entries (entries without a parent SavedItem)
    op.add_column(
        "saved_item_entries",
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_saved_item_entries_user_id",
        "saved_item_entries",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    # Backfill user_id from the parent saved_item for existing rows
    op.execute("""
        UPDATE saved_item_entries
        SET user_id = saved_items.user_id
        FROM saved_items
        WHERE saved_item_entries.saved_item_id = saved_items.id
    """)


def downgrade() -> None:
    # Delete any standalone entries (no saved_item_id) before making column NOT NULL
    op.execute("DELETE FROM saved_item_entries WHERE saved_item_id IS NULL")
    op.drop_constraint("fk_saved_item_entries_user_id", "saved_item_entries", type_="foreignkey")
    op.drop_column("saved_item_entries", "user_id")
    op.alter_column(
        "saved_item_entries",
        "saved_item_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=False,
    )
