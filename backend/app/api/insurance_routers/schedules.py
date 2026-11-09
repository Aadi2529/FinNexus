"""Premium Schedules and Policy Renewal Engine Router."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.models.auth import User
from app.db.session import get_db_session
from app.schemas.insurance import PaginatedResponse, PremiumScheduleResponse
from app.services.insurance import get_upcoming_expiries, list_premium_schedules

router = APIRouter(tags=["Premium Schedules & Renewals"])


@router.get(
    "/schedules",
    response_model=PaginatedResponse[PremiumScheduleResponse],
    summary="List Premium Schedules with Real Database-Backed States",
)
@router.get(
    "/premium-schedules",
    response_model=PaginatedResponse[PremiumScheduleResponse],
    summary="List Premium Schedules with Real Database-Backed States",
)
async def list_schedules_endpoint(
    status_filter: str | None = Query(default=None, alias="status"),
    upcoming_days: int | None = Query(default=None, description="Filter installments due within X days (e.g. 30)"),
    policy_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[PremiumScheduleResponse]:
    """Retrieve premium schedules with real-time dynamic states: Due Today, Upcoming, Overdue, Paid, Expired."""
    return await list_premium_schedules(
        session=session,
        status_filter=status_filter,
        upcoming_days=upcoming_days,
        policy_id=policy_id,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/renewals/upcoming",
    summary="List Policies Expiring Within 30-Day Reminder Window",
)
async def get_upcoming_renewals_endpoint(
    window_days: int = Query(default=30, ge=1, le=180),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    """Retrieve policies approaching expiration within the configurable reminder window."""
    return await get_upcoming_expiries(session, window_days=window_days, limit=limit)

