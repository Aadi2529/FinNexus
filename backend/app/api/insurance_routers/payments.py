"""Policy Payment Ledger Router."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.models.auth import User
from app.db.session import get_db_session
from app.schemas.insurance import PaymentCreate, PaymentResponse
from app.services.insurance import list_policy_payments, record_payment

router = APIRouter(tags=["Policy Payments"])


@router.post(
    "/policies/{policy_id}/payments",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record Payment Transaction for Policy",
)
async def record_payment_endpoint(
    policy_id: uuid.UUID,
    payload: PaymentCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaymentResponse:
    """Record payment transaction separately from policy records and advance schedule to PAID."""
    return await record_payment(session, policy_id, payload, user_id=current_user.id)


@router.get(
    "/policies/{policy_id}/payments",
    response_model=list[PaymentResponse],
    summary="List Payment Transactions for Policy",
)
async def list_payments_endpoint(
    policy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[PaymentResponse]:
    """Retrieve all payment records for a policy."""
    return await list_policy_payments(session, policy_id)

