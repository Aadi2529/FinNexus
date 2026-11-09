"""Sub-Agent / POSP Management and Commission Split Configuration Router."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_admin_or_super_admin, require_manager_or_above
from app.db.models.auth import User
from app.db.session import get_db_session
from app.schemas.insurance import (
    CommissionSplitConfigCreate,
    CommissionSplitConfigResponse,
    PaginatedResponse,
    SubAgentCreate,
    SubAgentResponse,
    SubAgentUpdate,
)
from app.services.insurance import (
    configure_commission_split,
    create_sub_agent,
    delete_sub_agent,
    get_sub_agent_detail,
    list_agent_splits,
    list_sub_agents,
    update_sub_agent,
)

router = APIRouter(tags=["Sub-Agents & POSP"])


@router.get(
    "/sub-agents",
    response_model=PaginatedResponse[SubAgentResponse],
    summary="List Sub-Agents / POSP with Filtering",
)
async def list_sub_agents_endpoint(
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[SubAgentResponse]:
    """Retrieve paginated sub-agents with performance metrics."""
    return await list_sub_agents(
        session=session,
        search=search,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/sub-agents",
    response_model=SubAgentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Sub-Agent / POSP",
)
async def create_sub_agent_endpoint(
    payload: SubAgentCreate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> SubAgentResponse:
    """Register a new sub-agent / POSP with unique agent code and public profile slug."""
    agent = await create_sub_agent(session, payload)
    return await get_sub_agent_detail(session, agent.id)


@router.get(
    "/sub-agents/{agent_id}",
    response_model=SubAgentResponse,
    summary="Get Sub-Agent Profile and Commission Summary",
)
async def get_sub_agent_endpoint(
    agent_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> SubAgentResponse:
    """Retrieve sub-agent profile with policies sourced and commission summaries."""
    return await get_sub_agent_detail(session, agent_id)


@router.put(
    "/sub-agents/{agent_id}",
    response_model=SubAgentResponse,
    summary="Update Sub-Agent Details",
)
async def update_sub_agent_endpoint(
    agent_id: uuid.UUID,
    payload: SubAgentUpdate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> SubAgentResponse:
    """Update sub-agent profile information."""
    await update_sub_agent(session, agent_id, payload)
    return await get_sub_agent_detail(session, agent_id)


@router.patch(
    "/sub-agents/{agent_id}/status",
    response_model=SubAgentResponse,
    summary="Toggle Sub-Agent Active / Inactive Status",
)
async def toggle_sub_agent_status_endpoint(
    agent_id: uuid.UUID,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> SubAgentResponse:
    """Toggle agent status between ACTIVE and INACTIVE."""
    agent_detail = await get_sub_agent_detail(session, agent_id)
    new_stat = "INACTIVE" if agent_detail.status == "ACTIVE" else "ACTIVE"
    await update_sub_agent(session, agent_id, SubAgentUpdate(status=new_stat))
    return await get_sub_agent_detail(session, agent_id)


@router.delete(
    "/sub-agents/{agent_id}",
    status_code=status.HTTP_200_OK,
    summary="Safe Delete Sub-Agent",
)
async def delete_sub_agent_endpoint(
    agent_id: uuid.UUID,
    current_user: User = Depends(require_admin_or_super_admin),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Delete sub-agent. Blocked if policy contracts are linked."""
    await delete_sub_agent(session, agent_id)
    return {"status": "success", "message": "Sub-Agent deleted successfully."}


@router.get(
    "/sub-agents/{agent_id}/splits",
    response_model=list[CommissionSplitConfigResponse],
    summary="List Commission Splits for Sub-Agent",
)
async def list_splits_endpoint(
    agent_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[CommissionSplitConfigResponse]:
    """Retrieve commission sharing agreements configured for an agent."""
    return await list_agent_splits(session, agent_id)


@router.post(
    "/commission-splits",
    response_model=CommissionSplitConfigResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Configure Commission Split Agreement",
)
async def create_split_top_level_endpoint(
    payload: CommissionSplitConfigCreate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> CommissionSplitConfigResponse:
    split_record = await configure_commission_split(session, payload)
    splits = await list_agent_splits(session, payload.sub_agent_id)
    for s in splits:
        if s.id == split_record.id:
            return s
    return splits[0]

@router.post(
    "/sub-agents/{agent_id}/splits",
    response_model=CommissionSplitConfigResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Configure Commission Split Agreement",
)
async def create_split_endpoint(
    agent_id: uuid.UUID,
    payload: CommissionSplitConfigCreate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> CommissionSplitConfigResponse:
    """Configure percentage-based or fixed-amount commission split."""
    if payload.sub_agent_id != agent_id:
        payload.sub_agent_id = agent_id
    split_record = await configure_commission_split(session, payload)
    splits = await list_agent_splits(session, agent_id)
    for s in splits:
        if s.id == split_record.id:
            return s
    return splits[0]

