"""Restructure commission and subagent payouts into separate financial workflows

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-11-05 14:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "c6d7e8f9a0b1"
down_revision = "b5c6d7e8f9a0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add new columns to insurance_policy_commissions (Insurer Commission Receivable)
    op.add_column(
        "insurance_policy_commissions",
        sa.Column("actual_commission_rate", sa.Numeric(6, 2), nullable=True),
    )
    op.add_column(
        "insurance_policy_commissions",
        sa.Column("actual_tds_rate", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "insurance_policy_commissions",
        sa.Column("bank_account", sa.String(100), nullable=True),
    )
    op.add_column(
        "insurance_policy_commissions",
        sa.Column("balance_receivable", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
    )

    # 2. Add columns to insurance_commission_receipts
    op.add_column(
        "insurance_commission_receipts",
        sa.Column("actual_commission_rate", sa.Numeric(6, 2), nullable=True),
    )
    op.add_column(
        "insurance_commission_receipts",
        sa.Column("actual_tds_rate", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "insurance_commission_receipts",
        sa.Column("bank_account", sa.String(100), nullable=True),
    )

    # 3. Create table insurance_sub_agent_payouts
    op.create_table(
        "insurance_sub_agent_payouts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "policy_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("insurance_policies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "commission_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("insurance_policy_commissions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "sub_agent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("insurance_sub_agents.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("commission_type", sa.String(30), nullable=False, server_default="FIRST_YEAR"),
        sa.Column("insurer_gross_commission", sa.Numeric(14, 2), nullable=False),
        sa.Column("agreed_percentage", sa.Numeric(6, 2), nullable=True),
        sa.Column("payable_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("tds_rate", sa.Numeric(5, 2), nullable=True, server_default="5.00"),
        sa.Column("tds_amount", sa.Numeric(14, 2), nullable=True, server_default="0.00"),
        sa.Column("net_payable_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("amount_paid", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("remaining_payable", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("status", sa.String(30), nullable=False, server_default="PENDING"),
        sa.Column("payout_date", sa.Date(), nullable=True),
        sa.Column("split_rule_applied", sa.String(150), nullable=True),
        sa.Column("split_agreement_snapshot", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("on_hold_reason", sa.Text(), nullable=True),
        sa.Column(
            "approved_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approval_notes", sa.Text(), nullable=True),
        sa.Column(
            "reversed_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reversed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reversal_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_index(
        "ix_insurance_sub_agent_payouts_policy",
        "insurance_sub_agent_payouts",
        ["policy_id"],
    )
    op.create_index(
        "ix_insurance_sub_agent_payouts_commission",
        "insurance_sub_agent_payouts",
        ["commission_id"],
    )
    op.create_index(
        "ix_insurance_sub_agent_payouts_agent",
        "insurance_sub_agent_payouts",
        ["sub_agent_id"],
    )
    op.create_index(
        "ix_insurance_sub_agent_payouts_status",
        "insurance_sub_agent_payouts",
        ["status"],
    )

    # 4. Create table insurance_sub_agent_payout_payments
    op.create_table(
        "insurance_sub_agent_payout_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "payout_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("insurance_sub_agent_payouts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("tds_deducted", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("net_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("payment_method", sa.String(50), nullable=False, server_default="BANK_TRANSFER"),
        sa.Column("bank_account_details", sa.String(150), nullable=True),
        sa.Column("transaction_reference", sa.String(100), nullable=True),
        sa.Column("payment_proof_url", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
        "ix_insurance_sub_agent_payout_payments_payout",
        "insurance_sub_agent_payout_payments",
        ["payout_id"],
    )
    op.create_index(
        "ix_insurance_sub_agent_payout_payments_date",
        "insurance_sub_agent_payout_payments",
        ["payment_date"],
    )

    # 5. Backfill balance_receivable for existing commission records
    op.execute(
        """
        UPDATE insurance_policy_commissions
        SET balance_receivable = GREATEST(
            0.00,
            COALESCE(net_commission_payable, gross_commission_amount - COALESCE(tds_amount, 0.00)) - COALESCE(actual_net_received, 0.00)
        )
        """
    )

    # 6. Backfill existing sub-agent payouts from commissions where sub_agent_id is present and sub_agent_amount > 0
    op.execute(
        """
        INSERT INTO insurance_sub_agent_payouts (
            id,
            policy_id,
            commission_id,
            sub_agent_id,
            commission_type,
            insurer_gross_commission,
            agreed_percentage,
            payable_amount,
            tds_rate,
            tds_amount,
            net_payable_amount,
            amount_paid,
            remaining_payable,
            status,
            split_rule_applied,
            split_agreement_snapshot,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid(),
            c.policy_id,
            c.id,
            c.sub_agent_id,
            c.commission_type,
            c.gross_commission_amount,
            CASE
                WHEN c.gross_commission_amount > 0 THEN ROUND((c.sub_agent_amount / c.gross_commission_amount) * 100.0, 2)
                ELSE 0.00
            END,
            c.sub_agent_amount,
            COALESCE(c.sub_agent_tds_rate, 5.00),
            COALESCE(c.sub_agent_tds_amount, 0.00),
            COALESCE(c.sub_agent_net_payout, c.sub_agent_amount - COALESCE(c.sub_agent_tds_amount, 0.00)),
            0.00,
            COALESCE(c.sub_agent_net_payout, c.sub_agent_amount - COALESCE(c.sub_agent_tds_amount, 0.00)),
            CASE
                WHEN c.status = 'REVERSED' THEN 'REVERSED'
                ELSE 'PENDING'
            END,
            c.split_rule_applied,
            c.agreement_snapshot,
            c.created_at,
            c.updated_at
        FROM insurance_policy_commissions c
        WHERE c.sub_agent_id IS NOT NULL
          AND c.sub_agent_amount > 0
        """
    )


def downgrade() -> None:
    op.drop_table("insurance_sub_agent_payout_payments")
    op.drop_table("insurance_sub_agent_payouts")
    op.drop_column("insurance_commission_receipts", "bank_account")
    op.drop_column("insurance_commission_receipts", "actual_tds_rate")
    op.drop_column("insurance_commission_receipts", "actual_commission_rate")
    op.drop_column("insurance_policy_commissions", "balance_receivable")
    op.drop_column("insurance_policy_commissions", "bank_account")
    op.drop_column("insurance_policy_commissions", "actual_tds_rate")
    op.drop_column("insurance_policy_commissions", "actual_commission_rate")
