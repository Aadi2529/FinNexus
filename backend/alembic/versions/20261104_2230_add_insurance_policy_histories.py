"""Add insurance policy histories table for portability and renewal tracking.

Revision ID: f3b4c5d6e7f8
Revises: e1f2a3b4c5d6
Create Date: 2026-11-04 22:30:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "f3b4c5d6e7f8"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create table: insurance_policy_histories
    op.create_table(
        "insurance_policy_histories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "current_policy_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("insurance_policies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "previous_policy_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("insurance_policies.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("insurance_company_name", sa.String(255), nullable=False),
        sa.Column("previous_policy_number", sa.String(150), nullable=False),
        sa.Column("policy_business_type", sa.String(50), nullable=False, server_default="PORT"),
        sa.Column("history_sequence", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("policy_start_date", sa.Date(), nullable=True),
        sa.Column("policy_expiry_date", sa.Date(), nullable=True),
        sa.Column("sum_insured", sa.Numeric(14, 2), nullable=True),
        sa.Column("net_premium", sa.Numeric(14, 2), nullable=True),
        sa.Column("gross_premium", sa.Numeric(14, 2), nullable=True),
        sa.Column("product_variant", sa.String(150), nullable=True),
        sa.Column("policy_status", sa.String(50), nullable=True, server_default="EXPIRED"),
        sa.Column("claim_history", sa.Text(), nullable=True),
        sa.Column("insurer_contact", sa.String(255), nullable=True),
        sa.Column("cumulative_bonus", sa.String(100), nullable=True),
        sa.Column("continuity_details", sa.Text(), nullable=True),
        sa.Column("waiting_period_waiver_details", sa.Text(), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("is_external_policy", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 2. Create indexes
    op.create_index(
        "ix_insurance_policy_histories_current_policy",
        "insurance_policy_histories",
        ["current_policy_id"],
    )
    op.create_index(
        "ix_insurance_policy_histories_prev_policy",
        "insurance_policy_histories",
        ["previous_policy_id"],
    )
    op.create_index(
        "ix_insurance_policy_histories_company",
        "insurance_policy_histories",
        ["insurance_company_name"],
    )
    op.create_index(
        "ix_insurance_policy_histories_number",
        "insurance_policy_histories",
        ["previous_policy_number"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_insurance_policy_histories_number",
        table_name="insurance_policy_histories",
    )
    op.drop_index(
        "ix_insurance_policy_histories_company",
        table_name="insurance_policy_histories",
    )
    op.drop_index(
        "ix_insurance_policy_histories_prev_policy",
        table_name="insurance_policy_histories",
    )
    op.drop_index(
        "ix_insurance_policy_histories_current_policy",
        table_name="insurance_policy_histories",
    )
    op.drop_table("insurance_policy_histories")
