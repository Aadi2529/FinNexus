"""add_insurance_engine_phase2_tables

Revision ID: e4c8b1a72d3f
Revises: 9f3ada871d38
Create Date: 2026-10-30 19:30:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4c8b1a72d3f"
down_revision: str | None = "9f3ada871d38"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Enhance customers table for insurance customer onboarding
    op.add_column("customers", sa.Column("gender", sa.String(length=20), nullable=True))
    op.add_column("customers", sa.Column("date_of_birth", sa.Date(), nullable=True))
    op.add_column("customers", sa.Column("anniversary_date", sa.Date(), nullable=True))
    op.add_column("customers", sa.Column("state", sa.String(length=100), nullable=True))
    op.add_column("customers", sa.Column("city", sa.String(length=100), nullable=True))
    op.add_column("customers", sa.Column("address", sa.Text(), nullable=True))
    op.add_column("customers", sa.Column("pincode", sa.String(length=20), nullable=True))
    op.add_column(
        "customers",
        sa.Column("customer_type", sa.String(length=50), nullable=True, server_default="INDIVIDUAL"),
    )
    op.alter_column("customers", "email", existing_type=sa.String(length=255), nullable=True)
    op.alter_column("customers", "pan_number", existing_type=sa.String(length=10), nullable=True)

    # 2. Create insurance_sub_agents table
    op.create_table(
        "insurance_sub_agents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("agent_code", sa.String(length=50), nullable=False),
        sa.Column("mobile", sa.String(length=20), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("joining_date", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("parent_firm", sa.String(length=150), nullable=False, server_default="FinNexus Enterprise"),
        sa.Column("parent_agent_id", sa.Uuid(), nullable=True),
        sa.Column("public_profile_slug", sa.String(length=100), nullable=False),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("specialties", sa.Text(), nullable=True),
        sa.Column("show_contact_info", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["parent_agent_id"],
            ["insurance_sub_agents.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("agent_code"),
        sa.UniqueConstraint("public_profile_slug"),
    )
    op.create_index(
        "ix_insurance_sub_agents_name_lower",
        "insurance_sub_agents",
        ["full_name"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_sub_agents_code_lower",
        "insurance_sub_agents",
        ["agent_code"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_sub_agents_slug",
        "insurance_sub_agents",
        ["public_profile_slug"],
        unique=False,
    )

    # 3. Create insurance_commission_splits table
    op.create_table(
        "insurance_commission_splits",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("sub_agent_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=True),
        sa.Column("plan_id", sa.Uuid(), nullable=True),
        sa.Column("split_type", sa.String(length=20), nullable=False, server_default="PERCENTAGE"),
        sa.Column("split_value", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["sub_agent_id"],
            ["insurance_sub_agents.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["insurance_companies.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["plan_id"],
            ["insurance_plans.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_insurance_commission_splits_agent",
        "insurance_commission_splits",
        ["sub_agent_id"],
        unique=False,
    )

    # 4. Create insurance_family_groups table
    op.create_table(
        "insurance_family_groups",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("head_customer_id", sa.Uuid(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["head_customer_id"],
            ["customers.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 5. Create insurance_family_members table
    op.create_table(
        "insurance_family_members",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("family_group_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("relationship", sa.String(length=50), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["family_group_id"],
            ["insurance_family_groups.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("customer_id"),
    )
    op.create_index(
        "ix_insurance_family_members_cust",
        "insurance_family_members",
        ["customer_id"],
        unique=True,
    )
    op.create_index(
        "ix_insurance_family_members_group",
        "insurance_family_members",
        ["family_group_id"],
        unique=False,
    )

    # 6. Create insurance_policies table
    op.create_table(
        "insurance_policies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("policy_number", sa.String(length=100), nullable=False),
        sa.Column("policy_type", sa.String(length=50), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("purchase_party_id", sa.Uuid(), nullable=True),
        sa.Column("sub_agent_id", sa.Uuid(), nullable=True),
        sa.Column("term_years", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("sum_assured", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("final_premium", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("is_single_premium", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("premium_mode", sa.String(length=30), nullable=False, server_default="Yearly"),
        sa.Column("policy_start_date", sa.Date(), nullable=False),
        sa.Column("first_receipt_date", sa.Date(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=False),
        sa.Column("next_premium_due_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="ACTIVE"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["insurance_companies.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["plan_id"],
            ["insurance_plans.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["purchase_party_id"],
            ["insurance_purchase_parties.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["sub_agent_id"],
            ["insurance_sub_agents.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("policy_number"),
    )
    op.create_index(
        "ix_insurance_policies_number",
        "insurance_policies",
        ["policy_number"],
        unique=True,
    )
    op.create_index(
        "ix_insurance_policies_status",
        "insurance_policies",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_policies_customer",
        "insurance_policies",
        ["customer_id"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_policies_company",
        "insurance_policies",
        ["company_id"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_policies_plan",
        "insurance_policies",
        ["plan_id"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_policies_expiry",
        "insurance_policies",
        ["expiry_date"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_policies_next_due",
        "insurance_policies",
        ["next_premium_due_date"],
        unique=False,
    )

    # 7. Create insurance_premium_schedules table
    op.create_table(
        "insurance_premium_schedules",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("policy_id", sa.Uuid(), nullable=False),
        sa.Column("installment_number", sa.Integer(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="UPCOMING"),
        sa.Column("paid_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["policy_id"],
            ["insurance_policies.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_insurance_premium_schedules_policy",
        "insurance_premium_schedules",
        ["policy_id"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_premium_schedules_due",
        "insurance_premium_schedules",
        ["due_date"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_premium_schedules_status",
        "insurance_premium_schedules",
        ["status"],
        unique=False,
    )

    # 8. Create insurance_policy_payments table
    op.create_table(
        "insurance_policy_payments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("policy_id", sa.Uuid(), nullable=False),
        sa.Column("premium_schedule_id", sa.Uuid(), nullable=True),
        sa.Column("payment_mode", sa.String(length=50), nullable=False),
        sa.Column("bank_name", sa.String(length=100), nullable=True),
        sa.Column("transaction_reference", sa.String(length=100), nullable=True),
        sa.Column("first_receipt_date", sa.Date(), nullable=True),
        sa.Column("payment_date", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="COMPLETED"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["policy_id"],
            ["insurance_policies.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["premium_schedule_id"],
            ["insurance_premium_schedules.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_insurance_policy_payments_policy",
        "insurance_policy_payments",
        ["policy_id"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_policy_payments_date",
        "insurance_policy_payments",
        ["payment_date"],
        unique=False,
    )

    # 9. Create insurance_policy_commissions table
    op.create_table(
        "insurance_policy_commissions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("policy_id", sa.Uuid(), nullable=False),
        sa.Column("sub_agent_id", sa.Uuid(), nullable=True),
        sa.Column("commission_type", sa.String(length=30), nullable=False, server_default="FIRST_YEAR"),
        sa.Column("gross_commission_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("gross_commission_rate", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("sub_agent_amount", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0.00"),
        sa.Column("firm_net_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("split_rule_applied", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="PENDING"),
        sa.Column("payment_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["policy_id"],
            ["insurance_policies.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sub_agent_id"],
            ["insurance_sub_agents.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_insurance_policy_commissions_policy",
        "insurance_policy_commissions",
        ["policy_id"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_policy_commissions_agent",
        "insurance_policy_commissions",
        ["sub_agent_id"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_policy_commissions_status",
        "insurance_policy_commissions",
        ["status"],
        unique=False,
    )

    # 10. Create insurance_agent_inquiries table
    op.create_table(
        "insurance_agent_inquiries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("sub_agent_id", sa.Uuid(), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("mobile", sa.String(length=20), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("policy_type", sa.String(length=50), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("consent", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="NEW"),
        sa.Column("ip_address", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["sub_agent_id"],
            ["insurance_sub_agents.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_insurance_agent_inquiries_agent",
        "insurance_agent_inquiries",
        ["sub_agent_id"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_agent_inquiries_status",
        "insurance_agent_inquiries",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("insurance_agent_inquiries")
    op.drop_table("insurance_policy_commissions")
    op.drop_table("insurance_policy_payments")
    op.drop_table("insurance_premium_schedules")
    op.drop_table("insurance_policies")
    op.drop_table("insurance_family_members")
    op.drop_table("insurance_family_groups")
    op.drop_table("insurance_commission_splits")
    op.drop_table("insurance_sub_agents")

    op.alter_column("customers", "pan_number", existing_type=sa.String(length=10), nullable=False)
    op.alter_column("customers", "email", existing_type=sa.String(length=255), nullable=False)
    op.drop_column("customers", "customer_type")
    op.drop_column("customers", "pincode")
    op.drop_column("customers", "address")
    op.drop_column("customers", "city")
    op.drop_column("customers", "state")
    op.drop_column("customers", "anniversary_date")
    op.drop_column("customers", "date_of_birth")
    op.drop_column("customers", "gender")

