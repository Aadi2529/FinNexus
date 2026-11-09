"""Enhance lead management with kanban fields, notes, reminders, and activities

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
Create Date: 2026-11-06 13:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d7e8f9a0b1c2"
down_revision = "c6d7e8f9a0b1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Make sub_agent_id nullable in insurance_agent_inquiries
    op.alter_column(
        "insurance_agent_inquiries",
        "sub_agent_id",
        existing_type=sa.Uuid(),
        nullable=True,
    )

    # 2. Add lead_number and unique index
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("lead_number", sa.String(50), nullable=True),
    )
    op.create_index(
        "ix_insurance_agent_inquiries_lead_number",
        "insurance_agent_inquiries",
        ["lead_number"],
        unique=True,
    )

    # 3. Add priority and lead_source
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("priority", sa.String(20), server_default="NORMAL", nullable=False),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("lead_source", sa.String(50), server_default="PUBLIC_PROFILE", nullable=False),
    )

    # 4. Add assigned_user_id
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("assigned_user_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_insurance_agent_inquiries_assigned_user",
        "insurance_agent_inquiries",
        "users",
        ["assigned_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_insurance_agent_inquiries_assigned_user",
        "insurance_agent_inquiries",
        ["assigned_user_id"],
    )

    # 5. Add personal and contact fields
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("alternate_mobile", sa.String(20), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("date_of_birth", sa.Date(), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("gender", sa.String(20), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("occupation", sa.String(100), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("city", sa.String(100), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("state", sa.String(100), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("pincode", sa.String(20), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("address", sa.Text(), nullable=True),
    )

    # 6. Add preference fields
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("preferred_company_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_insurance_agent_inquiries_preferred_company",
        "insurance_agent_inquiries",
        "insurance_companies",
        ["preferred_company_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("preferred_plan_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_insurance_agent_inquiries_preferred_plan",
        "insurance_agent_inquiries",
        "insurance_plans",
        ["preferred_plan_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("sum_insured", sa.Numeric(14, 2), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("expected_premium", sa.Numeric(14, 2), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("coverage_type", sa.String(50), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("member_count", sa.Integer(), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("existing_insurance", sa.Text(), nullable=True),
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("existing_policy_expiry", sa.Date(), nullable=True),
    )

    # 7. Add follow-up, conversion & lost fields
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("next_follow_up_date", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_insurance_agent_inquiries_follow_up",
        "insurance_agent_inquiries",
        ["next_follow_up_date"],
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("customer_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_insurance_agent_inquiries_customer",
        "insurance_agent_inquiries",
        "customers",
        ["customer_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("converted_policy_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_insurance_agent_inquiries_policy",
        "insurance_agent_inquiries",
        "insurance_policies",
        ["converted_policy_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "insurance_agent_inquiries",
        sa.Column("lost_reason", sa.Text(), nullable=True),
    )

    # 8. Create insurance_lead_notes table
    op.create_table(
        "insurance_lead_notes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("insurance_agent_inquiries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("author_name", sa.String(150), nullable=False),
        sa.Column("title", sa.String(200), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("note_type", sa.String(50), server_default="GENERAL", nullable=False),
        sa.Column("visibility", sa.String(50), server_default="INTERNAL", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_insurance_lead_notes_lead_id", "insurance_lead_notes", ["lead_id"])
    op.create_index("ix_insurance_lead_notes_created_at", "insurance_lead_notes", ["created_at"])

    # 9. Create insurance_lead_reminders table
    op.create_table(
        "insurance_lead_reminders",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("insurance_agent_inquiries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_to_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_to_name", sa.String(150), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("reminder_date", sa.Date(), nullable=False),
        sa.Column("reminder_time", sa.String(20), nullable=True),
        sa.Column("reminder_type", sa.String(50), server_default="CALL_CUSTOMER", nullable=False),
        sa.Column("priority", sa.String(20), server_default="NORMAL", nullable=False),
        sa.Column("status", sa.String(20), server_default="PENDING", nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completion_remarks", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_insurance_lead_reminders_lead_id", "insurance_lead_reminders", ["lead_id"])
    op.create_index("ix_insurance_lead_reminders_date", "insurance_lead_reminders", ["reminder_date"])
    op.create_index("ix_insurance_lead_reminders_status", "insurance_lead_reminders", ["status"])

    # 10. Create insurance_lead_activities table
    op.create_table(
        "insurance_lead_activities",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("insurance_agent_inquiries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_name", sa.String(150), nullable=True),
        sa.Column("activity_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("old_value", sa.String(255), nullable=True),
        sa.Column("new_value", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_insurance_lead_activities_lead_id", "insurance_lead_activities", ["lead_id"])
    op.create_index("ix_insurance_lead_activities_created_at", "insurance_lead_activities", ["created_at"])

    # Backfill lead_number for existing records
    op.execute(
        """
        UPDATE insurance_agent_inquiries
        SET lead_number = 'LEAD-2026-' || LPAD(SUBSTRING(id::text, 1, 6), 6, '0')
        WHERE lead_number IS NULL
        """
    )


def downgrade() -> None:
    op.drop_table("insurance_lead_activities")
    op.drop_table("insurance_lead_reminders")
    op.drop_table("insurance_lead_notes")
    op.drop_column("insurance_agent_inquiries", "lost_reason")
    op.drop_column("insurance_agent_inquiries", "converted_policy_id")
    op.drop_column("insurance_agent_inquiries", "customer_id")
    op.drop_column("insurance_agent_inquiries", "next_follow_up_date")
    op.drop_column("insurance_agent_inquiries", "existing_policy_expiry")
    op.drop_column("insurance_agent_inquiries", "existing_insurance")
    op.drop_column("insurance_agent_inquiries", "member_count")
    op.drop_column("insurance_agent_inquiries", "coverage_type")
    op.drop_column("insurance_agent_inquiries", "expected_premium")
    op.drop_column("insurance_agent_inquiries", "sum_insured")
    op.drop_column("insurance_agent_inquiries", "preferred_plan_id")
    op.drop_column("insurance_agent_inquiries", "preferred_company_id")
    op.drop_column("insurance_agent_inquiries", "address")
    op.drop_column("insurance_agent_inquiries", "pincode")
    op.drop_column("insurance_agent_inquiries", "state")
    op.drop_column("insurance_agent_inquiries", "city")
    op.drop_column("insurance_agent_inquiries", "occupation")
    op.drop_column("insurance_agent_inquiries", "gender")
    op.drop_column("insurance_agent_inquiries", "date_of_birth")
    op.drop_column("insurance_agent_inquiries", "alternate_mobile")
    op.drop_column("insurance_agent_inquiries", "assigned_user_id")
    op.drop_column("insurance_agent_inquiries", "lead_source")
    op.drop_column("insurance_agent_inquiries", "priority")
    op.drop_column("insurance_agent_inquiries", "lead_number")
