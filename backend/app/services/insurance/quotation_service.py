"""Custom Health Quotation Generator Service for FinNexus Insurance Engine.

Module 6: Production-ready service handling:
- Exact calendar age calculation in Years, Months, and Days
- Standardized Sum Insured tiers (5L, 7.5L, 10L, 15L, 20L, 25L, 50L, 1CR, 2CR)
- Dynamic Row & Column Filtering (hiding unpopulated rows and columns in preview/exports)
- Normalized database persistence (Quotation, Members, CompanyPlans, Premiums)
- Real PDF generation via PyMuPDF (Landscape A4)
- Real Excel generation via OpenPyXL (.xlsx with styling & currency formatting)
- Real High-Resolution Image generation via PyMuPDF Pixmap
- Audit logging and RBAC / Tenant isolation
"""

from __future__ import annotations

import calendar
import io
from pathlib import Path
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any, Sequence

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
import pymupdf
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.audit import AuditLog
from app.db.models.auth import User
from app.db.models.crm import Customer
from app.db.models.insurance import (
    HealthQuotation,
    HealthQuotationCompanyPlan,
    HealthQuotationMember,
    HealthQuotationPremium,
    InsuranceCompany,
    InsurancePlan,
)
from app.schemas.insurance import (
    HealthQuotationCompanyPlanInput,
    HealthQuotationCreate,
    HealthQuotationMemberInput,
    HealthQuotationPremiumInput,
    HealthQuotationUpdate,
)

# ---------------------------------------------------------------------------
# Constants & Enforcements
# ---------------------------------------------------------------------------

EXACT_DISCLAIMER = (
    "THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE"
)

# Standardized Sum Insured comparison tiers in strict order
SUM_INSURED_TIERS: list[dict[str, Any]] = [
    {"code": "5L", "amount": Decimal("500000"), "label": "5L"},
    {"code": "7.5L", "amount": Decimal("750000"), "label": "7.5L"},
    {"code": "10L", "amount": Decimal("1000000"), "label": "10L"},
    {"code": "15L", "amount": Decimal("1500000"), "label": "15L"},
    {"code": "20L", "amount": Decimal("2000000"), "label": "20L"},
    {"code": "25L", "amount": Decimal("2500000"), "label": "25L"},
    {"code": "50L", "amount": Decimal("5000000"), "label": "50L"},
    {"code": "1CR", "amount": Decimal("10000000"), "label": "1CR"},
    {"code": "2CR", "amount": Decimal("20000000"), "label": "2CR"},
]

TIER_ORDER: dict[str, int] = {tier["code"]: idx for idx, tier in enumerate(SUM_INSURED_TIERS)}
TIER_AMOUNT_MAP: dict[str, Decimal] = {tier["code"]: tier["amount"] for tier in SUM_INSURED_TIERS}

# Default comparison templates
DEFAULT_COMPANY_PLANS: list[dict[str, Any]] = [
    {"display_company_name": "HDFC ERGO", "display_plan_variant": "(with HC)", "display_order": 0},
    {"display_company_name": "NIVA BUPA", "display_plan_variant": "(with HC)", "display_order": 1},
    {"display_company_name": "TATA AIG", "display_plan_variant": "Medicare Select", "display_order": 2},
    {"display_company_name": "TATA AIG", "display_plan_variant": "Medicare Premier", "display_order": 3},
]

# High-fidelity vector typography assets
FONTS_DIR = Path(__file__).resolve().parents[2] / "assets" / "fonts"
FONT_REGULAR_PATH = str(FONTS_DIR / "QuotationFont-Regular.ttf")
FONT_BOLD_PATH = str(FONTS_DIR / "QuotationFont-Bold.ttf")
HAS_CUSTOM_FONTS = Path(FONT_REGULAR_PATH).exists() and Path(FONT_BOLD_PATH).exists()



# ---------------------------------------------------------------------------
# Exact Age Calculator (Phase 5)
# ---------------------------------------------------------------------------

def calculate_exact_age(dob: date, ref_date: date) -> tuple[int, int, int]:
    """Calculate exact age as (years, months, days) from dob to ref_date.

    Correctly handles:
    - Different month lengths (28, 29, 30, 31)
    - Leap years & Feb 29 birthdays (anniversary on Feb 28 in non-leap years)
    - End-of-month dates (e.g. Jan 31 -> Feb 28)
    - Rejects invalid / future dates
    """
    if dob > ref_date:
        raise ValueError("Date of birth cannot be in the future relative to quotation reference date.")

    years = ref_date.year - dob.year
    dob_month = dob.month
    dob_day = dob.day

    def get_anniversary(year: int, month: int, day: int) -> date:
        max_days = calendar.monthrange(year, month)[1]
        return date(year, month, min(day, max_days))

    this_year_anniversary = get_anniversary(ref_date.year, dob_month, dob_day)
    if ref_date < this_year_anniversary:
        years -= 1

    cur_year = dob.year + years
    cur_month = dob_month

    months = 0
    while True:
        next_month = cur_month + 1
        next_year = cur_year
        if next_month > 12:
            next_month = 1
            next_year += 1

        next_date = get_anniversary(next_year, next_month, dob_day)
        if next_date <= ref_date:
            months += 1
            cur_year = next_year
            cur_month = next_month
        else:
            break

    last_milestone = get_anniversary(cur_year, cur_month, dob_day)
    days = (ref_date - last_milestone).days

    return years, months, days


def format_inr(amount: Decimal | float | int | None) -> str:
    """Format numeric value into standard Indian currency format."""
    if amount is None or amount == "":
        return "—"
    amt = int(round(float(amount)))
    s = str(amt)
    if len(s) <= 3:
        return f"₹{s}"
    last_three = s[-3:]
    remaining = s[:-3]
    chunks = []
    while len(remaining) > 2:
        chunks.append(remaining[-2:])
        remaining = remaining[:-2]
    if remaining:
        chunks.append(remaining)
    chunks.reverse()
    formatted = ",".join(chunks) + "," + last_three
    return f"₹{formatted}"


# ---------------------------------------------------------------------------
# Dynamic Row & Column Filtering (Phase 10)
# ---------------------------------------------------------------------------

def build_filtered_matrix(company_plans: Sequence[HealthQuotationCompanyPlan]) -> dict[str, Any]:
    """Dynamically filter matrix rows and columns.

    Row filtering: Show row IF at least one valid premium cell is populated (> 0).
    Column filtering: Show column IF at least one visible row has a valid premium in that column.
    Preserves standardized column tier order.
    """
    visible_rows = []
    populated_column_codes: set[str] = set()

    for cp in sorted(company_plans, key=lambda x: x.display_order):
        row_premiums: dict[str, Decimal] = {}
        for p in cp.premiums:
            if p.premium_amount is not None and p.premium_amount > 0:
                row_premiums[p.sum_insured_code] = p.premium_amount
                populated_column_codes.add(p.sum_insured_code)

        if row_premiums:
            visible_rows.append({
                "plan_id": cp.id,
                "display_company_name": cp.display_company_name,
                "display_plan_variant": cp.display_plan_variant,
                "notes": cp.notes,
                "premiums_by_tier": row_premiums,
            })

    visible_columns = [
        tier for tier in SUM_INSURED_TIERS if tier["code"] in populated_column_codes
    ]

    return {
        "columns": visible_columns,
        "rows": visible_rows,
    }


# ---------------------------------------------------------------------------
# Quotation Number Sequence Generator
# ---------------------------------------------------------------------------

async def generate_quotation_number(session: AsyncSession) -> str:
    """Generate unique sequential quotation number in format HQ-YYYY-XXXXX."""
    year = date.today().year
    prefix = f"HQ-{year}-"
    stmt = (
        select(HealthQuotation.quotation_number)
        .where(HealthQuotation.quotation_number.like(f"{prefix}%"))
        .order_by(desc(HealthQuotation.quotation_number))
        .limit(1)
    )
    result = await session.execute(stmt)
    latest = result.scalar_one_or_none()

    if latest:
        try:
            seq = int(latest.split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1

    return f"{prefix}{seq:05d}"


# ---------------------------------------------------------------------------
# Service CRUD Operations
# ---------------------------------------------------------------------------

async def create_health_quotation(
    session: AsyncSession,
    payload: HealthQuotationCreate,
    current_user: User,
) -> HealthQuotation:
    """Create and persist a new Custom Health Quotation with members and company/plan matrix."""
    # 1. Generate Quotation Number
    q_number = await generate_quotation_number(session)

    # 2. Quotation Title (Default: "[Advisor Name] Premium Health Quotation")
    advisor_name = current_user.full_name or "Advisor"
    title = (payload.quotation_title or "").strip()
    if not title:
        title = f"{advisor_name} Premium Health Quotation"

    ref_date = payload.quotation_date or date.today()

    # 3. Create Quotation Header
    quotation = HealthQuotation(
        quotation_number=q_number,
        quotation_title=title,
        client_id=payload.client_id,
        client_name=payload.client_name.strip(),
        advisor_id=current_user.id,
        advisor_name=advisor_name,
        quotation_date=ref_date,
        pin_code=payload.pin_code.strip(),
        contact_number=payload.contact_number,
        contact_email=payload.contact_email,
        notes=payload.notes,
        disclaimer_snapshot=EXACT_DISCLAIMER,
        premium_basis=payload.premium_basis or "GROSS",
        status=payload.status or "DRAFT",
        tenant_id=getattr(current_user, "tenant_id", None),
    )
    session.add(quotation)
    await session.flush()

    # 4. Add Family Members with Exact Age Snapshot
    for idx, m in enumerate(payload.members):
        years, months, days = calculate_exact_age(m.date_of_birth, ref_date)
        member = HealthQuotationMember(
            quotation_id=quotation.id,
            customer_id=m.customer_id,
            full_name=m.full_name.strip(),
            relationship=m.relationship,
            gender=m.gender,
            date_of_birth=m.date_of_birth,
            reference_date=ref_date,
            age_years=years,
            age_months=months,
            age_days=days,
            is_primary=m.is_primary or (idx == 0),
            display_order=m.display_order if m.display_order is not None else idx,
        )
        session.add(member)

    # 5. Add Company/Plan Rows and Premium cells
    plans_to_add = payload.company_plans
    if not plans_to_add:
        # Prepopulate default templates if none passed
        plans_to_add = [
            HealthQuotationCompanyPlanInput(**tmpl)
            for tmpl in DEFAULT_COMPANY_PLANS
        ]

    for p_idx, plan_in in enumerate(plans_to_add):
        c_plan = HealthQuotationCompanyPlan(
            quotation_id=quotation.id,
            insurance_company_id=plan_in.insurance_company_id,
            insurance_plan_id=plan_in.insurance_plan_id,
            display_company_name=plan_in.display_company_name.strip(),
            display_plan_variant=plan_in.display_plan_variant.strip(),
            notes=plan_in.notes,
            display_order=plan_in.display_order if plan_in.display_order is not None else p_idx,
        )
        session.add(c_plan)
        await session.flush()

        for prem_in in plan_in.premiums:
            if prem_in.premium_amount is not None and prem_in.premium_amount > 0:
                tier_code = prem_in.sum_insured_code
                si_amount = prem_in.sum_insured or TIER_AMOUNT_MAP.get(tier_code, Decimal("0"))
                prem = HealthQuotationPremium(
                    quotation_company_plan_id=c_plan.id,
                    sum_insured=si_amount,
                    sum_insured_code=tier_code,
                    premium_amount=prem_in.premium_amount,
                    premium_basis=prem_in.premium_basis or quotation.premium_basis,
                )
                session.add(prem)

    # 6. Record Audit Log
    audit = AuditLog(
        actor_id=current_user.id,
        action="CREATE",
        resource_type="health_quotation",
        resource_id=quotation.id,
        state_delta={
            "quotation_number": quotation.quotation_number,
            "client_name": quotation.client_name,
            "members_count": len(payload.members),
            "plans_count": len(plans_to_add),
        },
    )
    session.add(audit)
    await session.commit()
    loaded = await get_health_quotation_by_id(session, quotation.id)
    return loaded  # type: ignore[return-value]


async def get_health_quotation_by_id(
    session: AsyncSession,
    quotation_id: uuid.UUID,
    user: User | None = None,
) -> HealthQuotation | None:
    """Fetch quotation by ID with fully loaded members and company plans."""
    stmt = (
        select(HealthQuotation)
        .options(
            selectinload(HealthQuotation.members),
            selectinload(HealthQuotation.company_plans).selectinload(HealthQuotationCompanyPlan.premiums),
            selectinload(HealthQuotation.client),
            selectinload(HealthQuotation.advisor),
        )
        .execution_options(populate_existing=True)
        .where(HealthQuotation.id == quotation_id)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def list_health_quotations(
    session: AsyncSession,
    current_user: User,
    search: str | None = None,
    status_filter: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> tuple[list[dict[str, Any]], int]:
    """List quotations with search, filtering, pagination, and calculated counts."""
    query = select(HealthQuotation).options(
        selectinload(HealthQuotation.members),
        selectinload(HealthQuotation.company_plans).selectinload(HealthQuotationCompanyPlan.premiums),
    )

    # Tenant isolation
    if getattr(current_user, "tenant_id", None):
        query = query.where(HealthQuotation.tenant_id == current_user.tenant_id)

    # Search filter
    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            or_(
                HealthQuotation.quotation_number.ilike(s),
                HealthQuotation.quotation_title.ilike(s),
                HealthQuotation.client_name.ilike(s),
                HealthQuotation.pin_code.ilike(s),
            )
        )

    # Status filter
    if status_filter and status_filter.upper() != "ALL":
        query = query.where(HealthQuotation.status == status_filter.upper())

    # Date range filters
    if from_date:
        query = query.where(HealthQuotation.quotation_date >= from_date)
    if to_date:
        query = query.where(HealthQuotation.quotation_date <= to_date)

    # Count total
    count_stmt = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    # Sorting
    sort_column = getattr(HealthQuotation, sort_by, HealthQuotation.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await session.execute(query)
    quotes = result.scalars().all()

    items = []
    for q in quotes:
        # Calculate populated plans count
        populated_count = sum(
            1 for cp in q.company_plans
            if any(p.premium_amount and p.premium_amount > 0 for p in cp.premiums)
        )
        items.append({
            "id": q.id,
            "quotation_number": q.quotation_number,
            "quotation_title": q.quotation_title,
            "client_id": q.client_id,
            "client_name": q.client_name,
            "advisor_id": q.advisor_id,
            "advisor_name": q.advisor_name,
            "quotation_date": q.quotation_date,
            "pin_code": q.pin_code,
            "status": q.status,
            "premium_basis": q.premium_basis,
            "members_count": len(q.members),
            "populated_plans_count": populated_count,
            "created_at": q.created_at,
            "updated_at": q.updated_at,
        })

    return items, total


async def get_health_quotation_stats(
    session: AsyncSession,
    current_user: User,
) -> dict[str, int]:
    """Retrieve real database aggregate statistics: total, issued, draft, and members_evaluated."""
    tenant_id = getattr(current_user, "tenant_id", None)

    # 1. Total Quotations
    total_q = select(func.count(HealthQuotation.id))
    if tenant_id:
        total_q = total_q.where(HealthQuotation.tenant_id == tenant_id)
    total = (await session.execute(total_q)).scalar() or 0

    # 2. Issued Quotations
    issued_q = select(func.count(HealthQuotation.id)).where(HealthQuotation.status == "ISSUED")
    if tenant_id:
        issued_q = issued_q.where(HealthQuotation.tenant_id == tenant_id)
    issued = (await session.execute(issued_q)).scalar() or 0

    # 3. Draft Quotations
    draft_q = select(func.count(HealthQuotation.id)).where(HealthQuotation.status == "DRAFT")
    if tenant_id:
        draft_q = draft_q.where(HealthQuotation.tenant_id == tenant_id)
    draft = (await session.execute(draft_q)).scalar() or 0

    # 4. Total Members Evaluated across quotations
    members_q = (
        select(func.count(HealthQuotationMember.id))
        .select_from(HealthQuotationMember)
        .join(HealthQuotation, HealthQuotationMember.quotation_id == HealthQuotation.id)
    )
    if tenant_id:
        members_q = members_q.where(HealthQuotation.tenant_id == tenant_id)
    members_count = (await session.execute(members_q)).scalar() or 0

    return {
        "total": total,
        "issued": issued,
        "draft": draft,
        "members_evaluated": members_count,
    }



async def update_health_quotation(
    session: AsyncSession,
    quotation_id: uuid.UUID,
    payload: HealthQuotationUpdate,
    current_user: User,
) -> HealthQuotation:
    """Update existing quotation, members, and comparison matrix."""
    quotation = await get_health_quotation_by_id(session, quotation_id)
    if not quotation:
        raise ValueError(f"Quotation {quotation_id} not found.")

    ref_date = payload.quotation_date or quotation.quotation_date

    # Update header metadata
    if payload.quotation_title is not None:
        quotation.quotation_title = payload.quotation_title.strip()
    if payload.quotation_date is not None:
        quotation.quotation_date = payload.quotation_date
    if payload.client_id is not None:
        quotation.client_id = payload.client_id
    if payload.client_name is not None:
        quotation.client_name = payload.client_name.strip()
    if payload.pin_code is not None:
        quotation.pin_code = payload.pin_code.strip()
    if payload.contact_number is not None:
        quotation.contact_number = payload.contact_number
    if payload.contact_email is not None:
        quotation.contact_email = payload.contact_email
    if payload.notes is not None:
        quotation.notes = payload.notes
    if payload.premium_basis is not None:
        quotation.premium_basis = payload.premium_basis
    if payload.status is not None:
        quotation.status = payload.status

    # Always ensure exact disclaimer
    quotation.disclaimer_snapshot = EXACT_DISCLAIMER

    # Update members if provided
    if payload.members is not None:
        new_members = []
        for idx, m in enumerate(payload.members):
            years, months, days = calculate_exact_age(m.date_of_birth, ref_date)
            new_m = HealthQuotationMember(
                quotation_id=quotation.id,
                customer_id=m.customer_id,
                full_name=m.full_name.strip(),
                relationship=m.relationship,
                gender=m.gender,
                date_of_birth=m.date_of_birth,
                reference_date=ref_date,
                age_years=years,
                age_months=months,
                age_days=days,
                is_primary=m.is_primary or (idx == 0),
                display_order=m.display_order if m.display_order is not None else idx,
            )
            new_members.append(new_m)
        quotation.members = new_members

    # Update company plans & premiums if provided
    if payload.company_plans is not None:
        new_plans = []
        for p_idx, plan_in in enumerate(payload.company_plans):
            c_plan = HealthQuotationCompanyPlan(
                quotation_id=quotation.id,
                insurance_company_id=plan_in.insurance_company_id,
                insurance_plan_id=plan_in.insurance_plan_id,
                display_company_name=plan_in.display_company_name.strip(),
                display_plan_variant=plan_in.display_plan_variant.strip(),
                notes=plan_in.notes,
                display_order=plan_in.display_order if plan_in.display_order is not None else p_idx,
            )
            for prem_in in plan_in.premiums:
                if prem_in.premium_amount is not None and prem_in.premium_amount > 0:
                    tier_code = prem_in.sum_insured_code
                    si_amount = prem_in.sum_insured or TIER_AMOUNT_MAP.get(tier_code, Decimal("0"))
                    prem = HealthQuotationPremium(
                        sum_insured=si_amount,
                        sum_insured_code=tier_code,
                        premium_amount=prem_in.premium_amount,
                        premium_basis=prem_in.premium_basis or quotation.premium_basis,
                    )
                    c_plan.premiums.append(prem)
            new_plans.append(c_plan)
        quotation.company_plans = new_plans

    # Audit log
    audit = AuditLog(
        actor_id=current_user.id,
        action="UPDATE",
        resource_type="health_quotation",
        resource_id=quotation.id,
        state_delta={
            "quotation_number": quotation.quotation_number,
            "status": quotation.status,
            "updated_at": datetime.now(UTC).isoformat(),
        },
    )
    session.add(audit)
    await session.commit()
    return await get_health_quotation_by_id(session, quotation_id)  # type: ignore[return-value]


async def duplicate_health_quotation(
    session: AsyncSession,
    quotation_id: uuid.UUID,
    current_user: User,
) -> HealthQuotation:
    """Duplicate an existing quotation as a fresh DRAFT with new quotation number."""
    original = await get_health_quotation_by_id(session, quotation_id)
    if not original:
        raise ValueError(f"Quotation {quotation_id} not found.")

    new_number = await generate_quotation_number(session)
    advisor_name = current_user.full_name or original.advisor_name

    dup = HealthQuotation(
        quotation_number=new_number,
        quotation_title=f"Copy of {original.quotation_title}",
        client_id=original.client_id,
        client_name=original.client_name,
        advisor_id=current_user.id,
        advisor_name=advisor_name,
        quotation_date=date.today(),
        pin_code=original.pin_code,
        contact_number=original.contact_number,
        contact_email=original.contact_email,
        notes=original.notes,
        disclaimer_snapshot=EXACT_DISCLAIMER,
        premium_basis=original.premium_basis,
        status="DRAFT",
        tenant_id=getattr(current_user, "tenant_id", None),
    )
    session.add(dup)
    await session.flush()

    # Duplicate members with age snapshot
    today = date.today()
    for m in original.members:
        years, months, days = calculate_exact_age(m.date_of_birth, today)
        new_m = HealthQuotationMember(
            quotation_id=dup.id,
            customer_id=m.customer_id,
            full_name=m.full_name,
            relationship=m.relationship,
            gender=m.gender,
            date_of_birth=m.date_of_birth,
            reference_date=today,
            age_years=years,
            age_months=months,
            age_days=days,
            is_primary=m.is_primary,
            display_order=m.display_order,
        )
        session.add(new_m)

    # Duplicate company plans and premiums
    for cp in original.company_plans:
        new_cp = HealthQuotationCompanyPlan(
            quotation_id=dup.id,
            insurance_company_id=cp.insurance_company_id,
            insurance_plan_id=cp.insurance_plan_id,
            display_company_name=cp.display_company_name,
            display_plan_variant=cp.display_plan_variant,
            notes=cp.notes,
            display_order=cp.display_order,
        )
        session.add(new_cp)
        await session.flush()

        for p in cp.premiums:
            new_p = HealthQuotationPremium(
                quotation_company_plan_id=new_cp.id,
                sum_insured=p.sum_insured,
                sum_insured_code=p.sum_insured_code,
                premium_amount=p.premium_amount,
                premium_basis=p.premium_basis,
            )
            session.add(new_p)

    audit = AuditLog(
        actor_id=current_user.id,
        action="DUPLICATE",
        resource_type="health_quotation",
        resource_id=dup.id,
        state_delta={
            "source_quotation_id": str(original.id),
            "new_quotation_number": dup.quotation_number,
        },
    )
    session.add(audit)
    await session.commit()
    return await get_health_quotation_by_id(session, dup.id)  # type: ignore[return-value]


async def delete_health_quotation(
    session: AsyncSession,
    quotation_id: uuid.UUID,
    current_user: User,
) -> bool:
    """Delete a quotation record with audit log."""
    quotation = await get_health_quotation_by_id(session, quotation_id)
    if not quotation:
        return False

    audit = AuditLog(
        actor_id=current_user.id,
        action="DELETE",
        resource_type="health_quotation",
        resource_id=quotation.id,
        state_delta={
            "quotation_number": quotation.quotation_number,
            "client_name": quotation.client_name,
        },
    )
    session.add(audit)
    await session.delete(quotation)
    await session.commit()
    return True


# ---------------------------------------------------------------------------
# PDF Export (Phase 12) & Image Export (Phase 14) via PyMuPDF
# ---------------------------------------------------------------------------

def _render_quotation_pymupdf_doc(quotation: HealthQuotation) -> pymupdf.Document:
    """Construct an enterprise-grade A4 Landscape vector document for proposal PDF and image exports.
    
    Supports:
    - Segoe UI vector typography with crisp Indian Rupee (₹) glyphs
    - Strict column boundaries with sub-pixel alignment
    - Dynamic row and column filtering
    - Automatic multi-page pagination for complex proposals
    - Repeating table headers on subsequent pages
    - True dynamic page numbering ('Page X of Y')
    """
    matrix = build_filtered_matrix(quotation.company_plans)
    columns = matrix["columns"]
    rows = matrix["rows"]

    doc = pymupdf.open()
    page_width, page_height = 841.89, 595.28  # A4 Landscape (pt)
    margin_x = 36.0
    margin_top = 32.0
    usable_width = page_width - (2 * margin_x)  # 769.89 pt
    footer_reserve = 38.0
    max_content_y = page_height - footer_reserve

    # Determine fonts
    f_reg_name = "qfont" if HAS_CUSTOM_FONTS else "helv"
    f_bld_name = "qfont-bold" if HAS_CUSTOM_FONTS else "helv"

    # Preload font metrics for accurate text length calculation
    font_reg_metric = pymupdf.Font(fontfile=FONT_REGULAR_PATH) if HAS_CUSTOM_FONTS else pymupdf.Font("helv")
    font_bld_metric = pymupdf.Font(fontfile=FONT_BOLD_PATH) if HAS_CUSTOM_FONTS else pymupdf.Font("helv")

    def register_fonts(p: pymupdf.Page) -> None:
        if HAS_CUSTOM_FONTS:
            p.insert_font(fontname="qfont", fontfile=FONT_REGULAR_PATH)
            p.insert_font(fontname="qfont-bold", fontfile=FONT_BOLD_PATH)

    def measure_text(text: str, fontsize: float, bold: bool = False) -> float:
        metric = font_bld_metric if bold else font_reg_metric
        try:
            return metric.text_length(text, fontsize=fontsize)
        except Exception:
            return len(text) * fontsize * 0.55

    # Helper to draw aligned text within column
    def draw_text_aligned(
        p: pymupdf.Page,
        text: str,
        x: float,
        y: float,
        width: float,
        align: str = "left",
        fontsize: float = 8.0,
        bold: bool = False,
        color: tuple[float, float, float] = (0.1, 0.1, 0.1),
        padding: float = 6.0,
    ) -> None:
        fontname = f_bld_name if bold else f_reg_name
        t_len = measure_text(text, fontsize, bold=bold)
        if align == "center":
            draw_x = x + (width - t_len) / 2.0
        elif align == "right":
            draw_x = x + width - padding - t_len
        else:
            draw_x = x + padding
        p.insert_text(
            (draw_x, y),
            text,
            fontsize=fontsize,
            fontname=fontname,
            color=color,
        )

    # Helper to draw wrapped text
    def draw_wrapped_text(
        p: pymupdf.Page,
        text: str,
        x: float,
        start_y: float,
        max_width: float,
        fontsize: float = 7.5,
        bold: bool = False,
        color: tuple[float, float, float] = (0.2, 0.2, 0.2),
        line_height: float = 11.0,
    ) -> float:
        fontname = f_bld_name if bold else f_reg_name
        words = text.split(" ")
        current_line: list[str] = []
        cur_y = start_y
        for word in words:
            test_line = " ".join(current_line + [word])
            if measure_text(test_line, fontsize, bold=bold) <= max_width:
                current_line.append(word)
            else:
                if current_line:
                    p.insert_text((x, cur_y), " ".join(current_line), fontsize=fontsize, fontname=fontname, color=color)
                    cur_y += line_height
                    current_line = [word]
                else:
                    p.insert_text((x, cur_y), word, fontsize=fontsize, fontname=fontname, color=color)
                    cur_y += line_height
                    current_line = []
        if current_line:
            p.insert_text((x, cur_y), " ".join(current_line), fontsize=fontsize, fontname=fontname, color=color)
            cur_y += line_height
        return cur_y

    # Page 1
    page = doc.new_page(width=page_width, height=page_height)
    register_fonts(page)

    # 1. Primary Header Banner (Executive Deep Navy)
    hdr_h = 46.0
    page.draw_rect(
        pymupdf.Rect(margin_x, margin_top, margin_x + usable_width, margin_top + hdr_h),
        color=None,
        fill=(0.06, 0.09, 0.16),
    )
    # Subtitle
    page.insert_text(
        (margin_x + 14, margin_top + 16),
        "FINNEXUS INSURANCE ENGINE  |  HEALTH ADVISORY PORTFOLIO",
        fontsize=8.0,
        fontname=f_bld_name,
        color=(0.55, 0.68, 0.90),
    )
    # Title
    disp_title = (quotation.quotation_title or "Health Insurance Quotation").upper()
    title_size = 11.0 if measure_text(disp_title, 13.0, bold=True) > 460 else 13.0
    page.insert_text(
        (margin_x + 14, margin_top + 34),
        disp_title,
        fontsize=title_size,
        fontname=f_bld_name,
        color=(1.0, 1.0, 1.0),
    )
    # Right meta: Quotation No
    q_num_text = f"Proposal No: {quotation.quotation_number}"
    q_num_len = measure_text(q_num_text, 9.5, bold=True)
    page.insert_text(
        (margin_x + usable_width - 16 - q_num_len, margin_top + 18),
        q_num_text,
        fontsize=9.5,
        fontname=f_bld_name,
        color=(1.0, 1.0, 1.0),
    )
    # Right meta: Date & PIN
    q_date_str = quotation.quotation_date.strftime("%d-%m-%Y")
    date_pin_text = f"Date: {q_date_str}   |   Client PIN: {quotation.pin_code}"
    date_pin_len = measure_text(date_pin_text, 8.5, bold=False)
    page.insert_text(
        (margin_x + usable_width - 16 - date_pin_len, margin_top + 33),
        date_pin_text,
        fontsize=8.5,
        fontname=f_reg_name,
        color=(0.75, 0.82, 0.95),
    )

    # 2. Disclaimer Banner (Warm Amber Alert)
    y_disc = margin_top + hdr_h + 8.0
    disc_h = 22.0
    page.draw_rect(
        pymupdf.Rect(margin_x, y_disc, margin_x + usable_width, y_disc + disc_h),
        color=(0.88, 0.65, 0.20),
        fill=(1.0, 0.97, 0.88),
    )
    page.insert_text(
        (margin_x + 12, y_disc + 14.5),
        "STATUTORY NOTICE:",
        fontsize=8.0,
        fontname=f_bld_name,
        color=(0.70, 0.35, 0.05),
    )
    page.insert_text(
        (margin_x + 110, y_disc + 14.5),
        EXACT_DISCLAIMER,
        fontsize=8.0,
        fontname=f_bld_name,
        color=(0.58, 0.28, 0.05),
    )

    # 3. Client & Advisor Metadata Bar
    y_meta = y_disc + disc_h + 8.0
    meta_h = 26.0
    page.draw_rect(
        pymupdf.Rect(margin_x, y_meta, margin_x + usable_width, y_meta + meta_h),
        color=(0.85, 0.88, 0.93),
        fill=(0.96, 0.97, 0.99),
    )
    basis_label = "Gross Premium (Incl. 18% GST)" if quotation.premium_basis == "GROSS" else "Net Premium (Excl. Tax)"
    col_w_meta = usable_width / 4.0

    # 4 columns in metadata bar:
    page.insert_text((margin_x + 10, y_meta + 10), "PROPOSER CLIENT", fontsize=6.5, fontname=f_bld_name, color=(0.45, 0.50, 0.60))
    page.insert_text((margin_x + 10, y_meta + 20), quotation.client_name, fontsize=8.5, fontname=f_bld_name, color=(0.08, 0.12, 0.20))

    page.insert_text((margin_x + col_w_meta + 10, y_meta + 10), "ADVISOR / REPRESENTATIVE", fontsize=6.5, fontname=f_bld_name, color=(0.45, 0.50, 0.60))
    page.insert_text((margin_x + col_w_meta + 10, y_meta + 20), quotation.advisor_name or "Financial Advisor", fontsize=8.5, fontname=f_bld_name, color=(0.08, 0.12, 0.20))

    page.insert_text((margin_x + (col_w_meta * 2) + 10, y_meta + 10), "POSTAL PIN CODE", fontsize=6.5, fontname=f_bld_name, color=(0.45, 0.50, 0.60))
    page.insert_text((margin_x + (col_w_meta * 2) + 10, y_meta + 20), quotation.pin_code, fontsize=8.5, fontname=f_bld_name, color=(0.08, 0.12, 0.20))

    page.insert_text((margin_x + (col_w_meta * 3) + 10, y_meta + 10), "PREMIUM BASIS", fontsize=6.5, fontname=f_bld_name, color=(0.45, 0.50, 0.60))
    page.insert_text((margin_x + (col_w_meta * 3) + 10, y_meta + 20), basis_label, fontsize=8.5, fontname=f_bld_name, color=(0.15, 0.35, 0.70))

    # 4. Family Members Table
    curr_y = y_meta + meta_h + 12.0
    page.insert_text(
        (margin_x, curr_y + 9),
        "INSURED FAMILY MEMBERS & EXACT CALENDAR AGE EVALUATION",
        fontsize=9.0,
        fontname=f_bld_name,
        color=(0.08, 0.12, 0.22),
    )
    page.insert_text(
        (margin_x + 365, curr_y + 9),
        f"(Exact age in Years, Months, and Days calculated authoritatively against reference date {q_date_str})",
        fontsize=7.5,
        fontname=f_reg_name,
        color=(0.45, 0.50, 0.60),
    )
    curr_y += 14.0

    # Family Table Column widths (sum = 769.89 pt exactly)
    fam_col_widths = [32.0, 195.0, 110.0, 75.0, 110.0, 80.0, 80.0, 87.89]
    fam_headers = [
        ("#", "center"),
        ("Member Full Name", "left"),
        ("Relationship", "left"),
        ("Gender", "center"),
        ("DOB (DD-MM-YYYY)", "center"),
        ("AGE (Years)", "center"),
        ("MON (Months)", "center"),
        ("DAYS", "center"),
    ]

    def draw_family_table_header(p: pymupdf.Page, y: float) -> float:
        h_height = 18.0
        p.draw_rect(
            pymupdf.Rect(margin_x, y, margin_x + usable_width, y + h_height),
            color=None,
            fill=(0.14, 0.18, 0.28),
        )
        x_cursor = margin_x
        for (h_text, align), w in zip(fam_headers, fam_col_widths):
            draw_text_aligned(p, h_text, x_cursor, y + 12.5, w, align=align, fontsize=7.5, bold=True, color=(1.0, 1.0, 1.0))
            x_cursor += w
        return y + h_height

    curr_y = draw_family_table_header(page, curr_y)

    for idx, m in enumerate(quotation.members):
        row_h = 17.0
        if curr_y + row_h > max_content_y:
            page = doc.new_page(width=page_width, height=page_height)
            register_fonts(page)
            curr_y = margin_top + 10.0
            curr_y = draw_family_table_header(page, curr_y)

        row_fill = (0.97, 0.98, 1.0) if idx % 2 == 1 else (1.0, 1.0, 1.0)
        page.draw_rect(
            pymupdf.Rect(margin_x, curr_y, margin_x + usable_width, curr_y + row_h),
            color=(0.88, 0.90, 0.94),
            fill=row_fill,
        )
        dob_str = m.date_of_birth.strftime("%d-%m-%Y")
        rel_label = m.relationship
        name_label = m.full_name
        if m.is_primary:
            name_label = f"{m.full_name} (Primary)"

        x_cursor = margin_x
        # 1. #
        draw_text_aligned(page, str(idx + 1), x_cursor, curr_y + 11.5, fam_col_widths[0], align="center", fontsize=7.5, color=(0.4, 0.45, 0.55))
        x_cursor += fam_col_widths[0]
        # 2. Member Name
        draw_text_aligned(page, name_label, x_cursor, curr_y + 11.5, fam_col_widths[1], align="left", fontsize=8.0, bold=True, color=(0.08, 0.12, 0.22))
        x_cursor += fam_col_widths[1]
        # 3. Relationship
        draw_text_aligned(page, rel_label, x_cursor, curr_y + 11.5, fam_col_widths[2], align="left", fontsize=7.5, color=(0.25, 0.30, 0.40))
        x_cursor += fam_col_widths[2]
        # 4. Gender
        draw_text_aligned(page, m.gender or "—", x_cursor, curr_y + 11.5, fam_col_widths[3], align="center", fontsize=7.5, color=(0.35, 0.40, 0.50))
        x_cursor += fam_col_widths[3]
        # 5. DOB
        draw_text_aligned(page, dob_str, x_cursor, curr_y + 11.5, fam_col_widths[4], align="center", fontsize=8.0, color=(0.10, 0.15, 0.25))
        x_cursor += fam_col_widths[4]
        # 6. Age Years
        draw_text_aligned(page, str(m.age_years), x_cursor, curr_y + 11.5, fam_col_widths[5], align="center", fontsize=8.5, bold=True, color=(0.05, 0.15, 0.35))
        x_cursor += fam_col_widths[5]
        # 7. Months
        draw_text_aligned(page, str(m.age_months), x_cursor, curr_y + 11.5, fam_col_widths[6], align="center", fontsize=8.0, bold=True, color=(0.15, 0.20, 0.30))
        x_cursor += fam_col_widths[6]
        # 8. Days
        draw_text_aligned(page, str(m.age_days), x_cursor, curr_y + 11.5, fam_col_widths[7], align="center", fontsize=8.0, bold=True, color=(0.15, 0.20, 0.30))

        curr_y += row_h

    # 5. Dynamic Premium Comparison Matrix
    # Check if matrix fits on current page (max_content_y is 552)
    matrix_needed_h = 16.0 + 22.0 + (len(rows) * 20.0) + (35.0 if quotation.notes else 0.0)
    if curr_y + matrix_needed_h > max_content_y:
        # Move Comparison Matrix to Page 2
        page = doc.new_page(width=page_width, height=page_height)
        register_fonts(page)

        # Mini Top Header on Page 2
        mini_h = 32.0
        page.draw_rect(
            pymupdf.Rect(margin_x, margin_top, margin_x + usable_width, margin_top + mini_h),
            color=None,
            fill=(0.06, 0.09, 0.16),
        )
        page.insert_text(
            (margin_x + 12, margin_top + 14),
            f"FINNEXUS INSURANCE ENGINE  |  HEALTH ADVISORY PORTFOLIO — {disp_title}",
            fontsize=8.0,
            fontname=f_bld_name,
            color=(0.75, 0.85, 1.0),
        )
        page.insert_text(
            (margin_x + 12, margin_top + 25),
            f"Proposer: {quotation.client_name}   |   Advisor: {quotation.advisor_name or 'Advisor'}   |   PIN: {quotation.pin_code}",
            fontsize=7.5,
            fontname=f_reg_name,
            color=(0.60, 0.70, 0.85),
        )
        q_tag = f"Proposal: {quotation.quotation_number}"
        q_tag_len = measure_text(q_tag, 8.5, bold=True)
        page.insert_text(
            (margin_x + usable_width - 14 - q_tag_len, margin_top + 20),
            q_tag,
            fontsize=8.5,
            fontname=f_bld_name,
            color=(1.0, 1.0, 1.0),
        )
        curr_y = margin_top + mini_h + 12.0
    else:
        curr_y += 14.0

    page.insert_text(
        (margin_x, curr_y + 9),
        "DYNAMIC MULTI-CARRIER PREMIUM COMPARISON MATRIX",
        fontsize=9.0,
        fontname=f_bld_name,
        color=(0.08, 0.12, 0.22),
    )
    page.insert_text(
        (margin_x + 330, curr_y + 9),
        f"(Dynamically filtered — only populated Sum Insured tiers & plan variants displayed • {basis_label})",
        fontsize=7.5,
        fontname=f_reg_name,
        color=(0.45, 0.50, 0.60),
    )
    curr_y += 14.0

    if not rows or not columns:
        empty_box_h = 36.0
        page.draw_rect(
            pymupdf.Rect(margin_x, curr_y, margin_x + usable_width, curr_y + empty_box_h),
            color=(0.85, 0.88, 0.93),
            fill=(0.98, 0.98, 0.99),
        )
        page.insert_text(
            (margin_x + 18, curr_y + 22),
            "No premium values have been populated yet. Enter premiums across insurers to view the dynamic comparison.",
            fontsize=8.5,
            fontname=f_reg_name,
            color=(0.40, 0.45, 0.55),
        )
        curr_y += empty_box_h + 10.0
    else:
        first_col_w = 210.0
        remaining_w = usable_width - first_col_w
        num_cols = len(columns)
        col_w = remaining_w / num_cols

        # Identify minimum premium for each column
        min_prems: dict[str, float] = {}
        for col in columns:
            t_code = col["code"]
            vals = [
                float(r["premiums_by_tier"][t_code])
                for r in rows
                if t_code in r["premiums_by_tier"] and r["premiums_by_tier"][t_code] > 0
            ]
            if len(vals) > 1:
                min_prems[t_code] = min(vals)

        def draw_matrix_header(p: pymupdf.Page, y: float) -> float:
            hdr_h = 22.0
            p.draw_rect(
                pymupdf.Rect(margin_x, y, margin_x + usable_width, y + hdr_h),
                color=None,
                fill=(0.08, 0.14, 0.26),
            )
            # 1st col
            draw_text_aligned(p, "Insurance Company & Plan Variant", margin_x, y + 14.5, first_col_w, align="left", fontsize=8.0, bold=True, color=(1.0, 1.0, 1.0))
            # Tier cols
            for c_idx, col in enumerate(columns):
                cx = margin_x + first_col_w + (c_idx * col_w)
                tier_label = col["label"]
                draw_text_aligned(p, tier_label, cx, y + 10.5, col_w, align="right", fontsize=8.0, bold=True, color=(1.0, 1.0, 1.0), padding=10.0)
                si_amt_str = f"({format_inr(col['amount'])})"
                draw_text_aligned(p, si_amt_str, cx, y + 18.5, col_w, align="right", fontsize=6.5, bold=False, color=(0.70, 0.80, 0.95), padding=10.0)
            return y + hdr_h

        curr_y = draw_matrix_header(page, curr_y)

        for r_idx, r in enumerate(rows):
            row_h = 20.0
            # Check for pagination if table exceeds page
            if curr_y + row_h > max_content_y:
                page = doc.new_page(width=page_width, height=page_height)
                register_fonts(page)
                curr_y = margin_top + 10.0
                curr_y = draw_matrix_header(page, curr_y)

            row_fill = (0.97, 0.98, 1.0) if r_idx % 2 == 1 else (1.0, 1.0, 1.0)
            page.draw_rect(
                pymupdf.Rect(margin_x, curr_y, margin_x + usable_width, curr_y + row_h),
                color=(0.88, 0.90, 0.94),
                fill=row_fill,
            )
            # Plan Label
            p_label = f"{r['display_company_name']} {r['display_plan_variant']}".strip()
            draw_text_aligned(page, p_label, margin_x, curr_y + 13.5, first_col_w, align="left", fontsize=8.0, bold=True, color=(0.08, 0.12, 0.22))

            # Premium cells
            for c_idx, col in enumerate(columns):
                cx = margin_x + first_col_w + (c_idx * col_w)
                t_code = col["code"]
                val = r["premiums_by_tier"].get(t_code)
                is_lowest = (val is not None and t_code in min_prems and float(val) == min_prems[t_code])

                if is_lowest:
                    page.draw_rect(
                        pymupdf.Rect(cx + 2.0, curr_y + 2.0, cx + col_w - 2.0, curr_y + row_h - 2.0),
                        color=(0.50, 0.80, 0.60),
                        fill=(0.92, 0.98, 0.94),
                    )
                    txt = format_inr(val)
                    draw_text_aligned(page, txt, cx, curr_y + 13.5, col_w, align="right", fontsize=8.0, bold=True, color=(0.04, 0.40, 0.18), padding=8.0)
                elif val is not None:
                    txt = format_inr(val)
                    draw_text_aligned(page, txt, cx, curr_y + 13.5, col_w, align="right", fontsize=8.0, bold=True, color=(0.05, 0.15, 0.35), padding=8.0)
                else:
                    draw_text_aligned(page, "—", cx, curr_y + 13.5, col_w, align="center", fontsize=8.0, bold=False, color=(0.60, 0.65, 0.70))

            curr_y += row_h

    # 6. Notes if present
    if quotation.notes:
        if curr_y + 36.0 > max_content_y:
            page = doc.new_page(width=page_width, height=page_height)
            register_fonts(page)
            curr_y = margin_top + 12.0
        else:
            curr_y += 10.0

        notes_box_y = curr_y
        page.draw_rect(
            pymupdf.Rect(margin_x, notes_box_y, margin_x + usable_width, notes_box_y + 28.0),
            color=(0.85, 0.88, 0.93),
            fill=(0.97, 0.98, 1.0),
        )
        page.insert_text(
            (margin_x + 10, notes_box_y + 11),
            "SPECIAL NOTES & UNDERWRITING REMARKS:",
            fontsize=7.0,
            fontname=f_bld_name,
            color=(0.35, 0.40, 0.50),
        )
        draw_wrapped_text(
            page,
            quotation.notes,
            margin_x + 10,
            notes_box_y + 22,
            usable_width - 20,
            fontsize=7.5,
            color=(0.15, 0.20, 0.30),
        )

    # 7. Footers across ALL pages in doc
    total_pages = len(doc)
    timestamp_str = datetime.now(UTC).strftime("%d %b %Y, %H:%M UTC")
    for p_idx, p in enumerate(doc):
        p.draw_line(
            pymupdf.Point(margin_x, page_height - 28.0),
            pymupdf.Point(margin_x + usable_width, page_height - 28.0),
            color=(0.82, 0.85, 0.90),
            width=0.75,
        )
        p.insert_text(
            (margin_x, page_height - 15.0),
            f"FinNexus Enterprise Insurance Engine  |  Health Advisory Portfolio  |  Generated: {timestamp_str}",
            fontsize=7.0,
            fontname=f_reg_name,
            color=(0.50, 0.55, 0.65),
        )
        page_num_str = f"Page {p_idx + 1} of {total_pages}  |  Confidential Client Proposal"
        p_len = measure_text(page_num_str, 7.0, bold=False)
        p.insert_text(
            (margin_x + usable_width - p_len, page_height - 15.0),
            page_num_str,
            fontsize=7.0,
            fontname=f_reg_name,
            color=(0.50, 0.55, 0.65),
        )

    return doc


def generate_quotation_pdf(quotation: HealthQuotation) -> bytes:
    """Generate real binary PDF for Health Quotation."""
    doc = _render_quotation_pymupdf_doc(quotation)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def generate_quotation_image(quotation: HealthQuotation) -> bytes:
    """Generate real high-resolution PNG image for Health Quotation."""
    doc = _render_quotation_pymupdf_doc(quotation)
    page = doc[0]
    pixmap = page.get_pixmap(dpi=150)
    png_bytes = pixmap.tobytes("png")
    doc.close()
    return png_bytes


# ---------------------------------------------------------------------------
# Excel Export (Phase 13) via OpenPyXL
# ---------------------------------------------------------------------------

def generate_quotation_excel(quotation: HealthQuotation) -> bytes:
    """Generate real professional Excel (.xlsx) workbook for Health Quotation.

    Contains:
    - Custom title
    - Exact disclaimer
    - Proposer and advisor metadata
    - Family member breakdown with exact ages
    - Dynamic comparison matrix (only populated rows & columns)
    - Indian currency number formatting
    """
    matrix = build_filtered_matrix(quotation.company_plans)
    columns = matrix["columns"]
    rows = matrix["rows"]

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Health Quotation"
    ws.views.sheetView[0].showGridLines = True

    # Styling definitions
    title_font = Font(name="Calibri", size=15, bold=True, color="1E293B")
    section_font = Font(name="Calibri", size=11, bold=True, color="0F172A")
    hdr_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    bold_font = Font(name="Calibri", size=10, bold=True, color="1E293B")
    normal_font = Font(name="Calibri", size=10, color="334155")
    disclaimer_font = Font(name="Calibri", size=10, bold=True, color="9A3412")

    navy_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    slate_fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
    amber_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )
    disclaimer_border = Border(
        left=Side(style="medium", color="F59E0B"),
        right=Side(style="medium", color="F59E0B"),
        top=Side(style="medium", color="F59E0B"),
        bottom=Side(style="medium", color="F59E0B"),
    )

    curr_row = 1

    # 1. Quotation Title
    ws.cell(row=curr_row, column=1, value=quotation.quotation_title)
    ws.cell(row=curr_row, column=1).font = title_font
    curr_row += 1

    # 2. Disclaimer Banner
    ws.cell(row=curr_row, column=1, value=EXACT_DISCLAIMER)
    ws.cell(row=curr_row, column=1).font = disclaimer_font
    ws.cell(row=curr_row, column=1).fill = amber_fill
    ws.cell(row=curr_row, column=1).border = disclaimer_border
    curr_row += 2

    # 3. Metadata block
    meta_pairs = [
        ("Quotation No:", quotation.quotation_number, "Quotation Date:", quotation.quotation_date.strftime("%d-%m-%Y")),
        ("Proposer / Client:", quotation.client_name, "PIN Code:", quotation.pin_code),
        ("Advisor Name:", quotation.advisor_name, "Premium Basis:", "Gross Premium (Incl. Tax)" if quotation.premium_basis == "GROSS" else "Net Premium (Excl. Tax)"),
    ]
    for lbl1, val1, lbl2, val2 in meta_pairs:
        ws.cell(row=curr_row, column=1, value=lbl1).font = bold_font
        ws.cell(row=curr_row, column=2, value=val1).font = normal_font
        ws.cell(row=curr_row, column=4, value=lbl2).font = bold_font
        ws.cell(row=curr_row, column=5, value=val2).font = normal_font
        curr_row += 1

    curr_row += 1

    # 4. Family Members Table
    ws.cell(row=curr_row, column=1, value="INSURED FAMILY MEMBERS & EXACT AGE").font = section_font
    curr_row += 1

    fam_headers = ["#", "Member Name", "Relationship", "Gender", "DOB (DD-MM-YYYY)", "AGE (Years)", "MON (Months)", "DAYS"]
    for c_idx, h in enumerate(fam_headers, start=1):
        cell = ws.cell(row=curr_row, column=c_idx, value=h)
        cell.font = hdr_font
        cell.fill = slate_fill
        cell.alignment = Alignment(horizontal="center" if c_idx > 4 else "left", vertical="center")
        cell.border = thin_border
    curr_row += 1

    for idx, m in enumerate(quotation.members, start=1):
        row_fill = zebra_fill if idx % 2 == 1 else white_fill
        row_data = [
            idx,
            m.full_name,
            m.relationship + (" (Primary)" if m.is_primary else ""),
            m.gender or "—",
            m.date_of_birth.strftime("%d-%m-%Y"),
            m.age_years,
            m.age_months,
            m.age_days,
        ]
        for c_idx, val in enumerate(row_data, start=1):
            cell = ws.cell(row=curr_row, column=c_idx, value=val)
            cell.font = normal_font
            cell.fill = row_fill
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center" if c_idx in [1, 4, 5, 6, 7, 8] else "left", vertical="center")
        curr_row += 1

    curr_row += 2

    # 5. Dynamic Premium Comparison Matrix
    ws.cell(row=curr_row, column=1, value="DYNAMIC PREMIUM COMPARISON MATRIX").font = section_font
    curr_row += 1

    if not rows or not columns:
        ws.cell(row=curr_row, column=1, value="No premium quotes entered yet.").font = normal_font
        curr_row += 1
    else:
        # Header row
        ws.cell(row=curr_row, column=1, value="Insurance Company & Plan Variant").font = hdr_font
        ws.cell(row=curr_row, column=1).fill = navy_fill
        ws.cell(row=curr_row, column=1).border = thin_border

        for c_idx, col in enumerate(columns, start=2):
            cell = ws.cell(row=curr_row, column=c_idx, value=col["label"])
            cell.font = hdr_font
            cell.fill = navy_fill
            cell.alignment = Alignment(horizontal="right", vertical="center")
            cell.border = thin_border
        curr_row += 1

        # Data rows
        for r_idx, r in enumerate(rows, start=1):
            row_fill = zebra_fill if r_idx % 2 == 1 else white_fill
            plan_label = f"{r['display_company_name']} {r['display_plan_variant']}".strip()
            cell_lbl = ws.cell(row=curr_row, column=1, value=plan_label)
            cell_lbl.font = bold_font
            cell_lbl.fill = row_fill
            cell_lbl.border = thin_border

            for c_idx, col in enumerate(columns, start=2):
                val = r["premiums_by_tier"].get(col["code"])
                cell = ws.cell(row=curr_row, column=c_idx)
                cell.fill = row_fill
                cell.border = thin_border
                cell.alignment = Alignment(horizontal="right", vertical="center")
                if val is not None:
                    cell.value = float(val)
                    cell.number_format = '₹#,##0'
                    cell.font = bold_font
                else:
                    cell.value = "—"
                    cell.font = normal_font
            curr_row += 1

    # 6. Auto-fit column widths
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            if cell.value:
                val_str = str(cell.value)
                max_len = max(max_len, len(val_str))
        ws.column_dimensions[col_letter].width = max(max_len + 3, 14)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
