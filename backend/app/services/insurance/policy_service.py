"""Policy Issuance and Contract Management Service for FinNexus Insurance Engine."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import Integer, delete, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.crm import Customer
from app.db.models.audit import AuditLog
from app.core.insurance_categories import (
    CANONICAL_CATEGORIES,
    COMPANY_TYPE_ALLOWED_CATEGORY_CODES,
    categories_match,
    get_category_aliases,
    normalize_category_code,
    normalize_category_label,
)
from app.db.models.insurance import (
    InsuranceCompany,
    InsuranceCompanyCategory,
    InsuranceFamilyGroup,
    InsuranceFamilyMember,
    InsurancePlan,
    InsurancePlanBenefit,
    InsurancePlanRider,
    InsurancePolicy,
    InsurancePolicyCommission,
    InsurancePolicyHistory,
    InsurancePolicyMember,
    InsurancePolicyNominee,
    InsurancePolicyPayment,
    InsurancePolicyRider,
    InsurancePolicyYear,
    InsurancePremiumSchedule,
    InsurancePurchaseParty,
    InsuranceSubAgent,
)
from app.schemas.insurance import (
    PlanBenefitResponse,
    PlanRiderResponse,
    PolicyHistoryResponse,
    PolicyMemberCreate,
    PolicyMemberResponse,
    PolicyNomineeCreate,
    PolicyNomineeResponse,
    PolicyRenewalRequest,
    PolicyRenewalResponse,
    PolicyRiderResponse,
    PolicyStatusUpdate,
    PolicyYearResponse,
    PaginatedResponse,
    PaymentResponse,
    PolicyCommissionResponse,
    PolicyCreate,
    PolicyResponse,
    PolicyUpdate,
    PremiumScheduleResponse,
)
from app.services.insurance.commission_service import (
    calculate_and_record_policy_commission,
)
from app.services.insurance.payment_service import record_payment
from app.services.insurance.renewal_service import (
    calculate_schedule_status,
    generate_premium_schedules_for_policy,
)


async def create_policy(
    session: AsyncSession,
    payload: PolicyCreate,
    user_id: uuid.UUID | None = None,
) -> PolicyResponse:
    """Create a new policy contract with relational validations, schedules, and commission generation."""
    # 1. Uniqueness check on policy_number
    pol_num_clean = payload.policy_number.strip().upper()
    existing_num = await session.execute(
        select(InsurancePolicy).where(InsurancePolicy.policy_number == pol_num_clean)
    )
    if existing_num.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Policy Number '{pol_num_clean}' is already registered.",
        )

    # 2. Validate Customer exists
    cust = (
        await session.execute(
            select(Customer).where(Customer.id == payload.customer_id)
        )
    ).scalar_one_or_none()
    if not cust:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {payload.customer_id} not found.",
        )

    # 3. Validate Company exists and is active
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
    if not comp.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insurance Company '{comp.name}' is inactive. Cannot register policies under inactive carriers.",
        )
    # Check if company supports policy_type via supported categories or legacy field
    cat_rows = (
        await session.execute(
            select(InsuranceCompanyCategory.category).where(
                InsuranceCompanyCategory.company_id == comp.id,
                InsuranceCompanyCategory.is_active.is_(True),
            )
        )
    ).scalars().all()

    is_comp_compatible = False
    if cat_rows:
        is_comp_compatible = any(categories_match(sc, payload.policy_type) for sc in cat_rows)
    if not is_comp_compatible:
        is_comp_compatible = categories_match(comp.category, payload.policy_type)
    if not is_comp_compatible and getattr(comp, "company_type", None):
        allowed = COMPANY_TYPE_ALLOWED_CATEGORY_CODES.get(comp.company_type, [])
        if normalize_category_code(payload.policy_type) in allowed:
            is_comp_compatible = True

    if not is_comp_compatible:
        active_cat_labels = list({normalize_category_label(c) for c in cat_rows}) or [normalize_category_label(comp.category)]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insurance Company '{comp.name}' does not support '{payload.policy_type}' policies. Supported categories: {', '.join(active_cat_labels)}.",
        )

    # 4. Validate Plan exists, belongs to company, and is active
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
    if plan.company_id != payload.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Selected plan '{plan.name}' does not belong to company '{comp.name}'.",
        )
    if plan.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insurance Plan '{plan.name}' is inactive. Only active plans can be issued.",
        )
    if not categories_match(plan.line_of_business, payload.policy_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insurance Plan '{plan.name}' ({plan.line_of_business}) cannot be issued as a {payload.policy_type} policy.",
        )

    # 5. Validate Purchase Party if provided
    if payload.purchase_party_id:
        party = (
            await session.execute(
                select(InsurancePurchaseParty).where(InsurancePurchaseParty.id == payload.purchase_party_id)
            )
        ).scalar_one_or_none()
        if not party:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Purchase Party {payload.purchase_party_id} not found.",
            )

    # 6. Validate Sub-Agent if provided
    if payload.sub_agent_id:
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

    # Calculate default expiry date if omitted
    term_years = payload.policy_term_years or payload.term_years or 1
    start_date = payload.policy_start_date or payload.start_date or date.today()
    if payload.expiry_date:
        calc_expiry = payload.expiry_date
    else:
        try:
            calc_expiry = date(
                start_date.year + term_years,
                start_date.month,
                start_date.day,
            )
        except ValueError:
            calc_expiry = date(start_date.year + term_years, start_date.month, 28)

    policy_id = uuid.uuid4()
    policy = InsurancePolicy(
        id=policy_id,
        policy_number=pol_num_clean,
        policy_type=payload.policy_type.strip(),
        coverage_type=payload.coverage_type.strip().upper(),
        issue_date=payload.issue_date or payload.first_receipt_date or start_date or date.today(),
        proposal_number=payload.proposal_number.strip() if payload.proposal_number else None,
        business_type=payload.business_type.strip().upper(),
        previous_policy_number=payload.previous_policy_number.strip() if payload.previous_policy_number else None,
        previous_insurer=payload.previous_insurer.strip() if payload.previous_insurer else None,
        portability_continuity_details=payload.portability_continuity_details.strip() if payload.portability_continuity_details else None,
        product_variant=payload.product_variant.strip() if payload.product_variant else None,
        hospital_cash_benefit=payload.hospital_cash_benefit.strip().upper(),
        vehicle_registration_number=payload.vehicle_registration_number.strip().upper() if payload.vehicle_registration_number else None,
        vehicle_manufacturer=payload.vehicle_manufacturer.strip() if payload.vehicle_manufacturer else None,
        vehicle_model=payload.vehicle_model.strip() if payload.vehicle_model else None,
        vehicle_type=payload.vehicle_type.strip() if payload.vehicle_type else None,
        travel_destination=payload.travel_destination.strip() if payload.travel_destination else None,
        travel_type=payload.travel_type.strip() if payload.travel_type else None,
        intermediary_name=payload.intermediary_name.strip() if payload.intermediary_name else None,
        contact_city=payload.contact_city.strip() if payload.contact_city else cust.city,
        contact_pincode=payload.contact_pincode.strip() if payload.contact_pincode else cust.pincode,
        contact_mobile=payload.contact_mobile.strip() if payload.contact_mobile else cust.phone,
        contact_email=payload.contact_email.strip() if payload.contact_email else cust.email,
        commission_received_status=payload.commission_received_status.strip().upper(),
        actual_commission_received_amount=payload.actual_commission_received_amount,
        commission_received_date=payload.commission_received_date,
        commission_bank_reference=payload.commission_bank_reference.strip() if payload.commission_bank_reference else None,
        customer_id=payload.customer_id,
        company_id=payload.company_id,
        plan_id=payload.plan_id,
        purchase_party_id=payload.purchase_party_id,
        sub_agent_id=payload.sub_agent_id,
        term_years=term_years,
        sum_assured=payload.sum_assured,
        final_premium=payload.final_premium,
        net_premium=payload.net_premium,
        tax_amount=payload.tax_amount,
        is_single_premium=payload.is_single_premium,
        premium_mode=payload.premium_mode.strip(),
        policy_start_date=start_date,
        first_receipt_date=payload.first_receipt_date,
        expiry_date=calc_expiry,
        next_premium_due_date=payload.policy_start_date,
        status="ACTIVE",
        notes=payload.notes.strip() if payload.notes else None,
        created_by_id=user_id,
    )
    session.add(policy)
    await session.flush()

    # 6.5 Persist Nominees if provided
    if payload.nominees:
        for nom in payload.nominees:
            nom_record = InsurancePolicyNominee(
                id=uuid.uuid4(),
                policy_id=policy.id,
                full_name=nom.full_name.strip(),
                relationship=nom.relationship.strip(),
                date_of_birth=nom.date_of_birth,
                mobile_number=nom.mobile_number.strip() if nom.mobile_number else None,
                address=nom.address.strip() if nom.address else None,
                share_percentage=nom.share_percentage,
            )
            session.add(nom_record)
        await session.flush()

    # 6.6 Persist Selected Riders if provided
    selected_rider_ids = getattr(payload, "selected_rider_ids", None)
    if selected_rider_ids:
        clean_rider_ids = [uuid.UUID(str(rid)) if not isinstance(rid, uuid.UUID) else rid for rid in selected_rider_ids]
        unique_rider_ids = list(dict.fromkeys(clean_rider_ids))

        rider_rows = (
            await session.execute(
                select(InsurancePlanRider).where(
                    InsurancePlanRider.plan_id == payload.plan_id,
                    InsurancePlanRider.id.in_(unique_rider_ids),
                )
            )
        ).scalars().all()

        found_map = {r.id: r for r in rider_rows}
        missing_ids = [str(rid) for rid in unique_rider_ids if rid not in found_map]
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Selected rider ID(s) do not belong to plan '{plan.name}': {', '.join(missing_ids)}.",
            )

        now_utc = datetime.now(UTC)
        for rid in unique_rider_ids:
            r = found_map[rid]
            session.add(
                InsurancePolicyRider(
                    id=uuid.uuid4(),
                    policy_id=policy.id,
                    rider_id=r.id,
                    rider_name=r.name,
                    rider_description=r.description,
                    created_at=now_utc,
                )
            )
        await session.flush()

    for member in payload.members:
        session.add(
            InsurancePolicyMember(
                id=uuid.uuid4(),
                policy_id=policy.id,
                customer_id=member.customer_id,
                full_name=member.full_name.strip(),
                relationship=member.relationship.strip().upper(),
                date_of_birth=member.date_of_birth,
                gender=member.gender.strip().upper() if member.gender else None,
                mobile_number=member.mobile_number.strip() if member.mobile_number else None,
                email=member.email.strip() if member.email else None,
                address=member.address.strip() if member.address else None,
                member_code=member.member_code.strip() if member.member_code else None,
                individual_sum_insured=member.individual_sum_insured,
                notes=member.notes.strip() if member.notes else None,
            )
        )

    for year in payload.policy_years:
        session.add(
            InsurancePolicyYear(
                id=uuid.uuid4(),
                policy_id=policy.id,
                policy_year=year.policy_year,
                policy_number=year.policy_number.strip(),
                proposal_number=year.proposal_number.strip() if year.proposal_number else None,
                business_type=year.business_type.strip().upper(),
                prior_policy_number=year.prior_policy_number.strip() if year.prior_policy_number else None,
                product_variant=year.product_variant.strip() if year.product_variant else None,
                start_date=year.start_date,
                end_date=year.end_date,
                net_premium=year.net_premium,
                gross_premium=year.gross_premium,
                remarks=year.remarks.strip() if year.remarks else None,
            )
        )

    for index, history in enumerate(payload.policy_history, start=1):
        history_record = InsurancePolicyHistory(
            id=uuid.uuid4(),
            current_policy_id=policy.id,
            previous_policy_id=history.previous_policy_id,
            insurance_company_name=history.insurance_company_name.strip(),
            previous_policy_number=history.previous_policy_number.strip(),
            policy_business_type=history.policy_business_type.strip().upper(),
            history_sequence=history.history_sequence or index,
            policy_start_date=history.policy_start_date,
            policy_expiry_date=history.policy_expiry_date,
            sum_insured=history.sum_insured,
            net_premium=history.net_premium,
            gross_premium=history.gross_premium,
            product_variant=history.product_variant.strip() if history.product_variant else None,
            policy_status=history.policy_status.strip().upper() if history.policy_status else None,
            claim_history=history.claim_history.strip() if history.claim_history else None,
            insurer_contact=history.insurer_contact.strip() if history.insurer_contact else None,
            cumulative_bonus=history.cumulative_bonus.strip() if history.cumulative_bonus else None,
            continuity_details=history.continuity_details.strip() if history.continuity_details else None,
            waiting_period_waiver_details=history.waiting_period_waiver_details.strip() if history.waiting_period_waiver_details else None,
            remarks=history.remarks.strip() if history.remarks else None,
            is_external_policy=history.is_external_policy,
        )
        session.add(history_record)
        if history_record.history_sequence == 1:
            policy.previous_policy_id = history.previous_policy_id
            policy.previous_policy_number = history_record.previous_policy_number
            policy.previous_insurer = history_record.insurance_company_name
            policy.portability_continuity_details = history_record.continuity_details

    # 7. Generate installment schedules
    await generate_premium_schedules_for_policy(session, policy)

    # 8. Generate First Year Commission ledger record
    await calculate_and_record_policy_commission(
        session,
        policy,
        commission_type="FIRST_YEAR",
        gross_rate_override=payload.first_year_commission_rate,
        gross_amount_override=payload.first_year_commission_amount,
        sub_agent_amount_override=payload.sub_agent_commission_share,
    )

    # 9. If initial payment provided, record payment transaction
    if payload.initial_payment:
        await record_payment(session, policy.id, payload.initial_payment, user_id=user_id)

    # 10. Record Policy Creation in Audit Log
    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=user_id,
        action="POLICY_CREATED",
        resource_type="policy",
        resource_id=policy.id,
        state_delta={
            "policy_number": policy.policy_number,
            "policy_type": policy.policy_type,
            "status": policy.status,
            "sum_assured": float(policy.sum_assured),
            "final_premium": float(policy.final_premium),
            "nominees_count": len(payload.nominees) if payload.nominees else 0,
        },
        created_at=datetime.now(UTC),
    )
    session.add(audit)

    await session.commit()
    return await get_policy_detail(session, policy_id)


async def list_policies(
    session: AsyncSession,
    search: str | None = None,
    status_filter: str | None = None,
    policy_type: str | None = None,
    business_type: str | None = None,
    company_id: uuid.UUID | None = None,
    sub_agent_id: uuid.UUID | None = None,
    customer_id: uuid.UUID | None = None,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    expiry_date_from: date | None = None,
    expiry_date_to: date | None = None,
    issue_year: int | str | None = None,
    coverage_year: str | None = None,
    year_bucket: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 10,
) -> PaginatedResponse[PolicyResponse]:
    """Retrieve policies with pagination, search, carrier, and status filtering."""
    query = (
        select(InsurancePolicy)
        .options(
            selectinload(InsurancePolicy.customer),
            selectinload(InsurancePolicy.company),
            selectinload(InsurancePolicy.plan).selectinload(InsurancePlan.plan_benefits),
            selectinload(InsurancePolicy.purchase_party),
            selectinload(InsurancePolicy.sub_agent),
            selectinload(InsurancePolicy.payments),
            selectinload(InsurancePolicy.premium_schedules),
            selectinload(InsurancePolicy.nominees),
            selectinload(InsurancePolicy.members),
            selectinload(InsurancePolicy.policy_years),
            selectinload(InsurancePolicy.policy_history),
            selectinload(InsurancePolicy.renewals),
            selectinload(InsurancePolicy.policy_riders),
        )
    )

    if search and search.strip():
        s = f"%{search.strip().lower()}%"
        query = query.outerjoin(Customer, InsurancePolicy.customer_id == Customer.id).where(
            or_(
                func.lower(InsurancePolicy.policy_number).like(s),
                func.lower(Customer.first_name).like(s),
                func.lower(Customer.last_name).like(s),
                func.lower(Customer.phone).like(s),
                func.lower(Customer.company_name).like(s),
                func.lower(func.coalesce(InsurancePolicy.proposal_number, "")).like(s),
                func.lower(func.coalesce(InsurancePolicy.vehicle_registration_number, "")).like(s),
                func.lower(func.coalesce(InsurancePolicy.intermediary_name, "")).like(s),
                func.lower(func.coalesce(InsurancePolicy.contact_mobile, "")).like(s),
            )
        )
    if start_date_from:
        query = query.where(InsurancePolicy.policy_start_date >= start_date_from)
    if start_date_to:
        query = query.where(InsurancePolicy.policy_start_date <= start_date_to)
    if expiry_date_from:
        query = query.where(InsurancePolicy.expiry_date >= expiry_date_from)
    if expiry_date_to:
        query = query.where(InsurancePolicy.expiry_date <= expiry_date_to)

    # Policy Issue-Year Filter (authoritative issue date)
    effective_issue_date = func.coalesce(
        InsurancePolicy.issue_date,
        InsurancePolicy.first_receipt_date,
        func.date(InsurancePolicy.created_at),
        InsurancePolicy.policy_start_date,
    )
    target_issue_year: int | None = None
    if issue_year is not None and str(issue_year).strip().upper() != "ALL":
        try:
            target_issue_year = int(str(issue_year).strip())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="issue_year must be an integer year or 'ALL'.",
            ) from None
    elif coverage_year and coverage_year.strip().upper() != "ALL":
        year_text = coverage_year.strip().split("-", maxsplit=1)[0].split("–", maxsplit=1)[0].strip()
        try:
            target_issue_year = int(year_text)
        except ValueError:
            pass
    elif year_bucket and year_bucket.strip().isdigit():
        target_issue_year = int(year_bucket.strip())

    if target_issue_year is not None:
        query = query.where(
            func.extract("year", effective_issue_date) == target_issue_year
        )
    elif year_bucket and year_bucket.upper() not in ("ALL", ""):
        today = date.today()
        bucket = year_bucket.upper()
        if bucket == "CURRENT":
            query = query.where(
                InsurancePolicy.policy_start_date <= today,
                InsurancePolicy.expiry_date >= today,
            )
        elif bucket == "PREVIOUS":
            query = query.where(InsurancePolicy.expiry_date < today)
        elif bucket == "UPCOMING":
            query = query.where(InsurancePolicy.policy_start_date > today)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="year_bucket must be ALL, CURRENT, PREVIOUS, or UPCOMING.",
            )

    if status_filter and status_filter != "ALL":
        query = query.where(InsurancePolicy.status == status_filter.upper())
    if policy_type and policy_type != "ALL":
        query = query.where(InsurancePolicy.policy_type == policy_type)
    if business_type and business_type != "ALL":
        query = query.where(InsurancePolicy.business_type == business_type.upper())
    if company_id:
        query = query.where(InsurancePolicy.company_id == company_id)
    if sub_agent_id:
        query = query.where(InsurancePolicy.sub_agent_id == sub_agent_id)
    if customer_id:
        query = query.where(InsurancePolicy.customer_id == customer_id)

    sub = query.subquery()
    totals_query = select(
        func.count(),
        func.coalesce(func.sum(sub.c.sum_assured), 0),
        func.coalesce(func.sum(sub.c.final_premium), 0),
    ).select_from(sub)
    totals_row = (await session.execute(totals_query)).one()
    total = int(totals_row[0])
    total_sum_insured = Decimal(str(totals_row[1]))
    total_gross_premium = Decimal(str(totals_row[2]))

    offset = (page - 1) * page_size
    sort_col = getattr(InsurancePolicy, sort_by, InsurancePolicy.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())
    query = query.offset(offset).limit(page_size)
    policies = (await session.execute(query)).scalars().all()

    items: list[PolicyResponse] = []
    for p in policies:
        total_paid = sum((pay.amount for pay in p.payments), Decimal("0.00"))
        items.append(
            PolicyResponse(
                id=p.id,
                policy_number=p.policy_number,
                policy_type=p.policy_type,
                customer_id=p.customer_id,
                customer_name=p.customer.full_name if p.customer else None,
                customer_phone=p.customer.phone if p.customer else None,
                company_id=p.company_id,
                company_name=p.company.name if p.company else None,
                company_code=p.company.code if p.company else None,
                plan_id=p.plan_id,
                plan_name=p.plan.name if p.plan else None,
                plan_code=p.plan.code if p.plan else None,
                purchase_party_id=p.purchase_party_id,
                purchase_party_name=p.purchase_party.name if p.purchase_party else None,
                sub_agent_id=p.sub_agent_id,
                sub_agent_name=p.sub_agent.full_name if p.sub_agent else None,
                term_years=p.term_years,
                sum_assured=p.sum_assured,
                final_premium=p.final_premium,
                is_single_premium=p.is_single_premium,
                premium_mode=p.premium_mode,
                policy_start_date=p.policy_start_date,
                first_receipt_date=p.first_receipt_date,
                expiry_date=p.expiry_date,
                next_premium_due_date=p.next_premium_due_date,
                status=p.status,
                notes=p.notes,
                created_at=p.created_at,
                updated_at=p.updated_at,
                issue_date=p.issue_date,
                payments_count=len(p.payments),
                total_paid=total_paid,
                net_premium=p.net_premium,
                gross_premium=p.gross_premium,
                tax_amount=p.tax_amount,
                proposal_number=p.proposal_number,
                business_type=p.business_type or "NEW",
                previous_policy_number=p.previous_policy_number,
                previous_insurer=p.previous_insurer,
                portability_continuity_details=p.portability_continuity_details,
                product_variant=p.product_variant,
                hospital_cash_benefit=p.hospital_cash_benefit or "NOT_APPLICABLE",
                vehicle_registration_number=p.vehicle_registration_number,
                vehicle_manufacturer=p.vehicle_manufacturer,
                vehicle_model=p.vehicle_model,
                vehicle_type=p.vehicle_type,
                travel_destination=p.travel_destination,
                travel_type=p.travel_type,
                intermediary_name=p.intermediary_name or (p.purchase_party.name if p.purchase_party else None),
                contact_city=p.contact_city or (p.customer.city if p.customer else None),
                contact_pincode=p.contact_pincode or (p.customer.pincode if p.customer else None),
                contact_mobile=p.contact_mobile or (p.customer.phone if p.customer else None),
                contact_email=p.contact_email or (p.customer.email if p.customer else None),
                commission_received_status=p.commission_received_status or "PENDING",
                actual_commission_received_amount=p.actual_commission_received_amount,
                commission_received_date=p.commission_received_date,
                commission_bank_reference=p.commission_bank_reference,
                coverage_type=p.coverage_type or "INDIVIDUAL",
                members_count=len(p.members or []),
                members=[PolicyMemberResponse.model_validate(member) for member in p.members or []],
                policy_years=[PolicyYearResponse.model_validate(year) for year in p.policy_years or []],
                policy_history=[
                    PolicyHistoryResponse.model_validate(history)
                    for history in p.policy_history or []
                ],
                previous_policy_id=p.previous_policy_id,
                renewals_count=len(p.renewals or []),
                nominees=[
                    PolicyNomineeResponse(
                        id=n.id,
                        policy_id=n.policy_id,
                        full_name=n.full_name,
                        relationship=n.relationship,
                        date_of_birth=n.date_of_birth,
                        mobile_number=n.mobile_number,
                        address=n.address,
                        share_percentage=n.share_percentage,
                        created_at=n.created_at,
                        updated_at=n.updated_at,
                    )
                    for n in (p.nominees or [])
                ],
                selected_rider_ids=[r.rider_id for r in (p.policy_riders or []) if r.rider_id],
                selected_riders=[PolicyRiderResponse.model_validate(r) for r in (p.policy_riders or [])],
                riders=[PolicyRiderResponse.model_validate(r) for r in (p.policy_riders or [])],
                plan_benefits=[PlanBenefitResponse.model_validate(b) for b in (p.plan.plan_benefits if p.plan else [])],
            )
        )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        total_sum_insured=total_sum_insured,
        total_gross_premium=total_gross_premium,
    )


async def get_policy_detail(
    session: AsyncSession,
    policy_id: uuid.UUID,
) -> PolicyResponse:
    """Retrieve complete policy contract with linked carrier, plan, customer, schedules, and payments."""
    query = (
        select(InsurancePolicy)
        .options(
            selectinload(InsurancePolicy.customer),
            selectinload(InsurancePolicy.company),
            selectinload(InsurancePolicy.plan).selectinload(InsurancePlan.plan_benefits),
            selectinload(InsurancePolicy.purchase_party),
            selectinload(InsurancePolicy.sub_agent),
            selectinload(InsurancePolicy.payments),
            selectinload(InsurancePolicy.premium_schedules),
            selectinload(InsurancePolicy.commissions).selectinload(InsurancePolicyCommission.sub_agent),
            selectinload(InsurancePolicy.nominees),
            selectinload(InsurancePolicy.members),
            selectinload(InsurancePolicy.policy_years),
            selectinload(InsurancePolicy.policy_history),
            selectinload(InsurancePolicy.renewals),
            selectinload(InsurancePolicy.policy_riders),
        )
        .execution_options(populate_existing=True)
        .where(InsurancePolicy.id == policy_id)
    )
    p = (await session.execute(query)).scalar_one_or_none()
    if not p:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy {policy_id} not found.",
        )

    total_paid = sum((pay.amount for pay in p.payments), Decimal("0.00"))

    scheds = [
        PremiumScheduleResponse(
            id=s.id,
            policy_id=s.policy_id,
            installment_number=s.installment_number,
            due_date=s.due_date,
            amount=s.amount,
            status=calculate_schedule_status(s.due_date, s.paid_date, p.expiry_date),
            paid_date=s.paid_date,
            created_at=s.created_at,
        )
        for s in (p.premium_schedules or [])
    ]

    pays = [
        PaymentResponse(
            id=pay.id,
            policy_id=pay.policy_id,
            premium_schedule_id=pay.premium_schedule_id,
            payment_mode=pay.payment_mode,
            bank_name=pay.bank_name,
            transaction_reference=pay.transaction_reference,
            first_receipt_date=pay.first_receipt_date,
            payment_date=pay.payment_date,
            amount=pay.amount,
            status=pay.status,
            notes=pay.notes,
            created_at=pay.created_at,
        )
        for pay in (p.payments or [])
    ]

    comms = [
        PolicyCommissionResponse(
            id=c.id,
            policy_id=c.policy_id,
            sub_agent_id=c.sub_agent_id,
            sub_agent_name=c.sub_agent.full_name if c.sub_agent else None,
            commission_type=c.commission_type,
            gross_commission_amount=c.gross_commission_amount,
            gross_commission_rate=c.gross_commission_rate,
            sub_agent_amount=c.sub_agent_amount,
            firm_net_amount=c.firm_net_amount,
            split_rule_applied=c.split_rule_applied,
            status=c.status,
            payment_date=c.payment_date,
            notes=c.notes,
            created_at=c.created_at,
        )
        for c in (p.commissions or [])
    ]

    return PolicyResponse(
        id=p.id,
        policy_number=p.policy_number,
        policy_type=p.policy_type,
        customer_id=p.customer_id,
        customer_name=p.customer.full_name if p.customer else None,
        customer_phone=p.customer.phone if p.customer else None,
        company_id=p.company_id,
        company_name=p.company.name if p.company else None,
        company_code=p.company.code if p.company else None,
        plan_id=p.plan_id,
        plan_name=p.plan.name if p.plan else None,
        plan_code=p.plan.code if p.plan else None,
        purchase_party_id=p.purchase_party_id,
        purchase_party_name=p.purchase_party.name if p.purchase_party else None,
        sub_agent_id=p.sub_agent_id,
        sub_agent_name=p.sub_agent.full_name if p.sub_agent else None,
        term_years=p.term_years,
        sum_assured=p.sum_assured,
        final_premium=p.final_premium,
        is_single_premium=p.is_single_premium,
        premium_mode=p.premium_mode,
        policy_start_date=p.policy_start_date,
        first_receipt_date=p.first_receipt_date,
        expiry_date=p.expiry_date,
        next_premium_due_date=p.next_premium_due_date,
        status=p.status,
        notes=p.notes,
        created_at=p.created_at,
        updated_at=p.updated_at,
        payments_count=len(pays),
        total_paid=total_paid,
        schedules=scheds,
        payments=pays,
        commissions=comms,
        issue_date=p.issue_date,
        net_premium=p.net_premium,
        gross_premium=p.gross_premium,
        tax_amount=p.tax_amount,
        proposal_number=p.proposal_number,
        business_type=p.business_type or "NEW",
        previous_policy_number=p.previous_policy_number,
        previous_insurer=p.previous_insurer,
        portability_continuity_details=p.portability_continuity_details,
        product_variant=p.product_variant,
        hospital_cash_benefit=p.hospital_cash_benefit or "NOT_APPLICABLE",
        vehicle_registration_number=p.vehicle_registration_number,
        vehicle_manufacturer=p.vehicle_manufacturer,
        vehicle_model=p.vehicle_model,
        vehicle_type=p.vehicle_type,
        travel_destination=p.travel_destination,
        travel_type=p.travel_type,
        intermediary_name=p.intermediary_name or (p.purchase_party.name if p.purchase_party else None),
        contact_city=p.contact_city or (p.customer.city if p.customer else None),
        contact_pincode=p.contact_pincode or (p.customer.pincode if p.customer else None),
        contact_mobile=p.contact_mobile or (p.customer.phone if p.customer else None),
        contact_email=p.contact_email or (p.customer.email if p.customer else None),
        commission_received_status=p.commission_received_status or "PENDING",
        actual_commission_received_amount=p.actual_commission_received_amount,
        commission_received_date=p.commission_received_date,
        commission_bank_reference=p.commission_bank_reference,
        coverage_type=p.coverage_type or "INDIVIDUAL",
        members_count=len(p.members or []),
        members=[PolicyMemberResponse.model_validate(member) for member in p.members or []],
        policy_years=[PolicyYearResponse.model_validate(year) for year in p.policy_years or []],
        policy_history=[
            PolicyHistoryResponse.model_validate(history)
            for history in p.policy_history or []
        ],
        previous_policy_id=p.previous_policy_id,
        renewals_count=len(p.renewals or []),
        nominees=[
            PolicyNomineeResponse(
                id=n.id,
                policy_id=n.policy_id,
                full_name=n.full_name,
                relationship=n.relationship,
                date_of_birth=n.date_of_birth,
                mobile_number=n.mobile_number,
                address=n.address,
                share_percentage=n.share_percentage,
                created_at=n.created_at,
                updated_at=n.updated_at,
            )
            for n in (p.nominees or [])
        ],
        selected_rider_ids=[r.rider_id for r in (p.policy_riders or []) if r.rider_id],
        selected_riders=[PolicyRiderResponse.model_validate(r) for r in (p.policy_riders or [])],
        riders=[PolicyRiderResponse.model_validate(r) for r in (p.policy_riders or [])],
        plan_benefits=[PlanBenefitResponse.model_validate(b) for b in (p.plan.plan_benefits if p.plan else [])],
    )


async def update_policy(
    session: AsyncSession,
    policy_id: uuid.UUID,
    payload: PolicyUpdate,
    user_id: uuid.UUID | None = None,
) -> PolicyResponse:
    """Update policy attributes."""
    policy = (
        await session.execute(
            select(InsurancePolicy).where(InsurancePolicy.id == policy_id)
        )
    ).scalar_one_or_none()
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy {policy_id} not found.",
        )

    if payload.policy_number is not None:
        new_num = payload.policy_number.strip().upper()
        if new_num != policy.policy_number:
            existing = await session.execute(
                select(InsurancePolicy).where(InsurancePolicy.policy_number == new_num)
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Policy number '{new_num}' is already in use.",
                )
            policy.policy_number = new_num

    if payload.policy_type is not None:
        policy.policy_type = payload.policy_type.strip()
    if payload.coverage_type is not None:
        policy.coverage_type = payload.coverage_type.strip().upper()
    if payload.issue_date is not None:
        policy.issue_date = payload.issue_date
    if payload.sum_assured is not None:
        policy.sum_assured = payload.sum_assured
    if payload.final_premium is not None:
        policy.final_premium = payload.final_premium
    elif payload.gross_premium is not None:
        policy.final_premium = payload.gross_premium
    if payload.net_premium is not None:
        policy.net_premium = payload.net_premium
    if payload.tax_amount is not None:
        policy.tax_amount = payload.tax_amount
    if payload.term_years is not None:
        policy.term_years = payload.term_years
    if payload.premium_mode is not None:
        policy.premium_mode = payload.premium_mode.strip().upper()
    if payload.policy_start_date is not None:
        policy.policy_start_date = payload.policy_start_date
    if payload.expiry_date is not None:
        policy.expiry_date = payload.expiry_date
    if payload.status is not None:
        policy.status = payload.status.strip().upper()
    if payload.purchase_party_id is not None:
        policy.purchase_party_id = payload.purchase_party_id
    if payload.sub_agent_id is not None:
        policy.sub_agent_id = payload.sub_agent_id
    if payload.notes is not None:
        policy.notes = payload.notes.strip()
    for field in (
        "proposal_number",
        "previous_policy_number",
        "previous_insurer",
        "portability_continuity_details",
        "product_variant",
        "vehicle_manufacturer",
        "vehicle_model",
        "vehicle_type",
        "travel_destination",
        "travel_type",
        "intermediary_name",
        "contact_city",
        "contact_pincode",
        "contact_mobile",
        "contact_email",
        "commission_bank_reference",
    ):
        value = getattr(payload, field)
        if value is not None:
            setattr(policy, field, value.strip() or None)
    if payload.business_type is not None:
        policy.business_type = payload.business_type.strip().upper()
    if payload.hospital_cash_benefit is not None:
        policy.hospital_cash_benefit = payload.hospital_cash_benefit.strip().upper()
    if payload.vehicle_registration_number is not None:
        policy.vehicle_registration_number = payload.vehicle_registration_number.strip().upper() or None
    if payload.commission_received_status is not None:
        policy.commission_received_status = payload.commission_received_status.strip().upper()
    if payload.actual_commission_received_amount is not None:
        policy.actual_commission_received_amount = payload.actual_commission_received_amount
    if payload.commission_received_date is not None:
        policy.commission_received_date = payload.commission_received_date

    if payload.nominees is not None:
        # Validate nominee shares sum to 100%
        if len(payload.nominees) > 0:
            tot = sum(Decimal(str(n.share_percentage or 100)) for n in payload.nominees)
            if abs(tot - Decimal("100.00")) > Decimal("0.01"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Nominee share percentages must total 100% (currently {tot}%).",
                )
        # Delete existing nominees and recreate
        await session.execute(delete(InsurancePolicyNominee).where(InsurancePolicyNominee.policy_id == policy_id))
        for nom in payload.nominees:
            nom_rec = InsurancePolicyNominee(
                id=uuid.uuid4(),
                policy_id=policy.id,
                full_name=nom.full_name.strip(),
                relationship=nom.relationship.strip(),
                date_of_birth=nom.date_of_birth,
                mobile_number=nom.mobile_number.strip() if nom.mobile_number else None,
                address=nom.address.strip() if nom.address else None,
                share_percentage=nom.share_percentage,
            )
            session.add(nom_rec)

    if payload.members is not None:
        if (payload.coverage_type or policy.coverage_type).upper() == "FAMILY_FLOATER":
            valid_members = [member for member in payload.members if member.full_name.strip()]
            if len(valid_members) < 2:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Family Floater requires at least 2 insured members. Please add at least one more member.",
                )
        await session.execute(
            delete(InsurancePolicyMember).where(
                InsurancePolicyMember.policy_id == policy_id
            )
        )
        for member in payload.members:
            session.add(
                InsurancePolicyMember(
                    id=uuid.uuid4(),
                    policy_id=policy.id,
                    customer_id=member.customer_id,
                    full_name=member.full_name.strip(),
                    relationship=member.relationship.strip().upper(),
                    date_of_birth=member.date_of_birth,
                    gender=member.gender.strip().upper() if member.gender else None,
                    mobile_number=member.mobile_number.strip() if member.mobile_number else None,
                    email=member.email.strip() if member.email else None,
                    address=member.address.strip() if member.address else None,
                    member_code=member.member_code.strip() if member.member_code else None,
                    individual_sum_insured=member.individual_sum_insured,
                    notes=member.notes.strip() if member.notes else None,
                )
            )

    if payload.policy_years is not None:
        await session.execute(
            delete(InsurancePolicyYear).where(
                InsurancePolicyYear.policy_id == policy_id
            )
        )
        for year in payload.policy_years:
            session.add(
                InsurancePolicyYear(
                    id=uuid.uuid4(),
                    policy_id=policy.id,
                    policy_year=year.policy_year,
                    policy_number=year.policy_number.strip(),
                    proposal_number=year.proposal_number.strip() if year.proposal_number else None,
                    business_type=year.business_type.strip().upper(),
                    prior_policy_number=year.prior_policy_number.strip() if year.prior_policy_number else None,
                    product_variant=year.product_variant.strip() if year.product_variant else None,
                    start_date=year.start_date,
                    end_date=year.end_date,
                    net_premium=year.net_premium,
                    gross_premium=year.gross_premium,
                    remarks=year.remarks.strip() if year.remarks else None,
                )
            )

    if payload.policy_history is not None:
        await session.execute(
            delete(InsurancePolicyHistory).where(
                InsurancePolicyHistory.current_policy_id == policy_id
            )
        )
        for index, history in enumerate(payload.policy_history, start=1):
            history_record = InsurancePolicyHistory(
                id=uuid.uuid4(),
                current_policy_id=policy.id,
                previous_policy_id=history.previous_policy_id,
                insurance_company_name=history.insurance_company_name.strip(),
                previous_policy_number=history.previous_policy_number.strip(),
                policy_business_type=history.policy_business_type.strip().upper(),
                history_sequence=history.history_sequence or index,
                policy_start_date=history.policy_start_date,
                policy_expiry_date=history.policy_expiry_date,
                sum_insured=history.sum_insured,
                net_premium=history.net_premium,
                gross_premium=history.gross_premium,
                product_variant=history.product_variant.strip() if history.product_variant else None,
                policy_status=history.policy_status.strip().upper() if history.policy_status else None,
                claim_history=history.claim_history.strip() if history.claim_history else None,
                insurer_contact=history.insurer_contact.strip() if history.insurer_contact else None,
                cumulative_bonus=history.cumulative_bonus.strip() if history.cumulative_bonus else None,
                continuity_details=history.continuity_details.strip() if history.continuity_details else None,
                waiting_period_waiver_details=history.waiting_period_waiver_details.strip() if history.waiting_period_waiver_details else None,
                remarks=history.remarks.strip() if history.remarks else None,
                is_external_policy=history.is_external_policy,
            )
            session.add(history_record)
            if history_record.history_sequence == 1:
                policy.previous_policy_id = history.previous_policy_id
                policy.previous_policy_number = history_record.previous_policy_number
                policy.previous_insurer = history_record.insurance_company_name
                policy.portability_continuity_details = history_record.continuity_details
        if not payload.policy_history:
            policy.previous_policy_id = None
            policy.previous_policy_number = None
            policy.previous_insurer = None
            policy.portability_continuity_details = None

    if getattr(payload, "selected_rider_ids", None) is not None:
        clean_rider_ids = [uuid.UUID(str(rid)) if not isinstance(rid, uuid.UUID) else rid for rid in payload.selected_rider_ids]
        unique_rider_ids = list(dict.fromkeys(clean_rider_ids))

        target_plan_id = policy.plan_id
        rider_rows = (
            await session.execute(
                select(InsurancePlanRider).where(
                    InsurancePlanRider.plan_id == target_plan_id,
                    InsurancePlanRider.id.in_(unique_rider_ids),
                )
            )
        ).scalars().all()

        found_map = {r.id: r for r in rider_rows}
        missing_ids = [str(rid) for rid in unique_rider_ids if rid not in found_map]
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Selected rider ID(s) do not belong to the policy's plan: {', '.join(missing_ids)}.",
            )

        await session.execute(
            delete(InsurancePolicyRider).where(InsurancePolicyRider.policy_id == policy.id)
        )
        now_utc = datetime.now(UTC)
        for rid in unique_rider_ids:
            r = found_map[rid]
            session.add(
                InsurancePolicyRider(
                    id=uuid.uuid4(),
                    policy_id=policy.id,
                    rider_id=r.id,
                    rider_name=r.name,
                    rider_description=r.description,
                    created_at=now_utc,
                )
            )

    policy.updated_at = datetime.now(UTC)
    if user_id:
        audit = AuditLog(
            id=uuid.uuid4(),
            actor_id=user_id,
            action="POLICY_UPDATED",
            resource_type="policy",
            resource_id=policy.id,
            state_delta={
                "policy_number": policy.policy_number,
                "status": policy.status,
                "sum_assured": float(policy.sum_assured),
                "final_premium": float(policy.final_premium),
            },
            created_at=datetime.now(UTC),
        )
        session.add(audit)
    await session.commit()
    return await get_policy_detail(session, policy_id)


async def delete_policy(
    session: AsyncSession,
    policy_id: uuid.UUID,
) -> None:
    """Safely delete policy contract if no payment records exist."""
    policy = (
        await session.execute(
            select(InsurancePolicy).where(InsurancePolicy.id == policy_id)
        )
    ).scalar_one_or_none()
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy {policy_id} not found.",
        )

    # Check payments
    pay_count = (
        await session.execute(
            select(func.count()).where(InsurancePolicyPayment.policy_id == policy_id)
        )
    ).scalar_one()

    if pay_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot physically delete Policy '{policy.policy_number}' because {pay_count} recorded payment transaction(s) exist. Please cancel or deactivate the policy instead.",
        )

    await session.execute(delete(InsurancePremiumSchedule).where(InsurancePremiumSchedule.policy_id == policy_id))
    await session.execute(delete(InsurancePolicyCommission).where(InsurancePolicyCommission.policy_id == policy_id))
    await session.delete(policy)
    await session.commit()


async def get_policy_issue_years(session: AsyncSession) -> dict[str, Any]:
    """Retrieve distinct policy issue years and year-wise summary statistics."""
    effective_issue_date = func.coalesce(
        InsurancePolicy.issue_date,
        InsurancePolicy.first_receipt_date,
        func.date(InsurancePolicy.created_at),
        InsurancePolicy.policy_start_date,
    )
    year_expr = func.extract("year", effective_issue_date).cast(Integer)

    years_res = await session.execute(
        select(year_expr.label("yr"))
        .where(year_expr.is_not(None))
        .distinct()
        .order_by(desc("yr"))
    )
    years = [int(r[0]) for r in years_res.all() if r[0] is not None]

    overall_res = await session.execute(
        select(
            func.count(InsurancePolicy.id),
            func.coalesce(func.sum(InsurancePolicy.sum_assured), 0),
            func.coalesce(func.sum(InsurancePolicy.final_premium), 0),
        )
    )
    overall_row = overall_res.one()

    by_year: dict[str, Any] = {}
    for yr in years:
        yr_res = await session.execute(
            select(
                func.count(InsurancePolicy.id),
                func.coalesce(func.sum(InsurancePolicy.sum_assured), 0),
                func.coalesce(func.sum(InsurancePolicy.final_premium), 0),
            ).where(year_expr == yr)
        )
        row = yr_res.one()
        by_year[str(yr)] = {
            "year": yr,
            "total_policies": int(row[0]),
            "total_sum_insured": Decimal(str(row[1])),
            "total_gross_premium": Decimal(str(row[2])),
        }

    return {
        "years": years,
        "total_policies": int(overall_row[0]),
        "total_sum_insured": Decimal(str(overall_row[1])),
        "total_gross_premium": Decimal(str(overall_row[2])),
        "by_year": by_year,
    }


async def get_policy_lookup_data(
    session: AsyncSession,
    category: str | None = None,
) -> dict[str, Any]:
    """Retrieve dropdown options for policy creation shortcuts with robust canonical category filtering."""
    has_filter = bool(category and category.strip() and category.strip().upper() != "ALL")
    aliases = get_category_aliases(category.strip()) if has_filter else []

    category_companies = select(InsuranceCompany.id)
    if has_filter:
        category_companies = (
            category_companies.outerjoin(
                InsuranceCompanyCategory,
                InsuranceCompanyCategory.company_id == InsuranceCompany.id,
            )
            .where(
                or_(
                    func.upper(InsuranceCompany.category).in_(aliases),
                    func.upper(InsuranceCompanyCategory.category).in_(aliases),
                )
            )
            .distinct()
        )

    # Active companies
    companies_query = select(
        InsuranceCompany.id,
        InsuranceCompany.name,
        InsuranceCompany.code,
        InsuranceCompany.category,
        InsuranceCompany.is_active,
        InsuranceCompany.company_type,
    )
    if has_filter:
        companies_query = companies_query.where(InsuranceCompany.id.in_(category_companies))
    companies = (
        await session.execute(
            companies_query.where(InsuranceCompany.is_active.is_(True)).order_by(
                InsuranceCompany.name
            )
        )
    ).all()

    # Supported categories mapping for companies
    comp_ids = [c[0] for c in companies]
    comp_cats_map: dict[uuid.UUID, list[str]] = {}
    if comp_ids:
        cat_rows = (
            await session.execute(
                select(InsuranceCompanyCategory.company_id, InsuranceCompanyCategory.category).where(
                    InsuranceCompanyCategory.company_id.in_(comp_ids),
                    InsuranceCompanyCategory.is_active.is_(True),
                )
            )
        ).all()
        for cid, cat in cat_rows:
            lbl = normalize_category_label(cat)
            if lbl not in ("Composite Insurance", "General Insurance", "Other General Insurance"):
                if lbl not in comp_cats_map.setdefault(cid, []):
                    comp_cats_map[cid].append(lbl)

    # Active plans
    plans_query = (
        select(InsurancePlan)
        .options(
            selectinload(InsurancePlan.plan_riders),
            selectinload(InsurancePlan.plan_benefits),
        )
    )
    if has_filter:
        plans_query = plans_query.where(
            func.upper(InsurancePlan.line_of_business).in_(aliases)
        )
    plans = (
        await session.execute(
            plans_query.where(InsurancePlan.status == "ACTIVE").order_by(
                InsurancePlan.name
            )
        )
    ).scalars().all()

    # Active purchase parties
    parties = (
        await session.execute(
            select(
                InsurancePurchaseParty.id,
                InsurancePurchaseParty.name,
                InsurancePurchaseParty.code,
                InsurancePurchaseParty.is_active,
            )
            .where(InsurancePurchaseParty.is_active.is_(True))
            .order_by(InsurancePurchaseParty.name)
        )
    ).all()

    # Active sub agents
    agents = (
        await session.execute(
            select(
                InsuranceSubAgent.id,
                InsuranceSubAgent.full_name,
                InsuranceSubAgent.agent_code,
                InsuranceSubAgent.status,
            )
            .where(InsuranceSubAgent.status == "ACTIVE")
            .order_by(InsuranceSubAgent.full_name)
        )
    ).all()

    # Customers (Individual + Corporate)
    customers = (
        await session.execute(
            select(
                Customer.id,
                Customer.first_name,
                Customer.last_name,
                Customer.company_name,
                Customer.phone,
                Customer.customer_type,
                Customer.email,
                Customer.city,
                Customer.state,
                Customer.pincode,
                Customer.address,
            )
            .where(Customer.is_archived.is_(False))
            .order_by(Customer.first_name)
            .limit(500)
        )
    ).all()

    return {
        "companies": [
            {
                "id": str(c[0]),
                "name": c[1],
                "code": c[2],
                "category": c[3] or "",
                "is_active": bool(c[4]),
                "company_type": c[5] or "General Insurance",
                "supported_categories": comp_cats_map.get(
                    c[0],
                    [normalize_category_label(c[3])] if c[3] else ["General Insurance"],
                ),
            }
            for c in companies
        ],
        "plans": [
            {
                "id": str(p.id),
                "name": p.name,
                "code": p.code,
                "company_id": str(p.company_id),
                "line_of_business": p.line_of_business or "",
                "lob": p.line_of_business or "",
                "policy_type": p.line_of_business or "",
                "status": p.status or "ACTIVE",
                "is_active": (p.status == "ACTIVE"),
                "riders": [
                    {"id": str(r.id), "name": r.name, "description": r.description}
                    for r in (p.plan_riders or [])
                ],
                "benefits": [
                    {"id": str(b.id), "name": b.name, "description": b.description}
                    for b in (p.plan_benefits or [])
                ],
            }
            for p in plans
        ],
        "purchase_parties": [
            {
                "id": str(pp[0]),
                "name": pp[1],
                "code": pp[2],
                "is_active": bool(pp[3]),
            }
            for pp in parties
        ],
        "sub_agents": [
            {
                "id": str(a[0]),
                "full_name": a[1],
                "name": a[1],
                "agent_code": a[2],
                "code": a[2],
                "status": a[3] or "ACTIVE",
                "is_active": (a[3] == "ACTIVE"),
            }
            for a in agents
        ],
        "customers": [
            {
                "id": str(cu[0]),
                "first_name": cu[1] or "",
                "last_name": cu[2] or "",
                "full_name": (
                    cu[3]
                    if (cu[5] or "").upper() == "CORPORATE" and cu[3]
                    else f"{cu[1] or ''} {cu[2] or ''}".strip()
                )
                or "Customer",
                "name": (
                    cu[3]
                    if (cu[5] or "").upper() == "CORPORATE" and cu[3]
                    else f"{cu[1] or ''} {cu[2] or ''}".strip()
                )
                or "Customer",
                "company_name": cu[3] or "",
                "phone": cu[4] or "",
                "email": cu[6] or "",
                "type": (cu[5] or "INDIVIDUAL").upper(),
                "customer_type": (cu[5] or "INDIVIDUAL").upper(),
                "city": cu[7] or "",
                "state": cu[8] or "",
                "pincode": cu[9] or "",
                "address": cu[10] or "",
            }
            for cu in customers
        ],
        "issue_years": (await get_policy_issue_years(session))["years"],
        "categories": CANONICAL_CATEGORIES,
    }


async def renew_policy_contract(
    session: AsyncSession,
    policy_id: uuid.UUID,
    payload: PolicyRenewalRequest,
    user_id: uuid.UUID | None = None,
) -> PolicyRenewalResponse:
    """Issue a linked renewal policy while keeping the prior contract unchanged."""
    policy = (
        await session.execute(
            select(InsurancePolicy)
            .options(
                selectinload(InsurancePolicy.customer),
                selectinload(InsurancePolicy.company),
                selectinload(InsurancePolicy.plan),
                selectinload(InsurancePolicy.purchase_party),
                selectinload(InsurancePolicy.sub_agent),
                selectinload(InsurancePolicy.members),
                selectinload(InsurancePolicy.nominees),
                selectinload(InsurancePolicy.policy_years),
                selectinload(InsurancePolicy.policy_history),
                selectinload(InsurancePolicy.policy_riders),
            )
            .where(InsurancePolicy.id == policy_id)
        )
    ).scalar_one_or_none()

    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy {policy_id} not found.",
        )

    if policy.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot renew a cancelled policy contract.",
        )

    renewed_number = (
        payload.new_policy_number.strip().upper()
        if payload.new_policy_number and payload.new_policy_number.strip()
        else f"{policy.policy_number}-R1"
    )
    existing_number = await session.execute(
        select(InsurancePolicy.id).where(InsurancePolicy.policy_number == renewed_number)
    )
    if existing_number.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Policy Number '{renewed_number}' is already registered.",
        )

    start_date = (
        payload.new_start_date
        or payload.renewal_date
        or (policy.expiry_date + timedelta(days=1))
    )
    term_years = payload.renew_term_years
    if payload.new_expiry_date:
        new_expiry = payload.new_expiry_date
    else:
        from app.services.insurance.renewal_service import _add_months

        new_expiry = _add_months(start_date, term_years * 12) - timedelta(days=1)
    if new_expiry <= start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Renewal expiry date must be strictly after the renewal start date.",
        )

    renewal_premium = (
        payload.new_premium
        if payload.new_premium is not None
        else policy.final_premium
    )
    renewed_policy_id = uuid.uuid4()
    renewed_policy = InsurancePolicy(
        id=renewed_policy_id,
        policy_number=renewed_number,
        policy_type=policy.policy_type,
        coverage_type=policy.coverage_type,
        proposal_number=None,
        business_type="RENEW",
        previous_policy_id=policy.id,
        previous_policy_number=policy.policy_number,
        previous_insurer=policy.company.name if policy.company else None,
        portability_continuity_details=policy.portability_continuity_details,
        product_variant=policy.product_variant,
        hospital_cash_benefit=policy.hospital_cash_benefit,
        vehicle_registration_number=policy.vehicle_registration_number,
        vehicle_manufacturer=policy.vehicle_manufacturer,
        vehicle_model=policy.vehicle_model,
        vehicle_type=policy.vehicle_type,
        travel_destination=policy.travel_destination,
        travel_type=policy.travel_type,
        intermediary_name=policy.intermediary_name,
        contact_city=policy.contact_city,
        contact_pincode=policy.contact_pincode,
        contact_mobile=policy.contact_mobile,
        contact_email=policy.contact_email,
        commission_received_status="PENDING",
        customer_id=policy.customer_id,
        company_id=policy.company_id,
        plan_id=policy.plan_id,
        purchase_party_id=policy.purchase_party_id,
        sub_agent_id=policy.sub_agent_id,
        term_years=term_years,
        sum_assured=policy.sum_assured,
        final_premium=renewal_premium,
        net_premium=policy.net_premium,
        tax_amount=policy.tax_amount,
        is_single_premium=policy.is_single_premium,
        premium_mode=policy.premium_mode,
        issue_date=payload.issue_date or date.today(),
        policy_start_date=start_date,
        first_receipt_date=None,
        expiry_date=new_expiry,
        next_premium_due_date=start_date,
        status="ACTIVE",
        notes=payload.notes.strip() if payload.notes else None,
        created_by_id=user_id,
    )
    session.add(renewed_policy)
    await session.flush()

    for member in policy.members or []:
        session.add(
            InsurancePolicyMember(
                id=uuid.uuid4(),
                policy_id=renewed_policy_id,
                customer_id=member.customer_id,
                full_name=member.full_name,
                relationship=member.relationship,
                date_of_birth=member.date_of_birth,
                gender=member.gender,
                mobile_number=member.mobile_number,
                email=member.email,
                address=member.address,
                member_code=member.member_code,
                individual_sum_insured=member.individual_sum_insured,
                notes=member.notes,
            )
        )
    for nominee in policy.nominees or []:
        session.add(
            InsurancePolicyNominee(
                id=uuid.uuid4(),
                policy_id=renewed_policy_id,
                full_name=nominee.full_name,
                relationship=nominee.relationship,
                date_of_birth=nominee.date_of_birth,
                mobile_number=nominee.mobile_number,
                address=nominee.address,
                share_percentage=nominee.share_percentage,
            )
        )
    for r in policy.policy_riders or []:
        session.add(
            InsurancePolicyRider(
                id=uuid.uuid4(),
                policy_id=renewed_policy_id,
                rider_id=r.rider_id,
                rider_name=r.rider_name,
                rider_description=r.rider_description,
                created_at=datetime.now(UTC),
            )
        )
    session.add(
        InsurancePolicyHistory(
            id=uuid.uuid4(),
            current_policy_id=renewed_policy_id,
            previous_policy_id=policy.id,
            insurance_company_name=policy.company.name if policy.company else "Unknown",
            previous_policy_number=policy.policy_number,
            policy_business_type="RENEW",
            history_sequence=1,
            policy_start_date=policy.policy_start_date,
            policy_expiry_date=policy.expiry_date,
            sum_insured=policy.sum_assured,
            net_premium=policy.net_premium,
            gross_premium=policy.final_premium,
            product_variant=policy.product_variant,
            policy_status=policy.status,
            continuity_details=policy.portability_continuity_details,
            is_external_policy=False,
        )
    )

    policy.status = "EXPIRED"
    await generate_premium_schedules_for_policy(session, renewed_policy)
    await calculate_and_record_policy_commission(
        session,
        renewed_policy,
        commission_type="RENEWAL",
    )

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=user_id,
        action="POLICY_RENEWED",
        resource_type="policy",
        resource_id=renewed_policy_id,
        state_delta={
            "previous_policy_id": str(policy.id),
            "previous_policy_number": policy.policy_number,
            "new_policy_number": renewed_number,
            "new_start_date": start_date.isoformat(),
            "new_expiry": new_expiry.isoformat(),
            "renewal_premium": float(renewal_premium),
        },
        created_at=datetime.now(UTC),
    )
    session.add(audit)

    await session.commit()

    return PolicyRenewalResponse(
        policy_id=renewed_policy_id,
        policy_number=renewed_number,
        previous_policy_id=policy.id,
        previous_policy_number=policy.policy_number,
        status="ACTIVE",
        issue_date=renewed_policy.issue_date,
        new_start_date=start_date,
        new_expiry_date=new_expiry,
        renewal_premium=renewal_premium,
        message=f"Policy '{renewed_number}' successfully renewed through {new_expiry.isoformat()}.",
    )


async def update_policy_status(
    session: AsyncSession,
    policy_id: uuid.UUID,
    payload: PolicyStatusUpdate,
    user_id: uuid.UUID | None = None,
) -> PolicyResponse:
    """Transition policy lifecycle status (ACTIVE, INACTIVE, LAPSED, CANCELLED, EXPIRED) with audit trail."""
    policy = (
        await session.execute(
            select(InsurancePolicy).where(InsurancePolicy.id == policy_id)
        )
    ).scalar_one_or_none()

    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy {policy_id} not found.",
        )

    old_status = policy.status
    new_status = payload.status.strip().upper()
    policy.status = new_status
    if payload.notes:
        policy.notes = f"{policy.notes or ''}\n[Status {date.today()}]: {payload.notes.strip()}".strip()
    policy.updated_at = datetime.now(UTC)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=user_id,
        action="POLICY_STATUS_CHANGED",
        resource_type="policy",
        resource_id=policy.id,
        state_delta={
            "old_status": old_status,
            "new_status": new_status,
            "notes": payload.notes,
        },
        created_at=datetime.now(UTC),
    )
    session.add(audit)

    await session.commit()
    return await get_policy_detail(session, policy_id)


async def get_policy_nominees(
    session: AsyncSession,
    policy_id: uuid.UUID,
) -> list[PolicyNomineeResponse]:
    """Retrieve all registered nominees for a policy contract."""
    query = (
        select(InsurancePolicyNominee)
        .where(InsurancePolicyNominee.policy_id == policy_id)
        .order_by(InsurancePolicyNominee.created_at.asc())
    )
    noms = (await session.execute(query)).scalars().all()
    return [
        PolicyNomineeResponse(
            id=n.id,
            policy_id=n.policy_id,
            full_name=n.full_name,
            relationship=n.relationship,
            date_of_birth=n.date_of_birth,
            mobile_number=n.mobile_number,
            address=n.address,
            share_percentage=n.share_percentage,
            created_at=n.created_at,
            updated_at=n.updated_at,
        )
        for n in noms
    ]


async def add_or_replace_policy_nominees(
    session: AsyncSession,
    policy_id: uuid.UUID,
    nominees: list[PolicyNomineeCreate],
    user_id: uuid.UUID | None = None,
) -> list[PolicyNomineeResponse]:
    """Replace all nominees for a policy contract ensuring 100% total share validation."""
    if len(nominees) > 0:
        tot = sum(Decimal(str(n.share_percentage or 100)) for n in nominees)
        if abs(tot - Decimal("100.00")) > Decimal("0.01"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Nominee share percentages must total 100% (currently {tot}%).",
            )

    # Verify policy exists
    pol = (
        await session.execute(
            select(InsurancePolicy).where(InsurancePolicy.id == policy_id)
        )
    ).scalar_one_or_none()
    if not pol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy {policy_id} not found.",
        )

    await session.execute(delete(InsurancePolicyNominee).where(InsurancePolicyNominee.policy_id == policy_id))
    for nom in nominees:
        nom_rec = InsurancePolicyNominee(
            id=uuid.uuid4(),
            policy_id=policy_id,
            full_name=nom.full_name.strip(),
            relationship=nom.relationship.strip(),
            date_of_birth=nom.date_of_birth,
            mobile_number=nom.mobile_number.strip() if nom.mobile_number else None,
            address=nom.address.strip() if nom.address else None,
            share_percentage=nom.share_percentage,
        )
        session.add(nom_rec)

    pol.updated_at = datetime.now(UTC)
    if user_id:
        audit = AuditLog(
            id=uuid.uuid4(),
            actor_id=user_id,
            action="POLICY_NOMINEES_UPDATED",
            resource_type="policy",
            resource_id=policy_id,
            state_delta={
                "nominees_count": len(nominees),
                "nominees": [n.full_name for n in nominees],
            },
            created_at=datetime.now(UTC),
        )
        session.add(audit)
    await session.commit()
    return await get_policy_nominees(session, policy_id)


async def get_policy_audit_history(
    session: AsyncSession,
    policy_id: uuid.UUID,
) -> list[dict[str, Any]]:
    """Retrieve chronological audit and lifecycle history for a policy contract."""
    stmt = (
        select(AuditLog)
        .options(selectinload(AuditLog.actor))
        .where(
            AuditLog.resource_type == "policy",
            AuditLog.resource_id == policy_id,
        )
        .order_by(AuditLog.created_at.desc())
    )
    res = await session.execute(stmt)
    logs = res.scalars().all()
    return [
        {
            "id": str(log.id),
            "action": log.action,
            "actor_id": str(log.actor_id) if log.actor_id else None,
            "actor_name": log.actor.full_name if log.actor else "System Administrator",
            "actor_email": log.actor.email if log.actor else None,
            "state_delta": log.state_delta,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


async def get_policy_members(
    session: AsyncSession,
    policy_id: uuid.UUID,
) -> list[PolicyMemberResponse]:
    """Return insured members attached to a policy."""
    policy_exists = await session.scalar(
        select(InsurancePolicy.id).where(InsurancePolicy.id == policy_id)
    )
    if policy_exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy {policy_id} not found.",
        )

    members = (
        await session.execute(
            select(InsurancePolicyMember)
            .where(InsurancePolicyMember.policy_id == policy_id)
            .order_by(InsurancePolicyMember.created_at, InsurancePolicyMember.id)
        )
    ).scalars().all()
    return [PolicyMemberResponse.model_validate(member) for member in members]


async def add_policy_member(
    session: AsyncSession,
    policy_id: uuid.UUID,
    payload: PolicyMemberCreate,
) -> PolicyMemberResponse:
    """Attach an insured member to an existing policy."""
    policy = (
        await session.execute(
            select(InsurancePolicy).where(InsurancePolicy.id == policy_id)
        )
    ).scalar_one_or_none()
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy {policy_id} not found.",
        )
    if payload.customer_id is not None:
        customer_exists = await session.scalar(
            select(Customer.id).where(Customer.id == payload.customer_id)
        )
        if customer_exists is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer {payload.customer_id} not found.",
            )

    member = InsurancePolicyMember(
        id=uuid.uuid4(),
        policy_id=policy_id,
        customer_id=payload.customer_id,
        full_name=payload.full_name.strip(),
        relationship=payload.relationship.strip().upper(),
        date_of_birth=payload.date_of_birth,
        gender=payload.gender.strip().upper() if payload.gender else None,
        mobile_number=payload.mobile_number.strip() if payload.mobile_number else None,
        email=payload.email.strip() if payload.email else None,
        address=payload.address.strip() if payload.address else None,
        member_code=payload.member_code.strip() if payload.member_code else None,
        individual_sum_insured=payload.individual_sum_insured,
        notes=payload.notes.strip() if payload.notes else None,
    )
    session.add(member)
    session.add(
        AuditLog(
            id=uuid.uuid4(),
            action="POLICY_MEMBER_ADDED",
            resource_type="policy",
            resource_id=policy_id,
            state_delta={"member_name": member.full_name},
            created_at=datetime.now(UTC),
        )
    )
    await session.commit()
    await session.refresh(member)
    return PolicyMemberResponse.model_validate(member)


async def remove_policy_member(
    session: AsyncSession,
    policy_id: uuid.UUID,
    member_id: uuid.UUID,
) -> dict[str, str]:
    """Remove an insured member from a policy."""
    member = (
        await session.execute(
            select(InsurancePolicyMember).where(
                InsurancePolicyMember.id == member_id,
                InsurancePolicyMember.policy_id == policy_id,
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy member {member_id} not found.",
        )

    member_name = member.full_name
    await session.delete(member)
    session.add(
        AuditLog(
            id=uuid.uuid4(),
            action="POLICY_MEMBER_REMOVED",
            resource_type="policy",
            resource_id=policy_id,
            state_delta={"member_name": member_name},
            created_at=datetime.now(UTC),
        )
    )
    await session.commit()
    return {"status": "success", "message": "Policy member removed successfully."}


async def get_customer_family_group_members(
    session: AsyncSession,
    customer_id: uuid.UUID,
) -> dict[str, Any]:
    """Return the customer's family group and its insured members."""
    customer = (
        await session.execute(select(Customer).where(Customer.id == customer_id))
    ).scalar_one_or_none()
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {customer_id} not found.",
        )

    group = (
        await session.execute(
            select(InsuranceFamilyGroup)
            .outerjoin(
                InsuranceFamilyMember,
                InsuranceFamilyMember.family_group_id == InsuranceFamilyGroup.id,
            )
            .where(
                or_(
                    InsuranceFamilyGroup.head_customer_id == customer_id,
                    InsuranceFamilyMember.customer_id == customer_id,
                )
            )
            .options(
                selectinload(InsuranceFamilyGroup.head_customer),
                selectinload(InsuranceFamilyGroup.members).selectinload(
                    InsuranceFamilyMember.customer
                ),
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    if group is None:
        return {
            "has_family_group": False,
            "customer_id": str(customer_id),
            "family_group_id": None,
            "family_group_name": None,
            "head_customer_id": None,
            "head_customer_name": None,
            "members": [],
        }

    members = [
        {
            "id": str(member.id),
            "customer_id": str(member.customer_id),
            "full_name": member.customer.full_name if member.customer else "",
            "relationship": (
                "SELF"
                if member.customer_id == group.head_customer_id
                else member.relation_type
            ),
            "phone": member.customer.phone if member.customer else None,
            "email": member.customer.email if member.customer else None,
            "date_of_birth": (
                member.customer.date_of_birth.isoformat()
                if member.customer and member.customer.date_of_birth
                else None
            ),
            "gender": member.customer.gender if member.customer else None,
            "address": member.customer.address if member.customer else None,
        }
        for member in group.members
    ]
    return {
        "has_family_group": True,
        "customer_id": str(customer_id),
        "family_group_id": str(group.id),
        "family_group_name": group.name,
        "head_customer_id": str(group.head_customer_id),
        "head_customer_name": (
            group.head_customer.full_name if group.head_customer else None
        ),
        "members": members,
    }


async def get_policy_renewal_lifecycle(
    session: AsyncSession,
    policy_id: uuid.UUID,
) -> list[dict[str, Any]]:
    """Return the linked policy chain in chronological order."""
    selected = (
        await session.execute(
            select(InsurancePolicy).where(InsurancePolicy.id == policy_id)
        )
    ).scalar_one_or_none()
    if selected is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy {policy_id} not found.",
        )

    ancestors = [selected]
    seen = {selected.id}
    current = selected
    while current.previous_policy_id is not None:
        previous = (
            await session.execute(
                select(InsurancePolicy).where(
                    InsurancePolicy.id == current.previous_policy_id
                )
            )
        ).scalar_one_or_none()
        if previous is None or previous.id in seen:
            break
        ancestors.append(previous)
        seen.add(previous.id)
        current = previous
    chain = list(reversed(ancestors))
    current = chain[-1]

    while True:
        children = (
            await session.execute(
                select(InsurancePolicy)
                .where(InsurancePolicy.previous_policy_id == current.id)
                .order_by(
                    InsurancePolicy.policy_start_date,
                    InsurancePolicy.created_at,
                    InsurancePolicy.id,
                )
            )
        ).scalars().all()
        if not children:
            break
        preferred = next((child for child in children if child.id in seen), None)
        child = preferred or children[-1]
        if child.id in seen:
            break
        chain.append(child)
        seen.add(child.id)
        current = child

    timeline: list[dict[str, Any]] = []
    last_index = len(chain) - 1
    for index, item in enumerate(chain):
        if index == 0:
            label = "Original Policy"
        elif index == last_index:
            label = "Latest Renewal"
        elif index == 1:
            label = "First Renewal"
        else:
            label = f"Renewal {index}"
        iss_date = item.issue_date or item.first_receipt_date or (item.created_at.date() if item.created_at else item.policy_start_date)
        iss_year = iss_date.year if iss_date else None
        timeline.append(
            {
                "policy_id": str(item.id),
                "policy_number": item.policy_number,
                "previous_policy_id": (
                    str(item.previous_policy_id) if item.previous_policy_id else None
                ),
                "business_type": item.business_type,
                "status": item.status,
                "issue_date": iss_date.isoformat() if iss_date else None,
                "issue_year": iss_year,
                "policy_start_date": item.policy_start_date.isoformat(),
                "expiry_date": item.expiry_date.isoformat(),
                "final_premium": item.final_premium,
                "coverage_year": f"{item.policy_start_date.year}-{item.expiry_date.year}",
                "sequence": index + 1,
                "sequence_label": label,
                "is_current": item.id == policy_id,
            }
        )
    return timeline
