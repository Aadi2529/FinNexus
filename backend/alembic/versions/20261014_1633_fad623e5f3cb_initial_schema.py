"""initial_schema

Revision ID: fad623e5f3cb
Revises:
Create Date: 2026-10-14 16:33:05.725216+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "fad623e5f3cb"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. roles table
    op.create_table(
        "roles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # 2. users table
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_is_active"), "users", ["is_active"], unique=False)

    # 3. user_roles association table
    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "role_id"),
    )

    # 4. refresh_tokens table
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_refresh_tokens_token_hash"),
        "refresh_tokens",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        op.f("ix_refresh_tokens_user_id"),
        "refresh_tokens",
        ["user_id"],
        unique=False,
    )

    # 5. customers table
    op.create_table(
        "customers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("pan_number", sa.String(length=10), nullable=False),
        sa.Column("pipeline_status", sa.String(length=40), nullable=False),
        sa.Column("assigned_officer_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["assigned_officer_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_customers_assigned_officer_id"),
        "customers",
        ["assigned_officer_id"],
        unique=False,
    )
    op.create_index(op.f("ix_customers_email"), "customers", ["email"], unique=True)
    op.create_index(
        op.f("ix_customers_pan_number"), "customers", ["pan_number"], unique=True
    )
    op.create_index(
        op.f("ix_customers_pipeline_status"),
        "customers",
        ["pipeline_status"],
        unique=False,
    )

    # 6. financial_profiles table
    op.create_table(
        "financial_profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("employment_type", sa.String(length=50), nullable=False),
        sa.Column("monthly_income", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column(
            "monthly_obligations", sa.Numeric(precision=14, scale=2), nullable=False
        ),
        sa.Column("cibil_score", sa.Integer(), nullable=True),
        sa.Column("risk_tier", sa.String(length=20), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "cibil_score IS NULL OR (cibil_score >= 300 AND cibil_score <= 900)",
            name="chk_financial_profiles_cibil_score_range",
        ),
        sa.CheckConstraint(
            "monthly_income >= 0", name="chk_financial_profiles_monthly_income_positive"
        ),
        sa.CheckConstraint(
            "monthly_obligations >= 0",
            name="chk_financial_profiles_monthly_obligations_positive",
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("customer_id"),
    )

    # 7. customer_notes table
    op.create_table(
        "customer_notes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_customer_notes_customer_id"),
        "customer_notes",
        ["customer_id"],
        unique=False,
    )

    # 8. tasks table
    op.create_table(
        "tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("assigned_to_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["assigned_to_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_tasks_assigned_to_id"), "tasks", ["assigned_to_id"], unique=False
    )
    op.create_index(op.f("ix_tasks_due_date"), "tasks", ["due_date"], unique=False)
    op.create_index(op.f("ix_tasks_status"), "tasks", ["status"], unique=False)

    # 9. documents table
    op.create_table(
        "documents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("document_type", sa.String(length=50), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("sha256_hash", sa.String(length=64), nullable=False),
        sa.Column("verification_status", sa.String(length=30), nullable=False),
        sa.Column("verified_by_id", sa.Uuid(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "file_size_bytes > 0", name="chk_documents_file_size_positive"
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["verified_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_path"),
    )
    op.create_index(
        op.f("ix_documents_customer_id"), "documents", ["customer_id"], unique=False
    )
    op.create_index(
        op.f("ix_documents_sha256_hash"), "documents", ["sha256_hash"], unique=False
    )
    op.create_index(
        op.f("ix_documents_verification_status"),
        "documents",
        ["verification_status"],
        unique=False,
    )

    # 10. audit_logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("resource_type", sa.String(length=50), nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=True),
        sa.Column(
            "state_delta",
            postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), "sqlite"),
            nullable=True,
        ),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_audit_logs_actor_id"), "audit_logs", ["actor_id"], unique=False
    )
    op.create_index(
        op.f("ix_audit_logs_created_at"), "audit_logs", ["created_at"], unique=False
    )
    op.create_index(
        "ix_audit_logs_resource",
        "audit_logs",
        ["resource_type", "resource_id"],
        unique=False,
    )


def downgrade() -> None:
    # 10. Drop audit_logs
    op.drop_index("ix_audit_logs_resource", table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_created_at"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_actor_id"), table_name="audit_logs")
    op.drop_table("audit_logs")

    # 9. Drop documents
    op.drop_index(op.f("ix_documents_verification_status"), table_name="documents")
    op.drop_index(op.f("ix_documents_sha256_hash"), table_name="documents")
    op.drop_index(op.f("ix_documents_customer_id"), table_name="documents")
    op.drop_table("documents")

    # 8. Drop tasks
    op.drop_index(op.f("ix_tasks_status"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_due_date"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_assigned_to_id"), table_name="tasks")
    op.drop_table("tasks")

    # 7. Drop customer_notes
    op.drop_index(op.f("ix_customer_notes_customer_id"), table_name="customer_notes")
    op.drop_table("customer_notes")

    # 6. Drop financial_profiles
    op.drop_table("financial_profiles")

    # 5. Drop customers
    op.drop_index(op.f("ix_customers_pipeline_status"), table_name="customers")
    op.drop_index(op.f("ix_customers_pan_number"), table_name="customers")
    op.drop_index(op.f("ix_customers_email"), table_name="customers")
    op.drop_index(op.f("ix_customers_assigned_officer_id"), table_name="customers")
    op.drop_table("customers")

    # 4. Drop refresh_tokens
    op.drop_index(op.f("ix_refresh_tokens_user_id"), table_name="refresh_tokens")
    op.drop_index(op.f("ix_refresh_tokens_token_hash"), table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    # 3. Drop user_roles
    op.drop_table("user_roles")

    # 2. Drop users
    op.drop_index(op.f("ix_users_is_active"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    # 1. Drop roles
    op.drop_table("roles")
