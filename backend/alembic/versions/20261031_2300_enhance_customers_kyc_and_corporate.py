"""Enhance customers with KYC encryption at rest, corporate client fields, and demographics.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-31 23:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. KYC Encryption & Privacy Fields
    op.add_column("customers", sa.Column("aadhaar_encrypted", sa.String(500), nullable=True))
    op.add_column("customers", sa.Column("aadhaar_hash", sa.String(64), nullable=True))
    op.create_index("ix_customers_aadhaar_hash", "customers", ["aadhaar_hash"])
    op.add_column("customers", sa.Column("pan_encrypted", sa.String(500), nullable=True))

    # 2. Individual Customer Demographics & Financial Profile
    op.add_column("customers", sa.Column("marital_status", sa.String(50), nullable=True))
    op.add_column("customers", sa.Column("nationality", sa.String(50), nullable=True, server_default="Indian"))
    op.add_column("customers", sa.Column("occupation", sa.String(100), nullable=True))
    op.add_column("customers", sa.Column("source_of_income", sa.String(100), nullable=True))

    # 3. Corporate Client Management Fields
    op.add_column("customers", sa.Column("company_name", sa.String(200), nullable=True))
    op.add_column("customers", sa.Column("corporate_code", sa.String(50), nullable=True))
    op.create_index("ix_customers_corporate_code", "customers", ["corporate_code"])
    op.add_column("customers", sa.Column("gstin", sa.String(15), nullable=True))
    op.create_index("ix_customers_gstin", "customers", ["gstin"])
    op.add_column("customers", sa.Column("contact_person_name", sa.String(150), nullable=True))
    op.add_column("customers", sa.Column("contact_person_phone", sa.String(50), nullable=True))
    op.add_column("customers", sa.Column("contact_person_email", sa.String(255), nullable=True))


def downgrade() -> None:
    # 3. Drop Corporate Client Fields
    op.drop_column("customers", "contact_person_email")
    op.drop_column("customers", "contact_person_phone")
    op.drop_column("customers", "contact_person_name")
    op.drop_index("ix_customers_gstin", table_name="customers")
    op.drop_column("customers", "gstin")
    op.drop_index("ix_customers_corporate_code", table_name="customers")
    op.drop_column("customers", "corporate_code")
    op.drop_column("customers", "company_name")

    # 2. Drop Demographics Fields
    op.drop_column("customers", "source_of_income")
    op.drop_column("customers", "occupation")
    op.drop_column("customers", "nationality")
    op.drop_column("customers", "marital_status")

    # 1. Drop KYC Fields
    op.drop_column("customers", "pan_encrypted")
    op.drop_index("ix_customers_aadhaar_hash", table_name="customers")
    op.drop_column("customers", "aadhaar_hash")
    op.drop_column("customers", "aadhaar_encrypted")
