"""Premium Schedules and Policy Renewal Lifecycle Service for FinNexus Insurance Engine."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.insurance import (
    InsurancePolicy,
    InsurancePremiumSchedule,
)
from app.schemas.insurance import PaginatedResponse, PremiumScheduleResponse


def _add_months(source_date: date, months: int) -> date:
    """Add calendar months to a date safely."""
    month = source_date.month - 1 + months
    year = source_date.year + month // 12
    month = month % 12 + 1
    # Day handling (e.g. Feb 30 -> Feb 28)
    day = min(
        source_date.day,
        [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1],
    )
    return date(year, month, day)


def calculate_schedule_status(due_date: date, paid_date: date | None, expiry_date: date | None = None) -> str:
    """Compute the dynamic real-time status of a premium installment."""
    if paid_date is not None:
        return "PAID"
    today = date.today()
    if expiry_date and expiry_date < today:
        return "EXPIRED"
    if due_date == today:
        return "DUE_TODAY"
    if due_date < today:
        return "OVERDUE"
    return "UPCOMING"


async def generate_premium_schedules_for_policy(
    session: AsyncSession,
    policy: InsurancePolicy,
    regenerate: bool = False,
) -> list[InsurancePremiumSchedule]:
    """Generate installment schedules for a policy based on frequency and term. Idempotent."""
    # Check if schedules already exist
    existing_stmt = select(InsurancePremiumSchedule).where(
        InsurancePremiumSchedule.policy_id == policy.id
    )
    existing_schedules = (await session.execute(existing_stmt)).scalars().all()
    if existing_schedules and not regenerate:
        return list(existing_schedules)

    if existing_schedules and regenerate:
        for s in existing_schedules:
            await session.delete(s)
        await session.flush()

    mode = policy.premium_mode.upper()
    term_years = max(1, policy.term_years)

    if policy.is_single_premium or mode == "SINGLE":
        intervals_per_year = 1
        months_step = 12 * term_years
        total_installments = 1
    elif mode == "MONTHLY":
        intervals_per_year = 12
        months_step = 1
        total_installments = intervals_per_year * term_years
    elif mode == "QUARTERLY":
        intervals_per_year = 4
        months_step = 3
        total_installments = intervals_per_year * term_years
    elif mode == "HALF-YEARLY" or mode == "HALF_YEARLY":
        intervals_per_year = 2
        months_step = 6
        total_installments = intervals_per_year * term_years
    else:  # YEARLY default
        intervals_per_year = 1
        months_step = 12
        total_installments = term_years

    # Annual premium is policy.final_premium. Total premium over term = final_premium * term_years.
    # Each installment amount:
    installment_amount = (policy.final_premium / Decimal(str(intervals_per_year))).quantize(Decimal("0.01"))

    schedules: list[InsurancePremiumSchedule] = []
    current_due = policy.policy_start_date

    for i in range(1, total_installments + 1):
        stat = calculate_schedule_status(current_due, None, policy.expiry_date)
        sched = InsurancePremiumSchedule(
            id=uuid.uuid4(),
            policy_id=policy.id,
            installment_number=i,
            due_date=current_due,
            amount=installment_amount,
            status=stat,
            paid_date=None,
        )
        session.add(sched)
        schedules.append(sched)
        current_due = _add_months(policy.policy_start_date, i * months_step)

    await session.flush()
    return schedules


async def list_premium_schedules(
    session: AsyncSession,
    status_filter: str | None = None,
    upcoming_days: int | None = None,
    policy_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 25,
) -> PaginatedResponse[PremiumScheduleResponse]:
    """Retrieve filtered premium schedules with dynamic status evaluation."""
    query = (
        select(InsurancePremiumSchedule)
        .options(selectinload(InsurancePremiumSchedule.policy))
        .join(InsurancePolicy)
    )

    if policy_id:
        query = query.where(InsurancePremiumSchedule.policy_id == policy_id)

    today = date.today()

    if upcoming_days is not None:
        future_limit = today + timedelta(days=upcoming_days)
        query = query.where(
            InsurancePremiumSchedule.paid_date.is_(None),
            InsurancePremiumSchedule.due_date >= today,
            InsurancePremiumSchedule.due_date <= future_limit,
        )

    if status_filter and status_filter != "ALL":
        sf = status_filter.upper()
        if sf == "PAID":
            query = query.where(InsurancePremiumSchedule.paid_date.is_not(None))
        elif sf == "DUE_TODAY":
            query = query.where(
                InsurancePremiumSchedule.paid_date.is_(None),
                InsurancePremiumSchedule.due_date == today,
            )
        elif sf == "OVERDUE":
            query = query.where(
                InsurancePremiumSchedule.paid_date.is_(None),
                InsurancePremiumSchedule.due_date < today,
            )
        elif sf == "UPCOMING":
            query = query.where(
                InsurancePremiumSchedule.paid_date.is_(None),
                InsurancePremiumSchedule.due_date > today,
            )
        elif sf == "EXPIRED":
            query = query.where(
                InsurancePremiumSchedule.paid_date.is_(None),
                InsurancePolicy.expiry_date < today,
            )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(InsurancePremiumSchedule.due_date.asc()).offset(offset).limit(page_size)
    schedules = (await session.execute(query)).scalars().all()

    items: list[PremiumScheduleResponse] = []
    for s in schedules:
        current_status = calculate_schedule_status(
            s.due_date,
            s.paid_date,
            s.policy.expiry_date if s.policy else None,
        )
        items.append(
            PremiumScheduleResponse(
                id=s.id,
                policy_id=s.policy_id,
                installment_number=s.installment_number,
                due_date=s.due_date,
                amount=s.amount,
                installment_amount=s.amount,
                status=current_status,
                paid_date=s.paid_date,
                created_at=s.created_at,
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


async def get_upcoming_expiries(
    session: AsyncSession,
    window_days: int = 30,
    limit: int = 10,
) -> list[dict]:
    """Retrieve policies expiring within the reminder window."""
    today = date.today()
    limit_date = today + timedelta(days=window_days)

    query = (
        select(InsurancePolicy)
        .options(
            selectinload(InsurancePolicy.customer),
            selectinload(InsurancePolicy.company),
            selectinload(InsurancePolicy.plan),
        )
        .where(
            InsurancePolicy.status == "ACTIVE",
            InsurancePolicy.expiry_date >= today,
            InsurancePolicy.expiry_date <= limit_date,
        )
        .order_by(InsurancePolicy.expiry_date.asc())
        .limit(limit)
    )

    policies = (await session.execute(query)).scalars().all()
    results: list[dict] = []
    for p in policies:
        days_left = (p.expiry_date - today).days
        results.append({
            "id": str(p.id),
            "policy_number": p.policy_number,
            "customer_name": p.customer.full_name if p.customer else "Unknown",
            "company_name": p.company.name if p.company else "Unknown",
            "plan_name": p.plan.name if p.plan else "Unknown",
            "expiry_date": p.expiry_date.isoformat(),
            "days_remaining": days_left,
            "final_premium": float(p.final_premium),
            "sum_assured": float(p.sum_assured),
        })
    return results

