"""Commission Calculation, Allocation, Reconciliation, and Ledger Service for FinNexus Insurance Engine."""

from __future__ import annotations

import csv
import io
import json
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Sequence, Any

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from app.db.models.insurance import (
    InsuranceCompany,
    InsuranceCompanyCommissionAgreement,
    InsuranceCommissionReceipt,
    InsuranceCommissionSplitConfig,
    InsurancePlan,
    InsurancePolicy,
    InsurancePolicyCommission,
    InsuranceSubAgent,
    InsuranceSubAgentPayout,
    InsuranceSubAgentPayoutPayment,
)
from app.db.models.auth import User
from app.db.models.crm import Customer
from app.schemas.insurance import (
    AgentPerformanceReportItem,
    CommissionApprovalRequest,
    CommissionKPIResponse,
    CommissionReceiptCreate,
    CommissionReceiptResponse,
    CommissionReversalRequest,
    CompanyCommissionAgreementCreate,
    CompanyCommissionAgreementResponse,
    CompanyCommissionAgreementUpdate,
    ComprehensiveCommissionDashboardResponse,
    FirmFinancialPositionResponse,
    InsurerReceivableDashboardResponse,
    PaginatedResponse,
    PolicyCommissionResponse,
    PolicyCommissionStatusUpdate,
    PolicyCommissionUpdate,
    SubAgentPayablesDashboardResponse,
    SubAgentPayoutApprovalRequest,
    SubAgentPayoutOnHoldRequest,
    SubAgentPayoutPaymentCreate,
    SubAgentPayoutPaymentResponse,
    SubAgentPayoutResponse,
    SubAgentPayoutReversalRequest,
    SubAgentPayoutUpdate,
)

DEFAULT_COMMISSION_RATE = Decimal("15.00")  # Standard 15% first-year gross commission
DEFAULT_RENEWAL_RATE = Decimal("7.50")     # Standard 7.5% renewal commission
DEFAULT_TDS_RATE = Decimal("10.00")         # Standard 10% TDS


def _format_inr(val: Decimal | float | None) -> str:
    """Format an amount as Indian Rupees string (e.g., ₹1,525.20)."""
    if val is None:
        return "₹0.00"
    dec = Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    s = f"{dec:.2f}"
    parts = s.split(".")
    int_part, frac = parts[0], parts[1]
    is_neg = int_part.startswith("-")
    if is_neg:
        int_part = int_part[1:]
    
    if len(int_part) <= 3:
        formatted = int_part
    else:
        last3 = int_part[-3:]
        remaining = int_part[:-3]
        groups = []
        while len(remaining) > 2:
            groups.insert(0, remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            groups.insert(0, remaining)
        formatted = ",".join(groups) + "," + last3
        
    prefix = "-₹" if is_neg else "₹"
    return f"{prefix}{formatted}.{frac}"


async def resolve_insurer_commission_agreement(
    session: AsyncSession,
    company_id: uuid.UUID,
    policy_category: str | None = None,
    plan_id: uuid.UUID | None = None,
    calculation_date: date | None = None,
) -> InsuranceCompanyCommissionAgreement | None:
    """Resolve the most specific active commission agreement for an insurer."""
    calc_date = calculation_date or date.today()
    stmt = (
        select(InsuranceCompanyCommissionAgreement)
        .where(
            InsuranceCompanyCommissionAgreement.company_id == company_id,
            InsuranceCompanyCommissionAgreement.is_active.is_(True),
            InsuranceCompanyCommissionAgreement.effective_from <= calc_date,
            or_(
                InsuranceCompanyCommissionAgreement.effective_to.is_(None),
                InsuranceCompanyCommissionAgreement.effective_to >= calc_date,
            ),
        )
        .order_by(
            InsuranceCompanyCommissionAgreement.plan_id.desc().nullslast(),
            InsuranceCompanyCommissionAgreement.policy_category.desc().nullslast(),
            InsuranceCompanyCommissionAgreement.effective_from.desc(),
        )
    )
    results = (await session.execute(stmt)).scalars().all()
    if not results:
        return None

    # Priority 1: Match both plan_id and policy_category
    if plan_id:
        for agr in results:
            if agr.plan_id == plan_id and (policy_category is None or agr.policy_category == policy_category):
                return agr

    # Priority 2: Match policy_category with no plan restriction
    if policy_category:
        for agr in results:
            if agr.policy_category == policy_category and agr.plan_id is None:
                return agr

    # Priority 3: Fallback to general company agreement (no plan, no category)
    for agr in results:
        if agr.plan_id is None and agr.policy_category is None:
            return agr

    return results[0]


async def calculate_and_record_policy_commission(
    session: AsyncSession,
    policy: InsurancePolicy,
    commission_type: str = "FIRST_YEAR",
    gross_rate_override: Decimal | None = None,
    gross_amount_override: Decimal | None = None,
    sub_agent_amount_override: Decimal | None = None,
    tds_rate_override: Decimal | None = None,
    tds_amount_override: Decimal | None = None,
    net_payable_override: Decimal | None = None,
    override_reason: str | None = None,
    user_id: uuid.UUID | None = None,
) -> InsurancePolicyCommission | None:
    """Calculate and record eligible commission record for a policy based on Net Premium, agreements, and splits."""
    comm_type = commission_type.strip().upper()
    if comm_type == "FIRST_YEAR" and getattr(policy, "business_type", "").upper() in ("RENEW", "RENEWAL"):
        comm_type = "RENEWAL"

    # 1. Prevent duplicate commission generation for this policy & type (unless previous was reversed)
    existing_stmt = select(InsurancePolicyCommission).where(
        InsurancePolicyCommission.policy_id == policy.id,
        InsurancePolicyCommission.commission_type == comm_type,
        InsurancePolicyCommission.status != "REVERSED",
    )
    existing = (await session.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        return existing

    # 2. Resolve Insurer Commission Agreement
    pol_category = getattr(policy, "policy_category", None) or getattr(policy, "policy_type", None)
    agreement = await resolve_insurer_commission_agreement(
        session=session,
        company_id=policy.company_id,
        policy_category=pol_category,
        plan_id=policy.plan_id,
        calculation_date=policy.policy_start_date or date.today(),
    )

    # Determine commissionable basis and net premium
    comm_basis = agreement.commissionable_basis if agreement else "NET_PREMIUM"
    if comm_basis == "NET_PREMIUM":
        if policy.net_premium is not None and policy.net_premium > 0:
            applicable_premium = policy.net_premium
        else:
            # Net premium excludes 18% standard GST if only gross premium is known
            prem_val = getattr(policy, "premium_amount", None) or getattr(policy, "final_premium", Decimal("0.00"))
            applicable_premium = (prem_val / Decimal("1.18")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    elif comm_basis == "BASE_PREMIUM":
        applicable_premium = getattr(policy, "base_premium", None) or policy.net_premium or getattr(policy, "final_premium", None) or getattr(policy, "premium_amount", Decimal("0.00"))
    else:  # GROSS_PREMIUM
        applicable_premium = getattr(policy, "final_premium", None) or getattr(policy, "premium_amount", Decimal("0.00"))

    # 3. Determine Gross Commission Rate & Amount
    calc_source = "RULE_AGREEMENT" if agreement else "DEFAULT_STANDARD"
    if gross_amount_override is not None:
        gross_amount = gross_amount_override.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        rate = ((gross_amount / applicable_premium) * Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if applicable_premium > 0 else Decimal("0.00")
        calc_source = "MANUAL_OVERRIDE"
    elif gross_rate_override is not None:
        rate = gross_rate_override.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        calc_source = "MANUAL_OVERRIDE"
        gross_amount = (applicable_premium * (rate / Decimal("100.00"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    elif agreement:
        if comm_type == "RENEWAL":
            rate = agreement.renewal_commission_rate
        elif comm_type == "SPECIAL" and agreement.special_commission_rate is not None:
            rate = agreement.special_commission_rate
        else:
            rate = agreement.first_year_commission_rate
        gross_amount = (applicable_premium * (rate / Decimal("100.00"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        rate = DEFAULT_RENEWAL_RATE if comm_type == "RENEWAL" else DEFAULT_COMMISSION_RATE
        gross_amount = (applicable_premium * (rate / Decimal("100.00"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # 4. TDS Calculation
    applied_tds_rate = tds_rate_override or (agreement.tds_rate if agreement else DEFAULT_TDS_RATE)
    if tds_amount_override is not None:
        total_tds = tds_amount_override.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        total_tds = (gross_amount * (applied_tds_rate / Decimal("100.00"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if net_payable_override is not None:
        net_payable = net_payable_override.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        net_payable = gross_amount - total_tds

    # 5. Sub-Agent Allocation Resolution
    sub_agent_amt = Decimal("0.00")
    sub_agent_tds_rate = Decimal("5.00")  # Standard 5% TDS for sub-agents (Section 194H)
    sub_agent_tds_amt = Decimal("0.00")
    sub_net_payout = Decimal("0.00")
    rule_applied = "Direct Firm Sourced (100% Firm)"
    recipient_type = "MAIN_FIRM"
    allocation_basis = "GROSS_COMMISSION"
    split_agreement_id = None

    if sub_agent_amount_override is not None:
        sub_agent_amt = min(sub_agent_amount_override, gross_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        rule_applied = "Explicit Sub-Agent Allocation"
        recipient_type = "SUB_AGENT"
        sub_agent_tds_amt = (sub_agent_amt * (sub_agent_tds_rate / Decimal("100.00"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        sub_net_payout = sub_agent_amt - sub_agent_tds_amt
    elif policy.sub_agent_id:
        recipient_type = "SUB_AGENT"
        splits_query = (
            select(InsuranceCommissionSplitConfig)
            .where(
                InsuranceCommissionSplitConfig.sub_agent_id == policy.sub_agent_id,
                InsuranceCommissionSplitConfig.is_active.is_(True),
                InsuranceCommissionSplitConfig.effective_date <= (policy.policy_start_date or date.today()),
                or_(
                    InsuranceCommissionSplitConfig.effective_to.is_(None),
                    InsuranceCommissionSplitConfig.effective_to >= (policy.policy_start_date or date.today()),
                ),
            )
            .order_by(
                InsuranceCommissionSplitConfig.plan_id.desc().nullslast(),
                InsuranceCommissionSplitConfig.company_id.desc().nullslast(),
                InsuranceCommissionSplitConfig.policy_category.desc().nullslast(),
                InsuranceCommissionSplitConfig.effective_date.desc(),
            )
        )
        splits = (await session.execute(splits_query)).scalars().all()

        applicable_split: InsuranceCommissionSplitConfig | None = None
        for s in splits:
            if s.commission_type not in ("ALL", comm_type):
                continue
            if s.plan_id == policy.plan_id:
                applicable_split = s
                break
            elif s.company_id == policy.company_id and (s.policy_category is None or s.policy_category == pol_category):
                applicable_split = s
                break
            elif s.policy_category == pol_category and s.company_id is None and s.plan_id is None:
                applicable_split = s
                break
            elif s.company_id is None and s.plan_id is None and applicable_split is None:
                applicable_split = s

        if applicable_split:
            split_agreement_id = applicable_split.id
            allocation_basis = applicable_split.allocation_basis
            if applicable_split.split_type == "PERCENTAGE":
                calc_pool = net_payable if allocation_basis == "NET_COMMISSION" else gross_amount
                sub_agent_amt = (calc_pool * (applicable_split.split_value / Decimal("100.00"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                rule_applied = f"{applicable_split.split_value}% Split ({allocation_basis})"
            elif applicable_split.split_type == "FIXED":
                sub_agent_amt = min(applicable_split.split_value, gross_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                rule_applied = f"Fixed ₹{applicable_split.split_value} per Policy"
            
            sub_agent_tds_amt = (sub_agent_amt * (sub_agent_tds_rate / Decimal("100.00"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            sub_net_payout = sub_agent_amt - sub_agent_tds_amt
        else:
            rule_applied = "Sub-Agent Assigned (No active agreement found, 0% allocated)"

    # Cap sub-agent allocation at gross amount
    if sub_agent_amt > gross_amount:
        sub_agent_amt = gross_amount

    firm_net = gross_amount - sub_agent_amt
    firm_tds_amt = total_tds
    firm_net_bank_credit = (net_payable - sub_agent_amt).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # 6. Build Agreement Snapshot (immutable JSON)
    snapshot = {
        "calculated_at": datetime.now(UTC).isoformat(),
        "commission_type": comm_type,
        "calculation_source": calc_source,
        "commissionable_basis": comm_basis,
        "eligible_premium": float(applicable_premium),
        "insurer_rate_percent": float(rate),
        "gross_commission": float(gross_amount),
        "tds_rate_percent": float(applied_tds_rate),
        "tds_amount": float(total_tds),
        "net_commission_payable": float(net_payable),
        "sub_agent_id": str(policy.sub_agent_id) if policy.sub_agent_id else None,
        "recipient_type": recipient_type,
        "allocation_basis": allocation_basis,
        "sub_agent_amount": float(sub_agent_amt),
        "sub_agent_tds_rate": float(sub_agent_tds_rate) if sub_agent_amt > 0 else 0.0,
        "sub_agent_tds_amount": float(sub_agent_tds_amt),
        "sub_agent_net_payout": float(sub_net_payout),
        "firm_gross_share": float(firm_net),
        "firm_net_bank_credit": float(firm_net_bank_credit),
        "agreement_id": str(agreement.id) if agreement else None,
        "split_agreement_id": str(split_agreement_id) if split_agreement_id else None,
        "override_reason": override_reason,
    }

    start_date = policy.policy_start_date or date.today()
    expected_receipt = start_date + timedelta(days=30)

    comm_record = InsurancePolicyCommission(
        id=uuid.uuid4(),
        policy_id=policy.id,
        sub_agent_id=policy.sub_agent_id,
        commission_type=comm_type,
        policy_category=pol_category,
        net_premium_applied=applicable_premium,
        gross_commission_amount=gross_amount,
        gross_commission_rate=rate,
        tds_rate=applied_tds_rate,
        tds_amount=total_tds,
        net_commission_payable=net_payable,
        sub_agent_amount=sub_agent_amt,
        sub_agent_tds_rate=sub_agent_tds_rate if sub_agent_amt > 0 else None,
        sub_agent_tds_amount=sub_agent_tds_amt if sub_agent_amt > 0 else Decimal("0.00"),
        sub_agent_net_payout=sub_net_payout if sub_agent_amt > 0 else Decimal("0.00"),
        firm_net_amount=firm_net,
        firm_tds_amount=firm_tds_amt,
        firm_net_bank_credit=firm_net_bank_credit,
        recipient_type=recipient_type,
        allocation_basis=allocation_basis,
        commission_agreement_id=agreement.id if agreement else None,
        split_agreement_id=split_agreement_id,
        agreement_snapshot=json.dumps(snapshot),
        split_rule_applied=rule_applied,
        calculation_source=calc_source,
        override_reason=override_reason,
        expected_receipt_date=expected_receipt,
        actual_gross_received=Decimal("0.00"),
        actual_tds_deducted=Decimal("0.00"),
        actual_net_received=Decimal("0.00"),
        reconciliation_difference=Decimal("0.00"),
        reconciliation_status="UNRECONCILED",
        balance_receivable=net_payable,
        status="PENDING",
    )
    session.add(comm_record)
    await session.flush()

    # 7. Create Sub-Agent Payout Obligation if a sub-agent is assigned on the policy
    if policy.sub_agent_id:
        existing_payout_stmt = select(InsuranceSubAgentPayout).where(
            InsuranceSubAgentPayout.policy_id == policy.id,
            InsuranceSubAgentPayout.commission_type == comm_type,
            InsuranceSubAgentPayout.status != "REVERSED",
        )
        existing_payout = (await session.execute(existing_payout_stmt)).scalar_one_or_none()
        if not existing_payout:
            agreed_pct = (
                ((sub_agent_amt / gross_amount) * Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                if gross_amount > 0 and sub_agent_amt > 0 else Decimal("0.00")
            )
            payout_rec = InsuranceSubAgentPayout(
                id=uuid.uuid4(),
                policy_id=policy.id,
                commission_id=comm_record.id,
                sub_agent_id=policy.sub_agent_id,
                commission_type=comm_type,
                insurer_gross_commission=gross_amount,
                agreed_percentage=agreed_pct,
                payable_amount=sub_agent_amt,
                tds_rate=sub_agent_tds_rate,
                tds_amount=sub_agent_tds_amt,
                net_payable_amount=sub_net_payout,
                amount_paid=Decimal("0.00"),
                remaining_payable=sub_net_payout,
                status="PENDING",
                split_rule_applied=rule_applied,
                split_agreement_snapshot=json.dumps(snapshot),
            )
            session.add(payout_rec)
            await session.flush()

    return comm_record


def _map_commission_to_response(c: InsurancePolicyCommission) -> PolicyCommissionResponse:
    """Map SQLAlchemy model to Pydantic PolicyCommissionResponse with all metadata."""
    p = c.policy
    cust = p.customer if p else None
    comp = p.company if p else None
    plan = p.plan if p else None
    sa = c.sub_agent

    receipts_list = []
    if c.receipts:
        for r in c.receipts:
            receipts_list.append(
                CommissionReceiptResponse(
                    id=r.id,
                    commission_id=r.commission_id,
                    receipt_date=r.receipt_date,
                    gross_amount=r.gross_amount,
                    tds_deducted=r.tds_deducted,
                    net_amount=r.net_amount,
                    actual_bank_received=getattr(r, "actual_bank_received", None) if getattr(r, "actual_bank_received", None) is not None else r.net_amount,
                    actual_commission_rate=r.actual_commission_rate,
                    actual_tds_rate=r.actual_tds_rate,
                    actual_gross_commission=r.gross_amount,
                    actual_tds_amount=r.tds_deducted,
                    bank_account=r.bank_account,
                    payment_mode=r.payment_mode,
                    bank_name=r.bank_name,
                    transaction_reference=r.transaction_reference,
                    tds_certificate_ref=r.tds_certificate_ref,
                    receipt_type=r.receipt_type,
                    notes=r.notes,
                    document_url=r.supporting_document_url,
                    supporting_document_url=r.supporting_document_url,
                    recorded_by_id=r.recorded_by_id,
                    recorded_by_name=r.recorded_by.full_name if r.recorded_by else None,
                    created_at=r.created_at,
                )
            )

    cust_name = None
    if cust:
        cust_name = f"{cust.first_name} {cust.last_name or ''}".strip()

    return PolicyCommissionResponse(
        id=c.id,
        policy_id=c.policy_id,
        policy_number=p.policy_number if p else None,
        policy_type=p.policy_type if p else None,
        policy_category=c.policy_category or (p.policy_category if p else None),
        customer_id=p.customer_id if p else None,
        customer_name=cust_name,
        customer_phone=cust.phone if cust else None,
        company_id=comp.id if comp else None,
        company_name=comp.name if comp else None,
        plan_id=plan.id if plan else None,
        plan_name=plan.name if plan else None,
        sub_agent_id=c.sub_agent_id,
        sub_agent_name=sa.full_name if sa else None,
        sub_agent_code=sa.agent_code if sa else None,
        commission_type=c.commission_type,
        net_premium_applied=c.net_premium_applied,
        gross_commission_amount=c.gross_commission_amount,
        gross_commission_rate=c.gross_commission_rate,
        tds_rate=c.tds_rate or Decimal("10.00"),
        tds_amount=c.tds_amount or Decimal("0.00"),
        net_commission_payable=c.net_commission_payable or (c.gross_commission_amount - (c.tds_amount or Decimal("0.00"))),
        sub_agent_amount=c.sub_agent_amount,
        sub_agent_share=c.sub_agent_amount,
        sub_agent_tds_rate=c.sub_agent_tds_rate,
        sub_agent_tds_amount=c.sub_agent_tds_amount,
        sub_agent_net_payout=c.sub_agent_net_payout,
        firm_net_amount=c.firm_net_amount,
        net_firm_share=c.firm_net_amount,
        firm_tds_amount=c.firm_tds_amount,
        firm_net_bank_credit=c.firm_net_bank_credit,
        split_rule_applied=c.split_rule_applied,
        calculation_source=c.calculation_source,
        override_reason=c.override_reason,
        bank_reference=c.bank_reference,
        status=c.status,
        payment_date=c.payment_date,
        expected_receipt_date=c.expected_receipt_date,
        actual_gross_received=c.actual_gross_received or Decimal("0.00"),
        actual_tds_deducted=c.actual_tds_deducted or Decimal("0.00"),
        actual_net_received=c.actual_net_received or Decimal("0.00"),
        reconciliation_difference=c.reconciliation_difference or Decimal("0.00"),
        reconciliation_status=c.reconciliation_status or "UNRECONCILED",
        recipient_type=c.recipient_type or ("SUB_AGENT" if c.sub_agent_id else "MAIN_FIRM"),
        allocation_basis=c.allocation_basis or "GROSS_COMMISSION",
        agreement_snapshot=c.agreement_snapshot,
        approved_by_id=c.approved_by_id,
        approved_by_name=c.approved_by.full_name if c.approved_by else None,
        approved_at=c.approved_at,
        approval_notes=c.approval_notes,
        reversed_by_id=c.reversed_by_id,
        reversed_by_name=c.reversed_by.full_name if c.reversed_by else None,
        reversed_at=c.reversed_at,
        reversal_reason=c.reversal_reason,
        reversal_amount=c.reversal_amount,
        original_commission_id=c.original_commission_id,
        actual_commission_rate=c.actual_commission_rate,
        actual_tds_rate=c.actual_tds_rate,
        bank_account=c.bank_account,
        balance_receivable=c.balance_receivable or max(
            Decimal("0.00"),
            (c.net_commission_payable or (c.gross_commission_amount - (c.tds_amount or Decimal("0.00"))))
            - (c.actual_net_received or Decimal("0.00")),
        ),
        receipts=receipts_list,
        notes=c.notes,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


def _map_sub_agent_payout_to_response(payout: InsuranceSubAgentPayout) -> SubAgentPayoutResponse:
    """Map SQLAlchemy model to Pydantic SubAgentPayoutResponse with joined metadata."""
    p = payout.policy
    cust = p.customer if p else None
    comp = p.company if p else None
    plan = p.plan if p else None
    sa = payout.sub_agent

    payments_list = []
    if payout.payments:
        for pm in payout.payments:
            payments_list.append(
                SubAgentPayoutPaymentResponse(
                    id=pm.id,
                    payout_id=pm.payout_id,
                    payment_date=pm.payment_date,
                    amount=pm.amount,
                    tds_deducted=pm.tds_deducted,
                    net_amount=pm.net_amount,
                    payment_method=pm.payment_method,
                    transaction_reference=pm.transaction_reference,
                    bank_account_details=getattr(pm, "bank_account_details", None),
                    payment_proof_url=getattr(pm, "payment_proof_url", None),
                    notes=pm.notes,
                    recorded_by_id=pm.recorded_by_id,
                    recorded_by_name=pm.recorded_by.full_name if pm.recorded_by else None,
                    created_at=pm.created_at,
                )
            )

    cust_name = f"{cust.first_name} {cust.last_name or ''}".strip() if cust else None

    return SubAgentPayoutResponse(
        id=payout.id,
        policy_id=payout.policy_id,
        policy_number=p.policy_number if p else None,
        customer_name=cust_name,
        company_name=comp.name if comp else None,
        plan_name=plan.name if plan else None,
        commission_id=payout.commission_id,
        sub_agent_id=payout.sub_agent_id,
        sub_agent_name=sa.full_name if sa else None,
        sub_agent_code=sa.agent_code if sa else None,
        commission_type=payout.commission_type,
        insurer_gross_commission=payout.insurer_gross_commission,
        agreed_percentage=payout.agreed_percentage,
        payable_amount=payout.payable_amount,
        sub_agent_payable_amount=payout.payable_amount,
        tds_rate=payout.tds_rate,
        tds_amount=payout.tds_amount,
        net_payable_amount=payout.net_payable_amount,
        amount_paid=payout.amount_paid,
        amount_already_paid=payout.amount_paid,
        remaining_payable=payout.remaining_payable,
        status=payout.status,
        payout_status=payout.status,
        payout_date=payout.payout_date,
        split_rule_applied=payout.split_rule_applied,
        split_agreement_snapshot=payout.split_agreement_snapshot,
        notes=payout.notes,
        on_hold_reason=payout.on_hold_reason,
        approved_by_id=payout.approved_by_id,
        approved_by_name=payout.approved_by.full_name if payout.approved_by else None,
        approved_at=payout.approved_at,
        approval_notes=payout.approval_notes,
        reversed_by_id=payout.reversed_by_id,
        reversed_by_name=payout.reversed_by.full_name if payout.reversed_by else None,
        reversed_at=payout.reversed_at,
        reversal_reason=payout.reversal_reason,
        payments=payments_list,
        created_at=payout.created_at,
        updated_at=payout.updated_at,
    )


async def list_commissions(
    session: AsyncSession,
    agent_id: uuid.UUID | None = None,
    company_id: uuid.UUID | None = None,
    policy_category: str | None = None,
    commission_type: str | None = None,
    status_filter: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> PaginatedResponse[PolicyCommissionResponse]:
    """List commission ledger entries with joined metadata, search, and filtering."""
    query = (
        select(InsurancePolicyCommission)
        .options(
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.company),
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.plan),
            selectinload(InsurancePolicyCommission.sub_agent),
            selectinload(InsurancePolicyCommission.approved_by),
            selectinload(InsurancePolicyCommission.reversed_by),
            selectinload(InsurancePolicyCommission.receipts).selectinload(InsuranceCommissionReceipt.recorded_by),
        )
    )

    # Joins for search & filtering if needed
    if search:
        s_term = f"%{search.strip()}%"
        query = query.join(InsurancePolicy, InsurancePolicyCommission.policy_id == InsurancePolicy.id).outerjoin(
            Customer, InsurancePolicy.customer_id == Customer.id
        ).where(
            or_(
                InsurancePolicy.policy_number.ilike(s_term),
                Customer.first_name.ilike(s_term),
                Customer.last_name.ilike(s_term),
                Customer.phone.ilike(s_term),
            )
        )

    if agent_id:
        query = query.where(InsurancePolicyCommission.sub_agent_id == agent_id)
    if company_id:
        query = query.join(InsurancePolicy, InsurancePolicyCommission.policy_id == InsurancePolicy.id, isouter=True).where(
            InsurancePolicy.company_id == company_id
        )
    if policy_category and policy_category != "ALL":
        query = query.where(
            or_(
                InsurancePolicyCommission.policy_category == policy_category,
                InsurancePolicyCommission.policy.has(InsurancePolicy.policy_type == policy_category),
            )
        )
    if commission_type and commission_type != "ALL":
        query = query.where(InsurancePolicyCommission.commission_type == commission_type.upper())
    if status_filter and status_filter != "ALL":
        query = query.where(InsurancePolicyCommission.status == status_filter.upper())
    if from_date:
        query = query.where(InsurancePolicyCommission.created_at >= datetime.combine(from_date, datetime.min.time(), tzinfo=UTC))
    if to_date:
        query = query.where(InsurancePolicyCommission.created_at <= datetime.combine(to_date, datetime.max.time(), tzinfo=UTC))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(InsurancePolicyCommission.created_at.desc()).offset(offset).limit(page_size)
    commissions = (await session.execute(query)).scalars().all()

    items = [_map_commission_to_response(c) for c in commissions]
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


async def get_commission_detail(
    session: AsyncSession,
    commission_id: uuid.UUID,
) -> PolicyCommissionResponse:
    """Retrieve complete commission record with audit trail, agreement terms, and receipts."""
    stmt = (
        select(InsurancePolicyCommission)
        .options(
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.company),
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.plan),
            selectinload(InsurancePolicyCommission.sub_agent),
            selectinload(InsurancePolicyCommission.approved_by),
            selectinload(InsurancePolicyCommission.reversed_by),
            selectinload(InsurancePolicyCommission.receipts).selectinload(InsuranceCommissionReceipt.recorded_by),
        )
        .where(InsurancePolicyCommission.id == commission_id)
    )
    comm = (await session.execute(stmt)).scalar_one_or_none()
    if not comm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Commission record {commission_id} not found.",
        )
    return _map_commission_to_response(comm)


async def get_commission_kpis(session: AsyncSession) -> CommissionKPIResponse:
    """Calculate the 8 real database financial KPI cards for Stage 1 Insurer Commission."""
    # Active commissions (exclude REVERSED for operational earnings)
    active_filter = InsurancePolicyCommission.status != "REVERSED"

    # 1. Total Gross Commission
    gross_stmt = select(func.coalesce(func.sum(InsurancePolicyCommission.gross_commission_amount), Decimal("0.00"))).where(active_filter)
    total_gross = (await session.execute(gross_stmt)).scalar_one()

    # 2. Pending Approval (status == "PENDING")
    pending_stmt = select(func.coalesce(func.sum(InsurancePolicyCommission.gross_commission_amount), Decimal("0.00"))).where(InsurancePolicyCommission.status == "PENDING")
    pending_comm = (await session.execute(pending_stmt)).scalar_one()

    # 3. Approved Commission (status == "APPROVED")
    approved_stmt = select(func.coalesce(func.sum(InsurancePolicyCommission.gross_commission_amount), Decimal("0.00"))).where(InsurancePolicyCommission.status == "APPROVED")
    approved_comm = (await session.execute(approved_stmt)).scalar_one()

    # 4. Total TDS Deducted
    tds_stmt = select(func.coalesce(func.sum(InsurancePolicyCommission.tds_amount), Decimal("0.00"))).where(active_filter)
    tds_deducted = (await session.execute(tds_stmt)).scalar_one()

    # 5. Net Receivable (gross - tds)
    net_rec_stmt = select(func.coalesce(func.sum(InsurancePolicyCommission.net_commission_payable), Decimal("0.00"))).where(active_filter)
    net_receivable = (await session.execute(net_rec_stmt)).scalar_one()
    if net_receivable == Decimal("0.00") and total_gross > 0:
        net_receivable = max(Decimal("0.00"), total_gross - tds_deducted)

    # 6. Actual Bank Received (from actual bank receipts across all active records)
    net_rcvd_stmt = select(func.coalesce(func.sum(InsurancePolicyCommission.actual_net_received), Decimal("0.00"))).where(active_filter)
    actual_net_rcvd = (await session.execute(net_rcvd_stmt)).scalar_one()

    # 7. Outstanding Commission (balance receivable from insurer)
    outstanding_stmt = select(func.coalesce(func.sum(InsurancePolicyCommission.balance_receivable), Decimal("0.00"))).where(
        active_filter,
        InsurancePolicyCommission.status != "RECEIVED",
    )
    outstanding_comm = (await session.execute(outstanding_stmt)).scalar_one()
    if outstanding_comm == Decimal("0.00") and net_receivable > actual_net_rcvd:
        outstanding_comm = max(Decimal("0.00"), net_receivable - actual_net_rcvd)

    # 8. Reversed Commission
    rev_stmt = select(func.coalesce(func.sum(func.coalesce(InsurancePolicyCommission.reversal_amount, InsurancePolicyCommission.gross_commission_amount)), Decimal("0.00"))).where(
        InsurancePolicyCommission.status == "REVERSED"
    )
    reversed_comm = (await session.execute(rev_stmt)).scalar_one()

    # Sub-Agent Payable (for Stage 2 overview)
    sub_agent_stmt = select(func.coalesce(func.sum(InsurancePolicyCommission.sub_agent_amount), Decimal("0.00"))).where(
        InsurancePolicyCommission.status.in_(("PENDING", "APPROVED", "PARTIALLY_PAID"))
    )
    sub_agent_payable = (await session.execute(sub_agent_stmt)).scalar_one()

    # Firm Retained Revenue
    firm_stmt = select(func.coalesce(func.sum(InsurancePolicyCommission.firm_net_amount), Decimal("0.00"))).where(active_filter)
    firm_retained = (await session.execute(firm_stmt)).scalar_one()

    # Transaction counts
    tot_tx = (await session.execute(select(func.count(InsurancePolicyCommission.id)))).scalar_one()
    rec_tx = (await session.execute(select(func.count(InsurancePolicyCommission.id)).where(InsurancePolicyCommission.reconciliation_status == "RECONCILED"))).scalar_one()
    pend_rec = (await session.execute(select(func.count(InsurancePolicyCommission.id)).where(InsurancePolicyCommission.status.in_(("APPROVED", "PARTIALLY_PAID"))))).scalar_one()

    return CommissionKPIResponse(
        total_gross_commission=total_gross,
        pending_commission=pending_comm,
        pending_approval=pending_comm,
        approved_commission=approved_comm,
        actual_net_received=actual_net_rcvd,
        net_receivable=net_receivable,
        outstanding_commission=outstanding_comm,
        sub_agent_payable=sub_agent_payable,
        tds_deducted=tds_deducted,
        firm_retained_revenue=firm_retained,
        reversed_commission=reversed_comm,
        total_transactions=tot_tx,
        reconciled_transactions=rec_tx,
        pending_reconciliation_count=pend_rec,
    )


async def approve_commission(
    session: AsyncSession,
    commission_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: CommissionApprovalRequest,
) -> PolicyCommissionResponse:
    """Approve a pending commission record for financial settlement."""
    stmt = (
        select(InsurancePolicyCommission)
        .options(
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.company),
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.plan),
            selectinload(InsurancePolicyCommission.sub_agent),
            selectinload(InsurancePolicyCommission.approved_by),
            selectinload(InsurancePolicyCommission.reversed_by),
            selectinload(InsurancePolicyCommission.receipts).selectinload(InsuranceCommissionReceipt.recorded_by),
        )
        .where(InsurancePolicyCommission.id == commission_id)
    )
    comm = (await session.execute(stmt)).scalar_one_or_none()
    if not comm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Commission record {commission_id} not found.",
        )

    if comm.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve commission in '{comm.status}' state. Only 'PENDING' commissions can be approved.",
        )

    comm.status = "APPROVED"
    comm.approved_by_id = user_id
    comm.approved_at = datetime.now(UTC)
    if payload.approval_notes:
        comm.approval_notes = payload.approval_notes.strip()

    comm.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(comm)
    return _map_commission_to_response(comm)


async def update_policy_commission(
    session: AsyncSession,
    commission_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: PolicyCommissionUpdate,
) -> PolicyCommissionResponse:
    """Update or manually override insurer commission details (Stage 1 Insurer Commission)."""
    stmt = (
        select(InsurancePolicyCommission)
        .options(
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.company),
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.plan),
            selectinload(InsurancePolicyCommission.sub_agent),
            selectinload(InsurancePolicyCommission.approved_by),
            selectinload(InsurancePolicyCommission.reversed_by),
            selectinload(InsurancePolicyCommission.receipts).selectinload(InsuranceCommissionReceipt.recorded_by),
        )
        .where(InsurancePolicyCommission.id == commission_id)
    )
    comm = (await session.execute(stmt)).scalar_one_or_none()
    if not comm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Commission record {commission_id} not found.",
        )

    if comm.status == "REVERSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify a REVERSED commission record.",
        )

    if payload.net_premium_applied is not None:
        comm.net_premium_applied = payload.net_premium_applied.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if payload.commission_type is not None:
        comm.commission_type = payload.commission_type.strip().upper()

    net_prem = comm.net_premium_applied or Decimal("0.00")

    if payload.gross_commission_amount is not None:
        comm.gross_commission_amount = payload.gross_commission_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if net_prem > 0:
            comm.gross_commission_rate = ((comm.gross_commission_amount / net_prem) * Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    elif payload.gross_commission_rate is not None:
        comm.gross_commission_rate = payload.gross_commission_rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        comm.gross_commission_amount = (net_prem * (comm.gross_commission_rate / Decimal("100.00"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if payload.tds_rate is not None:
        comm.tds_rate = payload.tds_rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        comm.tds_amount = (comm.gross_commission_amount * (comm.tds_rate / Decimal("100.00"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    elif payload.tds_amount is not None:
        comm.tds_amount = payload.tds_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if comm.gross_commission_amount > 0:
            comm.tds_rate = ((comm.tds_amount / comm.gross_commission_amount) * Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if payload.net_commission_payable is not None:
        comm.net_commission_payable = payload.net_commission_payable.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        comm.net_commission_payable = comm.gross_commission_amount - (comm.tds_amount or Decimal("0.00"))

    # Recalculate balance receivable
    tot_net_received = comm.actual_net_received or Decimal("0.00")
    comm.balance_receivable = max(Decimal("0.00"), comm.net_commission_payable - tot_net_received)

    if payload.override_reason:
        comm.override_reason = payload.override_reason
        comm.calculation_source = "MANUAL_OVERRIDE"
    if payload.bank_reference:
        comm.bank_reference = payload.bank_reference
    if payload.notes:
        comm.notes = payload.notes
    if payload.payment_date:
        comm.payment_date = payload.payment_date

    comm.updated_at = datetime.now(UTC)

    # Sync associated sub-agent payout insurer_gross_commission if payout exists and status is PENDING
    payout_stmt = select(InsuranceSubAgentPayout).where(
        InsuranceSubAgentPayout.commission_id == comm.id,
        InsuranceSubAgentPayout.status == "PENDING",
    )
    payout = (await session.execute(payout_stmt)).scalar_one_or_none()
    if payout:
        payout.insurer_gross_commission = comm.gross_commission_amount
        if payout.agreed_percentage and payout.agreed_percentage > 0:
            payout.payable_amount = (comm.gross_commission_amount * (payout.agreed_percentage / Decimal("100.00"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            payout.tds_amount = (payout.payable_amount * (payout.tds_rate / Decimal("100.00"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            payout.net_payable_amount = payout.payable_amount - payout.tds_amount
            payout.remaining_payable = max(Decimal("0.00"), payout.net_payable_amount - (payout.amount_paid or Decimal("0.00")))

    await session.commit()
    await session.refresh(comm)
    return _map_commission_to_response(comm)


async def record_commission_receipt(
    session: AsyncSession,
    commission_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: CommissionReceiptCreate,
) -> PolicyCommissionResponse:
    """Record an actual bank receipt against a commission and perform financial reconciliation."""
    stmt = (
        select(InsurancePolicyCommission)
        .options(
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.company),
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.plan),
            selectinload(InsurancePolicyCommission.sub_agent),
            selectinload(InsurancePolicyCommission.approved_by),
            selectinload(InsurancePolicyCommission.reversed_by),
            selectinload(InsurancePolicyCommission.receipts).selectinload(InsuranceCommissionReceipt.recorded_by),
        )
        .where(InsurancePolicyCommission.id == commission_id)
    )
    comm = (await session.execute(stmt)).scalar_one_or_none()
    if not comm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Commission record {commission_id} not found.",
        )

    if comm.status == "REVERSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot record bank receipt against a REVERSED commission.",
        )

    # Prevent duplicate receipt transactions by reference
    if payload.transaction_reference and payload.transaction_reference.strip():
        dup_stmt = select(InsuranceCommissionReceipt).where(
            InsuranceCommissionReceipt.commission_id == comm.id,
            InsuranceCommissionReceipt.transaction_reference == payload.transaction_reference.strip(),
        )
        if (await session.execute(dup_stmt)).scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate receipt: Transaction reference '{payload.transaction_reference.strip()}' has already been recorded for this commission.",
            )

    gross = (payload.gross_amount or payload.actual_gross_commission or payload.net_amount or Decimal("0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    tds = (payload.tds_deducted or payload.actual_tds_amount or Decimal("0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    # Expected net receivable for this receipt
    if payload.net_amount is not None:
        net_expected = payload.net_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    elif gross > Decimal("0.00"):
        net_expected = (gross - tds).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        net_expected = (payload.actual_bank_received or Decimal("0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Actual bank received amount
    if payload.actual_bank_received is not None:
        bank_rcvd = payload.actual_bank_received.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        bank_rcvd = net_expected

    doc_url = payload.supporting_document_url or payload.document_url

    receipt = InsuranceCommissionReceipt(
        id=uuid.uuid4(),
        commission_id=comm.id,
        receipt_date=payload.receipt_date,
        net_amount=net_expected,
        actual_bank_received=bank_rcvd,
        gross_amount=gross,
        tds_deducted=tds,
        actual_commission_rate=payload.actual_commission_rate,
        actual_tds_rate=payload.actual_tds_rate,
        bank_account=payload.bank_account,
        payment_mode=payload.payment_mode,
        bank_name=payload.bank_name,
        transaction_reference=payload.transaction_reference.strip() if payload.transaction_reference else None,
        tds_certificate_ref=payload.tds_certificate_ref,
        receipt_type=payload.receipt_type,
        notes=payload.notes,
        supporting_document_url=doc_url,
        recorded_by_id=user_id,
    )
    session.add(receipt)
    await session.flush()

    # Recalculate totals across all receipts for this commission
    receipts_stmt = select(InsuranceCommissionReceipt).where(InsuranceCommissionReceipt.commission_id == comm.id)
    all_receipts = (await session.execute(receipts_stmt)).scalars().all()

    tot_bank = sum(getattr(r, "actual_bank_received", None) if getattr(r, "actual_bank_received", None) is not None else r.net_amount for r in all_receipts)
    tot_tds = sum(r.tds_deducted for r in all_receipts)
    tot_gross = sum(r.gross_amount for r in all_receipts)

    comm.actual_net_received = tot_bank
    comm.actual_tds_deducted = tot_tds
    comm.actual_gross_received = tot_gross
    if payload.actual_commission_rate is not None:
        comm.actual_commission_rate = payload.actual_commission_rate
    if payload.actual_tds_rate is not None:
        comm.actual_tds_rate = payload.actual_tds_rate
    if payload.bank_account:
        comm.bank_account = payload.bank_account

    # Expected net commission
    expected_net = comm.net_commission_payable or (comm.gross_commission_amount - (comm.tds_amount or Decimal("0.00")))
    diff = (tot_bank - expected_net).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    comm.reconciliation_difference = diff
    comm.balance_receivable = max(Decimal("0.00"), expected_net - tot_bank)

    if diff == Decimal("0.00"):
        comm.status = "RECEIVED"
        comm.reconciliation_status = "RECONCILED"
        comm.payment_date = payload.receipt_date
    elif diff < Decimal("0.00"):
        if getattr(payload, "is_final_settlement", False) or payload.receipt_type in ("SHORT_PAYMENT", "FINAL_SETTLEMENT"):
            comm.status = "SHORT_RECEIVED"
        else:
            comm.status = "PARTIALLY_RECEIVED"
        comm.reconciliation_status = "SHORT_PAYMENT"
    else:
        comm.status = "EXCESS_RECEIVED"
        comm.reconciliation_status = "EXCESS_PAYMENT"
        comm.payment_date = payload.receipt_date

    if payload.transaction_reference:
        comm.bank_reference = payload.transaction_reference

    # Synchronize policy status
    if comm.policy:
        comm.policy.commission_received_status = comm.status
        comm.policy.actual_commission_received_amount = tot_bank
        comm.policy.commission_received_date = payload.receipt_date
        if payload.transaction_reference:
            comm.policy.commission_bank_reference = payload.transaction_reference

    comm.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(comm)
    return _map_commission_to_response(comm)



async def reverse_commission(
    session: AsyncSession,
    commission_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: CommissionReversalRequest,
) -> PolicyCommissionResponse:
    """Reverse a commission record with mandatory audit reason."""
    stmt = (
        select(InsurancePolicyCommission)
        .options(
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.company),
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.plan),
            selectinload(InsurancePolicyCommission.sub_agent),
            selectinload(InsurancePolicyCommission.approved_by),
            selectinload(InsurancePolicyCommission.reversed_by),
            selectinload(InsurancePolicyCommission.receipts).selectinload(InsuranceCommissionReceipt.recorded_by),
        )
        .where(InsurancePolicyCommission.id == commission_id)
    )
    comm = (await session.execute(stmt)).scalar_one_or_none()
    if not comm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Commission record {commission_id} not found.",
        )

    if comm.status == "REVERSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Commission record is already REVERSED.",
        )

    reason = payload.reversal_reason.strip()
    if len(reason) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A detailed reversal reason (at least 5 characters) is mandatory.",
        )

    comm.status = "REVERSED"
    comm.reversed_by_id = user_id
    comm.reversed_at = datetime.now(UTC)
    comm.reversal_reason = reason
    comm.reversal_amount = payload.reversal_amount or comm.gross_commission_amount

    if payload.notes:
        existing_notes = f"{comm.notes}\n" if comm.notes else ""
        comm.notes = f"{existing_notes}Reversal note: {payload.notes.strip()}".strip()

    if comm.policy:
        comm.policy.commission_received_status = "REVERSED"

    comm.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(comm)
    return _map_commission_to_response(comm)



async def get_agent_performance_reports(
    session: AsyncSession,
    from_date: date | None = None,
    to_date: date | None = None,
    company_id: uuid.UUID | None = None,
    policy_category: str | None = None,
) -> list[AgentPerformanceReportItem]:
    """Generate agent performance metrics aggregated from real database commissions."""
    sub_agents = (await session.execute(select(InsuranceSubAgent).order_by(InsuranceSubAgent.full_name))).scalars().all()

    report_items: list[AgentPerformanceReportItem] = []

    for sa in sub_agents:
        # Base query for this agent
        q = select(InsurancePolicyCommission).where(InsurancePolicyCommission.sub_agent_id == sa.id)
        if from_date:
            q = q.where(InsurancePolicyCommission.created_at >= datetime.combine(from_date, datetime.min.time(), tzinfo=UTC))
        if to_date:
            q = q.where(InsurancePolicyCommission.created_at <= datetime.combine(to_date, datetime.max.time(), tzinfo=UTC))
        if company_id:
            q = q.join(InsurancePolicy, InsurancePolicyCommission.policy_id == InsurancePolicy.id, isouter=True).where(
                InsurancePolicy.company_id == company_id
            )
        if policy_category and policy_category != "ALL":
            q = q.where(InsurancePolicyCommission.policy_category == policy_category)

        comms = (await session.execute(q)).scalars().all()
        if not comms:
            continue

        tot_pols = len({c.policy_id for c in comms})
        active_pols = len({c.policy_id for c in comms if c.status != "REVERSED"})
        first_yr = sum(c.sub_agent_amount for c in comms if c.commission_type == "FIRST_YEAR" and c.status != "REVERSED")
        renewal = sum(c.sub_agent_amount for c in comms if c.commission_type == "RENEWAL" and c.status != "REVERSED")
        tot_gross = sum(c.gross_commission_amount for c in comms if c.status != "REVERSED")
        sa_share = sum(c.sub_agent_amount for c in comms if c.status != "REVERSED")
        sa_tds = sum(c.sub_agent_tds_amount or Decimal("0.00") for c in comms if c.status != "REVERSED")
        net_payable = sum(c.sub_agent_net_payout or (c.sub_agent_amount - (c.sub_agent_tds_amount or Decimal("0.00"))) for c in comms if c.status != "REVERSED")
        actual_paid = sum(c.sub_agent_net_payout or c.sub_agent_amount for c in comms if c.status == "PAID")
        pending_payout = sum(c.sub_agent_net_payout or c.sub_agent_amount for c in comms if c.status in ("PENDING", "APPROVED", "PARTIALLY_PAID"))
        rev_amt = sum(c.reversal_amount or c.gross_commission_amount for c in comms if c.status == "REVERSED")
        avg_rate = (sum(c.gross_commission_rate or Decimal("0.00") for c in comms) / len(comms)).quantize(Decimal("0.01")) if comms else Decimal("0.00")

        report_items.append(
            AgentPerformanceReportItem(
                agent_id=sa.id,
                agent_name=sa.full_name,
                agent_code=sa.agent_code,
                total_policies=tot_pols,
                active_policies=active_pols,
                first_year_commission=first_yr,
                renewal_commission=renewal,
                gross_commission=tot_gross,
                average_commission_rate=avg_rate,
                sub_agent_share=sa_share,
                sub_agent_tds=sa_tds,
                net_payable=net_payable,
                actual_paid=actual_paid,
                pending_payout=pending_payout,
                reversed_amount=rev_amt,
            )
        )

    # Also add Main Firm Direct performance
    firm_q = select(InsurancePolicyCommission).where(InsurancePolicyCommission.sub_agent_id.is_(None))
    if from_date:
        firm_q = firm_q.where(InsurancePolicyCommission.created_at >= datetime.combine(from_date, datetime.min.time(), tzinfo=UTC))
    if to_date:
        firm_q = firm_q.where(InsurancePolicyCommission.created_at <= datetime.combine(to_date, datetime.max.time(), tzinfo=UTC))
    firm_comms = (await session.execute(firm_q)).scalars().all()
    if firm_comms:
        tot_pols = len({c.policy_id for c in firm_comms})
        active_pols = len({c.policy_id for c in firm_comms if c.status != "REVERSED"})
        first_yr = sum(c.firm_net_amount for c in firm_comms if c.commission_type == "FIRST_YEAR" and c.status != "REVERSED")
        renewal = sum(c.firm_net_amount for c in firm_comms if c.commission_type == "RENEWAL" and c.status != "REVERSED")
        tot_gross = sum(c.gross_commission_amount for c in firm_comms if c.status != "REVERSED")
        firm_tds = sum(c.tds_amount or Decimal("0.00") for c in firm_comms if c.status != "REVERSED")
        net_payable = sum(c.net_commission_payable or Decimal("0.00") for c in firm_comms if c.status != "REVERSED")
        actual_paid = sum(c.actual_net_received for c in firm_comms if c.status == "PAID")
        pending_payout = sum(c.net_commission_payable or Decimal("0.00") for c in firm_comms if c.status in ("PENDING", "APPROVED", "PARTIALLY_PAID"))
        rev_amt = sum(c.reversal_amount or c.gross_commission_amount for c in firm_comms if c.status == "REVERSED")
        avg_rate = (sum(c.gross_commission_rate or Decimal("0.00") for c in firm_comms) / len(firm_comms)).quantize(Decimal("0.01")) if firm_comms else Decimal("0.00")

        report_items.insert(
            0,
            AgentPerformanceReportItem(
                agent_id=None,
                agent_name="Main Firm Direct (Internal)",
                agent_code="FIRM-DIR",
                total_policies=tot_pols,
                active_policies=active_pols,
                first_year_commission=first_yr,
                renewal_commission=renewal,
                gross_commission=tot_gross,
                average_commission_rate=avg_rate,
                sub_agent_share=Decimal("0.00"),
                sub_agent_tds=firm_tds,
                net_payable=net_payable,
                actual_paid=actual_paid,
                pending_payout=pending_payout,
                reversed_amount=rev_amt,
            ),
        )

    return report_items


async def export_commissions_csv(
    session: AsyncSession,
    agent_id: uuid.UUID | None = None,
    company_id: uuid.UUID | None = None,
    policy_category: str | None = None,
    commission_type: str | None = None,
    status_filter: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    search: str | None = None,
) -> str:
    """Generate CSV string for Commission Ledger with exact currency and metadata."""
    res = await list_commissions(
        session=session,
        agent_id=agent_id,
        company_id=company_id,
        policy_category=policy_category,
        commission_type=commission_type,
        status_filter=status_filter,
        from_date=from_date,
        to_date=to_date,
        search=search,
        page=1,
        page_size=10000,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Policy Number",
        "Policyholder",
        "Customer Phone",
        "Insurance Company",
        "Policy Plan",
        "Category",
        "Tier / Type",
        "Net Premium Base (INR)",
        "Rate (%)",
        "Gross Insurer Comm (INR)",
        "Sub-Agent Share (INR)",
        "Firm Share (INR)",
        "TDS Deducted (INR)",
        "Net Receivable (INR)",
        "Actual Net Received (INR)",
        "Reconciliation Diff (INR)",
        "Reconciliation Status",
        "Recipient",
        "Status",
        "Expected Receipt Date",
        "Payment Date",
        "Created Date",
    ])

    for item in res.items:
        writer.writerow([
            item.policy_number or "N/A",
            item.customer_name or "N/A",
            item.customer_phone or "N/A",
            item.company_name or "N/A",
            item.plan_name or "N/A",
            item.policy_category or "N/A",
            item.commission_type,
            f"{item.net_premium_applied:.2f}" if item.net_premium_applied is not None else "0.00",
            f"{item.gross_commission_rate:.2f}" if item.gross_commission_rate is not None else "0.00",
            f"{item.gross_commission_amount:.2f}",
            f"{item.sub_agent_amount:.2f}",
            f"{item.firm_net_amount:.2f}",
            f"{item.tds_amount:.2f}",
            f"{item.net_commission_payable:.2f}",
            f"{item.actual_net_received:.2f}",
            f"{item.reconciliation_difference:.2f}",
            item.reconciliation_status,
            item.sub_agent_name if item.sub_agent_name else "Main Firm Direct",
            item.status,
            item.expected_receipt_date.isoformat() if item.expected_receipt_date else "",
            item.payment_date.isoformat() if item.payment_date else "",
            item.created_at.strftime("%Y-%m-%d %H:%M:%S") if item.created_at else "",
        ])

    return output.getvalue()


async def export_commissions_excel(
    session: AsyncSession,
    agent_id: uuid.UUID | None = None,
    company_id: uuid.UUID | None = None,
    policy_category: str | None = None,
    commission_type: str | None = None,
    status_filter: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    search: str | None = None,
) -> bytes:
    """Generate Excel binary workbook for Commission Ledger."""
    res = await list_commissions(
        session=session,
        agent_id=agent_id,
        company_id=company_id,
        policy_category=policy_category,
        commission_type=commission_type,
        status_filter=status_filter,
        from_date=from_date,
        to_date=to_date,
        search=search,
        page=1,
        page_size=10000,
    )

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Commission Ledger"

    headers = [
        "Policy Number",
        "Policyholder",
        "Insurance Company",
        "Policy Plan",
        "Category",
        "Commission Type",
        "Net Premium Base",
        "Rate (%)",
        "Gross Comm",
        "Sub-Agent Share",
        "Firm Share",
        "TDS",
        "Net Receivable",
        "Actual Received",
        "Diff",
        "Reconciliation",
        "Recipient",
        "Status",
        "Expected Date",
        "Created Date",
    ]

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")  # Teal-700
    alignment = Alignment(horizontal="center", vertical="center")

    ws.append(headers)
    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = alignment

    for row_idx, item in enumerate(res.items, start=2):
        ws.append([
            item.policy_number or "N/A",
            item.customer_name or "N/A",
            item.company_name or "N/A",
            item.plan_name or "N/A",
            item.policy_category or "N/A",
            item.commission_type,
            float(item.net_premium_applied or 0),
            float(item.gross_commission_rate or 0),
            float(item.gross_commission_amount),
            float(item.sub_agent_amount),
            float(item.firm_net_amount),
            float(item.tds_amount),
            float(item.net_commission_payable),
            float(item.actual_net_received),
            float(item.reconciliation_difference),
            item.reconciliation_status,
            item.sub_agent_name or "Main Firm Direct",
            item.status,
            item.expected_receipt_date.isoformat() if item.expected_receipt_date else "",
            item.created_at.strftime("%Y-%m-%d %H:%M") if item.created_at else "",
        ])

    # Auto-adjust column widths
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# -------------------------------------------------------------
# Insurer Commission Agreements CRUD
# -------------------------------------------------------------
async def list_commission_agreements(
    session: AsyncSession,
    company_id: uuid.UUID | None = None,
    is_active: bool | None = None,
) -> list[CompanyCommissionAgreementResponse]:
    """List configured commission agreements with company and plan names."""
    stmt = (
        select(InsuranceCompanyCommissionAgreement)
        .options(
            selectinload(InsuranceCompanyCommissionAgreement.company),
            selectinload(InsuranceCompanyCommissionAgreement.plan),
        )
        .order_by(
            InsuranceCompanyCommissionAgreement.company_id,
            InsuranceCompanyCommissionAgreement.effective_from.desc(),
        )
    )
    if company_id:
        stmt = stmt.where(InsuranceCompanyCommissionAgreement.company_id == company_id)
    if is_active is not None:
        stmt = stmt.where(InsuranceCompanyCommissionAgreement.is_active == is_active)

    agreements = (await session.execute(stmt)).scalars().all()
    return [
        CompanyCommissionAgreementResponse(
            id=a.id,
            company_id=a.company_id,
            company_name=a.company.name if a.company else None,
            policy_category=a.policy_category,
            plan_id=a.plan_id,
            plan_name=a.plan.name if a.plan else None,
            first_year_commission_rate=a.first_year_commission_rate,
            renewal_commission_rate=a.renewal_commission_rate,
            special_commission_rate=a.special_commission_rate,
            commissionable_basis=a.commissionable_basis,
            tds_rate=a.tds_rate,
            effective_from=a.effective_from,
            effective_to=a.effective_to,
            is_active=a.is_active,
            notes=a.notes,
            created_at=a.created_at,
            updated_at=a.updated_at,
        )
        for a in agreements
    ]


async def create_commission_agreement(
    session: AsyncSession,
    payload: CompanyCommissionAgreementCreate,
) -> CompanyCommissionAgreementResponse:
    """Create a new insurer commission agreement."""
    # Verify company exists
    company = await session.get(InsuranceCompany, payload.company_id)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insurance Company {payload.company_id} not found.",
        )

    plan = None
    if payload.plan_id:
        plan = await session.get(InsurancePlan, payload.plan_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Insurance Plan {payload.plan_id} not found.",
            )

    agreement = InsuranceCompanyCommissionAgreement(
        id=uuid.uuid4(),
        company_id=payload.company_id,
        policy_category=payload.policy_category,
        plan_id=payload.plan_id,
        first_year_commission_rate=payload.first_year_commission_rate.quantize(Decimal("0.01")),
        renewal_commission_rate=payload.renewal_commission_rate.quantize(Decimal("0.01")),
        special_commission_rate=payload.special_commission_rate.quantize(Decimal("0.01")) if payload.special_commission_rate is not None else None,
        commissionable_basis=payload.commissionable_basis or "NET_PREMIUM",
        tds_rate=payload.tds_rate.quantize(Decimal("0.01")),
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
        is_active=payload.is_active,
        notes=payload.notes,
    )
    session.add(agreement)
    await session.commit()
    await session.refresh(agreement)

    return CompanyCommissionAgreementResponse(
        id=agreement.id,
        company_id=agreement.company_id,
        company_name=company.name,
        policy_category=agreement.policy_category,
        plan_id=agreement.plan_id,
        plan_name=plan.name if plan else None,
        first_year_commission_rate=agreement.first_year_commission_rate,
        renewal_commission_rate=agreement.renewal_commission_rate,
        special_commission_rate=agreement.special_commission_rate,
        commissionable_basis=agreement.commissionable_basis,
        tds_rate=agreement.tds_rate,
        effective_from=agreement.effective_from,
        effective_to=agreement.effective_to,
        is_active=agreement.is_active,
        notes=agreement.notes,
        created_at=agreement.created_at,
        updated_at=agreement.updated_at,
    )


async def update_commission_agreement(
    session: AsyncSession,
    agreement_id: uuid.UUID,
    payload: CompanyCommissionAgreementUpdate,
) -> CompanyCommissionAgreementResponse:
    """Update an existing insurer commission agreement without affecting historical policies."""
    agreement = await session.get(InsuranceCompanyCommissionAgreement, agreement_id)
    if not agreement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Commission Agreement {agreement_id} not found.",
        )

    if payload.policy_category is not None:
        agreement.policy_category = payload.policy_category
    if payload.plan_id is not None:
        agreement.plan_id = payload.plan_id
    if payload.first_year_commission_rate is not None:
        agreement.first_year_commission_rate = payload.first_year_commission_rate.quantize(Decimal("0.01"))
    if payload.renewal_commission_rate is not None:
        agreement.renewal_commission_rate = payload.renewal_commission_rate.quantize(Decimal("0.01"))
    if payload.special_commission_rate is not None:
        agreement.special_commission_rate = payload.special_commission_rate.quantize(Decimal("0.01"))
    if payload.commissionable_basis is not None:
        agreement.commissionable_basis = payload.commissionable_basis
    if payload.tds_rate is not None:
        agreement.tds_rate = payload.tds_rate.quantize(Decimal("0.01"))
    if payload.effective_to is not None:
        agreement.effective_to = payload.effective_to
    if payload.is_active is not None:
        agreement.is_active = payload.is_active
    if payload.notes is not None:
        agreement.notes = payload.notes

    agreement.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(agreement)

    company = await session.get(InsuranceCompany, agreement.company_id)
    plan = await session.get(InsurancePlan, agreement.plan_id) if agreement.plan_id else None

    return CompanyCommissionAgreementResponse(
        id=agreement.id,
        company_id=agreement.company_id,
        company_name=company.name if company else None,
        policy_category=agreement.policy_category,
        plan_id=agreement.plan_id,
        plan_name=plan.name if plan else None,
        first_year_commission_rate=agreement.first_year_commission_rate,
        renewal_commission_rate=agreement.renewal_commission_rate,
        special_commission_rate=agreement.special_commission_rate,
        commissionable_basis=agreement.commissionable_basis,
        tds_rate=agreement.tds_rate,
        effective_from=agreement.effective_from,
        effective_to=agreement.effective_to,
        is_active=agreement.is_active,
        notes=agreement.notes,
        created_at=agreement.created_at,
        updated_at=agreement.updated_at,
    )


# Backward compatibility alias
async def update_commission_status(
    session: AsyncSession,
    commission_id: uuid.UUID,
    payload: PolicyCommissionStatusUpdate,
) -> PolicyCommissionResponse:
    """Transition commission status (PENDING, APPROVED, PAID, REVERSED) with validation."""
    comm = (
        await session.execute(
            select(InsurancePolicyCommission)
            .options(
                selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.customer),
                selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.company),
                selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.plan),
                selectinload(InsurancePolicyCommission.sub_agent),
                selectinload(InsurancePolicyCommission.approved_by),
                selectinload(InsurancePolicyCommission.reversed_by),
                selectinload(InsurancePolicyCommission.receipts).selectinload(InsuranceCommissionReceipt.recorded_by),
            )
            .where(InsurancePolicyCommission.id == commission_id)
        )
    ).scalar_one_or_none()

    if not comm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Commission record {commission_id} not found.",
        )

    new_stat = payload.status.strip().upper()
    valid_statuses = ("PENDING", "APPROVED", "PARTIALLY_PAID", "PAID", "REVERSED")
    if new_stat not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.status}'. Valid: {', '.join(valid_statuses)}.",
        )

    comm.status = new_stat
    if payload.payment_date:
        comm.payment_date = payload.payment_date
    elif new_stat == "PAID" and not comm.payment_date:
        comm.payment_date = date.today()

    if payload.notes:
        comm.notes = payload.notes.strip()

    if comm.policy:
        comm.policy.commission_received_status = new_stat

    comm.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(comm)
    return _map_commission_to_response(comm)



async def get_commission_reports(session: AsyncSession) -> dict:
    """Generate high-level commission totals, TDS, and agent-wise summary."""
    kpis = await get_commission_kpis(session)
    agent_reports = await get_agent_performance_reports(session)

    return {
        "total_gross_commission": float(kpis.total_gross_commission),
        "total_tds_deducted": float(kpis.tds_deducted),
        "total_net_commission_payable": float(kpis.total_gross_commission - kpis.tds_deducted),
        "total_sub_agent_commission": float(kpis.sub_agent_payable),
        "total_firm_net": float(kpis.firm_retained_revenue),
        "total_firm_bank_credit": float(kpis.firm_retained_revenue - kpis.tds_deducted),
        "total_paid_commission": float(kpis.actual_net_received),
        "total_pending_commission": float(kpis.pending_commission),
        "agent_breakdown": [
            {
                "agent_id": str(r.agent_id) if r.agent_id else None,
                "agent_name": r.agent_name,
                "agent_code": r.agent_code,
                "commissions_count": r.total_policies,
                "total_earned": float(r.sub_agent_share),
                "actual_paid": float(r.actual_paid),
                "pending_payout": float(r.pending_payout),
            }
            for r in agent_reports
        ],
    }


def _generate_excel_bytes(title: str, headers: list[str], rows: list[list[Any]]) -> bytes:
    """Generate professional, styled Excel binary spreadsheet using openpyxl."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = title[:31]

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")  # Teal-700
    alignment_center = Alignment(horizontal="center", vertical="center")
    alignment_left = Alignment(horizontal="left", vertical="center")
    alignment_right = Alignment(horizontal="right", vertical="center")

    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    ws.append(headers)
    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = alignment_center

    for row_idx, r in enumerate(rows, start=2):
        ws.append(r)
        for col_idx, val in enumerate(r, start=1):
            c = ws.cell(row=row_idx, column=col_idx)
            c.border = thin_border
            if isinstance(val, (int, float, Decimal)):
                c.alignment = alignment_right
            else:
                c.alignment = alignment_left

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 14)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _generate_csv_string(headers: list[str], rows: list[list[Any]]) -> str:
    """Generate CSV string from headers and rows."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    for r in rows:
        writer.writerow(r)
    return output.getvalue()


async def dispute_commission(
    session: AsyncSession,
    commission_id: uuid.UUID,
    user_id: uuid.UUID,
    dispute_reason: str,
) -> PolicyCommissionResponse:
    """Flag an insurer commission as DISPUTED due to discrepancy or clawback under review."""
    stmt = (
        select(InsurancePolicyCommission)
        .options(
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.company),
            selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.plan),
            selectinload(InsurancePolicyCommission.sub_agent),
            selectinload(InsurancePolicyCommission.approved_by),
            selectinload(InsurancePolicyCommission.reversed_by),
            selectinload(InsurancePolicyCommission.receipts).selectinload(InsuranceCommissionReceipt.recorded_by),
        )
        .where(InsurancePolicyCommission.id == commission_id)
    )
    comm = (await session.execute(stmt)).scalar_one_or_none()
    if not comm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Commission record {commission_id} not found.",
        )
    comm.status = "DISPUTED"
    existing_notes = f"{comm.notes}\n" if comm.notes else ""
    comm.notes = f"{existing_notes}Dispute raised: {dispute_reason.strip()}".strip()
    comm.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(comm)
    return _map_commission_to_response(comm)



async def list_sub_agent_payouts(
    session: AsyncSession,
    sub_agent_id: uuid.UUID | None = None,
    company_id: uuid.UUID | None = None,
    commission_type: str | None = None,
    status_filter: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> PaginatedResponse[SubAgentPayoutResponse]:
    """Retrieve sub-agent payout obligations with joined relations, filtering, and pagination."""
    query = (
        select(InsuranceSubAgentPayout)
        .options(
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.company),
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.plan),
            selectinload(InsuranceSubAgentPayout.sub_agent),
            selectinload(InsuranceSubAgentPayout.approved_by),
            selectinload(InsuranceSubAgentPayout.reversed_by),
            selectinload(InsuranceSubAgentPayout.payments).selectinload(InsuranceSubAgentPayoutPayment.recorded_by),
        )
    )

    if search:
        s_term = f"%{search.strip()}%"
        query = (
            query.join(InsurancePolicy, InsuranceSubAgentPayout.policy_id == InsurancePolicy.id)
            .outerjoin(Customer, InsurancePolicy.customer_id == Customer.id)
            .join(InsuranceSubAgent, InsuranceSubAgentPayout.sub_agent_id == InsuranceSubAgent.id)
            .where(
                or_(
                    InsurancePolicy.policy_number.ilike(s_term),
                    InsuranceSubAgent.full_name.ilike(s_term),
                    InsuranceSubAgent.agent_code.ilike(s_term),
                    Customer.first_name.ilike(s_term),
                    Customer.last_name.ilike(s_term),
                )
            )
        )

    if sub_agent_id:
        query = query.where(InsuranceSubAgentPayout.sub_agent_id == sub_agent_id)
    if company_id:
        query = query.join(InsurancePolicy, InsuranceSubAgentPayout.policy_id == InsurancePolicy.id, isouter=True).where(
            InsurancePolicy.company_id == company_id
        )
    if commission_type and commission_type != "ALL":
        query = query.where(InsuranceSubAgentPayout.commission_type == commission_type.upper())
    if status_filter and status_filter != "ALL":
        query = query.where(InsuranceSubAgentPayout.status == status_filter.upper())
    if from_date:
        query = query.where(InsuranceSubAgentPayout.created_at >= datetime.combine(from_date, datetime.min.time(), tzinfo=UTC))
    if to_date:
        query = query.where(InsuranceSubAgentPayout.created_at <= datetime.combine(to_date, datetime.max.time(), tzinfo=UTC))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(InsuranceSubAgentPayout.created_at.desc()).offset(offset).limit(page_size)
    payouts = (await session.execute(query)).scalars().all()

    items = [_map_sub_agent_payout_to_response(p) for p in payouts]
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


async def get_sub_agent_payout_detail(
    session: AsyncSession,
    payout_id: uuid.UUID,
) -> SubAgentPayoutResponse:
    """Retrieve full sub-agent payout record with payment history and audit."""
    stmt = (
        select(InsuranceSubAgentPayout)
        .options(
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.company),
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.plan),
            selectinload(InsuranceSubAgentPayout.sub_agent),
            selectinload(InsuranceSubAgentPayout.approved_by),
            selectinload(InsuranceSubAgentPayout.reversed_by),
            selectinload(InsuranceSubAgentPayout.payments).selectinload(InsuranceSubAgentPayoutPayment.recorded_by),
        )
        .where(InsuranceSubAgentPayout.id == payout_id)
    )
    payout = (await session.execute(stmt)).scalar_one_or_none()
    if not payout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sub-agent payout record {payout_id} not found.",
        )
    return _map_sub_agent_payout_to_response(payout)


async def approve_sub_agent_payout(
    session: AsyncSession,
    payout_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: SubAgentPayoutApprovalRequest,
) -> SubAgentPayoutResponse:
    """Approve a pending sub-agent payout obligation."""
    stmt = (
        select(InsuranceSubAgentPayout)
        .options(
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.company),
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.plan),
            selectinload(InsuranceSubAgentPayout.sub_agent),
            selectinload(InsuranceSubAgentPayout.approved_by),
            selectinload(InsuranceSubAgentPayout.reversed_by),
            selectinload(InsuranceSubAgentPayout.payments).selectinload(InsuranceSubAgentPayoutPayment.recorded_by),
        )
        .where(InsuranceSubAgentPayout.id == payout_id)
    )
    payout = (await session.execute(stmt)).scalar_one_or_none()
    if not payout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sub-agent payout record {payout_id} not found.",
        )

    if payout.status not in ("PENDING", "ON_HOLD"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve payout in '{payout.status}' status. Payout must be PENDING or ON_HOLD.",
        )

    payout.status = "APPROVED"
    payout.approved_by_id = user_id
    payout.approved_at = datetime.now(UTC)
    if payload.approval_notes:
        payout.approval_notes = payload.approval_notes.strip()
    payout.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(payout)
    return _map_sub_agent_payout_to_response(payout)


async def update_sub_agent_payout_allocation(
    session: AsyncSession,
    payout_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: SubAgentPayoutUpdate,
) -> SubAgentPayoutResponse:
    """Configure or update sub-agent commission allocation split (Stage 2 Sub-Agent Payable)."""
    stmt = (
        select(InsuranceSubAgentPayout)
        .options(
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.company),
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.plan),
            selectinload(InsuranceSubAgentPayout.sub_agent),
            selectinload(InsuranceSubAgentPayout.approved_by),
            selectinload(InsuranceSubAgentPayout.reversed_by),
            selectinload(InsuranceSubAgentPayout.payments).selectinload(InsuranceSubAgentPayoutPayment.recorded_by),
        )
        .where(InsuranceSubAgentPayout.id == payout_id)
    )
    payout = (await session.execute(stmt)).scalar_one_or_none()
    if not payout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sub-agent payout record {payout_id} not found.",
        )

    if payout.status in ("PAID", "REVERSED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit allocation for a payout in '{payout.status}' status.",
        )

    gross = payout.insurer_gross_commission
    tds_pct = payload.tds_rate or payout.tds_rate or Decimal("5.00")
    payout.tds_rate = tds_pct

    if payload.allocation_type == "PERCENTAGE" and payload.allocation_rate is not None:
        rate = payload.allocation_rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        payout.agreed_percentage = rate
        payout.payable_amount = (gross * (rate / Decimal("100.00"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        payout.split_rule_applied = f"Manual Config: {rate}% of Insurer Gross"
    elif payload.allocation_type == "FIXED" and payload.fixed_amount is not None:
        fix_amt = payload.fixed_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        payout.payable_amount = min(fix_amt, gross)
        payout.agreed_percentage = ((payout.payable_amount / gross) * Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if gross > 0 else Decimal("0.00")
        payout.split_rule_applied = f"Manual Config: Fixed ₹{fix_amt}"
    elif payload.payable_amount is not None:
        pay_amt = payload.payable_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        payout.payable_amount = pay_amt
        payout.agreed_percentage = ((pay_amt / gross) * Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if gross > 0 else Decimal("0.00")
        payout.split_rule_applied = f"Manual Override: ₹{pay_amt}"

    payout.tds_amount = (payout.payable_amount * (tds_pct / Decimal("100.00"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    payout.net_payable_amount = payout.payable_amount - payout.tds_amount
    payout.remaining_payable = max(Decimal("0.00"), payout.net_payable_amount - (payout.amount_paid or Decimal("0.00")))

    if payload.notes:
        payout.notes = payload.notes
    payout.updated_at = datetime.now(UTC)

    if payout.commission_id:
        comm = await session.get(InsurancePolicyCommission, payout.commission_id)
        if comm:
            comm.sub_agent_amount = payout.payable_amount
            comm.firm_net_amount = comm.gross_commission_amount - payout.payable_amount
            comm.firm_net_bank_credit = (comm.net_commission_payable - payout.payable_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    await session.commit()
    await session.refresh(payout)
    return _map_sub_agent_payout_to_response(payout)


async def record_sub_agent_payout_payment(
    session: AsyncSession,
    payout_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: SubAgentPayoutPaymentCreate,
) -> SubAgentPayoutResponse:
    """Record an outgoing disbursement (partial or full) against an approved sub-agent payout obligation."""
    stmt = (
        select(InsuranceSubAgentPayout)
        .options(
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.company),
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.plan),
            selectinload(InsuranceSubAgentPayout.sub_agent),
            selectinload(InsuranceSubAgentPayout.approved_by),
            selectinload(InsuranceSubAgentPayout.reversed_by),
            selectinload(InsuranceSubAgentPayout.payments).selectinload(InsuranceSubAgentPayoutPayment.recorded_by),
        )
        .where(InsuranceSubAgentPayout.id == payout_id)
    )
    payout = (await session.execute(stmt)).scalar_one_or_none()
    if not payout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sub-agent payout record {payout_id} not found.",
        )

    if payout.status in ("PENDING", "ON_HOLD", "REVERSED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot disburse funds against payout in '{payout.status}' status. Payout must be APPROVED or PARTIALLY_PAID.",
        )

    if payout.remaining_payable <= Decimal("0.00") and payout.status == "PAID":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payout is already fully paid. No remaining liability to disburse.",
        )

    if payload.transaction_reference and payload.transaction_reference.strip():
        dup_stmt = select(InsuranceSubAgentPayoutPayment).where(
            InsuranceSubAgentPayoutPayment.payout_id == payout.id,
            InsuranceSubAgentPayoutPayment.transaction_reference == payload.transaction_reference.strip(),
        )
        if (await session.execute(dup_stmt)).scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate payment: Transaction reference '{payload.transaction_reference.strip()}' has already been recorded for this payout.",
            )

    net_amt = (payload.net_amount or (payload.amount - payload.tds_deducted)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if net_amt <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Net payout payment amount must be greater than zero.",
        )

    payment_record = InsuranceSubAgentPayoutPayment(
        id=uuid.uuid4(),
        payout_id=payout.id,
        payment_date=payload.payment_date,
        amount=payload.amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        tds_deducted=payload.tds_deducted.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        net_amount=net_amt,
        payment_method=payload.payment_method,
        bank_account_details=payload.bank_account_details,
        transaction_reference=payload.transaction_reference.strip() if payload.transaction_reference else None,
        payment_proof_url=payload.payment_proof_url,
        notes=payload.notes,
        recorded_by_id=user_id,
    )
    session.add(payment_record)
    await session.flush()

    pmts_stmt = select(InsuranceSubAgentPayoutPayment).where(InsuranceSubAgentPayoutPayment.payout_id == payout.id)
    all_pmts = (await session.execute(pmts_stmt)).scalars().all()

    tot_paid = sum(p.net_amount for p in all_pmts)
    payout.amount_paid = tot_paid
    rem = max(Decimal("0.00"), payout.net_payable_amount - tot_paid)
    payout.remaining_payable = rem

    if rem == Decimal("0.00"):
        payout.status = "PAID"
        payout.payout_date = payload.payment_date
    else:
        payout.status = "PARTIALLY_PAID"

    payout.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(payout)
    return _map_sub_agent_payout_to_response(payout)



async def set_sub_agent_payout_on_hold(
    session: AsyncSession,
    payout_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: SubAgentPayoutOnHoldRequest,
) -> SubAgentPayoutResponse:
    """Place a sub-agent payout on hold with explanation."""
    stmt = (
        select(InsuranceSubAgentPayout)
        .options(
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.company),
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.plan),
            selectinload(InsuranceSubAgentPayout.sub_agent),
            selectinload(InsuranceSubAgentPayout.approved_by),
            selectinload(InsuranceSubAgentPayout.reversed_by),
            selectinload(InsuranceSubAgentPayout.payments).selectinload(InsuranceSubAgentPayoutPayment.recorded_by),
        )
        .where(InsuranceSubAgentPayout.id == payout_id)
    )
    payout = (await session.execute(stmt)).scalar_one_or_none()
    if not payout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sub-agent payout record {payout_id} not found.",
        )

    if payout.status == "REVERSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot place a REVERSED payout on hold.",
        )

    payout.status = "ON_HOLD"
    payout.on_hold_reason = payload.on_hold_reason.strip()
    payout.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(payout)
    return _map_sub_agent_payout_to_response(payout)



async def reverse_sub_agent_payout(
    session: AsyncSession,
    payout_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: SubAgentPayoutReversalRequest,
) -> SubAgentPayoutResponse:
    """Reverse a sub-agent payout obligation with mandatory audit reason."""
    stmt = (
        select(InsuranceSubAgentPayout)
        .options(
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.company),
            selectinload(InsuranceSubAgentPayout.policy).selectinload(InsurancePolicy.plan),
            selectinload(InsuranceSubAgentPayout.sub_agent),
            selectinload(InsuranceSubAgentPayout.approved_by),
            selectinload(InsuranceSubAgentPayout.reversed_by),
            selectinload(InsuranceSubAgentPayout.payments).selectinload(InsuranceSubAgentPayoutPayment.recorded_by),
        )
        .where(InsuranceSubAgentPayout.id == payout_id)
    )
    payout = (await session.execute(stmt)).scalar_one_or_none()
    if not payout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sub-agent payout record {payout_id} not found.",
        )

    if payout.status == "REVERSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sub-agent payout is already REVERSED.",
        )

    payout.status = "REVERSED"
    payout.reversed_by_id = user_id
    payout.reversed_at = datetime.now(UTC)
    payout.reversal_reason = payload.reversal_reason.strip()
    if payload.notes:
        existing = f"{payout.notes}\n" if payout.notes else ""
        payout.notes = f"{existing}Reversal note: {payload.notes.strip()}".strip()

    payout.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(payout)
    return _map_sub_agent_payout_to_response(payout)



async def get_comprehensive_commission_dashboard(
    session: AsyncSession,
) -> ComprehensiveCommissionDashboardResponse:
    """Calculate the 3 distinct financial sections: Insurer Receivable, Sub-Agent Payables, and Firm Position."""
    active_comm_filter = InsurancePolicyCommission.status != "REVERSED"
    active_payout_filter = InsuranceSubAgentPayout.status != "REVERSED"

    # Section A: Insurer Commission Receivable
    tot_exp_gross = (
        await session.execute(
            select(func.coalesce(func.sum(InsurancePolicyCommission.gross_commission_amount), Decimal("0.00"))).where(active_comm_filter)
        )
    ).scalar_one()

    tot_exp_tds = (
        await session.execute(
            select(func.coalesce(func.sum(InsurancePolicyCommission.tds_amount), Decimal("0.00"))).where(active_comm_filter)
        )
    ).scalar_one()

    exp_net_rcv = (
        await session.execute(
            select(func.coalesce(func.sum(InsurancePolicyCommission.net_commission_payable), Decimal("0.00"))).where(active_comm_filter)
        )
    ).scalar_one()

    act_bank_rcvd = (
        await session.execute(
            select(func.coalesce(func.sum(InsurancePolicyCommission.actual_net_received), Decimal("0.00"))).where(active_comm_filter)
        )
    ).scalar_one()

    out_rcv = max(Decimal("0.00"), exp_net_rcv - act_bank_rcvd)

    pend_ins_comm = (
        await session.execute(
            select(func.coalesce(func.sum(InsurancePolicyCommission.gross_commission_amount), Decimal("0.00"))).where(
                InsurancePolicyCommission.status == "PENDING"
            )
        )
    ).scalar_one()

    partially_rcvd_cnt = (
        await session.execute(
            select(func.count(InsurancePolicyCommission.id)).where(
                InsurancePolicyCommission.status == "PARTIALLY_RECEIVED"
            )
        )
    ).scalar_one()

    recon_disc = (
        await session.execute(
            select(func.coalesce(func.sum(InsurancePolicyCommission.reconciliation_difference), Decimal("0.00"))).where(
                InsurancePolicyCommission.status.in_(("SHORT_RECEIVED", "EXCESS_RECEIVED"))
            )
        )
    ).scalar_one()

    sec_a = InsurerReceivableDashboardResponse(
        total_expected_gross_commission=tot_exp_gross,
        total_expected_tds=tot_exp_tds,
        expected_net_receivable=exp_net_rcv,
        actual_bank_received=act_bank_rcvd,
        outstanding_receivable=out_rcv,
        pending_insurer_commission=pend_ins_comm,
        partially_received_count=partially_rcvd_cnt,
        reconciliation_discrepancies=recon_disc,
    )

    # Section B: Sub-Agent Payables
    tot_sa_comm = (
        await session.execute(
            select(func.coalesce(func.sum(InsuranceSubAgentPayout.payable_amount), Decimal("0.00"))).where(active_payout_filter)
        )
    ).scalar_one()

    sa_pend_appr = (
        await session.execute(
            select(func.coalesce(func.sum(InsuranceSubAgentPayout.payable_amount), Decimal("0.00"))).where(
                InsuranceSubAgentPayout.status == "PENDING"
            )
        )
    ).scalar_one()

    sa_appr = (
        await session.execute(
            select(func.coalesce(func.sum(InsuranceSubAgentPayout.payable_amount), Decimal("0.00"))).where(
                InsuranceSubAgentPayout.status == "APPROVED"
            )
        )
    ).scalar_one()

    tot_paid_agents = (
        await session.execute(
            select(func.coalesce(func.sum(InsuranceSubAgentPayout.amount_paid), Decimal("0.00"))).where(active_payout_filter)
        )
    ).scalar_one()

    out_sa_pay = (
        await session.execute(
            select(func.coalesce(func.sum(InsuranceSubAgentPayout.remaining_payable), Decimal("0.00"))).where(
                InsuranceSubAgentPayout.status.in_(("PENDING", "APPROVED", "PARTIALLY_PAID", "ON_HOLD"))
            )
        )
    ).scalar_one()

    sa_rev = (
        await session.execute(
            select(func.coalesce(func.sum(InsuranceSubAgentPayout.payable_amount), Decimal("0.00"))).where(
                InsuranceSubAgentPayout.status == "REVERSED"
            )
        )
    ).scalar_one()

    sec_b = SubAgentPayablesDashboardResponse(
        total_sub_agent_commission=tot_sa_comm,
        pending_approval=sa_pend_appr,
        approved_payables=sa_appr,
        total_paid_to_agents=tot_paid_agents,
        outstanding_agent_payables=out_sa_pay,
        reversed_payouts=sa_rev,
    )

    # Section C: Firm Financial Position
    act_tds_ded = (
        await session.execute(
            select(func.coalesce(func.sum(InsurancePolicyCommission.actual_tds_deducted), Decimal("0.00"))).where(active_comm_filter)
        )
    ).scalar_one()
    if act_tds_ded == Decimal("0.00"):
        act_tds_ded = tot_exp_tds

    firm_net_exp = exp_net_rcv - tot_sa_comm
    firm_net_realized = act_bank_rcvd - tot_paid_agents

    sec_c = FirmFinancialPositionResponse(
        gross_insurer_commission=tot_exp_gross,
        insurer_tds_deducted=act_tds_ded,
        actual_bank_credit=act_bank_rcvd,
        sub_agent_payable=tot_sa_comm,
        sub_agent_amount_paid=tot_paid_agents,
        remaining_sub_agent_liability=out_sa_pay,
        firm_retained_net_expected=firm_net_exp,
        firm_retained_net_realized=firm_net_realized,
    )

    return ComprehensiveCommissionDashboardResponse(
        insurer_receivables=sec_a,
        sub_agent_payables=sec_b,
        firm_position=sec_c,
    )


# ---------------------------------------------------------------------------
# The 8 Financial Reports and CSV / Excel Generators
# ---------------------------------------------------------------------------


async def export_report_1_insurer_receivables(
    session: AsyncSession,
    company_id: uuid.UUID | None = None,
    policy_category: str | None = None,
    commission_type: str | None = None,
    status_filter: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    search: str | None = None,
    output_format: str = "csv",
) -> str | bytes:
    """Report 1: Insurer Commission Receivable Report."""
    res = await list_commissions(
        session=session,
        company_id=company_id,
        policy_category=policy_category,
        commission_type=commission_type,
        status_filter=status_filter,
        from_date=from_date,
        to_date=to_date,
        search=search,
        page=1,
        page_size=10000,
    )

    headers = [
        "Policy Number",
        "Policyholder",
        "Insurance Company",
        "Policy Plan",
        "Commission Type",
        "Net Premium (INR)",
        "Rate (%)",
        "Expected Gross Comm (INR)",
        "Actual Gross Comm (INR)",
        "TDS Rate (%)",
        "TDS Deducted (INR)",
        "Expected Net Receivable (INR)",
        "Actual Bank Received (INR)",
        "Balance Receivable (INR)",
        "Receipt Date",
        "Status",
    ]

    rows = []
    for item in res.items:
        rows.append([
            item.policy_number or "N/A",
            item.customer_name or "N/A",
            item.company_name or "N/A",
            item.plan_name or "N/A",
            item.commission_type,
            float(item.net_premium_applied or 0),
            float(item.gross_commission_rate or 0),
            float(item.gross_commission_amount),
            float(item.actual_gross_received),
            float(item.tds_rate),
            float(item.tds_amount),
            float(item.net_commission_payable or 0),
            float(item.actual_net_received),
            float(item.balance_receivable),
            item.payment_date.isoformat() if item.payment_date else (item.expected_receipt_date.isoformat() if item.expected_receipt_date else ""),
            item.status,
        ])

    if output_format.lower() == "excel":
        return _generate_excel_bytes("Insurer Receivables", headers, rows)
    return _generate_csv_string(headers, rows)


async def export_report_2_insurer_bank_receipts(
    session: AsyncSession,
    company_id: uuid.UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    search: str | None = None,
    output_format: str = "csv",
) -> str | bytes:
    """Report 2: Insurer Bank Receipt Report."""
    stmt = (
        select(InsuranceCommissionReceipt)
        .join(InsurancePolicyCommission, InsuranceCommissionReceipt.commission_id == InsurancePolicyCommission.id)
        .join(InsurancePolicy, InsurancePolicyCommission.policy_id == InsurancePolicy.id)
        .outerjoin(Customer, InsurancePolicy.customer_id == Customer.id)
        .outerjoin(InsuranceCompany, InsurancePolicy.company_id == InsuranceCompany.id)
        .options(
            selectinload(InsuranceCommissionReceipt.recorded_by),
            selectinload(InsuranceCommissionReceipt.commission).selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsuranceCommissionReceipt.commission).selectinload(InsurancePolicyCommission.policy).selectinload(InsurancePolicy.company),
        )
        .order_by(InsuranceCommissionReceipt.receipt_date.desc())
    )

    if from_date:
        stmt = stmt.where(InsuranceCommissionReceipt.receipt_date >= from_date)
    if to_date:
        stmt = stmt.where(InsuranceCommissionReceipt.receipt_date <= to_date)
    if company_id:
        stmt = stmt.where(InsurancePolicy.company_id == company_id)
    if search:
        s_term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                InsurancePolicy.policy_number.ilike(s_term),
                InsuranceCommissionReceipt.transaction_reference.ilike(s_term),
                Customer.first_name.ilike(s_term),
                Customer.last_name.ilike(s_term),
            )
        )

    receipts = (await session.execute(stmt)).scalars().all()

    headers = [
        "Receipt Date",
        "Policy Number",
        "Policyholder",
        "Insurance Company",
        "Bank Account",
        "Bank Name",
        "Payment Mode",
        "Gross Amount (INR)",
        "TDS Deducted (INR)",
        "Actual Net Received (INR)",
        "UTR / Reference",
        "Receipt Type",
        "Notes",
        "Recorded By",
    ]

    rows = []
    for r in receipts:
        p = r.commission.policy if r.commission else None
        cust = p.customer if p else None
        comp = p.company if p else None
        cust_name = f"{cust.first_name} {cust.last_name or ''}".strip() if cust else "N/A"

        rows.append([
            r.receipt_date.isoformat(),
            p.policy_number if p else "N/A",
            cust_name,
            comp.name if comp else "N/A",
            r.bank_account or "N/A",
            r.bank_name or "N/A",
            r.payment_mode,
            float(r.gross_amount),
            float(r.tds_deducted),
            float(r.net_amount),
            r.transaction_reference or "N/A",
            r.receipt_type,
            r.notes or "",
            r.recorded_by.full_name if r.recorded_by else "System",
        ])

    if output_format.lower() == "excel":
        return _generate_excel_bytes("Insurer Bank Receipts", headers, rows)
    return _generate_csv_string(headers, rows)


async def export_report_3_insurer_tds(
    session: AsyncSession,
    company_id: uuid.UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    search: str | None = None,
    output_format: str = "csv",
) -> str | bytes:
    """Report 3: Insurer Section 194D TDS Report."""
    res = await list_commissions(
        session=session,
        company_id=company_id,
        from_date=from_date,
        to_date=to_date,
        search=search,
        page=1,
        page_size=10000,
    )

    headers = [
        "Policy Number",
        "Policyholder",
        "Insurance Company",
        "Plan",
        "Gross Commission (INR)",
        "TDS Rate (%)",
        "Expected TDS (INR)",
        "Actual TDS Deducted (INR)",
        "Reconciliation Diff (INR)",
        "Reconciliation Status",
        "Status",
    ]

    rows = []
    for item in res.items:
        rows.append([
            item.policy_number or "N/A",
            item.customer_name or "N/A",
            item.company_name or "N/A",
            item.plan_name or "N/A",
            float(item.gross_commission_amount),
            float(item.tds_rate),
            float(item.tds_amount),
            float(item.actual_tds_deducted),
            float((item.tds_amount or Decimal("0.00")) - (item.actual_tds_deducted or Decimal("0.00"))),
            item.reconciliation_status,
            item.status,
        ])

    if output_format.lower() == "excel":
        return _generate_excel_bytes("Insurer TDS Report", headers, rows)
    return _generate_csv_string(headers, rows)


async def export_report_4_sub_agent_payables(
    session: AsyncSession,
    sub_agent_id: uuid.UUID | None = None,
    company_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    search: str | None = None,
    output_format: str = "csv",
) -> str | bytes:
    """Report 4: Sub-Agent Payable Report."""
    res = await list_sub_agent_payouts(
        session=session,
        sub_agent_id=sub_agent_id,
        company_id=company_id,
        status_filter=status_filter,
        from_date=from_date,
        to_date=to_date,
        search=search,
        page=1,
        page_size=10000,
    )

    headers = [
        "Policy Number",
        "Policyholder",
        "Insurance Company",
        "Sub-Agent Name",
        "Sub-Agent Code",
        "Commission Type",
        "Insurer Gross Commission (INR)",
        "Agreed Split (%)",
        "Sub-Agent Payable Amount (INR)",
        "TDS Rate (%)",
        "TDS Deducted (INR)",
        "Net Payable (INR)",
        "Amount Paid (INR)",
        "Remaining Payable (INR)",
        "Payout Date",
        "Payout Status",
    ]

    rows = []
    for item in res.items:
        rows.append([
            item.policy_number or "N/A",
            item.customer_name or "N/A",
            item.company_name or "N/A",
            item.sub_agent_name or "N/A",
            item.sub_agent_code or "N/A",
            item.commission_type,
            float(item.insurer_gross_commission),
            float(item.agreed_percentage or 0),
            float(item.payable_amount),
            float(item.tds_rate),
            float(item.tds_amount),
            float(item.net_payable_amount),
            float(item.amount_paid),
            float(item.remaining_payable),
            item.payout_date.isoformat() if item.payout_date else "",
            item.status,
        ])

    if output_format.lower() == "excel":
        return _generate_excel_bytes("Sub-Agent Payables", headers, rows)
    return _generate_csv_string(headers, rows)


async def export_report_5_sub_agent_payment_history(
    session: AsyncSession,
    sub_agent_id: uuid.UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    search: str | None = None,
    output_format: str = "csv",
) -> str | bytes:
    """Report 5: Sub-Agent Payment History Report."""
    stmt = (
        select(InsuranceSubAgentPayoutPayment)
        .join(InsuranceSubAgentPayout, InsuranceSubAgentPayoutPayment.payout_id == InsuranceSubAgentPayout.id)
        .join(InsurancePolicy, InsuranceSubAgentPayout.policy_id == InsurancePolicy.id)
        .join(InsuranceSubAgent, InsuranceSubAgentPayout.sub_agent_id == InsuranceSubAgent.id)
        .options(
            selectinload(InsuranceSubAgentPayoutPayment.recorded_by),
            selectinload(InsuranceSubAgentPayoutPayment.payout).selectinload(InsuranceSubAgentPayout.policy),
            selectinload(InsuranceSubAgentPayoutPayment.payout).selectinload(InsuranceSubAgentPayout.sub_agent),
        )
        .order_by(InsuranceSubAgentPayoutPayment.payment_date.desc())
    )

    if from_date:
        stmt = stmt.where(InsuranceSubAgentPayoutPayment.payment_date >= from_date)
    if to_date:
        stmt = stmt.where(InsuranceSubAgentPayoutPayment.payment_date <= to_date)
    if sub_agent_id:
        stmt = stmt.where(InsuranceSubAgentPayout.sub_agent_id == sub_agent_id)
    if search:
        s_term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                InsurancePolicy.policy_number.ilike(s_term),
                InsuranceSubAgent.full_name.ilike(s_term),
                InsuranceSubAgent.agent_code.ilike(s_term),
                InsuranceSubAgentPayoutPayment.transaction_reference.ilike(s_term),
            )
        )

    payments = (await session.execute(stmt)).scalars().all()

    headers = [
        "Payment Date",
        "Sub-Agent Name",
        "Sub-Agent Code",
        "Policy Number",
        "Gross Amount (INR)",
        "TDS Deducted (INR)",
        "Net Amount Disbursed (INR)",
        "Payment Method",
        "Bank Details",
        "UTR / Reference",
        "Notes",
        "Recorded By",
    ]

    rows = []
    for pm in payments:
        payout = pm.payout
        sa = payout.sub_agent if payout else None
        pol = payout.policy if payout else None

        rows.append([
            pm.payment_date.isoformat(),
            sa.full_name if sa else "N/A",
            sa.agent_code if sa else "N/A",
            pol.policy_number if pol else "N/A",
            float(pm.amount),
            float(pm.tds_deducted),
            float(pm.net_amount),
            pm.payment_method,
            pm.bank_account_details or "N/A",
            pm.transaction_reference or "N/A",
            pm.notes or "",
            pm.recorded_by.full_name if pm.recorded_by else "System",
        ])

    if output_format.lower() == "excel":
        return _generate_excel_bytes("Sub-Agent Payment History", headers, rows)
    return _generate_csv_string(headers, rows)


async def export_report_6_policy_wise(
    session: AsyncSession,
    company_id: uuid.UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    search: str | None = None,
    output_format: str = "csv",
) -> str | bytes:
    """Report 6: Policy-wise Commission & Retention Report."""
    res = await list_commissions(
        session=session,
        company_id=company_id,
        from_date=from_date,
        to_date=to_date,
        search=search,
        page=1,
        page_size=10000,
    )

    headers = [
        "Policy Number",
        "Policyholder",
        "Insurance Company",
        "Policy Plan",
        "Net Premium (INR)",
        "Insurer Gross Comm (INR)",
        "Insurer Bank Received (INR)",
        "Sub-Agent Share (INR)",
        "Firm Retained Share (INR)",
        "Firm Net Bank Retained (INR)",
        "Status",
    ]

    rows = []
    for item in res.items:
        rows.append([
            item.policy_number or "N/A",
            item.customer_name or "N/A",
            item.company_name or "N/A",
            item.plan_name or "N/A",
            float(item.net_premium_applied or 0),
            float(item.gross_commission_amount),
            float(item.actual_net_received),
            float(item.sub_agent_amount),
            float(item.firm_net_amount),
            float(item.actual_net_received - (item.sub_agent_net_payout or Decimal("0.00"))),
            item.status,
        ])

    if output_format.lower() == "excel":
        return _generate_excel_bytes("Policy-wise Commission", headers, rows)
    return _generate_csv_string(headers, rows)


async def export_report_7_agent_wise(
    session: AsyncSession,
    company_id: uuid.UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    output_format: str = "csv",
) -> str | bytes:
    """Report 7: Agent-wise Commission Performance Report."""
    rep_items = await get_agent_performance_reports(
        session=session,
        company_id=company_id,
        from_date=from_date,
        to_date=to_date,
    )

    headers = [
        "Agent Name",
        "Agent Code",
        "Total Policies",
        "Active Policies",
        "First Year Comm (INR)",
        "Renewal Comm (INR)",
        "Gross Comm Generated (INR)",
        "Average Rate (%)",
        "Agent Share (INR)",
        "Agent TDS (INR)",
        "Net Payable (INR)",
        "Actual Paid (INR)",
        "Pending Payout (INR)",
    ]

    rows = []
    for r in rep_items:
        rows.append([
            r.agent_name,
            r.agent_code,
            r.total_policies,
            r.active_policies,
            float(r.first_year_commission),
            float(r.renewal_commission),
            float(r.gross_commission),
            float(r.average_commission_rate),
            float(r.sub_agent_share),
            float(r.sub_agent_tds),
            float(r.net_payable),
            float(r.actual_paid),
            float(r.pending_payout),
        ])

    if output_format.lower() == "excel":
        return _generate_excel_bytes("Agent-wise Performance", headers, rows)
    return _generate_csv_string(headers, rows)


async def export_report_8_financial_reconciliation(
    session: AsyncSession,
    output_format: str = "csv",
) -> str | bytes:
    """Report 8: Comprehensive Financial Reconciliation Report."""
    dash = await get_comprehensive_commission_dashboard(session)

    headers = [
        "Financial Section",
        "Metric Description",
        "Expected / Booked (INR)",
        "Actual Realized (INR)",
        "Outstanding / Variance (INR)",
        "Status / Remarks",
    ]

    rows = [
        [
            "Insurer Receivables",
            "Total Expected Gross Commission",
            float(dash.insurer_receivables.total_expected_gross_commission),
            float(dash.insurer_receivables.actual_bank_received),
            float(dash.insurer_receivables.outstanding_receivable),
            "Receivable from Insurance Companies",
        ],
        [
            "Insurer Receivables",
            "Insurer TDS Withheld (Section 194D)",
            float(dash.insurer_receivables.total_expected_tds),
            float(dash.firm_position.insurer_tds_deducted),
            float(dash.insurer_receivables.total_expected_tds - dash.firm_position.insurer_tds_deducted),
            "Tax Deducted at Source by Carriers",
        ],
        [
            "Insurer Receivables",
            "Expected Net Bank Remittance",
            float(dash.insurer_receivables.expected_net_receivable),
            float(dash.insurer_receivables.actual_bank_received),
            float(dash.insurer_receivables.outstanding_receivable),
            "Net Direct Bank Deposits",
        ],
        [
            "Sub-Agent Payables",
            "Total Sub-Agent Commission Obligation",
            float(dash.sub_agent_payables.total_sub_agent_commission),
            float(dash.sub_agent_payables.total_paid_to_agents),
            float(dash.sub_agent_payables.outstanding_agent_payables),
            "Payable by FinNexus to Sub-Agents",
        ],
        [
            "Sub-Agent Payables",
            "Pending Approval Payouts",
            float(dash.sub_agent_payables.pending_approval),
            0.0,
            float(dash.sub_agent_payables.pending_approval),
            "Awaiting Management Approval",
        ],
        [
            "Sub-Agent Payables",
            "Approved Outstanding Payables",
            float(dash.sub_agent_payables.approved_payables),
            0.0,
            float(dash.sub_agent_payables.approved_payables),
            "Approved, Awaiting Outgoing Transfer",
        ],
        [
            "Firm Position",
            "Gross Insurer Commission",
            float(dash.firm_position.gross_insurer_commission),
            float(dash.firm_position.actual_bank_credit),
            float(dash.firm_position.gross_insurer_commission - dash.firm_position.actual_bank_credit),
            "Firm Gross Contract Entitlement",
        ],
        [
            "Firm Position",
            "Sub-Agent Liabilities Disbursed",
            float(dash.firm_position.sub_agent_payable),
            float(dash.firm_position.sub_agent_amount_paid),
            float(dash.firm_position.remaining_sub_agent_liability),
            "Sub-Agent Payments Disbursed",
        ],
        [
            "Firm Position",
            "Net Firm Retained Margin",
            float(dash.firm_position.firm_retained_net_expected),
            float(dash.firm_position.firm_retained_net_realized),
            float(dash.firm_position.firm_retained_net_expected - dash.firm_position.firm_retained_net_realized),
            "Net Retained by FinNexus after Sub-Agent Splits",
        ],
    ]

    if output_format.lower() == "excel":
        return _generate_excel_bytes("Financial Reconciliation", headers, rows)
    return _generate_csv_string(headers, rows)
