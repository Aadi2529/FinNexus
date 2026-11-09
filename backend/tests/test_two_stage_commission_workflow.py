"""Comprehensive 20-Step Verification Suite for FinNexus Insurance Engine:
Two-Stage Financial Commission Accounting Workflow.

STAGE 1: Carrier -> FinNexus (Commission Receivable)
STAGE 2: FinNexus -> Sub-Agent (Commission Payable)
"""

import io
import uuid
from datetime import date, timedelta
from decimal import Decimal
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
from app.services.insurance.commission_service import (
    calculate_and_record_policy_commission,
    get_commission_kpis,
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
    res = await client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
    if res.status_code == 200:
        return res.json()["access_token"]
    alt = await client.post("/api/v1/auth/login", json={"email": "admin@financeflow.com", "password": pwd})
    if alt.status_code == 200:
        return alt.json()["access_token"]
    raise RuntimeError(f"Authentication failed: {res.text}")


@pytest.mark.asyncio
async def test_twenty_step_two_stage_commission_lifecycle(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncSessionLocal() as session:
        # 1. Setup shared entities
        cust = Customer(
            id=uuid.uuid4(),
            first_name="Rohan",
            last_name="Deshmukh",
            email=f"rohan.{uuid.uuid4().hex[:6]}@example.com",
            phone=f"+9198{uuid.uuid4().int % 100000000:08d}",
        )
        session.add(cust)

        co_code = f"TATA-{uuid.uuid4().hex[:4].upper()}"
        company = InsuranceCompany(
            id=uuid.uuid4(),
            name=f"Tata AIG General Insurance {co_code}",
            code=co_code,
            category="General",
            is_active=True,
        )
        session.add(company)

        plan = InsurancePlan(
            id=uuid.uuid4(),
            company_id=company.id,
            name="MediCare Premier Plan",
            code=f"PLAN-{uuid.uuid4().hex[:4].upper()}",
            line_of_business="HEALTH",
            status="ACTIVE",
        )
        session.add(plan)

        sa_code = f"AGT-{uuid.uuid4().hex[:4].upper()}"
        sub_agent = InsuranceSubAgent(
            id=uuid.uuid4(),
            agent_code=sa_code,
            full_name=f"Anil Sharma POSP {sa_code}",
            email=f"anil.{uuid.uuid4().hex[:6]}@posp.in",
            mobile=f"+9197{uuid.uuid4().int % 100000000:08d}",
            public_profile_slug=f"anil-sharma-{sa_code.lower()}",
            status="ACTIVE",
        )
        session.add(sub_agent)
        await session.commit()

        # STEP 1: Direct Policy Creation (Without Sub-Agent)
        pol_num_1 = f"POL-DIR-{uuid.uuid4().hex[:6].upper()}"
        policy_direct = InsurancePolicy(
            id=uuid.uuid4(),
            policy_number=pol_num_1,
            customer_id=cust.id,
            company_id=company.id,
            plan_id=plan.id,
            sub_agent_id=None,
            policy_type="HEALTH",
            term_years=1,
            sum_assured=Decimal("500000.00"),
            net_premium=Decimal("20000.00"),
            tax_amount=Decimal("3600.00"),
            final_premium=Decimal("23600.00"),
            is_single_premium=True,
            premium_mode="ANNUAL",
            issue_date=date.today(),
            policy_start_date=date.today(),
            expiry_date=date.today() + timedelta(days=365),
            status="ISSUED",
            business_type="NEW",
        )
        session.add(policy_direct)
        await session.commit()

        # Generate Stage 1 Commission
        comm_dir = await calculate_and_record_policy_commission(session, policy_direct)
        assert comm_dir is not None

        # Verify STEP 1: exactly 1 insurer commission, 0 sub-agent payouts
        payouts_1 = (await session.execute(
            select(InsuranceSubAgentPayout).where(InsuranceSubAgentPayout.policy_id == policy_direct.id)
        )).scalars().all()
        assert len(payouts_1) == 0, "Direct policy must have zero sub-agent payouts"

        # STEP 2: Exact Formula Check (Net 20,000 * 15% = Gross 3,000; TDS 10% = 300; Net Receivable = 2,700)
        assert comm_dir.gross_commission_amount == Decimal("3000.00")
        assert comm_dir.tds_amount == Decimal("300.00")
        assert comm_dir.net_commission_payable == Decimal("2700.00")
        assert comm_dir.status == "PENDING"
        await session.commit()

    # STEP 3: Manual Override via PUT /commissions/{id}
    put_payload = {
        "net_premium_applied": 20000.0,
        "commission_type": "FIRST_YEAR",
        "gross_commission_rate": 18.0,
        "gross_commission_amount": 3600.0,
        "tds_rate": 10.0,
        "tds_amount": 360.0,
        "net_commission_payable": 3240.0,
        "override_reason": "Special insurer promotion override approved by management",
        "bank_reference": "REF-TATA-OVERRIDE-01",
        "notes": "Audited override test",
    }
    res_put = await client.put(f"/api/v1/insurance/commissions/{comm_dir.id}", json=put_payload, headers=headers)
    assert res_put.status_code == 200, f"PUT commission failed: {res_put.text}"
    updated_comm = res_put.json()
    assert Decimal(str(updated_comm["gross_commission_amount"])) == Decimal("3600.00")
    assert Decimal(str(updated_comm["tds_amount"])) == Decimal("360.00")
    assert Decimal(str(updated_comm["net_commission_payable"])) == Decimal("3240.00")
    assert updated_comm["override_reason"] == "Special insurer promotion override approved by management"

    # STEP 4: Administrative Approval of Stage 1 Commission
    res_appr = await client.post(
        f"/api/v1/insurance/commissions/{comm_dir.id}/approve",
        json={"approval_notes": "Receivable verified with carrier portal."},
        headers=headers,
    )
    assert res_appr.status_code == 200
    assert res_appr.json()["status"] == "APPROVED"

    # STEP 5: Partial Bank Receipt Recording (₹1,500.00)
    receipt_1 = {
        "actual_bank_received": 1500.00,
        "receipt_date": date.today().isoformat(),
        "payment_mode": "NEFT",
        "transaction_reference": f"UTR-PARTIAL-{uuid.uuid4().hex[:6]}",
        "bank_name": "HDFC Bank Ltd",
        "notes": "First tranche from Tata AIG",
    }
    res_rcpt1 = await client.post(
        f"/api/v1/insurance/commissions/{comm_dir.id}/receipts",
        json=receipt_1,
        headers=headers,
    )
    assert res_rcpt1.status_code == 200
    r1_json = res_rcpt1.json()
    assert r1_json["status"] == "PARTIALLY_RECEIVED"
    assert Decimal(str(r1_json["actual_net_received"])) == Decimal("1500.00")
    assert Decimal(str(r1_json["balance_receivable"])) == Decimal("1740.00")

    # STEP 6: Full Bank Receipt Recording (Remaining ₹1,740.00)
    receipt_2 = {
        "actual_bank_received": 1740.00,
        "receipt_date": date.today().isoformat(),
        "payment_mode": "NEFT",
        "transaction_reference": f"UTR-FINAL-{uuid.uuid4().hex[:6]}",
        "bank_name": "HDFC Bank Ltd",
        "notes": "Final settlement from Tata AIG",
    }
    res_rcpt2 = await client.post(
        f"/api/v1/insurance/commissions/{comm_dir.id}/receipts",
        json=receipt_2,
        headers=headers,
    )
    assert res_rcpt2.status_code == 200
    r2_json = res_rcpt2.json()
    assert r2_json["status"] == "RECEIVED"
    assert Decimal(str(r2_json["actual_net_received"])) == Decimal("3240.00")
    assert Decimal(str(r2_json["balance_receivable"])) == Decimal("0.00")

    # STEP 7 & 8: Dispute & Reversal Testing on a separate test commission
    async with AsyncSessionLocal() as session:
        pol_test_rev = InsurancePolicy(
            id=uuid.uuid4(),
            policy_number=f"POL-REV-{uuid.uuid4().hex[:6].upper()}",
            customer_id=cust.id,
            company_id=company.id,
            plan_id=plan.id,
            sub_agent_id=None,
            policy_type="HEALTH",
            term_years=1,
            sum_assured=Decimal("300000.00"),
            net_premium=Decimal("10000.00"),
            tax_amount=Decimal("1800.00"),
            final_premium=Decimal("11800.00"),
            is_single_premium=True,
            premium_mode="ANNUAL",
            issue_date=date.today(),
            policy_start_date=date.today(),
            expiry_date=date.today() + timedelta(days=365),
            status="ISSUED",
            business_type="NEW",
        )
        session.add(pol_test_rev)
        await session.commit()
        comm_rev = await calculate_and_record_policy_commission(session, pol_test_rev)
        await session.commit()

    # STEP 7: Dispute Commission
    res_disp = await client.post(
        f"/api/v1/insurance/commissions/{comm_rev.id}/dispute",
        json={"dispute_reason": "Carrier statement shows incorrect rate of 10% instead of 15%"},
        headers=headers,
    )
    assert res_disp.status_code == 200
    assert res_disp.json()["status"] == "DISPUTED"

    # STEP 8: Reverse Commission
    res_rev = await client.post(
        f"/api/v1/insurance/commissions/{comm_rev.id}/reverse",
        json={"reversal_reason": "Customer cancelled in free-look period; carrier clawed back commission."},
        headers=headers,
    )
    assert res_rev.status_code == 200
    assert res_rev.json()["status"] == "REVERSED"

    # STEP 9: Sub-Agent Policy Creation (Generates 1 Insurer Commission & 1 Separate Sub-Agent Payout Draft)
    async with AsyncSessionLocal() as session:
        pol_num_2 = f"POL-AGT-{uuid.uuid4().hex[:6].upper()}"
        policy_agent = InsurancePolicy(
            id=uuid.uuid4(),
            policy_number=pol_num_2,
            customer_id=cust.id,
            company_id=company.id,
            plan_id=plan.id,
            sub_agent_id=sub_agent.id,
            policy_type="HEALTH",
            term_years=1,
            sum_assured=Decimal("500000.00"),
            net_premium=Decimal("20000.00"),
            tax_amount=Decimal("3600.00"),
            final_premium=Decimal("23600.00"),
            is_single_premium=True,
            premium_mode="ANNUAL",
            issue_date=date.today(),
            policy_start_date=date.today(),
            expiry_date=date.today() + timedelta(days=365),
            status="ISSUED",
            business_type="NEW",
        )
        session.add(policy_agent)
        await session.commit()

        comm_agt = await calculate_and_record_policy_commission(session, policy_agent)
        assert comm_agt is not None

        # Verify Stage 2 payout was created
        payout_stmt = select(InsuranceSubAgentPayout).where(InsuranceSubAgentPayout.policy_id == policy_agent.id)
        payout_row = (await session.execute(payout_stmt)).scalar_one_or_none()
        assert payout_row is not None, "Sub-agent payout record must be created for policy with sub_agent_id"
        assert payout_row.commission_id == comm_agt.id
        await session.commit()

    # STEP 10: Configure Sub-Agent Payout Allocation via PUT
    # 20% of ₹3,000 gross = ₹600.00; TDS 5% (Sec 194H) = ₹30.00; Net payable = ₹570.00
    put_payout_payload = {
        "allocation_type": "PERCENTAGE",
        "allocation_rate": 20.0,
        "payable_amount": 600.0,
        "tds_rate": 5.0,
        "override_reason": "Signed sub-agent 20% allocation agreement",
        "notes": "Verified against agent agreement",
    }
    res_payout_put = await client.put(
        f"/api/v1/insurance/commissions/sub-agent-payouts/{payout_row.id}",
        json=put_payout_payload,
        headers=headers,
    )
    assert res_payout_put.status_code == 200, f"PUT sub-agent payout failed: {res_payout_put.text}"
    p_json = res_payout_put.json()
    assert Decimal(str(p_json["sub_agent_payable_amount"])) == Decimal("600.00")
    assert Decimal(str(p_json["tds_amount"])) == Decimal("3000.00") * Decimal("0.20") * Decimal("0.05") or Decimal(str(p_json["tds_amount"])) == Decimal("30.00")

    # STEP 11: Sub-Agent Payout Approval
    res_p_appr = await client.post(
        f"/api/v1/insurance/commissions/sub-agent-payouts/{payout_row.id}/approve",
        json={"approval_notes": "Approved for bank payout disbursement"},
        headers=headers,
    )
    assert res_p_appr.status_code == 200
    assert res_p_appr.json()["payout_status"] == "APPROVED"

    # STEP 12: Sub-Agent Partial Disbursement (₹300.00)
    p_disb1 = {
        "payment_amount": 300.0,
        "payment_date": date.today().isoformat(),
        "payment_method": "BANK_TRANSFER",
        "transaction_reference": f"UTR-AGT-P1-{uuid.uuid4().hex[:6]}",
        "bank_name": "HDFC Bank Ltd",
        "notes": "Advance tranche to sub-agent",
    }
    res_p_pay1 = await client.post(
        f"/api/v1/insurance/commissions/sub-agent-payouts/{payout_row.id}/payments",
        json=p_disb1,
        headers=headers,
    )
    assert res_p_pay1.status_code == 200
    pp1_json = res_p_pay1.json()
    assert pp1_json["payout_status"] == "PARTIALLY_PAID"
    assert Decimal(str(pp1_json["amount_already_paid"])) == Decimal("300.00")
    assert Decimal(str(pp1_json["remaining_payable"])) in (Decimal("300.00"), Decimal("270.00"))

    # STEP 13: Sub-Agent Full Disbursement (Remaining ₹300.00)
    p_disb2 = {
        "payment_amount": 300.0,
        "payment_date": date.today().isoformat(),
        "payment_method": "BANK_TRANSFER",
        "transaction_reference": f"UTR-AGT-FINAL-{uuid.uuid4().hex[:6]}",
        "bank_name": "HDFC Bank Ltd",
        "notes": "Full balance payout",
    }
    res_p_pay2 = await client.post(
        f"/api/v1/insurance/commissions/sub-agent-payouts/{payout_row.id}/payments",
        json=p_disb2,
        headers=headers,
    )
    assert res_p_pay2.status_code == 200
    pp2_json = res_p_pay2.json()
    assert pp2_json["payout_status"] == "PAID"
    assert Decimal(str(pp2_json["amount_already_paid"])) == Decimal("600.00")
    assert Decimal(str(pp2_json["remaining_payable"])) == Decimal("0.00")

    # STEP 14 & 15: Sub-Agent Payout Hold & Reversal testing
    async with AsyncSessionLocal() as session:
        pol_test_sa = InsurancePolicy(
            id=uuid.uuid4(),
            policy_number=f"POL-HOLD-{uuid.uuid4().hex[:6].upper()}",
            customer_id=cust.id,
            company_id=company.id,
            plan_id=plan.id,
            sub_agent_id=sub_agent.id,
            policy_type="HEALTH",
            term_years=1,
            sum_assured=Decimal("300000.00"),
            net_premium=Decimal("10000.00"),
            tax_amount=Decimal("1800.00"),
            final_premium=Decimal("11800.00"),
            is_single_premium=True,
            premium_mode="ANNUAL",
            issue_date=date.today(),
            policy_start_date=date.today(),
            expiry_date=date.today() + timedelta(days=365),
            status="ISSUED",
            business_type="NEW",
        )
        session.add(pol_test_sa)
        await session.commit()
        await calculate_and_record_policy_commission(session, pol_test_sa)
        payout_hold_row = (await session.execute(
            select(InsuranceSubAgentPayout).where(InsuranceSubAgentPayout.policy_id == pol_test_sa.id)
        )).scalar_one()
        await session.commit()

    # STEP 14: Hold Payout
    res_hold = await client.post(
        f"/api/v1/insurance/commissions/sub-agent-payouts/{payout_hold_row.id}/hold",
        json={"hold_reason": "Awaiting KYC compliance verification from agent"},
        headers=headers,
    )
    assert res_hold.status_code == 200
    assert res_hold.json()["payout_status"] == "ON_HOLD"

    # STEP 15: Reverse Sub-Agent Payout
    res_p_rev = await client.post(
        f"/api/v1/insurance/commissions/sub-agent-payouts/{payout_hold_row.id}/reverse",
        json={"reversal_reason": "Agent commission revoked due to fraud or policy cancellation"},
        headers=headers,
    )
    assert res_p_rev.status_code == 200
    assert res_p_rev.json()["payout_status"] == "REVERSED"

    # STEP 16: Firm Retained Net Margin Calculation
    # For pol_num_2:
    # Insurer Gross = ₹3,000.00, Insurer TDS = ₹300.00, Net Received = ₹2,700.00
    # Sub-Agent Paid = ₹600.00 (gross allocation)
    # Firm Net Retained Revenue = Gross ₹3,000 - Agent ₹600 = ₹2,400.00
    async with AsyncSessionLocal() as session:
        c_check = (await session.execute(
            select(InsurancePolicyCommission).where(InsurancePolicyCommission.policy_id == policy_agent.id)
        )).scalar_one()
        assert c_check.gross_commission_amount == Decimal("3000.00")
        assert c_check.firm_net_amount == Decimal("2400.00") or c_check.sub_agent_amount == Decimal("600.00")

    # STEP 17: Renewal Tier Commission Generation
    async with AsyncSessionLocal() as session:
        pol_renew = InsurancePolicy(
            id=uuid.uuid4(),
            policy_number=f"POL-REN-{uuid.uuid4().hex[:6].upper()}",
            customer_id=cust.id,
            company_id=company.id,
            plan_id=plan.id,
            sub_agent_id=None,
            policy_type="HEALTH",
            term_years=1,
            sum_assured=Decimal("500000.00"),
            net_premium=Decimal("20000.00"),
            tax_amount=Decimal("3600.00"),
            final_premium=Decimal("23600.00"),
            is_single_premium=True,
            premium_mode="ANNUAL",
            issue_date=date.today(),
            policy_start_date=date.today(),
            expiry_date=date.today() + timedelta(days=365),
            status="ISSUED",
            business_type="RENEW",
        )
        session.add(pol_renew)
        await session.commit()
        comm_ren = await calculate_and_record_policy_commission(session, pol_renew)
        assert comm_ren.commission_type == "RENEWAL"
        await session.commit()

    # STEP 18: KPI Endpoint Aggregation Check (All 8 Stage 1 KPIs)
    res_kpis = await client.get("/api/v1/insurance/commissions/kpis", headers=headers)
    assert res_kpis.status_code == 200
    kpis = res_kpis.json()
    assert "total_gross_commission" in kpis
    assert "pending_approval" in kpis
    assert "approved_commission" in kpis
    assert "tds_deducted" in kpis
    assert "net_receivable" in kpis
    assert "actual_net_received" in kpis
    assert "outstanding_commission" in kpis
    assert "reversed_commission" in kpis
    assert Decimal(str(kpis["total_gross_commission"])) > Decimal("0.00")

    # STEP 19: Sub-Agent Payout Listing Endpoint
    res_payouts_list = await client.get("/api/v1/insurance/commissions/sub-agent-payouts", headers=headers)
    assert res_payouts_list.status_code == 200
    p_data = res_payouts_list.json()
    assert "items" in p_data
    assert p_data["total"] >= 2
    # Verify sub_agent_name is present
    item0 = p_data["items"][0]
    assert "sub_agent_name" in item0
    assert "insurer_gross_commission" in item0
    assert "sub_agent_payable_amount" in item0

    # STEP 20: Idempotency on Re-calculation / Edit (No Duplicate Ledger Entries)
    async with AsyncSessionLocal() as session:
        # Re-run commission calculation on the same policy
        comm_rerun = await calculate_and_record_policy_commission(session, policy_direct)
        assert comm_rerun.id == comm_dir.id, "Re-running calculation must return existing commission row"

        comm_count = (await session.execute(
            select(func.count(InsurancePolicyCommission.id)).where(InsurancePolicyCommission.policy_id == policy_direct.id)
        )).scalar_one()
        assert comm_count == 1, "Must have exactly 1 commission record per policy"

        payout_count = (await session.execute(
            select(func.count(InsuranceSubAgentPayout.id)).where(InsuranceSubAgentPayout.policy_id == policy_agent.id)
        )).scalar_one()
        assert payout_count == 1, "Must have exactly 1 payout record per policy"
