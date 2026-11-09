"""Multi-category insurer and policy plan architecture.

Revision ID: abded99aea93
Revises: c1d2e3f4a5b6
Create Date: 2026-11-06 22:00:00.000000

"""

import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "abded99aea93"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create insurance_categories master table
    op.create_table(
        "insurance_categories",
        sa.Column("id", sa.Uuid(), nullable=False, default=uuid.uuid4),
        sa.Column("category_code", sa.String(50), nullable=False),
        sa.Column("category_name", sa.String(100), nullable=False),
        sa.Column("parent_category_id", sa.Uuid(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["parent_category_id"], ["insurance_categories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("category_code", name="uq_insurance_categories_code"),
    )
    op.create_index("ix_insurance_categories_code", "insurance_categories", ["category_code"])
    op.create_index("ix_insurance_categories_parent", "insurance_categories", ["parent_category_id"])

    # 2. Add company_type to insurance_companies
    op.add_column(
        "insurance_companies",
        sa.Column("company_type", sa.String(50), nullable=True, server_default="General Insurance"),
    )

    # 3. Add is_active to insurance_company_categories
    op.add_column(
        "insurance_company_categories",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index(
        "ix_insurance_company_categories_active",
        "insurance_company_categories",
        ["company_id", "is_active"],
    )

    # 4. Add extended category-specific columns to insurance_plans
    op.add_column("insurance_plans", sa.Column("plan_subcategory", sa.String(100), nullable=True))
    op.add_column("insurance_plans", sa.Column("motor_plan_type", sa.String(50), nullable=True))
    op.add_column("insurance_plans", sa.Column("sum_insured_min", sa.Numeric(14, 2), nullable=True))
    op.add_column("insurance_plans", sa.Column("sum_insured_max", sa.Numeric(14, 2), nullable=True))
    op.add_column("insurance_plans", sa.Column("policy_term_min_years", sa.Integer(), nullable=True))
    op.add_column("insurance_plans", sa.Column("policy_term_max_years", sa.Integer(), nullable=True))
    op.add_column("insurance_plans", sa.Column("waiting_period_months", sa.Integer(), nullable=True))
    op.add_column("insurance_plans", sa.Column("eligibility_criteria", sa.Text(), nullable=True))

    # 5. Seed Canonical Categories into insurance_categories
    conn = op.get_bind()

    root_categories = [
        ("MOTOR", "Motor Insurance", "Car", 1),
        ("HEALTH", "Health Insurance", "HeartPulse", 2),
        ("LIFE", "Life Insurance", "Shield", 3),
        ("TRAVEL", "Travel Insurance", "Plane", 4),
        ("PROPERTY", "Property & Home Insurance", "Home", 5),
        ("COMMERCIAL", "Commercial / Business Insurance", "Building2", 6),
        ("OTHER", "Other General Insurance", "FileText", 7),
    ]

    root_ids: dict[str, uuid.UUID] = {}
    for code, name, icon, order in root_categories:
        cat_id = uuid.uuid4()
        root_ids[code] = cat_id
        conn.execute(
            sa.text(
                """
                INSERT INTO insurance_categories (id, category_code, category_name, parent_category_id, is_active, icon, display_order, created_at)
                VALUES (:id, :code, :name, NULL, true, :icon, :order, NOW())
                ON CONFLICT (category_code) DO NOTHING
                """
            ),
            {"id": cat_id, "code": code, "name": name, "icon": icon, "order": order},
        )

    # Subcategories
    subcategories = [
        # Life
        ("LIFE_TERM", "Term Life Insurance", "LIFE"),
        ("LIFE_WHOLE", "Whole Life Insurance", "LIFE"),
        ("LIFE_ENDOW", "Endowment / Savings", "LIFE"),
        ("LIFE_ULIP", "ULIP", "LIFE"),
        ("LIFE_MONEYBACK", "Money-Back Policy", "LIFE"),
        ("LIFE_PENSION", "Retirement & Pension", "LIFE"),
        ("LIFE_CHILD", "Child Career Plan", "LIFE"),
        ("LIFE_GROUP", "Group Life Insurance", "LIFE"),
        # Health
        ("HEALTH_INDIV", "Individual Health Insurance", "HEALTH"),
        ("HEALTH_FLOATER", "Family Floater Health Insurance", "HEALTH"),
        ("HEALTH_SENIOR", "Senior Citizen Health Insurance", "HEALTH"),
        ("HEALTH_CRITICAL", "Critical Illness Insurance", "HEALTH"),
        ("HEALTH_SUPER_TOPUP", "Super Top-Up Insurance", "HEALTH"),
        ("HEALTH_GROUP", "Group Health Insurance", "HEALTH"),
        ("HEALTH_PA", "Personal Accident Insurance", "HEALTH"),
        # Motor
        ("MOTOR_CAR", "Car Insurance", "MOTOR"),
        ("MOTOR_2W", "Two-Wheeler Insurance", "MOTOR"),
        ("MOTOR_COMMERCIAL", "Commercial Vehicle Insurance", "MOTOR"),
        # Travel
        ("TRAVEL_INTL", "International Travel", "TRAVEL"),
        ("TRAVEL_DOM", "Domestic Travel", "TRAVEL"),
        ("TRAVEL_STUDENT", "Student Travel", "TRAVEL"),
        ("TRAVEL_CORP", "Corporate Travel", "TRAVEL"),
        # Property
        ("PROP_STRUCTURE", "Home Structure", "PROPERTY"),
        ("PROP_CONTENTS", "Home Contents", "PROPERTY"),
        ("PROP_RENTERS", "Renters Insurance", "PROPERTY"),
        # Commercial
        ("COMM_SHOP", "Shopkeeper Insurance", "COMMERCIAL"),
        ("COMM_MARINE", "Marine / Cargo", "COMMERCIAL"),
        ("COMM_FIRE", "Fire & Special Perils", "COMMERCIAL"),
        ("COMM_LIABILITY", "Liability Insurance", "COMMERCIAL"),
        ("COMM_PI", "Professional Indemnity", "COMMERCIAL"),
        ("COMM_WORKERS", "Workers' Compensation", "COMMERCIAL"),
    ]

    for sub_code, sub_name, parent_code in subcategories:
        parent_id = root_ids.get(parent_code)
        if parent_id:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO insurance_categories (id, category_code, category_name, parent_category_id, is_active, icon, display_order, created_at)
                    VALUES (:id, :code, :name, :pid, true, NULL, 0, NOW())
                    ON CONFLICT (category_code) DO NOTHING
                    """
                ),
                {"id": uuid.uuid4(), "code": sub_code, "name": sub_name, "pid": parent_id},
            )

    # 6. Backfill existing companies company_type based on category
    op.execute(
        """
        UPDATE insurance_companies
        SET company_type = 'Life Insurance'
        WHERE category ILIKE '%life%' AND (company_type IS NULL OR company_type = 'General Insurance');
        """
    )
    op.execute(
        """
        UPDATE insurance_companies
        SET company_type = 'Composite Insurance'
        WHERE category ILIKE '%composite%' AND (company_type IS NULL OR company_type = 'General Insurance');
        """
    )
    op.execute(
        """
        UPDATE insurance_companies
        SET company_type = 'Standalone Health Insurance'
        WHERE (category ILIKE '%health%' OR name ILIKE '%health%' OR name ILIKE '%care%' OR name ILIKE '%star%')
          AND category NOT ILIKE '%composite%'
          AND (company_type IS NULL OR company_type = 'General Insurance');
        """
    )
    op.execute(
        """
        UPDATE insurance_companies
        SET company_type = 'General Insurance'
        WHERE company_type IS NULL;
        """
    )

    # 7. Synchronize existing company plans with insurance_company_categories
    # Ensure every active plan's line_of_business is registered in insurance_company_categories for that company
    plan_rows = conn.execute(
        sa.text("SELECT DISTINCT company_id, line_of_business FROM insurance_plans WHERE line_of_business IS NOT NULL")
    ).fetchall()

    for comp_id, lob in plan_rows:
        lob_clean = str(lob).strip()
        # insert canonical label
        exists = conn.execute(
            sa.text("SELECT 1 FROM insurance_company_categories WHERE company_id = :cid AND category = :cat"),
            {"cid": comp_id, "cat": lob_clean},
        ).scalar()
        if not exists:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO insurance_company_categories (id, company_id, category, is_active, created_at)
                    VALUES (:id, :cid, :cat, true, NOW())
                    """
                ),
                {"id": uuid.uuid4(), "cid": comp_id, "cat": lob_clean},
            )


def downgrade() -> None:
    op.drop_column("insurance_plans", "eligibility_criteria")
    op.drop_column("insurance_plans", "waiting_period_months")
    op.drop_column("insurance_plans", "policy_term_max_years")
    op.drop_column("insurance_plans", "policy_term_min_years")
    op.drop_column("insurance_plans", "sum_insured_max")
    op.drop_column("insurance_plans", "sum_insured_min")
    op.drop_column("insurance_plans", "motor_plan_type")
    op.drop_column("insurance_plans", "plan_subcategory")

    op.drop_index("ix_insurance_company_categories_active", table_name="insurance_company_categories")
    op.drop_column("insurance_company_categories", "is_active")

    op.drop_column("insurance_companies", "company_type")

    op.drop_index("ix_insurance_categories_parent", table_name="insurance_categories")
    op.drop_index("ix_insurance_categories_code", table_name="insurance_categories")
    op.drop_table("insurance_categories")
