"""Add role and is_approved columns to users table for tenant access control.

Revision ID: 007
Revises: 006
Create Date: 2026-05-05
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "role",
            sa.String(20),
            nullable=False,
            server_default="member",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "is_approved",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    # All existing users are approved (they were already using the system).
    # The server_default of 'true' handles this.
    # For new tenant databases, the first user gets admin+approved via app logic,
    # subsequent users get member+not-approved.


def downgrade() -> None:
    op.drop_column("users", "is_approved")
    op.drop_column("users", "role")
