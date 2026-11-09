"""Custom Health Insurance Quotation Router.

Endpoints for Module 6:
- Create, List, Retrieve, Update, Duplicate, Delete Custom Health Quotations
- Exact Age Calculation helper
- Export to Vector PDF (A4 Landscape)
- Export to Styled Excel (.xlsx)
- Export to High-Resolution Image (PNG)
- RBAC, Audit Logging, and Tenant Isolation
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import (
    get_current_user,
    is_admin,
    is_manager,
    require_manager_or_above,
)
from app.db.models.auth import User
from app.db.session import get_db_session
from app.schemas.insurance import (
    HealthQuotationCreate,
    HealthQuotationFilteredMatrix,
    HealthQuotationListItem,
    HealthQuotationResponse,
    HealthQuotationUpdate,
    PaginatedResponse,
)
from app.services.insurance.quotation_service import (
    DEFAULT_COMPANY_PLANS,
    EXACT_DISCLAIMER,
    SUM_INSURED_TIERS,
    build_filtered_matrix,
    calculate_exact_age,
    create_health_quotation,
    delete_health_quotation,
    duplicate_health_quotation,
    generate_quotation_excel,
    generate_quotation_image,
    generate_quotation_pdf,
    get_health_quotation_by_id,
    get_health_quotation_stats,
    list_health_quotations,
    update_health_quotation,
)

router = APIRouter(prefix="/quotations", tags=["Health Quotations"])


@router.get(
    "/stats",
    summary="Get Real Database Statistics for Health Quotations",
)
async def get_quotation_stats_endpoint(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, int]:
    """Retrieve real database aggregate statistics: total, issued, draft, and members_evaluated."""
    return await get_health_quotation_stats(session, current_user)



@router.get(
    "/templates",
    summary="Get Default Quotation Templates and Standardized Sum Insured Tiers",
)
async def get_quotation_templates(
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Return default comparison company/plan templates and standardized 9 sum insured tiers."""
    return {
        "disclaimer": EXACT_DISCLAIMER,
        "sum_insured_tiers": SUM_INSURED_TIERS,
        "default_company_plans": DEFAULT_COMPANY_PLANS,
    }


@router.post(
    "/calculate-age",
    summary="Calculate Exact Age in Years, Months, and Days",
)
async def calculate_age_endpoint(
    payload: dict[str, Any],
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Calculate exact age from date_of_birth to reference_date (defaults to today)."""
    dob_raw = payload.get("date_of_birth")
    if not dob_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date_of_birth is required (format: YYYY-MM-DD).",
        )
    try:
        dob = date.fromisoformat(dob_raw)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date_of_birth format. Expected YYYY-MM-DD.",
        )

    ref_raw = payload.get("reference_date")
    if ref_raw:
        try:
            ref_date = date.fromisoformat(ref_raw)
        except (ValueError, TypeError):
            ref_date = date.today()
    else:
        ref_date = date.today()

    try:
        years, months, days = calculate_exact_age(dob, ref_date)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )

    return {
        "date_of_birth": dob.isoformat(),
        "reference_date": ref_date.isoformat(),
        "age_years": years,
        "age_months": months,
        "age_days": days,
    }


@router.get(
    "",
    response_model=PaginatedResponse[HealthQuotationListItem],
    summary="List Health Quotations with Filtering and Pagination",
)
async def list_quotations_endpoint(
    search: str | None = Query(None, description="Search by quotation number, title, client, or PIN code"),
    status: str | None = Query(None, description="Status filter (DRAFT, ISSUED, ARCHIVED)"),
    from_date: date | None = Query(None, description="Filter quotations from date"),
    to_date: date | None = Query(None, description="Filter quotations to date"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[HealthQuotationListItem]:
    """Retrieve paginated list of health quotations."""
    items, total = await list_health_quotations(
        session=session,
        current_user=current_user,
        search=search,
        status_filter=status,
        from_date=from_date,
        to_date=to_date,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return PaginatedResponse[HealthQuotationListItem](
        items=[HealthQuotationListItem(**item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, (total + page_size - 1) // page_size),
    )


@router.post(
    "",
    response_model=HealthQuotationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a New Custom Health Quotation",
)
async def create_quotation_endpoint(
    payload: HealthQuotationCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> HealthQuotationResponse:
    """Create a new Health Quotation with members and premium matrix."""
    try:
        quote = await create_health_quotation(session, payload, current_user)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))

    filtered_matrix = build_filtered_matrix(quote.company_plans)
    resp = HealthQuotationResponse.model_validate(quote)
    resp.filtered_matrix = HealthQuotationFilteredMatrix(**filtered_matrix)
    return resp


@router.get(
    "/{quotation_id}",
    response_model=HealthQuotationResponse,
    summary="Get Health Quotation Detail with Dynamic Matrix",
)
async def get_quotation_endpoint(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> HealthQuotationResponse:
    """Retrieve full quotation details including members, plans, and dynamic filtered comparison matrix."""
    quote = await get_health_quotation_by_id(session, quotation_id, current_user)
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quotation {quotation_id} not found.",
        )

    # Multi-tenant check
    if getattr(current_user, "tenant_id", None) and quote.tenant_id:
        if current_user.tenant_id != quote.tenant_id and not is_admin(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to quotation in different tenant domain.",
            )

    filtered_matrix = build_filtered_matrix(quote.company_plans)
    resp = HealthQuotationResponse.model_validate(quote)
    resp.filtered_matrix = HealthQuotationFilteredMatrix(**filtered_matrix)
    return resp


@router.put(
    "/{quotation_id}",
    response_model=HealthQuotationResponse,
    summary="Update Health Quotation",
)
async def update_quotation_endpoint(
    quotation_id: uuid.UUID,
    payload: HealthQuotationUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> HealthQuotationResponse:
    """Update existing quotation, recalculating ages and updating matrix."""
    # Verify quotation exists and check ownership / role
    existing = await get_health_quotation_by_id(session, quotation_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quotation {quotation_id} not found.",
        )

    if not is_manager(current_user) and existing.advisor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the authoring advisor or managers may update this quotation.",
        )

    try:
        updated = await update_health_quotation(session, quotation_id, payload, current_user)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))

    filtered_matrix = build_filtered_matrix(updated.company_plans)
    resp = HealthQuotationResponse.model_validate(updated)
    resp.filtered_matrix = HealthQuotationFilteredMatrix(**filtered_matrix)
    return resp


@router.post(
    "/{quotation_id}/duplicate",
    response_model=HealthQuotationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Duplicate an Existing Quotation",
)
async def duplicate_quotation_endpoint(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> HealthQuotationResponse:
    """Clone an existing quotation into a new DRAFT quotation with fresh ages and quotation number."""
    try:
        dup = await duplicate_health_quotation(session, quotation_id, current_user)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err))

    filtered_matrix = build_filtered_matrix(dup.company_plans)
    resp = HealthQuotationResponse.model_validate(dup)
    resp.filtered_matrix = HealthQuotationFilteredMatrix(**filtered_matrix)
    return resp


@router.delete(
    "/{quotation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a Quotation",
)
async def delete_quotation_endpoint(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a quotation record subject to RBAC."""
    existing = await get_health_quotation_by_id(session, quotation_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quotation {quotation_id} not found.",
        )

    if not is_manager(current_user) and existing.advisor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to delete this quotation. Requires Manager role or authorship.",
        )

    await delete_health_quotation(session, quotation_id, current_user)


# ---------------------------------------------------------------------------
# Real Export Endpoints (PDF, Excel, Image)
# ---------------------------------------------------------------------------

@router.get(
    "/{quotation_id}/export/pdf",
    summary="Export Quotation to Vector PDF Document",
)
async def export_quotation_pdf(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Generate and download professional Landscape A4 PDF with dynamic matrix filtering."""
    quote = await get_health_quotation_by_id(session, quotation_id, current_user)
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quotation {quotation_id} not found.",
        )

    pdf_bytes = generate_quotation_pdf(quote)
    filename = f"Quotation_{quote.quotation_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get(
    "/{quotation_id}/export/excel",
    summary="Export Quotation to Styled Excel (.xlsx) Workbook",
)
async def export_quotation_excel(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Generate and download styled Excel workbook with formatted currency and dynamic filtering."""
    quote = await get_health_quotation_by_id(session, quotation_id, current_user)
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quotation {quotation_id} not found.",
        )

    excel_bytes = generate_quotation_excel(quote)
    filename = f"Quotation_{quote.quotation_number}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get(
    "/{quotation_id}/export/image",
    summary="Export Quotation to High-Resolution PNG Image",
)
async def export_quotation_image(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Generate and download high-resolution PNG image of the quotation preview."""
    quote = await get_health_quotation_by_id(session, quotation_id, current_user)
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quotation {quotation_id} not found.",
        )

    image_bytes = generate_quotation_image(quote)
    filename = f"Quotation_{quote.quotation_number}.png"
    return Response(
        content=image_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )
