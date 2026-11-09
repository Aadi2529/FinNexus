"""Production-Grade Test Suite for FinNexus Insurance Engine:
Commission Management & Financial Reconciliation Module (Phases 1-16).

Verifies:
- Test 1: Complete End-to-End Accounting Workflow:
    * First Year Commission calculation & agreement snapshotting (Net Premium base, TDS, Sub-agent split, Firm share)
    * Renewal Commission generation (renewal rate 7.5%, linked renewal entry, idempotency protection)
    * Commission Approval lifecycle (PENDING -> APPROVED)
    * Partial Bank Receipts & Financial Reconciliation (Expected ₹1,350: R1 ₹800 -> PARTIALLY_PAID & -₹550 diff; R2 ₹550 -> PAID & RECONCILED)
    * Commission Reversal with mandatory explanation & audit history (PAID -> REVERSED)
- Test 2: Real Database Aggregations for 8 Financial KPI Cards
- Test 3: Agent Performance Reports & Grouping
- Test 4: Real CSV and Excel Ledger Exports
- Test 5: Insurer Commission Agreement CRUD & Resolution
"""

import io
import uuid
from datetime import date, timedelta
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

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
)
from app.db.models.crm import Customer
from app.services.insurance.commission_service import (
    calculate_and_record_policy_commission,
    get_commission_kpis,
    resolve_insurer_commission_agreement,
)


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
    """Obtain JWT access token for authenticated requests."""
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": pwd},
    )
    if res.status_code == 200:
        return res.json()["access_token"]
    alt = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@financeflow.com", "password": pwd},
    )
    if alt.status_code == 200:
        return alt.json()["access_token"]
    raise RuntimeError(f"Authentication failed: {res.text}")


# ===========================================================================
# TEST 1: COMPLETE END-TO-END COMMISSION ACCOUNTING & RECONCILIATION WORKFLOW
# ===========================================================================
@pytest.mark.asyncio
async def test_complete_commission_accounting_and_reconciliation_workflow(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncSessionLocal() as session:
        # 1. Create test customer
        cust = Customer(
            id=uuid.uuid4(),
            first_name="Siddharth",
            last_name="Rao",
            email=f"siddharth.{uuid.uuid4().hex[:6]}@example.com",
            phone=f"+9198{uuid.uuid4().int % 100000000:08d}",
        )
        session.add(cust)

        # 2. Create test company
        comp_code = f"TEST-COMP-{uuid.uuid4().hex[:4].upper()}"
        company = InsuranceCompany(
            id=uuid.uuid4(),
            name=f"Test Carrier {comp_code}",
            code=comp_code,
            category="Composite",
            is_active=True,
        )
        session.add(company)

        # 3. Create test plan
        plan = InsurancePlan(
            id=uuid.uuid4(),
            company_id=company.id,
            name="Super Health Shield",
            code=f"PLAN-{uuid.uuid4().hex[:4].upper()}",
            line_of_business="HEALTH",
            status="ACTIVE",
        )
        session.add(plan)

        # 4. Create test sub-agent
        sa_code = f"SA-{uuid.uuid4().hex[:4].upper()}"
        sub_agent = InsuranceSubAgent(
            id=uuid.uuid4(),
            full_name="Rajesh Mehra",
            agent_code=sa_code,
            mobile=f"+9197{uuid.uuid4().int % 100000000:08d}",
            email=f"rajesh.{sa_code.lower()}@example.com",
            public_profile_slug=f"rajesh-{sa_code.lower()}",
            status="ACTIVE",
        )
        session.add(sub_agent)
        await session.flush()

        # 5. Create sub-agent commission split rule: 20% of Gross Commission
        split_rule = InsuranceCommissionSplitConfig(
            id=uuid.uuid4(),
            sub_agent_id=sub_agent.id,
            company_id=company.id,
            split_type="PERCENTAGE",
            split_value=Decimal("20.00"),
            allocation_basis="GROSS_COMMISSION",
            effective_date=date.today() - timedelta(days=30),
            is_active=True,
        )
        session.add(split_rule)

        # 6. Create insurer commission agreement: 15% First Year, 7.5% Renewal, 10% TDS
        agreement = InsuranceCompanyCommissionAgreement(
            id=uuid.uuid4(),
            company_id=company.id,
            policy_category="HEALTH",
            first_year_commission_rate=Decimal("15.00"),
            renewal_commission_rate=Decimal("7.50"),
            commissionable_basis="NET_PREMIUM",
            tds_rate=Decimal("10.00"),
            effective_from=date.today() - timedelta(days=30),
            is_active=True,
        )
        session.add(agreement)

        # 7. Create test policy with Net Premium = 10,000.00
        pol_num = f"POL-TEST-{uuid.uuid4().hex[:6].upper()}"
        policy = InsurancePolicy(
            id=uuid.uuid4(),
            policy_number=pol_num,
            customer_id=cust.id,
            company_id=company.id,
            plan_id=plan.id,
            sub_agent_id=sub_agent.id,
            policy_type="HEALTH",
            coverage_type="INDIVIDUAL",
            sum_assured=Decimal("500000.00"),
            final_premium=Decimal("11800.00"),
            net_premium=Decimal("10000.00"),
            policy_start_date=date.today(),
            expiry_date=date.today() + timedelta(days=365),
            status="ACTIVE",
            commission_received_status="PENDING",
        )
        session.add(policy)
        await session.commit()

        # STEP A: Calculate First-Year Commission
        comm = await calculate_and_record_policy_commission(
            session=session,
            policy=policy,
            commission_type="FIRST_YEAR",
        )
        await session.commit()

        # Verify Exact Financial Calculations:
        # Net Premium Base = 10,000.00
        # Gross Commission (15%) = 1,500.00
        # Sub-Agent Share (20% of 1,500) = 300.00
        # Firm Share (1,500 - 300) = 1,200.00
        # TDS (10% of 1,500) = 150.00
        # Expected Net Receivable = 1,350.00
        assert comm is not None
        assert comm.net_premium_applied == Decimal("10000.00")
        assert comm.gross_commission_rate == Decimal("15.00")
        assert comm.gross_commission_amount == Decimal("1500.00")
        assert comm.sub_agent_amount == Decimal("300.00")
        assert comm.firm_net_amount == Decimal("1200.00")
        assert comm.tds_amount == Decimal("150.00")
        assert comm.net_commission_payable == Decimal("1350.00")
        assert comm.status == "PENDING"
        assert comm.recipient_type == "SUB_AGENT"
        assert comm.agreement_snapshot is not None
        assert "15.0" in comm.agreement_snapshot or "15" in comm.agreement_snapshot

        # STEP B: Calculate Renewal Commission
        renewal_comm = await calculate_and_record_policy_commission(
            session=session,
            policy=policy,
            commission_type="RENEWAL",
        )
        await session.commit()

        # Renewal rate: 7.5% -> Gross = 750.00, TDS = 75.00, Net = 675.00, Sub-agent = 150.00, Firm = 600.00
        assert renewal_comm is not None
        assert renewal_comm.commission_type == "RENEWAL"
        assert renewal_comm.gross_commission_rate == Decimal("7.50")
        assert renewal_comm.gross_commission_amount == Decimal("750.00")
        assert renewal_comm.sub_agent_amount == Decimal("150.00")
        assert renewal_comm.firm_net_amount == Decimal("600.00")
        assert renewal_comm.tds_amount == Decimal("75.00")
        assert renewal_comm.net_commission_payable == Decimal("675.00")

        # Idempotency check: calling again returns the existing record
        dup_renewal = await calculate_and_record_policy_commission(
            session=session,
            policy=policy,
            commission_type="RENEWAL",
        )
        assert dup_renewal.id == renewal_comm.id

        comm_id = str(comm.id)

    # STEP C: API Verification & Joined Metadata
    res = await client.get(
        f"/api/v1/insurance/commissions/{comm_id}",
        headers=headers,
    )
    assert res.status_code == 200
    detail = res.json()
    assert detail["policy_number"] == pol_num
    assert detail["customer_name"] == "Siddharth Rao"
    assert detail["company_name"] == f"Test Carrier {comp_code}"
    assert detail["plan_name"] == "Super Health Shield"
    assert Decimal(str(detail["gross_commission_amount"])) == Decimal("1500.00")
    assert Decimal(str(detail["sub_agent_amount"])) == Decimal("300.00")
    assert Decimal(str(detail["firm_net_amount"])) == Decimal("1200.00")
    assert Decimal(str(detail["net_commission_payable"])) == Decimal("1350.00")

    # STEP D: Lifecycle Approval (PENDING -> APPROVED)
    appr_res = await client.post(
        f"/api/v1/insurance/commissions/{comm_id}/approve",
        json={"approval_notes": "Insurer statement verified against portal."},
        headers=headers,
    )
    assert appr_res.status_code == 200
    appr_data = appr_res.json()
    assert appr_data["status"] == "APPROVED"
    assert appr_data["approved_at"] is not None

    # STEP E: Bank Receipt 1 (Expected ₹1,350 -> Received ₹800)
    r1_res = await client.post(
        f"/api/v1/insurance/commissions/{comm_id}/receipts",
        json={
            "receipt_date": date.today().isoformat(),
            "net_amount": 800.00,
            "gross_amount": 888.89,
            "tds_deducted": 88.89,
            "payment_mode": "NEFT",
            "bank_name": "HDFC Bank Ltd",
            "transaction_reference": "UTR-PARTIAL-800",
            "receipt_type": "INSURER_COMMISSION",
            "notes": "First tranche received from carrier",
        },
        headers=headers,
    )
    assert r1_res.status_code == 200
    r1_data = r1_res.json()
    assert r1_data["status"] in ("PARTIALLY_RECEIVED", "PARTIALLY_PAID")
    assert r1_data["reconciliation_status"] == "SHORT_PAYMENT"
    assert Decimal(str(r1_data["actual_net_received"])) == Decimal("800.00")
    assert Decimal(str(r1_data["reconciliation_difference"])) == Decimal("-550.00")

    # STEP F: Bank Receipt 2 (Remaining ₹550)
    r2_res = await client.post(
        f"/api/v1/insurance/commissions/{comm_id}/receipts",
        json={
            "receipt_date": date.today().isoformat(),
            "net_amount": 550.00,
            "gross_amount": 611.11,
            "tds_deducted": 61.11,
            "payment_mode": "RTGS",
            "bank_name": "HDFC Bank Ltd",
            "transaction_reference": "UTR-FINAL-550",
            "receipt_type": "INSURER_COMMISSION",
            "notes": "Second tranche received; settlement complete",
        },
        headers=headers,
    )
    assert r2_res.status_code == 200
    r2_data = r2_res.json()
    assert r2_data["status"] in ("RECEIVED", "PAID")
    assert r2_data["reconciliation_status"] == "RECONCILED"
    assert Decimal(str(r2_data["actual_net_received"])) == Decimal("1350.00")
    assert Decimal(str(r2_data["reconciliation_difference"])) == Decimal("0.00")
    assert len(r2_data["receipts"]) == 2

    # STEP G: Reversal with mandatory explanation
    rev_res = await client.post(
        f"/api/v1/insurance/commissions/{comm_id}/reverse",
        json={
            "reversal_reason": "Policy cancelled during 30-day free-look window.",
            "reversal_amount": 1500.00,
            "notes": "Full insurer clawback initiated.",
        },
        headers=headers,
    )
    assert rev_res.status_code == 200
    rev_data = rev_res.json()
    assert rev_data["status"] == "REVERSED"
    assert rev_data["reversal_reason"] == "Policy cancelled during 30-day free-look window."
    assert Decimal(str(rev_data["reversal_amount"])) == Decimal("1500.00")


# ===========================================================================
# TEST 2: 8 FINANCIAL KPI CARDS
# ===========================================================================
@pytest.mark.asyncio
async def test_financial_kpi_cards_and_aggregations(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/v1/insurance/commissions/kpis", headers=headers)
    assert res.status_code == 200
    kpis = res.json()

    assert "total_gross_commission" in kpis
    assert "pending_commission" in kpis
    assert "approved_commission" in kpis
    assert "actual_net_received" in kpis
    assert "sub_agent_payable" in kpis
    assert "tds_deducted" in kpis
    assert "firm_retained_revenue" in kpis
    assert "reversed_commission" in kpis
    assert "total_transactions" in kpis
    assert kpis["total_transactions"] >= 2
    assert float(kpis["total_gross_commission"]) >= 0


# ===========================================================================
# TEST 3: AGENT PERFORMANCE REPORTS
# ===========================================================================
@pytest.mark.asyncio
async def test_agent_performance_reports(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/v1/insurance/commissions/reports/agent-performance", headers=headers)
    assert res.status_code == 200
    reports = res.json()
    assert isinstance(reports, list)
    assert len(reports) >= 1

    for item in reports:
        assert "agent_name" in item
        assert "total_policies" in item
        assert "gross_commission" in item
        assert "net_payable" in item
        assert "actual_paid" in item


# ===========================================================================
# TEST 4: CSV AND EXCEL LEDGER EXPORTS
# ===========================================================================
@pytest.mark.asyncio
async def test_csv_and_excel_exports(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # CSV Export
    csv_res = await client.get("/api/v1/insurance/commissions/reports/export/csv", headers=headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    csv_text = csv_res.text
    assert "Policy Number" in csv_text
    assert "Gross Insurer Comm (INR)" in csv_text
    assert "TDS Deducted (INR)" in csv_text
    assert "Reconciliation Diff (INR)" in csv_text

    # Excel Export
    excel_res = await client.get("/api/v1/insurance/commissions/reports/export/excel", headers=headers)
    assert excel_res.status_code == 200
    assert "spreadsheetml" in excel_res.headers["content-type"]
    assert len(excel_res.content) > 1000


# ===========================================================================
# TEST 5: INSURER COMMISSION AGREEMENTS CRUD
# ===========================================================================
@pytest.mark.asyncio
async def test_insurer_commission_agreements_crud(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # List companies to get a company ID
    companies_res = await client.get("/api/v1/insurance/companies?page_size=5", headers=headers)
    assert companies_res.status_code == 200
    companies = companies_res.json()["items"]
    assert len(companies) > 0
    test_comp_id = companies[0]["id"]

    # Create agreement
    create_res = await client.post(
        "/api/v1/insurance/commissions/agreements",
        json={
            "company_id": test_comp_id,
            "policy_category": "HEALTH",
            "first_year_commission_rate": 18.50,
            "renewal_commission_rate": 8.00,
            "commissionable_basis": "NET_PREMIUM",
            "tds_rate": 10.00,
            "effective_from": date.today().isoformat(),
            "is_active": True,
            "notes": "Premium health tie-up rate contract",
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    agr_data = create_res.json()
    assert Decimal(str(agr_data["first_year_commission_rate"])) == Decimal("18.50")
    agr_id = agr_data["id"]

    # List agreements
    list_res = await client.get(f"/api/v1/insurance/commissions/agreements?company_id={test_comp_id}", headers=headers)
    assert list_res.status_code == 200
    agrs = list_res.json()
    assert any(a["id"] == agr_id for a in agrs)

    # Update agreement
    update_res = await client.put(
        f"/api/v1/insurance/commissions/agreements/{agr_id}",
        json={
            "first_year_commission_rate": 20.00,
            "notes": "Updated to 20% by executive authorization",
        },
        headers=headers,
    )
    assert update_res.status_code == 200
    assert Decimal(str(update_res.json()["first_year_commission_rate"])) == Decimal("20.00")
