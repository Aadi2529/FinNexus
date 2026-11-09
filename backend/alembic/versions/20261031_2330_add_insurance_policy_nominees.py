"""Add insurance policy nominees table for nominee management.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-31 23:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: str | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create insurance_policy_nominees table
    op.create_table(
        "insurance_policy_nominees",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("policy_id", sa.Uuid(), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("relationship", sa.String(length=50), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("mobile_number", sa.String(length=50), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("share_percentage", sa.Numeric(precision=5, scale=2), server_default="100.00", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["policy_id"],
            ["insurance_policies.id"],
            name="fk_insurance_policy_nominees_policy_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_insurance_policy_nominees"),
    )
    op.create_index(
        "ix_insurance_policy_nominees_policy_id",
        "insurance_policy_nominees",
        ["policy_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_insurance_policy_nominees_policy_id", table_name="insurance_policy_nominees")
    op.drop_table("insurance_policy_nominees")
