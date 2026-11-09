"""add_insurance_plan_documents

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-11-01 21:00:00.000000+00:00

"""

from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b8c9d0e1f2a3"
down_revision: str | None = "a7b8c9d0e1f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create insurance_plan_documents table
    op.create_table(
        "insurance_plan_documents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("document_type", sa.String(length=50), nullable=False, server_default="POLICY_BROCHURE"),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("sha256_hash", sa.String(length=64), nullable=False),
        sa.Column("uploaded_by_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["plan_id"],
            ["insurance_plans.id"],
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
        "ix_insurance_plan_documents_plan_id",
        "insurance_plan_documents",
        ["plan_id"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_plan_documents_type",
        "insurance_plan_documents",
        ["document_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_insurance_plan_documents_type", table_name="insurance_plan_documents")
    op.drop_index("ix_insurance_plan_documents_plan_id", table_name="insurance_plan_documents")
    op.drop_table("insurance_plan_documents")
