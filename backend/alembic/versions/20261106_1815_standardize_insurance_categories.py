"""Standardize insurance categories across companies, plans, and category mapping tables.

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-11-06 18:15:00.000000

"""

import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column, select

revision = "f9a0b1c2d3e4"
down_revision = "e8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Update legacy General/Motor or variations in insurance_companies to canonical "Motor Insurance"
    op.execute(
        """
        UPDATE insurance_companies
        SET category = 'Motor Insurance'
        WHERE category ILIKE '%general/motor%'
           OR category ILIKE '%general / motor%'
           OR category = 'MOTOR'
           OR category = 'motor';
        """
    )
    op.execute(
        """
        UPDATE insurance_companies
        SET category = 'Health Insurance'
        WHERE category = 'HEALTH'
           OR category = 'health';
        """
    )
    op.execute(
        """
        UPDATE insurance_companies
        SET category = 'Life Insurance'
        WHERE category = 'LIFE'
           OR category = 'life';
        """
    )

    # 2. Update legacy General/Motor or variations in insurance_plans to canonical "Motor Insurance"
    op.execute(
        """
        UPDATE insurance_plans
        SET line_of_business = 'Motor Insurance'
        WHERE line_of_business ILIKE '%general/motor%'
           OR line_of_business ILIKE '%general / motor%'
           OR line_of_business = 'MOTOR'
           OR line_of_business = 'motor';
        """
    )
    op.execute(
        """
        UPDATE insurance_plans
        SET line_of_business = 'Health Insurance'
        WHERE line_of_business = 'HEALTH'
           OR line_of_business = 'health';
        """
    )
    op.execute(
        """
        UPDATE insurance_plans
        SET line_of_business = 'Life Insurance'
        WHERE line_of_business = 'LIFE'
           OR line_of_business = 'life';
        """
    )

    # 3. Synchronize insurance_company_categories with normalized codes & labels for each company
    conn = op.get_bind()
    companies = conn.execute(
        sa.text("SELECT id, category FROM insurance_companies WHERE is_active = true")
    ).fetchall()

    for comp_id, category in companies:
        if not category:
            continue
        cat_lower = category.lower()
        if "motor" in cat_lower or "car" in cat_lower or "vehicle" in cat_lower:
            codes = ["MOTOR", "Motor Insurance"]
        elif "health" in cat_lower or "medic" in cat_lower:
            codes = ["HEALTH", "Health Insurance"]
        elif "life" in cat_lower or "term" in cat_lower:
            codes = ["LIFE", "Life Insurance"]
        elif "travel" in cat_lower:
            codes = ["TRAVEL", "Travel Insurance"]
        elif "home" in cat_lower:
            codes = ["HOME", "Home Insurance"]
        elif "fire" in cat_lower:
            codes = ["FIRE", "Fire Insurance"]
        elif "marine" in cat_lower:
            codes = ["MARINE", "Marine Insurance"]
        else:
            codes = ["OTHER", "Other Insurance"]

        for code in codes:
            exists = conn.execute(
                sa.text(
                    "SELECT 1 FROM insurance_company_categories WHERE company_id = :cid AND category = :cat"
                ),
                {"cid": comp_id, "cat": code},
            ).scalar()
            if not exists:
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO insurance_company_categories (id, company_id, category, created_at)
                        VALUES (:id, :cid, :cat, NOW())
                        """
                    ),
                    {"id": uuid.uuid4(), "cid": comp_id, "cat": code},
                )


def downgrade() -> None:
    pass
