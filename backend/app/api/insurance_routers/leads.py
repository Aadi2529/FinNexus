"""Agent Lead Inquiries and Sales CRM Lead Management Router."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.models.auth import User
from app.db.models.insurance import InsuranceLeadReminder
from app.db.session import get_db_session
from app.schemas.insurance import (
    AgentInquiryResponse,
    AgentInquiryStatusUpdate,
    Lead360Response,
    LeadAssignmentRequest,
    LeadBulkAssignRequest,
    LeadConvertRequest,
    LeadConvertResponse,
    LeadCreate,
    LeadDuplicateCheckRequest,
    LeadDuplicateCheckResponse,
    LeadImportConfirmRequest,
    LeadImportResult,
    LeadImportRowPreview,
    LeadKanbanResponse,
    LeadNoteCreate,
    LeadNoteResponse,
    LeadReminderCompleteRequest,
    LeadReminderCreate,
    LeadReminderResponse,
    LeadReportRow,
    LeadStatsResponse,
    LeadUpdate,
    PaginatedResponse,
    PublicAgentProfileResponse,
    PublicInquiryCreate,
)
from app.services.insurance import (
    add_lead_note,
    assign_lead,
    bulk_assign_leads,
    check_lead_duplicates,
    complete_lead_follow_up,
    confirm_leads_import,
    convert_lead_to_customer,
    create_lead,
    delete_lead,
    delete_lead_note,
    export_leads,
    generate_lead_import_template,
    get_lead_360,
    get_lead_kanban,
    get_lead_reports,
    get_lead_response_by_id,
    get_lead_stats,
    get_public_agent_profile,
    link_lead_quotation,
    list_agent_inquiries,
    list_lead_follow_ups,
    preview_leads_import,
    schedule_lead_follow_up,
    submit_public_inquiry,
    update_inquiry_status,
    update_lead,
    update_lead_note,
)

router = APIRouter(tags=["Agent Leads & Sales CRM"])


# ===========================================================================
# 1. Public Unauthenticated Endpoints (Agent Web Profiles & Inquiries)
# ===========================================================================


@router.get(
    "/agents/public/{slug}",
    response_model=PublicAgentProfileResponse,
    summary="Get Agent Public Web Profile (No Auth Required)",
)
@router.get(
    "/public/agents/{slug}",
    response_model=PublicAgentProfileResponse,
    summary="Get Agent Public Web Profile (No Auth Required)",
)
async def get_public_profile_endpoint(
    slug: str,
    session: AsyncSession = Depends(get_db_session),
) -> PublicAgentProfileResponse:
    """Retrieve public profile for an authorized agent without exposing private data."""
    return await get_public_agent_profile(session, slug)


@router.post(
    "/agents/public/{slug}/inquiries",
    status_code=status.HTTP_201_CREATED,
    summary="Submit Customer Inquiry Lead via Public Profile (No Auth Required)",
)
@router.post(
    "/public/agents/{slug}/inquiries",
    status_code=status.HTTP_201_CREATED,
    summary="Submit Customer Inquiry Lead via Public Profile (No Auth Required)",
)
async def submit_inquiry_endpoint(
    slug: str,
    payload: PublicInquiryCreate,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Submit customer lead inquiry with honeypot spam protection and IP rate limiting."""
    client_ip = request.client.host if request.client else None
    return await submit_public_inquiry(session, slug, payload, client_ip=client_ip)


@router.post(
    "/leads/public/inquiry",
    status_code=status.HTTP_201_CREATED,
    summary="Submit General Portal Insurance Inquiry Lead (No Auth Required)",
)
async def submit_general_public_inquiry_endpoint(
    payload: PublicInquiryCreate,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Submit general portal customer lead inquiry with honeypot spam protection and rate limiting."""
    client_ip = request.client.host if request.client else None
    return await submit_public_inquiry(session, "general", payload, client_ip=client_ip)


# ===========================================================================
# 2. Authenticated Sales CRM Operations (List, Search, Kanban, Stats)
# ===========================================================================


@router.get(
    "/leads/stats",
    response_model=LeadStatsResponse,
    summary="Get Sales CRM Lead Management Dashboard Stats and KPIs",
)
async def get_lead_stats_endpoint(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> LeadStatsResponse:
    """Retrieve 10 KPI cards and performance widgets calculated from actual database records."""
    return await get_lead_stats(session, current_user)


@router.get(
    "/leads/kanban",
    response_model=LeadKanbanResponse,
    summary="Get Kanban Pipeline Board",
)
async def get_lead_kanban_endpoint(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    assigned_user_id: uuid.UUID | None = Query(default=None),
    view: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> LeadKanbanResponse:
    """Retrieve leads grouped into kanban pipeline stages with stage aggregates."""
    return await get_lead_kanban(
        session=session,
        current_user=current_user,
        search=search,
        category_filter=category,
        priority_filter=priority,
        assigned_user_id=assigned_user_id,
        view=view,
    )


@router.get(
    "/leads",
    response_model=PaginatedResponse[AgentInquiryResponse],
    summary="List and Filter Sales CRM Leads",
)
@router.get(
    "/inquiries",
    response_model=PaginatedResponse[AgentInquiryResponse],
    summary="List Agent Inquiry Leads (Legacy / Alias)",
)
async def list_leads_endpoint(
    sub_agent_id: uuid.UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    category: str | None = Query(default=None),
    source: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    assigned_user_id: uuid.UUID | None = Query(default=None),
    search: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[AgentInquiryResponse]:
    """Retrieve leads with search, multi-field filtering, pagination, and RBAC visibility."""
    return await list_agent_inquiries(
        session=session,
        current_user=current_user,
        sub_agent_id=sub_agent_id,
        status_filter=status_filter,
        category_filter=category,
        source_filter=source,
        priority_filter=priority,
        assigned_user_id=assigned_user_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/leads",
    response_model=AgentInquiryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Sales CRM Lead with Duplicate Check",
)
async def create_lead_endpoint(
    payload: LeadCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AgentInquiryResponse:
    """Create a new sales CRM lead with validation, duplicate detection, and activity tracking."""
    client_ip = request.client.host if request.client else None
    return await create_lead(session, payload, current_user, client_ip=client_ip)


@router.post(
    "/leads/check-duplicates",
    response_model=LeadDuplicateCheckResponse,
    summary="Check Duplicate Leads and Existing Customers",
)
async def check_duplicates_endpoint(
    payload: LeadDuplicateCheckRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> LeadDuplicateCheckResponse:
    """Check normalized phone number and email address against both leads and existing customers."""
    return await check_lead_duplicates(session, payload)


@router.post(
    "/leads/bulk-assign",
    summary="Bulk Assign Leads to Employee or Sub-Agent",
)
async def bulk_assign_leads_endpoint(
    payload: LeadBulkAssignRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Bulk assign multiple leads to an authorized advisor or agent."""
    return await bulk_assign_leads(session, payload, current_user)


# ===========================================================================
# 3. Lead 360° Profile, Follow-ups, Notes, Quotations, and Conversion
# ===========================================================================


@router.get(
    "/leads/follow-ups",
    response_model=list[LeadReminderResponse],
    summary="List Scheduled Follow-ups and Tasks",
)
async def list_follow_ups_endpoint(
    status_filter: str | None = Query(default=None, alias="status"),
    due_filter: str | None = Query(default=None, alias="due"),
    assigned_to_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[LeadReminderResponse]:
    """List follow-ups filtered by status (PENDING/COMPLETED) and due timeframe (TODAY/OVERDUE/UPCOMING)."""
    return await list_lead_follow_ups(
        session=session,
        current_user=current_user,
        status_filter=status_filter,
        due_filter=due_filter,
        assigned_to_id=assigned_to_id,
    )


# ---------------------------------------------------------------------------
# Static Bulk Import, Export & Analytics Reports (placed before /{lead_id})
# ---------------------------------------------------------------------------

@router.get(
    "/leads/export",
    summary="Export Filtered Leads to CSV or Genuine XLSX",
)
async def export_leads_endpoint(
    format: str = Query(default="xlsx", description="xlsx or csv"),
    status_filter: str | None = Query(default=None, alias="status"),
    category: str | None = Query(default=None),
    source: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    assigned_user_id: uuid.UUID | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Export filtered leads to genuine CSV or XLSX spreadsheet with formula sanitization."""
    data_bytes, mime_type, filename = await export_leads(
        session=session,
        current_user=current_user,
        export_format=format,
        status_filter=status_filter,
        category_filter=category,
        source_filter=source,
        priority_filter=priority,
        assigned_user_id=assigned_user_id,
        date_from=date_from,
        date_to=date_to,
    )
    return Response(
        content=data_bytes,
        media_type=mime_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/leads/import/template",
    summary="Download Lead Bulk Import Template (CSV or XLSX)",
)
async def download_lead_template_endpoint(
    format: str = Query(default="xlsx", description="xlsx or csv"),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Download verified import template with headers and sample data."""
    data_bytes, mime_type, filename = await generate_lead_import_template(format)
    return Response(
        content=data_bytes,
        media_type=mime_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/leads/import/preview",
    response_model=list[LeadImportRowPreview],
    summary="Preview and Validate Uploaded Leads File (CSV / XLSX)",
)
async def preview_leads_import_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[LeadImportRowPreview]:
    """Parse CSV or XLSX file and validate fields, required values, and duplicates."""
    content = await file.read()
    return await preview_leads_import(session, content, file.filename or "leads.xlsx")


@router.post(
    "/leads/import/confirm",
    response_model=LeadImportResult,
    summary="Confirm Transactional Bulk Leads Import",
)
async def confirm_leads_import_endpoint(
    payload: LeadImportConfirmRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> LeadImportResult:
    """Import valid lead records into the database transactionally."""
    return await confirm_leads_import(session, payload, current_user)


@router.get(
    "/leads/reports",
    response_model=list[LeadReportRow],
    summary="Get Lead Reports & Performance Analytics",
)
async def get_lead_reports_endpoint(
    report_type: str = Query(default="SOURCE", description="SOURCE, CATEGORY, STATUS, PRIORITY, AGENT"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[LeadReportRow]:
    """Retrieve structured CRM reporting metrics aggregated by source, category, status, priority, or agent."""
    return await get_lead_reports(
        session=session,
        current_user=current_user,
        report_type=report_type,
        date_from=date_from,
        date_to=date_to,
    )


# ---------------------------------------------------------------------------
# Individual Lead Profile & Operations
# ---------------------------------------------------------------------------

@router.get(
    "/leads/{lead_id}/360",
    response_model=Lead360Response,
    summary="Get Complete Lead 360° Profile",
)
async def get_lead_360_endpoint(
    lead_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Lead360Response:
    """Retrieve full 360 view with timeline activities, notes, scheduled follow-ups, and linked quotations."""
    return await get_lead_360(session, lead_id, current_user)


@router.get(
    "/leads/{lead_id}",
    response_model=AgentInquiryResponse,
    summary="Get Single Lead by ID",
)
async def get_lead_endpoint(
    lead_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AgentInquiryResponse:
    """Retrieve a single lead record."""
    return await get_lead_response_by_id(session, lead_id)


@router.patch(
    "/leads/{lead_id}",
    response_model=AgentInquiryResponse,
    summary="Update Lead Profile Fields",
)
async def update_lead_endpoint(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AgentInquiryResponse:
    """Update lead information with field-level diff tracking and audit logging."""
    return await update_lead(session, lead_id, payload, current_user)


@router.patch(
    "/leads/{lead_id}/status",
    response_model=AgentInquiryResponse,
    summary="Update Lead Lifecycle Status",
)
@router.patch(
    "/inquiries/{inquiry_id}/status",
    response_model=AgentInquiryResponse,
    summary="Update Inquiry Lead Status (Legacy Alias)",
)
async def update_inquiry_status_endpoint(
    lead_id: uuid.UUID | None = None,
    inquiry_id: uuid.UUID | None = None,
    payload: AgentInquiryStatusUpdate = ...,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AgentInquiryResponse:
    """Update lead status lifecycle with transition logging."""
    target_id = lead_id or inquiry_id
    if not target_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lead ID is required.")
    return await update_inquiry_status(session, target_id, payload, current_user)


@router.patch(
    "/leads/{lead_id}/assign",
    response_model=AgentInquiryResponse,
    summary="Assign or Reassign Lead to Employee or Agent",
)
async def assign_lead_endpoint(
    lead_id: uuid.UUID,
    payload: LeadAssignmentRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AgentInquiryResponse:
    """Assign or reassign a lead with activity logging and in-app notifications."""
    return await assign_lead(session, lead_id, payload, current_user)


@router.post(
    "/leads/{lead_id}/follow-ups",
    response_model=LeadReminderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule Follow-up Task for Lead",
)
async def schedule_follow_up_endpoint(
    lead_id: uuid.UUID,
    payload: LeadReminderCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> LeadReminderResponse:
    """Schedule follow-up call, meeting, WhatsApp, or email for a lead."""
    return await schedule_lead_follow_up(session, lead_id, payload, current_user)


@router.post(
    "/leads/{lead_id}/follow-ups/{reminder_id}/complete",
    summary="Complete Follow-up Task with Discussion Remarks and Schedule Next",
)
async def complete_follow_up_endpoint(
    lead_id: uuid.UUID,
    reminder_id: uuid.UUID,
    payload: LeadReminderCompleteRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Complete a follow-up, record outcome notes, and optionally schedule next follow-up seamlessly."""
    return await complete_lead_follow_up(session, lead_id, reminder_id, payload, current_user)


@router.post(
    "/leads/{lead_id}/notes",
    response_model=LeadNoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add Internal Note to Lead",
)
async def add_note_endpoint(
    lead_id: uuid.UUID,
    payload: LeadNoteCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> LeadNoteResponse:
    """Add discussion note, consultation remarks, or internal memo to a lead."""
    return await add_lead_note(session, lead_id, payload, current_user)


@router.post(
    "/leads/{lead_id}/convert",
    response_model=LeadConvertResponse,
    summary="Convert Lead to Active Customer",
)
async def convert_to_customer_endpoint(
    lead_id: uuid.UUID,
    payload: LeadConvertRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> LeadConvertResponse:
    """Convert prospect to active Customer record without automatic policy issuance."""
    return await convert_lead_to_customer(session, lead_id, payload, current_user)


@router.delete(
    "/leads/{lead_id}",
    response_model=dict[str, Any],
    summary="Delete a Lead Record",
)
async def delete_lead_endpoint(
    lead_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete lead record, cascading notes, reminders, and activities."""
    return await delete_lead(session, lead_id, current_user)


@router.post(
    "/leads/{lead_id}/quotations/{quotation_id}/link",
    summary="Link Existing Quotation to Lead",
)
@router.post(
    "/leads/{lead_id}/link-quotation/{quotation_id}",
    summary="Link Existing Quotation to Lead (Alias)",
)
async def link_quotation_endpoint(
    lead_id: uuid.UUID,
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Link an insurance quotation to a lead and transition status to QUOTATION_SENT."""
    return await link_lead_quotation(session, lead_id, quotation_id, current_user)


@router.post(
    "/leads/{lead_id}/reminders",
    response_model=LeadReminderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule Follow-up Task for Lead (Alias)",
)
async def schedule_follow_up_alias(
    lead_id: uuid.UUID,
    payload: LeadReminderCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> LeadReminderResponse:
    """Schedule follow-up reminder alias."""
    return await schedule_lead_follow_up(session, lead_id, payload, current_user)


@router.patch(
    "/leads/reminders/{reminder_id}/complete",
    summary="Complete Follow-up Task (Global Alias)",
)
@router.post(
    "/leads/reminders/{reminder_id}/complete",
    summary="Complete Follow-up Task (Global Alias)",
)
async def complete_follow_up_alias(
    reminder_id: uuid.UUID,
    payload: LeadReminderCompleteRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    rem = await session.get(InsuranceLeadReminder, reminder_id)
    if not rem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")
    return await complete_lead_follow_up(session, rem.lead_id, reminder_id, payload, current_user)


@router.patch(
    "/leads/{lead_id}/notes/{note_id}",
    response_model=LeadNoteResponse,
    summary="Update Internal Note on Lead",
)
async def update_note_endpoint(
    lead_id: uuid.UUID,
    note_id: uuid.UUID,
    payload: LeadNoteCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> LeadNoteResponse:
    return await update_lead_note(session, lead_id, note_id, payload, current_user)


@router.delete(
    "/leads/{lead_id}/notes/{note_id}",
    response_model=dict[str, Any],
    summary="Delete Internal Note from Lead",
)
async def delete_note_endpoint(
    lead_id: uuid.UUID,
    note_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    return await delete_lead_note(session, lead_id, note_id, current_user)

