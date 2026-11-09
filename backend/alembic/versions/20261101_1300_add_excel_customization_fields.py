"""Add Excel customization fields to insurance policies

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-11-01 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Proposal & Business Type (NEW / PORT / RENEW)
    op.add_column(
        'insurance_policies',
        sa.Column('proposal_number', sa.String(length=100), nullable=True)
    )
    op.create_index(
        op.f('ix_insurance_policies_proposal_number'),
        'insurance_policies',
        ['proposal_number'],
        unique=False
    )
    op.add_column(
        'insurance_policies',
        sa.Column('business_type', sa.String(length=20), server_default='NEW', nullable=False)
    )
    op.add_column(
        'insurance_policies',
        sa.Column('previous_policy_number', sa.String(length=100), nullable=True)
    )
    op.add_column(
        'insurance_policies',
        sa.Column('previous_insurer', sa.String(length=150), nullable=True)
    )
    op.add_column(
        'insurance_policies',
        sa.Column('portability_continuity_details', sa.Text(), nullable=True)
    )

    # 2. Product Variant & Coverage Additions
    op.add_column(
        'insurance_policies',
        sa.Column('product_variant', sa.String(length=100), nullable=True)
    )
    op.add_column(
        'insurance_policies',
        sa.Column('hospital_cash_benefit', sa.String(length=30), server_default='NOT_APPLICABLE', nullable=False)
    )

    # 3. Motor Category Fields
    op.add_column(
        'insurance_policies',
        sa.Column('vehicle_registration_number', sa.String(length=50), nullable=True)
    )
    op.create_index(
        op.f('ix_insurance_policies_vehicle_reg_num'),
        'insurance_policies',
        ['vehicle_registration_number'],
        unique=False
    )
    op.add_column(
        'insurance_policies',
        sa.Column('vehicle_manufacturer', sa.String(length=100), nullable=True)
    )
    op.add_column(
        'insurance_policies',
        sa.Column('vehicle_model', sa.String(length=100), nullable=True)
    )
    op.add_column(
        'insurance_policies',
        sa.Column('vehicle_type', sa.String(length=50), nullable=True)
    )

    # 4. Travel Category Fields
    op.add_column(
        'insurance_policies',
        sa.Column('travel_destination', sa.String(length=150), nullable=True)
    )
    op.add_column(
        'insurance_policies',
        sa.Column('travel_type', sa.String(length=50), nullable=True)
    )

    # 5. Intermediary / Business Source
    op.add_column(
        'insurance_policies',
        sa.Column('intermediary_name', sa.String(length=150), nullable=True)
    )

    # 6. Policy-specific Contact Snapshot (City, PIN, Phone, Email)
    op.add_column(
        'insurance_policies',
        sa.Column('contact_city', sa.String(length=100), nullable=True)
    )
    op.add_column(
        'insurance_policies',
        sa.Column('contact_pincode', sa.String(length=20), nullable=True)
    )
    op.add_column(
        'insurance_policies',
        sa.Column('contact_mobile', sa.String(length=30), nullable=True)
    )
    op.add_column(
        'insurance_policies',
        sa.Column('contact_email', sa.String(length=255), nullable=True)
    )

    # 7. Commission Status & Realization
    op.add_column(
        'insurance_policies',
        sa.Column('commission_received_status', sa.String(length=30), server_default='PENDING', nullable=False)
    )
    op.add_column(
        'insurance_policies',
        sa.Column('actual_commission_received_amount', sa.Numeric(precision=14, scale=2), nullable=True)
    )
    op.add_column(
        'insurance_policies',
        sa.Column('commission_received_date', sa.Date(), nullable=True)
    )
    op.add_column(
        'insurance_policies',
        sa.Column('commission_bank_reference', sa.String(length=100), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('insurance_policies', 'commission_bank_reference')
    op.drop_column('insurance_policies', 'commission_received_date')
    op.drop_column('insurance_policies', 'actual_commission_received_amount')
    op.drop_column('insurance_policies', 'commission_received_status')

    op.drop_column('insurance_policies', 'contact_email')
    op.drop_column('insurance_policies', 'contact_mobile')
    op.drop_column('insurance_policies', 'contact_pincode')
    op.drop_column('insurance_policies', 'contact_city')

    op.drop_column('insurance_policies', 'intermediary_name')

    op.drop_column('insurance_policies', 'travel_type')
    op.drop_column('insurance_policies', 'travel_destination')

    op.drop_index(op.f('ix_insurance_policies_vehicle_reg_num'), table_name='insurance_policies')
    op.drop_column('insurance_policies', 'vehicle_type')
    op.drop_column('insurance_policies', 'vehicle_model')
    op.drop_column('insurance_policies', 'vehicle_manufacturer')
    op.drop_column('insurance_policies', 'vehicle_registration_number')

    op.drop_column('insurance_policies', 'hospital_cash_benefit')
    op.drop_column('insurance_policies', 'product_variant')

    op.drop_column('insurance_policies', 'portability_continuity_details')
    op.drop_column('insurance_policies', 'previous_insurer')
    op.drop_column('insurance_policies', 'previous_policy_number')
    op.drop_column('insurance_policies', 'business_type')
    op.drop_index(op.f('ix_insurance_policies_proposal_number'), table_name='insurance_policies')
    op.drop_column('insurance_policies', 'proposal_number')
