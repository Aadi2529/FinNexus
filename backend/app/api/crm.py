"""FinanceFlow CRM Module Endpoints — Enterprise Work Order & Employee Task Management."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, case, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import (
    get_current_user,
    is_employee,
    require_roles,
)
from app.db.models.audit import AuditLog
from app.db.models.auth import User
from app.db.models.crm import (
    CrmNotification,
    Customer,
    CustomerNote,
    FinancialProfile,
    Task,
    WorkCategory,
    WorkOrder,
    WorkOrderChecklistItem,
    WorkOrderHistory,
    WorkOrderReminder,
)
from app.db.session import get_db_session
from app.schemas.crm import (
    AuditLogEntrySchema,
    ChecklistItemCreate,
    ChecklistItemSchema,
    ChecklistItemUpdate,
    ClientAutocompleteItem,
    ClientListResponse,
    ClientPagination,
    ClientSummaryCards,
    CreateNoteRequest,
    CreateTaskRequest,
    CrmDashboardMetrics,
    CrmNotificationSchema,
    CustomerCreate,
    CustomerDetail,
    CustomerNoteSchema,
    CustomerSummary,
    CustomerUpdate,
    EligibleAssigneeSchema,
    FinancialProfileSchema,
    TaskSchema,
    TaskStatusUpdate,
    TaskUpdate,
    TeamMemberSummary,
    WorkCategoryCreate,
    WorkCategorySchema,
    WorkCategoryUpdate,
    WorkOrderAssignmentRequest,
    WorkOrderCreate,
    WorkOrderDetail,
    WorkOrderHistorySchema,
    WorkOrderStatusUpdate,
    WorkOrderSummary,
    WorkOrderUpdate,
)

router = APIRouter(prefix="/crm", tags=["CRM"])
direct_router = APIRouter(tags=["CRM Direct"])


def normalize_indian_mobile(phone: str) -> str:
    """Normalize and validate 10-digit Indian mobile number.

    Accepts digits only, requiring exactly 10 digits excluding +91/91/0 prefix.
    Rejects alphabetic and invalid characters.
    Returns canonical format: '+91 {10_digits}'.
    """
    if not phone or not phone.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Mobile phone number is required.",
        )
    raw = phone.strip()
    if any(ch.isalpha() for ch in raw):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Mobile number must not contain alphabetic characters.",
        )

    valid_chars = set("0123456789 +-()")
    if any(ch not in valid_chars for ch in raw):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Mobile number contains invalid characters.",
        )

    digits = "".join(ch for ch in raw if ch.isdigit())
    if digits.startswith("91") and len(digits) == 12:
        mobile_10 = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        mobile_10 = digits[1:]
    elif len(digits) == 10:
        mobile_10 = digits
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Indian mobile number must be exactly 10 digits (received {len(digits)} digits).",
        )

    return f"+91 {mobile_10}"


def _map_customer_summary(
    c: Customer,
    active_wo_count: int = 0,
    total_wo_count: int = 0,
    fin_profile: FinancialProfile | None = None,
) -> CustomerSummary:
    fp = fin_profile
    if fp is None and "financial_profile" in c.__dict__:
        fp = c.__dict__["financial_profile"]

    created_by_user = c.__dict__.get("created_by")

    return CustomerSummary(
        id=c.id,
        first_name=c.first_name,
        last_name=c.last_name,
        email=c.email,
        phone=c.phone,
        pan_number=c.pan_number,
        pipeline_status=c.pipeline_status,
        reference_source=c.reference_source,
        is_archived=c.is_archived,
        archived_at=c.archived_at,
        created_by_id=c.created_by_id,
        created_by_name=created_by_user.full_name if created_by_user else None,
        assigned_officer_id=c.assigned_officer_id,
        financial_profile=(
            FinancialProfileSchema.model_validate(fp)
            if fp
            else None
        ),
        created_at=c.created_at,
        active_work_orders_count=active_wo_count,
        total_work_orders_count=total_wo_count,
    )



def calculate_risk_tier(cibil: int | None, income: float, obligations: float) -> str:
    """Classify borrower risk tier based on bureau rating and debt-to-income ratio."""
    dti = obligations / income if income > 0 else 1.0
    if cibil and cibil >= 750 and dti < 0.4:
        return "LOW"
    elif cibil and cibil >= 650 and dti < 0.55:
        return "MEDIUM"
    return "HIGH"


def _is_overdue(due_date: datetime | None, status: str) -> bool:
    """Check if work order is overdue, safely handling naive and aware datetimes."""
    if not due_date or status in ["COMPLETED", "CANCELLED", "ARCHIVED"]:
        return False
    now = datetime.now(UTC)
    dt = due_date if due_date.tzinfo is not None else due_date.replace(tzinfo=UTC)
    return dt < now


def _map_work_order_summary(wo: WorkOrder) -> WorkOrderSummary:
    is_overdue = _is_overdue(wo.due_date, wo.status)
    items = wo.checklist_items or []
    completed_items = sum(1 for it in items if it.status == "COMPLETED")

    client_name = None
    client_email = None
    client_phone = None
    if wo.client:
        client_name = f"{wo.client.first_name} {wo.client.last_name}".strip()
        client_email = wo.client.email
        client_phone = wo.client.phone

    # Reminder recipients mapping
    reminders = getattr(wo, "reminder_recipients", []) or []
    reminder_recipient_ids = [u.id for u in reminders]
    reminder_recipients = [
        EligibleAssigneeSchema(
            id=u.id,
            full_name=u.full_name,
            email=u.email,
            role=u.roles[0].name if getattr(u, "roles", None) else "EMPLOYEE",
            is_active=u.is_active,
        )
        for u in reminders
    ]

    # Checklist pipeline items mapping (sorted by position)
    checklist_schemas = [
        ChecklistItemSchema(
            id=item.id,
            work_order_id=item.work_order_id,
            title=item.title,
            description=item.description,
            assigned_to_id=item.assigned_to_id,
            assigned_to_name=(
                item.assigned_to.full_name if getattr(item, "assigned_to", None) else None
            ),
            status=item.status,
            position=item.position,
            due_date=item.due_date,
            completed_at=item.completed_at,
            completed_by_id=item.completed_by_id,
            completed_by_name=(
                item.completed_by.full_name if getattr(item, "completed_by", None) else None
            ),
            notes=item.notes,
            created_at=item.created_at,
        )
        for item in sorted(items, key=lambda x: getattr(x, "position", 0))
    ]

    return WorkOrderSummary(
        id=wo.id,
        order_number=wo.order_number,
        title=wo.title,
        description=wo.description,
        client_id=wo.client_id,
        client_name=client_name,
        client_email=client_email,
        client_phone=client_phone,
        category_id=wo.category_id,
        category_name=wo.category.name if wo.category else None,
        created_by_id=wo.created_by_id,
        created_by_name=wo.created_by.full_name if wo.created_by else None,
        assigned_to_id=wo.assigned_to_id,
        assigned_to_name=wo.assigned_to.full_name if wo.assigned_to else None,
        priority=wo.priority,
        work_priority=getattr(wo, "work_priority", None),
        custom_priority=getattr(wo, "custom_priority", None),
        status=wo.status,
        due_date=wo.due_date,
        completed_at=wo.completed_at,
        progress_percent=wo.progress_percent,
        priority_notes=wo.priority_notes,
        checklist_count=len(items),
        checklist_completed=completed_items,
        reminder_recipient_ids=reminder_recipient_ids,
        reminder_recipients=reminder_recipients,
        checklist_items=checklist_schemas,
        is_overdue=is_overdue,
        created_at=wo.created_at,
        updated_at=wo.updated_at,
    )


def _map_work_order_detail(wo: WorkOrder) -> WorkOrderDetail:
    summary = _map_work_order_summary(wo)
    history_schemas = [
        WorkOrderHistorySchema(
            id=h.id,
            work_order_id=h.work_order_id,
            actor_id=h.actor_id,
            actor_name=h.actor.full_name if h.actor else None,
            action=h.action,
            details=h.details,
            timestamp=h.timestamp,
        )
        for h in (wo.history or [])
    ]
    return WorkOrderDetail(
        **summary.model_dump(),
        history=history_schemas,
    )


async def _generate_order_number(session: AsyncSession) -> str:
    """Generate sequential work order reference code like WO-2026-0001."""
    year = datetime.now(UTC).year
    count_stmt = select(func.count(WorkOrder.id))
    cnt = (await session.execute(count_stmt)).scalar() or 0
    candidate = f"WO-{year}-{cnt + 1:04d}"

    while True:
        check = await session.execute(
            select(WorkOrder.id).where(WorkOrder.order_number == candidate)
        )
        if not check.scalar_one_or_none():
            return candidate
        cnt += 1
        candidate = f"WO-{year}-{cnt + 1:04d}"


def _recompute_progress(wo: WorkOrder) -> int:
    """Calculate progress percentage based on completed checklist items."""
    items = wo.checklist_items or []
    if not items:
        return 100 if wo.status == "COMPLETED" else 0
    completed = sum(1 for item in items if item.status == "COMPLETED")
    return int((completed / len(items)) * 100)


# ============================================================================
# CRM DASHBOARD & KPI AGGREGATIONS
# ============================================================================


@router.get(
    "/dashboard",
    response_model=CrmDashboardMetrics,
    summary="Get Executive Work Order Dashboard Metrics",
)
async def get_crm_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CrmDashboardMetrics:
    """Calculates active workload, priority actions, critical delays, resolved today, and client counts."""
    now = datetime.now(UTC)
    today_start = datetime.combine(now.date(), time.min).replace(tzinfo=UTC)

    emp_filter = (
        [WorkOrder.assigned_to_id == current_user.id]
        if is_employee(current_user)
        else []
    )

    # Active workload: PENDING, IN_PROGRESS, REVIEW
    active_workload_stmt = select(func.count(WorkOrder.id)).where(
        WorkOrder.status.in_(["PENDING", "IN_PROGRESS", "REVIEW"]),
        *emp_filter,
    )
    # Priority actions: active and URGENT or HIGH
    priority_actions_stmt = select(func.count(WorkOrder.id)).where(
        WorkOrder.status.in_(["PENDING", "IN_PROGRESS", "REVIEW"]),
        WorkOrder.priority.in_(["URGENT", "HIGH"]),
        *emp_filter,
    )
    # Critical delays: active and due_date < now
    critical_delays_stmt = select(func.count(WorkOrder.id)).where(
        WorkOrder.status.in_(["PENDING", "IN_PROGRESS", "REVIEW"]),
        WorkOrder.due_date < now,
        *emp_filter,
    )
    # Resolved today: completed_at >= today_start
    resolved_today_stmt = select(func.count(WorkOrder.id)).where(
        WorkOrder.status == "COMPLETED",
        WorkOrder.completed_at >= today_start,
        *emp_filter,
    )
    # Total clients: count of Customer records
    total_clients_stmt = select(func.count(Customer.id))

    # Active team members
    active_team_stmt = select(func.count(User.id)).where(User.is_active.is_(True))

    active_workload = (await session.execute(active_workload_stmt)).scalar() or 0
    priority_actions = (await session.execute(priority_actions_stmt)).scalar() or 0
    critical_delays = (await session.execute(critical_delays_stmt)).scalar() or 0
    resolved_today = (await session.execute(resolved_today_stmt)).scalar() or 0
    total_clients = (await session.execute(total_clients_stmt)).scalar() or 0
    active_team = (await session.execute(active_team_stmt)).scalar() or 0

    return CrmDashboardMetrics(
        active_workload=active_workload,
        priority_actions=priority_actions,
        critical_delays=critical_delays,
        resolved_today=resolved_today,
        total_clients=total_clients,
        team_members_active=active_team,
    )


@router.get(
    "/stats",
    summary="Get Legacy CRM Dashboard Aggregations",
)
async def get_crm_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, int | float]:
    """Retrieve operational CRM statistics for backward compatibility."""
    total_customers_stmt = select(func.count(Customer.id))
    active_leads_stmt = select(func.count(Customer.id)).where(
        Customer.pipeline_status.in_(
            ["NEW_LEAD", "CONTACTED", "DOCUMENTATION", "UNDERWRITING"]
        )
    )
    pending_tasks_stmt = select(func.count(WorkOrder.id)).where(
        WorkOrder.status.in_(["PENDING", "IN_PROGRESS"])
    )
    avg_cibil_stmt = select(func.avg(FinancialProfile.cibil_score)).where(
        FinancialProfile.cibil_score.is_not(None)
    )

    total_customers = (await session.execute(total_customers_stmt)).scalar() or 0
    active_leads = (await session.execute(active_leads_stmt)).scalar() or 0
    pending_tasks = (await session.execute(pending_tasks_stmt)).scalar() or 0
    avg_cibil = (await session.execute(avg_cibil_stmt)).scalar() or 0

    return {
        "total_customers": total_customers,
        "active_leads": active_leads,
        "pending_tasks": pending_tasks,
        "average_cibil": round(float(avg_cibil), 0),
    }


# ============================================================================
# WORK ORDER CRUD & PIPELINE ENDPOINTS
# ============================================================================


@router.get(
    "/work-orders",
    response_model=list[WorkOrderSummary],
    summary="List, Filter and Search Work Orders",
)
async def list_work_orders(
    q: str | None = Query(
        None, description="Search across order number, title, description, or client"
    ),
    status_filter: str | None = Query(
        None, alias="status", description="Filter by status or OVERDUE / ACTIVE"
    ),
    priority: str | None = Query(None, description="Filter by priority"),
    category_id: uuid.UUID | None = Query(None, description="Filter by category"),
    client_id: uuid.UUID | None = Query(None, description="Filter by client ID"),
    assigned_to_id: uuid.UUID | None = Query(None, description="Filter by assignee"),
    my_tasks: bool = Query(
        False, description="Filter only work orders assigned to current user"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[WorkOrderSummary]:
    """Retrieve filtered and paginated list of work orders with client and assignee relations."""
    now = datetime.now(UTC)
    stmt = (
        select(WorkOrder)
        .options(
            selectinload(WorkOrder.client),
            selectinload(WorkOrder.category),
            selectinload(WorkOrder.created_by),
            selectinload(WorkOrder.assigned_to),
            selectinload(WorkOrder.reminder_recipients),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.assigned_to
            ),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.completed_by
            ),
        )
        .order_by(WorkOrder.created_at.desc())
    )

    if is_employee(current_user):
        if assigned_to_id and assigned_to_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Employees cannot view work orders assigned to other team members.",
            )
        stmt = stmt.where(WorkOrder.assigned_to_id == current_user.id)
    else:
        if my_tasks:
            stmt = stmt.where(WorkOrder.assigned_to_id == current_user.id)
        elif assigned_to_id:
            stmt = stmt.where(WorkOrder.assigned_to_id == assigned_to_id)

    if client_id:
        stmt = stmt.where(WorkOrder.client_id == client_id)

    if priority:
        stmt = stmt.where(WorkOrder.priority == priority.upper().strip())

    if category_id:
        stmt = stmt.where(WorkOrder.category_id == category_id)

    if status_filter:
        s_upper = status_filter.upper().strip()
        if s_upper == "ACTIVE":
            stmt = stmt.where(
                WorkOrder.status.in_(["PENDING", "IN_PROGRESS", "REVIEW"])
            )
        elif s_upper == "OVERDUE":
            stmt = stmt.where(
                and_(
                    WorkOrder.status.in_(["PENDING", "IN_PROGRESS", "REVIEW"]),
                    WorkOrder.due_date < now,
                )
            )
        elif s_upper != "ALL":
            stmt = stmt.where(WorkOrder.status == s_upper)

    if q:
        search_pattern = f"%{q.strip().lower()}%"
        stmt = stmt.outerjoin(WorkOrder.client).where(
            or_(
                func.lower(WorkOrder.order_number).like(search_pattern),
                func.lower(WorkOrder.title).like(search_pattern),
                func.lower(WorkOrder.description).like(search_pattern),
                func.lower(Customer.first_name).like(search_pattern),
                func.lower(Customer.last_name).like(search_pattern),
                func.lower(Customer.email).like(search_pattern),
            )
        )

    stmt = stmt.offset(skip).limit(limit)
    res = await session.execute(stmt)
    work_orders = res.scalars().all()

    return [_map_work_order_summary(wo) for wo in work_orders]


@router.post(
    "/work-orders",
    response_model=WorkOrderDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create Enterprise Work Order with Sectioned Details and Checklist",
)
async def create_work_order(
    payload: WorkOrderCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> WorkOrderDetail:
    """Create a new work order, assign employee, create checklist items, and dispatch notifications."""
    # Resolve client (from existing client_id or transactional new_client)
    target_client_id = payload.client_id
    if not target_client_id:
        if not payload.new_client:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Either client_id or new_client details must be provided.",
            )
        nc = payload.new_client
        norm_phone = normalize_indian_mobile(nc.phone)
        phone_digits = "".join(ch for ch in norm_phone if ch.isdigit())[-10:]
        norm_email = nc.email.lower().strip() if nc.email else f"client.{phone_digits}@financeflow.local"
        norm_pan = (
            nc.pan_number.upper().strip()
            if nc.pan_number
            else f"PAN{phone_digits[:3]}{phone_digits[-3:]}X"[:10]
        )

        # Check if client with matching phone, PAN, or email already exists to prevent duplicate clients
        existing_client_stmt = select(Customer).where(
            or_(
                Customer.phone == norm_phone,
                Customer.pan_number == norm_pan,
                Customer.email == norm_email,
            )
        )
        existing_res = await session.execute(existing_client_stmt)
        existing_client = existing_res.scalars().first()

        if existing_client:
            target_client_id = existing_client.id
        else:
            new_cust = Customer(
                id=uuid.uuid4(),
                first_name=nc.first_name.strip(),
                last_name=(nc.last_name or "").strip(),
                email=norm_email,
                phone=norm_phone,
                pan_number=norm_pan,
                reference_source=nc.reference_source or "Work Order Registration",
                pipeline_status="ACTIVE",
                created_by_id=current_user.id,
                assigned_officer_id=current_user.id,
            )
            session.add(new_cust)
            await session.flush()

            fin = FinancialProfile(
                id=uuid.uuid4(),
                customer_id=new_cust.id,
                employment_type=nc.employment_type or "SALARIED",
                monthly_income=nc.monthly_income or Decimal("50000.00"),
                monthly_obligations=nc.monthly_obligations or Decimal("10000.00"),
                cibil_score=nc.cibil_score or 750,
                risk_tier="LOW",
            )
            session.add(fin)

            audit = AuditLog(
                id=uuid.uuid4(),
                actor_id=current_user.id,
                action="CLIENT_CREATED",
                resource_type="client",
                resource_id=new_cust.id,
                state_delta={
                    "source": "inline_work_order",
                    "name": f"{new_cust.first_name} {new_cust.last_name}",
                    "phone": new_cust.phone,
                },
                created_at=datetime.now(UTC),
            )
            session.add(audit)
            await session.flush()

            target_client_id = new_cust.id
    else:
        # Verify referenced client exists
        client_check = await session.execute(
            select(Customer).where(Customer.id == target_client_id)
        )
        client = client_check.scalar_one_or_none()
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Referenced client does not exist.",
            )

    # Verify category exists
    category_check = await session.execute(
        select(WorkCategory).where(WorkCategory.id == payload.category_id)
    )
    category = category_check.scalar_one_or_none()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Referenced work category does not exist.",
        )

    # Verify assignee if provided
    assignee = None
    if payload.assigned_to_id:
        user_check = await session.execute(
            select(User).where(User.id == payload.assigned_to_id, User.is_active == True)
        )
        assignee = user_check.scalar_one_or_none()
        if not assignee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assigned team member not found or is inactive.",
            )

    # Work Priority & Custom Priority Validation
    work_priority = payload.work_priority
    custom_priority = payload.custom_priority.strip() if payload.custom_priority else None
    derived_priority = payload.priority.upper() if payload.priority else "NORMAL"

    if work_priority:
        valid_work_priorities = [
            "Do it in 2 to 3 days",
            "Do it urgent",
            "Do it next day",
            "Do it today",
            "Other",
        ]
        if work_priority not in valid_work_priorities:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid work priority '{work_priority}'. Allowed options: {', '.join(valid_work_priorities)}",
            )
        if work_priority == "Other":
            if not custom_priority:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Custom priority specification is required when 'Other' priority is selected.",
                )
            if len(custom_priority) > 150:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Custom priority must not exceed 150 characters.",
                )
        else:
            custom_priority = None

        p_map = {
            "Do it urgent": "URGENT",
            "Do it today": "HIGH",
            "Do it next day": "NORMAL",
            "Do it in 2 to 3 days": "LOW",
            "Other": "NORMAL",
        }
        derived_priority = p_map.get(work_priority, derived_priority)

    # Validate Reminder Recipients
    reminder_users = []
    if payload.reminder_recipient_ids:
        recip_stmt = select(User).where(
            User.id.in_(payload.reminder_recipient_ids),
            User.is_active == True,
        )
        reminder_users = (await session.execute(recip_stmt)).scalars().all()
        if len(reminder_users) != len(set(payload.reminder_recipient_ids)):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="One or more specified reminder recipients were not found or are inactive.",
            )

    order_number = await _generate_order_number(session)

    work_order = WorkOrder(
        id=uuid.uuid4(),
        order_number=order_number,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        client_id=target_client_id,
        category_id=payload.category_id,
        created_by_id=current_user.id,
        assigned_to_id=payload.assigned_to_id,
        priority=derived_priority,
        work_priority=work_priority,
        custom_priority=custom_priority,
        status="PENDING",
        due_date=payload.due_date,
        progress_percent=0,
        priority_notes=(
            payload.priority_notes.strip() if payload.priority_notes else None
        ),
    )
    session.add(work_order)
    await session.flush()

    # Create initial checklist items if supplied, or auto-seed from category template
    checklist_source = list(payload.checklist_items)
    if not checklist_source and category.checklist_template:
        for idx, t in enumerate(category.checklist_template):
            if isinstance(t, dict) and t.get("title"):
                checklist_source.append(
                    ChecklistItemCreate(
                        title=t["title"],
                        description=t.get("description"),
                        position=idx,
                    )
                )

    for idx, item_data in enumerate(checklist_source):
        item = WorkOrderChecklistItem(
            id=uuid.uuid4(),
            work_order_id=work_order.id,
            title=item_data.title.strip(),
            description=item_data.description.strip()
            if item_data.description
            else None,
            assigned_to_id=item_data.assigned_to_id or payload.assigned_to_id,
            status="PENDING",
            position=item_data.position if item_data.position else idx,
            due_date=item_data.due_date or payload.due_date,
        )
        session.add(item)

    # Persist reminder recipient associations & in-app notifications
    for r_user in reminder_users:
        session.add(
            WorkOrderReminder(work_order_id=work_order.id, user_id=r_user.id)
        )
        notif = CrmNotification(
            id=uuid.uuid4(),
            user_id=r_user.id,
            work_order_id=work_order.id,
            title="Work Order Reminder Scheduled",
            message=f"Reminder scheduled for Work Order {order_number}: {work_order.title} (Deadline: {work_order.due_date.strftime('%Y-%m-%d %H:%M')}).",
            notification_type="WORK_ORDER_REMINDER",
        )
        session.add(notif)

    # Log initial creation audit history
    history = WorkOrderHistory(
        id=uuid.uuid4(),
        work_order_id=work_order.id,
        actor_id=current_user.id,
        action="CREATED",
        details=f"Work Order {order_number} created with {len(checklist_source)} checklist items and {len(reminder_users)} reminder recipients.",
        timestamp=datetime.now(UTC),
    )
    session.add(history)

    # Dispatch notification if assigned
    if payload.assigned_to_id:
        notif = CrmNotification(
            id=uuid.uuid4(),
            user_id=payload.assigned_to_id,
            work_order_id=work_order.id,
            title="New Work Order Assigned",
            message=f"You have been assigned to Work Order {order_number}: {work_order.title}",
            notification_type="WORK_ORDER_ASSIGNED",
        )
        session.add(notif)

    await session.flush()

    # Re-query with all loaded relations
    stmt = (
        select(WorkOrder)
        .options(
            selectinload(WorkOrder.client),
            selectinload(WorkOrder.category),
            selectinload(WorkOrder.created_by),
            selectinload(WorkOrder.assigned_to),
            selectinload(WorkOrder.reminder_recipients),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.assigned_to
            ),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.completed_by
            ),
            selectinload(WorkOrder.history).selectinload(WorkOrderHistory.actor),
        )
        .where(WorkOrder.id == work_order.id)
    )
    res = await session.execute(stmt)
    full_wo = res.scalar_one()

    return _map_work_order_detail(full_wo)


@router.get(
    "/work-orders/{work_order_id}",
    response_model=WorkOrderDetail,
    summary="Get Work Order 360 Detail with Checklist and Audit History",
)
async def get_work_order(
    work_order_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> WorkOrderDetail:
    """Retrieve full work order details, checklist pipeline, and audit events."""
    stmt = (
        select(WorkOrder)
        .options(
            selectinload(WorkOrder.client),
            selectinload(WorkOrder.category),
            selectinload(WorkOrder.created_by),
            selectinload(WorkOrder.assigned_to),
            selectinload(WorkOrder.reminder_recipients),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.assigned_to
            ),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.completed_by
            ),
            selectinload(WorkOrder.history).selectinload(WorkOrderHistory.actor),
        )
        .where(WorkOrder.id == work_order_id)
    )
    res = await session.execute(stmt)
    wo = res.scalar_one_or_none()

    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work order not found.",
        )

    if is_employee(current_user) and wo.assigned_to_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are only authorized to view work orders assigned to you.",
        )

    return _map_work_order_detail(wo)


@router.put(
    "/work-orders/{work_order_id}",
    response_model=WorkOrderDetail,
    summary="Update Work Order Attributes",
)
async def update_work_order(
    work_order_id: uuid.UUID,
    payload: WorkOrderUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> WorkOrderDetail:
    """Update work order metadata, priority, deadline, or assignment with audit logging."""
    if is_employee(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Employees are not permitted to edit work orders after creation.",
        )

    stmt = (
        select(WorkOrder)
        .options(
            selectinload(WorkOrder.client),
            selectinload(WorkOrder.category),
            selectinload(WorkOrder.created_by),
            selectinload(WorkOrder.assigned_to),
            selectinload(WorkOrder.reminder_recipients),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.assigned_to
            ),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.completed_by
            ),
            selectinload(WorkOrder.history).selectinload(WorkOrderHistory.actor),
        )
        .where(WorkOrder.id == work_order_id)
    )
    res = await session.execute(stmt)
    wo = res.scalar_one_or_none()

    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work order not found.",
        )

    changes: list[str] = []

    if payload.title and payload.title.strip() != wo.title:
        changes.append(f"Title changed to '{payload.title.strip()}'")
        wo.title = payload.title.strip()

    if payload.description is not None:
        wo.description = payload.description.strip() if payload.description else None

    if payload.category_id and payload.category_id != wo.category_id:
        cat_check = await session.execute(
            select(WorkCategory).where(WorkCategory.id == payload.category_id)
        )
        cat = cat_check.scalar_one_or_none()
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected category not found.",
            )
        wo.category_id = payload.category_id
        changes.append(f"Category changed to {cat.name}")

    if payload.work_priority is not None:
        if payload.work_priority == "Other":
            if not payload.custom_priority or not payload.custom_priority.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Custom priority specification is required when 'Other' priority is selected.",
                )
            if len(payload.custom_priority.strip()) > 150:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Custom priority must not exceed 150 characters.",
                )
            wo.custom_priority = payload.custom_priority.strip()
        else:
            wo.custom_priority = None

        if payload.work_priority != wo.work_priority:
            changes.append(f"Work priority changed to '{payload.work_priority}'")
            wo.work_priority = payload.work_priority
            p_map = {
                "Do it urgent": "URGENT",
                "Do it today": "HIGH",
                "Do it next day": "NORMAL",
                "Do it in 2 to 3 days": "LOW",
                "Other": "NORMAL",
            }
            if payload.work_priority in p_map:
                wo.priority = p_map[payload.work_priority]
    elif payload.custom_priority is not None:
        wo.custom_priority = (
            payload.custom_priority.strip() if payload.custom_priority else None
        )

    if payload.priority and payload.priority.upper() != wo.priority:
        old_pri = wo.priority
        wo.priority = payload.priority.upper()
        changes.append(f"Priority changed from {old_pri} to {wo.priority}")

    if payload.due_date and payload.due_date != wo.due_date:
        wo.due_date = payload.due_date
        changes.append(
            f"Due date updated to {payload.due_date.strftime('%Y-%m-%d %H:%M')}"
        )

    if payload.priority_notes is not None:
        wo.priority_notes = (
            payload.priority_notes.strip() if payload.priority_notes else None
        )

    if (
        payload.assigned_to_id is not None
        and payload.assigned_to_id != wo.assigned_to_id
    ):
        user_check = await session.execute(
            select(User).where(User.id == payload.assigned_to_id)
        )
        new_assignee = user_check.scalar_one_or_none()
        if not new_assignee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assigned user not found.",
            )
        wo.assigned_to_id = payload.assigned_to_id
        changes.append(f"Reassigned to {new_assignee.full_name}")

        # Dispatch reassignment notification
        notif = CrmNotification(
            id=uuid.uuid4(),
            user_id=new_assignee.id,
            work_order_id=wo.id,
            title="Work Order Reassigned",
            message=f"Work Order {wo.order_number} has been assigned to you by {current_user.full_name}.",
            notification_type="WORK_ORDER_ASSIGNED",
        )
        session.add(notif)

    if payload.reminder_recipient_ids is not None:
        recipients = []
        if payload.reminder_recipient_ids:
            recip_stmt = select(User).where(
                User.id.in_(payload.reminder_recipient_ids),
                User.is_active == True,
            )
            recipients = (await session.execute(recip_stmt)).scalars().all()
            if len(recipients) != len(set(payload.reminder_recipient_ids)):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="One or more specified reminder recipients were not found or are inactive.",
                )
        await session.execute(
            delete(WorkOrderReminder).where(WorkOrderReminder.work_order_id == wo.id)
        )
        for r_user in recipients:
            session.add(WorkOrderReminder(work_order_id=wo.id, user_id=r_user.id))
        changes.append(f"Updated reminder recipients ({len(recipients)} selected)")

    if changes:
        history = WorkOrderHistory(
            id=uuid.uuid4(),
            work_order_id=wo.id,
            actor_id=current_user.id,
            action="UPDATED",
            details="; ".join(changes),
            timestamp=datetime.now(UTC),
        )
        session.add(history)

    wo.updated_at = datetime.now(UTC)
    await session.flush()

    stmt_reload = (
        select(WorkOrder)
        .options(
            selectinload(WorkOrder.client),
            selectinload(WorkOrder.category),
            selectinload(WorkOrder.created_by),
            selectinload(WorkOrder.assigned_to),
            selectinload(WorkOrder.reminder_recipients),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.assigned_to
            ),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.completed_by
            ),
            selectinload(WorkOrder.history).selectinload(WorkOrderHistory.actor),
        )
        .where(WorkOrder.id == wo.id)
    )
    reloaded_wo = (await session.execute(stmt_reload)).scalar_one()

    return _map_work_order_detail(reloaded_wo)


@router.post(
    "/work-orders/{work_order_id}/assignments",
    response_model=WorkOrderDetail,
    summary="Assign or Reassign Work Order",
)
async def assign_work_order(
    work_order_id: uuid.UUID,
    payload: WorkOrderAssignmentRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> WorkOrderDetail:
    """Assign or reassign work order to an eligible team member.

    Restricted to Super Admin, Admin, and Manager. Employees are forbidden.
    """
    if is_employee(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employees cannot assign or reassign work orders. This requires Manager, Admin, or Super Admin privileges.",
        )

    stmt = (
        select(WorkOrder)
        .options(
            selectinload(WorkOrder.client),
            selectinload(WorkOrder.category),
            selectinload(WorkOrder.created_by),
            selectinload(WorkOrder.assigned_to),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.assigned_to
            ),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.completed_by
            ),
            selectinload(WorkOrder.history).selectinload(WorkOrderHistory.actor),
        )
        .where(WorkOrder.id == work_order_id)
    )
    res = await session.execute(stmt)
    wo = res.scalar_one_or_none()
    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work order not found.",
        )

    # Verify assignee is active user
    user_check = await session.execute(
        select(User).where(User.id == payload.assigned_to_id, User.is_active.is_(True))
    )
    assignee = user_check.scalar_one_or_none()
    if not assignee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Eligible active assignee not found.",
        )

    old_assignee_name = wo.assigned_to.full_name if wo.assigned_to else "Unassigned"
    wo.assigned_to_id = assignee.id
    wo.updated_at = datetime.now(UTC)

    history = WorkOrderHistory(
        id=uuid.uuid4(),
        work_order_id=wo.id,
        actor_id=current_user.id,
        action="ASSIGNED",
        details=f"Assigned to {assignee.full_name} (previously: {old_assignee_name}) by {current_user.full_name}.",
        timestamp=datetime.now(UTC),
    )
    session.add(history)

    notif = CrmNotification(
        id=uuid.uuid4(),
        user_id=assignee.id,
        work_order_id=wo.id,
        title="Work Order Assigned",
        message=f"Work Order {wo.order_number} has been assigned to you by {current_user.full_name}.",
        notification_type="WORK_ORDER_ASSIGNED",
    )
    session.add(notif)
    await session.flush()

    res = await session.execute(stmt)
    updated_wo = res.scalar_one()
    return _map_work_order_detail(updated_wo)


@router.get(
    "/users/eligible-assignees",
    response_model=list[EligibleAssigneeSchema],
    summary="List Eligible Assignees with Active Workload",
)
async def list_eligible_assignees(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[EligibleAssigneeSchema]:
    """Retrieve active employees and managers eligible for assignment with active workload metrics."""
    users_stmt = (
        select(User)
        .options(selectinload(User.roles))
        .where(User.is_active.is_(True))
        .order_by(User.full_name.asc())
    )
    users_res = await session.execute(users_stmt)
    users = users_res.scalars().all()

    counts_stmt = (
        select(
            WorkOrder.assigned_to_id,
            func.count(WorkOrder.id).label("active_count"),
        )
        .where(WorkOrder.status.in_(["PENDING", "IN_PROGRESS", "REVIEW"]))
        .group_by(WorkOrder.assigned_to_id)
    )
    counts_res = await session.execute(counts_stmt)
    counts_map = {row.assigned_to_id: row.active_count for row in counts_res.all()}

    results = []
    for u in users:
        role_names = [r.name for r in u.roles] if u.roles else []
        results.append(
            EligibleAssigneeSchema(
                id=u.id,
                full_name=u.full_name,
                email=u.email,
                role=role_names[0] if role_names else "EMPLOYEE",
                is_active=u.is_active,
                active_work_orders_count=counts_map.get(u.id, 0),
            )
        )
    return results


@router.patch(
    "/work-orders/{work_order_id}/status",
    response_model=WorkOrderDetail,
    summary="Update Work Order Status with Completion Guard",
)
async def update_work_order_status(
    work_order_id: uuid.UUID,
    payload: WorkOrderStatusUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> WorkOrderDetail:
    """Transition work order status, enforcing checklist completion or explicit override reason."""
    stmt = (
        select(WorkOrder)
        .options(
            selectinload(WorkOrder.client),
            selectinload(WorkOrder.category),
            selectinload(WorkOrder.created_by),
            selectinload(WorkOrder.assigned_to),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.assigned_to
            ),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.completed_by
            ),
            selectinload(WorkOrder.history).selectinload(WorkOrderHistory.actor),
        )
        .where(WorkOrder.id == work_order_id)
    )
    res = await session.execute(stmt)
    wo = res.scalar_one_or_none()

    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work order not found.",
        )

    target_status = payload.status.upper().strip()
    valid_statuses = [
        "PENDING",
        "IN_PROGRESS",
        "REVIEW",
        "COMPLETED",
        "CANCELLED",
        "ARCHIVED",
    ]
    if target_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.status}'. Allowed: {', '.join(valid_statuses)}",
        )

    if is_employee(current_user):
        if wo.assigned_to_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only update status for work orders assigned to you.",
            )
        if target_status in ["CANCELLED", "ARCHIVED"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Employees cannot cancel or archive work orders. This action requires administrator authority.",
            )

    # COMPLETION GUARD:
    # Cannot complete work order while required checklist items remain incomplete
    # unless an authorized supervisor override reason is supplied.
    if target_status == "COMPLETED":
        items = wo.checklist_items or []
        incomplete_items = [it for it in items if it.status != "COMPLETED"]
        if incomplete_items:
            if is_employee(current_user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only authorized supervisors may use the checklist completion override.",
                )
            if not payload.override_reason or not payload.override_reason.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot mark work order completed: {len(incomplete_items)} checklist items are incomplete. An explicit supervisor override reason is required.",
                )
        wo.completed_at = datetime.now(UTC)
        if not incomplete_items:
            wo.progress_percent = 100
    else:
        wo.completed_at = None
        wo.progress_percent = _recompute_progress(wo)

    old_status = wo.status
    wo.status = target_status
    wo.updated_at = datetime.now(UTC)

    details = f"Status transitioned from {old_status} to {target_status}."
    action_type = "STATUS_CHANGED"
    if payload.override_reason and payload.override_reason.strip():
        action_type = "COMPLETION_OVERRIDE"
        details += f" Supervisor Override Reason: {payload.override_reason.strip()}"

    history = WorkOrderHistory(
        id=uuid.uuid4(),
        work_order_id=wo.id,
        actor_id=current_user.id,
        action=action_type,
        details=details,
        timestamp=datetime.now(UTC),
    )
    session.add(history)
    wo.history.insert(0, history)

    await session.flush()
    await session.refresh(wo)

    return _map_work_order_detail(wo)


@router.delete(
    "/work-orders/{work_order_id}",
    summary="Delete or Archive Work Order",
)
async def delete_work_order(
    work_order_id: uuid.UUID,
    permanent: bool = Query(
        False, description="Permanently delete work order or archive"
    ),
    current_user: User = Depends(require_roles(["ADMIN", "SUPER_ADMIN"])),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    """Delete work order (Admin only) or mark as ARCHIVED with audit recording."""
    stmt = select(WorkOrder).where(WorkOrder.id == work_order_id)
    res = await session.execute(stmt)
    wo = res.scalar_one_or_none()

    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work order not found.",
        )

    if permanent:
        await session.delete(wo)
        await session.flush()
        return {
            "message": f"Work order {wo.order_number} permanently deleted.",
            "status": "DELETED",
        }
    else:
        wo.status = "ARCHIVED"
        wo.updated_at = datetime.now(UTC)
        history = WorkOrderHistory(
            id=uuid.uuid4(),
            work_order_id=wo.id,
            actor_id=current_user.id,
            action="ARCHIVED",
            details="Work order archived by administrator.",
            timestamp=datetime.now(UTC),
        )
        session.add(history)
        await session.flush()
        return {
            "message": f"Work order {wo.order_number} archived successfully.",
            "status": "ARCHIVED",
        }


# ============================================================================
# CHECKLIST PIPELINE ENDPOINTS
# ============================================================================


@router.post(
    "/work-orders/{work_order_id}/checklist",
    response_model=ChecklistItemSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Add Checklist Item to Work Order",
)
async def add_checklist_item(
    work_order_id: uuid.UUID,
    payload: ChecklistItemCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ChecklistItemSchema:
    """Add a new milestone or action item to a work order checklist and recalibrate progress."""
    wo_stmt = (
        select(WorkOrder)
        .options(selectinload(WorkOrder.checklist_items))
        .where(WorkOrder.id == work_order_id)
    )
    res = await session.execute(wo_stmt)
    wo = res.scalar_one_or_none()

    if is_employee(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employees cannot add checklist items to existing work orders. This action requires administrator authority.",
        )

    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work order not found.",
        )

    position = payload.position if payload.position > 0 else len(wo.checklist_items)

    item = WorkOrderChecklistItem(
        id=uuid.uuid4(),
        work_order_id=wo.id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        assigned_to_id=payload.assigned_to_id or wo.assigned_to_id,
        status="PENDING",
        position=position,
        due_date=payload.due_date or wo.due_date,
    )
    session.add(item)
    await session.flush()

    # Recalibrate parent work order progress
    wo.checklist_items.append(item)
    wo.progress_percent = _recompute_progress(wo)
    wo.updated_at = datetime.now(UTC)

    # Log audit entry
    history = WorkOrderHistory(
        id=uuid.uuid4(),
        work_order_id=wo.id,
        actor_id=current_user.id,
        action="CHECKLIST_ADDED",
        details=f"Added checklist milestone: '{item.title}'.",
        timestamp=datetime.now(UTC),
    )
    session.add(history)
    await session.flush()

    # Query with assignee
    item_stmt = (
        select(WorkOrderChecklistItem)
        .options(
            selectinload(WorkOrderChecklistItem.assigned_to),
            selectinload(WorkOrderChecklistItem.completed_by),
        )
        .where(WorkOrderChecklistItem.id == item.id)
    )
    item_res = await session.execute(item_stmt)
    loaded_item = item_res.scalar_one()

    return ChecklistItemSchema(
        id=loaded_item.id,
        work_order_id=loaded_item.work_order_id,
        title=loaded_item.title,
        description=loaded_item.description,
        assigned_to_id=loaded_item.assigned_to_id,
        assigned_to_name=(
            loaded_item.assigned_to.full_name if loaded_item.assigned_to else None
        ),
        status=loaded_item.status,
        position=loaded_item.position,
        due_date=loaded_item.due_date,
        completed_at=loaded_item.completed_at,
        completed_by_id=loaded_item.completed_by_id,
        completed_by_name=(
            loaded_item.completed_by.full_name if loaded_item.completed_by else None
        ),
        notes=loaded_item.notes,
        created_at=loaded_item.created_at,
    )


@router.patch(
    "/work-orders/{work_order_id}/checklist/{item_id}",
    response_model=ChecklistItemSchema,
    summary="Update Checklist Item State and Recalibrate Progress",
)
async def update_checklist_item(
    work_order_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: ChecklistItemUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ChecklistItemSchema:
    """Toggle checklist item status, update milestone notes, and update work order progress percent."""
    wo_stmt = (
        select(WorkOrder)
        .options(selectinload(WorkOrder.checklist_items))
        .where(WorkOrder.id == work_order_id)
    )
    wo_res = await session.execute(wo_stmt)
    wo = wo_res.scalar_one_or_none()

    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work order not found.",
        )

    item_stmt = (
        select(WorkOrderChecklistItem)
        .options(
            selectinload(WorkOrderChecklistItem.assigned_to),
            selectinload(WorkOrderChecklistItem.completed_by),
        )
        .where(
            and_(
                WorkOrderChecklistItem.id == item_id,
                WorkOrderChecklistItem.work_order_id == work_order_id,
            )
        )
    )
    item_res = await session.execute(item_stmt)
    item = item_res.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checklist item not found.",
        )

    if is_employee(current_user):
        if (
            wo.assigned_to_id != current_user.id
            and item.assigned_to_id != current_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only update checklist items on work orders assigned to you.",
            )
        if (
            payload.title is not None
            or payload.description is not None
            or payload.assigned_to_id is not None
            or payload.due_date is not None
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Employees are only permitted to update execution fields ('status' and 'notes'). Modifying checklist titles, descriptions, due dates, or assignments is restricted to administrators.",
            )

    details_parts: list[str] = []

    if payload.title and payload.title.strip() != item.title:
        item.title = payload.title.strip()
        details_parts.append(f"Title changed to '{item.title}'")

    if payload.description is not None:
        item.description = payload.description.strip() if payload.description else None

    if payload.notes is not None:
        item.notes = payload.notes.strip() if payload.notes else None

    if payload.due_date is not None:
        item.due_date = payload.due_date

    if payload.assigned_to_id is not None:
        item.assigned_to_id = payload.assigned_to_id

    target_item_status = None
    if payload.status:
        target_item_status = payload.status.upper().strip()
    elif payload.is_completed is not None:
        target_item_status = "COMPLETED" if payload.is_completed else "PENDING"

    if target_item_status:
        valid_item_statuses = ["PENDING", "IN_PROGRESS", "BLOCKED", "COMPLETED"]
        if target_item_status not in valid_item_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid checklist status '{payload.status}'. Allowed: {', '.join(valid_item_statuses)}",
            )
        if target_item_status != item.status:
            old_item_status = item.status
            item.status = target_item_status
            if target_item_status == "COMPLETED":
                item.completed_at = datetime.now(UTC)
                item.completed_by_id = current_user.id
            else:
                item.completed_at = None
                item.completed_by_id = None
            details_parts.append(
                f"Milestone '{item.title}' status changed from {old_item_status} to {target_item_status}"
            )

    # Recalibrate parent work order progress
    wo.progress_percent = _recompute_progress(wo)
    wo.updated_at = datetime.now(UTC)

    if details_parts:
        history = WorkOrderHistory(
            id=uuid.uuid4(),
            work_order_id=wo.id,
            actor_id=current_user.id,
            action="CHECKLIST_UPDATED",
            details="; ".join(details_parts),
            timestamp=datetime.now(UTC),
        )
        session.add(history)

    await session.flush()
    await session.refresh(item)

    return ChecklistItemSchema(
        id=item.id,
        work_order_id=item.work_order_id,
        title=item.title,
        description=item.description,
        assigned_to_id=item.assigned_to_id,
        assigned_to_name=(item.assigned_to.full_name if item.assigned_to else None),
        status=item.status,
        position=item.position,
        due_date=item.due_date,
        completed_at=item.completed_at,
        completed_by_id=item.completed_by_id,
        completed_by_name=(item.completed_by.full_name if item.completed_by else None),
        notes=item.notes,
        created_at=item.created_at,
    )


# ============================================================================
# TASK HISTORY & AUDIT TRAIL ENDPOINTS
# ============================================================================


@router.get(
    "/work-orders/{work_order_id}/history",
    response_model=list[WorkOrderHistorySchema],
    summary="Get Specific Work Order Audit History",
)
async def get_work_order_history(
    work_order_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[WorkOrderHistorySchema]:
    """Retrieve chronological audit events for a work order."""
    wo_stmt = select(WorkOrder).where(WorkOrder.id == work_order_id)
    wo = (await session.execute(wo_stmt)).scalar_one_or_none()
    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work order not found.",
        )

    if is_employee(current_user) and wo.assigned_to_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only view history for work orders assigned to you.",
        )

    stmt = (
        select(WorkOrderHistory)
        .options(selectinload(WorkOrderHistory.actor))
        .where(WorkOrderHistory.work_order_id == work_order_id)
        .order_by(WorkOrderHistory.timestamp.desc())
    )
    res = await session.execute(stmt)
    history_entries = res.scalars().all()

    return [
        WorkOrderHistorySchema(
            id=h.id,
            work_order_id=h.work_order_id,
            actor_id=h.actor_id,
            actor_name=h.actor.full_name if h.actor else None,
            action=h.action,
            details=h.details,
            timestamp=h.timestamp,
        )
        for h in history_entries
    ]


@router.get(
    "/history",
    response_model=list[WorkOrderHistorySchema],
    summary="Get Global Operations Task History",
)
async def get_global_task_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action: str | None = Query(None, description="Filter by event action"),
    current_user: User = Depends(require_roles(["ADMIN", "SUPER_ADMIN"])),
    session: AsyncSession = Depends(get_db_session),
) -> list[WorkOrderHistorySchema]:
    """Retrieve system-wide work order event logs for compliance and oversight."""
    stmt = (
        select(WorkOrderHistory)
        .options(selectinload(WorkOrderHistory.actor))
        .order_by(WorkOrderHistory.timestamp.desc())
    )
    if action:
        stmt = stmt.where(WorkOrderHistory.action == action.upper().strip())

    stmt = stmt.offset(skip).limit(limit)
    res = await session.execute(stmt)
    entries = res.scalars().all()

    return [
        WorkOrderHistorySchema(
            id=h.id,
            work_order_id=h.work_order_id,
            actor_id=h.actor_id,
            actor_name=h.actor.full_name if h.actor else None,
            action=h.action,
            details=h.details,
            timestamp=h.timestamp,
        )
        for h in entries
    ]


# ============================================================================
# WORK CATEGORIES MANAGEMENT
# ============================================================================


@router.get(
    "/categories",
    response_model=list[WorkCategorySchema],
    summary="List Work Categories and Checklist Templates",
)
async def list_work_categories(
    active_only: bool = Query(True, description="Filter only active categories"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[WorkCategorySchema]:
    """Retrieve work categories with preset checklist templates."""
    stmt = select(WorkCategory).order_by(WorkCategory.name.asc())
    if active_only:
        stmt = stmt.where(WorkCategory.is_active.is_(True))

    res = await session.execute(stmt)
    categories = res.scalars().all()

    return [WorkCategorySchema.model_validate(c) for c in categories]


@router.post(
    "/categories",
    response_model=WorkCategorySchema,
    status_code=status.HTTP_201_CREATED,
    summary="Create Work Category with Default Checklist Template",
)
async def create_work_category(
    payload: WorkCategoryCreate,
    current_user: User = Depends(require_roles(["ADMIN", "SUPER_ADMIN"])),
    session: AsyncSession = Depends(get_db_session),
) -> WorkCategorySchema:
    """Create a new work order category with configured default checklist template."""
    dup_stmt = select(WorkCategory).where(
        or_(
            WorkCategory.name == payload.name.strip(),
            WorkCategory.code == payload.code.upper().strip(),
        )
    )
    dup = (await session.execute(dup_stmt)).scalar_one_or_none()
    if dup:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A work category with this name or code already exists.",
        )

    category = WorkCategory(
        id=uuid.uuid4(),
        name=payload.name.strip(),
        code=payload.code.upper().strip(),
        description=payload.description.strip() if payload.description else None,
        default_priority=payload.default_priority.upper(),
        checklist_template=payload.checklist_template,
        is_active=True,
    )
    session.add(category)
    await session.flush()
    await session.refresh(category)

    return WorkCategorySchema.model_validate(category)


@router.put(
    "/categories/{category_id}",
    response_model=WorkCategorySchema,
    summary="Update Work Category",
)
async def update_work_category(
    category_id: uuid.UUID,
    payload: WorkCategoryUpdate,
    current_user: User = Depends(require_roles(["ADMIN", "SUPER_ADMIN"])),
    session: AsyncSession = Depends(get_db_session),
) -> WorkCategorySchema:
    """Update work category configuration, priority, or checklist template."""
    stmt = select(WorkCategory).where(WorkCategory.id == category_id)
    res = await session.execute(stmt)
    cat = res.scalar_one_or_none()

    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work category not found.",
        )

    if payload.name:
        cat.name = payload.name.strip()
    if payload.description is not None:
        cat.description = payload.description.strip() if payload.description else None
    if payload.default_priority:
        cat.default_priority = payload.default_priority.upper()
    if payload.checklist_template is not None:
        cat.checklist_template = payload.checklist_template
    if payload.is_active is not None:
        cat.is_active = payload.is_active

    await session.flush()
    await session.refresh(cat)

    return WorkCategorySchema.model_validate(cat)


@router.delete(
    "/categories/{category_id}",
    summary="Delete Work Category with Integrity Protection",
)
async def delete_work_category(
    category_id: uuid.UUID,
    current_user: User = Depends(require_roles(["ADMIN", "SUPER_ADMIN"])),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    """Delete work category, preventing deletion if referenced by active work orders."""
    stmt = select(WorkCategory).where(WorkCategory.id == category_id)
    res = await session.execute(stmt)
    cat = res.scalar_one_or_none()

    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work category not found.",
        )

    # Check references
    ref_stmt = select(func.count(WorkOrder.id)).where(
        WorkOrder.category_id == category_id
    )
    ref_count = (await session.execute(ref_stmt)).scalar() or 0
    if ref_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete category '{cat.name}': it is referenced by {ref_count} work orders. Deactivate it instead.",
        )

    await session.delete(cat)
    await session.flush()

    return {"message": f"Work category '{cat.name}' deleted successfully."}


# ============================================================================
# TEAM MANAGEMENT & EMPLOYEE WORKLOAD
# ============================================================================


@router.get(
    "/team",
    response_model=list[TeamMemberSummary],
    summary="List Team Members with Active and Completed Workload Counts",
)
async def list_crm_team_members(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[TeamMemberSummary]:
    """Retrieve operational team roster with active and completed task metrics."""
    users_stmt = (
        select(User).options(selectinload(User.roles)).order_by(User.full_name.asc())
    )
    users_res = await session.execute(users_stmt)
    users = users_res.scalars().all()

    # Query active counts grouped by assigned_to_id
    active_stmt = (
        select(WorkOrder.assigned_to_id, func.count(WorkOrder.id))
        .where(WorkOrder.status.in_(["PENDING", "IN_PROGRESS", "REVIEW"]))
        .group_by(WorkOrder.assigned_to_id)
    )
    active_res = await session.execute(active_stmt)
    active_counts = {row[0]: row[1] for row in active_res.all() if row[0]}

    # Query completed counts grouped by assigned_to_id
    completed_stmt = (
        select(WorkOrder.assigned_to_id, func.count(WorkOrder.id))
        .where(WorkOrder.status == "COMPLETED")
        .group_by(WorkOrder.assigned_to_id)
    )
    completed_res = await session.execute(completed_stmt)
    completed_counts = {row[0]: row[1] for row in completed_res.all() if row[0]}

    team_members: list[TeamMemberSummary] = []
    for u in users:
        role_name = u.roles[0].name if u.roles else "EMPLOYEE"
        team_members.append(
            TeamMemberSummary(
                id=u.id,
                full_name=u.full_name,
                email=u.email,
                role=role_name,
                is_active=u.is_active,
                active_workload_count=active_counts.get(u.id, 0),
                completed_workload_count=completed_counts.get(u.id, 0),
            )
        )

    return team_members


# ============================================================================
# IN-APP NOTIFICATIONS
# ============================================================================


@router.get(
    "/notifications",
    response_model=list[CrmNotificationSchema],
    summary="Get Current User Notifications",
)
async def get_crm_notifications(
    unread_only: bool = Query(False, description="Filter only unread alerts"),
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[CrmNotificationSchema]:
    """Retrieve notifications dispatched to the current user."""
    stmt = (
        select(CrmNotification)
        .where(CrmNotification.user_id == current_user.id)
        .order_by(CrmNotification.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        stmt = stmt.where(CrmNotification.is_read.is_(False))

    res = await session.execute(stmt)
    notifications = res.scalars().all()

    return [CrmNotificationSchema.model_validate(n) for n in notifications]


@router.patch(
    "/notifications/{notification_id}/read",
    response_model=CrmNotificationSchema,
    summary="Mark Notification as Read",
)
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CrmNotificationSchema:
    """Acknowledge and mark a single notification as read."""
    stmt = select(CrmNotification).where(CrmNotification.id == notification_id)
    res = await session.execute(stmt)
    notif = res.scalar_one_or_none()

    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )

    if notif.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You cannot access notifications belonging to another user.",
        )

    notif.is_read = True
    await session.flush()
    await session.refresh(notif)

    return CrmNotificationSchema.model_validate(notif)


@router.post(
    "/notifications/mark-all-read",
    summary="Mark All User Notifications as Read",
)
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, int]:
    """Mark all unread notifications for current user as read."""
    stmt = select(CrmNotification).where(
        and_(
            CrmNotification.user_id == current_user.id,
            CrmNotification.is_read.is_(False),
        )
    )
    res = await session.execute(stmt)
    unread = res.scalars().all()

    count = 0
    for n in unread:
        n.is_read = True
        count += 1

    await session.flush()
    return {"marked_read_count": count}


# ============================================================================
# CLIENT MANAGEMENT (EXTENDED & ALIASED)
# ============================================================================


@router.get(
    "/clients/search",
    response_model=list[ClientAutocompleteItem],
    summary="Client Autocomplete Search",
)
@router.get(
    "/customers/search",
    response_model=list[ClientAutocompleteItem],
    summary="Customer Autocomplete Search (Alias)",
)
async def search_clients_autocomplete(
    q: str = Query(
        ..., min_length=1, description="Search term for name, phone, email, or PAN"
    ),
    limit: int = Query(15, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[ClientAutocompleteItem]:
    """Retrieve autocomplete client suggestions for work order creation."""
    term = q.strip().lower()
    search_pattern = f"%{term}%"
    digits_only = "".join(ch for ch in term if ch.isdigit())
    phone_pattern = f"%{digits_only}%" if digits_only else search_pattern

    stmt = (
        select(Customer)
        .where(
            Customer.is_archived.is_(False),
            or_(
                func.lower(Customer.first_name).like(search_pattern),
                func.lower(Customer.last_name).like(search_pattern),
                func.lower(
                    func.concat(Customer.first_name, " ", Customer.last_name)
                ).like(search_pattern),
                func.lower(Customer.email).like(search_pattern),
                func.lower(Customer.pan_number).like(search_pattern),
                func.lower(Customer.phone).like(phone_pattern),
            ),
        )
        .order_by(Customer.created_at.desc())
        .limit(limit)
    )
    res = await session.execute(stmt)
    clients = res.scalars().all()

    return [
        ClientAutocompleteItem(
            id=c.id,
            full_name=f"{c.first_name} {c.last_name}".strip(),
            phone=c.phone,
            email=c.email,
            pan_number=c.pan_number,
            reference_source=c.reference_source,
        )
        for c in clients
    ]


@router.get(
    "/clients/summary",
    response_model=ClientSummaryCards,
    summary="Get Authorized Client Directory KPI Summary Cards",
)
@router.get(
    "/customers/summary",
    response_model=ClientSummaryCards,
    summary="Get Authorized Client Directory KPI Summary Cards (Alias)",
)
async def get_client_summary_cards(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ClientSummaryCards:
    """Calculates authoritative database client metrics for executive directory cards."""
    now = datetime.now(UTC)
    thirty_days_ago = now - timedelta(days=30)

    # 1. Total active (non-archived) clients
    total_active_stmt = select(func.count(Customer.id)).where(
        Customer.is_archived.is_(False)
    )
    total_clients = (await session.execute(total_active_stmt)).scalar() or 0

    # 2. Clients with active work orders (PENDING, IN_PROGRESS, REVIEW)
    active_wo_clients_stmt = (
        select(func.count(func.distinct(WorkOrder.client_id)))
        .join(Customer, WorkOrder.client_id == Customer.id)
        .where(
            Customer.is_archived.is_(False),
            WorkOrder.status.in_(["PENDING", "IN_PROGRESS", "REVIEW"]),
        )
    )
    clients_with_active = (await session.execute(active_wo_clients_stmt)).scalar() or 0

    # 3. New clients registered within the last 30 days
    new_30d_stmt = select(func.count(Customer.id)).where(
        Customer.is_archived.is_(False),
        Customer.created_at >= thirty_days_ago,
    )
    new_clients_30d = (await session.execute(new_30d_stmt)).scalar() or 0

    # 4. Archived clients
    archived_stmt = select(func.count(Customer.id)).where(Customer.is_archived.is_(True))
    archived_clients = (await session.execute(archived_stmt)).scalar() or 0

    return ClientSummaryCards(
        total_clients=total_clients,
        clients_with_active_tasks=clients_with_active,
        new_clients_30d=new_clients_30d,
        archived_clients=archived_clients,
    )


@router.get(
    "/clients",
    response_model=ClientListResponse | list[CustomerSummary],
    summary="List Clients (CRM Client Management)",
)
@router.get(
    "/customers",
    response_model=ClientListResponse | list[CustomerSummary],
    summary="List and Filter Customers",
)
async def list_clients(
    response: Response,
    q: str | None = Query(
        None, description="Search query across name, email, phone, reference, or PAN"
    ),
    is_archived: bool | None = Query(
        False, description="Filter by archival status (False=active, True=archived, None=all)"
    ),
    pipeline_status: str | None = Query(None, description="Filter by status"),
    page: int | None = Query(None, ge=1, description="1-indexed page number"),
    page_size: int | None = Query(None, ge=1, le=100, description="Items per page"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    paginate: bool = Query(
        False, description="Whether to wrap result in ClientListResponse envelope"
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ClientListResponse | list[CustomerSummary]:
    """Retrieve clients with server-side pagination, search, and active work order counts."""
    # Compute effective pagination window
    if page is not None:
        effective_limit = page_size if page_size is not None else limit
        effective_skip = (page - 1) * effective_limit
        effective_page = page
        should_envelope = True
    else:
        effective_limit = page_size if page_size is not None else limit
        effective_skip = skip
        effective_page = (skip // effective_limit) + 1 if effective_limit > 0 else 1
        should_envelope = paginate

    # Base query for records
    stmt = (
        select(Customer)
        .options(
            selectinload(Customer.financial_profile),
            selectinload(Customer.created_by),
        )
        .order_by(Customer.created_at.desc())
    )
    count_stmt = select(func.count(Customer.id))

    # Apply archival filter
    if is_archived is not None:
        stmt = stmt.where(Customer.is_archived == is_archived)
        count_stmt = count_stmt.where(Customer.is_archived == is_archived)

    # Apply search filter across name, normalized mobile, email, PAN, reference_source, and status
    if q:
        cleaned_term = q.strip().lower()
        search_pattern = f"%{cleaned_term}%"
        digits_only = "".join(ch for ch in cleaned_term if ch.isdigit())
        phone_pattern = f"%{digits_only}%" if digits_only else search_pattern

        filter_condition = or_(
            func.lower(Customer.first_name).like(search_pattern),
            func.lower(Customer.last_name).like(search_pattern),
            func.lower(func.concat(Customer.first_name, " ", Customer.last_name)).like(
                search_pattern
            ),
            func.lower(Customer.email).like(search_pattern),
            func.lower(Customer.pan_number).like(search_pattern),
            func.lower(Customer.phone).like(phone_pattern),
            func.lower(Customer.reference_source).like(search_pattern),
            func.lower(Customer.pipeline_status).like(search_pattern),
        )
        stmt = stmt.where(filter_condition)
        count_stmt = count_stmt.where(filter_condition)

    if pipeline_status and pipeline_status != "ALL":
        stmt = stmt.where(Customer.pipeline_status == pipeline_status)
        count_stmt = count_stmt.where(Customer.pipeline_status == pipeline_status)

    # Execute total count
    total_items = (await session.execute(count_stmt)).scalar() or 0
    total_pages = max(
        1,
        (total_items + effective_limit - 1) // effective_limit
        if effective_limit > 0
        else 1,
    )

    # Fetch paginated slice
    stmt = stmt.offset(effective_skip).limit(effective_limit)
    result = await session.execute(stmt)
    customers = result.scalars().all()

    # Batch query active and total work orders count
    customer_ids = [c.id for c in customers]
    active_counts: dict[uuid.UUID, int] = {}
    total_counts: dict[uuid.UUID, int] = {}

    if customer_ids:
        wo_counts_stmt = (
            select(
                WorkOrder.client_id,
                func.count(
                    case(
                        (
                            WorkOrder.status.in_(["PENDING", "IN_PROGRESS", "REVIEW"]),
                            1,
                        )
                    )
                ).label("active_count"),
                func.count(WorkOrder.id).label("total_count"),
            )
            .where(WorkOrder.client_id.in_(customer_ids))
            .group_by(WorkOrder.client_id)
        )
        wo_res = await session.execute(wo_counts_stmt)
        for row in wo_res.all():
            active_counts[row.client_id] = row.active_count
            total_counts[row.client_id] = row.total_count

    items = [
        _map_customer_summary(
            c,
            active_counts.get(c.id, 0),
            total_counts.get(c.id, 0),
        )
        for c in customers
    ]

    # Set response metadata headers
    response.headers["X-Total-Count"] = str(total_items)
    response.headers["X-Total-Pages"] = str(total_pages)
    response.headers["X-Current-Page"] = str(effective_page)
    response.headers["X-Page-Size"] = str(effective_limit)

    if should_envelope:
        return ClientListResponse(
            items=items,
            pagination=ClientPagination(
                page=effective_page,
                page_size=effective_limit,
                total_items=total_items,
                total_pages=total_pages,
            ),
        )

    return items


# Backward-compatible alias for existing tests
list_customers = list_clients


@router.post(
    "/clients",
    response_model=CustomerSummary,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Client (Alias)",
)
@router.post(
    "/customers",
    response_model=CustomerSummary,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Customer",
)
async def create_customer(
    payload: CustomerCreate,
    current_user: User = Depends(
        require_roles(
            ["ADMIN", "SUPER_ADMIN", "MANAGER", "LOAN_OFFICER", "UNDERWRITER", "EMPLOYEE"]
        )
    ),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSummary:
    """Create customer record and corresponding 1:1 financial profile."""
    norm_email = payload.email.lower().strip()
    norm_pan = payload.pan_number.upper().strip()
    norm_phone = normalize_indian_mobile(payload.phone)

    dup_stmt = select(Customer).where(
        or_(
            Customer.email == norm_email,
            Customer.pan_number == norm_pan,
        )
    )
    dup_res = await session.execute(dup_stmt)
    if dup_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A customer with this email or PAN number already exists.",
        )

    tier = calculate_risk_tier(
        payload.cibil_score,
        float(payload.monthly_income),
        float(payload.monthly_obligations),
    )

    customer = Customer(
        id=uuid.uuid4(),
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=norm_email,
        phone=norm_phone,
        pan_number=norm_pan,
        reference_source=payload.reference_source or "Direct Registration",
        pipeline_status=payload.pipeline_status,
        created_by_id=current_user.id,
        assigned_officer_id=current_user.id,
    )
    session.add(customer)
    await session.flush()

    fin_profile = FinancialProfile(
        id=uuid.uuid4(),
        customer_id=customer.id,
        employment_type=payload.employment_type,
        monthly_income=payload.monthly_income,
        monthly_obligations=payload.monthly_obligations,
        cibil_score=payload.cibil_score,
        risk_tier=tier,
    )
    session.add(fin_profile)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="CLIENT_CREATED",
        resource_type="client",
        resource_id=customer.id,
        state_delta={
            "name": f"{customer.first_name} {customer.last_name}",
            "phone": customer.phone,
            "email": customer.email,
            "pan": customer.pan_number,
        },
        created_at=datetime.now(UTC),
    )
    session.add(audit)
    await session.flush()

    return _map_customer_summary(customer, 0, 0, fin_profile=fin_profile)


create_client = create_customer


@router.get(
    "/clients/{customer_id}",
    response_model=CustomerDetail,
    summary="Get Client 360 Detail (Alias)",
)
@router.get(
    "/customers/{customer_id}",
    response_model=CustomerDetail,
    summary="Get Customer 360 Detail",
)
async def get_customer(
    customer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerDetail:
    """Retrieve complete customer information including financial profile, notes, and tasks."""
    stmt = (
        select(Customer)
        .options(
            selectinload(Customer.financial_profile),
            selectinload(Customer.created_by),
            selectinload(Customer.notes),
            selectinload(Customer.tasks),
        )
        .where(Customer.id == customer_id)
    )
    res = await session.execute(stmt)
    customer = res.scalar_one_or_none()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    return CustomerDetail(
        id=customer.id,
        first_name=customer.first_name,
        last_name=customer.last_name,
        email=customer.email,
        phone=customer.phone,
        pan_number=customer.pan_number,
        pipeline_status=customer.pipeline_status,
        reference_source=customer.reference_source,
        is_archived=customer.is_archived,
        archived_at=customer.archived_at,
        created_by_id=customer.created_by_id,
        created_by_name=customer.created_by.full_name if customer.created_by else None,
        assigned_officer_id=customer.assigned_officer_id,
        financial_profile=(
            FinancialProfileSchema.model_validate(customer.financial_profile)
            if customer.financial_profile
            else None
        ),
        created_at=customer.created_at,
        notes=[
            CustomerNoteSchema(
                id=n.id,
                content=n.content,
                author_id=n.author_id,
                created_at=n.created_at,
            )
            for n in customer.notes
        ],
        tasks=[
            TaskSchema(
                id=t.id,
                title=t.title,
                description=t.description,
                priority=t.priority,
                status=t.status,
                due_date=t.due_date,
                completed_at=t.completed_at,
                created_at=t.created_at,
            )
            for t in customer.tasks
        ],
    )


get_client = get_customer


@router.put(
    "/clients/{customer_id}",
    response_model=CustomerSummary,
    summary="Update Client Profile (Alias)",
)
@router.patch(
    "/clients/{customer_id}",
    response_model=CustomerSummary,
    summary="Patch Client Profile (Alias)",
)
@router.put(
    "/customers/{customer_id}",
    response_model=CustomerSummary,
    summary="Update Customer Profile",
)
@router.patch(
    "/customers/{customer_id}",
    response_model=CustomerSummary,
    summary="Patch Customer Profile",
)
async def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    current_user: User = Depends(
        require_roles(["ADMIN", "SUPER_ADMIN", "MANAGER", "LOAN_OFFICER", "UNDERWRITER"])
    ),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSummary:
    """Update customer details and recalibrate financial profile."""
    stmt = (
        select(Customer)
        .options(
            selectinload(Customer.financial_profile),
            selectinload(Customer.created_by),
        )
        .where(Customer.id == customer_id)
    )
    res = await session.execute(stmt)
    customer = res.scalar_one_or_none()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found.",
        )

    if payload.first_name:
        customer.first_name = payload.first_name.strip()
    if payload.last_name:
        customer.last_name = payload.last_name.strip()
    if payload.phone:
        customer.phone = normalize_indian_mobile(payload.phone)
    if payload.pipeline_status:
        customer.pipeline_status = payload.pipeline_status
    if payload.reference_source is not None:
        customer.reference_source = payload.reference_source.strip() if payload.reference_source else None
    if payload.is_archived is not None:
        customer.is_archived = payload.is_archived
        customer.archived_at = datetime.now(UTC) if payload.is_archived else None

    if payload.email:
        norm_email = payload.email.lower().strip()
        if norm_email != customer.email:
            dup_email = await session.execute(
                select(Customer.id).where(
                    Customer.email == norm_email,
                    Customer.id != customer_id,
                )
            )
            if dup_email.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A customer with this email already exists.",
                )
            customer.email = norm_email

    if payload.pan_number:
        norm_pan = payload.pan_number.upper().strip()
        if norm_pan != customer.pan_number:
            dup_pan = await session.execute(
                select(Customer.id).where(
                    Customer.pan_number == norm_pan,
                    Customer.id != customer_id,
                )
            )
            if dup_pan.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A customer with this PAN number already exists.",
                )
            customer.pan_number = norm_pan

    if customer.financial_profile:
        fp = customer.financial_profile
        if payload.employment_type:
            fp.employment_type = payload.employment_type
        if payload.monthly_income is not None:
            fp.monthly_income = payload.monthly_income
        if payload.monthly_obligations is not None:
            fp.monthly_obligations = payload.monthly_obligations
        if payload.cibil_score is not None:
            fp.cibil_score = payload.cibil_score

        fp.risk_tier = calculate_risk_tier(
            fp.cibil_score,
            float(fp.monthly_income),
            float(fp.monthly_obligations),
        )

    # Record audit log
    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="CLIENT_UPDATED",
        resource_type="client",
        resource_id=customer.id,
        state_delta={
            "name": f"{customer.first_name} {customer.last_name}",
            "phone": customer.phone,
            "email": customer.email,
            "status": customer.pipeline_status,
        },
        created_at=datetime.now(UTC),
    )
    session.add(audit)
    await session.flush()

    # Query active and total work order metrics
    wo_count_stmt = select(
        func.count(
            case((WorkOrder.status.in_(["PENDING", "IN_PROGRESS", "REVIEW"]), 1))
        ).label("active_count"),
        func.count(WorkOrder.id).label("total_count"),
    ).where(WorkOrder.client_id == customer.id)
    wo_row = (await session.execute(wo_count_stmt)).one_or_none()
    active_wo = wo_row.active_count if wo_row else 0
    total_wo = wo_row.total_count if wo_row else 0

    return _map_customer_summary(customer, active_wo, total_wo)


update_client = update_customer


@router.post(
    "/clients/{client_id}/archive",
    response_model=CustomerSummary,
    summary="Archive Client (Soft-Delete)",
)
@router.post(
    "/customers/{client_id}/archive",
    response_model=CustomerSummary,
    summary="Archive Customer (Alias)",
)
async def archive_client(
    client_id: uuid.UUID,
    current_user: User = Depends(require_roles(["ADMIN", "SUPER_ADMIN", "MANAGER"])),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSummary:
    """Soft delete/archive a client record while preserving work orders and audit history."""
    stmt = (
        select(Customer)
        .options(
            selectinload(Customer.financial_profile),
            selectinload(Customer.created_by),
        )
        .where(Customer.id == client_id)
    )
    res = await session.execute(stmt)
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found.",
        )

    c.is_archived = True
    c.archived_at = datetime.now(UTC)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="CLIENT_ARCHIVED",
        resource_type="client",
        resource_id=c.id,
        state_delta={
            "name": f"{c.first_name} {c.last_name}",
            "archived_at": c.archived_at.isoformat(),
        },
        created_at=datetime.now(UTC),
    )
    session.add(audit)
    await session.flush()

    return _map_customer_summary(c)


@router.post(
    "/clients/{client_id}/restore",
    response_model=CustomerSummary,
    summary="Restore Archived Client",
)
@router.post(
    "/customers/{client_id}/restore",
    response_model=CustomerSummary,
    summary="Restore Archived Customer (Alias)",
)
async def restore_client(
    client_id: uuid.UUID,
    current_user: User = Depends(require_roles(["ADMIN", "SUPER_ADMIN", "MANAGER"])),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSummary:
    """Restore previously archived client to active directory."""
    stmt = (
        select(Customer)
        .options(
            selectinload(Customer.financial_profile),
            selectinload(Customer.created_by),
        )
        .where(Customer.id == client_id)
    )
    res = await session.execute(stmt)
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found.",
        )

    c.is_archived = False
    c.archived_at = None

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="CLIENT_RESTORED",
        resource_type="client",
        resource_id=c.id,
        state_delta={"name": f"{c.first_name} {c.last_name}"},
        created_at=datetime.now(UTC),
    )
    session.add(audit)
    await session.flush()

    return _map_customer_summary(c)


@router.get(
    "/clients/{client_id}/history",
    response_model=list[AuditLogEntrySchema],
    summary="Get Client Audit History",
)
@router.get(
    "/customers/{client_id}/history",
    response_model=list[AuditLogEntrySchema],
    summary="Get Customer Audit History (Alias)",
)
async def get_client_history(
    client_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[AuditLogEntrySchema]:
    """Retrieve immutable compliance audit events for a client."""
    c_check = await session.execute(select(Customer.id).where(Customer.id == client_id))
    if not c_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found.",
        )

    stmt = (
        select(AuditLog)
        .options(selectinload(AuditLog.actor))
        .where(AuditLog.resource_type == "client", AuditLog.resource_id == client_id)
        .order_by(AuditLog.created_at.desc())
    )
    res = await session.execute(stmt)
    logs = res.scalars().all()

    return [
        AuditLogEntrySchema(
            id=log.id,
            actor_id=log.actor_id,
            actor_name=log.actor.full_name if log.actor else "System",
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            state_delta=log.state_delta,
            ip_address=log.ip_address,
            created_at=log.created_at,
        )
        for log in logs
    ]


@router.get(
    "/clients/{client_id}/work-orders",
    response_model=list[WorkOrderSummary],
    summary="Get Client Work Orders",
)
@router.get(
    "/customers/{client_id}/work-orders",
    response_model=list[WorkOrderSummary],
    summary="Get Customer Work Orders (Alias)",
)
async def get_client_work_orders(
    client_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[WorkOrderSummary]:
    """Retrieve work orders associated with a client."""
    stmt = (
        select(WorkOrder)
        .options(
            selectinload(WorkOrder.client),
            selectinload(WorkOrder.category),
            selectinload(WorkOrder.created_by),
            selectinload(WorkOrder.assigned_to),
            selectinload(WorkOrder.checklist_items),
        )
        .where(WorkOrder.client_id == client_id)
        .order_by(WorkOrder.created_at.desc())
    )
    res = await session.execute(stmt)
    wos = res.scalars().all()
    return [_map_work_order_summary(wo) for wo in wos]


@router.delete(
    "/clients/{client_id}",
    summary="Safe Delete Client Record",
)
@router.delete(
    "/customers/{client_id}",
    summary="Safe Delete Customer Record",
)
async def delete_client(
    client_id: uuid.UUID,
    current_user: User = Depends(require_roles(["ADMIN", "SUPER_ADMIN"])),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Safe deletion of client record subject to retention and dependency rules.

    Blocks deletion if associated work orders or active tasks exist.
    """
    stmt = select(Customer).where(Customer.id == client_id)
    res = await session.execute(stmt)
    customer = res.scalar_one_or_none()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found.",
        )

    # 1. Foreign-key dependency check on WorkOrders
    wo_stmt = select(func.count(WorkOrder.id)).where(WorkOrder.client_id == client_id)
    wo_count = (await session.execute(wo_stmt)).scalar() or 0
    if wo_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot delete client with {wo_count} associated work order(s). "
                "Please complete, reassign, or archive related work orders first."
            ),
        )

    # 2. Check for active/pending Tasks
    task_stmt = select(func.count(Task.id)).where(
        Task.customer_id == client_id,
        Task.status != "COMPLETED",
    )
    task_count = (await session.execute(task_stmt)).scalar() or 0
    if task_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot delete client with {task_count} active task(s). "
                "Please complete or close active tasks before deletion."
            ),
        )

    client_display_name = f"{customer.first_name} {customer.last_name}"

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="CLIENT_DELETED",
        resource_type="client",
        resource_id=client_id,
        state_delta={"name": client_display_name},
        created_at=datetime.now(UTC),
    )
    session.add(audit)

    await session.delete(customer)
    await session.flush()

    return {
        "message": f"Client '{client_display_name}' deleted successfully.",
        "deleted_id": str(client_id),
    }


delete_customer = delete_client


@router.post(
    "/customers/{customer_id}/notes",
    response_model=CustomerNoteSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Add Customer Interaction Note",
)
@router.post(
    "/clients/{customer_id}/notes",
    response_model=CustomerNoteSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Add Client Interaction Note (Alias)",
)
async def add_customer_note(
    customer_id: uuid.UUID,
    payload: CreateNoteRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerNoteSchema:
    """Append a timestamped case note to the customer timeline."""
    c_check = await session.execute(
        select(Customer.id).where(Customer.id == customer_id)
    )
    if not c_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found."
        )

    note = CustomerNote(
        id=uuid.uuid4(),
        customer_id=customer_id,
        author_id=current_user.id,
        content=payload.content.strip(),
    )
    session.add(note)
    await session.flush()

    return CustomerNoteSchema(
        id=note.id,
        content=note.content,
        author_id=note.author_id,
        author_name=current_user.full_name,
        created_at=note.created_at,
    )


@router.post(
    "/customers/{customer_id}/tasks",
    response_model=TaskSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Create Follow-up Task",
)
@router.post(
    "/clients/{customer_id}/tasks",
    response_model=TaskSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Create Follow-up Task (Client Alias)",
)
async def add_customer_task(
    customer_id: uuid.UUID,
    payload: CreateTaskRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> TaskSchema:
    """Schedule a follow-up action for the customer."""
    c_check = await session.execute(
        select(Customer.id).where(Customer.id == customer_id)
    )
    if not c_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found."
        )

    task = Task(
        id=uuid.uuid4(),
        customer_id=customer_id,
        assigned_to_id=current_user.id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        priority=payload.priority,
        status="PENDING",
        due_date=payload.due_date,
    )
    session.add(task)
    await session.flush()

    return TaskSchema(
        id=task.id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        status=task.status,
        due_date=task.due_date,
        completed_at=task.completed_at,
        created_at=task.created_at,
    )


@router.get(
    "/tasks/{task_id}",
    summary="Get Task or Work Order Detail",
)
async def get_task_endpoint(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Retrieve details for a follow-up task or enterprise work order."""
    task_stmt = select(Task).where(Task.id == task_id)
    task_res = await session.execute(task_stmt)
    task = task_res.scalar_one_or_none()
    if task:
        return TaskSchema(
            id=task.id,
            title=task.title,
            description=task.description,
            priority=task.priority,
            status=task.status,
            due_date=task.due_date,
            completed_at=task.completed_at,
            created_at=task.created_at,
        )

    wo_stmt = (
        select(WorkOrder)
        .options(
            selectinload(WorkOrder.client),
            selectinload(WorkOrder.category),
            selectinload(WorkOrder.created_by),
            selectinload(WorkOrder.assigned_to),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.assigned_to
            ),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.completed_by
            ),
            selectinload(WorkOrder.history).selectinload(WorkOrderHistory.actor),
        )
        .where(WorkOrder.id == task_id)
    )
    wo_res = await session.execute(wo_stmt)
    wo = wo_res.scalar_one_or_none()
    if wo:
        if is_employee(current_user) and wo.assigned_to_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only view work orders assigned to you.",
            )
        return _map_work_order_detail(wo)

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Task or work order not found."
    )


@router.patch(
    "/tasks/{task_id}",
    summary="Update Task Attributes or Status",
)
@router.put(
    "/tasks/{task_id}",
    summary="Update Task Attributes or Status (Alias)",
)
async def update_task_endpoint(
    task_id: uuid.UUID,
    payload: dict[str, Any],
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Update follow-up task attributes or transition work order status."""
    stmt = select(Task).where(Task.id == task_id)
    res = await session.execute(stmt)
    task = res.scalar_one_or_none()

    if task:
        if "title" in payload and payload["title"]:
            task.title = str(payload["title"]).strip()
        if "description" in payload:
            task.description = str(payload["description"]).strip() if payload["description"] else None
        if "priority" in payload and payload["priority"]:
            task.priority = str(payload["priority"]).upper().strip()
        if "due_date" in payload and payload["due_date"]:
            raw_date = payload["due_date"]
            if isinstance(raw_date, str):
                try:
                    task.due_date = date.fromisoformat(raw_date[:10])
                except ValueError:
                    pass
            elif isinstance(raw_date, date):
                task.due_date = raw_date
        if "status" in payload and payload["status"]:
            s_val = str(payload["status"]).upper().strip()
            task.status = s_val
            if s_val == "COMPLETED":
                task.completed_at = datetime.now(UTC)
            else:
                task.completed_at = None

        await session.flush()
        return TaskSchema(
            id=task.id,
            title=task.title,
            description=task.description,
            priority=task.priority,
            status=task.status,
            due_date=task.due_date,
            completed_at=task.completed_at,
            created_at=task.created_at,
        )

    # Check if target is a WorkOrder
    wo_stmt = (
        select(WorkOrder)
        .options(
            selectinload(WorkOrder.client),
            selectinload(WorkOrder.category),
            selectinload(WorkOrder.created_by),
            selectinload(WorkOrder.assigned_to),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.assigned_to
            ),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.completed_by
            ),
            selectinload(WorkOrder.history).selectinload(WorkOrderHistory.actor),
        )
        .where(WorkOrder.id == task_id)
    )
    wo_res = await session.execute(wo_stmt)
    wo = wo_res.scalar_one_or_none()
    if wo:
        if "status" in payload:
            status_update = WorkOrderStatusUpdate(
                status=str(payload["status"]),
                override_reason=payload.get("override_reason"),
            )
            return await update_work_order_status(
                work_order_id=task_id,
                payload=status_update,
                current_user=current_user,
                session=session,
            )
        else:
            wo_update = WorkOrderUpdate(
                title=payload.get("title"),
                description=payload.get("description"),
                category_id=uuid.UUID(payload["category_id"]) if payload.get("category_id") else None,
                assigned_to_id=uuid.UUID(payload["assigned_to_id"]) if payload.get("assigned_to_id") else None,
                priority=payload.get("priority"),
                due_date=datetime.fromisoformat(payload["due_date"]) if payload.get("due_date") else None,
                priority_notes=payload.get("priority_notes"),
            )
            return await update_work_order(
                work_order_id=task_id,
                payload=wo_update,
                current_user=current_user,
                session=session,
            )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Task or work order not found."
    )


update_task_status = update_task_endpoint


@router.delete(
    "/tasks/{task_id}",
    summary="Delete Follow-up Task or Work Order",
)
async def delete_task_endpoint(
    task_id: uuid.UUID,
    permanent: bool = Query(True, description="Permanent deletion"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Delete a follow-up task or work order."""
    # Check Task table
    stmt = select(Task).where(Task.id == task_id)
    res = await session.execute(stmt)
    task = res.scalar_one_or_none()
    if task:
        task_title = task.title
        await session.delete(task)
        await session.flush()
        return {
            "message": f"Task '{task_title}' deleted successfully.",
            "deleted_id": str(task_id),
        }

    # Check WorkOrder table
    wo_stmt = select(WorkOrder).where(WorkOrder.id == task_id)
    wo_res = await session.execute(wo_stmt)
    wo = wo_res.scalar_one_or_none()
    if wo:
        if is_employee(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Employees cannot delete work orders.",
            )
        if permanent:
            await session.delete(wo)
            await session.flush()
            return {
                "message": f"Work order {wo.order_number} permanently deleted.",
                "status": "DELETED",
            }
        else:
            wo.status = "ARCHIVED"
            wo.updated_at = datetime.now(UTC)
            await session.flush()
            return {
                "message": f"Work order {wo.order_number} archived.",
                "status": "ARCHIVED",
            }

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Task or work order not found."
    )


@router.patch(
    "/tasks/{task_id}/progress",
    response_model=WorkOrderDetail,
    summary="Update Task Progress Percentage",
)
async def update_task_progress(
    task_id: uuid.UUID,
    payload: dict[str, Any],
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> WorkOrderDetail:
    """Update progress percentage for assigned task or work order."""
    stmt = (
        select(WorkOrder)
        .options(
            selectinload(WorkOrder.client),
            selectinload(WorkOrder.category),
            selectinload(WorkOrder.created_by),
            selectinload(WorkOrder.assigned_to),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.assigned_to
            ),
            selectinload(WorkOrder.checklist_items).selectinload(
                WorkOrderChecklistItem.completed_by
            ),
            selectinload(WorkOrder.history).selectinload(WorkOrderHistory.actor),
        )
        .where(WorkOrder.id == task_id)
    )
    res = await session.execute(stmt)
    wo = res.scalar_one_or_none()
    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )

    if is_employee(current_user) and wo.assigned_to_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employees can only update progress on tasks assigned to them.",
        )

    raw_prog = payload.get("progress_percent", payload.get("progress", wo.progress_percent))
    try:
        new_progress = int(raw_prog)
    except (ValueError, TypeError):
        new_progress = wo.progress_percent

    new_progress = max(0, min(100, new_progress))
    old_progress = wo.progress_percent
    wo.progress_percent = new_progress
    wo.updated_at = datetime.now(UTC)

    history = WorkOrderHistory(
        id=uuid.uuid4(),
        work_order_id=wo.id,
        actor_id=current_user.id,
        action="UPDATED",
        details=f"Progress updated from {old_progress}% to {new_progress}%.",
        timestamp=datetime.now(UTC),
    )
    session.add(history)
    await session.flush()
    return _map_work_order_detail(wo)


# Aliases on CRM router
router.add_api_route(
    "/tasks",
    list_work_orders,
    methods=["GET"],
    response_model=list[WorkOrderSummary],
    summary="List Tasks (Alias)",
)
router.add_api_route(
    "/tasks",
    create_work_order,
    methods=["POST"],
    response_model=WorkOrderDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create Task (Alias)",
)
router.add_api_route(
    "/tasks/{work_order_id}/history",
    get_work_order_history,
    methods=["GET"],
    response_model=list[WorkOrderHistorySchema],
    summary="Get Task History (Alias)",
)
router.add_api_route(
    "/tasks/{work_order_id}/checklist-items",
    add_checklist_item,
    methods=["POST"],
    response_model=ChecklistItemSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Add Task Checklist Item (Alias)",
)
router.add_api_route(
    "/tasks/{work_order_id}/checklist-items/{item_id}",
    update_checklist_item,
    methods=["PATCH"],
    response_model=ChecklistItemSchema,
    summary="Update Task Checklist Item (Alias)",
)


# ============================================================================
# DIRECT API ALIASES (MAPPED TO ROOT /api/v1 WITHOUT /crm PREFIX)
# ============================================================================

# Client direct endpoints
direct_router.add_api_route(
    "/clients",
    list_clients,
    methods=["GET"],
    response_model=ClientListResponse | list[CustomerSummary],
    summary="List Clients Direct",
)
direct_router.add_api_route(
    "/clients",
    create_customer,
    methods=["POST"],
    response_model=CustomerSummary,
    status_code=status.HTTP_201_CREATED,
    summary="Create Client Direct",
)
direct_router.add_api_route(
    "/clients/search",
    search_clients_autocomplete,
    methods=["GET"],
    response_model=list[ClientAutocompleteItem],
    summary="Client Autocomplete Direct",
)
direct_router.add_api_route(
    "/clients/summary",
    get_client_summary_cards,
    methods=["GET"],
    response_model=ClientSummaryCards,
    summary="Client Summary Cards Direct",
)
direct_router.add_api_route(
    "/clients/{customer_id}",
    get_customer,
    methods=["GET"],
    response_model=CustomerDetail,
    summary="Get Client Detail Direct",
)
direct_router.add_api_route(
    "/clients/{customer_id}",
    update_customer,
    methods=["PATCH", "PUT"],
    response_model=CustomerSummary,
    summary="Update Client Direct",
)
direct_router.add_api_route(
    "/clients/{client_id}/archive",
    archive_client,
    methods=["POST"],
    response_model=CustomerSummary,
    summary="Archive Client Direct",
)
direct_router.add_api_route(
    "/clients/{client_id}/restore",
    restore_client,
    methods=["POST"],
    response_model=CustomerSummary,
    summary="Restore Client Direct",
)
direct_router.add_api_route(
    "/clients/{client_id}/history",
    get_client_history,
    methods=["GET"],
    response_model=list[AuditLogEntrySchema],
    summary="Client History Direct",
)
direct_router.add_api_route(
    "/clients/{client_id}/work-orders",
    get_client_work_orders,
    methods=["GET"],
    response_model=list[WorkOrderSummary],
    summary="Client Work Orders Direct",
)
direct_router.add_api_route(
    "/clients/{client_id}",
    delete_client,
    methods=["DELETE"],
    summary="Delete Client Direct",
)

# Work order direct endpoints
direct_router.add_api_route(
    "/work-orders",
    list_work_orders,
    methods=["GET"],
    response_model=list[WorkOrderSummary],
    summary="List Work Orders Direct",
)
direct_router.add_api_route(
    "/work-orders",
    create_work_order,
    methods=["POST"],
    response_model=WorkOrderDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create Work Order Direct",
)
direct_router.add_api_route(
    "/work-orders/{work_order_id}",
    get_work_order,
    methods=["GET"],
    response_model=WorkOrderDetail,
    summary="Get Work Order Direct",
)
direct_router.add_api_route(
    "/work-orders/{work_order_id}",
    update_work_order,
    methods=["PATCH", "PUT"],
    response_model=WorkOrderDetail,
    summary="Update Work Order Direct",
)
direct_router.add_api_route(
    "/work-orders/{work_order_id}/history",
    get_work_order_history,
    methods=["GET"],
    response_model=list[WorkOrderHistorySchema],
    summary="Work Order History Direct",
)
direct_router.add_api_route(
    "/work-orders/{work_order_id}/assignments",
    assign_work_order,
    methods=["POST"],
    response_model=WorkOrderDetail,
    summary="Assign Work Order Direct",
)
direct_router.add_api_route(
    "/work-orders/{work_order_id}/status",
    update_work_order_status,
    methods=["PATCH"],
    response_model=WorkOrderDetail,
    summary="Update Work Order Status Direct",
)
direct_router.add_api_route(
    "/work-orders/{work_order_id}",
    delete_work_order,
    methods=["DELETE"],
    summary="Delete Work Order Direct",
)

# Task operations direct endpoints
direct_router.add_api_route(
    "/tasks",
    list_work_orders,
    methods=["GET"],
    response_model=list[WorkOrderSummary],
    summary="List Tasks Direct",
)
direct_router.add_api_route(
    "/tasks",
    create_work_order,
    methods=["POST"],
    response_model=WorkOrderDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create Task Direct",
)
direct_router.add_api_route(
    "/tasks/{task_id}",
    get_task_endpoint,
    methods=["GET"],
    summary="Get Task Direct",
)
direct_router.add_api_route(
    "/tasks/{task_id}",
    update_task_endpoint,
    methods=["PATCH", "PUT"],
    summary="Update Task Direct",
)
direct_router.add_api_route(
    "/tasks/{task_id}",
    delete_task_endpoint,
    methods=["DELETE"],
    summary="Delete Task Direct",
)
direct_router.add_api_route(
    "/tasks/{task_id}/progress",
    update_task_progress,
    methods=["PATCH"],
    response_model=WorkOrderDetail,
    summary="Update Task Progress Direct",
)
direct_router.add_api_route(
    "/tasks/{work_order_id}/status",
    update_work_order_status,
    methods=["PATCH"],
    response_model=WorkOrderDetail,
    summary="Update Task Status Direct",
)
direct_router.add_api_route(
    "/tasks/{work_order_id}/history",
    get_work_order_history,
    methods=["GET"],
    response_model=list[WorkOrderHistorySchema],
    summary="Task History Direct",
)
direct_router.add_api_route(
    "/tasks/{work_order_id}/checklist-items",
    add_checklist_item,
    methods=["POST"],
    response_model=ChecklistItemSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Add Task Checklist Item Direct",
)
direct_router.add_api_route(
    "/tasks/{work_order_id}/checklist-items/{item_id}",
    update_checklist_item,
    methods=["PATCH"],
    response_model=ChecklistItemSchema,
    summary="Update Task Checklist Item Direct",
)

# Supporting data direct endpoints
direct_router.add_api_route(
    "/users/eligible-assignees",
    list_eligible_assignees,
    methods=["GET"],
    response_model=list[EligibleAssigneeSchema],
    summary="Eligible Assignees Direct",
)
direct_router.add_api_route(
    "/categories",
    list_work_categories,
    methods=["GET"],
    response_model=list[WorkCategorySchema],
    summary="List Categories Direct",
)
direct_router.add_api_route(
    "/categories",
    create_work_category,
    methods=["POST"],
    response_model=WorkCategorySchema,
    status_code=status.HTTP_201_CREATED,
    summary="Create Category Direct",
)
direct_router.add_api_route(
    "/categories/{category_id}",
    update_work_category,
    methods=["PUT", "PATCH"],
    response_model=WorkCategorySchema,
    summary="Update Category Direct",
)
direct_router.add_api_route(
    "/categories/{category_id}",
    delete_work_category,
    methods=["DELETE"],
    summary="Delete Category Direct",
)
direct_router.add_api_route(
    "/task-categories",
    list_work_categories,
    methods=["GET"],
    response_model=list[WorkCategorySchema],
    summary="Task Categories Direct",
)
direct_router.add_api_route(
    "/customers/{customer_id}/tasks",
    add_customer_task,
    methods=["POST"],
    response_model=TaskSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Add Customer Task Direct",
)
direct_router.add_api_route(
    "/clients/{customer_id}/tasks",
    add_customer_task,
    methods=["POST"],
    response_model=TaskSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Add Client Task Direct",
)
direct_router.add_api_route(
    "/customers/{customer_id}/notes",
    add_customer_note,
    methods=["POST"],
    response_model=CustomerNoteSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Add Customer Note Direct",
)
direct_router.add_api_route(
    "/clients/{customer_id}/notes",
    add_customer_note,
    methods=["POST"],
    response_model=CustomerNoteSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Add Client Note Direct",
)
direct_router.add_api_route(
    "/dashboard/summary",
    get_crm_dashboard_metrics,
    methods=["GET"],
    response_model=CrmDashboardMetrics,
    summary="Dashboard Summary Direct",
)

