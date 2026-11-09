"""Add policy members and coverage type for multi-member and family floater policies.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-11-01 12:00:00.000000
"""

from collections.abc import Sequence
import uuid

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: str | None = "d4e5f6a7b8c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add coverage_type to insurance_policies
    op.add_column(
        "insurance_policies",
        sa.Column(
            "coverage_type",
            sa.String(length=30),
            server_default="INDIVIDUAL",
            nullable=False,
        ),
    )
    op.create_index(
        "ix_insurance_policies_coverage_type",
        "insurance_policies",
        ["coverage_type"],
    )

    # 2. Create insurance_policy_members table
    op.create_table(
        "insurance_policy_members",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("policy_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("relationship", sa.String(length=50), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(length=20), nullable=True),
        sa.Column("mobile_number", sa.String(length=30), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("member_code", sa.String(length=50), nullable=True),
        sa.Column("individual_sum_insured", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["policy_id"],
            ["insurance_policies.id"],
            name="fk_insurance_policy_members_policy_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name="fk_insurance_policy_members_customer_id",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_insurance_policy_members_policy_id",
        "insurance_policy_members",
        ["policy_id"],
    )
    op.create_index(
        "ix_insurance_policy_members_customer_id",
        "insurance_policy_members",
        ["customer_id"],
    )

    # 3. Safe backfill: For existing policies, backfill the customer as the primary self insured member
    conn = op.get_bind()
    conn.execute(sa.text("""
        INSERT INTO insurance_policy_members (
            id,
            policy_id,
            customer_id,
            full_name,
            relationship,
            date_of_birth,
            gender,
            mobile_number,
            email,
            individual_sum_insured,
            created_at,
            updated_at
        )
        SELECT 
            gen_random_uuid(),
            p.id,
            c.id,
            COALESCE(NULLIF(TRIM(CONCAT(c.first_name, ' ', c.last_name)), ''), c.company_name, 'Policyholder'),
            'SELF',
            c.date_of_birth,
            COALESCE(c.gender, 'OTHER'),
            c.phone,
            c.email,
            p.sum_assured,
            now(),
            now()
        FROM insurance_policies p
        JOIN customers c ON p.customer_id = c.id
        WHERE NOT EXISTS (
            SELECT 1 FROM insurance_policy_members m WHERE m.policy_id = p.id
        );
    """))


def downgrade() -> None:
    op.drop_index("ix_insurance_policy_members_customer_id", table_name="insurance_policy_members")
    op.drop_index("ix_insurance_policy_members_policy_id", table_name="insurance_policy_members")
    op.drop_table("insurance_policy_members")
    op.drop_index("ix_insurance_policies_coverage_type", table_name="insurance_policies")
    op.drop_column("insurance_policies", "coverage_type")
