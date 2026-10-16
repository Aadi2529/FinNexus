"""add_work_order_scheduling_and_reminders

Revision ID: 8e2fcff76c27
Revises: 7d1ebff65b16
Create Date: 2026-10-16 01:00:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8e2fcff76c27"
down_revision: str | None = "7d1ebff65b16"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add work_priority and custom_priority to work_orders
    op.add_column(
        "work_orders",
        sa.Column("work_priority", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "work_orders",
        sa.Column("custom_priority", sa.String(length=150), nullable=True),
    )

    # 2. Create work_order_reminders association table
    op.create_table(
        "work_order_reminders",
        sa.Column("work_order_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["work_order_id"], ["work_orders.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("work_order_id", "user_id"),
    )
    op.create_index(
        op.f("ix_work_order_reminders_work_order_id"),
        "work_order_reminders",
        ["work_order_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_work_order_reminders_user_id"),
        "work_order_reminders",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_work_order_reminders_user_id"),
        table_name="work_order_reminders",
    )
    op.drop_index(
        op.f("ix_work_order_reminders_work_order_id"),
        table_name="work_order_reminders",
    )
    op.drop_table("work_order_reminders")
    op.drop_column("work_orders", "custom_priority")
    op.drop_column("work_orders", "work_priority")
