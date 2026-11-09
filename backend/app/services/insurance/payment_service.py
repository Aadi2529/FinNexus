"""Policy Payment Ledger Service for FinNexus Insurance Engine."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.audit import AuditLog
from app.db.models.insurance import (
    InsurancePolicy,
    InsurancePolicyPayment,
    InsurancePremiumSchedule,
)
from app.schemas.insurance import PaymentCreate, PaymentResponse


async def record_payment(
    session: AsyncSession,
    policy_id: uuid.UUID,
    payload: PaymentCreate,
    user_id: uuid.UUID | None = None,
) -> PaymentResponse:
    """Record a policy payment transaction and update linked premium installment to PAID."""
    # 1. Verify policy exists
    policy = (
        await session.execute(
            select(InsurancePolicy).where(InsurancePolicy.id == policy_id)
        )
    ).scalar_one_or_none()
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy with ID {policy_id} not found.",
        )

    # 1.5 Prevent duplicate transaction reference
    if payload.transaction_reference and payload.transaction_reference.strip():
        clean_ref = payload.transaction_reference.strip()
        dup_tx = await session.execute(
            select(InsurancePolicyPayment).where(
                func.lower(InsurancePolicyPayment.transaction_reference) == clean_ref.lower(),
                InsurancePolicyPayment.policy_id == policy_id,
            )
        )
        if dup_tx.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Payment transaction reference '{clean_ref}' has already been recorded for this policy.",
            )

    # 2. Check linked premium schedule or find earliest unpaid installment
    schedule: InsurancePremiumSchedule | None = None
    if payload.premium_schedule_id:
        schedule = (
            await session.execute(
                select(InsurancePremiumSchedule).where(
                    InsurancePremiumSchedule.id == payload.premium_schedule_id,
                    InsurancePremiumSchedule.policy_id == policy_id,
                )
            )
        ).scalar_one_or_none()
    else:
        # Find earliest unpaid schedule
        sched_stmt = (
            select(InsurancePremiumSchedule)
            .where(
                InsurancePremiumSchedule.policy_id == policy_id,
                InsurancePremiumSchedule.paid_date.is_(None),
            )
            .order_by(InsurancePremiumSchedule.installment_number.asc())
            .limit(1)
        )
        schedule = (await session.execute(sched_stmt)).scalar_one_or_none()

    payment = InsurancePolicyPayment(
        id=uuid.uuid4(),
        policy_id=policy_id,
        premium_schedule_id=schedule.id if schedule else None,
        payment_mode=payload.payment_mode.strip(),
        bank_name=payload.bank_name.strip() if payload.bank_name else None,
        transaction_reference=payload.transaction_reference.strip() if payload.transaction_reference else None,
        first_receipt_date=payload.first_receipt_date or payload.payment_date,
        payment_date=payload.payment_date,
        amount=payload.amount if payload.amount is not None else (schedule.installment_amount if schedule else policy.final_premium),
        status="COMPLETED",
        notes=payload.notes.strip() if payload.notes else None,
        document_id=payload.document_id,
        document_filename=payload.document_filename.strip() if payload.document_filename else None,
        created_by_id=user_id,
    )
    session.add(payment)

    # 3. If schedule was matched, update schedule status
    if schedule:
        existing_paid = (
            await session.execute(
                select(func.coalesce(func.sum(InsurancePolicyPayment.amount), Decimal("0.00")))
                .where(InsurancePolicyPayment.premium_schedule_id == schedule.id)
            )
        ).scalar_one()
        new_total = existing_paid + payment.amount
        if new_total >= schedule.amount:
            schedule.paid_date = payload.payment_date
            schedule.status = "PAID"
        else:
            schedule.status = "PARTIALLY_PAID"
        schedule.updated_at = datetime.now(UTC)

    # 4. If policy had no first receipt date, record it
    if not policy.first_receipt_date:
        policy.first_receipt_date = payload.payment_date
        policy.updated_at = datetime.now(UTC)

    # 5. Advance next_premium_due_date to next unpaid installment
    next_unpaid_stmt = (
        select(InsurancePremiumSchedule.due_date)
        .where(
            InsurancePremiumSchedule.policy_id == policy_id,
            InsurancePremiumSchedule.paid_date.is_(None),
            InsurancePremiumSchedule.id != (schedule.id if schedule else None),
        )
        .order_by(InsurancePremiumSchedule.installment_number.asc())
        .limit(1)
    )
    next_due = (await session.execute(next_unpaid_stmt)).scalar_one_or_none()
    policy.next_premium_due_date = next_due

    # Record Audit Log
    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=user_id,
        action="POLICY_PAYMENT_RECORDED",
        resource_type="policy",
        resource_id=policy.id,
        state_delta={
            "payment_id": str(payment.id),
            "amount": float(payment.amount),
            "payment_mode": payment.payment_mode,
            "transaction_reference": payment.transaction_reference,
            "installment_number": schedule.installment_number if schedule else None,
        },
        created_at=datetime.now(UTC),
    )
    session.add(audit)

    await session.commit()
    await session.refresh(payment)

    return PaymentResponse(
        id=payment.id,
        policy_id=payment.policy_id,
        premium_schedule_id=payment.premium_schedule_id,
        payment_mode=payment.payment_mode,
        bank_name=payment.bank_name,
        transaction_reference=payment.transaction_reference,
        first_receipt_date=payment.first_receipt_date,
        payment_date=payment.payment_date,
        amount=payment.amount,
        payment_amount=payment.amount,
        status=payment.status,
        notes=payment.notes,
        document_id=payment.document_id,
        document_filename=payment.document_filename,
        created_at=payment.created_at,
    )


async def list_policy_payments(
    session: AsyncSession,
    policy_id: uuid.UUID,
) -> list[PaymentResponse]:
    """Retrieve all payment transaction records for a policy."""
    query = (
        select(InsurancePolicyPayment)
        .where(InsurancePolicyPayment.policy_id == policy_id)
        .order_by(InsurancePolicyPayment.payment_date.desc())
    )
    payments = (await session.execute(query)).scalars().all()

    return [
        PaymentResponse(
            id=p.id,
            policy_id=p.policy_id,
            premium_schedule_id=p.premium_schedule_id,
            payment_mode=p.payment_mode,
            bank_name=p.bank_name,
            transaction_reference=p.transaction_reference,
            first_receipt_date=p.first_receipt_date,
            payment_date=p.payment_date,
            amount=p.amount,
            status=p.status,
            notes=p.notes,
            document_id=p.document_id,
            document_filename=p.document_filename,
            created_at=p.created_at,
        )
        for p in payments
    ]

