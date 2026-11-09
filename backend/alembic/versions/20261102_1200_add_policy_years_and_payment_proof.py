"""Add multi-year policy contract details and payment proof document references.

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-11-02 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "e1f2a3b4c5d6"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create table: insurance_policy_years
    op.create_table(
        "insurance_policy_years",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "policy_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("insurance_policies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("policy_year", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("policy_number", sa.String(100), nullable=False),
        sa.Column("proposal_number", sa.String(100), nullable=True),
        sa.Column("business_type", sa.String(50), nullable=False, server_default="NEW"),
        sa.Column("prior_policy_number", sa.String(100), nullable=True),
        sa.Column("product_variant", sa.String(150), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("net_premium", sa.Numeric(14, 2), nullable=True),
        sa.Column("gross_premium", sa.Numeric(14, 2), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_insurance_policy_years_policy",
        "insurance_policy_years",
        ["policy_id"],
    )
    op.create_index(
        "ix_insurance_policy_years_number",
        "insurance_policy_years",
        ["policy_number"],
    )

    # 2. Add document attachment fields to insurance_policy_payments
    op.add_column(
        "insurance_policy_payments",
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("insurance_policy_documents.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "insurance_policy_payments",
        sa.Column("document_filename", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("insurance_policy_payments", "document_filename")
    op.drop_column("insurance_policy_payments", "document_id")
    op.drop_index("ix_insurance_policy_years_number", table_name="insurance_policy_years")
    op.drop_index("ix_insurance_policy_years_policy", table_name="insurance_policy_years")
    op.drop_table("insurance_policy_years")
