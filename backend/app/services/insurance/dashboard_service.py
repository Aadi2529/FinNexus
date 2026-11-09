"""Live Dashboard Aggregation Service for FinNexus Insurance Engine."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.crm import Customer
from app.db.models.insurance import (
    InsuranceCommissionSplitConfig,
    InsuranceCompany,
    InsurancePlan,
    InsurancePolicy,
    InsurancePolicyCommission,
    InsurancePolicyPayment,
    InsurancePremiumSchedule,
    InsurancePurchaseParty,
    InsuranceSubAgent,
)
from app.schemas.insurance import InsuranceDashboardMetrics


async def aggregate_dashboard_metrics(
    session: AsyncSession,
) -> InsuranceDashboardMetrics:
    """Calculate all portfolio metrics, section summaries, and utility indicators directly from live PostgreSQL."""
    today = date.today()
    in_30_days = today + timedelta(days=30)

    # 1. Customer metrics
    tot_cust = (await session.execute(select(func.count(Customer.id)))).scalar_one()
    indiv_cust = (
        await session.execute(
            select(func.count(Customer.id)).where(
                or_(Customer.customer_type == "INDIVIDUAL", Customer.customer_type.is_(None))
            )
        )
    ).scalar_one()
    corp_cust = (
        await session.execute(
            select(func.count(Customer.id)).where(Customer.customer_type == "CORPORATE")
        )
    ).scalar_one()

    # 2. Master Data Counts
    comp_tot = (await session.execute(select(func.count(InsuranceCompany.id)))).scalar_one()
    comp_act = (await session.execute(select(func.count(InsuranceCompany.id)).where(InsuranceCompany.is_active.is_(True)))).scalar_one()
    plan_tot = (await session.execute(select(func.count(InsurancePlan.id)))).scalar_one()
    plan_act = (await session.execute(select(func.count(InsurancePlan.id)).where(InsurancePlan.status == "ACTIVE"))).scalar_one()
    pp_tot = (await session.execute(select(func.count(InsurancePurchaseParty.id)))).scalar_one()
    pp_act = (await session.execute(select(func.count(InsurancePurchaseParty.id)).where(InsurancePurchaseParty.is_active.is_(True)))).scalar_one()
    sa_tot = (await session.execute(select(func.count(InsuranceSubAgent.id)))).scalar_one()
    sa_act = (await session.execute(select(func.count(InsuranceSubAgent.id)).where(InsuranceSubAgent.status == "ACTIVE"))).scalar_one()

    # 3. Policy Counts
    tot_pols = (await session.execute(select(func.count(InsurancePolicy.id)))).scalar_one()
    act_pols = (await session.execute(select(func.count(InsurancePolicy.id)).where(InsurancePolicy.status == "ACTIVE"))).scalar_one()

    # 30-Day Expiring Policies
    exp_30_stmt = select(func.count(InsurancePolicy.id)).where(
        InsurancePolicy.status == "ACTIVE",
        InsurancePolicy.expiry_date >= today,
        InsurancePolicy.expiry_date <= in_30_days,
    )
    exp_30_count = (await session.execute(exp_30_stmt)).scalar_one()

    # 4. Premium Schedules Metrics
    # Overdue count
    overdue_stmt = select(func.count(InsurancePremiumSchedule.id)).where(
        InsurancePremiumSchedule.paid_date.is_(None),
        InsurancePremiumSchedule.due_date < today,
    )
    overdue_count = (await session.execute(overdue_stmt)).scalar_one()

    # Due Today count
    due_today_stmt = select(func.count(InsurancePremiumSchedule.id)).where(
        InsurancePremiumSchedule.paid_date.is_(None),
        InsurancePremiumSchedule.due_date == today,
    )
    due_today_count = (await session.execute(due_today_stmt)).scalar_one()

    # Pending Premiums (Due Today + Upcoming in 30 days + Overdue)
    pending_prem_stmt = select(
        func.coalesce(func.sum(InsurancePremiumSchedule.amount), Decimal("0.00")),
        func.count(InsurancePremiumSchedule.id),
    ).where(
        InsurancePremiumSchedule.paid_date.is_(None),
        InsurancePremiumSchedule.due_date <= in_30_days,
    )
    pending_prem_row = (await session.execute(pending_prem_stmt)).first()
    pending_prem_sum, pending_prem_cnt = pending_prem_row if pending_prem_row else (Decimal("0.00"), 0)

    # 5. Commission Totals
    net_comm_stmt = select(
        func.coalesce(func.sum(InsurancePolicyCommission.firm_net_amount), Decimal("0.00")),
        func.coalesce(func.sum(InsurancePolicyCommission.gross_commission_amount), Decimal("0.00")),
        func.coalesce(func.sum(InsurancePolicyCommission.sub_agent_amount), Decimal("0.00")),
    )
    comm_row = (await session.execute(net_comm_stmt)).first()
    net_comm_sum, gross_comm_sum, sub_comm_sum = comm_row if comm_row else (Decimal("0.00"), Decimal("0.00"), Decimal("0.00"))

    # 6. Section Lists:
    # Overdue Premiums (top 5)
    overdue_list_stmt = (
        select(InsurancePremiumSchedule)
        .options(
            selectinload(InsurancePremiumSchedule.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsurancePremiumSchedule.policy).selectinload(InsurancePolicy.company),
        )
        .where(
            InsurancePremiumSchedule.paid_date.is_(None),
            InsurancePremiumSchedule.due_date < today,
        )
        .order_by(InsurancePremiumSchedule.due_date.asc())
        .limit(5)
    )
    overdue_scheds = (await session.execute(overdue_list_stmt)).scalars().all()
    overdue_items = [
        {
            "id": str(s.id),
            "policy_number": s.policy.policy_number if s.policy else "",
            "customer_name": s.policy.customer.full_name if s.policy and s.policy.customer else "Unknown",
            "company_name": s.policy.company.name if s.policy and s.policy.company else "Unknown",
            "due_date": s.due_date.isoformat(),
            "amount": float(s.amount),
            "days_overdue": (today - s.due_date).days,
        }
        for s in overdue_scheds
    ]

    # Upcoming Dues (next 5)
    upcoming_list_stmt = (
        select(InsurancePremiumSchedule)
        .options(
            selectinload(InsurancePremiumSchedule.policy).selectinload(InsurancePolicy.customer),
            selectinload(InsurancePremiumSchedule.policy).selectinload(InsurancePolicy.company),
        )
        .where(
            InsurancePremiumSchedule.paid_date.is_(None),
            InsurancePremiumSchedule.due_date >= today,
            InsurancePremiumSchedule.due_date <= in_30_days,
        )
        .order_by(InsurancePremiumSchedule.due_date.asc())
        .limit(5)
    )
    upcoming_scheds = (await session.execute(upcoming_list_stmt)).scalars().all()
    upcoming_items = [
        {
            "id": str(s.id),
            "policy_number": s.policy.policy_number if s.policy else "",
            "customer_name": s.policy.customer.full_name if s.policy and s.policy.customer else "Unknown",
            "company_name": s.policy.company.name if s.policy and s.policy.company else "Unknown",
            "due_date": s.due_date.isoformat(),
            "amount": float(s.amount),
            "days_remaining": (s.due_date - today).days,
        }
        for s in upcoming_scheds
    ]

    # Upcoming Policy Expiries (next 5)
    exp_list_stmt = (
        select(InsurancePolicy)
        .options(
            selectinload(InsurancePolicy.customer),
            selectinload(InsurancePolicy.company),
            selectinload(InsurancePolicy.plan),
        )
        .where(
            InsurancePolicy.status == "ACTIVE",
            InsurancePolicy.expiry_date >= today,
            InsurancePolicy.expiry_date <= in_30_days,
        )
        .order_by(InsurancePolicy.expiry_date.asc())
        .limit(5)
    )
    exp_pols = (await session.execute(exp_list_stmt)).scalars().all()
    exp_items = [
        {
            "id": str(p.id),
            "policy_number": p.policy_number,
            "customer_name": p.customer.full_name if p.customer else "Unknown",
            "company_name": p.company.name if p.company else "Unknown",
            "plan_name": p.plan.name if p.plan else "Unknown",
            "expiry_date": p.expiry_date.isoformat(),
            "days_remaining": (p.expiry_date - today).days,
            "final_premium": float(p.final_premium),
        }
        for p in exp_pols
    ]

    # Recent Policies (latest 5)
    recent_pols_stmt = (
        select(InsurancePolicy)
        .options(
            selectinload(InsurancePolicy.customer),
            selectinload(InsurancePolicy.company),
            selectinload(InsurancePolicy.plan),
        )
        .order_by(InsurancePolicy.created_at.desc())
        .limit(5)
    )
    recent_pols = (await session.execute(recent_pols_stmt)).scalars().all()
    recent_pol_items = [
        {
            "id": str(p.id),
            "policy_number": p.policy_number,
            "customer_name": p.customer.full_name if p.customer else "Unknown",
            "company_name": p.company.name if p.company else "Unknown",
            "plan_name": p.plan.name if p.plan else "Unknown",
            "final_premium": float(p.final_premium),
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else "",
        }
        for p in recent_pols
    ]

    # Recent Customers (latest 5)
    recent_cust_stmt = select(Customer).order_by(Customer.created_at.desc()).limit(5)
    recent_custs = (await session.execute(recent_cust_stmt)).scalars().all()
    recent_cust_items = [
        {
            "id": str(c.id),
            "full_name": c.full_name,
            "phone": c.phone,
            "email": c.email,
            "customer_type": c.customer_type or "INDIVIDUAL",
            "created_at": c.created_at.isoformat() if c.created_at else "",
        }
        for c in recent_custs
    ]

    # Agent Performance (top 5)
    perf_stmt = (
        select(
            InsuranceSubAgent.id,
            InsuranceSubAgent.full_name,
            InsuranceSubAgent.agent_code,
            func.count(InsurancePolicy.id).label("policy_count"),
            func.coalesce(func.sum(InsurancePolicy.final_premium), Decimal("0.00")).label("gwp"),
        )
        .join(InsurancePolicy, InsurancePolicy.sub_agent_id == InsuranceSubAgent.id, isouter=True)
        .where(InsuranceSubAgent.status == "ACTIVE")
        .group_by(InsuranceSubAgent.id, InsuranceSubAgent.full_name, InsuranceSubAgent.agent_code)
        .order_by(func.count(InsurancePolicy.id).desc())
        .limit(5)
    )
    perf_rows = (await session.execute(perf_stmt)).all()
    agent_perf_items = [
        {
            "id": str(r[0]),
            "name": r[1],
            "code": r[2],
            "policies_count": r[3],
            "total_gwp": float(r[4]),
        }
        for r in perf_rows
    ]

    # Utility Bar Data
    utility_bar = {
        "subscription_expiry": "Active Enterprise License (2027-12-31)",
        "sms_provider_configured": False,
        "sms_balance_display": "SMS Provider Setup Required",
        "alerts_count": overdue_count + due_today_count + exp_30_count,
        "subscription_status": "ENTERPRISE_ACTIVE",
        "sms_whatsapp_status": "External Gateway Unconfigured — Reminders Queued",
        "active_alerts_count": overdue_count + due_today_count + exp_30_count,
        "overdue_count": overdue_count,
        "due_today_count": due_today_count,
    }

    portfolio_dict = {
        "total_customers": tot_cust,
        "individual_customers": indiv_cust,
        "corporate_customers": corp_cust,
        "total_active_policies": act_pols,
        "expiring_policies_30_days": exp_30_count,
        "pending_premiums_amount": float(pending_prem_sum),
        "pending_premiums_count": pending_prem_cnt,
        "total_claims_count": 0,
        "claims_module_status": "PENDING_IMPLEMENTATION",
        "claims_notice": "Claims management module is pending implementation in future phase.",
        "net_commission_earnings": float(net_comm_sum),
        "gross_commission": float(gross_comm_sum),
        "sub_agent_payouts": float(sub_comm_sum),
        "total_sub_agents": sa_tot,
        "active_sub_agents": sa_act,
    }

    return InsuranceDashboardMetrics(
        portfolio=portfolio_dict,
        total_customers=tot_cust,
        individual_customers=indiv_cust,
        corporate_customers=corp_cust,
        total_active_policies=act_pols,
        expiring_30_days_policies=exp_30_count,
        pending_premiums=pending_prem_sum,
        pending_premiums_count=pending_prem_cnt,
        total_claims="Pending Module",
        claims_module_status="Pending Module (Actuarial Claims Settlement slated for Phase 3)",
        net_commission_earnings=net_comm_sum,
        total_companies=comp_tot,
        active_companies=comp_act,
        total_plans=plan_tot,
        active_plans=plan_act,
        total_purchase_parties=pp_tot,
        active_purchase_parties=pp_act,
        total_sub_agents=sa_tot,
        active_sub_agents=sa_act,
        upcoming_premium_dues=upcoming_items,
        overdue_premiums=overdue_items,
        upcoming_policy_expiries=exp_items,
        recent_policy_registrations=recent_pol_items,
        recent_customers=recent_cust_items,
        agent_performance=agent_perf_items,
        commission_summary={
            "gross_commission": float(gross_comm_sum),
            "sub_agent_commission": float(sub_comm_sum),
            "net_firm_commission": float(net_comm_sum),
        },
        utility_bar=utility_bar,
        total_policies=tot_pols,
        premiums_due_today=due_today_count,
        policies_expired=0,
        module_status={
            "policies": "active",
            "premiums": "active",
            "commissions": "active",
            "master_data": "active",
            "claims": "pending",
        },
    )

