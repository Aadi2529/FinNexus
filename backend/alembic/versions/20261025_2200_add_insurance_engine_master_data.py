"""add_insurance_engine_master_data

Revision ID: 9f3ada871d38
Revises: 8e2fcff76c27
Create Date: 2026-10-25 22:00:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9f3ada871d38"
down_revision: str | None = "8e2fcff76c27"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create insurance_companies table
    op.create_table(
        "insurance_companies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False, server_default="Composite"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("contact_person", sa.String(length=150), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(
        op.f("ix_insurance_companies_code"),
        "insurance_companies",
        ["code"],
        unique=True,
    )
    op.create_index(
        op.f("ix_insurance_companies_is_active"),
        "insurance_companies",
        ["is_active"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_companies_name_lower",
        "insurance_companies",
        ["name"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_companies_code_lower",
        "insurance_companies",
        ["code"],
        unique=False,
    )

    # 2. Create insurance_plans table
    op.create_table(
        "insurance_plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("line_of_business", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["insurance_companies.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(
        op.f("ix_insurance_plans_code"),
        "insurance_plans",
        ["code"],
        unique=True,
    )
    op.create_index(
        op.f("ix_insurance_plans_company_id"),
        "insurance_plans",
        ["company_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_insurance_plans_status"),
        "insurance_plans",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_plans_name_lower",
        "insurance_plans",
        ["name"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_plans_code_lower",
        "insurance_plans",
        ["code"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_plans_lob",
        "insurance_plans",
        ["line_of_business"],
        unique=False,
    )

    # 3. Create insurance_purchase_parties table
    op.create_table(
        "insurance_purchase_parties",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("contact_person", sa.String(length=150), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(
        op.f("ix_insurance_purchase_parties_code"),
        "insurance_purchase_parties",
        ["code"],
        unique=True,
    )
    op.create_index(
        op.f("ix_insurance_purchase_parties_is_active"),
        "insurance_purchase_parties",
        ["is_active"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_purchase_parties_name_lower",
        "insurance_purchase_parties",
        ["name"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_purchase_parties_code_lower",
        "insurance_purchase_parties",
        ["code"],
        unique=False,
    )


def downgrade() -> None:
    # 3. Drop insurance_purchase_parties
    op.drop_index("ix_insurance_purchase_parties_code_lower", table_name="insurance_purchase_parties")
    op.drop_index("ix_insurance_purchase_parties_name_lower", table_name="insurance_purchase_parties")
    op.drop_index(op.f("ix_insurance_purchase_parties_is_active"), table_name="insurance_purchase_parties")
    op.drop_index(op.f("ix_insurance_purchase_parties_code"), table_name="insurance_purchase_parties")
    op.drop_table("insurance_purchase_parties")

    # 2. Drop insurance_plans
    op.drop_index("ix_insurance_plans_lob", table_name="insurance_plans")
    op.drop_index("ix_insurance_plans_code_lower", table_name="insurance_plans")
    op.drop_index("ix_insurance_plans_name_lower", table_name="insurance_plans")
    op.drop_index(op.f("ix_insurance_plans_status"), table_name="insurance_plans")
    op.drop_index(op.f("ix_insurance_plans_company_id"), table_name="insurance_plans")
    op.drop_index(op.f("ix_insurance_plans_code"), table_name="insurance_plans")
    op.drop_table("insurance_plans")

    # 1. Drop insurance_companies
    op.drop_index("ix_insurance_companies_code_lower", table_name="insurance_companies")
    op.drop_index("ix_insurance_companies_name_lower", table_name="insurance_companies")
    op.drop_index(op.f("ix_insurance_companies_is_active"), table_name="insurance_companies")
    op.drop_index(op.f("ix_insurance_companies_code"), table_name="insurance_companies")
    op.drop_table("insurance_companies")
