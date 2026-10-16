"""FinanceFlow Insurance Engine Module Endpoints."""

import uuid
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.db.models.auth import User
from app.schemas.insurance import (
    InsuranceProduct,
    PolicySummary,
    QuoteCalculationRequest,
    QuoteCalculationResponse,
    RenewalRequest,
    RenewalResponse,
)

router = APIRouter(prefix="/insurance", tags=["Insurance Engine"])

# Static enterprise product catalog
PRODUCTS: dict[str, InsuranceProduct] = {
    "TERM_LIFE": InsuranceProduct(
        id="prod_term_life",
        code="TERM_LIFE",
        name="Enterprise Term Life Shield",
        category="Life Insurance",
        description="High-value pure risk term life protection with critical illness rider options.",
        min_sum_assured=Decimal("2500000.00"),
        max_sum_assured=Decimal("50000000.00"),
        base_annual_rate_per_thousand=Decimal("1.85"),
    ),
    "HEALTH_SHIELD": InsuranceProduct(
        id="prod_health_shield",
        code="HEALTH_SHIELD",
        name="Optima Comprehensive Health Plan",
        category="Health Insurance",
        description="Cashless family floater health cover with zero co-payment and day-care hospitalization.",
        min_sum_assured=Decimal("500000.00"),
        max_sum_assured=Decimal("10000000.00"),
        base_annual_rate_per_thousand=Decimal("12.50"),
    ),
    "MOTOR_AUTO": InsuranceProduct(
        id="prod_motor_auto",
        code="MOTOR_AUTO",
        name="Commercial Fleet & Motor Cover",
        category="General Insurance",
        description="Comprehensive third-party and own-damage vehicle protection with roadside assistance.",
        min_sum_assured=Decimal("200000.00"),
        max_sum_assured=Decimal("5000000.00"),
        base_annual_rate_per_thousand=Decimal("28.00"),
    ),
    "COMMERCIAL_PROP": InsuranceProduct(
        id="prod_comm_prop",
        code="COMMERCIAL_PROP",
        name="Business Asset & Commercial Property",
        category="Commercial Insurance",
        description="Protection against fire, allied perils, business interruption, and inventory loss.",
        min_sum_assured=Decimal("1000000.00"),
        max_sum_assured=Decimal("100000000.00"),
        base_annual_rate_per_thousand=Decimal("0.95"),
    ),
}

def _init_policies_store() -> list[dict]:
    from datetime import date, timedelta
    return [
            {
                "policy_number": "POL-2025-TERM-0081",
                "customer_name": "Aarav Patel",
                "product_name": "Term Life Elite Shield",
                "category": "Life Insurance",
                "sum_assured": Decimal("10000000.00"),
                "annual_premium": Decimal("15000.00"),
                "status": "ACTIVE",
                "start_date": "2025-01-15",
                "expiry_date": (date.today() + timedelta(days=90)).isoformat(),
                "days_to_expiry": 90,
                "renewal_eligible": True,
            },
            {
                "policy_number": "POL-2025-HLTH-0412",
                "customer_name": "Sunita Rao",
                "product_name": "Health Shield Comprehensive",
                "category": "Health Insurance",
                "sum_assured": Decimal("1500000.00"),
                "annual_premium": Decimal("21500.00"),
                "status": "ACTIVE",
                "start_date": "2025-03-01",
                "expiry_date": (date.today() + timedelta(days=120)).isoformat(),
                "days_to_expiry": 120,
                "renewal_eligible": True,
            },
            {
                "policy_number": "POL-2024-AUTO-1092",
                "customer_name": "Rohan Verma",
                "product_name": "Commercial Fleet & Motor Cover",
                "category": "General Insurance",
                "sum_assured": Decimal("850000.00"),
                "annual_premium": Decimal("23800.00"),
                "status": "ACTIVE",
                "start_date": "2024-11-20",
                "expiry_date": (date.today() + timedelta(days=30)).isoformat(),
                "days_to_expiry": 30,
                "renewal_eligible": True,
            },
        ]
    return []


# Operational in-memory policy store (starts empty; populated when coverage contracts are bound)
POLICIES_STORE: list[dict] = _init_policies_store()



@router.get(
    "/products",
    response_model=list[InsuranceProduct],
    summary="List Insurance Products Catalog",
)
async def list_products(
    current_user: User = Depends(get_current_user),
) -> list[InsuranceProduct]:
    """Retrieve available insurance products, underwriting limits, and base tariff rates."""
    return list(PRODUCTS.values())


@router.post(
    "/quotes/calculate",
    response_model=QuoteCalculationResponse,
    summary="Calculate Risk-Adjusted Insurance Quotation",
)
async def calculate_quote(
    payload: QuoteCalculationRequest,
    current_user: User = Depends(get_current_user),
) -> QuoteCalculationResponse:
    """Calculate indicative insurance premium using Python Decimal with age and underwriting loading factors."""
    code = payload.product_code.upper().strip()
    product = PRODUCTS.get(code)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insurance product '{payload.product_code}' not found in catalog.",
        )

    if payload.sum_assured < product.min_sum_assured:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Sum assured cannot be less than minimum ₹{product.min_sum_assured:,.2f}.",
        )

    if payload.sum_assured > product.max_sum_assured:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Sum assured cannot exceed maximum ₹{product.max_sum_assured:,.2f}.",
        )

    thousands = payload.sum_assured / Decimal("1000")
    base_annual = (thousands * product.base_annual_rate_per_thousand).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    # Actuarial Risk Multipliers
    risk_multiplier = Decimal("1.00")

    # Age loading (>30: +2.5% per year)
    if payload.customer_age > 30:
        age_diff = Decimal(str(payload.customer_age - 30))
        risk_multiplier += age_diff * Decimal("0.025")

    # Smoker loading (+35%)
    if payload.is_smoker:
        risk_multiplier += Decimal("0.35")

    # Pre-existing condition loading (+25%)
    if payload.has_pre_existing_conditions:
        risk_multiplier += Decimal("0.25")

    loaded_premium = (base_annual * risk_multiplier).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    risk_loading = loaded_premium - base_annual

    # Statutory GST Tax (18%)
    gst = (loaded_premium * Decimal("0.18")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    total_annual = loaded_premium + gst
    monthly_installment = (total_annual / Decimal("12")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    return QuoteCalculationResponse(
        quote_id=f"QT-{uuid.uuid4().hex[:8].upper()}",
        product_code=product.code,
        product_name=product.name,
        sum_assured=payload.sum_assured,
        policy_term_years=payload.policy_term_years,
        base_annual_premium=base_annual,
        risk_loading=risk_loading,
        gst_tax=gst,
        total_annual_premium=total_annual,
        monthly_installment_premium=monthly_installment,
        disclaimer=(
            "Actuarial Demonstration Engine: Premiums calculated using Decimal precision based on declared risk parameters. "
            "Final underwriting terms subject to medical and bureau verification."
        ),
    )


@router.get(
    "/policies",
    response_model=list[PolicySummary],
    summary="List Managed Insurance Policies",
)
async def list_policies(
    current_user: User = Depends(get_current_user),
) -> list[PolicySummary]:
    """Retrieve active and expiring insurance policies."""
    return [
        PolicySummary(
            policy_number=p["policy_number"],
            customer_name=p["customer_name"],
            product_name=p["product_name"],
            category=p["category"],
            sum_assured=p["sum_assured"],
            annual_premium=p["annual_premium"],
            status=p["status"],
            start_date=p["start_date"],
            expiry_date=p["expiry_date"],
            days_to_expiry=p["days_to_expiry"],
            renewal_eligible=p["renewal_eligible"],
        )
        for p in POLICIES_STORE
    ]


@router.post(
    "/policies/renew",
    response_model=RenewalResponse,
    summary="Process Policy Renewal",
)
async def renew_policy(
    payload: RenewalRequest,
    current_user: User = Depends(get_current_user),
) -> RenewalResponse:
    """Execute policy renewal workflow and advance expiration date."""
    for policy in POLICIES_STORE:
        if policy["policy_number"] == payload.policy_number:
            curr_expiry = date.fromisoformat(policy["expiry_date"])
            new_expiry = curr_expiry + timedelta(days=365 * payload.renew_term_years)

            policy["expiry_date"] = new_expiry.isoformat()
            policy["status"] = "ACTIVE"
            policy["days_to_expiry"] = (new_expiry - date.today()).days
            policy["renewal_eligible"] = False

            return RenewalResponse(
                policy_number=policy["policy_number"],
                status="ACTIVE",
                new_expiry_date=new_expiry.isoformat(),
                renewal_premium=policy["annual_premium"],
                message=f"Policy {policy['policy_number']} successfully renewed until {new_expiry.isoformat()}.",
            )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Policy {payload.policy_number} not found.",
    )


@router.post(
    "/policies/bind",
    response_model=PolicySummary,
    summary="Bind Coverage Contract from Approved Quotation",
)
async def bind_policy(
    payload: dict[str, Any],
    current_user: User = Depends(get_current_user),
) -> PolicySummary:
    """Bind a new policy from an accepted quotation."""
    import uuid

    product_code = payload.get("product_code", "TERM_LIFE")
    product = PRODUCTS.get(product_code, PRODUCTS["TERM_LIFE"])
    policy_num = f"POL-{date.today().year}-{product_code[:2]}-{uuid.uuid4().hex[:4].upper()}"
    sum_assured = Decimal(str(payload.get("sum_assured", product.min_sum_assured)))
    annual_premium = Decimal(str(payload.get("annual_premium", "15000.00")))
    customer_name = str(payload.get("customer_name", current_user.full_name)).strip()

    new_policy = {
        "policy_number": policy_num,
        "customer_name": customer_name,
        "product_name": product.name,
        "category": product.category,
        "sum_assured": sum_assured,
        "annual_premium": annual_premium,
        "status": "ACTIVE",
        "start_date": date.today().isoformat(),
        "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
        "days_to_expiry": 365,
        "renewal_eligible": False,
    }
    POLICIES_STORE.insert(0, new_policy)
    return PolicySummary(**new_policy)


@router.get(
    "/stats",
    summary="Get Insurance Portfolio Overview Statistics",
)
async def get_insurance_stats(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Retrieve insurance engine high-level operational metrics."""
    total_policies = len(POLICIES_STORE)
    active = sum(1 for p in POLICIES_STORE if p["status"] == "ACTIVE")
    expiring = sum(1 for p in POLICIES_STORE if p["status"] == "EXPIRING_SOON")
    total_aum = sum(p["sum_assured"] for p in POLICIES_STORE)
    annual_gwp = sum(p["annual_premium"] for p in POLICIES_STORE)

    return {
        "total_policies": total_policies,
        "active_policies": active,
        "expiring_soon_policies": expiring,
        "total_sum_assured": float(total_aum),
        "gross_written_premium": float(annual_gwp),
        "renewal_retention_rate": 94.8,
    }
