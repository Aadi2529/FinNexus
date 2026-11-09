"""Pydantic schemas for CRM module."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field, field_validator


class FinancialProfileSchema(BaseModel):
    """Customer financial profile."""

    employment_type: str = Field(default="SALARIED")
    monthly_income: Decimal = Field(..., ge=0)
    monthly_obligations: Decimal = Field(..., ge=0)
    cibil_score: int | None = Field(default=None, ge=300, le=900)
    risk_tier: str = Field(default="MEDIUM")

    model_config = ConfigDict(from_attributes=True)


class CustomerNoteSchema(BaseModel):
    """Customer interaction note."""

    id: uuid.UUID
    content: str
    author_id: uuid.UUID
    author_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskSchema(BaseModel):
    """Customer task."""

    id: uuid.UUID
    title: str
    description: str | None = None
    priority: str
    status: str
    due_date: date
    completed_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerSummary(BaseModel):
    """Customer listing summary."""

    id: uuid.UUID
    first_name: str
    last_name: str
    email: str | None = None
    phone: str
    pan_number: str | None = None
    pipeline_status: str
    reference_source: str | None = None
    is_archived: bool = False
    archived_at: datetime | None = None
    created_by_id: uuid.UUID | None = None
    created_by_name: str | None = None
    assigned_officer_id: uuid.UUID | None = None
    financial_profile: FinancialProfileSchema | None = None
    created_at: datetime
    active_work_orders_count: int = 0
    total_work_orders_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ClientPagination(BaseModel):
    """Server-side pagination envelope metadata."""

    page: int
    page_size: int
    total_items: int
    total_pages: int


class ClientListResponse(BaseModel):
    """Paginated client list response envelope."""

    items: list[CustomerSummary]
    pagination: ClientPagination


class ClientSummaryCards(BaseModel):
    """Real dynamic summary counts for the client management dashboard."""

    total_clients: int
    clients_with_active_tasks: int
    new_clients_30d: int
    archived_clients: int


class ClientAutocompleteItem(BaseModel):
    """Autocomplete search result item for work order client selector."""

    id: uuid.UUID
    full_name: str
    email: str | None = None
    phone: str
    pan_number: str | None = None
    reference_source: str | None = None
    is_archived: bool = False
    active_work_orders_count: int = 0


class AuditLogEntrySchema(BaseModel):
    """Immutable audit trail log record."""

    id: uuid.UUID
    actor_id: uuid.UUID | None = None
    actor_name: str | None = None
    action: str
    resource_type: str
    resource_id: uuid.UUID | None = None
    details: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EligibleAssigneeSchema(BaseModel):
    """Eligible staff member available for work order assignment."""

    id: uuid.UUID
    full_name: str
    email: str
    role: str
    is_active: bool = True
    active_workload_count: int = 0


class WorkOrderAssignmentRequest(BaseModel):
    """Payload to assign or reassign a work order to a staff specialist."""

    assigned_to_id: uuid.UUID | None = None
    assignment_notes: str | None = None


class CustomerDetail(CustomerSummary):
    """Customer 360 detailed view."""

    notes: list[CustomerNoteSchema] = Field(default_factory=list)
    tasks: list[TaskSchema] = Field(default_factory=list)


class CustomerCreate(BaseModel):
    """Payload to create a new customer."""

    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=20)
    pan_number: str = Field(..., min_length=10, max_length=10)
    reference_source: str | None = None
    pipeline_status: str = Field(default="NEW_LEAD")
    employment_type: str = Field(default="SALARIED")
    monthly_income: Decimal = Field(default=Decimal("50000.00"), ge=0)
    monthly_obligations: Decimal = Field(default=Decimal("10000.00"), ge=0)
    cibil_score: int | None = Field(default=700, ge=300, le=900)


class CustomerUpdate(BaseModel):
    """Payload to update an existing customer."""

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, min_length=7, max_length=20)
    pan_number: str | None = Field(default=None, min_length=10, max_length=10)
    reference_source: str | None = None
    pipeline_status: str | None = None
    is_archived: bool | None = None
    employment_type: str | None = None
    monthly_income: Decimal | None = Field(default=None, ge=0)
    monthly_obligations: Decimal | None = Field(default=None, ge=0)
    cibil_score: int | None = Field(default=None, ge=300, le=900)


class NewClientInline(BaseModel):
    """Inline new client registration for transactional work order creation."""

    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(default="", max_length=100)
    email: EmailStr | None = None
    phone: str = Field(..., min_length=10, max_length=20)
    pan_number: str | None = Field(default=None, max_length=10)
    reference_source: str | None = None
    pipeline_status: str = Field(default="NEW_LEAD")
    employment_type: str = Field(default="SALARIED")
    monthly_income: Decimal = Field(default=Decimal("50000.00"), ge=0)
    monthly_obligations: Decimal = Field(default=Decimal("10000.00"), ge=0)
    cibil_score: int | None = Field(default=750, ge=300, le=900)


class CreateNoteRequest(BaseModel):
    """Payload to add note to customer."""

    content: str = Field(..., min_length=1)


class CreateTaskRequest(BaseModel):
    """Payload to add task to customer."""

    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = None
    priority: str = Field(default="MEDIUM")
    due_date: date


class TaskStatusUpdate(BaseModel):
    """Payload to update task status."""

    status: str


class TaskUpdate(BaseModel):
    """Payload to update task fields."""

    title: str | None = None
    description: str | None = None
    priority: str | None = None
    status: str | None = None
    due_date: date | None = None


# ============================================================================
# Enterprise Work Order & Employee Task Schemas
# ============================================================================


class WorkCategoryCreate(BaseModel):
    """Payload to create a work order category."""

    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=50)
    description: str | None = None
    default_priority: str = Field(default="NORMAL")
    checklist_template: list[dict] | None = None
    is_active: bool = True


class WorkCategoryUpdate(BaseModel):
    """Payload to update a work order category."""

    name: str | None = None
    description: str | None = None
    default_priority: str | None = None
    checklist_template: list[dict] | None = None
    is_active: bool | None = None


class WorkCategorySchema(BaseModel):
    """Catalog entry for work categories."""

    id: uuid.UUID
    name: str
    code: str
    description: str | None = None
    default_priority: str
    checklist_template: list[dict] | None = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("checklist_template", mode="after")
    @classmethod
    def sort_checklist_template(cls, v: list[dict] | None) -> list[dict] | None:
        if not v or not isinstance(v, list):
            return v
        return sorted(
            v,
            key=lambda x: (
                x.get("position", 0)
                if isinstance(x, dict) and isinstance(x.get("position"), (int, float))
                else 0
            ),
        )


class ChecklistItemCreate(BaseModel):
    """Payload to create a checklist item within a work order."""

    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    assigned_to_id: uuid.UUID | None = None
    due_date: datetime | None = None
    position: int = 0


class ChecklistItemUpdate(BaseModel):
    """Payload to update checklist item state or assignment."""

    title: str | None = None
    description: str | None = None
    assigned_to_id: uuid.UUID | None = None
    status: str | None = None  # PENDING, IN_PROGRESS, BLOCKED, COMPLETED
    is_completed: bool | None = None
    due_date: datetime | None = None
    notes: str | None = None


class ChecklistItemSchema(BaseModel):
    """Checklist item detail schema."""

    id: uuid.UUID
    work_order_id: uuid.UUID
    title: str
    description: str | None = None
    assigned_to_id: uuid.UUID | None = None
    assigned_to_name: str | None = None
    status: str
    position: int
    due_date: datetime | None = None
    completed_at: datetime | None = None
    completed_by_id: uuid.UUID | None = None
    completed_by_name: str | None = None
    notes: str | None = None
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_completed(self) -> bool:
        return self.status == "COMPLETED"

    model_config = ConfigDict(from_attributes=True)


class WorkOrderHistorySchema(BaseModel):
    """Audit history record for work order events."""

    id: uuid.UUID
    work_order_id: uuid.UUID
    actor_id: uuid.UUID
    actor_name: str | None = None
    action: str
    details: str | None = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkOrderCreate(BaseModel):
    """Sectioned payload to create a new enterprise work order."""

    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = None
    client_id: uuid.UUID | None = None
    new_client: NewClientInline | None = None
    category_id: uuid.UUID
    assigned_to_id: uuid.UUID | None = None
    priority: str = Field(default="NORMAL")  # URGENT, HIGH, NORMAL, LOW
    work_priority: str | None = None  # Do it in 2 to 3 days, Do it urgent, Do it next day, Do it today, Other
    custom_priority: str | None = None
    due_date: datetime
    priority_notes: str | None = None
    reminder_recipient_ids: list[uuid.UUID] = Field(default_factory=list)
    checklist_items: list[ChecklistItemCreate] = Field(default_factory=list)


class WorkOrderUpdate(BaseModel):
    """Payload to update work order attributes."""

    title: str | None = None
    description: str | None = None
    category_id: uuid.UUID | None = None
    assigned_to_id: uuid.UUID | None = None
    priority: str | None = None
    work_priority: str | None = None
    custom_priority: str | None = None
    status: str | None = None
    due_date: datetime | None = None
    priority_notes: str | None = None
    reminder_recipient_ids: list[uuid.UUID] | None = None


class WorkOrderStatusUpdate(BaseModel):
    """Payload for permitted status transitions."""

    status: str
    override_reason: str | None = None


class WorkOrderSummary(BaseModel):
    """Listing summary for work order queue with interactive checklist pipeline support."""

    id: uuid.UUID
    order_number: str
    title: str
    description: str | None = None
    client_id: uuid.UUID
    client_name: str | None = None
    client_email: str | None = None
    client_phone: str | None = None
    category_id: uuid.UUID
    category_name: str | None = None
    created_by_id: uuid.UUID
    created_by_name: str | None = None
    assigned_to_id: uuid.UUID | None = None
    assigned_to_name: str | None = None
    priority: str
    work_priority: str | None = None
    custom_priority: str | None = None
    status: str
    due_date: datetime
    completed_at: datetime | None = None
    progress_percent: int
    priority_notes: str | None = None
    checklist_count: int = 0
    checklist_completed: int = 0
    reminder_recipient_ids: list[uuid.UUID] = Field(default_factory=list)
    reminder_recipients: list[EligibleAssigneeSchema] = Field(default_factory=list)
    checklist_items: list[ChecklistItemSchema] = Field(default_factory=list)
    is_overdue: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkOrderDetail(WorkOrderSummary):
    """Complete work order 360 view with checklist items and audit history."""

    history: list[WorkOrderHistorySchema] = Field(default_factory=list)


class CrmNotificationSchema(BaseModel):
    """Notification alert for task assignments and deadline warnings."""

    id: uuid.UUID
    user_id: uuid.UUID
    work_order_id: uuid.UUID | None = None
    title: str
    message: str
    is_read: bool
    notification_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TeamMemberSummary(BaseModel):
    """Employee roster entry with active workload metrics."""

    id: uuid.UUID
    full_name: str
    email: str
    role: str
    is_active: bool
    active_workload_count: int = 0
    completed_workload_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class CrmDashboardMetrics(BaseModel):
    """Executive KPI card metrics calculated dynamically from database."""

    active_workload: int
    priority_actions: int
    critical_delays: int
    resolved_today: int
    total_clients: int
    team_members_active: int
