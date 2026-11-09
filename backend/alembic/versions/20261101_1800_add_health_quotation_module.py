"""Add Health Quotation Module tables

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-11-01 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. insurance_health_quotations
    op.create_table(
        'insurance_health_quotations',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('quotation_number', sa.String(length=50), nullable=False),
        sa.Column('quotation_title', sa.String(length=255), nullable=False),
        sa.Column('client_id', sa.Uuid(), nullable=True),
        sa.Column('client_name', sa.String(length=150), nullable=False),
        sa.Column('advisor_id', sa.Uuid(), nullable=False),
        sa.Column('advisor_name', sa.String(length=150), nullable=False),
        sa.Column('quotation_date', sa.Date(), nullable=False),
        sa.Column('pin_code', sa.String(length=10), nullable=False),
        sa.Column('contact_number', sa.String(length=50), nullable=True),
        sa.Column('contact_email', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('disclaimer_snapshot', sa.String(length=500), nullable=False),
        sa.Column('premium_basis', sa.String(length=20), server_default='GROSS', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='DRAFT', nullable=False),
        sa.Column('tenant_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['advisor_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['client_id'], ['customers.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_insurance_health_quotations_num',
        'insurance_health_quotations',
        ['quotation_number'],
        unique=True
    )
    op.create_index(
        'ix_insurance_health_quotations_date',
        'insurance_health_quotations',
        ['quotation_date'],
        unique=False
    )
    op.create_index(
        'ix_insurance_health_quotations_status',
        'insurance_health_quotations',
        ['status'],
        unique=False
    )
    op.create_index(
        'ix_insurance_health_quotations_tenant',
        'insurance_health_quotations',
        ['tenant_id'],
        unique=False
    )

    # 2. insurance_health_quotation_members
    op.create_table(
        'insurance_health_quotation_members',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('quotation_id', sa.Uuid(), nullable=False),
        sa.Column('customer_id', sa.Uuid(), nullable=True),
        sa.Column('full_name', sa.String(length=150), nullable=False),
        sa.Column('relationship', sa.String(length=50), nullable=False),
        sa.Column('gender', sa.String(length=20), nullable=True),
        sa.Column('date_of_birth', sa.Date(), nullable=False),
        sa.Column('reference_date', sa.Date(), nullable=False),
        sa.Column('age_years', sa.Integer(), nullable=False),
        sa.Column('age_months', sa.Integer(), nullable=False),
        sa.Column('age_days', sa.Integer(), nullable=False),
        sa.Column('is_primary', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['quotation_id'], ['insurance_health_quotations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_health_quote_members_quote',
        'insurance_health_quotation_members',
        ['quotation_id'],
        unique=False
    )

    # 3. insurance_health_quotation_company_plans
    op.create_table(
        'insurance_health_quotation_company_plans',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('quotation_id', sa.Uuid(), nullable=False),
        sa.Column('insurance_company_id', sa.Uuid(), nullable=True),
        sa.Column('insurance_plan_id', sa.Uuid(), nullable=True),
        sa.Column('display_company_name', sa.String(length=150), nullable=False),
        sa.Column('display_plan_variant', sa.String(length=150), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['insurance_company_id'], ['insurance_companies.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['insurance_plan_id'], ['insurance_plans.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['quotation_id'], ['insurance_health_quotations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_health_quote_comp_plans_quote',
        'insurance_health_quotation_company_plans',
        ['quotation_id'],
        unique=False
    )

    # 4. insurance_health_quotation_premiums
    op.create_table(
        'insurance_health_quotation_premiums',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('quotation_company_plan_id', sa.Uuid(), nullable=False),
        sa.Column('sum_insured', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('sum_insured_code', sa.String(length=20), nullable=False),
        sa.Column('premium_amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('premium_basis', sa.String(length=20), server_default='GROSS', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['quotation_company_plan_id'], ['insurance_health_quotation_company_plans.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('quotation_company_plan_id', 'sum_insured_code', name='uq_health_quote_premium_plan_tier')
    )
    op.create_index(
        'ix_health_quote_premiums_plan',
        'insurance_health_quotation_premiums',
        ['quotation_company_plan_id'],
        unique=False
    )


def downgrade() -> None:
    op.drop_table('insurance_health_quotation_premiums')
    op.drop_table('insurance_health_quotation_company_plans')
    op.drop_table('insurance_health_quotation_members')
    op.drop_table('insurance_health_quotations')
