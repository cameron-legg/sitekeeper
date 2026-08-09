"""Add business logo support.

- business_info.logo_object_key: stores the MinIO object key for the uploaded logo
- estimates.show_logo: visibility flag for logo on estimate PDFs (default False)
- invoices.show_logo: visibility flag for logo on invoice PDFs (default False)
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("business_info", sa.Column("logo_object_key", sa.Text(), nullable=True))
    op.add_column("estimates", sa.Column("show_logo", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("invoices", sa.Column("show_logo", sa.Boolean(), nullable=False, server_default=sa.text("false")))


def downgrade():
    op.drop_column("invoices", "show_logo")
    op.drop_column("estimates", "show_logo")
    op.drop_column("business_info", "logo_object_key")
