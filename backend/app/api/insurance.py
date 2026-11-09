"""FinanceFlow / FinNexus Insurance Engine Module Endpoints.

Provides:
- Phase 1 Master Data: Company Master CRUD, Plan Master CRUD, Purchase Party Management
- Live Database Dashboard & Metrics Aggregation
- Export to CSV & Excel with RBAC & Audit Trails
- Idempotent Seeder for Enterprise Providers
- Preserved Actuarial Quotation & Policy Lifecycle Endpoints
"""

from __future__ import annotations

import csv
import io
import json
import math
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, delete, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import (
    get_current_user,
    get_user_roles,
    is_admin,
    is_manager,
    require_admin_or_super_admin,
    require_manager_or_above,
)
from app.core.insurance_categories import (
    CANONICAL_CATEGORIES,
    COMPANY_TYPES,
    COMPANY_TYPE_ALLOWED_CATEGORIES,
    COMPANY_TYPE_ALLOWED_CATEGORY_CODES,
    MOTOR_PLAN_TYPES,
    categories_match,
    get_allowed_categories_for_company_type,
    get_category_aliases,
    get_motor_plan_types,
    normalize_category_code,
    normalize_category_label,
    validate_company_type_categories,
)
from app.db.models.audit import AuditLog
from app.db.models.auth import User
from app.db.models.crm import Customer

from fastapi import File, Form, Request, UploadFile
from fastapi.responses import FileResponse
from app.db.models.insurance import (
    InsuranceCompany,
    InsuranceCompanyCategory,
    InsuranceCompanyDocument,
    InsurancePlan,
    InsurancePlanBenefit,
    InsurancePlanDocument,
    InsurancePlanRider,
    InsurancePurchaseParty,
    InsuranceSubAgent,
    InsuranceCommissionSplitConfig,
    InsuranceFamilyGroup,
    InsuranceFamilyMember,
    InsurancePolicy,
    InsurancePolicyPayment,
    InsurancePremiumSchedule,
    InsurancePolicyCommission,
    InsuranceAgentInquiry,
)
from app.schemas.insurance import (
    AgentInquiryResponse,
    AgentInquiryStatusUpdate,
    CommissionSplitConfigCreate,
    CommissionSplitConfigResponse,
    FamilyGroupCreate,
    FamilyGroupResponse,
    FamilyMemberCreate,
    FamilyMemberResponse,
    InsuranceCustomerCreate,
    InsuranceCustomerResponse,
    InsuranceCustomerUpdate,
    PaymentCreate,
    PaymentResponse,
    PolicyCreate,
    PolicyImportConfirmRequest,
    PolicyImportPreviewResponse,
    PolicyImportResult,
    PolicyResponse,
    PolicyUpdate,
    PremiumScheduleResponse,
    PublicAgentProfileResponse,
    PublicInquiryCreate,
    SubAgentCreate,
    SubAgentResponse,
    SubAgentUpdate,
    PolicyCommissionResponse,
    PolicyCommissionStatusUpdate,
)
from app.services.insurance import (
    add_family_member,
    aggregate_dashboard_metrics,
    calculate_and_record_policy_commission,
    configure_commission_split,
    confirm_policy_import,
    create_customer as service_create_customer,
    create_family_group,
    create_policy as service_create_policy,
    create_sub_agent as service_create_sub_agent,
    delete_policy as service_delete_policy,
    delete_sub_agent as service_delete_sub_agent,
    generate_import_template,
    generate_purchase_parties_pdf,
    get_commission_reports,
    get_customer_by_id,
    get_document_for_download,
    get_family_group_detail,
    get_policy_detail,
    get_policy_lookup_data,
    get_public_agent_profile,
    get_sub_agent_detail,
    get_upcoming_expiries,
    list_agent_inquiries,
    list_agent_splits,
    list_commissions,
    list_customers as service_list_customers,
    list_family_groups,
    list_policies as service_list_policies,
    list_policy_payments,
    list_premium_schedules,
    list_sub_agents,
    preview_policy_import,
    record_payment,
    remove_family_member,
    submit_public_inquiry,
    update_commission_status,
    update_customer as service_update_customer,
    update_inquiry_status,
    update_policy as service_update_policy,
    update_sub_agent as service_update_sub_agent,
    upload_customer_kyc_document,
)

from app.db.seed_insurance import seed_insurance_master_data
from app.db.session import get_db_session
from app.schemas.insurance import (
    CompanyCreate,
    CompanyResponse,
    CompanyDocumentResponse,
    CompanyUpdate,
    CompanySupportedCategoriesResponse,
    CompanySupportedCategoriesUpdate,
    CompanyTypeRulesResponse,
    InsuranceDashboardMetrics,
    InsuranceDashboardStats,
    InsuranceProduct,
    PaginatedResponse,
    PlanCreate,
    PlanResponse,
    PlanRiderResponse,
    PlanBenefitResponse,
    PlanDocumentResponse,
    PlanDocumentUpdate,
    PlanUpdate,
    PolicySummary,
    PurchasePartyCreate,
    PurchasePartyResponse,
    PurchasePartyUpdate,
    QuoteCalculationRequest,
    QuoteCalculationResponse,
    RenewalRequest,
    RenewalResponse,
)

router = APIRouter(prefix="/insurance", tags=["Insurance Engine"])

from pathlib import Path
import hashlib
import shutil

COMPANY_STORAGE_DIR = Path("storage/company_documents").resolve()
COMPANY_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

PLAN_STORAGE_DIR = Path("storage/plan_documents").resolve()
PLAN_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_DOC_MIMES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/msword": ".doc",
}
MAX_DOC_SIZE = 15 * 1024 * 1024  # 15MB

ALLOWED_PLAN_DOC_MIMES = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "image/jpeg": ".jpg",
    "image/pjpeg": ".jpg",
    "image/png": ".png",
}
ALLOWED_PLAN_DOC_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"
}
MAX_PLAN_DOC_SIZE = 25 * 1024 * 1024  # 25MB

PLAN_DOCUMENT_TYPES = [
    "Policy Brochure",
    "Policy Wording",
    "Prospectus",
    "Claim Form",
    "Coverage Details",
    "Terms & Conditions",
    "Rider / Add-on Document",
    "Premium Chart",
    "Proposal Form",
    "Other Documents",
]

DOC_TYPE_MAP = {
    "POLICY_BROCHURE": "Policy Brochure",
    "POLICY_WORDING": "Policy Wording",
    "PROSPECTUS": "Prospectus",
    "CLAIM_FORM": "Claim Form",
    "COVERAGE_DETAILS": "Coverage Details",
    "TERMS_AND_CONDITIONS": "Terms & Conditions",
    "TERMS_CONDITIONS": "Terms & Conditions",
    "RIDER_DOCUMENT": "Rider / Add-on Document",
    "RIDER_ADD_ON_DOCUMENT": "Rider / Add-on Document",
    "PREMIUM_CHART": "Premium Chart",
    "PROPOSAL_FORM": "Proposal Form",
    "OTHER": "Other Documents",
    "OTHER_DOCUMENTS": "Other Documents",
}


def _normalize_plan_doc_type(dt: str | None) -> str:
    if not dt:
        return "Policy Brochure"
    clean = dt.strip()
    if clean in DOC_TYPE_MAP:
        return DOC_TYPE_MAP[clean]
    clean_upper = clean.upper().replace(" ", "_").replace("&", "AND").replace("/", "_")
    if clean_upper in DOC_TYPE_MAP:
        return DOC_TYPE_MAP[clean_upper]
    for std in PLAN_DOCUMENT_TYPES:
        if std.lower() == clean.lower():
            return std
    return clean



import re


def _normalize_rider_items(riders_raw: Any) -> list[dict[str, str | None]]:
    if not riders_raw:
        return []
    items: list[dict[str, str | None]] = []
    seen = set()
    if isinstance(riders_raw, str):
        val = riders_raw.strip()
        if val.startswith("[") and val.endswith("]"):
            try:
                parsed = json.loads(val)
                return _normalize_rider_items(parsed)
            except Exception:
                pass
        lines = [x.strip() for x in re.split(r"[\r\n,]+", val) if x.strip()]
        for l in lines:
            if l.lower() not in seen:
                seen.add(l.lower())
                items.append({"name": l, "description": None})
    elif isinstance(riders_raw, list):
        for item in riders_raw:
            if isinstance(item, str):
                name = item.strip()
                if name and name.lower() not in seen:
                    seen.add(name.lower())
                    items.append({"name": name, "description": None})
            elif isinstance(item, dict):
                name = (item.get("name") or "").strip()
                desc = item.get("description")
                if desc and isinstance(desc, str):
                    desc = desc.strip() or None
                if name and name.lower() not in seen:
                    seen.add(name.lower())
                    items.append({"name": name, "description": desc})
            elif hasattr(item, "name"):
                name = (getattr(item, "name", "") or "").strip()
                desc = getattr(item, "description", None)
                if desc and isinstance(desc, str):
                    desc = desc.strip() or None
                if name and name.lower() not in seen:
                    seen.add(name.lower())
                    items.append({"name": name, "description": desc})
    return items


def _normalize_benefit_items(benefits_raw: Any) -> list[dict[str, str | None]]:
    if not benefits_raw:
        return []
    items: list[dict[str, str | None]] = []
    seen = set()
    if isinstance(benefits_raw, str):
        val = benefits_raw.strip()
        if val.startswith("[") and val.endswith("]"):
            try:
                parsed = json.loads(val)
                return _normalize_benefit_items(parsed)
            except Exception:
                pass
        lines = [x.strip() for x in re.split(r"[\r\n]+", val) if x.strip()]
        for l in lines:
            if l.lower() not in seen:
                seen.add(l.lower())
                items.append({"name": l, "description": None})
    elif isinstance(benefits_raw, list):
        for item in benefits_raw:
            if isinstance(item, str):
                name = item.strip()
                if name and name.lower() not in seen:
                    seen.add(name.lower())
                    items.append({"name": name, "description": None})
            elif isinstance(item, dict):
                name = (item.get("name") or "").strip()
                desc = item.get("description")
                if desc and isinstance(desc, str):
                    desc = desc.strip() or None
                if name and name.lower() not in seen:
                    seen.add(name.lower())
                    items.append({"name": name, "description": desc})
            elif hasattr(item, "name"):
                name = (getattr(item, "name", "") or "").strip()
                desc = getattr(item, "description", None)
                if desc and isinstance(desc, str):
                    desc = desc.strip() or None
                if name and name.lower() not in seen:
                    seen.add(name.lower())
                    items.append({"name": name, "description": desc})
    return items


def _serialize_text_or_json(val: Any) -> str | None:
    if val is None:
        return None
    if isinstance(val, (list, dict)):
        return json.dumps(val)
    if isinstance(val, str):
        return val.strip() if val.strip() else None
    return str(val)


from app.api.insurance_routers.customers import router as customers_router
from app.api.insurance_routers.sub_agents import router as sub_agents_router
from app.api.insurance_routers.family_groups import router as family_groups_router
from app.api.insurance_routers.policies import router as policies_router
from app.api.insurance_routers.payments import router as payments_router
from app.api.insurance_routers.schedules import router as schedules_router
from app.api.insurance_routers.commissions import router as commissions_router
from app.api.insurance_routers.imports import router as imports_router
from app.api.insurance_routers.leads import router as leads_router
from app.api.insurance_routers.quotations import router as quotations_router

router.include_router(customers_router)
router.include_router(sub_agents_router)
router.include_router(family_groups_router)
router.include_router(policies_router)
router.include_router(payments_router)
router.include_router(schedules_router)
router.include_router(commissions_router)
router.include_router(imports_router)
router.include_router(leads_router)
router.include_router(quotations_router)


# ---------------------------------------------------------------------------
# Static enterprise product catalog (Preserved for Actuarial Calculator)
# ---------------------------------------------------------------------------
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


POLICIES_STORE: list[dict] = _init_policies_store()


# ===========================================================================
# A. DASHBOARD & OPERATIONAL METRICS
# ===========================================================================


@router.get(
    "/dashboard/stats",
    response_model=InsuranceDashboardStats,
    summary="Get Insurance Dashboard Metrics from Live Database",
)
async def get_insurance_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> InsuranceDashboardStats:
    """Calculate dashboard metrics from live PostgreSQL database records.

    Until policy and premium modules are implemented (Phase 2), those metric
    cards return None / unavailable rather than hardcoded mock figures.
    """
    # 1. Total Customers from CRM
    total_customers_stmt = select(func.count(Customer.id))
    total_customers = (await session.execute(total_customers_stmt)).scalar() or 0

    # 2. Master Data Counts
    total_companies_stmt = select(func.count(InsuranceCompany.id))
    total_companies = (await session.execute(total_companies_stmt)).scalar() or 0

    active_companies_stmt = select(func.count(InsuranceCompany.id)).where(
        InsuranceCompany.is_active.is_(True)
    )
    active_companies = (await session.execute(active_companies_stmt)).scalar() or 0

    total_plans_stmt = select(func.count(InsurancePlan.id))
    total_plans = (await session.execute(total_plans_stmt)).scalar() or 0

    active_plans_stmt = select(func.count(InsurancePlan.id)).where(
        InsurancePlan.status == "ACTIVE"
    )
    active_plans = (await session.execute(active_plans_stmt)).scalar() or 0

    total_parties_stmt = select(func.count(InsurancePurchaseParty.id))
    total_parties = (await session.execute(total_parties_stmt)).scalar() or 0

    active_parties_stmt = select(func.count(InsurancePurchaseParty.id)).where(
        InsurancePurchaseParty.is_active.is_(True)
    )
    active_parties = (await session.execute(active_parties_stmt)).scalar() or 0

    return InsuranceDashboardStats(
        total_customers=total_customers,
        total_policies=None,  # Unavailable / not yet implemented
        upcoming_premium_dues=None,  # Unavailable / not yet implemented
        premiums_due_today=None,  # Unavailable / not yet implemented
        overdue_premiums=None,  # Unavailable / not yet implemented
        upcoming_policy_expiries=None,  # Unavailable / not yet implemented
        policies_expired=None,  # Unavailable / not yet implemented
        total_companies=total_companies,
        active_companies=active_companies,
        total_plans=total_plans,
        active_plans=active_plans,
        total_purchase_parties=total_parties,
        active_purchase_parties=active_parties,
        module_status={
            "policies": "unavailable",
            "premiums": "unavailable",
            "master_data": "active",
        },
    )


@router.get(
    "/dashboard/metrics",
    response_model=InsuranceDashboardMetrics,
    summary="Get Comprehensive Live Database Metrics for Dashboard",
)
async def get_dashboard_metrics_endpoint(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> InsuranceDashboardMetrics:
    """Retrieve complete live portfolio cards, upcoming dues, overdue premiums, expiries, and utility bar."""
    return await aggregate_dashboard_metrics(session)


# ===========================================================================
# B. COMPANY MASTER (Add / Manage Company)
# ===========================================================================


def _generate_company_code(name: str) -> str:
    """Generate deterministic or random unique company code."""
    cleaned = "".join(ch for ch in name.upper() if ch.isalnum() or ch == " ")
    parts = cleaned.split()
    if len(parts) >= 2:
        prefix = "".join(p[:3] for p in parts[:2])
    elif len(parts) == 1:
        prefix = parts[0][:5]
    else:
        prefix = "CMP"
    suffix = uuid.uuid4().hex[:4].upper()
    return f"{prefix}-{suffix}"


async def _check_company_supports_category(
    session: AsyncSession,
    company: InsuranceCompany,
    category_label: str,
) -> bool:
    """Check if an insurance company supports a given insurance category."""
    canonical_lob = normalize_category_label(category_label)

    # Check active company_categories
    cat_rows = (
        await session.execute(
            select(InsuranceCompanyCategory.category).where(
                InsuranceCompanyCategory.company_id == company.id,
                InsuranceCompanyCategory.is_active.is_(True),
            )
        )
    ).scalars().all()

    if cat_rows:
        if any(categories_match(sc, canonical_lob) for sc in cat_rows):
            return True

    # Check legacy category field
    if categories_match(company.category, canonical_lob):
        return True

    # Check company_type compatibility rules
    if company.company_type:
        allowed = COMPANY_TYPE_ALLOWED_CATEGORY_CODES.get(company.company_type, [])
        if normalize_category_code(canonical_lob) in allowed:
            return True

    return False


async def _get_company_supported_categories(
    session: AsyncSession,
    company: InsuranceCompany,
) -> list[str]:
    """Retrieve distinct user-facing supported category labels for a company."""
    cat_rows = (
        await session.execute(
            select(InsuranceCompanyCategory.category).where(
                InsuranceCompanyCategory.company_id == company.id,
                InsuranceCompanyCategory.is_active.is_(True),
            )
        )
    ).scalars().all()

    seen = set()
    supported = []
    for c in cat_rows:
        code = normalize_category_code(c)
        lbl = normalize_category_label(c)
        if code not in seen and lbl not in ("Composite Insurance", "General Insurance", "Other General Insurance"):
            seen.add(code)
            supported.append(lbl)
    if not supported and company.category:
        lbl = normalize_category_label(company.category)
        if lbl:
            supported.append(lbl)
    if not supported:
        supported = ["General Insurance"]
    return supported


async def _get_company_category_plans_count(
    session: AsyncSession,
    company_id: uuid.UUID,
) -> dict[str, int]:
    """Calculate plan counts grouped by canonical insurance category."""
    plans = (
        await session.execute(
            select(InsurancePlan.line_of_business).where(InsurancePlan.company_id == company_id)
        )
    ).scalars().all()
    counts: dict[str, int] = {}
    for lob in plans:
        lbl = normalize_category_label(lob)
        counts[lbl] = counts.get(lbl, 0) + 1
    return counts


@router.get(
    "/companies",
    response_model=PaginatedResponse[CompanyResponse],
    summary="List Insurance Companies (Paginated & Filterable)",
)
async def list_companies(
    search: str | None = Query(default=None, description="Search by name or code"),
    category: str | None = Query(default=None, description="Filter by category"),
    company_type: str | None = Query(default=None, description="Filter by legal company classification type"),
    status_filter: str | None = Query(
        default=None, alias="status", description="Filter by active/inactive"
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=500),
    sort_by: str = Query(default="name", description="name, code, category, company_type, is_active, created_at"),
    sort_order: str = Query(default="asc", description="asc or desc"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[CompanyResponse]:
    """Search and paginate Company Master records with live plan association counts and supported categories."""
    # Base count subquery for plans
    plan_count_subq = (
        select(
            InsurancePlan.company_id,
            func.count(InsurancePlan.id).label("plans_count"),
        )
        .group_by(InsurancePlan.company_id)
        .subquery()
    )

    query = (
        select(
            InsuranceCompany,
            func.coalesce(plan_count_subq.c.plans_count, 0).label("plans_count"),
        )
        .options(
            selectinload(InsuranceCompany.documents),
            selectinload(InsuranceCompany.plans),
            selectinload(InsuranceCompany.company_categories),
        )
        .outerjoin(plan_count_subq, InsuranceCompany.id == plan_count_subq.c.company_id)
    )

    count_query = select(func.count(InsuranceCompany.id))

    # Apply Filters
    if search:
        pattern = f"%{search.strip().lower()}%"
        flt = or_(
            func.lower(InsuranceCompany.name).like(pattern),
            func.lower(InsuranceCompany.code).like(pattern),
        )
        query = query.where(flt)
        count_query = count_query.where(flt)

    if category and category != "ALL":
        aliases = get_category_aliases(category)
        cat_flt = or_(
            func.upper(InsuranceCompany.category).in_(aliases),
            InsuranceCompany.company_categories.any(
                and_(
                    func.upper(InsuranceCompanyCategory.category).in_(aliases),
                    InsuranceCompanyCategory.is_active.is_(True),
                )
            ),
        )
        query = query.where(cat_flt)
        count_query = count_query.where(cat_flt)

    if company_type and company_type != "ALL":
        query = query.where(InsuranceCompany.company_type == company_type)
        count_query = count_query.where(InsuranceCompany.company_type == company_type)

    if status_filter and status_filter != "ALL":
        is_active_val = status_filter.lower() in ("active", "true", "1")
        query = query.where(InsuranceCompany.is_active.is_(is_active_val))
        count_query = count_query.where(InsuranceCompany.is_active.is_(is_active_val))

    # Total Count
    total = (await session.execute(count_query)).scalar() or 0

    # Sorting
    sort_column = getattr(InsuranceCompany, sort_by, InsuranceCompany.name)
    if sort_order.lower() == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(sort_column)

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    results = (await session.execute(query)).all()

    items = []
    for comp, p_count in results:
        active_cats = [
            c.category for c in getattr(comp, "company_categories", []) if getattr(c, "is_active", True)
        ]
        seen = set()
        supported = []
        for c in active_cats:
            lbl = normalize_category_label(c)
            if lbl not in seen and lbl not in ("Composite Insurance", "General Insurance", "Other General Insurance"):
                seen.add(lbl)
                supported.append(lbl)
        if not supported and comp.category:
            supported = [normalize_category_label(comp.category)]
        if not supported:
            supported = ["General Insurance"]

        cat_counts: dict[str, int] = {}
        act_cnt = 0
        for p in getattr(comp, "plans", []):
            if p.status == "ACTIVE":
                act_cnt += 1
            plob = normalize_category_label(p.line_of_business)
            cat_counts[plob] = cat_counts.get(plob, 0) + 1

        resp = CompanyResponse.model_validate(comp)
        resp.plans_count = p_count
        resp.active_plans_count = act_cnt
        resp.company_type = comp.company_type or "General Insurance"
        resp.supported_categories = supported
        resp.category_plans_count = cat_counts
        items.append(resp)

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/companies/{company_id}",
    response_model=CompanyResponse,
    summary="Get Company Master Detail",
)
async def get_company_detail(
    company_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CompanyResponse:
    """Retrieve details for a single insurance company with multi-category plan breakdown."""
    stmt = (
        select(
            InsuranceCompany,
            func.count(InsurancePlan.id).label("plans_count"),
        )
        .options(
            selectinload(InsuranceCompany.documents),
            selectinload(InsuranceCompany.company_categories),
        )
        .outerjoin(InsurancePlan, InsuranceCompany.id == InsurancePlan.company_id)
        .where(InsuranceCompany.id == company_id)
        .group_by(InsuranceCompany.id)
    )
    res = (await session.execute(stmt)).first()
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insurance Company with ID '{company_id}' not found.",
        )
    comp, p_count = res
    supported = await _get_company_supported_categories(session, comp)
    cat_counts = await _get_company_category_plans_count(session, comp.id)

    resp = CompanyResponse.model_validate(comp)
    resp.agent_direct_mobile = comp.agent_contact_number
    resp.plans_count = p_count
    resp.documents = [CompanyDocumentResponse.model_validate(d) for d in getattr(comp, "documents", [])]
    resp.documents_count = len(resp.documents)
    resp.company_type = comp.company_type or "General Insurance"
    resp.supported_categories = supported
    resp.category_plans_count = cat_counts

    # Load all company plans with document counts
    plans_stmt = (
        select(InsurancePlan)
        .options(selectinload(InsurancePlan.documents))
        .where(InsurancePlan.company_id == company_id)
        .order_by(InsurancePlan.name)
    )
    plans_res = (await session.execute(plans_stmt)).scalars().all()
    plans_list = []
    active_cnt = 0
    for p in plans_res:
        pr = PlanResponse.model_validate(p)
        pr.company_name = comp.name
        pr.company_code = comp.code
        pr.documents_count = len(p.documents) if p.documents else 0
        if p.status == "ACTIVE":
            active_cnt += 1
        plans_list.append(pr)
    resp.plans = plans_list
    resp.plans_count = len(plans_list)
    resp.active_plans_count = active_cnt
    return resp


@router.post(
    "/companies",
    response_model=CompanyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Insurance Company (Company Master)",
)
async def create_company(
    payload: CompanyCreate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> CompanyResponse:
    """Create a new insurance company with unique code, classification, and multi-category support."""
    name_clean = payload.name.strip()
    code_clean = (
        payload.code.strip().upper()
        if payload.code and payload.code.strip()
        else _generate_company_code(name_clean)
    )

    # 1. Check duplicate code
    stmt_code = select(InsuranceCompany).where(
        func.lower(InsuranceCompany.code) == code_clean.lower()
    )
    if (await session.execute(stmt_code)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Company code '{code_clean}' is already registered. Please specify a unique code.",
        )

    # 2. Check duplicate active name
    stmt_name = select(InsuranceCompany).where(
        func.lower(InsuranceCompany.name) == name_clean.lower(),
        InsuranceCompany.is_active.is_(True),
    )
    if (await session.execute(stmt_name)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An active insurance company named '{name_clean}' already exists.",
        )

    # Company classification & categories
    c_type = payload.company_type.strip() if payload.company_type else "General Insurance"
    if c_type not in COMPANY_TYPES:
        c_type = "General Insurance"

    raw_categories = payload.supported_categories or []
    if not raw_categories and getattr(payload, "category", None):
        raw_categories = [payload.category]
    if not raw_categories:
        raw_categories = get_allowed_categories_for_company_type(c_type)

    canonical_labels = []
    seen = set()
    for cat in raw_categories:
        lbl = normalize_category_label(cat)
        if lbl not in seen and lbl not in ("Composite Insurance", "General Insurance", "Other General Insurance"):
            seen.add(lbl)
            canonical_labels.append(lbl)
    if not canonical_labels:
        canonical_labels = ["Other General Insurance"]

    # Validate against Company Type compatibility rules (Phase 2.C)
    is_admin_user = getattr(current_user, "role", None) in ("SUPER_ADMIN", "ADMIN")
    override = bool(getattr(payload, "override_compatibility", False)) and is_admin_user
    valid, err_msg = validate_company_type_categories(c_type, canonical_labels, is_super_admin=override)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg,
        )

    now = datetime.now(UTC)
    primary_category = canonical_labels[0]
    new_company = InsuranceCompany(
        id=uuid.uuid4(),
        name=name_clean,
        code=code_clean,
        company_type=c_type,
        category=primary_category,
        is_active=payload.is_active,
        contact_person=payload.contact_person.strip() if payload.contact_person else None,
        email=payload.email.strip() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        address=payload.address.strip() if payload.address else None,
        notes=payload.notes.strip() if payload.notes else None,
        agent_name=payload.agent_name.strip() if payload.agent_name else None,
        agent_contact_number=(payload.agent_contact_number or getattr(payload, "agent_direct_mobile", None) or "").strip() or None,
        agent_code=payload.agent_code.strip() if payload.agent_code else None,
        agent_email=payload.agent_email.strip() if payload.agent_email else None,
        tieup_date=payload.tieup_date,
        tieup_renewal_date=payload.tieup_renewal_date,
        renewal_team_contact=payload.renewal_team_contact.strip() if payload.renewal_team_contact else None,
        renewal_contact_person=payload.renewal_contact_person.strip() if payload.renewal_contact_person else None,
        renewal_contact_mobile=payload.renewal_contact_mobile.strip() if payload.renewal_contact_mobile else None,
        renewal_contact_email=payload.renewal_contact_email.strip() if payload.renewal_contact_email else None,
        claims_team_contact=payload.claims_team_contact.strip() if payload.claims_team_contact else None,
        claims_contact_person=payload.claims_contact_person.strip() if payload.claims_contact_person else None,
        claims_contact_mobile=payload.claims_contact_mobile.strip() if payload.claims_contact_mobile else None,
        claims_contact_email=payload.claims_contact_email.strip() if payload.claims_contact_email else None,
        kam_name=payload.kam_name.strip() if payload.kam_name else None,
        kam_mobile=payload.kam_mobile.strip() if payload.kam_mobile else None,
        kam_email=payload.kam_email.strip() if payload.kam_email else None,
        website=payload.website.strip() if payload.website else None,
        created_at=now,
        updated_at=now,
    )
    session.add(new_company)

    # Synchronize category links
    for cat_lbl in canonical_labels:
        cat_code = normalize_category_code(cat_lbl)
        session.add(InsuranceCompanyCategory(
            id=uuid.uuid4(),
            company_id=new_company.id,
            category=cat_lbl,
            is_active=True,
            created_at=now,
        ))
        session.add(InsuranceCompanyCategory(
            id=uuid.uuid4(),
            company_id=new_company.id,
            category=cat_code,
            is_active=True,
            created_at=now,
        ))

    # Audit Trail
    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="INSURANCE_COMPANY_CREATED",
        resource_type="insurance_company",
        resource_id=new_company.id,
        state_delta={
            "name": new_company.name,
            "code": new_company.code,
            "company_type": new_company.company_type,
            "category": new_company.category,
            "supported_categories": canonical_labels,
        },
        created_at=now,
    )
    session.add(audit)
    await session.commit()

    stmt = (
        select(InsuranceCompany)
        .options(
            selectinload(InsuranceCompany.documents),
            selectinload(InsuranceCompany.plans),
            selectinload(InsuranceCompany.company_categories),
        )
        .where(InsuranceCompany.id == new_company.id)
    )
    new_company = (await session.execute(stmt)).scalar_one()

    resp = CompanyResponse.model_validate(new_company)
    resp.agent_direct_mobile = new_company.agent_contact_number
    resp.plans_count = 0
    resp.active_plans_count = 0
    resp.company_type = new_company.company_type
    resp.supported_categories = canonical_labels
    resp.category_plans_count = {}
    return resp


@router.put(
    "/companies/{company_id}",
    response_model=CompanyResponse,
    summary="Update Insurance Company",
)
async def update_company(
    company_id: uuid.UUID,
    payload: CompanyUpdate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> CompanyResponse:
    """Update company details, classification, and supported categories with dependency protection."""
    stmt = (
        select(InsuranceCompany)
        .options(
            selectinload(InsuranceCompany.company_categories),
            selectinload(InsuranceCompany.plans),
        )
        .where(InsuranceCompany.id == company_id)
    )
    company = (await session.execute(stmt)).scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insurance Company with ID '{company_id}' not found.",
        )

    delta: dict[str, Any] = {}

    if payload.name is not None:
        name_clean = payload.name.strip()
        if name_clean != company.name:
            check_name = select(InsuranceCompany).where(
                func.lower(InsuranceCompany.name) == name_clean.lower(),
                InsuranceCompany.id != company_id,
                InsuranceCompany.is_active.is_(True),
            )
            if (await session.execute(check_name)).scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"An active insurance company named '{name_clean}' already exists.",
                )
            delta["name"] = {"from": company.name, "to": name_clean}
            company.name = name_clean

    if payload.code is not None:
        code_clean = payload.code.strip().upper()
        if code_clean != company.code:
            check_code = select(InsuranceCompany).where(
                func.lower(InsuranceCompany.code) == code_clean.lower(),
                InsuranceCompany.id != company_id,
            )
            if (await session.execute(check_code)).scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Company code '{code_clean}' is already assigned to another carrier.",
                )
            delta["code"] = {"from": company.code, "to": code_clean}
            company.code = code_clean

    if payload.company_type is not None:
        c_type = payload.company_type.strip()
        if c_type in COMPANY_TYPES:
            delta["company_type"] = {"from": company.company_type, "to": c_type}
            company.company_type = c_type

    # Supported categories update
    if payload.supported_categories is not None or payload.category is not None:
        raw_cats = payload.supported_categories if payload.supported_categories is not None else [payload.category]
        canonical_labels = []
        seen = set()
        for cat in raw_cats:
            lbl = normalize_category_label(cat)
            if lbl not in seen and lbl not in ("Composite Insurance", "General Insurance", "Other General Insurance"):
                seen.add(lbl)
                canonical_labels.append(lbl)
        if not canonical_labels:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one supported insurance category is required.",
            )

        target_c_type = payload.company_type or company.company_type or "General Insurance"
        is_admin_user = getattr(current_user, "role", None) in ("SUPER_ADMIN", "ADMIN")
        override = bool(getattr(payload, "override_compatibility", False)) and is_admin_user
        valid, err_msg = validate_company_type_categories(target_c_type, canonical_labels, is_super_admin=override)
        if not valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err_msg,
            )

        # Active plans dependency check:
        # Check if any active plan would be orphaned under removed categories
        existing_plans_stmt = select(InsurancePlan).where(
            InsurancePlan.company_id == company_id,
            InsurancePlan.status == "ACTIVE",
        )
        existing_plans = (await session.execute(existing_plans_stmt)).scalars().all()
        incompatible_plans = []
        for p in existing_plans:
            p_lob = normalize_category_label(p.line_of_business)
            if not any(categories_match(p_lob, cl) for cl in canonical_labels):
                incompatible_plans.append(p)

        if incompatible_plans:
            plan_names = ", ".join(f"'{p.name}' ({p.line_of_business})" for p in incompatible_plans[:5])
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot remove supported category. Company has {len(incompatible_plans)} active plan(s) under removed category: {plan_names}. Deactivate or reassign these plans first.",
            )

        target_tokens = set()
        for lbl in canonical_labels:
            target_tokens.add(lbl.upper())
            target_tokens.add(normalize_category_code(lbl).upper())

        for cat_row in company.company_categories:
            if cat_row.category.upper() in target_tokens:
                cat_row.is_active = True
            else:
                cat_row.is_active = False

        existing_cat_strings = {c.category.upper() for c in company.company_categories}
        now = datetime.now(UTC)
        for lbl in canonical_labels:
            if lbl.upper() not in existing_cat_strings:
                session.add(InsuranceCompanyCategory(
                    id=uuid.uuid4(),
                    company_id=company_id,
                    category=lbl,
                    is_active=True,
                    created_at=now,
                ))
            code = normalize_category_code(lbl)
            if code.upper() not in existing_cat_strings:
                session.add(InsuranceCompanyCategory(
                    id=uuid.uuid4(),
                    company_id=company_id,
                    category=code,
                    is_active=True,
                    created_at=now,
                ))

        company.category = canonical_labels[0]
        delta["supported_categories"] = {"to": canonical_labels}

    if payload.is_active is not None:
        delta["is_active"] = {"from": company.is_active, "to": payload.is_active}
        company.is_active = payload.is_active

    if payload.contact_person is not None:
        company.contact_person = payload.contact_person.strip() if payload.contact_person else None
    if payload.email is not None:
        company.email = payload.email.strip() if payload.email else None
    if payload.phone is not None:
        company.phone = payload.phone.strip() if payload.phone else None
    if payload.address is not None:
        company.address = payload.address.strip() if payload.address else None
    if payload.notes is not None:
        company.notes = payload.notes.strip() if payload.notes else None

    if payload.agent_name is not None:
        company.agent_name = payload.agent_name.strip() if payload.agent_name else None
    if payload.agent_contact_number is not None or getattr(payload, "agent_direct_mobile", None) is not None:
        agent_mob = payload.agent_contact_number if payload.agent_contact_number is not None else getattr(payload, "agent_direct_mobile", None)
        company.agent_contact_number = agent_mob.strip() if agent_mob else None
    if payload.agent_code is not None:
        company.agent_code = payload.agent_code.strip() if payload.agent_code else None
    if payload.agent_email is not None:
        company.agent_email = payload.agent_email.strip() if payload.agent_email else None
    if payload.tieup_date is not None:
        company.tieup_date = payload.tieup_date
    if payload.tieup_renewal_date is not None:
        company.tieup_renewal_date = payload.tieup_renewal_date
    if payload.renewal_team_contact is not None:
        company.renewal_team_contact = payload.renewal_team_contact.strip() if payload.renewal_team_contact else None
    if payload.renewal_contact_person is not None:
        company.renewal_contact_person = payload.renewal_contact_person.strip() if payload.renewal_contact_person else None
    if payload.renewal_contact_mobile is not None:
        company.renewal_contact_mobile = payload.renewal_contact_mobile.strip() if payload.renewal_contact_mobile else None
    if payload.renewal_contact_email is not None:
        company.renewal_contact_email = payload.renewal_contact_email.strip() if payload.renewal_contact_email else None
    if payload.claims_team_contact is not None:
        company.claims_team_contact = payload.claims_team_contact.strip() if payload.claims_team_contact else None
    if payload.claims_contact_person is not None:
        company.claims_contact_person = payload.claims_contact_person.strip() if payload.claims_contact_person else None
    if payload.claims_contact_mobile is not None:
        company.claims_contact_mobile = payload.claims_contact_mobile.strip() if payload.claims_contact_mobile else None
    if payload.claims_contact_email is not None:
        company.claims_contact_email = payload.claims_contact_email.strip() if payload.claims_contact_email else None
    if payload.kam_name is not None:
        company.kam_name = payload.kam_name.strip() if payload.kam_name else None
    if payload.kam_mobile is not None:
        company.kam_mobile = payload.kam_mobile.strip() if payload.kam_mobile else None
    if payload.kam_email is not None:
        company.kam_email = payload.kam_email.strip() if payload.kam_email else None
    if payload.website is not None:
        company.website = payload.website.strip() if payload.website else None

    company.updated_at = datetime.now(UTC)

    if delta:
        audit = AuditLog(
            id=uuid.uuid4(),
            actor_id=current_user.id,
            action="INSURANCE_COMPANY_UPDATED",
            resource_type="insurance_company",
            resource_id=company.id,
            state_delta=delta,
            created_at=datetime.now(UTC),
        )
        session.add(audit)

    await session.commit()
    stmt = (
        select(InsuranceCompany)
        .options(
            selectinload(InsuranceCompany.documents),
            selectinload(InsuranceCompany.plans),
            selectinload(InsuranceCompany.company_categories),
        )
        .where(InsuranceCompany.id == company.id)
    )
    company = (await session.execute(stmt)).scalar_one()

    # Count plans
    p_count = (
        await session.execute(
            select(func.count(InsurancePlan.id)).where(
                InsurancePlan.company_id == company.id
            )
        )
    ).scalar() or 0

    supported = await _get_company_supported_categories(session, company)
    cat_counts = await _get_company_category_plans_count(session, company.id)

    resp = CompanyResponse.model_validate(company)
    resp.agent_direct_mobile = company.agent_contact_number
    resp.plans_count = p_count
    resp.active_plans_count = len([p for p in company.plans if p.status == "ACTIVE"])
    resp.company_type = company.company_type or "General Insurance"
    resp.supported_categories = supported
    resp.category_plans_count = cat_counts
    return resp


@router.get(
    "/companies/{company_id}/supported-categories",
    response_model=CompanySupportedCategoriesResponse,
    summary="Get Company Supported Categories and Live Plan Breakdown",
)
async def get_company_supported_categories_endpoint(
    company_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CompanySupportedCategoriesResponse:
    """Retrieve all supported categories and live plan distribution for an insurance company."""
    stmt = (
        select(InsuranceCompany)
        .options(
            selectinload(InsuranceCompany.company_categories),
            selectinload(InsuranceCompany.plans),
        )
        .where(InsuranceCompany.id == company_id)
    )
    company = (await session.execute(stmt)).scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insurance Company with ID '{company_id}' not found.",
        )
    supported = await _get_company_supported_categories(session, company)
    cat_counts = await _get_company_category_plans_count(session, company.id)
    return CompanySupportedCategoriesResponse(
        company_id=company.id,
        company_name=company.name,
        company_type=company.company_type or "General Insurance",
        supported_categories=supported,
        category_plans_count=cat_counts,
    )


@router.put(
    "/companies/{company_id}/supported-categories",
    response_model=CompanySupportedCategoriesResponse,
    summary="Update Supported Categories for Insurance Company",
)
async def update_company_supported_categories_endpoint(
    company_id: uuid.UUID,
    payload: CompanySupportedCategoriesUpdate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> CompanySupportedCategoriesResponse:
    """Update supported insurance categories with plan dependency protection."""
    stmt = (
        select(InsuranceCompany)
        .options(
            selectinload(InsuranceCompany.company_categories),
            selectinload(InsuranceCompany.plans),
        )
        .where(InsuranceCompany.id == company_id)
    )
    company = (await session.execute(stmt)).scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insurance Company with ID '{company_id}' not found.",
        )

    canonical_labels = []
    seen = set()
    for cat in payload.supported_categories:
        lbl = normalize_category_label(cat)
        if lbl not in seen and lbl not in ("Composite Insurance", "General Insurance", "Other General Insurance"):
            seen.add(lbl)
            canonical_labels.append(lbl)

    if not canonical_labels:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one supported insurance category is required.",
        )

    target_c_type = company.company_type or "General Insurance"
    is_admin_user = getattr(current_user, "role", None) in ("SUPER_ADMIN", "ADMIN")
    override = bool(payload.override_compatibility) and is_admin_user
    valid, err_msg = validate_company_type_categories(target_c_type, canonical_labels, is_super_admin=override)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg,
        )

    # Active plans dependency check
    existing_plans_stmt = select(InsurancePlan).where(
        InsurancePlan.company_id == company_id,
        InsurancePlan.status == "ACTIVE",
    )
    existing_plans = (await session.execute(existing_plans_stmt)).scalars().all()
    incompatible_plans = []
    for p in existing_plans:
        p_lob = normalize_category_label(p.line_of_business)
        if not any(categories_match(p_lob, cl) for cl in canonical_labels):
            incompatible_plans.append(p)

    if incompatible_plans:
        plan_names = ", ".join(f"'{p.name}' ({p.line_of_business})" for p in incompatible_plans[:5])
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot remove supported category. Company has {len(incompatible_plans)} active plan(s) under removed category: {plan_names}. Deactivate or reassign these plans first.",
        )

    target_tokens = set()
    for lbl in canonical_labels:
        target_tokens.add(lbl.upper())
        target_tokens.add(normalize_category_code(lbl).upper())

    for cat_row in company.company_categories:
        if cat_row.category.upper() in target_tokens:
            cat_row.is_active = True
        else:
            cat_row.is_active = False

    existing_cat_strings = {c.category.upper() for c in company.company_categories}
    now = datetime.now(UTC)
    for lbl in canonical_labels:
        if lbl.upper() not in existing_cat_strings:
            session.add(InsuranceCompanyCategory(
                id=uuid.uuid4(),
                company_id=company_id,
                category=lbl,
                is_active=True,
                created_at=now,
            ))
        code = normalize_category_code(lbl)
        if code.upper() not in existing_cat_strings:
            session.add(InsuranceCompanyCategory(
                id=uuid.uuid4(),
                company_id=company_id,
                category=code,
                is_active=True,
                created_at=now,
            ))

    company.category = canonical_labels[0]
    company.updated_at = now
    await session.commit()

    cat_counts = await _get_company_category_plans_count(session, company.id)
    return CompanySupportedCategoriesResponse(
        company_id=company.id,
        company_name=company.name,
        company_type=company.company_type or "General Insurance",
        supported_categories=canonical_labels,
        category_plans_count=cat_counts,
    )


@router.get(
    "/company-types",
    summary="Get Company Classification Types and Allowed Categories",
)
async def get_company_types_endpoint(
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Retrieve legal company classifications and their default allowed categories."""
    return {
        "company_types": COMPANY_TYPES,
        "rules": COMPANY_TYPE_ALLOWED_CATEGORIES,
        "default_categories": COMPANY_TYPE_ALLOWED_CATEGORIES,
        "motor_plan_types": MOTOR_PLAN_TYPES,
    }


@router.patch(
    "/companies/{company_id}/status",
    response_model=CompanyResponse,
    summary="Activate or Deactivate Insurance Company",
)
async def toggle_company_status(
    company_id: uuid.UUID,
    is_active: bool = Query(..., description="Target active state"),
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> CompanyResponse:
    """Safely activate or deactivate an insurance company without destructive deletion."""
    stmt = select(InsuranceCompany).where(InsuranceCompany.id == company_id)
    company = (await session.execute(stmt)).scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insurance Company with ID '{company_id}' not found.",
        )

    old_status = company.is_active
    company.is_active = is_active
    company.updated_at = datetime.now(UTC)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="INSURANCE_COMPANY_STATUS_CHANGED",
        resource_type="insurance_company",
        resource_id=company.id,
        state_delta={"is_active": {"from": old_status, "to": is_active}},
        created_at=datetime.now(UTC),
    )
    session.add(audit)
    await session.commit()
    stmt = (
        select(InsuranceCompany)
        .options(selectinload(InsuranceCompany.documents), selectinload(InsuranceCompany.plans))
        .where(InsuranceCompany.id == company.id)
    )
    company = (await session.execute(stmt)).scalar_one()

    p_count = (
        await session.execute(
            select(func.count(InsurancePlan.id)).where(
                InsurancePlan.company_id == company.id
            )
        )
    ).scalar() or 0

    supported = await _get_company_supported_categories(session, company)
    cat_counts = await _get_company_category_plans_count(session, company.id)

    resp = CompanyResponse.model_validate(company)
    resp.agent_direct_mobile = company.agent_contact_number
    resp.plans_count = p_count
    resp.company_type = company.company_type or "General Insurance"
    resp.supported_categories = supported
    resp.category_plans_count = cat_counts
    return resp


@router.delete(
    "/companies/{company_id}",
    status_code=status.HTTP_200_OK,
    summary="Safe Delete Insurance Company",
)
async def delete_company(
    company_id: uuid.UUID,
    current_user: User = Depends(require_admin_or_super_admin),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Safely delete an insurance company.

    Protected: Blocks deletion if referenced by existing plans.
    """
    stmt = select(InsuranceCompany).where(InsuranceCompany.id == company_id)
    company = (await session.execute(stmt)).scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insurance Company with ID '{company_id}' not found.",
        )

    # Dependency check: are there associated plans or policies?
    p_count = (
        await session.execute(
            select(func.count(InsurancePlan.id)).where(
                InsurancePlan.company_id == company_id
            )
        )
    ).scalar() or 0

    if p_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot delete company '{company.name}' ({company.code}) because it has "
                f"{p_count} associated plan(s) in the database. Please reassign or remove the plans, "
                "or deactivate the company instead."
            ),
        )

    pol_count = (
        await session.execute(
            select(func.count(InsurancePolicy.id)).where(
                InsurancePolicy.company_id == company_id
            )
        )
    ).scalar() or 0

    if pol_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot delete company '{company.name}' ({company.code}) because it has "
                f"{pol_count} associated policy contract(s). Deactivate the company instead."
            ),
        )

    comp_name = company.name
    comp_code = company.code

    await session.delete(company)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="INSURANCE_COMPANY_DELETED",
        resource_type="insurance_company",
        resource_id=company_id,
        state_delta={"name": comp_name, "code": comp_code},
        created_at=datetime.now(UTC),
    )
    session.add(audit)
    await session.commit()

    return {
        "success": True,
        "message": f"Company '{comp_name}' ({comp_code}) was successfully deleted.",
    }


@router.post(
    "/master/seed",
    status_code=status.HTTP_200_OK,
    summary="Explicit Idempotent Seeder for Master Data",
)
async def trigger_master_data_seed(
    confirm: bool = Query(
        False, description="Explicit confirmation flag to seed canonical providers"
    ),
    current_user: User = Depends(require_admin_or_super_admin),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Explicitly trigger idempotent seeding of reference insurance companies and plans.

    Accessible only to Super Admin / Admin accounts.
    """
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must specify confirm=true query parameter to execute master data seed.",
        )

    results = await seed_insurance_master_data(session)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="INSURANCE_MASTER_DATA_SEEDED",
        resource_type="insurance_master_data",
        resource_id=None,
        state_delta=results,
        created_at=datetime.now(UTC),
    )
    session.add(audit)
    await session.commit()

    return {
        "success": True,
        "message": "Insurance master data seed executed successfully.",
        "results": results,
    }


# ===========================================================================
# C. PLAN MASTER (Add / Manage Plan)
# ===========================================================================



@router.get(
    "/companies/export/csv",
    summary="Export Filtered Companies as CSV",
)
async def export_companies_csv(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Export filtered company records as a streaming CSV file."""
    query = select(InsuranceCompany)
    if search:
        pattern = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(InsuranceCompany.name).like(pattern),
                func.lower(InsuranceCompany.code).like(pattern),
            )
        )
    if category and category != "ALL":
        aliases = get_category_aliases(category)
        query = query.where(
            or_(
                func.upper(InsuranceCompany.category).in_(aliases),
                InsuranceCompany.company_categories.any(
                    and_(
                        func.upper(InsuranceCompanyCategory.category).in_(aliases),
                        InsuranceCompanyCategory.is_active.is_(True),
                    )
                ),
            )
        )
    if status_filter and status_filter != "ALL":
        is_active_val = status_filter.lower() in ("active", "true", "1")
        query = query.where(InsuranceCompany.is_active.is_(is_active_val))

    query = query.order_by(InsuranceCompany.name)
    companies = (await session.execute(query)).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Company Code",
        "Company Name",
        "Company Type",
        "Supported Categories",
        "Primary Category",
        "Status",
        "Agent Name",
        "Agent Contact",
        "Agent Code",
        "Tie-up Date",
        "Tie-up Renewal Date",
        "Renewal Team Contact",
        "Claims Team Contact",
        "Contact Person",
        "Phone",
        "Email",
        "Address",
        "Notes",
    ])
    for c in companies:
        supported = await _get_company_supported_categories(session, c)
        writer.writerow([
            c.code,
            c.name,
            c.company_type or "General Insurance",
            "; ".join(supported),
            c.category,
            "ACTIVE" if c.is_active else "INACTIVE",
            c.agent_name or "",
            c.agent_contact_number or "",
            c.agent_code or "",
            c.tieup_date.isoformat() if c.tieup_date else "",
            c.tieup_renewal_date.isoformat() if c.tieup_renewal_date else "",
            c.renewal_team_contact or "",
            c.claims_team_contact or "",
            c.contact_person or "",
            c.phone or "",
            c.email or "",
            c.address or "",
            c.notes or "",
        ])

    csv_data = output.getvalue()
    filename = f"insurance_companies_{date.today().isoformat()}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/companies/export/excel",
    summary="Export Filtered Companies for Excel",
)
async def export_companies_excel(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Export filtered company records as Excel-compatible CSV with UTF-8 BOM."""
    query = select(InsuranceCompany)
    if search:
        pattern = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(InsuranceCompany.name).like(pattern),
                func.lower(InsuranceCompany.code).like(pattern),
            )
        )
    if category and category != "ALL":
        aliases = get_category_aliases(category)
        query = query.where(
            or_(
                func.upper(InsuranceCompany.category).in_(aliases),
                InsuranceCompany.company_categories.any(
                    and_(
                        func.upper(InsuranceCompanyCategory.category).in_(aliases),
                        InsuranceCompanyCategory.is_active.is_(True),
                    )
                ),
            )
        )
    if status_filter and status_filter != "ALL":
        is_active_val = status_filter.lower() in ("active", "true", "1")
        query = query.where(InsuranceCompany.is_active.is_(is_active_val))

    query = query.order_by(InsuranceCompany.name)
    companies = (await session.execute(query)).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Company Code",
        "Company Name",
        "Company Type",
        "Supported Categories",
        "Primary Category",
        "Status",
        "Agent Name",
        "Agent Contact",
        "Agent Code",
        "Tie-up Date",
        "Tie-up Renewal Date",
        "Renewal Team Contact",
        "Claims Team Contact",
        "Contact Person",
        "Phone",
        "Email",
        "Address",
        "Notes",
    ])
    for c in companies:
        supported = await _get_company_supported_categories(session, c)
        writer.writerow([
            c.code,
            c.name,
            c.company_type or "General Insurance",
            "; ".join(supported),
            c.category,
            "ACTIVE" if c.is_active else "INACTIVE",
            c.agent_name or "",
            c.agent_contact_number or "",
            c.agent_code or "",
            c.tieup_date.isoformat() if c.tieup_date else "",
            c.tieup_renewal_date.isoformat() if c.tieup_renewal_date else "",
            c.renewal_team_contact or "",
            c.claims_team_contact or "",
            c.contact_person or "",
            c.phone or "",
            c.email or "",
            c.address or "",
            c.notes or "",
        ])
    writer.writerow([
        "Company Code",
        "Company Name",
        "Category",
        "Status",
        "Agent Name",
        "Agent Contact",
        "Agent Code",
        "Tie-up Date",
        "Tie-up Renewal Date",
        "Renewal Team Contact",
        "Claims Team Contact",
        "Contact Person",
        "Phone",
        "Email",
        "Address",
        "Notes",
    ])
    for c in companies:
        writer.writerow([
            c.code,
            c.name,
            c.category,
            "ACTIVE" if c.is_active else "INACTIVE",
            c.agent_name or "",
            c.agent_contact_number or "",
            c.agent_code or "",
            c.tieup_date.isoformat() if c.tieup_date else "",
            c.tieup_renewal_date.isoformat() if c.tieup_renewal_date else "",
            c.renewal_team_contact or "",
            c.claims_team_contact or "",
            c.contact_person or "",
            c.phone or "",
            c.email or "",
            c.address or "",
            c.notes or "",
        ])

    csv_data = "﻿" + output.getvalue()
    filename = f"insurance_companies_{date.today().isoformat()}.csv"
    return Response(
        content=csv_data.encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/companies/{company_id}/documents",
    response_model=CompanyDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Company Tie-up or Compliance Document",
)
async def upload_company_document(
    company_id: uuid.UUID,
    title: str | None = Form(default=None),
    document_type: str | None = Form(default=None),
    title_q: str | None = Query(default=None, alias="title"),
    doc_type_q: str | None = Query(default=None, alias="document_type"),
    file: UploadFile = File(...),
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> CompanyDocumentResponse:
    """Upload tie-up contracts, SLAs, or compliance documents for a carrier."""
    comp = (await session.execute(select(InsuranceCompany).where(InsuranceCompany.id == company_id))).scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Company '{company_id}' not found.")

    effective_title = (title or title_q or (file.filename or "Document")).strip()
    effective_doc_type = (document_type or doc_type_q or "Tie-up Agreement").strip()

    mime = file.content_type or "application/octet-stream"
    if mime not in ALLOWED_DOC_MIMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{mime}'. Allowed formats: PDF, PNG, JPG, DOCX.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is empty.")
    if len(content) > MAX_DOC_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds 15MB limit.")

    sha256 = hashlib.sha256(content).hexdigest()
    doc_id = uuid.uuid4()
    ext = ALLOWED_DOC_MIMES[mime]
    clean_name = "".join(c for c in (file.filename or "document") if c.isalnum() or c in "._- ")
    storage_name = f"{company_id}_{doc_id.hex[:8]}_{clean_name}"
    storage_path = str(COMPANY_STORAGE_DIR / storage_name)

    with open(storage_path, "wb") as f_out:
        f_out.write(content)

    doc = InsuranceCompanyDocument(
        id=doc_id,
        company_id=company_id,
        document_type=effective_doc_type.upper(),
        title=effective_title,
        original_filename=file.filename or "document",
        storage_path=storage_path,
        file_size_bytes=len(content),
        mime_type=mime,
        sha256_hash=sha256,
        uploaded_by_id=current_user.id,
        created_at=datetime.now(UTC),
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    return CompanyDocumentResponse.model_validate(doc)


@router.get(
    "/companies/{company_id}/documents",
    response_model=list[CompanyDocumentResponse],
    summary="List Documents for a Company",
)
async def list_company_documents(
    company_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[CompanyDocumentResponse]:
    """Retrieve all tie-up and compliance documents registered for a company."""
    docs = (
        await session.execute(
            select(InsuranceCompanyDocument)
            .where(InsuranceCompanyDocument.company_id == company_id)
            .order_by(InsuranceCompanyDocument.created_at.desc())
        )
    ).scalars().all()
    return [CompanyDocumentResponse.model_validate(d) for d in docs]


@router.get(
    "/companies/{company_id}/documents/{document_id}/download",
    summary="Download Company Document",
)
async def download_company_document(
    company_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FileResponse:
    """Securely stream an authorized company document."""
    doc = (
        await session.execute(
            select(InsuranceCompanyDocument).where(
                InsuranceCompanyDocument.id == document_id,
                InsuranceCompanyDocument.company_id == company_id,
            )
        )
    ).scalar_one_or_none()
    if not doc or not Path(doc.storage_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found on storage.")

    return FileResponse(
        path=doc.storage_path,
        media_type=doc.mime_type,
        filename=doc.original_filename,
    )


@router.delete(
    "/companies/{company_id}/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Company Document",
)
async def delete_company_document(
    company_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
):
    """Remove a company document record and delete its storage file."""
    doc = (
        await session.execute(
            select(InsuranceCompanyDocument).where(
                InsuranceCompanyDocument.id == document_id,
                InsuranceCompanyDocument.company_id == company_id,
            )
        )
    ).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    p = Path(doc.storage_path)
    if p.exists():
        p.unlink(missing_ok=True)

    await session.delete(doc)
    await session.commit()


@router.get(
    "/plans",
    response_model=PaginatedResponse[PlanResponse],
    summary="List Insurance Plans (Paginated & Filterable)",
)
async def list_plans(
    search: str | None = Query(default=None, description="Search plan name or code"),
    company_id: uuid.UUID | None = Query(default=None, description="Filter by parent carrier"),
    line_of_business: str | None = Query(default=None, description="Filter by line of business"),
    status_filter: str | None = Query(default=None, alias="status", description="ACTIVE or INACTIVE"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=500),
    sort_by: str = Query(default="name", description="name, code, line_of_business, status, created_at"),
    sort_order: str = Query(default="asc"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[PlanResponse]:
    """Retrieve filtered, paginated insurance plans with parent company information."""
    query = (
        select(InsurancePlan)
        .options(
            selectinload(InsurancePlan.company),
            selectinload(InsurancePlan.documents),
            selectinload(InsurancePlan.plan_riders),
            selectinload(InsurancePlan.plan_benefits),
        )
    )
    count_query = select(func.count(InsurancePlan.id))

    if search:
        pattern = f"%{search.strip().lower()}%"
        flt = or_(
            func.lower(InsurancePlan.name).like(pattern),
            func.lower(InsurancePlan.code).like(pattern),
        )
        query = query.where(flt)
        count_query = count_query.where(flt)

    if company_id:
        query = query.where(InsurancePlan.company_id == company_id)
        count_query = count_query.where(InsurancePlan.company_id == company_id)

    if line_of_business and line_of_business != "ALL":
        aliases = get_category_aliases(line_of_business)
        flt_lob = func.upper(InsurancePlan.line_of_business).in_(aliases)
        query = query.where(flt_lob)
        count_query = count_query.where(flt_lob)

    if status_filter and status_filter != "ALL":
        query = query.where(InsurancePlan.status == status_filter.upper())
        count_query = count_query.where(InsurancePlan.status == status_filter.upper())

    total = (await session.execute(count_query)).scalar() or 0

    sort_column = getattr(InsurancePlan, sort_by, InsurancePlan.name)
    if sort_order.lower() == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(sort_column)

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    plans = (await session.execute(query)).scalars().all()

    items = []
    for p in plans:
        resp = PlanResponse.model_validate(p)
        if p.company:
            resp.company_name = p.company.name
            resp.company_code = p.company.code
        resp.has_brochure = bool(p.brochure_storage_path)
        resp.has_claim_form = bool(p.claim_form_storage_path)
        resp.documents_count = len(p.documents) if p.documents else 0
        resp.plan_riders = [PlanRiderResponse.model_validate(r) for r in (p.plan_riders or [])]
        resp.plan_benefits = [PlanBenefitResponse.model_validate(b) for b in (p.plan_benefits or [])]
        items.append(resp)

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/plans/{plan_id}",
    response_model=PlanResponse,
    summary="Get Insurance Plan Detail",
)
async def get_plan_detail(
    plan_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PlanResponse:
    """Retrieve details for a single insurance plan."""
    stmt = (
        select(InsurancePlan)
        .options(
            selectinload(InsurancePlan.company),
            selectinload(InsurancePlan.documents).selectinload(InsurancePlanDocument.uploaded_by),
            selectinload(InsurancePlan.plan_riders),
            selectinload(InsurancePlan.plan_benefits),
        )
        .where(InsurancePlan.id == plan_id)
    )
    plan = (await session.execute(stmt)).scalar_one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insurance Plan with ID '{plan_id}' not found.",
        )
    resp = PlanResponse.model_validate(plan)
    if plan.company:
        resp.company_name = plan.company.name
        resp.company_code = plan.company.code
    resp.documents = [PlanDocumentResponse.model_validate(d) for d in (plan.documents or [])]
    resp.documents_count = len(resp.documents)
    resp.plan_riders = [PlanRiderResponse.model_validate(r) for r in (plan.plan_riders or [])]
    resp.plan_benefits = [PlanBenefitResponse.model_validate(b) for b in (plan.plan_benefits or [])]
    return resp


@router.post(
    "/plans",
    response_model=PlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Insurance Plan (Plan Master)",
)
async def create_plan(
    payload: PlanCreate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PlanResponse:
    """Create a new insurance plan linked to an active carrier company."""
    # 1. Validate parent company exists and is active
    comp_stmt = select(InsuranceCompany).where(
        InsuranceCompany.id == payload.company_id
    )
    company = (await session.execute(comp_stmt)).scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parent insurance company with ID '{payload.company_id}' not found.",
        )
    if not company.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Parent company '{company.name}' is currently deactivated. Plans can only be added to active carriers.",
        )

    # 2. Check category compatibility with parent carrier's supported categories
    canonical_lob = normalize_category_label(payload.line_of_business)
    if not await _check_company_supports_category(session, company, canonical_lob):
        supported_list = await _get_company_supported_categories(session, company)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot add a {canonical_lob} plan to carrier '{company.name}'. The carrier supports: {', '.join(supported_list)}.",
        )

    # 3. Check duplicate plan code
    code_clean = payload.code.strip().upper()
    code_stmt = select(InsurancePlan).where(
        func.lower(InsurancePlan.code) == code_clean.lower()
    )
    if (await session.execute(code_stmt)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Plan code '{code_clean}' already exists in the system.",
        )

    now = datetime.now(UTC)
    norm_riders = _normalize_rider_items(payload.riders)
    norm_benefits = _normalize_benefit_items(payload.benefits)
    riders_summary = "\n".join(r["name"] for r in norm_riders) if norm_riders else None
    benefits_summary = "\n".join(b["name"] for b in norm_benefits) if norm_benefits else None

    new_plan = InsurancePlan(
        id=uuid.uuid4(),
        name=payload.name.strip(),
        code=code_clean,
        company_id=payload.company_id,
        line_of_business=canonical_lob,
        status=payload.status.upper() if payload.status else "ACTIVE",
        description=payload.description.strip() if payload.description else None,
        riders=riders_summary,
        benefits=benefits_summary,
        plan_subcategory=payload.plan_subcategory.strip() if getattr(payload, "plan_subcategory", None) else None,
        motor_plan_type=payload.motor_plan_type.strip() if getattr(payload, "motor_plan_type", None) else None,
        sum_insured_min=payload.sum_insured_min if getattr(payload, "sum_insured_min", None) else None,
        sum_insured_max=payload.sum_insured_max if getattr(payload, "sum_insured_max", None) else None,
        policy_term_min_years=payload.policy_term_min_years if getattr(payload, "policy_term_min_years", None) else None,
        policy_term_max_years=payload.policy_term_max_years if getattr(payload, "policy_term_max_years", None) else None,
        waiting_period_months=payload.waiting_period_months if getattr(payload, "waiting_period_months", None) else None,
        eligibility_criteria=payload.eligibility_criteria.strip() if getattr(payload, "eligibility_criteria", None) else None,
        created_at=now,
        updated_at=now,
    )
    session.add(new_plan)

    plan_riders_created = []
    for r in norm_riders:
        r_obj = InsurancePlanRider(
            id=uuid.uuid4(),
            plan_id=new_plan.id,
            name=r["name"],
            description=r["description"],
            created_at=now,
            updated_at=now,
        )
        session.add(r_obj)
        plan_riders_created.append(r_obj)

    plan_benefits_created = []
    for b in norm_benefits:
        b_obj = InsurancePlanBenefit(
            id=uuid.uuid4(),
            plan_id=new_plan.id,
            name=b["name"],
            description=b["description"],
            created_at=now,
            updated_at=now,
        )
        session.add(b_obj)
        plan_benefits_created.append(b_obj)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="INSURANCE_PLAN_CREATED",
        resource_type="insurance_plan",
        resource_id=new_plan.id,
        state_delta={
            "name": new_plan.name,
            "code": new_plan.code,
            "company_id": str(company.id),
            "company_name": company.name,
        },
        created_at=now,
    )
    session.add(audit)
    await session.commit()
    await session.refresh(new_plan)

    resp = PlanResponse.model_validate(new_plan)
    resp.company_name = company.name
    resp.company_code = company.code
    resp.plan_riders = [PlanRiderResponse.model_validate(r) for r in plan_riders_created]
    resp.plan_benefits = [PlanBenefitResponse.model_validate(b) for b in plan_benefits_created]
    return resp


@router.put(
    "/plans/{plan_id}",
    response_model=PlanResponse,
    summary="Update Insurance Plan",
)
async def update_plan(
    plan_id: uuid.UUID,
    payload: PlanUpdate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PlanResponse:
    """Update insurance plan fields."""
    stmt = (
        select(InsurancePlan)
        .options(
            selectinload(InsurancePlan.company),
            selectinload(InsurancePlan.plan_riders),
            selectinload(InsurancePlan.plan_benefits),
        )
        .where(InsurancePlan.id == plan_id)
    )
    plan = (await session.execute(stmt)).scalar_one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insurance Plan with ID '{plan_id}' not found.",
        )

    delta: dict[str, Any] = {}

    if payload.name is not None:
        delta["name"] = {"from": plan.name, "to": payload.name.strip()}
        plan.name = payload.name.strip()

    if payload.code is not None:
        code_clean = payload.code.strip().upper()
        if code_clean != plan.code:
            code_stmt = select(InsurancePlan).where(
                func.lower(InsurancePlan.code) == code_clean.lower(),
                InsurancePlan.id != plan_id,
            )
            if (await session.execute(code_stmt)).scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Plan code '{code_clean}' is already assigned to another plan.",
                )
            delta["code"] = {"from": plan.code, "to": code_clean}
            plan.code = code_clean

    comp = None
    if payload.company_id is not None and payload.company_id != plan.company_id:
        comp_stmt = select(InsuranceCompany).where(
            InsuranceCompany.id == payload.company_id
        )
        comp = (await session.execute(comp_stmt)).scalar_one_or_none()
        if not comp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Target company with ID '{payload.company_id}' not found.",
            )
        delta["company_id"] = {"from": str(plan.company_id), "to": str(comp.id)}
        plan.company_id = comp.id
        plan.company = comp

    target_comp = comp if comp else plan.company
    target_lob = normalize_category_label(payload.line_of_business) if payload.line_of_business is not None else plan.line_of_business
    if target_comp and payload.line_of_business is not None:
        if not await _check_company_supports_category(session, target_comp, target_lob):
            supported_list = await _get_company_supported_categories(session, target_comp)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot associate {target_lob} plan with carrier '{target_comp.name}'. The carrier supports: {', '.join(supported_list)}.",
            )

    if payload.line_of_business is not None:
        delta["line_of_business"] = {
            "from": plan.line_of_business,
            "to": target_lob,
        }
        plan.line_of_business = target_lob

    if payload.status is not None:
        status_clean = payload.status.upper()
        delta["status"] = {"from": plan.status, "to": status_clean}
        plan.status = status_clean

    if payload.description is not None:
        plan.description = payload.description.strip() if payload.description else None

    if payload.riders is not None:
        norm_riders = _normalize_rider_items(payload.riders)
        plan.riders = "\n".join(r["name"] for r in norm_riders) if norm_riders else None
        existing_riders = {r.name.lower(): r for r in (plan.plan_riders or [])}
        keep_r_names = set()
        for r_item in norm_riders:
            r_name_key = r_item["name"].lower()
            keep_r_names.add(r_name_key)
            if r_name_key in existing_riders:
                existing_r = existing_riders[r_name_key]
                existing_r.name = r_item["name"]
                existing_r.description = r_item["description"]
                existing_r.updated_at = datetime.now(UTC)
            else:
                new_rider = InsurancePlanRider(
                    id=uuid.uuid4(),
                    plan_id=plan.id,
                    name=r_item["name"],
                    description=r_item["description"],
                    created_at=datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                )
                session.add(new_rider)
        for r_name_key, existing_r in existing_riders.items():
            if r_name_key not in keep_r_names:
                await session.delete(existing_r)

    if payload.benefits is not None:
        norm_benefits = _normalize_benefit_items(payload.benefits)
        plan.benefits = "\n".join(b["name"] for b in norm_benefits) if norm_benefits else None
        existing_benefits = {b.name.lower(): b for b in (plan.plan_benefits or [])}
        keep_b_names = set()
        for b_item in norm_benefits:
            b_name_key = b_item["name"].lower()
            keep_b_names.add(b_name_key)
            if b_name_key in existing_benefits:
                existing_b = existing_benefits[b_name_key]
                existing_b.name = b_item["name"]
                existing_b.description = b_item["description"]
                existing_b.updated_at = datetime.now(UTC)
            else:
                new_benefit = InsurancePlanBenefit(
                    id=uuid.uuid4(),
                    plan_id=plan.id,
                    name=b_item["name"],
                    description=b_item["description"],
                    created_at=datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                )
                session.add(new_benefit)
        for b_name_key, existing_b in existing_benefits.items():
            if b_name_key not in keep_b_names:
                await session.delete(existing_b)

    if getattr(payload, "plan_subcategory", None) is not None:
        plan.plan_subcategory = payload.plan_subcategory.strip() if payload.plan_subcategory else None
    if getattr(payload, "motor_plan_type", None) is not None:
        plan.motor_plan_type = payload.motor_plan_type.strip() if payload.motor_plan_type else None
    if getattr(payload, "sum_insured_min", None) is not None:
        plan.sum_insured_min = payload.sum_insured_min
    if getattr(payload, "sum_insured_max", None) is not None:
        plan.sum_insured_max = payload.sum_insured_max
    if getattr(payload, "policy_term_min_years", None) is not None:
        plan.policy_term_min_years = payload.policy_term_min_years
    if getattr(payload, "policy_term_max_years", None) is not None:
        plan.policy_term_max_years = payload.policy_term_max_years
    if getattr(payload, "waiting_period_months", None) is not None:
        plan.waiting_period_months = payload.waiting_period_months
    if getattr(payload, "eligibility_criteria", None) is not None:
        plan.eligibility_criteria = payload.eligibility_criteria.strip() if payload.eligibility_criteria else None

    plan.updated_at = datetime.now(UTC)

    if delta:
        audit = AuditLog(
            id=uuid.uuid4(),
            actor_id=current_user.id,
            action="INSURANCE_PLAN_UPDATED",
            resource_type="insurance_plan",
            resource_id=plan.id,
            state_delta=delta,
            created_at=datetime.now(UTC),
        )
        session.add(audit)

    await session.commit()

    refreshed_stmt = (
        select(InsurancePlan)
        .options(
            selectinload(InsurancePlan.company),
            selectinload(InsurancePlan.plan_riders),
            selectinload(InsurancePlan.plan_benefits),
        )
        .where(InsurancePlan.id == plan.id)
    )
    plan_refreshed = (await session.execute(refreshed_stmt)).scalar_one()

    resp = PlanResponse.model_validate(plan_refreshed)
    if plan_refreshed.company:
        resp.company_name = plan_refreshed.company.name
        resp.company_code = plan_refreshed.company.code
    resp.plan_riders = [PlanRiderResponse.model_validate(r) for r in (plan_refreshed.plan_riders or [])]
    resp.plan_benefits = [PlanBenefitResponse.model_validate(b) for b in (plan_refreshed.plan_benefits or [])]
    return resp


@router.get(
    "/plans/{plan_id}/riders",
    response_model=list[PlanRiderResponse],
    summary="Get Available Riders for Plan",
)
async def list_plan_riders(
    plan_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[PlanRiderResponse]:
    """Retrieve all available riders/add-ons for a specific plan."""
    riders = (
        await session.execute(
            select(InsurancePlanRider)
            .where(InsurancePlanRider.plan_id == plan_id)
            .order_by(InsurancePlanRider.created_at)
        )
    ).scalars().all()
    return [PlanRiderResponse.model_validate(r) for r in riders]


@router.get(
    "/plans/{plan_id}/benefits",
    response_model=list[PlanBenefitResponse],
    summary="Get Available Coverage Benefits for Plan",
)
async def list_plan_benefits(
    plan_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[PlanBenefitResponse]:
    """Retrieve all coverage benefits for a specific plan."""
    benefits = (
        await session.execute(
            select(InsurancePlanBenefit)
            .where(InsurancePlanBenefit.plan_id == plan_id)
            .order_by(InsurancePlanBenefit.created_at)
        )
    ).scalars().all()
    return [PlanBenefitResponse.model_validate(b) for b in benefits]


@router.patch(
    "/plans/{plan_id}/status",
    response_model=PlanResponse,
    summary="Activate or Deactivate Insurance Plan",
)
async def toggle_plan_status(
    plan_id: uuid.UUID,
    status_value: str = Query(..., alias="status", description="ACTIVE or INACTIVE"),
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PlanResponse:
    """Toggle plan status between ACTIVE and INACTIVE."""
    target_status = status_value.upper()
    if target_status not in ("ACTIVE", "INACTIVE"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be either 'ACTIVE' or 'INACTIVE'.",
        )

    stmt = (
        select(InsurancePlan)
        .options(
            selectinload(InsurancePlan.company),
            selectinload(InsurancePlan.plan_riders),
            selectinload(InsurancePlan.plan_benefits),
        )
        .where(InsurancePlan.id == plan_id)
    )
    plan = (await session.execute(stmt)).scalar_one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insurance Plan with ID '{plan_id}' not found.",
        )

    old_status = plan.status
    plan.status = target_status
    plan.updated_at = datetime.now(UTC)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="INSURANCE_PLAN_STATUS_CHANGED",
        resource_type="insurance_plan",
        resource_id=plan.id,
        state_delta={"status": {"from": old_status, "to": target_status}},
        created_at=datetime.now(UTC),
    )
    session.add(audit)
    await session.commit()

    refreshed_stmt = (
        select(InsurancePlan)
        .options(
            selectinload(InsurancePlan.company),
            selectinload(InsurancePlan.plan_riders),
            selectinload(InsurancePlan.plan_benefits),
        )
        .where(InsurancePlan.id == plan.id)
    )
    plan_refreshed = (await session.execute(refreshed_stmt)).scalar_one()

    resp = PlanResponse.model_validate(plan_refreshed)
    if plan_refreshed.company:
        resp.company_name = plan_refreshed.company.name
        resp.company_code = plan_refreshed.company.code
    resp.plan_riders = [PlanRiderResponse.model_validate(r) for r in (plan_refreshed.plan_riders or [])]
    resp.plan_benefits = [PlanBenefitResponse.model_validate(b) for b in (plan_refreshed.plan_benefits or [])]
    return resp


@router.delete(
    "/plans/{plan_id}",
    status_code=status.HTTP_200_OK,
    summary="Safe Delete Insurance Plan",
)
async def delete_plan(
    plan_id: uuid.UUID,
    current_user: User = Depends(require_admin_or_super_admin),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Safely delete an insurance plan."""
    stmt = select(InsurancePlan).where(InsurancePlan.id == plan_id)
    plan = (await session.execute(stmt)).scalar_one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insurance Plan with ID '{plan_id}' not found.",
        )

    # Check if referenced by policies
    pol_count = (
        await session.execute(
            select(func.count(InsurancePolicy.id)).where(
                InsurancePolicy.plan_id == plan_id
            )
        )
    ).scalar() or 0

    if pol_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete plan '{plan.name}' because {pol_count} policy contract(s) reference it. Deactivate instead.",
        )

    plan_name = plan.name
    plan_code = plan.code

    await session.delete(plan)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="INSURANCE_PLAN_DELETED",
        resource_type="insurance_plan",
        resource_id=plan_id,
        state_delta={"name": plan_name, "code": plan_code},
        created_at=datetime.now(UTC),
    )
    session.add(audit)
    await session.commit()

    return {
        "success": True,
        "message": f"Plan '{plan_name}' ({plan_code}) was successfully deleted.",
    }


# ===========================================================================
# D. PURCHASE PARTY MANAGEMENT (Sourcing Parties)
# ===========================================================================


def _generate_purchase_party_code(name: str) -> str:
    """Generate unique Purchase Party code (e.g. PP-XXXX)."""
    clean = "".join(ch for ch in name.upper() if ch.isalnum())
    prefix = clean[:4] if len(clean) >= 4 else "PP"
    suffix = uuid.uuid4().hex[:4].upper()
    return f"PP-{prefix}-{suffix}"





@router.post(
    "/plans/{plan_id}/brochure",
    response_model=PlanResponse,
    summary="Upload Plan Product Brochure (PDF)",
)
async def upload_plan_brochure(
    plan_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PlanResponse:
    """Upload official PDF brochure for a plan."""
    plan = (await session.execute(select(InsurancePlan).options(selectinload(InsurancePlan.company)).where(InsurancePlan.id == plan_id))).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Plan '{plan_id}' not found.")

    mime = file.content_type or "application/octet-stream"
    if mime != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Brochure must be a PDF document.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is empty.")
    if len(content) > MAX_DOC_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds 15MB limit.")

    clean_name = "".join(c for c in (file.filename or "brochure.pdf") if c.isalnum() or c in "._- ")
    storage_name = f"plan_{plan_id}_brochure_{clean_name}"
    storage_path = str(PLAN_STORAGE_DIR / storage_name)

    with open(storage_path, "wb") as f_out:
        f_out.write(content)

    plan.brochure_filename = file.filename or "brochure.pdf"
    plan.brochure_storage_path = storage_path
    plan.brochure_mime_type = mime
    plan.updated_at = datetime.now(UTC)

    await session.commit()
    await session.refresh(plan)

    resp = PlanResponse.model_validate(plan)
    if plan.company:
        resp.company_name = plan.company.name
        resp.company_code = plan.company.code
    resp.has_brochure = True
    resp.has_claim_form = bool(plan.claim_form_storage_path)
    return resp


@router.get(
    "/plans/{plan_id}/brochure",
    summary="Download Plan Brochure PDF",
)
async def download_plan_brochure(
    plan_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FileResponse:
    """Stream the plan product brochure."""
    plan = (await session.execute(select(InsurancePlan).where(InsurancePlan.id == plan_id))).scalar_one_or_none()
    if not plan or not plan.brochure_storage_path or not Path(plan.brochure_storage_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan brochure not uploaded or not found.")

    return FileResponse(
        path=plan.brochure_storage_path,
        media_type=plan.brochure_mime_type or "application/pdf",
        filename=plan.brochure_filename or f"{plan.code}_brochure.pdf",
    )


@router.post(
    "/plans/{plan_id}/claim-form",
    response_model=PlanResponse,
    summary="Upload Plan Claim Form (PDF)",
)
async def upload_plan_claim_form(
    plan_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PlanResponse:
    """Upload official claim intimation / settlement form for a plan."""
    plan = (await session.execute(select(InsurancePlan).options(selectinload(InsurancePlan.company)).where(InsurancePlan.id == plan_id))).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Plan '{plan_id}' not found.")

    mime = file.content_type or "application/octet-stream"
    if mime != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Claim form must be a PDF document.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is empty.")
    if len(content) > MAX_DOC_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds 15MB limit.")

    clean_name = "".join(c for c in (file.filename or "claim_form.pdf") if c.isalnum() or c in "._- ")
    storage_name = f"plan_{plan_id}_claim_{clean_name}"
    storage_path = str(PLAN_STORAGE_DIR / storage_name)

    with open(storage_path, "wb") as f_out:
        f_out.write(content)

    plan.claim_form_filename = file.filename or "claim_form.pdf"
    plan.claim_form_storage_path = storage_path
    plan.claim_form_mime_type = mime
    plan.updated_at = datetime.now(UTC)

    await session.commit()
    await session.refresh(plan)

    resp = PlanResponse.model_validate(plan)
    if plan.company:
        resp.company_name = plan.company.name
        resp.company_code = plan.company.code
    resp.has_brochure = bool(plan.brochure_storage_path)
    resp.has_claim_form = True
    return resp


@router.get(
    "/plans/{plan_id}/claim-form",
    summary="Download Plan Claim Form PDF",
)
async def download_plan_claim_form(
    plan_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FileResponse:
    """Stream the plan claim settlement form."""
    plan = (await session.execute(select(InsurancePlan).where(InsurancePlan.id == plan_id))).scalar_one_or_none()
    if not plan or not plan.claim_form_storage_path or not Path(plan.claim_form_storage_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan claim form not uploaded or not found.")

    return FileResponse(
        path=plan.claim_form_storage_path,
        media_type=plan.claim_form_mime_type or "application/pdf",
        filename=plan.claim_form_filename or f"{plan.code}_claim_form.pdf",
    )


# ===========================================================================
# PLAN DOCUMENT MANAGEMENT (Multi-Document Upload & Download)
# ===========================================================================


@router.post(
    "/plans/{plan_id}/documents",
    response_model=PlanDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Plan Document / Brochure / Attachment",
)
async def upload_plan_document(
    plan_id: uuid.UUID,
    title: str | None = Form(default=None),
    document_type: str | None = Form(default=None),
    description: str | None = Form(default=None),
    title_q: str | None = Query(default=None, alias="title"),
    doc_type_q: str | None = Query(default=None, alias="document_type"),
    desc_q: str | None = Query(default=None, alias="description"),
    file: UploadFile = File(...),
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PlanDocumentResponse:
    """Upload a policy document (brochure, wording, claim form, rider, etc.) for a plan."""
    plan = (
        await session.execute(
            select(InsurancePlan)
            .options(selectinload(InsurancePlan.company))
            .where(InsurancePlan.id == plan_id)
        )
    ).scalar_one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insurance Plan with ID '{plan_id}' not found.",
        )

    raw_type = document_type or doc_type_q or "Policy Brochure"
    effective_doc_type = _normalize_plan_doc_type(raw_type)
    effective_title = (title or title_q or file.filename or effective_doc_type).strip()
    effective_desc = (description or desc_q or "").strip() or None

    filename = file.filename or "document"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_PLAN_DOC_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed extensions: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG.",
        )

    mime = file.content_type or "application/octet-stream"
    if mime not in ALLOWED_PLAN_DOC_MIMES and ext in ALLOWED_PLAN_DOC_EXTENSIONS:
        # Fallback mapping from extension
        ext_to_mime = {
            ".pdf": "application/pdf",
            ".doc": "application/msword",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls": "application/vnd.ms-excel",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
        }
        mime = ext_to_mime.get(ext, "application/octet-stream")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
    if len(content) > MAX_PLAN_DOC_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of 25MB (received {len(content) / (1024 * 1024):.2f}MB).",
        )

    sha256 = hashlib.sha256(content).hexdigest()
    doc_id = uuid.uuid4()
    clean_name = "".join(c for c in filename if c.isalnum() or c in "._- ")
    storage_name = f"plan_{plan_id}_{doc_id.hex[:8]}_{clean_name}"
    storage_path = str(PLAN_STORAGE_DIR / storage_name)

    with open(storage_path, "wb") as f_out:
        f_out.write(content)

    doc = InsurancePlanDocument(
        id=doc_id,
        plan_id=plan_id,
        document_type=effective_doc_type,
        title=effective_title,
        description=effective_desc,
        original_filename=filename,
        storage_path=storage_path,
        file_size_bytes=len(content),
        mime_type=mime,
        sha256_hash=sha256,
        uploaded_by_id=current_user.id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(doc)

    # Sync single-slot legacy brochure/claim_form pointers if empty
    if effective_doc_type == "Policy Brochure" and not plan.brochure_storage_path and ext == ".pdf":
        plan.brochure_filename = filename
        plan.brochure_storage_path = storage_path
        plan.brochure_mime_type = mime
        plan.updated_at = datetime.now(UTC)
    elif effective_doc_type == "Claim Form" and not plan.claim_form_storage_path and ext == ".pdf":
        plan.claim_form_filename = filename
        plan.claim_form_storage_path = storage_path
        plan.claim_form_mime_type = mime
        plan.updated_at = datetime.now(UTC)

    # Audit Trail
    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="INSURANCE_PLAN_DOCUMENT_UPLOADED",
        resource_type="insurance_plan_document",
        resource_id=doc.id,
        state_delta={
            "plan_id": str(plan_id),
            "document_type": effective_doc_type,
            "title": effective_title,
            "filename": filename,
            "size": len(content),
        },
        created_at=datetime.now(UTC),
    )
    session.add(audit)

    await session.commit()
    await session.refresh(doc)

    # Load uploaded_by for response
    doc_with_user = (
        await session.execute(
            select(InsurancePlanDocument)
            .options(selectinload(InsurancePlanDocument.uploaded_by))
            .where(InsurancePlanDocument.id == doc.id)
        )
    ).scalar_one()

    return PlanDocumentResponse.model_validate(doc_with_user)


@router.get(
    "/plans/{plan_id}/documents",
    response_model=list[PlanDocumentResponse],
    summary="List All Documents for a Plan",
)
async def list_plan_documents(
    plan_id: uuid.UUID,
    document_type: str | None = Query(default=None, description="Optional document type filter"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[PlanDocumentResponse]:
    """Retrieve all documents associated with a policy plan."""
    plan = (
        await session.execute(
            select(InsurancePlan).where(InsurancePlan.id == plan_id)
        )
    ).scalar_one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insurance Plan with ID '{plan_id}' not found.",
        )

    stmt = (
        select(InsurancePlanDocument)
        .options(selectinload(InsurancePlanDocument.uploaded_by))
        .where(InsurancePlanDocument.plan_id == plan_id)
    )
    if document_type and document_type != "ALL":
        normalized = _normalize_plan_doc_type(document_type)
        stmt = stmt.where(InsurancePlanDocument.document_type == normalized)

    stmt = stmt.order_by(InsurancePlanDocument.created_at.desc())
    docs = (await session.execute(stmt)).scalars().all()
    return [PlanDocumentResponse.model_validate(d) for d in docs]


@router.get(
    "/plans/{plan_id}/documents/{document_id}/download",
    summary="Download Plan Document (Attachment)",
)
async def download_plan_document(
    plan_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FileResponse:
    """Download plan document file as an attachment."""
    doc = (
        await session.execute(
            select(InsurancePlanDocument).where(
                InsurancePlanDocument.id == document_id,
                InsurancePlanDocument.plan_id == plan_id,
            )
        )
    ).scalar_one_or_none()
    if not doc or not Path(doc.storage_path).exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan document file not found on storage server.",
        )

    return FileResponse(
        path=doc.storage_path,
        media_type=doc.mime_type or "application/octet-stream",
        filename=doc.original_filename,
        content_disposition_type="attachment",
    )


@router.get(
    "/plans/{plan_id}/documents/{document_id}/view",
    summary="View Plan Document (Inline Preview)",
)
async def view_plan_document(
    plan_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FileResponse:
    """Stream plan document file for inline browser viewing (PDF/images)."""
    doc = (
        await session.execute(
            select(InsurancePlanDocument).where(
                InsurancePlanDocument.id == document_id,
                InsurancePlanDocument.plan_id == plan_id,
            )
        )
    ).scalar_one_or_none()
    if not doc or not Path(doc.storage_path).exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan document file not found on storage server.",
        )

    return FileResponse(
        path=doc.storage_path,
        media_type=doc.mime_type or "application/octet-stream",
        filename=doc.original_filename,
        content_disposition_type="inline",
    )


@router.put(
    "/plans/{plan_id}/documents/{document_id}",
    response_model=PlanDocumentResponse,
    summary="Update Plan Document Metadata or Replace File",
)
async def update_plan_document(
    plan_id: uuid.UUID,
    document_id: uuid.UUID,
    title: str | None = Form(default=None),
    document_type: str | None = Form(default=None),
    description: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PlanDocumentResponse:
    """Update document metadata or replace the document file."""
    doc = (
        await session.execute(
            select(InsurancePlanDocument).where(
                InsurancePlanDocument.id == document_id,
                InsurancePlanDocument.plan_id == plan_id,
            )
        )
    ).scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan document record not found.",
        )

    delta = {}

    if title is not None and title.strip():
        new_title = title.strip()
        delta["title"] = {"from": doc.title, "to": new_title}
        doc.title = new_title

    if document_type is not None and document_type.strip():
        new_type = _normalize_plan_doc_type(document_type.strip())
        delta["document_type"] = {"from": doc.document_type, "to": new_type}
        doc.document_type = new_type

    if description is not None:
        new_desc = description.strip() or None
        delta["description"] = {"from": doc.description, "to": new_desc}
        doc.description = new_desc

    # Handle file replacement if a new file is uploaded
    if file is not None and file.filename:
        filename = file.filename
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_PLAN_DOC_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{ext}'. Allowed extensions: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG.",
            )

        mime = file.content_type or "application/octet-stream"
        if mime not in ALLOWED_PLAN_DOC_MIMES and ext in ALLOWED_PLAN_DOC_EXTENSIONS:
            ext_to_mime = {
                ".pdf": "application/pdf",
                ".doc": "application/msword",
                ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xls": "application/vnd.ms-excel",
                ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
            }
            mime = ext_to_mime.get(ext, "application/octet-stream")

        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Replacement file is empty.")
        if len(content) > MAX_PLAN_DOC_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File exceeds 25MB limit.",
            )

        # Remove old physical file
        old_p = Path(doc.storage_path)
        if old_p.exists():
            old_p.unlink(missing_ok=True)

        sha256 = hashlib.sha256(content).hexdigest()
        clean_name = "".join(c for c in filename if c.isalnum() or c in "._- ")
        storage_name = f"plan_{plan_id}_{doc.id.hex[:8]}_{clean_name}"
        storage_path = str(PLAN_STORAGE_DIR / storage_name)

        with open(storage_path, "wb") as f_out:
            f_out.write(content)

        delta["file_replacement"] = {
            "from_filename": doc.original_filename,
            "to_filename": filename,
            "from_size": doc.file_size_bytes,
            "to_size": len(content),
        }
        doc.original_filename = filename
        doc.storage_path = storage_path
        doc.file_size_bytes = len(content)
        doc.mime_type = mime
        doc.sha256_hash = sha256

    doc.updated_at = datetime.now(UTC)

    if delta:
        audit = AuditLog(
            id=uuid.uuid4(),
            actor_id=current_user.id,
            action="INSURANCE_PLAN_DOCUMENT_UPDATED",
            resource_type="insurance_plan_document",
            resource_id=doc.id,
            state_delta=delta,
            created_at=datetime.now(UTC),
        )
        session.add(audit)

    await session.commit()
    await session.refresh(doc)

    doc_with_user = (
        await session.execute(
            select(InsurancePlanDocument)
            .options(selectinload(InsurancePlanDocument.uploaded_by))
            .where(InsurancePlanDocument.id == doc.id)
        )
    ).scalar_one()

    return PlanDocumentResponse.model_validate(doc_with_user)


@router.delete(
    "/plans/{plan_id}/documents/{document_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Plan Document",
)
async def delete_plan_document(
    plan_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Delete a plan document and remove its physical file from storage."""
    doc = (
        await session.execute(
            select(InsurancePlanDocument).where(
                InsurancePlanDocument.id == document_id,
                InsurancePlanDocument.plan_id == plan_id,
            )
        )
    ).scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan document record not found.",
        )

    file_name = doc.original_filename
    doc_title = doc.title
    p = Path(doc.storage_path)
    if p.exists():
        p.unlink(missing_ok=True)

    await session.delete(doc)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="INSURANCE_PLAN_DOCUMENT_DELETED",
        resource_type="insurance_plan_document",
        resource_id=document_id,
        state_delta={"plan_id": str(plan_id), "title": doc_title, "filename": file_name},
        created_at=datetime.now(UTC),
    )
    session.add(audit)

    await session.commit()

    return {
        "success": True,
        "message": f"Document '{doc_title}' was successfully deleted.",
    }



@router.get(
    "/purchase-parties",
    response_model=PaginatedResponse[PurchasePartyResponse],
    summary="List Purchase Parties (Paginated & Searchable)",
)
async def list_purchase_parties(
    search: str | None = Query(default=None, description="Search by name or code"),
    status_filter: str | None = Query(
        default=None, alias="status", description="active or inactive"
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=500),
    sort_by: str = Query(default="name", description="name, code, is_active, created_at"),
    sort_order: str = Query(default="asc"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[PurchasePartyResponse]:
    """Retrieve filtered, paginated Purchase Party records."""
    query = select(InsurancePurchaseParty)
    count_query = select(func.count(InsurancePurchaseParty.id))

    if search:
        pattern = f"%{search.strip().lower()}%"
        flt = or_(
            func.lower(InsurancePurchaseParty.name).like(pattern),
            func.lower(InsurancePurchaseParty.code).like(pattern),
        )
        query = query.where(flt)
        count_query = count_query.where(flt)

    if status_filter and status_filter != "ALL":
        is_active_val = status_filter.lower() in ("active", "true", "1")
        query = query.where(InsurancePurchaseParty.is_active.is_(is_active_val))
        count_query = count_query.where(InsurancePurchaseParty.is_active.is_(is_active_val))

    total = (await session.execute(count_query)).scalar() or 0

    sort_column = getattr(InsurancePurchaseParty, sort_by, InsurancePurchaseParty.name)
    if sort_order.lower() == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(sort_column)

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    parties = (await session.execute(query)).scalars().all()
    items = [PurchasePartyResponse.model_validate(p) for p in parties]
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/purchase-parties/{party_id}",
    response_model=PurchasePartyResponse,
    summary="Get Purchase Party Detail",
)
async def get_purchase_party_detail(
    party_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PurchasePartyResponse:
    """Retrieve details for a single Purchase Party."""
    stmt = select(InsurancePurchaseParty).where(
        InsurancePurchaseParty.id == party_id
    )
    party = (await session.execute(stmt)).scalar_one_or_none()
    if not party:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase Party with ID '{party_id}' not found.",
        )
    return PurchasePartyResponse.model_validate(party)


@router.post(
    "/purchase-parties",
    response_model=PurchasePartyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Purchase Party",
)
async def create_purchase_party(
    payload: PurchasePartyCreate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PurchasePartyResponse:
    """Create a new Purchase Party with unique code enforcement."""
    name_clean = payload.name.strip()
    code_clean = (
        payload.code.strip().upper()
        if payload.code and payload.code.strip()
        else _generate_purchase_party_code(name_clean)
    )

    # Check duplicate code
    stmt = select(InsurancePurchaseParty).where(
        func.lower(InsurancePurchaseParty.code) == code_clean.lower()
    )
    if (await session.execute(stmt)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Purchase Party code '{code_clean}' already exists in system.",
        )

    now = datetime.now(UTC)
    new_party = InsurancePurchaseParty(
        id=uuid.uuid4(),
        name=name_clean,
        code=code_clean,
        contact_person=payload.contact_person.strip() if payload.contact_person else None,
        email=payload.email.strip() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        address=payload.address.strip() if payload.address else None,
        notes=payload.notes.strip() if payload.notes else None,
        is_active=payload.is_active,
        created_at=now,
        updated_at=now,
    )
    session.add(new_party)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="PURCHASE_PARTY_CREATED",
        resource_type="insurance_purchase_party",
        resource_id=new_party.id,
        state_delta={"name": new_party.name, "code": new_party.code},
        created_at=now,
    )
    session.add(audit)
    await session.commit()
    await session.refresh(new_party)

    return PurchasePartyResponse.model_validate(new_party)


@router.put(
    "/purchase-parties/{party_id}",
    response_model=PurchasePartyResponse,
    summary="Update Purchase Party",
)
async def update_purchase_party(
    party_id: uuid.UUID,
    payload: PurchasePartyUpdate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PurchasePartyResponse:
    """Update Purchase Party details."""
    stmt = select(InsurancePurchaseParty).where(
        InsurancePurchaseParty.id == party_id
    )
    party = (await session.execute(stmt)).scalar_one_or_none()
    if not party:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase Party with ID '{party_id}' not found.",
        )

    delta: dict[str, Any] = {}

    if payload.name is not None:
        delta["name"] = {"from": party.name, "to": payload.name.strip()}
        party.name = payload.name.strip()

    if payload.code is not None:
        code_clean = payload.code.strip().upper()
        if code_clean != party.code:
            stmt_code = select(InsurancePurchaseParty).where(
                func.lower(InsurancePurchaseParty.code) == code_clean.lower(),
                InsurancePurchaseParty.id != party_id,
            )
            if (await session.execute(stmt_code)).scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Purchase Party code '{code_clean}' is already assigned to another party.",
                )
            delta["code"] = {"from": party.code, "to": code_clean}
            party.code = code_clean

    if payload.contact_person is not None:
        party.contact_person = payload.contact_person.strip() if payload.contact_person else None
    if payload.email is not None:
        party.email = payload.email.strip() if payload.email else None
    if payload.phone is not None:
        party.phone = payload.phone.strip() if payload.phone else None
    if payload.address is not None:
        party.address = payload.address.strip() if payload.address else None
    if payload.notes is not None:
        party.notes = payload.notes.strip() if payload.notes else None

    if payload.is_active is not None:
        delta["is_active"] = {"from": party.is_active, "to": payload.is_active}
        party.is_active = payload.is_active

    party.updated_at = datetime.now(UTC)

    if delta:
        audit = AuditLog(
            id=uuid.uuid4(),
            actor_id=current_user.id,
            action="PURCHASE_PARTY_UPDATED",
            resource_type="insurance_purchase_party",
            resource_id=party.id,
            state_delta=delta,
            created_at=datetime.now(UTC),
        )
        session.add(audit)

    await session.commit()
    await session.refresh(party)
    return PurchasePartyResponse.model_validate(party)


@router.patch(
    "/purchase-parties/{party_id}/status",
    response_model=PurchasePartyResponse,
    summary="Activate or Deactivate Purchase Party",
)
async def toggle_purchase_party_status(
    party_id: uuid.UUID,
    is_active: bool = Query(..., description="Target active state"),
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PurchasePartyResponse:
    """Toggle Purchase Party active status."""
    stmt = select(InsurancePurchaseParty).where(
        InsurancePurchaseParty.id == party_id
    )
    party = (await session.execute(stmt)).scalar_one_or_none()
    if not party:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase Party with ID '{party_id}' not found.",
        )

    old_status = party.is_active
    party.is_active = is_active
    party.updated_at = datetime.now(UTC)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="PURCHASE_PARTY_STATUS_CHANGED",
        resource_type="insurance_purchase_party",
        resource_id=party.id,
        state_delta={"is_active": {"from": old_status, "to": is_active}},
        created_at=datetime.now(UTC),
    )
    session.add(audit)
    await session.commit()
    await session.refresh(party)
    return PurchasePartyResponse.model_validate(party)


@router.delete(
    "/purchase-parties/{party_id}",
    status_code=status.HTTP_200_OK,
    summary="Safe Delete Purchase Party",
)
async def delete_purchase_party(
    party_id: uuid.UUID,
    current_user: User = Depends(require_admin_or_super_admin),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Safely delete Purchase Party."""
    stmt = select(InsurancePurchaseParty).where(
        InsurancePurchaseParty.id == party_id
    )
    party = (await session.execute(stmt)).scalar_one_or_none()
    if not party:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase Party with ID '{party_id}' not found.",
        )

    name = party.name
    code = party.code

    await session.delete(party)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="PURCHASE_PARTY_DELETED",
        resource_type="insurance_purchase_party",
        resource_id=party_id,
        state_delta={"name": name, "code": code},
        created_at=datetime.now(UTC),
    )
    session.add(audit)
    await session.commit()

    return {
        "success": True,
        "message": f"Purchase Party '{name}' ({code}) was successfully deleted.",
    }


# ===========================================================================
# EXPORT ENDPOINTS (CSV & Excel)
# ===========================================================================


@router.get(
    "/purchase-parties/export/csv",
    summary="Export Filtered Purchase Parties as CSV",
)
async def export_purchase_parties_csv(
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Export filtered Purchase Party records as CSV (authorized users only)."""
    query = select(InsurancePurchaseParty)
    if search:
        pattern = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(InsurancePurchaseParty.name).like(pattern),
                func.lower(InsurancePurchaseParty.code).like(pattern),
            )
        )
    if status_filter and status_filter != "ALL":
        is_active_val = status_filter.lower() in ("active", "true", "1")
        query = query.where(InsurancePurchaseParty.is_active.is_(is_active_val))

    query = query.order_by(InsurancePurchaseParty.name)
    parties = (await session.execute(query)).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Party ID",
        "Party Code",
        "Party Name",
        "Contact Person",
        "Email",
        "Phone",
        "Address",
        "Status",
        "Created At",
    ])

    for p in parties:
        writer.writerow([
            str(p.id),
            p.code,
            p.name,
            p.contact_person or "",
            p.email or "",
            p.phone or "",
            p.address or "",
            "Active" if p.is_active else "Inactive",
            p.created_at.strftime("%Y-%m-%d %H:%M:%S") if p.created_at else "",
        ])

    csv_data = output.getvalue()
    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    filename = f"purchase_parties_export_{timestamp}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get(
    "/purchase-parties/export/excel",
    summary="Export Filtered Purchase Parties for Excel",
)
async def export_purchase_parties_excel(
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Export filtered Purchase Party records as Excel-compatible CSV with UTF-8 BOM."""
    query = select(InsurancePurchaseParty)
    if search:
        pattern = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(InsurancePurchaseParty.name).like(pattern),
                func.lower(InsurancePurchaseParty.code).like(pattern),
            )
        )
    if status_filter and status_filter != "ALL":
        is_active_val = status_filter.lower() in ("active", "true", "1")
        query = query.where(InsurancePurchaseParty.is_active.is_(is_active_val))

    query = query.order_by(InsurancePurchaseParty.name)
    parties = (await session.execute(query)).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Party ID",
        "Party Code",
        "Party Name",
        "Contact Person",
        "Email",
        "Phone",
        "Address",
        "Status",
        "Created At",
    ])

    for p in parties:
        writer.writerow([
            str(p.id),
            p.code,
            p.name,
            p.contact_person or "",
            p.email or "",
            p.phone or "",
            p.address or "",
            "Active" if p.is_active else "Inactive",
            p.created_at.strftime("%Y-%m-%d %H:%M:%S") if p.created_at else "",
        ])

    # Prepend UTF-8 BOM so Excel opens non-ASCII characters without mangling
    content_bytes = "\ufeff".encode("utf-8") + output.getvalue().encode("utf-8")
    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    filename = f"purchase_parties_excel_{timestamp}.csv"

    return Response(
        content=content_bytes,
        media_type="application/vnd.ms-excel",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get(
    "/purchase-parties/export/pdf",
    summary="Export Filtered Purchase Parties as PDF",
)
async def export_purchase_parties_pdf(
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Export filtered Purchase Party records as a binary downloadable PDF."""
    query = select(InsurancePurchaseParty)
    if search:
        pattern = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(InsurancePurchaseParty.name).like(pattern),
                func.lower(InsurancePurchaseParty.code).like(pattern),
            )
        )
    if status_filter and status_filter != "ALL":
        is_active_val = status_filter.lower() in ("active", "true", "1")
        query = query.where(InsurancePurchaseParty.is_active.is_(is_active_val))

    query = query.order_by(InsurancePurchaseParty.name)
    parties = (await session.execute(query)).scalars().all()

    pdf_bytes = generate_purchase_parties_pdf(parties)
    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    filename = f"purchase_parties_{timestamp}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


# ===========================================================================
# E. PRESERVED ACTUARIAL CALCULATOR & POLICIES ENDPOINTS
# ===========================================================================


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


@router.get(
    "/categories",
    summary="Get Canonical Insurance Categories",
)
async def get_insurance_categories(
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Retrieve standard canonical insurance categories, codes, and display metadata."""
    return CANONICAL_CATEGORIES

