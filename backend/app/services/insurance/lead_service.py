"""Agent Web Profile & Sales CRM Lead Management Service for FinNexus Insurance Engine."""

from __future__ import annotations

import csv
import io
import time
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any, Sequence

import openpyxl
from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.audit import AuditLog
from app.db.models.auth import User
from app.db.models.crm import CrmNotification, Customer
from app.db.models.insurance import (
    HealthQuotation,
    InsuranceAgentInquiry,
    InsuranceCompany,
    InsuranceLeadActivity,
    InsuranceLeadNote,
    InsuranceLeadReminder,
    InsurancePlan,
    InsurancePolicy,
    InsuranceSubAgent,
)
from app.schemas.insurance import (
    AgentInquiryResponse,
    AgentInquiryStatusUpdate,
    CustomerDuplicateMatch,
    LEAD_STATUSES,
    Lead360Response,
    LeadActivityResponse,
    LeadAssignmentRequest,
    LeadBulkAssignRequest,
    LeadConvertRequest,
    LeadConvertResponse,
    LeadCreate,
    LeadDuplicateCheckRequest,
    LeadDuplicateCheckResponse,
    LeadDuplicateMatch,
    LeadImportConfirmRequest,
    LeadImportResult,
    LeadImportRowPreview,
    LeadKanbanResponse,
    LeadKanbanStage,
    LeadNoteCreate,
    LeadNoteResponse,
    LeadQuotationSummary,
    LeadReminderCompleteRequest,
    LeadReminderCreate,
    LeadReminderResponse,
    LeadReminderUpdate,
    LeadReportRow,
    LeadResponse,
    LeadStatsResponse,
    LeadUpdate,
    PaginatedResponse,
    PublicAgentProfileResponse,
    PublicInquiryCreate,
)
from app.core.insurance_categories import get_category_aliases, normalize_category_label

# In-memory IP submission rate limiter (e.g. 5 submissions per 10 minutes per IP)
_IP_SUBMISSION_HISTORY: dict[str, list[float]] = {}
RATE_LIMIT_WINDOW = 600.0  # 10 minutes
MAX_SUBMISSIONS_PER_WINDOW = 5


def _check_rate_limit(client_ip: str | None) -> None:
    if not client_ip:
        return
    now = time.time()
    history = _IP_SUBMISSION_HISTORY.get(client_ip, [])
    history = [t for t in history if now - t < RATE_LIMIT_WINDOW]
    if len(history) >= MAX_SUBMISSIONS_PER_WINDOW:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many inquiries submitted from your IP address. Please wait a few minutes.",
        )
    history.append(now)
    _IP_SUBMISSION_HISTORY[client_ip] = history


def _normalize_phone(phone: str | None) -> str:
    if not phone:
        return ""
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[2:]
    return digits


def _sanitize_formula(val: Any) -> str:
    """Sanitize strings for CSV/Excel export to prevent CSV formula injection."""
    if val is None:
        return ""
    s = str(val).strip()
    if s.startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + s
    return s


async def _generate_lead_number(session: AsyncSession) -> str:
    """Generate sequential unique lead reference number e.g. LEAD-2026-000123."""
    current_year = datetime.now(UTC).year
    prefix = f"LEAD-{current_year}-"
    q = (
        select(InsuranceAgentInquiry.lead_number)
        .where(InsuranceAgentInquiry.lead_number.like(f"{prefix}%"))
        .order_by(desc(InsuranceAgentInquiry.lead_number))
        .limit(1)
    )
    latest = (await session.execute(q)).scalar_one_or_none()
    if latest:
        try:
            num_part = int(latest.replace(prefix, ""))
            next_num = num_part + 1
        except ValueError:
            next_num = 1
    else:
        count_q = select(func.count(InsuranceAgentInquiry.id))
        count = (await session.execute(count_q)).scalar_one() or 0
        next_num = count + 1
    return f"{prefix}{next_num:06d}"


def _format_lead_response(inq: InsuranceAgentInquiry) -> AgentInquiryResponse:
    return AgentInquiryResponse(
        id=inq.id,
        lead_number=inq.lead_number,
        sub_agent_id=inq.sub_agent_id,
        sub_agent_name=inq.sub_agent.full_name if inq.sub_agent else None,
        full_name=inq.full_name,
        mobile=inq.mobile,
        alternate_mobile=inq.alternate_mobile,
        email=inq.email,
        lead_type=inq.lead_type or "INDIVIDUAL",
        company_name=inq.company_name,
        gstin=inq.gstin,
        policy_type=inq.policy_type,
        message=inq.message,
        consent=inq.consent,
        status=inq.status,
        priority=inq.priority or "NORMAL",
        lead_source=inq.lead_source or "PUBLIC_PROFILE",
        assigned_user_id=inq.assigned_user_id,
        assigned_user_name=inq.assigned_user.full_name if inq.assigned_user else None,
        date_of_birth=inq.date_of_birth,
        gender=inq.gender,
        occupation=inq.occupation,
        address=inq.address,
        address_line_2=inq.address_line_2,
        city=inq.city,
        state=inq.state,
        pincode=inq.pincode,
        preferred_company_id=inq.preferred_company_id,
        preferred_company_name=inq.preferred_company.name if inq.preferred_company else None,
        preferred_plan_id=inq.preferred_plan_id,
        preferred_plan_name=inq.preferred_plan.plan_name if inq.preferred_plan else None,
        sum_insured=inq.sum_insured,
        expected_premium=inq.expected_premium,
        coverage_type=inq.coverage_type,
        member_count=inq.member_count,
        existing_insurance=inq.existing_insurance,
        existing_policy_number=inq.existing_policy_number,
        existing_policy_expiry=inq.existing_policy_expiry,
        campaign_name=inq.campaign_name,
        referral_name=inq.referral_name,
        requirement_description=inq.requirement_description,
        next_follow_up_date=inq.next_follow_up_date,
        customer_id=inq.customer_id,
        customer_name=f"{inq.customer.first_name} {inq.customer.last_name}" if inq.customer else None,
        converted_policy_id=inq.converted_policy_id,
        converted_policy_number=inq.converted_policy.policy_number if inq.converted_policy else None,
        lost_reason=inq.lost_reason,
        created_at=inq.created_at,
        updated_at=inq.updated_at,
    )


def _apply_rbac_filter(query: Any, current_user: User | None) -> Any:
    if not current_user:
        return query
    roles = [r.name for r in (current_user.roles or [])] if hasattr(current_user, "roles") and current_user.roles else []
    is_admin_priv = "SUPER_ADMIN" in roles or "ADMIN" in roles
    is_manager_priv = "MANAGER" in roles
    if not is_admin_priv and not is_manager_priv:
        query = query.where(
            or_(
                InsuranceAgentInquiry.assigned_user_id == current_user.id,
                InsuranceAgentInquiry.sub_agent_id == current_user.id,
            )
        )
    return query


# --- Public Agent Web Profile ---


async def get_public_agent_profile(
    session: AsyncSession,
    slug: str,
) -> PublicAgentProfileResponse:
    query = select(InsuranceSubAgent).where(
        InsuranceSubAgent.public_profile_slug == slug.strip().lower(),
        InsuranceSubAgent.status == "ACTIVE",
    )
    agent = (await session.execute(query)).scalar_one_or_none()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent profile '{slug}' not found or is currently inactive.",
        )

    specs = [s.strip() for s in (agent.specialties or "Life, Health, Motor").split(",") if s.strip()]

    return PublicAgentProfileResponse(
        full_name=agent.full_name,
        agent_code=agent.agent_code,
        mobile=agent.mobile if agent.show_contact_info else None,
        email=agent.email if agent.show_contact_info else None,
        parent_firm=agent.parent_firm,
        public_profile_slug=agent.public_profile_slug,
        is_active=agent.status == "ACTIVE",
        bio=agent.bio,
        specialties=specs,
        show_contact_info=agent.show_contact_info,
    )


async def submit_public_inquiry(
    session: AsyncSession,
    slug: str,
    payload: PublicInquiryCreate,
    client_ip: str | None = None,
) -> dict:
    if (payload.hp_field and payload.hp_field.strip()) or (payload.website_hp and payload.website_hp.strip()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Spam submission detected.")

    _check_rate_limit(client_ip)

    sub_agent_id = None
    agent_name = "FinNexus Platform"
    if slug and slug.strip().lower() not in ("general", "portal", "website"):
        agent = (
            await session.execute(
                select(InsuranceSubAgent).where(
                    InsuranceSubAgent.public_profile_slug == slug.strip().lower(),
                    InsuranceSubAgent.status == "ACTIVE",
                )
            )
        ).scalar_one_or_none()
        if agent:
            sub_agent_id = agent.id
            agent_name = agent.full_name

    lead_num = await _generate_lead_number(session)

    inquiry = InsuranceAgentInquiry(
        id=uuid.uuid4(),
        lead_number=lead_num,
        sub_agent_id=sub_agent_id,
        full_name=payload.full_name.strip(),
        mobile=payload.mobile.strip(),
        email=payload.email.strip().lower() if payload.email and payload.email.strip() else None,
        lead_type=payload.lead_type or "INDIVIDUAL",
        company_name=payload.company_name.strip() if payload.company_name else None,
        city=payload.city.strip() if payload.city else None,
        pincode=payload.pincode.strip() if payload.pincode else None,
        policy_type=normalize_category_label(payload.policy_type.strip()),
        message=payload.message.strip() if payload.message else None,
        requirement_description=payload.requirement_description.strip() if payload.requirement_description else None,
        consent=payload.consent,
        status="NEW",
        priority="NORMAL",
        lead_source="WEBSITE",
        ip_address=client_ip,
    )
    session.add(inquiry)

    activity = InsuranceLeadActivity(
        id=uuid.uuid4(),
        lead_id=inquiry.id,
        activity_type="INQUIRY_SUBMITTED",
        title="Web Inquiry Submitted",
        description=f"Public inquiry received via {agent_name} web profile for {inquiry.policy_type} insurance.",
    )
    session.add(activity)

    await session.commit()

    return {
        "status": "success",
        "inquiry_id": str(inquiry.id),
        "lead_number": lead_num,
        "message": f"Thank you! Your insurance inquiry ({lead_num}) has been successfully submitted.",
    }


# --- Authenticated Sales CRM Operations ---


async def list_agent_inquiries(
    session: AsyncSession,
    current_user: User | None = None,
    sub_agent_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    category_filter: str | None = None,
    source_filter: str | None = None,
    priority_filter: str | None = None,
    assigned_user_id: uuid.UUID | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    page_size: int = 25,
) -> PaginatedResponse[AgentInquiryResponse]:
    query = (
        select(InsuranceAgentInquiry)
        .options(
            selectinload(InsuranceAgentInquiry.sub_agent),
            selectinload(InsuranceAgentInquiry.assigned_user),
            selectinload(InsuranceAgentInquiry.preferred_company),
            selectinload(InsuranceAgentInquiry.preferred_plan),
            selectinload(InsuranceAgentInquiry.customer),
            selectinload(InsuranceAgentInquiry.converted_policy),
        )
    )

    query = _apply_rbac_filter(query, current_user)

    if sub_agent_id:
        query = query.where(InsuranceAgentInquiry.sub_agent_id == sub_agent_id)
    if assigned_user_id:
        query = query.where(InsuranceAgentInquiry.assigned_user_id == assigned_user_id)
    if status_filter and status_filter != "ALL":
        query = query.where(InsuranceAgentInquiry.status == status_filter.upper())
    if category_filter and category_filter != "ALL":
        aliases = get_category_aliases(category_filter)
        query = query.where(
            or_(
                func.upper(InsuranceAgentInquiry.policy_type).in_(aliases),
                InsuranceAgentInquiry.policy_type.ilike(f"%{category_filter}%"),
            )
        )
    if source_filter and source_filter != "ALL":
        query = query.where(InsuranceAgentInquiry.lead_source == source_filter.upper())
    if priority_filter and priority_filter != "ALL":
        query = query.where(InsuranceAgentInquiry.priority == priority_filter.upper())
    if date_from:
        query = query.where(func.date(InsuranceAgentInquiry.created_at) >= date_from)
    if date_to:
        query = query.where(func.date(InsuranceAgentInquiry.created_at) <= date_to)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                InsuranceAgentInquiry.full_name.ilike(term),
                InsuranceAgentInquiry.mobile.ilike(term),
                InsuranceAgentInquiry.alternate_mobile.ilike(term),
                InsuranceAgentInquiry.email.ilike(term),
                InsuranceAgentInquiry.lead_number.ilike(term),
                InsuranceAgentInquiry.company_name.ilike(term),
                InsuranceAgentInquiry.city.ilike(term),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(InsuranceAgentInquiry.created_at.desc()).offset(offset).limit(page_size)
    inquiries = (await session.execute(query)).scalars().all()

    items = [_format_lead_response(inq) for inq in inquiries]
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


DEFAULT_12_STAGES = [
    "NEW",
    "CONTACTED",
    "INTERESTED",
    "REQUIREMENT_COLLECTED",
    "QUOTATION_PREPARATION",
    "QUOTATION_SENT",
    "NEGOTIATION",
    "FOLLOW_UP",
    "CONVERTED",
    "NOT_INTERESTED",
    "LOST",
    "DUPLICATE",
]

KANBAN_5_STAGE_NAMES = [
    "Pending",
    "Call Later",
    "Schedule Meeting",
    "Hold",
    "Done",
]


def _map_to_5_stage(st: str | None) -> str:
    s = (st or "").upper().strip()
    if s in ("PENDING", "NEW", "REQUIREMENT_COLLECTED"):
        return "Pending"
    if s in ("CALL_LATER", "CALL LATER", "CONTACTED", "INTERESTED", "FOLLOW_UP"):
        return "Call Later"
    if s in (
        "SCHEDULE_MEETING",
        "SCHEDULE MEETING",
        "MEETING_SCHEDULED",
        "QUOTATION_PREPARATION",
        "QUOTATION_SENT",
        "NEGOTIATION",
    ):
        return "Schedule Meeting"
    if s in ("HOLD", "ON_HOLD", "ON HOLD", "NOT_INTERESTED", "LOST", "DUPLICATE"):
        return "Hold"
    if s in ("DONE", "CONVERTED", "WON"):
        return "Done"
    return "Pending"


async def get_lead_kanban(
    session: AsyncSession,
    current_user: User | None = None,
    search: str | None = None,
    category_filter: str | None = None,
    priority_filter: str | None = None,
    assigned_user_id: uuid.UUID | None = None,
    view: str | None = None,
) -> LeadKanbanResponse:
    query = (
        select(InsuranceAgentInquiry)
        .options(
            selectinload(InsuranceAgentInquiry.sub_agent),
            selectinload(InsuranceAgentInquiry.assigned_user),
            selectinload(InsuranceAgentInquiry.preferred_company),
            selectinload(InsuranceAgentInquiry.preferred_plan),
            selectinload(InsuranceAgentInquiry.customer),
            selectinload(InsuranceAgentInquiry.converted_policy),
        )
    )
    query = _apply_rbac_filter(query, current_user)

    if category_filter and category_filter != "ALL":
        aliases = get_category_aliases(category_filter)
        query = query.where(
            or_(
                func.upper(InsuranceAgentInquiry.policy_type).in_(aliases),
                InsuranceAgentInquiry.policy_type.ilike(f"%{category_filter}%"),
            )
        )
    if priority_filter and priority_filter != "ALL":
        query = query.where(InsuranceAgentInquiry.priority == priority_filter.upper())
    if assigned_user_id:
        query = query.where(InsuranceAgentInquiry.assigned_user_id == assigned_user_id)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                InsuranceAgentInquiry.full_name.ilike(term),
                InsuranceAgentInquiry.mobile.ilike(term),
                InsuranceAgentInquiry.lead_number.ilike(term),
                InsuranceAgentInquiry.company_name.ilike(term),
            )
        )

    leads = (await session.execute(query.order_by(InsuranceAgentInquiry.created_at.desc()))).scalars().all()

    is_5_stage = view in ("5_stage", "5", "five_stage")
    target_stages = KANBAN_5_STAGE_NAMES if is_5_stage else DEFAULT_12_STAGES
    stage_map: dict[str, list[AgentInquiryResponse]] = {s: [] for s in target_stages}
    total_premium = Decimal("0.00")

    for lead in leads:
        dto = _format_lead_response(lead)
        if is_5_stage:
            bucket = _map_to_5_stage(lead.status)
        else:
            bucket = lead.status.upper() if lead.status else "NEW"
            if bucket not in stage_map:
                bucket = _map_to_5_stage(lead.status)
                if bucket not in stage_map:
                    bucket = "NEW"

        if bucket not in stage_map:
            stage_map[bucket] = []
        stage_map[bucket].append(dto)
        if lead.expected_premium:
            total_premium += lead.expected_premium

    stages = []
    for s in target_stages:
        leads_in_stage = stage_map.get(s, [])
        prem = sum((l.expected_premium or Decimal("0.00") for l in leads_in_stage), Decimal("0.00"))
        stages.append(
            LeadKanbanStage(
                stage=s,
                count=len(leads_in_stage),
                total_expected_premium=prem,
                leads=leads_in_stage,
            )
        )

    return LeadKanbanResponse(
        stages=stages,
        total_leads=len(leads),
        total_pipeline_premium=total_premium,
    )


async def get_lead_stats(
    session: AsyncSession,
    current_user: User | None = None,
) -> LeadStatsResponse:
    today = date.today()

    # 1. Status aggregates
    status_counts_q = (
        select(InsuranceAgentInquiry.status, func.count(InsuranceAgentInquiry.id))
        .group_by(InsuranceAgentInquiry.status)
    )
    status_counts_q = _apply_rbac_filter(status_counts_q, current_user)
    status_map = dict((await session.execute(status_counts_q)).all())

    total = sum(status_map.values())
    new_leads = status_map.get("NEW", 0) + status_map.get("PENDING", 0)
    contacted_leads = status_map.get("CONTACTED", 0) + status_map.get("CALL_LATER", 0) + status_map.get("CALL LATER", 0)
    interested_leads = (
        status_map.get("INTERESTED", 0)
        + status_map.get("REQUIREMENT_COLLECTED", 0)
        + status_map.get("QUOTATION_PREPARATION", 0)
        + status_map.get("QUOTATION_SENT", 0)
        + status_map.get("NEGOTIATION", 0)
        + status_map.get("SCHEDULE_MEETING", 0)
    )
    quotations_sent = status_map.get("QUOTATION_SENT", 0)
    converted_leads = status_map.get("CONVERTED", 0) + status_map.get("DONE", 0) + status_map.get("WON", 0)
    lost_leads = (
        status_map.get("LOST", 0)
        + status_map.get("NOT_INTERESTED", 0)
        + status_map.get("HOLD", 0)
        + status_map.get("ON_HOLD", 0)
    )
    duplicate_leads = status_map.get("DUPLICATE", 0)

    # Conversion Rate = Converted / (Total - Duplicate) * 100
    eligible = total - duplicate_leads
    conversion_rate = round((converted_leads / eligible * 100.0), 1) if eligible > 0 else 0.0

    # 2. Follow-ups Due Today and Overdue
    today_reminders_q = (
        select(InsuranceLeadReminder)
        .where(
            InsuranceLeadReminder.status == "PENDING",
            InsuranceLeadReminder.reminder_date == today,
        )
        .order_by(InsuranceLeadReminder.reminder_time.asc())
    )
    today_reminders = (await session.execute(today_reminders_q)).scalars().all()

    overdue_reminders_q = (
        select(InsuranceLeadReminder)
        .where(
            InsuranceLeadReminder.status == "PENDING",
            InsuranceLeadReminder.reminder_date < today,
        )
        .order_by(InsuranceLeadReminder.reminder_date.asc())
    )
    overdue_reminders = (await session.execute(overdue_reminders_q)).scalars().all()

    # 3. Widgets: Recent Leads
    recent_q = (
        select(InsuranceAgentInquiry)
        .options(
            selectinload(InsuranceAgentInquiry.sub_agent),
            selectinload(InsuranceAgentInquiry.assigned_user),
            selectinload(InsuranceAgentInquiry.preferred_company),
            selectinload(InsuranceAgentInquiry.preferred_plan),
            selectinload(InsuranceAgentInquiry.customer),
            selectinload(InsuranceAgentInquiry.converted_policy),
        )
        .order_by(InsuranceAgentInquiry.created_at.desc())
        .limit(5)
    )
    recent_q = _apply_rbac_filter(recent_q, current_user)
    recent_leads = [_format_lead_response(l) for l in (await session.execute(recent_q)).scalars().all()]

    # 4. Recently Converted Leads
    converted_q = (
        select(InsuranceAgentInquiry)
        .options(
            selectinload(InsuranceAgentInquiry.sub_agent),
            selectinload(InsuranceAgentInquiry.assigned_user),
            selectinload(InsuranceAgentInquiry.preferred_company),
            selectinload(InsuranceAgentInquiry.preferred_plan),
            selectinload(InsuranceAgentInquiry.customer),
            selectinload(InsuranceAgentInquiry.converted_policy),
        )
        .where(InsuranceAgentInquiry.status == "CONVERTED")
        .order_by(InsuranceAgentInquiry.updated_at.desc())
        .limit(5)
    )
    converted_q = _apply_rbac_filter(converted_q, current_user)
    recent_converted = [_format_lead_response(l) for l in (await session.execute(converted_q)).scalars().all()]

    # 5. High Priority Leads
    high_prio_q = (
        select(InsuranceAgentInquiry)
        .options(
            selectinload(InsuranceAgentInquiry.sub_agent),
            selectinload(InsuranceAgentInquiry.assigned_user),
            selectinload(InsuranceAgentInquiry.preferred_company),
            selectinload(InsuranceAgentInquiry.preferred_plan),
            selectinload(InsuranceAgentInquiry.customer),
            selectinload(InsuranceAgentInquiry.converted_policy),
        )
        .where(
            InsuranceAgentInquiry.priority.in_(("HIGH", "URGENT")),
            ~InsuranceAgentInquiry.status.in_(("CONVERTED", "LOST", "DUPLICATE")),
        )
        .order_by(InsuranceAgentInquiry.created_at.desc())
        .limit(5)
    )
    high_prio_q = _apply_rbac_filter(high_prio_q, current_user)
    high_prio_leads = [_format_lead_response(l) for l in (await session.execute(high_prio_q)).scalars().all()]

    # 6. Pipeline Summary
    pipeline_summary = []
    for s in LEAD_STATUSES:
        cnt = status_map.get(s, 0)
        pipeline_summary.append({"stage": s, "count": cnt})

    # 7. Agent Performance
    agent_perf_q = (
        select(
            InsuranceAgentInquiry.assigned_user_id,
            User.full_name,
            func.count(InsuranceAgentInquiry.id).label("total"),
            func.count(InsuranceAgentInquiry.id)
            .filter(InsuranceAgentInquiry.status == "CONVERTED")
            .label("converted"),
        )
        .join(User, InsuranceAgentInquiry.assigned_user_id == User.id, isouter=True)
        .group_by(InsuranceAgentInquiry.assigned_user_id, User.full_name)
    )
    agent_perf_q = _apply_rbac_filter(agent_perf_q, current_user)
    agent_rows = (await session.execute(agent_perf_q)).all()
    agent_performance = [
        {
            "agent_id": str(r[0]) if r[0] else None,
            "agent_name": r[1] or "Unassigned",
            "total_leads": r[2],
            "converted_leads": r[3],
            "conversion_rate": round(r[3] / r[2] * 100.0, 1) if r[2] > 0 else 0.0,
        }
        for r in agent_rows
    ]

    # 8. Source Performance
    source_perf_q = (
        select(
            InsuranceAgentInquiry.lead_source,
            func.count(InsuranceAgentInquiry.id).label("total"),
            func.count(InsuranceAgentInquiry.id)
            .filter(InsuranceAgentInquiry.status.in_(("CONVERTED", "DONE", "WON")))
            .label("converted"),
        )
        .group_by(InsuranceAgentInquiry.lead_source)
    )
    source_perf_q = _apply_rbac_filter(source_perf_q, current_user)
    source_rows = (await session.execute(source_perf_q)).all()
    source_performance = [
        {
            "source": r[0] or "OTHER",
            "total_leads": r[1],
            "converted_leads": r[2],
            "conversion_rate": round(r[2] / r[1] * 100.0, 1) if r[1] > 0 else 0.0,
        }
        for r in source_rows
    ]

    # 9. Category Performance
    cat_perf_q = (
        select(
            InsuranceAgentInquiry.policy_type,
            func.count(InsuranceAgentInquiry.id).label("total"),
            func.count(InsuranceAgentInquiry.id)
            .filter(InsuranceAgentInquiry.status.in_(("CONVERTED", "DONE", "WON")))
            .label("converted"),
            func.sum(InsuranceAgentInquiry.expected_premium).label("total_premium"),
        )
        .group_by(InsuranceAgentInquiry.policy_type)
    )
    cat_perf_q = _apply_rbac_filter(cat_perf_q, current_user)
    cat_rows = (await session.execute(cat_perf_q)).all()
    category_performance = [
        {
            "category": r[0] or "General Insurance",
            "total_leads": r[1],
            "converted_leads": r[2],
            "total_premium": float(r[3] or 0),
            "conversion_rate": round(r[2] / r[1] * 100.0, 1) if r[1] > 0 else 0.0,
        }
        for r in cat_rows
    ]

    return LeadStatsResponse(
        total_leads=total,
        new_leads=new_leads,
        contacted_leads=contacted_leads,
        interested_leads=interested_leads,
        follow_ups_due_today=len(today_reminders),
        overdue_follow_ups=len(overdue_reminders),
        quotations_sent=quotations_sent,
        converted_leads=converted_leads,
        lost_leads=lost_leads,
        conversion_rate=conversion_rate,
        recent_leads=recent_leads,
        follow_ups_due_today_list=[
            LeadReminderResponse.model_validate(r) for r in today_reminders
        ],
        overdue_follow_ups_list=[
            LeadReminderResponse.model_validate(r) for r in overdue_reminders
        ],
        pipeline_summary=pipeline_summary,
        agent_performance=agent_performance,
        source_performance=source_performance,
        category_performance=category_performance,
        recently_converted_leads=recent_converted,
        high_priority_leads=high_prio_leads,
    )


async def check_lead_duplicates(
    session: AsyncSession,
    payload: LeadDuplicateCheckRequest,
) -> LeadDuplicateCheckResponse:
    norm_phone = _normalize_phone(payload.mobile)
    email = payload.email.strip().lower() if payload.email and payload.email.strip() else None

    lead_filters = []
    if norm_phone:
        lead_filters.append(InsuranceAgentInquiry.mobile.like(f"%{norm_phone}%"))
        lead_filters.append(InsuranceAgentInquiry.alternate_mobile.like(f"%{norm_phone}%"))
    if email:
        lead_filters.append(InsuranceAgentInquiry.email.ilike(email))

    matching_leads: list[LeadDuplicateMatch] = []
    if lead_filters:
        q = (
            select(InsuranceAgentInquiry)
            .options(selectinload(InsuranceAgentInquiry.assigned_user))
            .where(or_(*lead_filters))
        )
        if payload.exclude_id:
            q = q.where(InsuranceAgentInquiry.id != payload.exclude_id)
        leads = (await session.execute(q.limit(10))).scalars().all()
        for l in leads:
            matching_leads.append(
                LeadDuplicateMatch(
                    id=l.id,
                    lead_number=l.lead_number,
                    full_name=l.full_name,
                    mobile=l.mobile,
                    email=l.email,
                    status=l.status,
                    assigned_user_name=l.assigned_user.full_name if l.assigned_user else None,
                    created_at=l.created_at,
                )
            )

    cust_filters = []
    if norm_phone:
        cust_filters.append(Customer.phone.like(f"%{norm_phone}%"))
    if email:
        cust_filters.append(Customer.email.ilike(email))

    matching_custs: list[CustomerDuplicateMatch] = []
    if cust_filters:
        cq = select(Customer).where(or_(*cust_filters)).limit(10)
        custs = (await session.execute(cq)).scalars().all()
        for c in custs:
            matching_custs.append(
                CustomerDuplicateMatch(
                    id=c.id,
                    first_name=c.first_name,
                    last_name=c.last_name,
                    phone=c.phone,
                    email=c.email,
                    city=c.city,
                    pipeline_status=c.pipeline_status,
                )
            )

    has_dupes = len(matching_leads) > 0 or len(matching_custs) > 0
    return LeadDuplicateCheckResponse(
        has_duplicates=has_dupes,
        matching_leads=matching_leads,
        matching_customers=matching_custs,
    )


async def create_lead(
    session: AsyncSession,
    payload: LeadCreate,
    current_user: User,
    client_ip: str | None = None,
) -> AgentInquiryResponse:
    cust_id = getattr(payload, "customer_id", None)

    if not payload.force_duplicate and not cust_id:
        dupe_res = await check_lead_duplicates(
            session,
            LeadDuplicateCheckRequest(
                mobile=payload.mobile,
                email=payload.email,
            ),
        )
        if dupe_res.matching_leads:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Potential duplicate record detected.",
                    "duplicates": dupe_res.model_dump(mode="json"),
                },
            )
        elif dupe_res.matching_customers and not cust_id:
            cust_id = dupe_res.matching_customers[0].id

    lead_num = await _generate_lead_number(session)

    address_val = (payload.address or getattr(payload, "address_line1", None) or "").strip() or None
    address_line_2_val = (payload.address_line_2 or getattr(payload, "address_line2", None) or "").strip() or None
    sum_insured_val = payload.sum_insured if payload.sum_insured is not None else getattr(payload, "coverage_amount", None)
    member_count_val = payload.member_count if payload.member_count is not None else getattr(payload, "members_count", 1)
    existing_expiry_val = payload.existing_policy_expiry or getattr(payload, "existing_expiry_date", None)
    lead_source_val = payload.lead_source or ("EXISTING_CUSTOMER" if cust_id else "PHONE_CALL")

    lead = InsuranceAgentInquiry(
        id=uuid.uuid4(),
        lead_number=lead_num,
        customer_id=cust_id,
        lead_type=payload.lead_type or "INDIVIDUAL",
        full_name=payload.full_name.strip(),
        mobile=payload.mobile.strip(),
        alternate_mobile=payload.alternate_mobile.strip() if payload.alternate_mobile else None,
        email=payload.email.strip().lower() if payload.email and payload.email.strip() else None,
        date_of_birth=payload.date_of_birth,
        gender=payload.gender,
        occupation=payload.occupation,
        company_name=payload.company_name.strip() if payload.company_name else None,
        gstin=payload.gstin.strip().upper() if payload.gstin else None,
        address=address_val,
        address_line_2=address_line_2_val,
        city=payload.city.strip() if payload.city else None,
        state=payload.state.strip() if payload.state else None,
        pincode=payload.pincode.strip() if payload.pincode else None,
        policy_type=normalize_category_label(payload.policy_type.strip()),
        preferred_company_id=payload.preferred_company_id,
        preferred_plan_id=payload.preferred_plan_id,
        sum_insured=sum_insured_val,
        expected_premium=payload.expected_premium,
        coverage_type=payload.coverage_type or "INDIVIDUAL",
        member_count=member_count_val or 1,
        existing_insurance=payload.existing_insurance or ("YES" if getattr(payload, "has_existing_insurance", False) else None),
        existing_policy_number=payload.existing_policy_number,
        existing_policy_expiry=existing_expiry_val,
        requirement_description=payload.requirement_description,
        lead_source=lead_source_val,
        campaign_name=payload.campaign_name,
        referral_name=payload.referral_name,
        priority=payload.priority or "NORMAL",
        assigned_user_id=payload.assigned_user_id,
        sub_agent_id=payload.sub_agent_id,
        status="NEW",
        consent=True,
        ip_address=client_ip,
        tenant_id=getattr(current_user, "tenant_id", None),
    )
    session.add(lead)

    act = InsuranceLeadActivity(
        id=uuid.uuid4(),
        lead_id=lead.id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        activity_type="LEAD_CREATED",
        title="Lead Created",
        description=f"Lead {lead.full_name} ({lead_num}) created by {current_user.full_name}.",
    )
    session.add(act)

    if cust_id:
        cust_stmt = select(Customer).where(Customer.id == cust_id)
        cust_obj = (await session.execute(cust_stmt)).scalar_one_or_none()
        if cust_obj:
            lead_linked_act = InsuranceLeadActivity(
                id=uuid.uuid4(),
                lead_id=lead.id,
                user_id=current_user.id,
                user_name=current_user.full_name,
                activity_type="CUSTOMER_LINKED",
                title="Linked to Customer Profile",
                description=f"Lead linked to registered customer {cust_obj.first_name} {cust_obj.last_name} (#{str(cust_obj.id)[:8]}).",
            )
            session.add(lead_linked_act)

    if payload.notes and payload.notes.strip():
        note = InsuranceLeadNote(
            id=uuid.uuid4(),
            lead_id=lead.id,
            author_id=current_user.id,
            author_name=current_user.full_name,
            title="Initial Consultation Note",
            description=payload.notes.strip(),
            note_type="GENERAL",
            visibility="INTERNAL",
        )
        session.add(note)

    if payload.assigned_user_id and payload.assigned_user_id != current_user.id:
        notif = CrmNotification(
            id=uuid.uuid4(),
            user_id=payload.assigned_user_id,
            title="New Lead Assigned",
            message=f"You have been assigned lead {lead.full_name} ({lead_num}).",
            notification_type="LEAD_ASSIGNED",
        )
        session.add(notif)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="LEAD_CREATED",
        resource_type="lead",
        resource_id=lead.id,
        state_delta={
            "lead_number": lead_num,
            "full_name": lead.full_name,
            "policy_type": lead.policy_type,
            "lead_source": lead.lead_source,
            "priority": lead.priority,
        },
        ip_address=client_ip,
    )
    session.add(audit)

    await session.commit()
    return await get_lead_response_by_id(session, lead.id)


async def get_lead_response_by_id(session: AsyncSession, lead_id: uuid.UUID) -> AgentInquiryResponse:
    q = (
        select(InsuranceAgentInquiry)
        .options(
            selectinload(InsuranceAgentInquiry.sub_agent),
            selectinload(InsuranceAgentInquiry.assigned_user),
            selectinload(InsuranceAgentInquiry.preferred_company),
            selectinload(InsuranceAgentInquiry.preferred_plan),
            selectinload(InsuranceAgentInquiry.customer),
            selectinload(InsuranceAgentInquiry.converted_policy),
        )
        .where(InsuranceAgentInquiry.id == lead_id)
    )
    lead = (await session.execute(q)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Lead {lead_id} not found.")
    return _format_lead_response(lead)


async def get_lead_360(
    session: AsyncSession,
    lead_id: uuid.UUID,
    current_user: User | None = None,
) -> Lead360Response:
    q = (
        select(InsuranceAgentInquiry)
        .options(
            selectinload(InsuranceAgentInquiry.sub_agent),
            selectinload(InsuranceAgentInquiry.assigned_user),
            selectinload(InsuranceAgentInquiry.preferred_company),
            selectinload(InsuranceAgentInquiry.preferred_plan),
            selectinload(InsuranceAgentInquiry.customer),
            selectinload(InsuranceAgentInquiry.converted_policy),
            selectinload(InsuranceAgentInquiry.activities),
            selectinload(InsuranceAgentInquiry.notes),
            selectinload(InsuranceAgentInquiry.reminders),
            selectinload(InsuranceAgentInquiry.quotations),
        )
        .where(InsuranceAgentInquiry.id == lead_id)
    )
    lead = (await session.execute(q)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Lead {lead_id} not found.")

    lead_dto = _format_lead_response(lead)
    activities = []
    for a in lead.activities:
        act_dto = LeadActivityResponse.model_validate(a)
        if not act_dto.action_type:
            act_dto.action_type = act_dto.activity_type
        if not act_dto.actor_name:
            act_dto.actor_name = act_dto.user_name
        activities.append(act_dto)
    notes = [LeadNoteResponse.model_validate(n) for n in lead.notes]
    reminders = [LeadReminderResponse.model_validate(r) for r in lead.reminders]

    quotation_summaries = []
    for q_item in lead.quotations:
        quotation_summaries.append(
            LeadQuotationSummary(
                id=q_item.id,
                quotation_number=q_item.quotation_number,
                quotation_title=q_item.quotation_title,
                quotation_date=q_item.quotation_date,
                status=q_item.status,
                total_plans=len(q_item.company_plans) if hasattr(q_item, "company_plans") and q_item.company_plans else 0,
                created_at=q_item.created_at,
            )
        )

    return Lead360Response(
        lead=lead_dto,
        activities=activities,
        notes=notes,
        reminders=reminders,
        quotations=quotation_summaries,
    )


async def update_lead(
    session: AsyncSession,
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    current_user: User,
) -> AgentInquiryResponse:
    q = select(InsuranceAgentInquiry).where(InsuranceAgentInquiry.id == lead_id)
    lead = (await session.execute(q)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Lead {lead_id} not found.")

    diffs = []
    data = payload.model_dump(exclude_unset=True)

    alias_map = {
        "address_line1": "address",
        "address_line2": "address_line_2",
        "coverage_amount": "sum_insured",
        "members_count": "member_count",
        "existing_expiry_date": "existing_policy_expiry",
    }

    for field, new_val in data.items():
        if field == "notes":
            continue
        target_field = alias_map.get(field, field)
        if hasattr(lead, target_field):
            old_val = getattr(lead, target_field, None)
            if old_val != new_val:
                diffs.append({"field": target_field, "old": str(old_val), "new": str(new_val)})
                setattr(lead, target_field, new_val)

    if not diffs:
        return await get_lead_response_by_id(session, lead_id)

    lead.updated_at = datetime.now(UTC)

    field_summary = ", ".join(f"{d['field']} ({d['old']} -> {d['new']})" for d in diffs[:4])
    act = InsuranceLeadActivity(
        id=uuid.uuid4(),
        lead_id=lead.id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        activity_type="LEAD_UPDATED",
        title="Lead Information Updated",
        description=f"Updated by {current_user.full_name}: {field_summary}",
    )
    session.add(act)

    status_diff = next((d for d in diffs if d["field"] == "status"), None)
    if status_diff:
        status_act = InsuranceLeadActivity(
            id=uuid.uuid4(),
            lead_id=lead.id,
            user_id=current_user.id,
            user_name=current_user.full_name,
            activity_type="STATUS_CHANGED",
            title=f"Status Changed: {status_diff['new']}",
            description=f"Stage transitioned from {status_diff['old']} to {status_diff['new']}.",
            old_value=status_diff["old"],
            new_value=status_diff["new"],
        )
        session.add(status_act)

    assign_diff = next((d for d in diffs if d["field"] == "assigned_user_id"), None)
    if assign_diff and lead.assigned_user_id:
        if lead.assigned_user_id != current_user.id:
            notif = CrmNotification(
                id=uuid.uuid4(),
                user_id=lead.assigned_user_id,
                title="Lead Reassigned",
                message=f"Lead {lead.full_name} ({lead.lead_number}) has been assigned to you.",
                notification_type="LEAD_ASSIGNED",
            )
            session.add(notif)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="LEAD_UPDATED",
        resource_type="lead",
        resource_id=lead.id,
        state_delta={"changes": diffs},
    )
    session.add(audit)

    await session.commit()
    return await get_lead_response_by_id(session, lead_id)


async def delete_lead(
    session: AsyncSession,
    lead_id: uuid.UUID,
    current_user: User | None = None,
) -> dict[str, Any]:
    inquiry = await session.get(InsuranceAgentInquiry, lead_id)
    if not inquiry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    # RBAC check
    if current_user and getattr(current_user, "role", "").upper() not in ("ADMIN", "SUPERADMIN"):
        if inquiry.assigned_user_id and inquiry.assigned_user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this lead.",
            )

    # Unlink health quotations referencing this lead
    await session.execute(
        update(HealthQuotation).where(HealthQuotation.lead_id == lead_id).values(lead_id=None)
    )

    lead_num = inquiry.lead_number or str(lead_id)
    actor_id = current_user.id if current_user else None
    if actor_id:
        audit = AuditLog(
            id=uuid.uuid4(),
            actor_id=actor_id,
            action="LEAD_DELETED",
            resource_type="lead",
            resource_id=inquiry.id,
            state_delta={"lead_number": lead_num, "full_name": inquiry.full_name},
        )
        session.add(audit)

    await session.delete(inquiry)
    await session.commit()
    return {"message": f"Lead {lead_num} deleted successfully.", "id": str(lead_id)}


async def update_inquiry_status(
    session: AsyncSession,
    inquiry_id: uuid.UUID,
    payload: AgentInquiryStatusUpdate,
    current_user: User | None = None,
) -> AgentInquiryResponse:
    q = (
        select(InsuranceAgentInquiry)
        .options(
            selectinload(InsuranceAgentInquiry.sub_agent),
            selectinload(InsuranceAgentInquiry.assigned_user),
            selectinload(InsuranceAgentInquiry.preferred_company),
            selectinload(InsuranceAgentInquiry.preferred_plan),
            selectinload(InsuranceAgentInquiry.customer),
            selectinload(InsuranceAgentInquiry.converted_policy),
        )
        .where(InsuranceAgentInquiry.id == inquiry_id)
    )
    inq = (await session.execute(q)).scalar_one_or_none()
    if not inq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Lead {inquiry_id} not found.")

    new_stat = payload.status.strip().upper()
    valid_statuses = set(LEAD_STATUSES) | {
        "PENDING",
        "CALL_LATER",
        "CALL LATER",
        "SCHEDULE_MEETING",
        "SCHEDULE MEETING",
        "HOLD",
        "ON_HOLD",
        "DONE",
        "WON",
    }
    if new_stat not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.status}'. Valid statuses: {', '.join(sorted(valid_statuses))}.",
        )

    old_stat = inq.status
    inq.status = new_stat
    if payload.lost_reason:
        inq.lost_reason = payload.lost_reason
    inq.updated_at = datetime.now(UTC)

    actor_name = current_user.full_name if current_user else "System"
    actor_id = current_user.id if current_user else None

    act = InsuranceLeadActivity(
        id=uuid.uuid4(),
        lead_id=inq.id,
        user_id=actor_id,
        user_name=actor_name,
        activity_type="STATUS_CHANGED",
        title=f"Status Changed: {new_stat}",
        description=f"Status changed from {old_stat} to {new_stat} by {actor_name}. {payload.remarks or ''}".strip(),
        old_value=old_stat,
        new_value=new_stat,
    )
    session.add(act)

    if actor_id:
        audit = AuditLog(
            id=uuid.uuid4(),
            actor_id=actor_id,
            action="LEAD_STATUS_UPDATED",
            resource_type="lead",
            resource_id=inq.id,
            state_delta={"old_status": old_stat, "new_status": new_stat, "lost_reason": payload.lost_reason},
        )
        session.add(audit)

    await session.commit()
    await session.refresh(inq)
    return _format_lead_response(inq)


async def assign_lead(
    session: AsyncSession,
    lead_id: uuid.UUID,
    payload: LeadAssignmentRequest,
    current_user: User,
) -> AgentInquiryResponse:
    q = select(InsuranceAgentInquiry).where(InsuranceAgentInquiry.id == lead_id)
    lead = (await session.execute(q)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Lead {lead_id} not found.")

    target_user_name = None
    if payload.assigned_user_id:
        u = (await session.execute(select(User).where(User.id == payload.assigned_user_id))).scalar_one_or_none()
        if not u:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target assignee user not found.")
        target_user_name = u.full_name
        lead.assigned_user_id = u.id

    if payload.sub_agent_id is not None:
        lead.sub_agent_id = payload.sub_agent_id

    lead.updated_at = datetime.now(UTC)

    desc_str = f"Lead assigned to {target_user_name or 'unassigned'} by {current_user.full_name}."
    act = InsuranceLeadActivity(
        id=uuid.uuid4(),
        lead_id=lead.id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        activity_type="LEAD_ASSIGNED",
        title="Lead Assigned",
        description=desc_str,
    )
    session.add(act)

    if payload.assigned_user_id and payload.assigned_user_id != current_user.id:
        notif = CrmNotification(
            id=uuid.uuid4(),
            user_id=payload.assigned_user_id,
            title="Lead Assigned to You",
            message=f"Lead {lead.full_name} ({lead.lead_number}) has been assigned to you.",
            notification_type="LEAD_ASSIGNED",
        )
        session.add(notif)

    await session.commit()
    return await get_lead_response_by_id(session, lead_id)


async def bulk_assign_leads(
    session: AsyncSession,
    payload: LeadBulkAssignRequest,
    current_user: User,
) -> dict:
    target_name = None
    if payload.assigned_user_id:
        u = (await session.execute(select(User).where(User.id == payload.assigned_user_id))).scalar_one_or_none()
        if not u:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found.")
        target_name = u.full_name

    q = select(InsuranceAgentInquiry).where(InsuranceAgentInquiry.id.in_(payload.lead_ids))
    leads = (await session.execute(q)).scalars().all()

    count = 0
    for lead in leads:
        lead.assigned_user_id = payload.assigned_user_id
        if payload.sub_agent_id is not None:
            lead.sub_agent_id = payload.sub_agent_id
        lead.updated_at = datetime.now(UTC)
        count += 1

        act = InsuranceLeadActivity(
            id=uuid.uuid4(),
            lead_id=lead.id,
            user_id=current_user.id,
            user_name=current_user.full_name,
            activity_type="LEAD_ASSIGNED",
            title="Bulk Lead Assignment",
            description=f"Assigned to {target_name or 'Unassigned'} by {current_user.full_name}.",
        )
        session.add(act)

    if payload.assigned_user_id and payload.assigned_user_id != current_user.id:
        notif = CrmNotification(
            id=uuid.uuid4(),
            user_id=payload.assigned_user_id,
            title="Bulk Leads Assigned",
            message=f"{count} leads have been assigned to you by {current_user.full_name}.",
            notification_type="LEAD_ASSIGNED",
        )
        session.add(notif)

    await session.commit()
    return {"status": "success", "assigned_count": count, "message": f"{count} leads successfully assigned."}


# --- Follow-up & Reminders Subsystem ---


async def schedule_lead_follow_up(
    session: AsyncSession,
    lead_id: uuid.UUID,
    payload: LeadReminderCreate,
    current_user: User,
) -> LeadReminderResponse:
    q = select(InsuranceAgentInquiry).where(InsuranceAgentInquiry.id == lead_id)
    lead = (await session.execute(q)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Lead {lead_id} not found.")

    assigned_name = current_user.full_name
    assigned_id = payload.assigned_to_id or current_user.id
    if payload.assigned_to_id:
        target_u = (await session.execute(select(User).where(User.id == payload.assigned_to_id))).scalar_one_or_none()
        if target_u:
            assigned_name = target_u.full_name

    reminder_date = payload.reminder_date or date.today()
    reminder_time = payload.reminder_time.strip() if payload.reminder_time else None
    if getattr(payload, "scheduled_time", None):
        try:
            st = payload.scheduled_time
            if isinstance(st, str) and "T" in st:
                reminder_date = date.fromisoformat(st.split("T")[0])
                if not reminder_time:
                    reminder_time = st.split("T")[1][:5]
        except Exception:
            pass

    title = (payload.title or "").strip()
    if not title or title == "Follow-up Task":
        rem_type_title = (payload.reminder_type or "Follow-up").replace("_", " ").title()
        title = f"{rem_type_title}: {lead.full_name}"

    description = payload.description.strip() if payload.description else None
    if not description and getattr(payload, "notes", None):
        description = str(payload.notes).strip()

    reminder = InsuranceLeadReminder(
        id=uuid.uuid4(),
        lead_id=lead_id,
        created_by_id=current_user.id,
        assigned_to_id=assigned_id,
        assigned_to_name=assigned_name,
        title=title,
        description=description,
        reminder_date=reminder_date,
        reminder_time=reminder_time,
        reminder_type=payload.reminder_type.upper(),
        priority=payload.priority.upper(),
        status="PENDING",
    )
    session.add(reminder)

    combined_dt = datetime.combine(reminder_date, datetime.min.time(), tzinfo=UTC)
    lead.next_follow_up_date = combined_dt
    lead.updated_at = datetime.now(UTC)

    act = InsuranceLeadActivity(
        id=uuid.uuid4(),
        lead_id=lead_id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        activity_type="FOLLOW_UP_SCHEDULED",
        title=f"Follow-up Scheduled: {reminder.reminder_type}",
        description=f"{reminder.title} scheduled for {reminder.reminder_date} {reminder.reminder_time or ''} (Assigned to: {assigned_name}).",
    )
    session.add(act)

    if assigned_id != current_user.id:
        notif = CrmNotification(
            id=uuid.uuid4(),
            user_id=assigned_id,
            title="Follow-up Assigned",
            message=f"Follow-up scheduled for {lead.full_name} on {reminder.reminder_date}.",
            notification_type="FOLLOW_UP_ASSIGNED",
        )
        session.add(notif)

    await session.commit()
    await session.refresh(reminder)
    return LeadReminderResponse.model_validate(reminder)


async def complete_lead_follow_up(
    session: AsyncSession,
    lead_id: uuid.UUID,
    reminder_id: uuid.UUID,
    payload: LeadReminderCompleteRequest,
    current_user: User,
) -> dict:
    q = select(InsuranceLeadReminder).where(
        InsuranceLeadReminder.id == reminder_id,
        InsuranceLeadReminder.lead_id == lead_id,
    )
    reminder = (await session.execute(q)).scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")

    completion_remarks = (payload.completion_remarks or "").strip()
    if not completion_remarks and getattr(payload, "remarks", None):
        completion_remarks = str(payload.remarks).strip()
    if not completion_remarks:
        completion_remarks = "Follow-up marked as completed"

    reminder.status = "COMPLETED"
    reminder.completed_at = datetime.now(UTC)
    reminder.completion_remarks = completion_remarks
    reminder.outcome = payload.outcome.strip() if payload.outcome else None
    reminder.updated_at = datetime.now(UTC)

    act = InsuranceLeadActivity(
        id=uuid.uuid4(),
        lead_id=lead_id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        activity_type="FOLLOW_UP_COMPLETED",
        title=f"Follow-up Completed: {reminder.outcome or 'COMPLETED'}",
        description=f"Outcome: {reminder.outcome or 'Completed'}. Remarks: {completion_remarks}",
    )
    session.add(act)

    next_reminder_dto = None
    next_rem_date = payload.next_reminder_date
    next_rem_time = payload.next_reminder_time
    if payload.schedule_next and not next_rem_date and getattr(payload, "next_scheduled_time", None):
        try:
            nst = payload.next_scheduled_time
            if isinstance(nst, str) and "T" in nst:
                next_rem_date = date.fromisoformat(nst.split("T")[0])
                if not next_rem_time:
                    next_rem_time = nst.split("T")[1][:5]
        except Exception:
            pass

    if payload.schedule_next and next_rem_date:
        reminder.next_follow_up_date = next_rem_date
        next_rem = InsuranceLeadReminder(
            id=uuid.uuid4(),
            lead_id=lead_id,
            created_by_id=current_user.id,
            assigned_to_id=reminder.assigned_to_id,
            assigned_to_name=reminder.assigned_to_name,
            title=payload.next_reminder_title or f"Next Follow-up for {reminder.title}",
            description=payload.next_reminder_description,
            reminder_date=next_rem_date,
            reminder_time=next_rem_time,
            reminder_type=(payload.next_reminder_type or "CALL").upper(),
            priority=reminder.priority,
            status="PENDING",
        )
        session.add(next_rem)

        lead = (
            await session.execute(
                select(InsuranceAgentInquiry).where(InsuranceAgentInquiry.id == lead_id)
            )
        ).scalar_one_or_none()
        if lead:
            lead.next_follow_up_date = datetime.combine(next_rem_date, datetime.min.time(), tzinfo=UTC)
            lead.updated_at = datetime.now(UTC)

        next_act = InsuranceLeadActivity(
            id=uuid.uuid4(),
            lead_id=lead_id,
            user_id=current_user.id,
            user_name=current_user.full_name,
            activity_type="FOLLOW_UP_SCHEDULED",
            title=f"Next Follow-up Scheduled: {next_rem.reminder_type}",
            description=f"Scheduled for {next_rem.reminder_date} {next_rem.reminder_time or ''}.",
        )
        session.add(next_act)
        await session.flush()
        next_reminder_dto = LeadReminderResponse.model_validate(next_rem)

    await session.commit()
    return {
        "status": "success",
        "completed_reminder": LeadReminderResponse.model_validate(reminder),
        "next_reminder": next_reminder_dto,
        "message": "Follow-up marked completed successfully.",
    }


async def list_lead_follow_ups(
    session: AsyncSession,
    current_user: User | None = None,
    status_filter: str | None = None,
    due_filter: str | None = None,
    assigned_to_id: uuid.UUID | None = None,
) -> list[LeadReminderResponse]:
    today = date.today()
    q = select(InsuranceLeadReminder).order_by(InsuranceLeadReminder.reminder_date.asc())

    if status_filter and status_filter != "ALL":
        q = q.where(InsuranceLeadReminder.status == status_filter.upper())
    if assigned_to_id:
        q = q.where(InsuranceLeadReminder.assigned_to_id == assigned_to_id)

    if due_filter == "TODAY":
        q = q.where(InsuranceLeadReminder.reminder_date == today)
    elif due_filter == "OVERDUE":
        q = q.where(InsuranceLeadReminder.reminder_date < today, InsuranceLeadReminder.status == "PENDING")
    elif due_filter == "UPCOMING":
        q = q.where(InsuranceLeadReminder.reminder_date > today)

    reminders = (await session.execute(q)).scalars().all()
    return [LeadReminderResponse.model_validate(r) for r in reminders]


# --- Notes Subsystem ---


async def add_lead_note(
    session: AsyncSession,
    lead_id: uuid.UUID,
    payload: LeadNoteCreate,
    current_user: User,
) -> LeadNoteResponse:
    q = select(InsuranceAgentInquiry).where(InsuranceAgentInquiry.id == lead_id)
    lead = (await session.execute(q)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Lead {lead_id} not found.")

    note = InsuranceLeadNote(
        id=uuid.uuid4(),
        lead_id=lead_id,
        author_id=current_user.id,
        author_name=current_user.full_name,
        title=payload.title.strip() if payload.title else None,
        description=payload.description.strip(),
        note_type=payload.note_type.upper(),
        visibility=payload.visibility.upper(),
    )
    session.add(note)

    act = InsuranceLeadActivity(
        id=uuid.uuid4(),
        lead_id=lead_id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        activity_type="NOTE_ADDED",
        title="Internal Note Added",
        description=f"Note ({note.note_type}) added by {current_user.full_name}: {note.title or note.description[:60]}",
    )
    session.add(act)

    await session.commit()
    await session.refresh(note)
    return LeadNoteResponse.model_validate(note)


async def update_lead_note(
    session: AsyncSession,
    lead_id: uuid.UUID,
    note_id: uuid.UUID,
    payload: LeadNoteCreate,
    current_user: User,
) -> LeadNoteResponse:
    note = await session.get(InsuranceLeadNote, note_id)
    if not note or note.lead_id != lead_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found.")
    if payload.description:
        note.description = payload.description.strip()
    if payload.title is not None:
        note.title = payload.title.strip() if payload.title else None
    if payload.note_type:
        note.note_type = payload.note_type.upper()
    if payload.visibility:
        note.visibility = payload.visibility.upper()

    act = InsuranceLeadActivity(
        id=uuid.uuid4(),
        lead_id=lead_id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        activity_type="NOTE_UPDATED",
        title="Internal Note Updated",
        description=f"Note updated by {current_user.full_name}.",
    )
    session.add(act)
    await session.commit()
    await session.refresh(note)
    return LeadNoteResponse.model_validate(note)


async def delete_lead_note(
    session: AsyncSession,
    lead_id: uuid.UUID,
    note_id: uuid.UUID,
    current_user: User,
) -> dict[str, Any]:
    note = await session.get(InsuranceLeadNote, note_id)
    if not note or note.lead_id != lead_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found.")
    await session.delete(note)
    act = InsuranceLeadActivity(
        id=uuid.uuid4(),
        lead_id=lead_id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        activity_type="NOTE_DELETED",
        title="Internal Note Deleted",
        description=f"Note deleted by {current_user.full_name}.",
    )
    session.add(act)
    await session.commit()
    return {"message": "Note deleted successfully."}


# --- Lead to Customer Conversion (Phase 10) ---


async def convert_lead_to_customer(
    session: AsyncSession,
    lead_id: uuid.UUID,
    payload: LeadConvertRequest,
    current_user: User,
) -> LeadConvertResponse:
    q = (
        select(InsuranceAgentInquiry)
        .options(selectinload(InsuranceAgentInquiry.customer))
        .where(InsuranceAgentInquiry.id == lead_id)
    )
    lead = (await session.execute(q)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Lead {lead_id} not found.")

    if lead.status == "CONVERTED" and lead.customer_id:
        return LeadConvertResponse(
            customer_id=lead.customer_id,
            customer_name=f"{lead.customer.first_name} {lead.customer.last_name}" if lead.customer else lead.full_name,
            lead_id=lead.id,
            status="ALREADY_CONVERTED",
            message="Lead was already converted to this customer.",
        )

    customer: Customer | None = None

    if payload.existing_customer_id:
        cq = select(Customer).where(Customer.id == payload.existing_customer_id)
        customer = (await session.execute(cq)).scalar_one_or_none()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specified existing customer not found.")
    else:
        phone_match_q = select(Customer).where(Customer.phone == payload.phone.strip())
        customer = (await session.execute(phone_match_q)).scalar_one_or_none()

        if not customer:
            customer = Customer(
                id=uuid.uuid4(),
                first_name=payload.first_name.strip(),
                last_name=payload.last_name.strip(),
                phone=payload.phone.strip(),
                email=payload.email.strip().lower() if payload.email and payload.email.strip() else None,
                customer_type=payload.customer_type or "INDIVIDUAL",
                company_name=payload.company_name.strip() if payload.company_name else None,
                gstin=payload.gstin.strip().upper() if payload.gstin else None,
                pan_number=payload.pan_number.strip().upper() if payload.pan_number else None,
                aadhaar_hash=payload.aadhaar_number.strip() if payload.aadhaar_number else None,
                address=payload.address.strip() if payload.address else None,
                city=payload.city.strip() if payload.city else None,
                state=payload.state.strip() if payload.state else None,
                pincode=payload.pincode.strip() if payload.pincode else None,
                date_of_birth=payload.date_of_birth,
                gender=payload.gender,
                occupation=payload.occupation,
                pipeline_status="ACTIVE",
                created_by_id=current_user.id,
                reference_source=f"LEAD:{lead.lead_number or str(lead.id)}",
            )
            session.add(customer)
            await session.flush()

    lead.customer_id = customer.id
    lead.status = "CONVERTED"
    lead.updated_at = datetime.now(UTC)

    act = InsuranceLeadActivity(
        id=uuid.uuid4(),
        lead_id=lead.id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        activity_type="LEAD_CONVERTED",
        title="Lead Converted to Customer",
        description=f"Prospect successfully converted to active Customer {customer.first_name} {customer.last_name} by {current_user.full_name}.",
    )
    session.add(act)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="LEAD_CONVERTED",
        resource_type="lead",
        resource_id=lead.id,
        state_delta={
            "customer_id": str(customer.id),
            "customer_name": f"{customer.first_name} {customer.last_name}",
            "lead_number": lead.lead_number,
        },
    )
    session.add(audit)

    await session.commit()

    return LeadConvertResponse(
        customer_id=customer.id,
        customer_name=f"{customer.first_name} {customer.last_name}".strip(),
        lead_id=lead.id,
        status="CONVERTED",
        message=f"Lead {lead.full_name} converted to Customer {customer.first_name} {customer.last_name} successfully.",
    )


# --- Quotation Integration (Phase 9) ---


async def link_lead_quotation(
    session: AsyncSession,
    lead_id: uuid.UUID,
    quotation_id: uuid.UUID,
    current_user: User,
) -> dict:
    lead = (
        await session.execute(
            select(InsuranceAgentInquiry).where(InsuranceAgentInquiry.id == lead_id)
        )
    ).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Lead {lead_id} not found.")

    quote = (
        await session.execute(
            select(HealthQuotation).where(HealthQuotation.id == quotation_id)
        )
    ).scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Quotation {quotation_id} not found.")

    quote.lead_id = lead_id
    lead.status = "QUOTATION_SENT"
    lead.updated_at = datetime.now(UTC)

    act = InsuranceLeadActivity(
        id=uuid.uuid4(),
        lead_id=lead_id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        activity_type="QUOTATION_LINKED",
        title="Quotation Linked",
        description=f"Health quotation {quote.quotation_number} ({quote.quotation_title}) linked by {current_user.full_name}.",
    )
    session.add(act)

    await session.commit()
    return {
        "status": "success",
        "message": f"Quotation {quote.quotation_number} linked to Lead {lead.lead_number}.",
    }


# --- Bulk Import & Export (Phase 12) ---


async def export_leads(
    session: AsyncSession,
    current_user: User | None = None,
    export_format: str = "xlsx",
    status_filter: str | None = None,
    category_filter: str | None = None,
    source_filter: str | None = None,
    priority_filter: str | None = None,
    assigned_user_id: uuid.UUID | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> tuple[bytes, str, str]:
    query = (
        select(InsuranceAgentInquiry)
        .options(
            selectinload(InsuranceAgentInquiry.sub_agent),
            selectinload(InsuranceAgentInquiry.assigned_user),
            selectinload(InsuranceAgentInquiry.preferred_company),
            selectinload(InsuranceAgentInquiry.preferred_plan),
            selectinload(InsuranceAgentInquiry.customer),
            selectinload(InsuranceAgentInquiry.converted_policy),
        )
    )
    query = _apply_rbac_filter(query, current_user)

    if status_filter and status_filter != "ALL":
        query = query.where(InsuranceAgentInquiry.status == status_filter.upper())
    if category_filter and category_filter != "ALL":
        aliases = get_category_aliases(category_filter)
        query = query.where(
            or_(
                func.upper(InsuranceAgentInquiry.policy_type).in_(aliases),
                InsuranceAgentInquiry.policy_type.ilike(f"%{category_filter}%"),
            )
        )
    if source_filter and source_filter != "ALL":
        query = query.where(InsuranceAgentInquiry.lead_source == source_filter.upper())
    if priority_filter and priority_filter != "ALL":
        query = query.where(InsuranceAgentInquiry.priority == priority_filter.upper())
    if assigned_user_id:
        query = query.where(InsuranceAgentInquiry.assigned_user_id == assigned_user_id)
    if date_from:
        query = query.where(func.date(InsuranceAgentInquiry.created_at) >= date_from)
    if date_to:
        query = query.where(func.date(InsuranceAgentInquiry.created_at) <= date_to)

    leads = (await session.execute(query.order_by(InsuranceAgentInquiry.created_at.desc()))).scalars().all()

    headers = [
        "Lead Number",
        "Lead Type",
        "Prospect Name",
        "Mobile Number",
        "Alternate Mobile",
        "Email Address",
        "Insurance Category",
        "Preferred Company",
        "Preferred Plan",
        "Sum Insured",
        "Expected Premium",
        "Status",
        "Priority",
        "Lead Source",
        "Assigned Agent / User",
        "City",
        "State",
        "PIN Code",
        "Campaign Name",
        "Created Date",
    ]

    timestamp_str = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")

    if export_format.lower() == "csv":
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(headers)
        for l in leads:
            writer.writerow(
                [
                    _sanitize_formula(l.lead_number),
                    _sanitize_formula(l.lead_type or "INDIVIDUAL"),
                    _sanitize_formula(l.full_name),
                    _sanitize_formula(l.mobile),
                    _sanitize_formula(l.alternate_mobile or ""),
                    _sanitize_formula(l.email or ""),
                    _sanitize_formula(l.policy_type),
                    _sanitize_formula(l.preferred_company.name if l.preferred_company else ""),
                    _sanitize_formula(l.preferred_plan.plan_name if l.preferred_plan else ""),
                    str(l.sum_insured or ""),
                    str(l.expected_premium or ""),
                    _sanitize_formula(l.status),
                    _sanitize_formula(l.priority),
                    _sanitize_formula(l.lead_source),
                    _sanitize_formula(l.assigned_user.full_name if l.assigned_user else ""),
                    _sanitize_formula(l.city or ""),
                    _sanitize_formula(l.state or ""),
                    _sanitize_formula(l.pincode or ""),
                    _sanitize_formula(l.campaign_name or ""),
                    l.created_at.strftime("%Y-%m-%d %H:%M") if l.created_at else "",
                ]
            )
        bytes_data = out.getvalue().encode("utf-8-sig")
        return bytes_data, "text/csv", f"leads_export_{timestamp_str}.csv"
    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Leads Export"
        ws.append(headers)

        for l in leads:
            ws.append(
                [
                    _sanitize_formula(l.lead_number),
                    _sanitize_formula(l.lead_type or "INDIVIDUAL"),
                    _sanitize_formula(l.full_name),
                    _sanitize_formula(l.mobile),
                    _sanitize_formula(l.alternate_mobile or ""),
                    _sanitize_formula(l.email or ""),
                    _sanitize_formula(l.policy_type),
                    _sanitize_formula(l.preferred_company.name if l.preferred_company else ""),
                    _sanitize_formula(l.preferred_plan.plan_name if l.preferred_plan else ""),
                    float(l.sum_insured) if l.sum_insured else None,
                    float(l.expected_premium) if l.expected_premium else None,
                    _sanitize_formula(l.status),
                    _sanitize_formula(l.priority),
                    _sanitize_formula(l.lead_source),
                    _sanitize_formula(l.assigned_user.full_name if l.assigned_user else ""),
                    _sanitize_formula(l.city or ""),
                    _sanitize_formula(l.state or ""),
                    _sanitize_formula(l.pincode or ""),
                    _sanitize_formula(l.campaign_name or ""),
                    l.created_at.strftime("%Y-%m-%d %H:%M") if l.created_at else "",
                ]
            )
        buf = io.BytesIO()
        wb.save(buf)
        return (
            buf.getvalue(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            f"leads_export_{timestamp_str}.xlsx",
        )


async def generate_lead_import_template(file_format: str = "xlsx") -> tuple[bytes, str, str]:
    headers = [
        "Lead Type (INDIVIDUAL/CORPORATE)*",
        "Full Name*",
        "Mobile Number*",
        "Alternate Mobile",
        "Email Address",
        "Insurance Category (Health/Life/Motor)*",
        "Expected Premium Budget",
        "City",
        "State",
        "PIN Code",
        "Priority (LOW/NORMAL/HIGH/URGENT)",
        "Lead Source (WEBSITE/PHONE_CALL/WALK_IN/REFERRAL)",
        "Notes / Requirement Description",
    ]
    sample_row = [
        "INDIVIDUAL",
        "Rajesh Sharma",
        "9876543210",
        "9876543211",
        "rajesh.sharma@example.com",
        "Health",
        "25000",
        "Mumbai",
        "Maharashtra",
        "400001",
        "HIGH",
        "PHONE_CALL",
        "Requires 10L Family Floater for self and spouse.",
    ]

    if file_format.lower() == "csv":
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(headers)
        writer.writerow(sample_row)
        return out.getvalue().encode("utf-8-sig"), "text/csv", "lead_import_template.csv"
    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Lead Import Template"
        ws.append(headers)
        ws.append(sample_row)
        buf = io.BytesIO()
        wb.save(buf)
        return (
            buf.getvalue(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "lead_import_template.xlsx",
        )


async def preview_leads_import(
    session: AsyncSession,
    file_bytes: bytes,
    filename: str,
) -> list[LeadImportRowPreview]:
    rows_data: list[dict[str, Any]] = []

    if filename.endswith(".csv"):
        text = file_bytes.decode("utf-8-sig", errors="ignore")
        reader = csv.DictReader(io.StringIO(text))
        for r in reader:
            rows_data.append(r)
    else:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [str(h).strip() if h else f"col_{i}" for i, h in enumerate(rows[0])]
        for row in rows[1:]:
            if not any(row):
                continue
            r_dict = {headers[i]: (str(cell).strip() if cell is not None else "") for i, cell in enumerate(row)}
            rows_data.append(r_dict)

    previews = []
    seen_mobiles = set()

    for idx, row in enumerate(rows_data, start=2):
        errors = []
        warnings = []

        def _get_val(*keys: str) -> str:
            for k in row:
                for target in keys:
                    if target.lower() in k.lower():
                        return str(row[k]).strip()
            return ""

        full_name = _get_val("full name", "prospect name", "name")
        mobile = _get_val("mobile", "phone")
        email = _get_val("email")
        category = _get_val("category", "policy type") or "Health"
        prem_str = _get_val("premium", "budget")

        if not full_name:
            errors.append("Full Name is mandatory.")
        if not mobile:
            errors.append("Mobile Number is mandatory.")
        elif len(_normalize_phone(mobile)) < 10:
            errors.append("Mobile number must be at least 10 digits.")

        norm_mob = _normalize_phone(mobile)
        if norm_mob in seen_mobiles:
            warnings.append("Duplicate mobile in file.")
        seen_mobiles.add(norm_mob)

        if norm_mob:
            dupe_check = await check_lead_duplicates(session, LeadDuplicateCheckRequest(mobile=mobile, email=email))
            if dupe_check.has_duplicates:
                warnings.append("Matches existing lead or customer in database.")

        clean_row = {
            "lead_type": _get_val("lead type") or "INDIVIDUAL",
            "full_name": full_name,
            "mobile": mobile,
            "alternate_mobile": _get_val("alternate"),
            "email": email,
            "policy_type": category,
            "expected_premium": prem_str,
            "city": _get_val("city"),
            "state": _get_val("state"),
            "pincode": _get_val("pin"),
            "priority": _get_val("priority") or "NORMAL",
            "lead_source": _get_val("source") or "IMPORT",
            "requirement_description": _get_val("note", "requirement", "description"),
        }

        previews.append(
            LeadImportRowPreview(
                row_number=idx,
                data=clean_row,
                is_valid=len(errors) == 0,
                errors=errors,
                warnings=warnings,
            )
        )

    return previews


async def confirm_leads_import(
    session: AsyncSession,
    payload: LeadImportConfirmRequest,
    current_user: User,
) -> LeadImportResult:
    imported = 0
    skipped = 0
    failed = 0
    errors: list[dict[str, Any]] = []

    for idx, r in enumerate(payload.rows, start=1):
        try:
            full_name = r.get("full_name")
            mobile = r.get("mobile")
            if not full_name or not mobile:
                skipped += 1
                errors.append({"row": idx, "error": "Missing full_name or mobile."})
                continue

            prem = None
            if r.get("expected_premium"):
                try:
                    prem = Decimal(str(r["expected_premium"]).replace(",", "").strip())
                except Exception:
                    prem = None

            lead_num = await _generate_lead_number(session)

            lead = InsuranceAgentInquiry(
                id=uuid.uuid4(),
                lead_number=lead_num,
                lead_type=r.get("lead_type") or "INDIVIDUAL",
                full_name=full_name.strip(),
                mobile=mobile.strip(),
                alternate_mobile=r.get("alternate_mobile"),
                email=r.get("email").strip().lower() if r.get("email") else None,
                policy_type=r.get("policy_type") or "Health",
                expected_premium=prem,
                city=r.get("city"),
                state=r.get("state"),
                pincode=r.get("pincode"),
                priority=r.get("priority") or "NORMAL",
                lead_source=r.get("lead_source") or "IMPORT",
                requirement_description=r.get("requirement_description"),
                status="NEW",
                assigned_user_id=current_user.id,
            )
            session.add(lead)

            act = InsuranceLeadActivity(
                id=uuid.uuid4(),
                lead_id=lead.id,
                user_id=current_user.id,
                user_name=current_user.full_name,
                activity_type="LEAD_IMPORTED",
                title="Lead Imported from File",
                description=f"Lead created via batch import by {current_user.full_name}.",
            )
            session.add(act)
            imported += 1
        except Exception as e:
            failed += 1
            errors.append({"row": idx, "error": str(e)})

    await session.commit()
    return LeadImportResult(
        total_rows=len(payload.rows),
        imported_count=imported,
        skipped_count=skipped,
        failed_count=failed,
        errors=errors,
    )


# --- Lead Reports & Analytics (Phase 13) ---


async def get_lead_reports(
    session: AsyncSession,
    current_user: User | None = None,
    report_type: str = "SOURCE",
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[LeadReportRow]:
    rtype = report_type.upper()

    if rtype == "SOURCE":
        group_col = InsuranceAgentInquiry.lead_source
    elif rtype == "CATEGORY":
        group_col = InsuranceAgentInquiry.policy_type
    elif rtype == "STATUS":
        group_col = InsuranceAgentInquiry.status
    elif rtype == "PRIORITY":
        group_col = InsuranceAgentInquiry.priority
    elif rtype == "AGENT":
        group_col = User.full_name
    else:
        group_col = InsuranceAgentInquiry.lead_source

    q = select(
        group_col.label("dimension"),
        func.count(InsuranceAgentInquiry.id).label("total"),
        func.count(InsuranceAgentInquiry.id)
        .filter(InsuranceAgentInquiry.status == "CONVERTED")
        .label("converted"),
        func.count(InsuranceAgentInquiry.id)
        .filter(InsuranceAgentInquiry.status.in_(("LOST", "NOT_INTERESTED")))
        .label("lost"),
        func.coalesce(func.sum(InsuranceAgentInquiry.expected_premium), Decimal("0.00")).label("prem"),
    )

    if rtype == "AGENT":
        q = q.join(User, InsuranceAgentInquiry.assigned_user_id == User.id, isouter=True)

    q = _apply_rbac_filter(q, current_user)

    if date_from:
        q = q.where(func.date(InsuranceAgentInquiry.created_at) >= date_from)
    if date_to:
        q = q.where(func.date(InsuranceAgentInquiry.created_at) <= date_to)

    q = q.group_by(group_col)
    rows = (await session.execute(q)).all()

    results = []
    for r in rows:
        dim = r[0] or "Unspecified"
        tot = r[1] or 0
        conv = r[2] or 0
        lost = r[3] or 0
        prem = r[4] or Decimal("0.00")
        crate = round(conv / tot * 100.0, 1) if tot > 0 else 0.0
        results.append(
            LeadReportRow(
                dimension=str(dim),
                total_leads=tot,
                converted_leads=conv,
                lost_leads=lost,
                conversion_rate=crate,
                total_expected_premium=prem,
            )
        )

    return results
