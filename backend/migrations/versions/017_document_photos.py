"""Add document_photos junction table linking job_photos to estimates/invoices.

This allows users to select which job photos appear in their PDF documents.
Uses a polymorphic parent pattern (same as line_items).

Revision ID: 017
Revises: 016
Create Date: 2026-06-03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_photos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", UUID(as_uuid=True), nullable=False),
        sa.Column("document_type", sa.String(20), nullable=False),
        sa.Column("photo_id", UUID(as_uuid=True), sa.ForeignKey("job_photos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("document_type IN ('estimate', 'invoice')", name="ck_document_photos_type"),
    )
    op.create_index("ix_document_photos_document", "document_photos", ["document_id", "document_type"])
    op.create_index("ix_document_photos_unique", "document_photos", ["document_id", "photo_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_document_photos_unique")
    op.drop_index("ix_document_photos_document")
    op.drop_table("document_photos")
