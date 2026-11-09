"""Sub-Agent / POSP Management and Commission Split Service."""

from __future__ import annotations

import re
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.insurance import (
    InsuranceCommissionSplitConfig,
    InsuranceCompany,
    InsurancePlan,
    InsurancePolicy,
    InsurancePolicyCommission,
    InsuranceSubAgent,
)
from app.schemas.insurance import (
    CommissionSplitConfigCreate,
    CommissionSplitConfigResponse,
    PaginatedResponse,
    SubAgentCreate,
    SubAgentResponse,
    SubAgentUpdate,
)


def _generate_agent_code(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]", "", name).upper()
    prefix = cleaned[:4] if len(cleaned) >= 4 else (cleaned + "AGNT")[:4]
    unique_suffix = uuid.uuid4().hex[:4].upper()
    return f"POSP-{prefix}-{unique_suffix}"


def _generate_slug(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9\s-]", "", name).strip().lower()
    slug_base = re.sub(r"[\s-]+", "-", cleaned)
    random_suffix = uuid.uuid4().hex[:4]
    return f"{slug_base}-{random_suffix}"


async def create_sub_agent(
    session: AsyncSession,
    payload: SubAgentCreate,
) -> InsuranceSubAgent:
    """Create a new sub-agent / POSP with unique agent code and public profile slug."""
    # Determine code
    if payload.agent_code and payload.agent_code.strip():
        code_val = payload.agent_code.strip().upper()
        existing = await session.execute(
            select(InsuranceSubAgent).where(InsuranceSubAgent.agent_code == code_val)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Sub-Agent code '{code_val}' is already registered.",
            )
    else:
        code_val = _generate_agent_code(payload.full_name)

    # Check mobile
    existing_phone = await session.execute(
        select(InsuranceSubAgent).where(InsuranceSubAgent.mobile == payload.mobile.strip())
    )
    if existing_phone.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sub-Agent with mobile '{payload.mobile}' is already registered.",
        )

    slug = _generate_slug(payload.full_name)

    agent = InsuranceSubAgent(
        id=uuid.uuid4(),
        full_name=payload.full_name.strip(),
        agent_code=code_val,
        mobile=payload.mobile.strip(),
        email=payload.email.strip().lower() if payload.email and payload.email.strip() else None,
        address=payload.address.strip() if payload.address else None,
        joining_date=payload.joining_date or date.today(),
        status="ACTIVE",
        parent_firm=payload.parent_firm.strip() if payload.parent_firm else "FinNexus Enterprise",
        parent_agent_id=payload.parent_agent_id,
        public_profile_slug=slug,
        bio=payload.bio.strip() if payload.bio else None,
        specialties=payload.specialties.strip() if payload.specialties else "Life, Health, Motor",
        show_contact_info=payload.show_contact_info,
    )
    session.add(agent)
    await session.commit()
    await session.refresh(agent)
    return agent


async def list_sub_agents(
    session: AsyncSession,
    search: str | None = None,
    status_filter: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> PaginatedResponse[SubAgentResponse]:
    """List sub-agents with pagination, search, status filter, and commission totals."""
    query = select(InsuranceSubAgent).options(
        selectinload(InsuranceSubAgent.commission_splits),
    )

    if search and search.strip():
        s = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(InsuranceSubAgent.full_name).like(s),
                func.lower(InsuranceSubAgent.agent_code).like(s),
                func.lower(InsuranceSubAgent.mobile).like(s),
                func.lower(InsuranceSubAgent.email).like(s),
            )
        )
    if status_filter and status_filter != "ALL":
        query = query.where(InsuranceSubAgent.status == status_filter.upper())

    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(InsuranceSubAgent.full_name).offset(offset).limit(page_size)
    agents = (await session.execute(query)).scalars().all()

    items: list[SubAgentResponse] = []
    for a in agents:
        # Policies count
        pol_stmt = select(func.count()).where(InsurancePolicy.sub_agent_id == a.id)
        pol_count = (await session.execute(pol_stmt)).scalar_one()

        # Commissions summary
        comm_stmt = select(
            func.coalesce(func.sum(InsurancePolicyCommission.sub_agent_amount), Decimal("0.00"))
        ).where(
            InsurancePolicyCommission.sub_agent_id == a.id,
            InsurancePolicyCommission.status == "PAID",
        )
        total_paid_comm = (await session.execute(comm_stmt)).scalar_one()

        pending_stmt = select(
            func.coalesce(func.sum(InsurancePolicyCommission.sub_agent_amount), Decimal("0.00"))
        ).where(
            InsurancePolicyCommission.sub_agent_id == a.id,
            InsurancePolicyCommission.status == "PENDING",
        )
        total_pending_comm = (await session.execute(pending_stmt)).scalar_one()

        active_splits = [
            CommissionSplitConfigResponse(
                id=cs.id,
                sub_agent_id=cs.sub_agent_id,
                company_id=cs.company_id,
                plan_id=cs.plan_id,
                split_type=cs.split_type,
                split_value=cs.split_value,
                effective_date=cs.effective_date,
                is_active=cs.is_active,
                notes=cs.notes,
                created_at=cs.created_at,
            )
            for cs in (a.commission_splits or [])
            if cs.is_active
        ]

        items.append(
            SubAgentResponse(
                id=a.id,
                full_name=a.full_name,
                agent_code=a.agent_code,
                mobile=a.mobile,
                email=a.email,
                address=a.address,
                joining_date=a.joining_date,
                status=a.status,
                parent_firm=a.parent_firm,
                parent_agent_id=a.parent_agent_id,
                public_profile_slug=a.public_profile_slug,
                bio=a.bio,
                specialties=a.specialties,
                show_contact_info=a.show_contact_info,
                created_at=a.created_at,
                updated_at=a.updated_at,
                policies_count=pol_count,
                active_splits=active_splits,
                total_commission_earned=Decimal(str(total_paid_comm)),
                pending_commission=Decimal(str(total_pending_comm)),
            )
        )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


async def get_sub_agent_detail(
    session: AsyncSession,
    agent_id: uuid.UUID,
) -> SubAgentResponse:
    """Retrieve individual agent profile with policies count and commission earnings."""
    query = (
        select(InsuranceSubAgent)
        .options(selectinload(InsuranceSubAgent.commission_splits))
        .where(InsuranceSubAgent.id == agent_id)
    )
    agent = (await session.execute(query)).scalar_one_or_none()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sub-Agent {agent_id} not found.",
        )

    pol_stmt = select(func.count()).where(InsurancePolicy.sub_agent_id == agent.id)
    pol_count = (await session.execute(pol_stmt)).scalar_one()

    comm_stmt = select(
        func.coalesce(func.sum(InsurancePolicyCommission.sub_agent_amount), Decimal("0.00"))
    ).where(
        InsurancePolicyCommission.sub_agent_id == agent.id,
        InsurancePolicyCommission.status == "PAID",
    )
    total_paid_comm = (await session.execute(comm_stmt)).scalar_one()

    pending_stmt = select(
        func.coalesce(func.sum(InsurancePolicyCommission.sub_agent_amount), Decimal("0.00"))
    ).where(
        InsurancePolicyCommission.sub_agent_id == agent.id,
        InsurancePolicyCommission.status == "PENDING",
    )
    total_pending_comm = (await session.execute(pending_stmt)).scalar_one()

    active_splits = [
        CommissionSplitConfigResponse(
            id=cs.id,
            sub_agent_id=cs.sub_agent_id,
            company_id=cs.company_id,
            plan_id=cs.plan_id,
            split_type=cs.split_type,
            split_value=cs.split_value,
            effective_date=cs.effective_date,
            is_active=cs.is_active,
            notes=cs.notes,
            created_at=cs.created_at,
        )
        for cs in (agent.commission_splits or [])
        if cs.is_active
    ]

    return SubAgentResponse(
        id=agent.id,
        full_name=agent.full_name,
        agent_code=agent.agent_code,
        mobile=agent.mobile,
        email=agent.email,
        address=agent.address,
        joining_date=agent.joining_date,
        status=agent.status,
        parent_firm=agent.parent_firm,
        parent_agent_id=agent.parent_agent_id,
        public_profile_slug=agent.public_profile_slug,
        bio=agent.bio,
        specialties=agent.specialties,
        show_contact_info=agent.show_contact_info,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        policies_count=pol_count,
        active_splits=active_splits,
        total_commission_earned=Decimal(str(total_paid_comm)),
        pending_commission=Decimal(str(total_pending_comm)),
    )


async def update_sub_agent(
    session: AsyncSession,
    agent_id: uuid.UUID,
    payload: SubAgentUpdate,
) -> InsuranceSubAgent:
    """Update sub-agent attributes."""
    agent = (
        await session.execute(
            select(InsuranceSubAgent).where(InsuranceSubAgent.id == agent_id)
        )
    ).scalar_one_or_none()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sub-Agent {agent_id} not found.",
        )

    if payload.full_name is not None:
        agent.full_name = payload.full_name.strip()
    if payload.mobile is not None:
        agent.mobile = payload.mobile.strip()
    if payload.email is not None:
        agent.email = payload.email.strip().lower() if payload.email.strip() else None
    if payload.address is not None:
        agent.address = payload.address.strip()
    if payload.joining_date is not None:
        agent.joining_date = payload.joining_date
    if payload.status is not None:
        agent.status = payload.status.strip().upper()
    if payload.parent_firm is not None:
        agent.parent_firm = payload.parent_firm.strip()
    if payload.parent_agent_id is not None:
        agent.parent_agent_id = payload.parent_agent_id
    if payload.bio is not None:
        agent.bio = payload.bio.strip()
    if payload.specialties is not None:
        agent.specialties = payload.specialties.strip()
    if payload.show_contact_info is not None:
        agent.show_contact_info = payload.show_contact_info

    agent.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(agent)
    return agent


async def delete_sub_agent(
    session: AsyncSession,
    agent_id: uuid.UUID,
) -> None:
    """Safely delete or deactivate sub-agent. Block physical deletion if policies exist."""
    agent = (
        await session.execute(
            select(InsuranceSubAgent).where(InsuranceSubAgent.id == agent_id)
        )
    ).scalar_one_or_none()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sub-Agent {agent_id} not found.",
        )

    # Check referenced policies
    pol_stmt = select(func.count()).where(InsurancePolicy.sub_agent_id == agent_id)
    pol_count = (await session.execute(pol_stmt)).scalar_one()
    if pol_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete agent '{agent.full_name}' because {pol_count} policy contract(s) are linked to them. Please deactivate the agent instead.",
        )

    await session.delete(agent)
    await session.commit()


# --- Commission Split Configuration ---


async def configure_commission_split(
    session: AsyncSession,
    payload: CommissionSplitConfigCreate,
) -> InsuranceCommissionSplitConfig:
    """Configure or update commission split arrangements between main firm and sub-agent."""
    # 1. Validate sub-agent exists
    agent = (
        await session.execute(
            select(InsuranceSubAgent).where(InsuranceSubAgent.id == payload.sub_agent_id)
        )
    ).scalar_one_or_none()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sub-Agent {payload.sub_agent_id} not found.",
        )

    # 2. Validate split percentage range and custom rates
    split_val = payload.split_value
    if payload.agent_commission_rate is not None:
        split_val = Decimal(str(payload.agent_commission_rate))

    if payload.firm_commission_rate is not None and payload.agent_commission_rate is not None:
        total_rate = Decimal(str(payload.firm_commission_rate)) + Decimal(str(payload.agent_commission_rate))
        if total_rate != Decimal("100.0") and total_rate != Decimal("100"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total commission split must equal 100%. Got {total_rate}%.",
            )

    if payload.split_type.upper() == "PERCENTAGE":
        if split_val <= Decimal("0") or split_val > Decimal("100"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Commission split percentage must be between 0.01% and 100.00%.",
            )
    elif payload.split_type.upper() == "FIXED":
        if split_val <= Decimal("0"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Fixed commission split amount must be greater than zero.",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid split_type '{payload.split_type}'. Supported types: PERCENTAGE, FIXED.",
        )

    # 3. If plan_id or company_id given, validate they exist
    if payload.company_id:
        comp = (
            await session.execute(
                select(InsuranceCompany).where(InsuranceCompany.id == payload.company_id)
            )
        ).scalar_one_or_none()
        if not comp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Insurance Company {payload.company_id} not found.",
            )
    if payload.plan_id:
        plan = (
            await session.execute(
                select(InsurancePlan).where(InsurancePlan.id == payload.plan_id)
            )
        ).scalar_one_or_none()
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Insurance Plan {payload.plan_id} not found.",
            )

    split_config = InsuranceCommissionSplitConfig(
        id=uuid.uuid4(),
        sub_agent_id=payload.sub_agent_id,
        company_id=payload.company_id,
        plan_id=payload.plan_id,
        split_type=payload.split_type.upper(),
        split_value=split_val,
        effective_date=payload.effective_date or date.today(),
        is_active=True,
        notes=payload.notes.strip() if payload.notes else None,
    )
    session.add(split_config)
    await session.commit()
    await session.refresh(split_config)
    return split_config


async def list_agent_splits(
    session: AsyncSession,
    agent_id: uuid.UUID,
) -> list[CommissionSplitConfigResponse]:
    """Retrieve all commission split configurations for an agent."""
    query = (
        select(InsuranceCommissionSplitConfig)
        .where(InsuranceCommissionSplitConfig.sub_agent_id == agent_id)
        .order_by(InsuranceCommissionSplitConfig.effective_date.desc())
    )
    splits = (await session.execute(query)).scalars().all()

    results: list[CommissionSplitConfigResponse] = []
    for s in splits:
        comp_name = None
        plan_name = None
        if s.company_id:
            c = (await session.execute(select(InsuranceCompany).where(InsuranceCompany.id == s.company_id))).scalar_one_or_none()
            comp_name = c.name if c else None
        if s.plan_id:
            p = (await session.execute(select(InsurancePlan).where(InsurancePlan.id == s.plan_id))).scalar_one_or_none()
            plan_name = p.name if p else None

        results.append(
            CommissionSplitConfigResponse(
                id=s.id,
                sub_agent_id=s.sub_agent_id,
                company_id=s.company_id,
                company_name=comp_name,
                plan_id=s.plan_id,
                plan_name=plan_name,
                split_type=s.split_type,
                split_value=s.split_value,
                agent_commission_rate=float(s.split_value) if s.split_type == "PERCENTAGE" else 50.0,
                firm_commission_rate=float(100.0 - float(s.split_value)) if s.split_type == "PERCENTAGE" else 50.0,
                effective_date=s.effective_date,
                is_active=s.is_active,
                notes=s.notes,
                created_at=s.created_at,
            )
        )
    return results

