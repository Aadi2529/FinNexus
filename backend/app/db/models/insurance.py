"""Insurance Engine SQLAlchemy models for Master Data, Sub-Agents, Policies, Commissions, and Renewals."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import relationship as orm_relationship

from app.db.session import Base


class InsuranceCompany(Base):
    """Insurance Company entity (Company Master) representing underwriting carriers."""

    __tablename__ = "insurance_companies"
    __table_args__ = (
        Index("ix_insurance_companies_name_lower", "name"),
        Index("ix_insurance_companies_code_lower", "code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )
    category: Mapped[str] = mapped_column(
        String(50),
        default="Composite",
        nullable=False,
    )
    company_type: Mapped[str | None] = mapped_column(
        String(50),
        default="General Insurance",
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        index=True,
        nullable=False,
    )
    contact_person: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    phone: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    agent_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    agent_contact_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    agent_code: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    agent_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    tieup_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    tieup_renewal_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    renewal_team_contact: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    renewal_contact_person: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    renewal_contact_mobile: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    renewal_contact_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    claims_team_contact: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    claims_contact_person: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    claims_contact_mobile: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    claims_contact_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    kam_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    kam_mobile: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    kam_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    website: Mapped[str | None] = mapped_column(
        String(255),
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
    plans: Mapped[list[InsurancePlan]] = orm_relationship(
        back_populates="company",
        cascade="all, delete-orphan",
        passive_deletes=False,
        lazy="selectin",
    )
    policies: Mapped[list[InsurancePolicy]] = orm_relationship(
        back_populates="company",
    )
    documents: Mapped[list[InsuranceCompanyDocument]] = orm_relationship(
        back_populates="company",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    company_categories: Mapped[list[InsuranceCompanyCategory]] = orm_relationship(
        back_populates="company",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class InsuranceCompanyCategory(Base):
    """Normalized category/product-line mapping for underwriting insurance carriers."""

    __tablename__ = "insurance_company_categories"
    __table_args__ = (
        Index("ix_insurance_company_categories_company", "company_id"),
        Index("ix_insurance_company_categories_cat", "category"),
        UniqueConstraint("company_id", "category", name="uq_insurance_company_categories_company_cat"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )  # LIFE, HEALTH, MOTOR, TRAVEL, CORPORATE, etc.
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        index=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    company: Mapped[InsuranceCompany] = orm_relationship(
        back_populates="company_categories",
    )


class InsuranceCategory(Base):
    """Canonical master registry of insurance categories and product hierarchies."""

    __tablename__ = "insurance_categories"
    __table_args__ = (
        Index("ix_insurance_categories_code", "category_code", unique=True),
        Index("ix_insurance_categories_parent", "parent_category_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    category_code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )
    category_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    parent_category_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_categories.id", ondelete="CASCADE"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    icon: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class InsuranceCompanyDocument(Base):
    """Company tie-up contracts, SLAs, and compliance certificates."""

    __tablename__ = "insurance_company_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_companies.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    document_type: Mapped[str] = mapped_column(
        String(50),
        default="TIEUP_AGREEMENT",
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    storage_path: Mapped[str] = mapped_column(
        String(500),
        unique=True,
        nullable=False,
    )
    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    sha256_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    company: Mapped[InsuranceCompany] = orm_relationship(
        back_populates="documents",
    )


class InsurancePlan(Base):
    """Insurance Plan entity (Plan Master) representing specific insurance products."""

    __tablename__ = "insurance_plans"
    __table_args__ = (
        Index("ix_insurance_plans_name_lower", "name"),
        Index("ix_insurance_plans_code_lower", "code"),
        Index("ix_insurance_plans_lob", "line_of_business"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_companies.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    line_of_business: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )  # Life Insurance, Health Insurance, General/Motor
    plan_subcategory: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    motor_plan_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    sum_insured_min: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    sum_insured_max: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    policy_term_min_years: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    policy_term_max_years: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    waiting_period_months: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    eligibility_criteria: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="ACTIVE",
        index=True,
        nullable=False,
    )  # ACTIVE, INACTIVE
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    riders: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    benefits: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    brochure_filename: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    brochure_storage_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    brochure_mime_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    claim_form_filename: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    claim_form_storage_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    claim_form_mime_type: Mapped[str | None] = mapped_column(
        String(100),
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
    company: Mapped[InsuranceCompany] = orm_relationship(
        back_populates="plans",
        lazy="selectin",
    )
    policies: Mapped[list[InsurancePolicy]] = orm_relationship(
        back_populates="plan",
    )
    documents: Mapped[list[InsurancePlanDocument]] = orm_relationship(
        back_populates="plan",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    plan_riders: Mapped[list["InsurancePlanRider"]] = orm_relationship(
        "InsurancePlanRider",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="InsurancePlanRider.created_at",
        lazy="selectin",
    )
    plan_benefits: Mapped[list["InsurancePlanBenefit"]] = orm_relationship(
        "InsurancePlanBenefit",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="InsurancePlanBenefit.created_at",
        lazy="selectin",
    )


class InsurancePlanDocument(Base):
    """Plan brochures, wordings, claim forms, riders, premium charts, and other attachments."""

    __tablename__ = "insurance_plan_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_plans.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    document_type: Mapped[str] = mapped_column(
        String(50),
        default="POLICY_BROCHURE",
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
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    storage_path: Mapped[str] = mapped_column(
        String(500),
        unique=True,
        nullable=False,
    )
    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    sha256_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
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

    plan: Mapped[InsurancePlan] = orm_relationship(
        back_populates="documents",
    )
    uploaded_by: Mapped[User | None] = orm_relationship(
        foreign_keys=[uploaded_by_id],
        lazy="selectin",
    )


class InsurancePlanRider(Base):
    """Riders and add-on covers available under an insurance policy plan."""

    __tablename__ = "insurance_plan_riders"
    __table_args__ = (
        Index("ix_insurance_plan_riders_plan_id", "plan_id"),
        UniqueConstraint("plan_id", "name", name="uq_insurance_plan_riders_plan_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_plans.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
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
    plan: Mapped["InsurancePlan"] = orm_relationship(
        back_populates="plan_riders",
    )


class InsurancePlanBenefit(Base):
    """Coverage benefits and key highlights available under an insurance policy plan."""

    __tablename__ = "insurance_plan_benefits"
    __table_args__ = (
        Index("ix_insurance_plan_benefits_plan_id", "plan_id"),
        UniqueConstraint("plan_id", "name", name="uq_insurance_plan_benefits_plan_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_plans.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
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
    plan: Mapped["InsurancePlan"] = orm_relationship(
        back_populates="plan_benefits",
    )

class InsurancePurchaseParty(Base):
    """Purchase Party entity from whom the agent or IMF sources insurance policies."""

    __tablename__ = "insurance_purchase_parties"
    __table_args__ = (
        Index("ix_insurance_purchase_parties_name_lower", "name"),
        Index("ix_insurance_purchase_parties_code_lower", "code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )
    contact_person: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    phone: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        index=True,
        nullable=False,
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

    policies: Mapped[list[InsurancePolicy]] = orm_relationship(
        back_populates="purchase_party",
    )


class InsuranceSubAgent(Base):
    """Sub-Agent or POSP entity who sources insurance contracts."""

    __tablename__ = "insurance_sub_agents"
    __table_args__ = (
        Index("ix_insurance_sub_agents_name_lower", "full_name"),
        Index("ix_insurance_sub_agents_code_lower", "agent_code"),
        Index("ix_insurance_sub_agents_slug", "public_profile_slug"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    full_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    agent_code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )
    mobile: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    joining_date: Mapped[date] = mapped_column(
        Date,
        default=date.today,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="ACTIVE",
        index=True,
        nullable=False,
    )  # ACTIVE, INACTIVE
    parent_firm: Mapped[str] = mapped_column(
        String(150),
        default="FinNexus Enterprise",
        nullable=False,
    )
    parent_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_sub_agents.id", ondelete="SET NULL"),
        nullable=True,
    )
    public_profile_slug: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )
    bio: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    specialties: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    show_contact_info: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
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
    parent_agent: Mapped[InsuranceSubAgent | None] = orm_relationship(
        remote_side=[id],
        foreign_keys=[parent_agent_id],
    )
    sub_agents: Mapped[list[InsuranceSubAgent]] = orm_relationship(
        foreign_keys=[parent_agent_id],
        overlaps="parent_agent",
    )
    commission_splits: Mapped[list[InsuranceCommissionSplitConfig]] = orm_relationship(
        back_populates="sub_agent",
        cascade="all, delete-orphan",
    )
    policies: Mapped[list[InsurancePolicy]] = orm_relationship(
        back_populates="sub_agent",
    )
    commissions: Mapped[list[InsurancePolicyCommission]] = orm_relationship(
        back_populates="sub_agent",
    )
    payouts: Mapped[list["InsuranceSubAgentPayout"]] = orm_relationship(
        back_populates="sub_agent",
        cascade="all, delete-orphan",
    )
    inquiries: Mapped[list[InsuranceAgentInquiry]] = orm_relationship(
        back_populates="sub_agent",
        cascade="all, delete-orphan",
    )


class InsuranceCompanyCommissionAgreement(Base):
    """Insurer commission agreement defining first-year, renewal, TDS, and commissionable basis."""

    __tablename__ = "insurance_company_commission_agreements"
    __table_args__ = (
        Index("ix_insurance_company_commission_agreements_company", "company_id"),
        Index("ix_insurance_company_commission_agreements_category", "policy_category"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    policy_category: Mapped[str] = mapped_column(
        String(50),
        default="ALL",
        nullable=False,
    )  # ALL, HEALTH, LIFE, MOTOR, TRAVEL
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_plans.id", ondelete="SET NULL"),
        nullable=True,
    )
    first_year_commission_rate: Mapped[Decimal] = mapped_column(
        Numeric(6, 2),
        nullable=False,
    )
    renewal_commission_rate: Mapped[Decimal] = mapped_column(
        Numeric(6, 2),
        default=Decimal("7.50"),
        nullable=False,
    )
    special_commission_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    commissionable_basis: Mapped[str] = mapped_column(
        String(50),
        default="NET_PREMIUM",
        nullable=False,
    )  # NET_PREMIUM, GROSS_PREMIUM, BASE_PREMIUM
    tds_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        default=Decimal("10.00"),
        nullable=False,
    )
    effective_from: Mapped[date] = mapped_column(
        Date,
        default=date.today,
        nullable=False,
    )
    effective_to: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    company: Mapped[InsuranceCompany] = orm_relationship(
        lazy="selectin",
    )
    plan: Mapped[InsurancePlan | None] = orm_relationship(
        lazy="selectin",
    )


class InsuranceCommissionSplitConfig(Base):
    """Commission-sharing agreement between firm and sub-agent."""

    __tablename__ = "insurance_commission_splits"
    __table_args__ = (
        Index("ix_insurance_commission_splits_agent", "sub_agent_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    sub_agent_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_sub_agents.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_plans.id", ondelete="SET NULL"),
        nullable=True,
    )
    split_type: Mapped[str] = mapped_column(
        String(20),
        default="PERCENTAGE",
        nullable=False,
    )  # PERCENTAGE, FIXED
    split_value: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    effective_date: Mapped[date] = mapped_column(
        Date,
        default=date.today,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    policy_category: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    commission_type: Mapped[str] = mapped_column(
        String(30),
        default="ALL",
        nullable=False,
    )  # ALL, FIRST_YEAR, RENEWAL, SPECIAL
    allocation_basis: Mapped[str] = mapped_column(
        String(50),
        default="GROSS_COMMISSION",
        nullable=False,
    )  # GROSS_COMMISSION, NET_COMMISSION, FIXED_PER_POLICY
    effective_to: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    recipient_type: Mapped[str] = mapped_column(
        String(50),
        default="SUB_AGENT",
        nullable=False,
    )
    tds_deduction_type: Mapped[str] = mapped_column(
        String(50),
        default="DEDUCT_AT_SOURCE",
        nullable=False,
    )
    agreement_status: Mapped[str] = mapped_column(
        String(30),
        default="ACTIVE",
        nullable=False,
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

    sub_agent: Mapped[InsuranceSubAgent] = orm_relationship(
        back_populates="commission_splits",
    )
    company: Mapped[InsuranceCompany | None] = orm_relationship()
    plan: Mapped[InsurancePlan | None] = orm_relationship()


class InsuranceFamilyGroup(Base):
    """Family household grouping related clients under a Primary Head."""

    __tablename__ = "insurance_family_groups"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    head_customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    head_customer: Mapped[Customer] = orm_relationship(
        foreign_keys=[head_customer_id],
        lazy="selectin",
    )
    members: Mapped[list[InsuranceFamilyMember]] = orm_relationship(
        back_populates="family_group",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class InsuranceFamilyMember(Base):
    """Family member mapping within a family group."""

    __tablename__ = "insurance_family_members"
    __table_args__ = (
        Index("ix_insurance_family_members_cust", "customer_id", unique=True),
        Index("ix_insurance_family_members_group", "family_group_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    family_group_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_family_groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    relation_type: Mapped[str] = mapped_column(
        "relationship",
        String(50),
        nullable=False,
    )  # Column named "relationship" in DB, mapped to attribute relation_type!
    notes: Mapped[str | None] = mapped_column(
        Text,
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

    family_group: Mapped[InsuranceFamilyGroup] = orm_relationship(
        back_populates="members",
    )
    customer: Mapped[Customer] = orm_relationship(
        lazy="selectin",
    )


class InsurancePolicy(Base):
    """Registered insurance contract with policy mapping, coverage, and schedules."""

    __tablename__ = "insurance_policies"
    __table_args__ = (
        Index("ix_insurance_policies_number", "policy_number", unique=True),
        Index("ix_insurance_policies_status", "status"),
        Index("ix_insurance_policies_customer", "customer_id"),
        Index("ix_insurance_policies_company", "company_id"),
        Index("ix_insurance_policies_plan", "plan_id"),
        Index("ix_insurance_policies_expiry", "expiry_date"),
        Index("ix_insurance_policies_next_due", "next_premium_due_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    policy_number: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
    )
    policy_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )  # Life, Health, Motor, Corporate
    coverage_type: Mapped[str] = mapped_column(
        String(30),
        default="INDIVIDUAL",
        nullable=False,
    )  # INDIVIDUAL, FAMILY_FLOATER
    proposal_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    business_type: Mapped[str] = mapped_column(
        String(20),
        default="NEW",
        nullable=False,
    )  # NEW, PORT, RENEW
    previous_policy_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_policies.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    previous_policy_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    previous_insurer: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    portability_continuity_details: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    product_variant: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    hospital_cash_benefit: Mapped[str] = mapped_column(
        String(30),
        default="NOT_APPLICABLE",
        nullable=False,
    )  # INCLUDED, NOT_INCLUDED, NOT_APPLICABLE
    vehicle_registration_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    vehicle_manufacturer: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    vehicle_model: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    vehicle_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    travel_destination: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    travel_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    intermediary_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    contact_city: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    contact_pincode: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    contact_mobile: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )
    contact_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    commission_received_status: Mapped[str] = mapped_column(
        String(30),
        default="PENDING",
        nullable=False,
    )  # PENDING, RECEIVED, NOT_RECEIVED
    actual_commission_received_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    commission_received_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    commission_bank_reference: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_companies.id", ondelete="RESTRICT"),
        nullable=False,
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_plans.id", ondelete="RESTRICT"),
        nullable=False,
    )
    purchase_party_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_purchase_parties.id", ondelete="SET NULL"),
        nullable=True,
    )
    sub_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_sub_agents.id", ondelete="SET NULL"),
        nullable=True,
    )
    term_years: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    sum_assured: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    final_premium: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    net_premium: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    tax_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )

    @property
    def gross_premium(self) -> Decimal:
        return self.final_premium
    is_single_premium: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    premium_mode: Mapped[str] = mapped_column(
        String(30),
        default="Yearly",
        nullable=False,
    )  # Monthly, Quarterly, Half-Yearly, Yearly, Single
    issue_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        index=True,
    )
    policy_start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    first_receipt_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    expiry_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    next_premium_due_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="ACTIVE",
        nullable=False,
    )  # ACTIVE, INACTIVE, LAPSED, CANCELLED, EXPIRED
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
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
    customer: Mapped[Customer] = orm_relationship(
        lazy="selectin",
    )
    company: Mapped[InsuranceCompany] = orm_relationship(
        back_populates="policies",
        lazy="selectin",
    )
    plan: Mapped[InsurancePlan] = orm_relationship(
        back_populates="policies",
        lazy="selectin",
    )
    purchase_party: Mapped[InsurancePurchaseParty | None] = orm_relationship(
        back_populates="policies",
        lazy="selectin",
    )
    sub_agent: Mapped[InsuranceSubAgent | None] = orm_relationship(
        back_populates="policies",
        lazy="selectin",
    )
    created_by: Mapped[User | None] = orm_relationship()
    payments: Mapped[list[InsurancePolicyPayment]] = orm_relationship(
        back_populates="policy",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    premium_schedules: Mapped[list[InsurancePremiumSchedule]] = orm_relationship(
        back_populates="policy",
        cascade="all, delete-orphan",
        order_by="InsurancePremiumSchedule.installment_number",
        lazy="selectin",
    )
    commissions: Mapped[list[InsurancePolicyCommission]] = orm_relationship(
        back_populates="policy",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    sub_agent_payouts: Mapped[list["InsuranceSubAgentPayout"]] = orm_relationship(
        back_populates="policy",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    nominees: Mapped[list[InsurancePolicyNominee]] = orm_relationship(
        back_populates="policy",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    members: Mapped[list[InsurancePolicyMember]] = orm_relationship(
        back_populates="policy",
        cascade="all, delete-orphan",
        order_by="InsurancePolicyMember.created_at",
        lazy="selectin",
    )
    policy_riders: Mapped[list["InsurancePolicyRider"]] = orm_relationship(
        "InsurancePolicyRider",
        back_populates="policy",
        cascade="all, delete-orphan",
        order_by="InsurancePolicyRider.created_at",
        lazy="selectin",
    )
    documents: Mapped[list[InsurancePolicyDocument]] = orm_relationship(
        back_populates="policy",
        cascade="all, delete-orphan",
        order_by="InsurancePolicyDocument.created_at.desc()",
        lazy="selectin",
    )
    policy_years: Mapped[list[InsurancePolicyYear]] = orm_relationship(
        back_populates="policy",
        cascade="all, delete-orphan",
        order_by="InsurancePolicyYear.policy_year",
        lazy="selectin",
    )
    policy_history: Mapped[list[InsurancePolicyHistory]] = orm_relationship(
        "InsurancePolicyHistory",
        primaryjoin="InsurancePolicy.id == InsurancePolicyHistory.current_policy_id",
        back_populates="policy",
        cascade="all, delete-orphan",
        order_by="InsurancePolicyHistory.history_sequence",
        lazy="selectin",
    )
    previous_policy: Mapped[InsurancePolicy | None] = orm_relationship(
        "InsurancePolicy",
        remote_side="InsurancePolicy.id",
        foreign_keys=[previous_policy_id],
        back_populates="renewals",
        lazy="noload",
    )
    renewals: Mapped[list[InsurancePolicy]] = orm_relationship(
        "InsurancePolicy",
        foreign_keys=[previous_policy_id],
        back_populates="previous_policy",
        lazy="noload",
    )


class InsurancePolicyDocument(Base):
    """Specific documents attached to an issued policy contract (certificates, receipts, KYC, medical reports, endorsements)."""

    __tablename__ = "insurance_policy_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    policy_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_policies.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    document_type: Mapped[str] = mapped_column(
        String(50),
        default="OFFICIAL_POLICY_CERTIFICATE",
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
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    storage_path: Mapped[str] = mapped_column(
        String(500),
        unique=True,
        nullable=False,
    )
    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    sha256_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
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

    policy: Mapped[InsurancePolicy] = orm_relationship(
        back_populates="documents",
    )
    uploaded_by: Mapped[User | None] = orm_relationship(
        foreign_keys=[uploaded_by_id],
        lazy="selectin",
    )


class InsurancePolicyYear(Base):
    """Normalized multi-year policy contract details for multi-year policies."""

    __tablename__ = "insurance_policy_years"
    __table_args__ = (
        Index("ix_insurance_policy_years_policy", "policy_id"),
        Index("ix_insurance_policy_years_number", "policy_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    policy_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_policies.id", ondelete="CASCADE"),
        nullable=False,
    )
    policy_year: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    policy_number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    proposal_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    business_type: Mapped[str] = mapped_column(
        String(50),
        default="NEW",
        nullable=False,
    )
    prior_policy_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    product_variant: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    end_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    net_premium: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    gross_premium: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    remarks: Mapped[str | None] = mapped_column(
        Text,
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

    policy: Mapped[InsurancePolicy] = orm_relationship(
        back_populates="policy_years",
    )


class InsurancePolicyHistory(Base):
    """Normalized policy history chain representing past coverage (Last Year, Last-to-Last Year, Earlier)."""

    __tablename__ = "insurance_policy_histories"
    __table_args__ = (
        Index("ix_insurance_policy_histories_current_policy", "current_policy_id"),
        Index("ix_insurance_policy_histories_prev_policy", "previous_policy_id"),
        Index("ix_insurance_policy_histories_company", "insurance_company_name"),
        Index("ix_insurance_policy_histories_number", "previous_policy_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    current_policy_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_policies.id", ondelete="CASCADE"),
        nullable=False,
    )
    previous_policy_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_policies.id", ondelete="SET NULL"),
        nullable=True,
    )
    insurance_company_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    previous_policy_number: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    policy_business_type: Mapped[str] = mapped_column(
        String(50),
        default="PORT",
        nullable=False,
    )
    history_sequence: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    policy_start_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    policy_expiry_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    sum_insured: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    net_premium: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    gross_premium: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    product_variant: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    policy_status: Mapped[str | None] = mapped_column(
        String(50),
        default="EXPIRED",
        nullable=True,
    )
    claim_history: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    insurer_contact: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    cumulative_bonus: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    continuity_details: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    waiting_period_waiver_details: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    is_external_policy: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
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

    policy: Mapped[InsurancePolicy] = orm_relationship(
        "InsurancePolicy",
        foreign_keys=[current_policy_id],
        back_populates="policy_history",
    )
    previous_policy: Mapped[InsurancePolicy | None] = orm_relationship(
        "InsurancePolicy",
        foreign_keys=[previous_policy_id],
        lazy="selectin",
    )


class InsurancePolicyPayment(Base):
    """Separate ledger of payment transactions for insurance policies."""

    __tablename__ = "insurance_policy_payments"
    __table_args__ = (
        Index("ix_insurance_policy_payments_policy", "policy_id"),
        Index("ix_insurance_policy_payments_date", "payment_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    policy_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_policies.id", ondelete="CASCADE"),
        nullable=False,
    )
    premium_schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_premium_schedules.id", ondelete="SET NULL"),
        nullable=True,
    )
    payment_mode: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )  # Cash, Cheque, Online, Bank Transfer
    bank_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    transaction_reference: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    first_receipt_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    payment_date: Mapped[date] = mapped_column(
        Date,
        default=date.today,
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="COMPLETED",
        nullable=False,
    )  # COMPLETED, PENDING, FAILED, REVERSED
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_policy_documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    document_filename: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    policy: Mapped[InsurancePolicy] = orm_relationship(
        back_populates="payments",
    )
    premium_schedule: Mapped[InsurancePremiumSchedule | None] = orm_relationship(
        back_populates="payments",
        foreign_keys=[premium_schedule_id],
    )
    document: Mapped[InsurancePolicyDocument | None] = orm_relationship(
        foreign_keys=[document_id],
        lazy="selectin",
    )


class InsurancePremiumSchedule(Base):
    """Installment schedule for premium collections with real database-backed states."""

    __tablename__ = "insurance_premium_schedules"
    __table_args__ = (
        Index("ix_insurance_premium_schedules_policy", "policy_id"),
        Index("ix_insurance_premium_schedules_due", "due_date"),
        Index("ix_insurance_premium_schedules_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    policy_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_policies.id", ondelete="CASCADE"),
        nullable=False,
    )
    installment_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    due_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="UPCOMING",
        nullable=False,
    )  # DUE_TODAY, UPCOMING, OVERDUE, PAID, EXPIRED
    paid_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    @property
    def installment_amount(self) -> Decimal:
        return self.amount
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

    policy: Mapped[InsurancePolicy] = orm_relationship(
        back_populates="premium_schedules",
    )
    payments: Mapped[list[InsurancePolicyPayment]] = orm_relationship(
        back_populates="premium_schedule",
        foreign_keys=[InsurancePolicyPayment.premium_schedule_id],
    )


class InsurancePolicyCommission(Base):
    """Commission record capturing firm and sub-agent split allocation."""

    __tablename__ = "insurance_policy_commissions"
    __table_args__ = (
        Index("ix_insurance_policy_commissions_policy", "policy_id"),
        Index("ix_insurance_policy_commissions_agent", "sub_agent_id"),
        Index("ix_insurance_policy_commissions_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    policy_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_policies.id", ondelete="CASCADE"),
        nullable=False,
    )
    sub_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_sub_agents.id", ondelete="SET NULL"),
        nullable=True,
    )
    commission_type: Mapped[str] = mapped_column(
        String(30),
        default="FIRST_YEAR",
        nullable=False,
    )  # FIRST_YEAR, RENEWAL
    gross_commission_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    gross_commission_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    sub_agent_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    firm_net_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    net_premium_applied: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    tds_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        default=Decimal("10.00"),
        nullable=True,
    )
    tds_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=True,
    )
    net_commission_payable: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    sub_agent_tds_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    sub_agent_tds_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    sub_agent_net_payout: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    firm_tds_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    firm_net_bank_credit: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    calculation_source: Mapped[str | None] = mapped_column(
        String(50),
        default="RULE_AGREEMENT",
        nullable=True,
    )
    override_reason: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    bank_reference: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    split_rule_applied: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="PENDING",
        nullable=False,
    )  # PENDING, APPROVED, PAID, REVERSED
    payment_date: Mapped[date | None] = mapped_column(
        Date,
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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    policy_category: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    expected_receipt_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    actual_gross_received: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    actual_tds_deducted: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    actual_net_received: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    reconciliation_difference: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    reconciliation_status: Mapped[str] = mapped_column(
        String(30),
        default="UNRECONCILED",
        nullable=False,
    )  # UNRECONCILED, PARTIALLY_RECONCILED, RECONCILED, SHORT_PAYMENT, EXCESS_PAYMENT
    recipient_type: Mapped[str] = mapped_column(
        String(50),
        default="MAIN_FIRM",
        nullable=False,
    )
    allocation_basis: Mapped[str] = mapped_column(
        String(50),
        default="GROSS_COMMISSION",
        nullable=False,
    )
    commission_agreement_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_company_commission_agreements.id", ondelete="SET NULL"),
        nullable=True,
    )
    split_agreement_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_commission_splits.id", ondelete="SET NULL"),
        nullable=True,
    )
    agreement_snapshot: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    approval_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    reversed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reversed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    reversal_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    reversal_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    original_commission_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_policy_commissions.id", ondelete="SET NULL"),
        nullable=True,
    )
    actual_commission_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    actual_tds_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    bank_account: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    balance_receivable: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    policy: Mapped[InsurancePolicy] = orm_relationship(
        back_populates="commissions",
    )
    sub_agent: Mapped[InsuranceSubAgent | None] = orm_relationship(
        back_populates="commissions",
    )
    approved_by: Mapped[User | None] = orm_relationship(
        foreign_keys=[approved_by_id],
        lazy="selectin",
    )
    reversed_by: Mapped[User | None] = orm_relationship(
        foreign_keys=[reversed_by_id],
        lazy="selectin",
    )
    receipts: Mapped[list["InsuranceCommissionReceipt"]] = orm_relationship(
        back_populates="commission",
        cascade="all, delete-orphan",
        order_by="InsuranceCommissionReceipt.receipt_date.desc()",
        lazy="selectin",
    )
    sub_agent_payouts: Mapped[list["InsuranceSubAgentPayout"]] = orm_relationship(
        back_populates="commission",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class InsuranceCommissionReceipt(Base):
    """Actual bank receipt and financial reconciliation record against a commission."""

    __tablename__ = "insurance_commission_receipts"
    __table_args__ = (
        Index("ix_insurance_commission_receipts_commission", "commission_id"),
        Index("ix_insurance_commission_receipts_date", "receipt_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    commission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_policy_commissions.id", ondelete="CASCADE"),
        nullable=False,
    )
    receipt_date: Mapped[date] = mapped_column(
        Date,
        default=date.today,
        nullable=False,
    )
    gross_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    tds_deducted: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    net_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    actual_bank_received: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    payment_mode: Mapped[str] = mapped_column(
        String(50),
        default="NEFT",
        nullable=False,
    )  # NEFT, RTGS, IMPS, UPI, CHEQUE, BANK_TRANSFER
    bank_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    transaction_reference: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    tds_certificate_ref: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    receipt_type: Mapped[str] = mapped_column(
        String(50),
        default="PARTIAL_PAYMENT",
        nullable=False,
    )  # FULL_PAYMENT, PARTIAL_PAYMENT, TDS_ADJUSTMENT, SHORT_PAYMENT, EXCESS_PAYMENT, CLAWBACK
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    supporting_document_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    actual_commission_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    actual_tds_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    bank_account: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    recorded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
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

    commission: Mapped[InsurancePolicyCommission] = orm_relationship(
        back_populates="receipts",
    )
    recorded_by: Mapped[User | None] = orm_relationship(
        foreign_keys=[recorded_by_id],
        lazy="selectin",
    )


class InsuranceSubAgentPayout(Base):
    """Sub-agent commission payout obligation, lifecycle, and payment ledger."""

    __tablename__ = "insurance_sub_agent_payouts"
    __table_args__ = (
        Index("ix_insurance_sub_agent_payouts_policy", "policy_id"),
        Index("ix_insurance_sub_agent_payouts_commission", "commission_id"),
        Index("ix_insurance_sub_agent_payouts_agent", "sub_agent_id"),
        Index("ix_insurance_sub_agent_payouts_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    policy_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_policies.id", ondelete="CASCADE"),
        nullable=False,
    )
    commission_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_policy_commissions.id", ondelete="SET NULL"),
        nullable=True,
    )
    sub_agent_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_sub_agents.id", ondelete="RESTRICT"),
        nullable=False,
    )
    commission_type: Mapped[str] = mapped_column(
        String(30),
        default="FIRST_YEAR",
        nullable=False,
    )  # FIRST_YEAR, RENEWAL
    insurer_gross_commission: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    agreed_percentage: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    payable_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    tds_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        default=Decimal("5.00"),
        nullable=True,
    )
    tds_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=True,
    )
    net_payable_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    amount_paid: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    remaining_payable: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="PENDING",
        nullable=False,
    )  # PENDING, APPROVED, PARTIALLY_PAID, PAID, ON_HOLD, REVERSED
    payout_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    split_rule_applied: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    split_agreement_snapshot: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    on_hold_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    approval_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    reversed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reversed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    reversal_reason: Mapped[str | None] = mapped_column(
        Text,
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

    policy: Mapped["InsurancePolicy"] = orm_relationship(
        back_populates="sub_agent_payouts",
    )
    commission: Mapped[InsurancePolicyCommission | None] = orm_relationship(
        back_populates="sub_agent_payouts",
    )
    sub_agent: Mapped["InsuranceSubAgent"] = orm_relationship(
        back_populates="payouts",
        lazy="selectin",
    )
    approved_by: Mapped[User | None] = orm_relationship(
        foreign_keys=[approved_by_id],
        lazy="selectin",
    )
    reversed_by: Mapped[User | None] = orm_relationship(
        foreign_keys=[reversed_by_id],
        lazy="selectin",
    )
    payments: Mapped[list["InsuranceSubAgentPayoutPayment"]] = orm_relationship(
        back_populates="payout",
        cascade="all, delete-orphan",
        order_by="InsuranceSubAgentPayoutPayment.payment_date.desc()",
        lazy="selectin",
    )


class InsuranceSubAgentPayoutPayment(Base):
    """Outgoing disbursement record made to sub-agent against a payout obligation."""

    __tablename__ = "insurance_sub_agent_payout_payments"
    __table_args__ = (
        Index("ix_insurance_sub_agent_payout_payments_payout", "payout_id"),
        Index("ix_insurance_sub_agent_payout_payments_date", "payment_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    payout_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_sub_agent_payouts.id", ondelete="CASCADE"),
        nullable=False,
    )
    payment_date: Mapped[date] = mapped_column(
        Date,
        default=date.today,
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    tds_deducted: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    net_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    payment_method: Mapped[str] = mapped_column(
        String(50),
        default="BANK_TRANSFER",
        nullable=False,
    )  # BANK_TRANSFER, UPI, CASH, CHEQUE
    bank_account_details: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    transaction_reference: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    payment_proof_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    recorded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
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

    payout: Mapped[InsuranceSubAgentPayout] = orm_relationship(
        back_populates="payments",
    )
    recorded_by: Mapped[User | None] = orm_relationship(
        foreign_keys=[recorded_by_id],
        lazy="selectin",
    )




class InsurancePolicyNominee(Base):
    """Nominee mapped to an insurance policy contract."""

    __tablename__ = "insurance_policy_nominees"
    __table_args__ = (
        Index("ix_insurance_policy_nominees_policy_id", "policy_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    policy_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_policies.id", ondelete="CASCADE"),
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    relationship: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    date_of_birth: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    mobile_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    share_percentage: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        default=Decimal("100.00"),
        nullable=False,
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

    policy: Mapped[InsurancePolicy] = orm_relationship(
        back_populates="nominees",
    )


class InsurancePolicyMember(Base):
    """Insured member / covered person linked to an insurance policy contract."""

    __tablename__ = "insurance_policy_members"
    __table_args__ = (
        Index("ix_insurance_policy_members_policy_id", "policy_id"),
        Index("ix_insurance_policy_members_customer_id", "customer_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    policy_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_policies.id", ondelete="CASCADE"),
        nullable=False,
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
    )
    full_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    relationship: Mapped[str] = mapped_column(
        String(50),
        default="SELF",
        nullable=False,
    )  # SELF, SPOUSE, SON, DAUGHTER, FATHER, MOTHER, FATHER_IN_LAW, MOTHER_IN_LAW, BROTHER, SISTER, OTHER
    date_of_birth: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    gender: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )  # MALE, FEMALE, OTHER
    mobile_number: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    member_code: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    individual_sum_insured: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    policy: Mapped[InsurancePolicy] = orm_relationship(
        back_populates="members",
    )
    customer: Mapped[Customer | None] = orm_relationship(
        lazy="selectin",
    )


class InsurancePolicyRider(Base):
    """Riders chosen and attached to a specific issued insurance policy contract."""

    __tablename__ = "insurance_policy_riders"
    __table_args__ = (
        Index("ix_insurance_policy_riders_policy_id", "policy_id"),
        Index("ix_insurance_policy_riders_rider_id", "rider_id"),
        UniqueConstraint("policy_id", "rider_id", name="uq_insurance_policy_riders_policy_rider"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    policy_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_policies.id", ondelete="CASCADE"),
        nullable=False,
    )
    rider_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_plan_riders.id", ondelete="SET NULL"),
        nullable=True,
    )
    rider_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    rider_description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    policy: Mapped["InsurancePolicy"] = orm_relationship(
        back_populates="policy_riders",
    )
    rider: Mapped[InsurancePlanRider | None] = orm_relationship(
        lazy="selectin",
    )


class InsuranceAgentInquiry(Base):
    """Customer inquiry lead and sales CRM entity."""

    __tablename__ = "insurance_agent_inquiries"
    __table_args__ = (
        Index("ix_insurance_agent_inquiries_agent", "sub_agent_id"),
        Index("ix_insurance_agent_inquiries_status", "status"),
        Index("ix_insurance_agent_inquiries_lead_number", "lead_number", unique=True),
        Index("ix_insurance_agent_inquiries_assigned_user", "assigned_user_id"),
        Index("ix_insurance_agent_inquiries_follow_up", "next_follow_up_date"),
        Index("ix_insurance_agent_inquiries_mobile", "mobile"),
        Index("ix_insurance_agent_inquiries_email", "email"),
        Index("ix_insurance_agent_inquiries_lead_source", "lead_source"),
        Index("ix_insurance_agent_inquiries_tenant", "tenant_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    lead_number: Mapped[str | None] = mapped_column(
        String(50),
        unique=True,
        nullable=True,
    )
    sub_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_sub_agents.id", ondelete="CASCADE"),
        nullable=True,
    )
    full_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    mobile: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    alternate_mobile: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    lead_type: Mapped[str] = mapped_column(
        String(30),
        default="INDIVIDUAL",
        nullable=False,
    )  # INDIVIDUAL, CORPORATE
    company_name: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )
    gstin: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    policy_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )  # Health, Life, Motor, Travel, Fire, Home, Marine, Other
    message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    consent: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="NEW",
        nullable=False,
    )  # 12 statuses: NEW, CONTACTED, INTERESTED, REQUIREMENT_COLLECTED, etc.
    priority: Mapped[str] = mapped_column(
        String(20),
        default="NORMAL",
        nullable=False,
    )  # LOW, NORMAL, HIGH, URGENT
    lead_source: Mapped[str] = mapped_column(
        String(50),
        default="PUBLIC_PROFILE",
        nullable=False,
    )  # WEBSITE, WHATSAPP, PHONE_CALL, WALK_IN, REFERRAL, etc.
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    date_of_birth: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    gender: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    occupation: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    address_line_2: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    city: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    state: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    pincode: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    preferred_company_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    preferred_plan_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_plans.id", ondelete="SET NULL"),
        nullable=True,
    )
    sum_insured: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    expected_premium: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )
    coverage_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    member_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    existing_insurance: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    existing_policy_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    existing_policy_expiry: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    campaign_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    referral_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    requirement_description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    next_follow_up_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
    )
    converted_policy_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_policies.id", ondelete="SET NULL"),
        nullable=True,
    )
    lost_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    tenant_id: Mapped[str | None] = mapped_column(
        String(100),
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
    sub_agent: Mapped[InsuranceSubAgent | None] = orm_relationship(
        back_populates="inquiries",
    )
    assigned_user: Mapped[User | None] = orm_relationship(
        foreign_keys=[assigned_user_id],
    )
    preferred_company: Mapped[InsuranceCompany | None] = orm_relationship(
        foreign_keys=[preferred_company_id],
    )
    preferred_plan: Mapped[InsurancePlan | None] = orm_relationship(
        foreign_keys=[preferred_plan_id],
    )
    customer: Mapped[Customer | None] = orm_relationship(
        foreign_keys=[customer_id],
    )
    converted_policy: Mapped[InsurancePolicy | None] = orm_relationship(
        foreign_keys=[converted_policy_id],
    )
    activities: Mapped[list[InsuranceLeadActivity]] = orm_relationship(
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="InsuranceLeadActivity.created_at.desc()",
        lazy="selectin",
    )
    notes: Mapped[list[InsuranceLeadNote]] = orm_relationship(
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="InsuranceLeadNote.created_at.desc()",
        lazy="selectin",
    )
    reminders: Mapped[list[InsuranceLeadReminder]] = orm_relationship(
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="InsuranceLeadReminder.reminder_date.asc()",
        lazy="selectin",
    )
    quotations: Mapped[list[HealthQuotation]] = orm_relationship(
        back_populates="lead",
        foreign_keys="HealthQuotation.lead_id",
        order_by="HealthQuotation.created_at.desc()",
        lazy="selectin",
    )


class InsuranceLeadActivity(Base):
    """Activity and audit event stream for a sales CRM lead."""

    __tablename__ = "insurance_lead_activities"
    __table_args__ = (
        Index("ix_insurance_lead_activities_lead_id", "lead_id"),
        Index("ix_insurance_lead_activities_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    lead_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_agent_inquiries.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    user_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    activity_type: Mapped[str] = mapped_column(
        String(50),
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
    old_value: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    new_value: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    lead: Mapped[InsuranceAgentInquiry] = orm_relationship(
        back_populates="activities",
    )
    user: Mapped[User | None] = orm_relationship(
        foreign_keys=[user_id],
    )

    @property
    def action_type(self) -> str:
        return self.activity_type

    @property
    def actor_name(self) -> str | None:
        return self.user_name


class InsuranceLeadNote(Base):
    """Internal team notes and customer discussion logs on a lead."""

    __tablename__ = "insurance_lead_notes"
    __table_args__ = (
        Index("ix_insurance_lead_notes_lead_id", "lead_id"),
        Index("ix_insurance_lead_notes_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    lead_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_agent_inquiries.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    author_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    title: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    note_type: Mapped[str] = mapped_column(
        String(50),
        default="GENERAL",
        nullable=False,
    )
    visibility: Mapped[str] = mapped_column(
        String(50),
        default="INTERNAL",
        nullable=False,
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

    lead: Mapped[InsuranceAgentInquiry] = orm_relationship(
        back_populates="notes",
    )
    author: Mapped[User | None] = orm_relationship(
        foreign_keys=[author_id],
    )


class InsuranceLeadReminder(Base):
    """Follow-ups, scheduled calls, meetings and tasks for a sales CRM lead."""

    __tablename__ = "insurance_lead_reminders"
    __table_args__ = (
        Index("ix_insurance_lead_reminders_lead_id", "lead_id"),
        Index("ix_insurance_lead_reminders_date", "reminder_date"),
        Index("ix_insurance_lead_reminders_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    lead_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_agent_inquiries.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_to_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    reminder_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    reminder_time: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    reminder_type: Mapped[str] = mapped_column(
        String(50),
        default="CALL",
        nullable=False,
    )  # CALL, WHATSAPP, EMAIL, MEETING, OTHER
    priority: Mapped[str] = mapped_column(
        String(20),
        default="NORMAL",
        nullable=False,
    )  # LOW, NORMAL, HIGH, URGENT
    status: Mapped[str] = mapped_column(
        String(30),
        default="PENDING",
        nullable=False,
    )  # PENDING, COMPLETED, MISSED, CANCELLED
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completion_remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    outcome: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    next_follow_up_date: Mapped[date | None] = mapped_column(
        Date,
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

    lead: Mapped[InsuranceAgentInquiry] = orm_relationship(
        back_populates="reminders",
    )
    created_by: Mapped[User | None] = orm_relationship(
        foreign_keys=[created_by_id],
    )
    assigned_to: Mapped[User | None] = orm_relationship(
        foreign_keys=[assigned_to_id],
    )



class HealthQuotation(Base):
    """Custom Health Insurance Quotation header and client metadata."""

    __tablename__ = "insurance_health_quotations"
    __table_args__ = (
        Index("ix_insurance_health_quotations_num", "quotation_number", unique=True),
        Index("ix_insurance_health_quotations_date", "quotation_date"),
        Index("ix_insurance_health_quotations_status", "status"),
        Index("ix_insurance_health_quotations_tenant", "tenant_id"),
        Index("ix_health_quote_lead_id", "lead_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    quotation_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )
    quotation_title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
    )
    client_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_agent_inquiries.id", ondelete="SET NULL"),
        nullable=True,
    )
    advisor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    advisor_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    quotation_date: Mapped[date] = mapped_column(
        Date,
        default=date.today,
        nullable=False,
    )
    pin_code: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )
    contact_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    contact_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    disclaimer_snapshot: Mapped[str] = mapped_column(
        String(500),
        default="THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE",
        nullable=False,
    )
    premium_basis: Mapped[str] = mapped_column(
        String(20),
        default="GROSS",
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="DRAFT",
        nullable=False,
    )
    tenant_id: Mapped[str | None] = mapped_column(
        String(100),
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
    client: Mapped[Customer | None] = orm_relationship(
        foreign_keys=[client_id],
    )
    lead: Mapped[InsuranceAgentInquiry | None] = orm_relationship(
        foreign_keys=[lead_id],
        back_populates="quotations",
    )
    advisor: Mapped[User] = orm_relationship(
        foreign_keys=[advisor_id],
    )
    members: Mapped[list[HealthQuotationMember]] = orm_relationship(
        back_populates="quotation",
        cascade="all, delete-orphan",
        order_by="HealthQuotationMember.display_order",
        lazy="selectin",
    )
    company_plans: Mapped[list[HealthQuotationCompanyPlan]] = orm_relationship(
        back_populates="quotation",
        cascade="all, delete-orphan",
        order_by="HealthQuotationCompanyPlan.display_order",
        lazy="selectin",
    )


class HealthQuotationMember(Base):
    """Family / Insured members included in a health quotation."""

    __tablename__ = "insurance_health_quotation_members"
    __table_args__ = (
        Index("ix_health_quote_members_quote", "quotation_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    quotation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_health_quotations.id", ondelete="CASCADE"),
        nullable=False,
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
    )
    full_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    relationship: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    gender: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    date_of_birth: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    reference_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    age_years: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    age_months: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    age_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    quotation: Mapped[HealthQuotation] = orm_relationship(
        back_populates="members",
    )
    customer: Mapped[Customer | None] = orm_relationship(
        foreign_keys=[customer_id],
    )


class HealthQuotationCompanyPlan(Base):
    """Configurable Insurance Company and Plan variant row for quotation matrix."""

    __tablename__ = "insurance_health_quotation_company_plans"
    __table_args__ = (
        Index("ix_health_quote_comp_plans_quote", "quotation_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    quotation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_health_quotations.id", ondelete="CASCADE"),
        nullable=False,
    )
    insurance_company_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    insurance_plan_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("insurance_plans.id", ondelete="SET NULL"),
        nullable=True,
    )
    display_company_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    display_plan_variant: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    quotation: Mapped[HealthQuotation] = orm_relationship(
        back_populates="company_plans",
    )
    premiums: Mapped[list[HealthQuotationPremium]] = orm_relationship(
        back_populates="company_plan",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    insurance_company: Mapped[InsuranceCompany | None] = orm_relationship(
        foreign_keys=[insurance_company_id],
    )
    insurance_plan: Mapped[InsurancePlan | None] = orm_relationship(
        foreign_keys=[insurance_plan_id],
    )


class HealthQuotationPremium(Base):
    """Quotation Premium cell for a specific sum insured tier."""

    __tablename__ = "insurance_health_quotation_premiums"
    __table_args__ = (
        UniqueConstraint(
            "quotation_company_plan_id",
            "sum_insured_code",
            name="uq_health_quote_premium_plan_tier",
        ),
        Index("ix_health_quote_premiums_plan", "quotation_company_plan_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    quotation_company_plan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("insurance_health_quotation_company_plans.id", ondelete="CASCADE"),
        nullable=False,
    )
    sum_insured: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        nullable=False,
    )
    sum_insured_code: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    premium_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        nullable=False,
    )
    premium_basis: Mapped[str] = mapped_column(
        String(20),
        default="GROSS",
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    company_plan: Mapped[HealthQuotationCompanyPlan] = orm_relationship(
        back_populates="premiums",
    )



# Late imports for cross-module relationships
from app.db.models.auth import User  # noqa: E402
from app.db.models.crm import Customer  # noqa: E402
