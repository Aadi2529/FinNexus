"""Add plan riders, plan benefits, and policy selected riders.

Revision ID: d1e2f3a4b5c6
Revises: f8e7d6c5b4a3
Create Date: 2026-11-08 20:00:00.000000

"""

import uuid
from alembic import op
import sqlalchemy as sa


revision = "d1e2f3a4b5c6"
down_revision = "f8e7d6c5b4a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create insurance_plan_riders table
    op.create_table(
        "insurance_plan_riders",
        sa.Column("id", sa.Uuid(), nullable=False, default=uuid.uuid4),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["plan_id"], ["insurance_plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_id", "name", name="uq_insurance_plan_riders_plan_name"),
    )
    op.create_index("ix_insurance_plan_riders_plan_id", "insurance_plan_riders", ["plan_id"])

    # 2. Create insurance_plan_benefits table
    op.create_table(
        "insurance_plan_benefits",
        sa.Column("id", sa.Uuid(), nullable=False, default=uuid.uuid4),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["plan_id"], ["insurance_plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_id", "name", name="uq_insurance_plan_benefits_plan_name"),
    )
    op.create_index("ix_insurance_plan_benefits_plan_id", "insurance_plan_benefits", ["plan_id"])

    # 3. Create insurance_policy_riders table
    op.create_table(
        "insurance_policy_riders",
        sa.Column("id", sa.Uuid(), nullable=False, default=uuid.uuid4),
        sa.Column("policy_id", sa.Uuid(), nullable=False),
        sa.Column("rider_id", sa.Uuid(), nullable=True),
        sa.Column("rider_name", sa.String(255), nullable=False),
        sa.Column("rider_description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["policy_id"], ["insurance_policies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rider_id"], ["insurance_plan_riders.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("policy_id", "rider_id", name="uq_insurance_policy_riders_policy_rider"),
    )
    op.create_index("ix_insurance_policy_riders_policy_id", "insurance_policy_riders", ["policy_id"])
    op.create_index("ix_insurance_policy_riders_rider_id", "insurance_policy_riders", ["rider_id"])


def downgrade() -> None:
    op.drop_index("ix_insurance_policy_riders_rider_id", table_name="insurance_policy_riders")
    op.drop_index("ix_insurance_policy_riders_policy_id", table_name="insurance_policy_riders")
    op.drop_table("insurance_policy_riders")

    op.drop_index("ix_insurance_plan_benefits_plan_id", table_name="insurance_plan_benefits")
    op.drop_table("insurance_plan_benefits")

    op.drop_index("ix_insurance_plan_riders_plan_id", table_name="insurance_plan_riders")
    op.drop_table("insurance_plan_riders")
