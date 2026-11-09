"""Enhance Commission Management, Agreements, Reconciliation and Bank Receipts.

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-11-01 23:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "d0e1f2a3b4c5"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create table: insurance_company_commission_agreements
    op.create_table(
        "insurance_company_commission_agreements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "company_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("insurance_companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("policy_category", sa.String(50), nullable=False, server_default="ALL"),
        sa.Column(
            "plan_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("insurance_plans.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("first_year_commission_rate", sa.Numeric(6, 2), nullable=False),
        sa.Column("renewal_commission_rate", sa.Numeric(6, 2), nullable=False, server_default="7.50"),
        sa.Column("special_commission_rate", sa.Numeric(6, 2), nullable=True),
        sa.Column("commissionable_basis", sa.String(50), nullable=False, server_default="NET_PREMIUM"),
        sa.Column("tds_rate", sa.Numeric(5, 2), nullable=False, server_default="10.00"),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_insurance_company_commission_agreements_company",
        "insurance_company_commission_agreements",
        ["company_id"],
    )
    op.create_index(
        "ix_insurance_company_commission_agreements_category",
        "insurance_company_commission_agreements",
        ["policy_category"],
    )

    # 2. Add columns to insurance_commission_splits (Sub-Agent Commission Agreements)
    op.add_column("insurance_commission_splits", sa.Column("policy_category", sa.String(50), nullable=True))
    op.add_column(
        "insurance_commission_splits",
        sa.Column("commission_type", sa.String(30), nullable=False, server_default="ALL"),
    )
    op.add_column(
        "insurance_commission_splits",
        sa.Column("allocation_basis", sa.String(50), nullable=False, server_default="GROSS_COMMISSION"),
    )
    op.add_column("insurance_commission_splits", sa.Column("effective_to", sa.Date(), nullable=True))
    op.add_column(
        "insurance_commission_splits",
        sa.Column("recipient_type", sa.String(50), nullable=False, server_default="SUB_AGENT"),
    )
    op.add_column(
        "insurance_commission_splits",
        sa.Column("tds_deduction_type", sa.String(50), nullable=False, server_default="DEDUCT_AT_SOURCE"),
    )
    op.add_column(
        "insurance_commission_splits",
        sa.Column("agreement_status", sa.String(30), nullable=False, server_default="ACTIVE"),
    )

    # 3. Add columns to insurance_policy_commissions (Financial Lifecycle & Reconciliation)
    op.add_column("insurance_policy_commissions", sa.Column("policy_category", sa.String(50), nullable=True))
    op.add_column("insurance_policy_commissions", sa.Column("expected_receipt_date", sa.Date(), nullable=True))
    op.add_column(
        "insurance_policy_commissions",
        sa.Column("actual_gross_received", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
    )
    op.add_column(
        "insurance_policy_commissions",
        sa.Column("actual_tds_deducted", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
    )
    op.add_column(
        "insurance_policy_commissions",
        sa.Column("actual_net_received", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
    )
    op.add_column(
        "insurance_policy_commissions",
        sa.Column("reconciliation_difference", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
    )
    op.add_column(
        "insurance_policy_commissions",
        sa.Column("reconciliation_status", sa.String(30), nullable=False, server_default="UNRECONCILED"),
    )
    op.add_column(
        "insurance_policy_commissions",
        sa.Column("recipient_type", sa.String(50), nullable=False, server_default="MAIN_FIRM"),
    )
    op.add_column(
        "insurance_policy_commissions",
        sa.Column("allocation_basis", sa.String(50), nullable=False, server_default="GROSS_COMMISSION"),
    )
    op.add_column(
        "insurance_policy_commissions",
        sa.Column(
            "commission_agreement_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("insurance_company_commission_agreements.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "insurance_policy_commissions",
        sa.Column(
            "split_agreement_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("insurance_commission_splits.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("insurance_policy_commissions", sa.Column("agreement_snapshot", sa.Text(), nullable=True))
    op.add_column(
        "insurance_policy_commissions",
        sa.Column(
            "approved_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("insurance_policy_commissions", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("insurance_policy_commissions", sa.Column("approval_notes", sa.Text(), nullable=True))
    op.add_column(
        "insurance_policy_commissions",
        sa.Column(
            "reversed_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("insurance_policy_commissions", sa.Column("reversed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("insurance_policy_commissions", sa.Column("reversal_reason", sa.Text(), nullable=True))
    op.add_column("insurance_policy_commissions", sa.Column("reversal_amount", sa.Numeric(14, 2), nullable=True))
    op.add_column(
        "insurance_policy_commissions",
        sa.Column(
            "original_commission_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("insurance_policy_commissions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # 4. Create table: insurance_commission_receipts (Bank Receipts & Partial Payments)
    op.create_table(
        "insurance_commission_receipts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "commission_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("insurance_policy_commissions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("receipt_date", sa.Date(), nullable=False),
        sa.Column("gross_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("tds_deducted", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("net_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("payment_mode", sa.String(50), nullable=False, server_default="NEFT"),
        sa.Column("bank_name", sa.String(100), nullable=True),
        sa.Column("transaction_reference", sa.String(100), nullable=True),
        sa.Column("tds_certificate_ref", sa.String(100), nullable=True),
        sa.Column("receipt_type", sa.String(50), nullable=False, server_default="PARTIAL_PAYMENT"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("supporting_document_url", sa.String(500), nullable=True),
        sa.Column(
            "recorded_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_insurance_commission_receipts_commission",
        "insurance_commission_receipts",
        ["commission_id"],
    )
    op.create_index(
        "ix_insurance_commission_receipts_date",
        "insurance_commission_receipts",
        ["receipt_date"],
    )

    # 5. Backfill existing insurance_policy_commissions with policy_category and expected_receipt_date
    op.execute("""
        UPDATE insurance_policy_commissions c
        SET 
            policy_category = COALESCE(p.policy_type, 'HEALTH'),
            expected_receipt_date = COALESCE(p.first_receipt_date, p.policy_start_date)
        FROM insurance_policies p
        WHERE c.policy_id = p.id AND c.policy_category IS NULL;
    """)


def downgrade() -> None:
    op.drop_table("insurance_commission_receipts")

    op.drop_column("insurance_policy_commissions", "original_commission_id")
    op.drop_column("insurance_policy_commissions", "reversal_amount")
    op.drop_column("insurance_policy_commissions", "reversal_reason")
    op.drop_column("insurance_policy_commissions", "reversed_at")
    op.drop_column("insurance_policy_commissions", "reversed_by_id")
    op.drop_column("insurance_policy_commissions", "approval_notes")
    op.drop_column("insurance_policy_commissions", "approved_at")
    op.drop_column("insurance_policy_commissions", "approved_by_id")
    op.drop_column("insurance_policy_commissions", "agreement_snapshot")
    op.drop_column("insurance_policy_commissions", "split_agreement_id")
    op.drop_column("insurance_policy_commissions", "commission_agreement_id")
    op.drop_column("insurance_policy_commissions", "allocation_basis")
    op.drop_column("insurance_policy_commissions", "recipient_type")
    op.drop_column("insurance_policy_commissions", "reconciliation_status")
    op.drop_column("insurance_policy_commissions", "reconciliation_difference")
    op.drop_column("insurance_policy_commissions", "actual_net_received")
    op.drop_column("insurance_policy_commissions", "actual_tds_deducted")
    op.drop_column("insurance_policy_commissions", "actual_gross_received")
    op.drop_column("insurance_policy_commissions", "expected_receipt_date")
    op.drop_column("insurance_policy_commissions", "policy_category")

    op.drop_column("insurance_commission_splits", "agreement_status")
    op.drop_column("insurance_commission_splits", "tds_deduction_type")
    op.drop_column("insurance_commission_splits", "recipient_type")
    op.drop_column("insurance_commission_splits", "effective_to")
    op.drop_column("insurance_commission_splits", "allocation_basis")
    op.drop_column("insurance_commission_splits", "commission_type")
    op.drop_column("insurance_commission_splits", "policy_category")

    op.drop_table("insurance_company_commission_agreements")
