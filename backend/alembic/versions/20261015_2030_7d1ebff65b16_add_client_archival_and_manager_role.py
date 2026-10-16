"""add_client_archival_and_manager_role

Revision ID: 7d1ebff65b16
Revises: 6c0faee54a05
Create Date: 2026-10-15 20:30:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7d1ebff65b16"
down_revision: str | None = "6c0faee54a05"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add archival and author columns to customers table
    op.add_column(
        "customers",
        sa.Column("reference_source", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "customers",
        sa.Column(
            "is_archived",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "customers",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "customers",
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        op.f("ix_customers_is_archived"), "customers", ["is_archived"], unique=False
    )
    op.create_foreign_key(
        "fk_customers_created_by_id_users",
        "customers",
        "users",
        ["created_by_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_customers_created_by_id_users", "customers", type_="foreignkey"
    )
    op.drop_index(op.f("ix_customers_is_archived"), table_name="customers")
    op.drop_column("customers", "created_by_id")
    op.drop_column("customers", "archived_at")
    op.drop_column("customers", "is_archived")
    op.drop_column("customers", "reference_source")
