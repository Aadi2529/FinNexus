"""Add previous_policy_id foreign key to insurance_policies for linked renewal lifecycle.

Revision ID: a4b5c6d7e8f9
Revises: f3b4c5d6e7f8
Create Date: 2026-11-04 23:30:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a4b5c6d7e8f9"
down_revision = "f3b4c5d6e7f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add previous_policy_id column to insurance_policies table
    op.add_column(
        "insurance_policies",
        sa.Column(
            "previous_policy_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("insurance_policies.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # 2. Create index on previous_policy_id for fast renewal lifecycle lookups
    op.create_index(
        "ix_insurance_policies_previous_policy_id",
        "insurance_policies",
        ["previous_policy_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_insurance_policies_previous_policy_id",
        table_name="insurance_policies",
    )
    op.drop_column("insurance_policies", "previous_policy_id")
