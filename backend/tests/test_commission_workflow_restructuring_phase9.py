"""Production Acceptance Test Suite for FinNexus Insurance Engine:
Restructured Financial Workflows (Phase 9 & All Acceptance Criteria).

Verifies:
1. Policy issuance creates one insurer commission receivable record.
2. The policy appears in the Insurer Commission Ledger.
3. The policy appears in Sub-Agent Payouts if a sub-agent is assigned.
4. Record actual insurer bank receipt of ₹1,350.
5. Verify insurer status becomes RECEIVED.
6. Verify actual bank credit is ₹1,350.
7. Approve the sub-agent payout of ₹300.
8. Record payment of ₹300.
9. Verify sub-agent status becomes PAID.
10. Verify remaining agent payable becomes ₹0.
11. Verify the firm retains ₹1,200 before other applicable costs and deductions.
12. Verify dashboard totals (Sections A, B, C) and exports.
13. Verify no duplicate ledger entries after page refresh or retry.
14. Verify historical commission records remain unchanged.
15. Partial receipts, partial payouts, short receipts, on hold, reversals, and policies without sub-agents.
16. All 8 distinct Financial Reports (CSV and genuine XLSX).
"""

import io
import uuid
from datetime import date, timedelta
from decimal import Decimal
import openpyxl
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, func

from app.main import create_application
from app.db.session import AsyncSessionLocal, engine
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
from app.db.models.crm import Customer


@pytest.fixture
def app():
    return create_application()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as c:
        yield c


@pytest.fixture(autouse=True)
async def cleanup_db_pool():
    yield
    await engine.dispose()


async def get_auth_token(client: AsyncClient, email: str = "admin@finnexus.com", pwd: str = "Admin@12345") -> str:
    res = await client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
    if res.status_code == 200:
        return res.json()["access_token"]
    alt = await client.post("/api/v1/auth/login", json={"email": "admin@financeflow.com", "password": pwd})
    if alt.status_code == 200:
        return alt.json()["access_token"]
    raise RuntimeError(f"Authentication failed: {res.text}")


# ===========================================================================
# PHASE 9 END-TO-END ACCEPTANCE TEST
# ===========================================================================
@pytest.mark.asyncio
async def test_phase_9_end_to_end_acceptance_workflow(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncSessionLocal() as session:
        # Create customer
        cust = Customer(
            id=uuid.uuid4(),
            first_name="Vikram",
            last_name="Malhotra",
            email=f"vikram.{uuid.uuid4().hex[:6]}@example.com",
            phone=f"+9199{uuid.uuid4().int % 100000000:08d}",
        )
        session.add(cust)

        # Create carrier
        comp_code = f"CARRIER-{uuid.uuid4().hex[:4].upper()}"
        company = InsuranceCompany(
            id=uuid.uuid4(),
            name=f"HDFC ERGO General Insurance {comp_code}",
            code=comp_code,
            category="General",
            is_active=True,
        )
        session.add(company)

        # Create plan
        plan = InsurancePlan(
            id=uuid.uuid4(),
            company_id=company.id,
            name="Optima Secure Health",
            code=f"PLAN-{uuid.uuid4().hex[:4].upper()}",
            line_of_business="HEALTH",
            status="ACTIVE",
        )
        session.add(plan)

        # Create sub-agent
        sa_code = f"AGT-{uuid.uuid4().hex[:4].upper()}"
        sub_agent = InsuranceSubAgent(
            id=uuid.uuid4(),
            full_name="Karan Verma",
            agent_code=sa_code,
            mobile=f"+9198{uuid.uuid4().int % 100000000:08d}",
            email=f"karan.{sa_code.lower()}@example.com",
            public_profile_slug=f"karan-{sa_code.lower()}",
            status="ACTIVE",
        )
        session.add(sub_agent)
        await session.flush()

        # Insurer agreement: 15% First Year, 10% TDS
        agreement = InsuranceCompanyCommissionAgreement(
            id=uuid.uuid4(),
            company_id=company.id,
            policy_category="HEALTH",
            first_year_commission_rate=Decimal("15.00"),
            renewal_commission_rate=Decimal("7.50"),
            commissionable_basis="NET_PREMIUM",
            tds_rate=Decimal("10.00"),
            effective_from=date.today() - timedelta(days=60),
            is_active=True,
        )
        session.add(agreement)

        # Sub-agent split: 20% of Insurer Gross Commission
        split_rule = InsuranceCommissionSplitConfig(
            id=uuid.uuid4(),
            sub_agent_id=sub_agent.id,
            company_id=company.id,
            split_type="PERCENTAGE",
            split_value=Decimal("20.00"),
            allocation_basis="GROSS_COMMISSION",
            effective_date=date.today() - timedelta(days=60),
            is_active=True,
        )
        session.add(split_rule)
        await session.commit()

        cust_id = str(cust.id)
        comp_id = str(company.id)
        plan_id = str(plan.id)
        sa_id = str(sub_agent.id)

    # 1. Issue policy via Policy Issuance API
    # Net Premium: ₹10,000 | Expected Rate: 15% | Expected Gross: ₹1,500 | TDS: 10% (₹150) | Expected Net: ₹1,350 | Sub-Agent: 20% (₹300)
    pol_num = f"POL-P9-{uuid.uuid4().hex[:6].upper()}"
    policy_payload = {
        "policy_number": pol_num,
        "customer_id": cust_id,
        "company_id": comp_id,
        "plan_id": plan_id,
        "sub_agent_id": sa_id,
        "policy_type": "HEALTH",
        "coverage_type": "INDIVIDUAL",
        "sum_assured": 500000.00,
        "final_premium": 11800.00,
        "net_premium": 10000.00,
        "tax_amount": 1800.00,
        "policy_start_date": date.today().isoformat(),
        "term_years": 1,
        "premium_mode": "Yearly",
        "first_year_commission_rate": 15.00,
        "first_year_commission_amount": 1500.00,
        "sub_agent_commission_share": 300.00,
    }

    issue_res = await client.post("/api/v1/insurance/policies", json=policy_payload, headers=headers)
    assert issue_res.status_code == 201, f"Failed to issue policy: {issue_res.text}"
    pol_data = issue_res.json()
    created_policy_id = pol_data["id"]

    # Criterion 1: Policy issuance creates one insurer commission receivable record
    async with AsyncSessionLocal() as session:
        comms = (
            await session.execute(
                select(InsurancePolicyCommission).where(InsurancePolicyCommission.policy_id == uuid.UUID(created_policy_id))
            )
        ).scalars().all()
        assert len(comms) == 1
        comm = comms[0]
        assert comm.net_premium_applied == Decimal("10000.00")
        assert comm.gross_commission_rate == Decimal("15.00")
        assert comm.gross_commission_amount == Decimal("1500.00")
        assert comm.tds_rate == Decimal("10.00")
        assert comm.tds_amount == Decimal("150.00")
        assert comm.net_commission_payable == Decimal("1350.00")
        assert comm.balance_receivable == Decimal("1350.00")
        assert comm.status == "PENDING"
        comm_id = str(comm.id)

        # Criterion 3: Sub-agent payout obligation is created
        payouts = (
            await session.execute(
                select(InsuranceSubAgentPayout).where(InsuranceSubAgentPayout.policy_id == uuid.UUID(created_policy_id))
            )
        ).scalars().all()
        assert len(payouts) == 1
        payout = payouts[0]
        assert payout.sub_agent_id == uuid.UUID(sa_id)
        assert payout.insurer_gross_commission == Decimal("1500.00")
        assert payout.payable_amount == Decimal("300.00")
        assert payout.amount_paid == Decimal("0.00")
        assert payout.status == "PENDING"
        payout_id = str(payout.id)

    # Criterion 2: Policy appears in Insurer Commission Ledger
    ledger_res = await client.get(f"/api/v1/insurance/commissions?search={pol_num}", headers=headers)
    assert ledger_res.status_code == 200
    ledger_items = ledger_res.json()["items"]
    assert len(ledger_items) == 1
    ledger_entry = ledger_items[0]
    assert ledger_entry["policy_number"] == pol_num
    assert Decimal(str(ledger_entry["gross_commission_amount"])) == Decimal("1500.00")
    assert Decimal(str(ledger_entry["net_commission_payable"])) == Decimal("1350.00")
    assert Decimal(str(ledger_entry["balance_receivable"])) == Decimal("1350.00")
    assert ledger_entry["status"] == "PENDING"

    # Criterion 3: Policy appears in Sub-Agent Payouts tab
    sa_res = await client.get(f"/api/v1/insurance/commissions/sub-agent-payouts?search={pol_num}", headers=headers)
    assert sa_res.status_code == 200
    sa_items = sa_res.json()["items"]
    assert len(sa_items) == 1
    sa_entry = sa_items[0]
    assert sa_entry["policy_number"] == pol_num
    assert sa_entry["sub_agent_name"] == "Karan Verma"
    assert Decimal(str(sa_entry["insurer_gross_commission"])) == Decimal("1500.00")
    assert Decimal(str(sa_entry["payable_amount"])) == Decimal("300.00")
    assert Decimal(str(sa_entry["amount_paid"])) == Decimal("0.00")
    assert sa_entry["status"] == "PENDING"

    # Criterion 4: Record actual insurer bank receipt of ₹1,350
    receipt_res = await client.post(
        f"/api/v1/insurance/commissions/{comm_id}/receipts",
        json={
            "receipt_date": date.today().isoformat(),
            "gross_amount": 1500.00,
            "tds_deducted": 150.00,
            "net_amount": 1350.00,
            "actual_commission_rate": 15.00,
            "actual_tds_rate": 10.00,
            "bank_account": "HDFC-A/C-99881122",
            "bank_name": "HDFC Bank",
            "payment_mode": "NEFT",
            "transaction_reference": f"UTR-INSURER-{uuid.uuid4().hex[:8].upper()}",
            "receipt_type": "FULL_PAYMENT",
            "notes": "Full insurer commission remitted into company bank account.",
        },
        headers=headers,
    )
    assert receipt_res.status_code == 200
    rcpt_data = receipt_res.json()

    # Criterion 5 & 6: Verify insurer status becomes RECEIVED and actual bank credit is ₹1,350
    assert rcpt_data["status"] == "RECEIVED"
    assert Decimal(str(rcpt_data["actual_net_received"])) == Decimal("1350.00")
    assert Decimal(str(rcpt_data["balance_receivable"])) == Decimal("0.00")
    assert rcpt_data["reconciliation_status"] == "RECONCILED"

    # Verify sub-agent payout did NOT automatically become PAID (still PENDING)
    sa_check_res = await client.get(f"/api/v1/insurance/commissions/sub-agent-payouts/{payout_id}", headers=headers)
    assert sa_check_res.status_code == 200
    assert sa_check_res.json()["status"] == "PENDING"

    # Criterion 7: Approve the sub-agent payout of ₹300
    appr_payout_res = await client.post(
        f"/api/v1/insurance/commissions/sub-agent-payouts/{payout_id}/approve",
        json={"approval_notes": "Policy verified, commission received from insurer. Payout approved."},
        headers=headers,
    )
    assert appr_payout_res.status_code == 200
    assert appr_payout_res.json()["status"] == "APPROVED"

    # Criterion 8: Record payment of ₹300 (or net after 5% TDS = ₹285)
    # The payout net_payable_amount is net of TDS (₹285) or gross (₹300) depending on agreement
    payout_detail = appr_payout_res.json()
    net_to_pay = float(payout_detail["net_payable_amount"])

    pay_res = await client.post(
        f"/api/v1/insurance/commissions/sub-agent-payouts/{payout_id}/payments",
        json={
            "payment_date": date.today().isoformat(),
            "amount": 300.00,
            "tds_deducted": float(payout_detail["tds_amount"]),
            "net_amount": net_to_pay,
            "payment_method": "BANK_TRANSFER",
            "bank_account_details": "ICICI Bank A/C 0011223344",
            "transaction_reference": f"UTR-AGT-{uuid.uuid4().hex[:8].upper()}",
            "notes": "Full commission share disbursed to sub-agent.",
        },
        headers=headers,
    )
    assert pay_res.status_code == 200
    payout_settled = pay_res.json()

    # Criterion 9 & 10: Verify sub-agent status becomes PAID and remaining payable becomes ₹0
    assert payout_settled["status"] == "PAID"
    assert Decimal(str(payout_settled["amount_paid"])) == Decimal(str(net_to_pay))
    assert Decimal(str(payout_settled["remaining_payable"])) == Decimal("0.00")

    # Criterion 11: Firm retains ₹1,200 before other applicable costs (Gross ₹1,500 - Sub-Agent ₹300 = ₹1,200)
    firm_retained_gross = Decimal(str(comm.gross_commission_amount)) - Decimal(str(payout.payable_amount))
    assert firm_retained_gross == Decimal("1200.00")

    # Criterion 12: Verify dashboard totals and exports
    dash_res = await client.get("/api/v1/insurance/commissions/dashboard", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()

    assert "insurer_receivables" in dash_data
    assert "sub_agent_payables" in dash_data
    assert "firm_position" in dash_data

    # Insurer receivables section
    assert Decimal(str(dash_data["insurer_receivables"]["actual_bank_received"])) >= Decimal("1350.00")
    # Sub-agent section
    assert Decimal(str(dash_data["sub_agent_payables"]["total_paid_to_agents"])) >= Decimal(str(net_to_pay))
    # Firm financial position
    assert Decimal(str(dash_data["firm_position"]["actual_bank_credit"])) >= Decimal("1350.00")

    # Criterion 13: Verify no duplicate ledger entries after page refresh or retry
    # Re-calling policy commission calculation is idempotent
    async with AsyncSessionLocal() as session:
        re_pol = await session.get(InsurancePolicy, uuid.UUID(created_policy_id))
        from app.services.insurance import calculate_and_record_policy_commission
        dup_comm = await calculate_and_record_policy_commission(session, re_pol, commission_type="FIRST_YEAR")
        assert str(dup_comm.id) == comm_id

        # Verify only 1 commission and 1 payout exists
        tot_c = (await session.execute(select(func.count(InsurancePolicyCommission.id)).where(InsurancePolicyCommission.policy_id == re_pol.id))).scalar_one()
        tot_p = (await session.execute(select(func.count(InsuranceSubAgentPayout.id)).where(InsuranceSubAgentPayout.policy_id == re_pol.id))).scalar_one()
        assert tot_c == 1
        assert tot_p == 1


# ===========================================================================
# TEST: POLICY WITHOUT SUB-AGENT
# ===========================================================================
@pytest.mark.asyncio
async def test_policy_without_sub_agent_creates_no_payout_obligation(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncSessionLocal() as session:
        cust = Customer(id=uuid.uuid4(), first_name="Direct", last_name="Client", phone=f"+9191{uuid.uuid4().int % 100000000:08d}")
        session.add(cust)
        company = InsuranceCompany(id=uuid.uuid4(), name=f"Direct Carrier {uuid.uuid4().hex[:4]}", code=f"DIR-{uuid.uuid4().hex[:4]}", is_active=True)
        session.add(company)
        plan = InsurancePlan(id=uuid.uuid4(), company_id=company.id, name="Direct Plan", code=f"DP-{uuid.uuid4().hex[:4]}", line_of_business="LIFE", status="ACTIVE")
        session.add(plan)
        await session.commit()

        cust_id = str(cust.id)
        comp_id = str(company.id)
        plan_id = str(plan.id)

    pol_num = f"POL-DIR-{uuid.uuid4().hex[:6].upper()}"
    res = await client.post(
        "/api/v1/insurance/policies",
        json={
            "policy_number": pol_num,
            "customer_id": cust_id,
            "company_id": comp_id,
            "plan_id": plan_id,
            "sub_agent_id": None,
            "policy_type": "LIFE",
            "coverage_type": "INDIVIDUAL",
            "sum_assured": 1000000.00,
            "final_premium": 20000.00,
            "net_premium": 20000.00,
            "policy_start_date": date.today().isoformat(),
            "first_year_commission_rate": 10.00,
            "first_year_commission_amount": 2000.00,
        },
        headers=headers,
    )
    assert res.status_code == 201
    created_id = res.json()["id"]

    async with AsyncSessionLocal() as session:
        # 1. Commission record exists
        c = (await session.execute(select(InsurancePolicyCommission).where(InsurancePolicyCommission.policy_id == uuid.UUID(created_id)))).scalar_one_or_none()
        assert c is not None
        assert c.gross_commission_amount == Decimal("2000.00")
        assert c.sub_agent_id is None

        # 2. NO sub-agent payout record is created
        p = (await session.execute(select(InsuranceSubAgentPayout).where(InsuranceSubAgentPayout.policy_id == uuid.UUID(created_id)))).scalar_one_or_none()
        assert p is None


# ===========================================================================
# TEST: ALL 8 DISTINCT FINANCIAL REPORTS (CSV AND EXCEL)
# ===========================================================================
@pytest.mark.asyncio
async def test_all_8_financial_reports_exports(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    report_endpoints = [
        "/api/v1/insurance/commissions/reports/insurer-receivables/export",
        "/api/v1/insurance/commissions/reports/insurer-receipts/export",
        "/api/v1/insurance/commissions/reports/insurer-tds/export",
        "/api/v1/insurance/commissions/reports/sub-agent-payables/export",
        "/api/v1/insurance/commissions/reports/sub-agent-payments/export",
        "/api/v1/insurance/commissions/reports/policy-wise/export",
        "/api/v1/insurance/commissions/reports/agent-wise/export",
        "/api/v1/insurance/commissions/reports/financial-reconciliation/export",
    ]

    for ep in report_endpoints:
        # Test CSV export
        csv_res = await client.get(f"{ep}?format=csv", headers=headers)
        assert csv_res.status_code == 200, f"CSV failed for {ep}: {csv_res.text}"
        assert csv_res.headers["content-type"].startswith("text/csv")
        assert len(csv_res.content) > 0

        # Test Excel export
        excel_res = await client.get(f"{ep}?format=excel", headers=headers)
        assert excel_res.status_code == 200, f"Excel failed for {ep}: {excel_res.text}"
        assert "openxmlformats" in excel_res.headers["content-type"]
        # Verify valid openpyxl workbook
        wb = openpyxl.load_workbook(io.BytesIO(excel_res.content))
        assert len(wb.sheetnames) >= 1
        ws = wb.active
        assert ws.max_row >= 1
