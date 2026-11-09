"""Finance CRM models for customer 360, financial profiling, notes, and tasks."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Uuid,
    desc,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Customer(Base):
    """Customer entity representing lending and financial operations leads."""

    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=True,
    )
    phone: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    pan_number: Mapped[str | None] = mapped_column(
        String(10),
        unique=True,
        index=True,
        nullable=True,
    )
    gender: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    date_of_birth: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    anniversary_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    state: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    city: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    pincode: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    customer_type: Mapped[str | None] = mapped_column(
        String(50),
        default="INDIVIDUAL",
        nullable=True,
    )
    # KYC Encryption & Privacy Fields
    aadhaar_encrypted: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    aadhaar_hash: Mapped[str | None] = mapped_column(
        String(64),
        index=True,
        nullable=True,
    )
    pan_encrypted: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    # Individual Customer Demographics & Financial Profile
    marital_status: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    nationality: Mapped[str | None] = mapped_column(
        String(50),
        default="Indian",
        nullable=True,
    )
    occupation: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    source_of_income: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    # Corporate Client Management Fields
    company_name: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )
    corporate_code: Mapped[str | None] = mapped_column(
        String(50),
        index=True,
        nullable=True,
    )
    gstin: Mapped[str | None] = mapped_column(
        String(15),
        index=True,
        nullable=True,
    )
    contact_person_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    contact_person_phone: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    contact_person_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    pipeline_status: Mapped[str] = mapped_column(
        String(40),
        default="NEW_LEAD",
        index=True,
        nullable=False,
    )
    reference_source: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        index=True,
        nullable=False,
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_officer_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    @property
    def full_name(self) -> str:
        """Helper property to return customer full name or corporate entity name."""
        if self.customer_type == "CORPORATE" and self.company_name:
            return self.company_name.strip()
        return f"{self.first_name} {self.last_name}".strip()

    # Relationships
    created_by: Mapped[User | None] = relationship(
        foreign_keys=[created_by_id],
    )
    assigned_officer: Mapped[User | None] = relationship(
        foreign_keys=[assigned_officer_id],
        back_populates="assigned_customers",
    )
    financial_profile: Mapped[FinancialProfile | None] = relationship(
        back_populates="customer",
        uselist=False,
        cascade="all, delete-orphan",
    )
    notes: Mapped[list[CustomerNote]] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    tasks: Mapped[list[Task]] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    documents: Mapped[list[Document]] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    work_orders: Mapped[list[WorkOrder]] = relationship(
        back_populates="client",
        cascade="all, delete-orphan",
    )


class FinancialProfile(Base):
    """Financial profile containing income, existing debt obligations, and credit rating."""

    __tablename__ = "financial_profiles"
    __table_args__ = (
        CheckConstraint(
            "monthly_income >= 0",
            name="chk_financial_profiles_monthly_income_positive",
        ),
        CheckConstraint(
            "monthly_obligations >= 0",
            name="chk_financial_profiles_monthly_obligations_positive",
        ),
        CheckConstraint(
            "cibil_score IS NULL OR (cibil_score >= 300 AND cibil_score <= 900)",
            name="chk_financial_profiles_cibil_score_range",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    employment_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    monthly_income: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    monthly_obligations: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    cibil_score: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    risk_tier: Mapped[str] = mapped_column(
        String(20),
        default="MEDIUM",
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    customer: Mapped[Customer] = relationship(
        back_populates="financial_profile",
    )


class CustomerNote(Base):
    """Interaction notes attached to a customer file by operations staff."""

    __tablename__ = "customer_notes"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    customer: Mapped[Customer] = relationship(
        back_populates="notes",
    )
    author: Mapped[User] = relationship(
        back_populates="authored_notes",
    )


class Task(Base):
    """SLA-bound operations tasks assigned to relationship officers."""

    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
    )
    assigned_to_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        default="MEDIUM",
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="PENDING",
        index=True,
        nullable=False,
    )
    due_date: Mapped[date] = mapped_column(
        Date,
        index=True,
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    customer: Mapped[Customer] = relationship(
        back_populates="tasks",
    )
    assigned_to: Mapped[User] = relationship(
        back_populates="assigned_tasks",
    )


class WorkCategory(Base):
    """Catalog of operational work order categories with default checklist templates."""

    __tablename__ = "work_categories"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    default_priority: Mapped[str] = mapped_column(
        String(20),
        default="NORMAL",
        nullable=False,
    )
    checklist_template: Mapped[list[dict] | None] = mapped_column(
        JSON,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    work_orders: Mapped[list[WorkOrder]] = relationship(
        back_populates="category",
    )


class WorkOrder(Base):
    """Enterprise work order tracking client service delivery and employee assignments."""

    __tablename__ = "work_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    order_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("work_categories.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        default="NORMAL",
        index=True,
        nullable=False,
    )  # URGENT, HIGH, NORMAL, LOW
    status: Mapped[str] = mapped_column(
        String(30),
        default="PENDING",
        index=True,
        nullable=False,
    )  # PENDING, IN_PROGRESS, REVIEW, COMPLETED, CANCELLED, BLOCKED
    due_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        index=True,
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    progress_percent: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    priority_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    work_priority: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    custom_priority: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    client: Mapped[Customer] = relationship(
        back_populates="work_orders",
    )
    category: Mapped[WorkCategory] = relationship(
        back_populates="work_orders",
    )
    created_by: Mapped[User] = relationship(
        foreign_keys=[created_by_id],
    )
    assigned_to: Mapped[User | None] = relationship(
        foreign_keys=[assigned_to_id],
    )
    reminder_recipients: Mapped[list[User]] = relationship(
        secondary="work_order_reminders",
        lazy="selectin",
    )
    checklist_items: Mapped[list[WorkOrderChecklistItem]] = relationship(
        back_populates="work_order",
        cascade="all, delete-orphan",
        order_by="WorkOrderChecklistItem.position",
    )
    history: Mapped[list[WorkOrderHistory]] = relationship(
        back_populates="work_order",
        cascade="all, delete-orphan",
        order_by=lambda: desc(WorkOrderHistory.timestamp),
    )


class WorkOrderReminder(Base):
    """Association table linking work orders to reminder recipient users."""

    __tablename__ = "work_order_reminders"

    work_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("work_orders.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class WorkOrderChecklistItem(Base):
    """Granular checklist task item within a work order."""

    __tablename__ = "work_order_checklist_items"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("work_orders.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="PENDING",
        index=True,
        nullable=False,
    )  # PENDING, IN_PROGRESS, BLOCKED, COMPLETED
    position: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    work_order: Mapped[WorkOrder] = relationship(
        back_populates="checklist_items",
    )
    assigned_to: Mapped[User | None] = relationship(
        foreign_keys=[assigned_to_id],
    )
    completed_by: Mapped[User | None] = relationship(
        foreign_keys=[completed_by_id],
    )


class WorkOrderHistory(Base):
    """Append-only audit trail logging all work order lifecycle events."""

    __tablename__ = "work_order_history"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("work_orders.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )  # CREATED, ASSIGNED, STATUS_CHANGED, CHECKLIST_UPDATED, UPDATED, COMPLETED, CANCELLED
    details: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        index=True,
        nullable=False,
    )

    # Relationships
    work_order: Mapped[WorkOrder] = relationship(
        back_populates="history",
    )
    actor: Mapped[User] = relationship()


class CrmNotification(Base):
    """In-app alert notification dispatched for task assignments and deadline alerts."""

    __tablename__ = "crm_notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("work_orders.id", ondelete="SET NULL"),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        index=True,
        nullable=False,
    )
    notification_type: Mapped[str] = mapped_column(
        String(50),
        default="TASK_ASSIGNED",
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        index=True,
        nullable=False,
    )

    # Relationships
    user: Mapped[User] = relationship()
    work_order: Mapped[WorkOrder | None] = relationship()


# Late imports for relationships
from app.db.models.auth import User  # noqa: E402
from app.db.models.documents import Document  # noqa: E402
