"""Add backend_error_log table (per-tenant server error log).

Stores unhandled 5xx errors in each tenant's own database. Read only by
the platform/superadmin panel, never exposed to tenant users.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "backend_error_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_slug", sa.String(63), nullable=True),
        sa.Column("error_type", sa.String(255), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("stack_trace", sa.Text(), nullable=True),
        sa.Column("http_method", sa.String(10), nullable=True),
        sa.Column("path", sa.Text(), nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=False, server_default="500"),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("context", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_backend_error_log_request_id", "backend_error_log", ["request_id"])
    op.create_index("ix_backend_error_log_tenant_slug", "backend_error_log", ["tenant_slug"])
    op.create_index("ix_backend_error_log_created_at", "backend_error_log", ["created_at"])


def downgrade():
    op.drop_index("ix_backend_error_log_created_at", table_name="backend_error_log")
    op.drop_index("ix_backend_error_log_tenant_slug", table_name="backend_error_log")
    op.drop_index("ix_backend_error_log_request_id", table_name="backend_error_log")
    op.drop_table("backend_error_log")
