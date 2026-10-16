"""Pydantic schemas for FinanceFlow Insurance Engine module."""

from decimal import Decimal

from pydantic import BaseModel, Field


class InsuranceProduct(BaseModel):
    """Insurance product catalog item."""

    id: str
    code: str
    name: str
    category: str
    description: str
    min_sum_assured: Decimal
    max_sum_assured: Decimal
    base_annual_rate_per_thousand: Decimal


class QuoteCalculationRequest(BaseModel):
    """Payload to calculate a risk-adjusted insurance quotation."""

    product_code: str = Field(
        ..., description="Product identifier e.g. TERM_LIFE, HEALTH_SHIELD, MOTOR_AUTO"
    )
    customer_age: int = Field(..., ge=18, le=75, description="Proposer age in years")
    sum_assured: Decimal = Field(..., gt=0, description="Coverage amount in INR")
    policy_term_years: int = Field(default=10, ge=1, le=40)
    is_smoker: bool = Field(
        default=False, description="Tobacco / smoking consumption status"
    )
    has_pre_existing_conditions: bool = Field(
        default=False, description="Declared chronic medical conditions"
    )


class QuoteCalculationResponse(BaseModel):
    """Quotation summary with actuarial cost breakdown."""

    quote_id: str
    product_code: str
    product_name: str
    sum_assured: Decimal
    policy_term_years: int
    base_annual_premium: Decimal
    risk_loading: Decimal
    gst_tax: Decimal
    total_annual_premium: Decimal
    monthly_installment_premium: Decimal
    disclaimer: str


class PolicySummary(BaseModel):
    """Insurance policy summary."""

    policy_number: str
    customer_name: str
    product_name: str
    category: str
    sum_assured: Decimal
    annual_premium: Decimal
    status: str
    start_date: str
    expiry_date: str
    days_to_expiry: int
    renewal_eligible: bool


class RenewalRequest(BaseModel):
    """Payload to initiate a policy renewal."""

    policy_number: str
    renew_term_years: int = Field(default=1, ge=1, le=5)


class RenewalResponse(BaseModel):
    """Confirmation of policy renewal."""

    policy_number: str
    status: str
    new_expiry_date: str
    renewal_premium: Decimal
    message: str
