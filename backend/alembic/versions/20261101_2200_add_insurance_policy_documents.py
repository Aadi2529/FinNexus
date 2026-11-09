"""add_insurance_policy_documents

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-11-01 22:00:00.000000+00:00

"""

from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c9d0e1f2a3b4"
down_revision: str | None = "b8c9d0e1f2a3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create insurance_policy_documents table
    op.create_table(
        "insurance_policy_documents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("policy_id", sa.Uuid(), nullable=False),
        sa.Column("document_type", sa.String(length=50), nullable=False, server_default="OFFICIAL_POLICY_CERTIFICATE"),
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
            ["policy_id"],
            ["insurance_policies.id"],
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
        "ix_insurance_policy_documents_policy_id",
        "insurance_policy_documents",
        ["policy_id"],
        unique=False,
    )
    op.create_index(
        "ix_insurance_policy_documents_type",
        "insurance_policy_documents",
        ["document_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_insurance_policy_documents_type", table_name="insurance_policy_documents")
    op.drop_index("ix_insurance_policy_documents_policy_id", table_name="insurance_policy_documents")
    op.drop_table("insurance_policy_documents")
