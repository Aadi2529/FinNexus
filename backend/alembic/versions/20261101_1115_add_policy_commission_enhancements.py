"""Add policy commission enhancements, company categories, and net premium fields.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-11-01 11:15:00.000000
"""

from collections.abc import Sequence
import uuid

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: str | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create insurance_company_categories table for normalized multi-category mapping
    op.create_table(
        "insurance_company_categories",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["insurance_companies.id"],
            name="fk_insurance_company_categories_company_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_insurance_company_categories"),
        sa.UniqueConstraint("company_id", "category", name="uq_insurance_company_categories_company_cat"),
    )
    op.create_index(
        "ix_insurance_company_categories_company",
        "insurance_company_categories",
        ["company_id"],
    )
    op.create_index(
        "ix_insurance_company_categories_cat",
        "insurance_company_categories",
        ["category"],
    )

    # 2. Add net_premium and tax_amount to insurance_policies
    op.add_column("insurance_policies", sa.Column("net_premium", sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column("insurance_policies", sa.Column("tax_amount", sa.Numeric(precision=14, scale=2), nullable=True))

    # Safe backfill for existing policies: net_premium = final_premium, tax_amount = 0.00
    op.execute(
        "UPDATE insurance_policies SET net_premium = final_premium, tax_amount = 0.00 WHERE net_premium IS NULL"
    )

    # 3. Add commission enhancement columns to insurance_policy_commissions
    op.add_column("insurance_policy_commissions", sa.Column("net_premium_applied", sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column("insurance_policy_commissions", sa.Column("tds_rate", sa.Numeric(precision=5, scale=2), server_default="10.00", nullable=True))
    op.add_column("insurance_policy_commissions", sa.Column("tds_amount", sa.Numeric(precision=14, scale=2), server_default="0.00", nullable=True))
    op.add_column("insurance_policy_commissions", sa.Column("net_commission_payable", sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column("insurance_policy_commissions", sa.Column("sub_agent_tds_rate", sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column("insurance_policy_commissions", sa.Column("sub_agent_tds_amount", sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column("insurance_policy_commissions", sa.Column("sub_agent_net_payout", sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column("insurance_policy_commissions", sa.Column("firm_tds_amount", sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column("insurance_policy_commissions", sa.Column("firm_net_bank_credit", sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column("insurance_policy_commissions", sa.Column("calculation_source", sa.String(length=50), server_default="RULE_AGREEMENT", nullable=True))
    op.add_column("insurance_policy_commissions", sa.Column("override_reason", sa.String(length=255), nullable=True))
    op.add_column("insurance_policy_commissions", sa.Column("bank_reference", sa.String(length=100), nullable=True))

    # Safe backfill for existing commission rows
    op.execute(
        """
        UPDATE insurance_policy_commissions
        SET
            net_commission_payable = COALESCE(firm_net_amount, gross_commission_amount),
            firm_net_bank_credit = COALESCE(firm_net_amount, gross_commission_amount),
            tds_rate = 10.00,
            tds_amount = ROUND(gross_commission_amount * 0.10, 2),
            calculation_source = 'RULE_AGREEMENT'
        WHERE net_commission_payable IS NULL
        """
    )

    # 4. Populate default company categories based on existing companies & plans
    op.execute(
        """
        INSERT INTO insurance_company_categories (id, company_id, category, created_at)
        SELECT gen_random_uuid(), c.id, 'LIFE', NOW()
        FROM insurance_companies c
        WHERE UPPER(c.category) LIKE '%LIFE%'
        ON CONFLICT DO NOTHING;
        """
    )
    op.execute(
        """
        INSERT INTO insurance_company_categories (id, company_id, category, created_at)
        SELECT gen_random_uuid(), c.id, 'HEALTH', NOW()
        FROM insurance_companies c
        WHERE UPPER(c.category) LIKE '%HEALTH%' OR UPPER(c.category) LIKE '%GENERAL%' OR UPPER(c.category) LIKE '%COMPOSITE%'
        ON CONFLICT DO NOTHING;
        """
    )
    op.execute(
        """
        INSERT INTO insurance_company_categories (id, company_id, category, created_at)
        SELECT gen_random_uuid(), c.id, 'MOTOR', NOW()
        FROM insurance_companies c
        WHERE UPPER(c.category) LIKE '%MOTOR%' OR UPPER(c.category) LIKE '%GENERAL%' OR UPPER(c.category) LIKE '%COMPOSITE%'
        ON CONFLICT DO NOTHING;
        """
    )
    op.execute(
        """
        INSERT INTO insurance_company_categories (id, company_id, category, created_at)
        SELECT gen_random_uuid(), c.id, 'TRAVEL', NOW()
        FROM insurance_companies c
        WHERE UPPER(c.category) LIKE '%HEALTH%' OR UPPER(c.category) LIKE '%GENERAL%' OR UPPER(c.category) LIKE '%COMPOSITE%'
        ON CONFLICT DO NOTHING;
        """
    )
    # Also add categories based on plans linked to companies
    op.execute(
        """
        INSERT INTO insurance_company_categories (id, company_id, category, created_at)
        SELECT DISTINCT gen_random_uuid(), p.company_id,
            CASE
                WHEN UPPER(p.line_of_business) LIKE '%HEALTH%' THEN 'HEALTH'
                WHEN UPPER(p.line_of_business) LIKE '%LIFE%' THEN 'LIFE'
                WHEN UPPER(p.line_of_business) LIKE '%MOTOR%' OR UPPER(p.line_of_business) LIKE '%GENERAL%' THEN 'MOTOR'
                WHEN UPPER(p.line_of_business) LIKE '%TRAVEL%' THEN 'TRAVEL'
                ELSE 'OTHER'
            END,
            NOW()
        FROM insurance_plans p
        WHERE p.status = 'ACTIVE'
        ON CONFLICT DO NOTHING;
        """
    )


def downgrade() -> None:
    # Drop added columns from insurance_policy_commissions
    op.drop_column("insurance_policy_commissions", "bank_reference")
    op.drop_column("insurance_policy_commissions", "override_reason")
    op.drop_column("insurance_policy_commissions", "calculation_source")
    op.drop_column("insurance_policy_commissions", "firm_net_bank_credit")
    op.drop_column("insurance_policy_commissions", "firm_tds_amount")
    op.drop_column("insurance_policy_commissions", "sub_agent_net_payout")
    op.drop_column("insurance_policy_commissions", "sub_agent_tds_amount")
    op.drop_column("insurance_policy_commissions", "sub_agent_tds_rate")
    op.drop_column("insurance_policy_commissions", "net_commission_payable")
    op.drop_column("insurance_policy_commissions", "tds_amount")
    op.drop_column("insurance_policy_commissions", "tds_rate")
    op.drop_column("insurance_policy_commissions", "net_premium_applied")

    # Drop added columns from insurance_policies
    op.drop_column("insurance_policies", "tax_amount")
    op.drop_column("insurance_policies", "net_premium")

    # Drop insurance_company_categories table
    op.drop_table("insurance_company_categories")
