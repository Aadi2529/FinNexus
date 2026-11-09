"""Family Groups and Household Portfolio Management Router."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_manager_or_above
from app.db.models.auth import User
from app.db.session import get_db_session
from app.schemas.insurance import (
    FamilyGroupCreate,
    FamilyGroupResponse,
    FamilyMemberCreate,
    FamilyMemberResponse,
)
from app.services.insurance import (
    add_family_member,
    create_family_group,
    get_family_group_detail,
    list_family_groups,
    remove_family_member,
)

router = APIRouter(tags=["Family Groups & Portfolios"])


@router.get(
    "/family-groups",
    response_model=list[FamilyGroupResponse],
    summary="List Family Groups",
)
async def list_family_groups_endpoint(
    search: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[FamilyGroupResponse]:
    """Retrieve all family groups with members and consolidated coverage summaries."""
    return await list_family_groups(session, search=search)


@router.post(
    "/family-groups",
    response_model=FamilyGroupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Family Group with Primary Family Head",
)
async def create_family_group_endpoint(
    payload: FamilyGroupCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FamilyGroupResponse:
    """Create a family group with a Primary Family Head and optional dependents."""
    return await create_family_group(session, payload)


@router.get(
    "/family-groups/{group_id}",
    response_model=FamilyGroupResponse,
    summary="Get Family Group Detail and Portfolio",
)
async def get_family_group_endpoint(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FamilyGroupResponse:
    """Retrieve family group detail with all members and consolidated family portfolio."""
    return await get_family_group_detail(session, group_id)


@router.post(
    "/family-groups/{group_id}/members",
    response_model=FamilyMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add Member to Family Group",
)
async def add_family_member_endpoint(
    group_id: uuid.UUID,
    payload: FamilyMemberCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FamilyMemberResponse:
    """Add a spouse, child, or dependent to a family group."""
    return await add_family_member(session, group_id, payload)


@router.delete(
    "/family-groups/{group_id}/members/{member_id}",
    status_code=status.HTTP_200_OK,
    summary="Remove Member from Family Group",
)
async def remove_family_member_endpoint(
    group_id: uuid.UUID,
    member_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Remove member from family group. Cannot remove Primary Family Head."""
    await remove_family_member(session, group_id, member_id)
    return {"status": "success", "message": "Family member removed."}

@router.delete(
    "/family-groups/{group_id}",
    status_code=status.HTTP_200_OK,
    summary="Dissolve / Delete Family Group",
)
async def delete_family_group_endpoint(
    group_id: uuid.UUID,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Dissolve an entire family group and all member links safely."""
    return await delete_family_group(session, group_id)
