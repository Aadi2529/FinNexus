"""add_issue_date_to_insurance_policies policy issue_date

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
Create Date: 2026-11-05 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b5c6d7e8f9a0"
down_revision = "a4b5c6d7e8f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "insurance_policies",
        sa.Column("issue_date", sa.Date(), nullable=True),
    )
    op.create_index(
        op.f("ix_insurance_policies_issue_date"),
        "insurance_policies",
        ["issue_date"],
        unique=False,
    )
    op.execute(
        "UPDATE insurance_policies SET issue_date = COALESCE(first_receipt_date, CAST(created_at AS date)) WHERE issue_date IS NULL"
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_insurance_policies_issue_date"),
        table_name="insurance_policies",
    )
    op.drop_column("insurance_policies", "issue_date")
