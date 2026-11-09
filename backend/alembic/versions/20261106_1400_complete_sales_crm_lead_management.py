"""Complete insurance broker sales CRM lead management schema additions

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-11-06 14:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

revision = "e8f9a0b1c2d3"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add corporate, address line 2, campaign, referral, policy number and tenant fields to insurance_agent_inquiries
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("lead_type", sa.String(30), server_default="INDIVIDUAL", nullable=False),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("company_name", sa.String(200), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("gstin", sa.String(50), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("address_line_2", sa.String(255), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("campaign_name", sa.String(150), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("referral_name", sa.String(150), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("existing_policy_number", sa.String(100), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("requirement_description", sa.Text(), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("tenant_id", sa.String(100), nullable=True),
    )

    # 2. Add performance search indexes
    op.create_index(
        "ix_insurance_agent_inquiries_mobile",
        "insurance_agent_inquiries",
        ["mobile"],
    )
    op.create_index(
        "ix_insurance_agent_inquiries_email",
        "insurance_agent_inquiries",
        ["email"],
    )
    op.create_index(
        "ix_insurance_agent_inquiries_lead_source",
        "insurance_agent_inquiries",
        ["lead_source"],
    )
    op.create_index(
        "ix_insurance_agent_inquiries_tenant",
        "insurance_agent_inquiries",
        ["tenant_id"],
    )

    # 3. Add follow-up outcome and next follow-up date to reminders
    op.add_column(
        "insurance_lead_reminders",
        sa.Column("outcome", sa.Text(), nullable=True),
    )
    op.add_column(
        "insurance_lead_reminders",
        sa.Column("next_follow_up_date", sa.Date(), nullable=True),
    )

    # 4. Link quotations to leads
    op.add_column(
        "insurance_health_quotations",
        sa.Column("lead_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_health_quotation_lead_inquiry",
        "insurance_health_quotations",
        "insurance_agent_inquiries",
        ["lead_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_health_quote_lead_id",
        "insurance_health_quotations",
        ["lead_id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_health_quotation_lead_inquiry", "insurance_health_quotations", type_="foreignkey")
    op.drop_index("ix_health_quote_lead_id", table_name="insurance_health_quotations")
    op.drop_column("insurance_health_quotations", "lead_id")
    op.drop_column("insurance_lead_reminders", "next_follow_up_date")
    op.drop_column("insurance_lead_reminders", "outcome")
    op.drop_index("ix_insurance_agent_inquiries_tenant", table_name="insurance_agent_inquiries")
    op.drop_index("ix_insurance_agent_inquiries_lead_source", table_name="insurance_agent_inquiries")
    op.drop_index("ix_insurance_agent_inquiries_email", table_name="insurance_agent_inquiries")
    op.drop_index("ix_insurance_agent_inquiries_mobile", table_name="insurance_agent_inquiries")
    op.drop_column("insurance_agent_inquiries", "tenant_id")
    op.drop_column("insurance_agent_inquiries", "requirement_description")
    op.drop_column("insurance_agent_inquiries", "existing_policy_number")
    op.drop_column("insurance_agent_inquiries", "referral_name")
    op.drop_column("insurance_agent_inquiries", "campaign_name")
    op.drop_column("insurance_agent_inquiries", "address_line_2")
    op.drop_column("insurance_agent_inquiries", "gstin")
    op.drop_column("insurance_agent_inquiries", "company_name")
    op.drop_column("insurance_agent_inquiries", "lead_type")
