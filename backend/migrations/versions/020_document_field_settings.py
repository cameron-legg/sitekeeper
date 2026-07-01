"""Add document_field_settings table for tenant-level field visibility config.

Revision ID: 020
Revises: 019
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "document_field_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_type", sa.String(20), nullable=False),  # 'estimate' or 'invoice'
        sa.Column("field_key", sa.String(50), nullable=False),
        sa.Column("visibility", sa.String(20), nullable=False, server_default="always_show"),
        sa.Column("pdf_visible", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.UniqueConstraint("document_type", "field_key", name="uq_doc_field_settings_type_key"),
    )


def downgrade():
    op.drop_table("document_field_settings")
