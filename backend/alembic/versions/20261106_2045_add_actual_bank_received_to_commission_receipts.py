"""Add actual_bank_received column to insurance_commission_receipts table.

Revision ID: b2c3d4e5f6a7
Revises: f9a0b1c2d3e4
Create Date: 2026-11-06 20:45:00.000000

"""

from alembic import op
import sqlalchemy as sa

revision = "c1d2e3f4a5b6"
down_revision = "f9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add actual_bank_received column
    op.add_column(
        "insurance_commission_receipts",
        sa.Column("actual_bank_received", sa.Numeric(14, 2), nullable=True),
    )
    # Backfill existing receipts where actual_bank_received is null with net_amount
    op.execute(
        """
        UPDATE insurance_commission_receipts
        SET actual_bank_received = net_amount
        WHERE actual_bank_received IS NULL;
        """
    )


def downgrade() -> None:
    op.drop_column("insurance_commission_receipts", "actual_bank_received")
