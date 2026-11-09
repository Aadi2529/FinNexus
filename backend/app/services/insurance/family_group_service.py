"""Family Group and Household Portfolio Service for FinNexus Insurance Engine."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.crm import Customer
from app.db.models.insurance import (
    InsuranceFamilyGroup,
    InsuranceFamilyMember,
    InsurancePolicy,
)
from app.schemas.insurance import (
    FamilyGroupCreate,
    FamilyGroupResponse,
    FamilyMemberCreate,
    FamilyMemberResponse,
    PolicyResponse,
)


async def create_family_group(
    session: AsyncSession,
    payload: FamilyGroupCreate,
) -> FamilyGroupResponse:
    """Create a new family household with Primary Family Head and optional initial members."""
    head_id = payload.head_customer_id or payload.primary_head_customer_id
    if not head_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Head customer ID must be provided via head_customer_id or primary_head_customer_id.",
        )

    # 1. Validate Head Customer exists
    head_cust = (
        await session.execute(
            select(Customer).where(Customer.id == head_id)
        )
    ).scalar_one_or_none()
    if not head_cust:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Head customer with ID {head_id} not found.",
        )

    # 2. Prevent duplicate family membership for head customer
    existing_member = (
        await session.execute(
            select(InsuranceFamilyMember).where(
                InsuranceFamilyMember.customer_id == head_id
            )
        )
    ).scalar_one_or_none()
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Customer '{head_cust.full_name}' is already assigned to a family group.",
        )

    family_group = InsuranceFamilyGroup(
        id=uuid.uuid4(),
        name=payload.name.strip(),
        head_customer_id=head_id,
        notes=payload.notes.strip() if payload.notes else None,
    )
    session.add(family_group)
    await session.flush()

    # Automatically add Head as PRIMARY_HEAD member
    head_member = InsuranceFamilyMember(
        id=uuid.uuid4(),
        family_group_id=family_group.id,
        customer_id=head_id,
        relation_type="PRIMARY_HEAD",
        notes="Primary Family Head",
    )
    session.add(head_member)

    # Add any initial members
    for m in payload.initial_members:
        if m.customer_id == payload.head_customer_id:
            continue  # Head already added
        # Check member exists
        m_cust = (
            await session.execute(select(Customer).where(Customer.id == m.customer_id))
        ).scalar_one_or_none()
        if not m_cust:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Member customer with ID {m.customer_id} not found.",
            )
        # Check duplicate
        m_dup = (
            await session.execute(
                select(InsuranceFamilyMember).where(
                    InsuranceFamilyMember.customer_id == m.customer_id
                )
            )
        ).scalar_one_or_none()
        if m_dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Customer '{m_cust.full_name}' is already assigned to a family group.",
            )

        new_mem = InsuranceFamilyMember(
            id=uuid.uuid4(),
            family_group_id=family_group.id,
            customer_id=m.customer_id,
            relation_type=m.relationship.upper(),
            notes=m.notes.strip() if m.notes else None,
        )
        session.add(new_mem)

    await session.commit()
    return await get_family_group_detail(session, family_group.id)


async def add_family_member(
    session: AsyncSession,
    family_group_id: uuid.UUID,
    payload: FamilyMemberCreate,
) -> FamilyMemberResponse:
    """Add a spouse or dependent to an existing family group."""
    group = (
        await session.execute(
            select(InsuranceFamilyGroup).where(InsuranceFamilyGroup.id == family_group_id)
        )
    ).scalar_one_or_none()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Family Group {family_group_id} not found.",
        )

    # Validate Customer exists
    cust = (
        await session.execute(
            select(Customer).where(Customer.id == payload.customer_id)
        )
    ).scalar_one_or_none()
    if not cust:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {payload.customer_id} not found.",
        )

    # Prevent duplicate family membership
    existing_mem = (
        await session.execute(
            select(InsuranceFamilyMember).where(
                InsuranceFamilyMember.customer_id == payload.customer_id
            )
        )
    ).scalar_one_or_none()
    if existing_mem:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Customer '{cust.full_name}' is already assigned to a family group.",
        )

    # Validate relation type
    rel_clean = payload.relationship.upper()
    if rel_clean == "PRIMARY_HEAD":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A family group can have only one Primary Family Head.",
        )

    member = InsuranceFamilyMember(
        id=uuid.uuid4(),
        family_group_id=family_group_id,
        customer_id=payload.customer_id,
        relation_type=rel_clean,
        notes=payload.notes.strip() if payload.notes else None,
    )
    session.add(member)
    await session.commit()
    await session.refresh(member)

    return FamilyMemberResponse(
        id=member.id,
        customer_id=member.customer_id,
        customer_name=cust.full_name,
        customer_phone=cust.phone,
        customer_email=cust.email,
        relationship=member.relation_type,
        notes=member.notes,
        created_at=member.created_at,
    )


async def remove_family_member(
    session: AsyncSession,
    family_group_id: uuid.UUID,
    member_id: uuid.UUID,
) -> None:
    """Remove a family member from group. Prevent removing the Primary Family Head."""
    member = (
        await session.execute(
            select(InsuranceFamilyMember).where(
                InsuranceFamilyMember.id == member_id,
                InsuranceFamilyMember.family_group_id == family_group_id,
            )
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Family member {member_id} not found in group {family_group_id}.",
        )

    if member.relation_type == "PRIMARY_HEAD":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the Primary Family Head from the family group.",
        )

    await session.delete(member)
    await session.commit()


async def list_family_groups(
    session: AsyncSession,
    search: str | None = None,
) -> list[FamilyGroupResponse]:
    """List all family groups with members summary."""
    query = (
        select(InsuranceFamilyGroup)
        .options(
            selectinload(InsuranceFamilyGroup.members).selectinload(InsuranceFamilyMember.customer),
            selectinload(InsuranceFamilyGroup.head_customer),
        )
    )
    if search and search.strip():
        s = f"%{search.strip().lower()}%"
        query = query.where(func.lower(InsuranceFamilyGroup.name).like(s))

    groups = (await session.execute(query.order_by(InsuranceFamilyGroup.name))).scalars().all()

    results: list[FamilyGroupResponse] = []
    for g in groups:
        # Collect member IDs
        cust_ids = [m.customer_id for m in g.members]
        pol_stmt = select(
            func.count(InsurancePolicy.id),
            func.coalesce(func.sum(InsurancePolicy.sum_assured), Decimal("0.00")),
            func.coalesce(func.sum(InsurancePolicy.final_premium), Decimal("0.00")),
        ).where(InsurancePolicy.customer_id.in_(cust_ids))
        row = (await session.execute(pol_stmt)).first()
        total_pols, total_cov, total_prem = row if row else (0, Decimal("0.00"), Decimal("0.00"))

        m_list = [
            FamilyMemberResponse(
                id=m.id,
                customer_id=m.customer_id,
                customer_name=m.customer.full_name if m.customer else "Unknown",
                customer_phone=m.customer.phone if m.customer else "",
                customer_email=m.customer.email if m.customer else None,
                relationship=m.relation_type,
                notes=m.notes,
                created_at=m.created_at,
            )
            for m in g.members
        ]

        results.append(
            FamilyGroupResponse(
                id=g.id,
                name=g.name,
                head_customer_id=g.head_customer_id,
                head_customer_name=g.head_customer.full_name if g.head_customer else None,
                notes=g.notes,
                members=m_list,
                total_policies=total_pols,
                total_coverage=Decimal(str(total_cov)),
                total_premium=Decimal(str(total_prem)),
                created_at=g.created_at,
                updated_at=g.updated_at,
            )
        )
    return results


async def get_family_group_detail(
    session: AsyncSession,
    family_group_id: uuid.UUID,
) -> FamilyGroupResponse:
    """Retrieve family group detail with consolidated policy coverage."""
    query = (
        select(InsuranceFamilyGroup)
        .options(
            selectinload(InsuranceFamilyGroup.members).selectinload(InsuranceFamilyMember.customer),
            selectinload(InsuranceFamilyGroup.head_customer),
        )
        .where(InsuranceFamilyGroup.id == family_group_id)
    )
    group = (await session.execute(query)).scalar_one_or_none()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Family group {family_group_id} not found.",
        )

    cust_ids = [m.customer_id for m in group.members]
    pol_stmt = select(
        func.count(InsurancePolicy.id),
        func.coalesce(func.sum(InsurancePolicy.sum_assured), Decimal("0.00")),
        func.coalesce(func.sum(InsurancePolicy.final_premium), Decimal("0.00")),
    ).where(InsurancePolicy.customer_id.in_(cust_ids))
    row = (await session.execute(pol_stmt)).first()
    total_pols, total_cov, total_prem = row if row else (0, Decimal("0.00"), Decimal("0.00"))

    m_list = [
        FamilyMemberResponse(
            id=m.id,
            customer_id=m.customer_id,
            customer_name=m.customer.full_name if m.customer else "Unknown",
            customer_phone=m.customer.phone if m.customer else "",
            customer_email=m.customer.email if m.customer else None,
            relationship=m.relation_type,
            notes=m.notes,
            created_at=m.created_at,
        )
        for m in group.members
    ]

    # Fetch consolidated policies
    pol_query = select(InsurancePolicy).where(InsurancePolicy.customer_id.in_(cust_ids))
    policies = (await session.execute(pol_query)).scalars().all()
    pol_list = [
        {
            "id": str(p.id),
            "policy_number": p.policy_number,
            "policy_type": p.policy_type,
            "customer_id": str(p.customer_id),
            "customer_name": p.customer.full_name if p.customer else "",
            "company_name": p.company.name if p.company else "",
            "plan_name": p.plan.name if p.plan else "",
            "sum_assured": float(p.sum_assured),
            "final_premium": float(p.final_premium),
            "status": p.status,
            "expiry_date": str(p.expiry_date) if p.expiry_date else None,
        }
        for p in policies
    ]

    return FamilyGroupResponse(
        id=group.id,
        name=group.name,
        head_customer_id=group.head_customer_id,
        head_customer_name=group.head_customer.full_name if group.head_customer else None,
        notes=group.notes,
        members=m_list,
        members_count=len(m_list),
        consolidated_policies=pol_list,
        total_policies=total_pols,
        total_coverage=Decimal(str(total_cov)),
        total_premium=Decimal(str(total_prem)),
        created_at=group.created_at,
        updated_at=group.updated_at,
    )

async def delete_family_group(
    session: AsyncSession,
    family_group_id: uuid.UUID,
) -> dict:
    """Dissolve an entire family group and all associated member links safely."""
    group = (
        await session.execute(
            select(InsuranceFamilyGroup)
            .options(selectinload(InsuranceFamilyGroup.members))
            .where(InsuranceFamilyGroup.id == family_group_id)
        )
    ).scalar_one_or_none()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Family group {family_group_id} not found.",
        )

    for m in (group.members or []):
        await session.delete(m)
    await session.delete(group)
    await session.commit()
    return {"status": "success", "message": f"Family group '{group.name}' dissolved successfully."}
