"""enhance_companies_and_plans

Revision ID: a1b2c3d4e5f6
Revises: e4c8b1a72d3f
Create Date: 2026-10-31 22:30:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "e4c8b1a72d3f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Enhance insurance_companies table with enterprise tie-up & agent fields
    op.add_column("insurance_companies", sa.Column("agent_name", sa.String(length=150), nullable=True))
    op.add_column("insurance_companies", sa.Column("agent_contact_number", sa.String(length=50), nullable=True))
    op.add_column("insurance_companies", sa.Column("agent_code", sa.String(length=50), nullable=True))
    op.add_column("insurance_companies", sa.Column("tieup_date", sa.Date(), nullable=True))
    op.add_column("insurance_companies", sa.Column("tieup_renewal_date", sa.Date(), nullable=True))
    op.add_column("insurance_companies", sa.Column("renewal_team_contact", sa.String(length=255), nullable=True))
    op.add_column("insurance_companies", sa.Column("claims_team_contact", sa.String(length=255), nullable=True))

    # 2. Create insurance_company_documents table for tie-up contracts and compliance documents
    op.create_table(
        "insurance_company_documents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("document_type", sa.String(length=50), nullable=False, server_default="TIEUP_AGREEMENT"),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("sha256_hash", sa.String(length=64), nullable=False),
        sa.Column("uploaded_by_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["insurance_companies.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_path"),
    )
    op.create_index(
        "ix_insurance_company_documents_company_id",
        "insurance_company_documents",
        ["company_id"],
        unique=False,
    )

    # 3. Enhance insurance_plans table with riders, benefits, and brochure/claim form storage
    op.add_column("insurance_plans", sa.Column("riders", sa.Text(), nullable=True))
    op.add_column("insurance_plans", sa.Column("benefits", sa.Text(), nullable=True))
    op.add_column("insurance_plans", sa.Column("brochure_filename", sa.String(length=255), nullable=True))
    op.add_column("insurance_plans", sa.Column("brochure_storage_path", sa.String(length=500), nullable=True))
    op.add_column("insurance_plans", sa.Column("brochure_mime_type", sa.String(length=100), nullable=True))
    op.add_column("insurance_plans", sa.Column("claim_form_filename", sa.String(length=255), nullable=True))
    op.add_column("insurance_plans", sa.Column("claim_form_storage_path", sa.String(length=500), nullable=True))
    op.add_column("insurance_plans", sa.Column("claim_form_mime_type", sa.String(length=100), nullable=True))


def downgrade() -> None:
    # 1. Revert plans enhancements
    op.drop_column("insurance_plans", "claim_form_mime_type")
    op.drop_column("insurance_plans", "claim_form_storage_path")
    op.drop_column("insurance_plans", "claim_form_filename")
    op.drop_column("insurance_plans", "brochure_mime_type")
    op.drop_column("insurance_plans", "brochure_storage_path")
    op.drop_column("insurance_plans", "brochure_filename")
    op.drop_column("insurance_plans", "benefits")
    op.drop_column("insurance_plans", "riders")

    # 2. Drop company documents table
    op.drop_index("ix_insurance_company_documents_company_id", table_name="insurance_company_documents")
    op.drop_table("insurance_company_documents")

    # 3. Revert company enhancements
    op.drop_column("insurance_companies", "claims_team_contact")
    op.drop_column("insurance_companies", "renewal_team_contact")
    op.drop_column("insurance_companies", "tieup_renewal_date")
    op.drop_column("insurance_companies", "tieup_date")
    op.drop_column("insurance_companies", "agent_code")
    op.drop_column("insurance_companies", "agent_contact_number")
    op.drop_column("insurance_companies", "agent_name")
