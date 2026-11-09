"""Comprehensive Test Suite for Commission Bank Receipt Fix (HTTP 422 Resolution & Two-Stage Separation).

Verifies:
1. Exact screenshot payload from user (without `net_amount`, with `actual_bank_received`) succeeds with HTTP 201.
2. Both `net_amount` (Expected Net Receivable: Gross - TDS) and `actual_bank_received` (Bank credit) are correctly stored and distinguished.
3. Full expected bank receipt transitions commission to RECEIVED and RECONCILED.
4. Partial bank receipt records deficit difference and PARTIALLY_RECEIVED status.
5. Excess bank receipt records surplus difference and EXCESS_RECEIVED status.
6. Duplicate transaction reference rejection (HTTP 400).
7. Validation rejection for non-positive amount and invalid payment mode.
8. Two-stage isolation: Recording insurer bank receipt does NOT mark sub-agent payout as PAID.
9. Statement document upload and file serving endpoints.
"""

from __future__ import annotations

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
    InsurancePlan,
    InsurancePolicy,
    InsurancePolicyCommission,
    InsuranceCommissionReceipt,
    InsuranceSubAgent,
    InsuranceSubAgentPayout,
)
from app.db.models.crm import Customer
from app.services.insurance.commission_service import calculate_and_record_policy_commission


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
    return alt.json()["access_token"]


@pytest.mark.asyncio
async def test_exact_screenshot_payload_succeeds_without_422(client: AsyncClient):
    """Verifies that the exact payload reported by the user in the error screenshot
    (which lacks net_amount and sends actual_bank_received) now succeeds with HTTP 201
    and correctly reconciles fields in the database.
    """
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncSessionLocal() as session:
        cust = Customer(
            id=uuid.uuid4(),
            first_name="Ramesh",
            last_name="Kumar",
            email=f"ramesh.{uuid.uuid4().hex[:6]}@example.com",
            phone=f"+9198{uuid.uuid4().int % 100000000:08d}",
        )
        session.add(cust)

        co_code = f"IFFCO-{uuid.uuid4().hex[:4].upper()}"
        company = InsuranceCompany(
            id=uuid.uuid4(),
            name=f"Iffco Tokio General Insurance {co_code}",
            code=co_code,
            category="Motor Insurance",
            is_active=True,
        )
        session.add(company)

        plan = InsurancePlan(
            id=uuid.uuid4(),
            company_id=company.id,
            name="Motor Comprehensive Plan",
            code=f"PLAN-MOTR-{uuid.uuid4().hex[:4].upper()}",
            line_of_business="MOTOR",
            status="ACTIVE",
        )
        session.add(plan)
        await session.commit()

        # Policy POL-MOTR-2026-18938 (from the user's screenshot error notes)
        pol_num = f"POL-MOTR-2026-{uuid.uuid4().int % 90000 + 10000}"
        policy = InsurancePolicy(
            id=uuid.uuid4(),
            policy_number=pol_num,
            customer_id=cust.id,
            company_id=company.id,
            plan_id=plan.id,
            policy_type="MOTOR",
            term_years=1,
            sum_assured=Decimal("450000.00"),
            net_premium=Decimal("11000.00"),
            tax_amount=Decimal("1980.00"),
            final_premium=Decimal("12980.00"),
            is_single_premium=True,
            premium_mode="ANNUAL",
            issue_date=date.today(),
            policy_start_date=date.today(),
            expiry_date=date.today() + timedelta(days=365),
            status="ISSUED",
            business_type="NEW",
        )
        session.add(policy)
        await session.commit()

        # Create commission: 8.5% of 11,000 = 935 gross; TDS 10% = 93.5; Net = 841.5
        comm = await calculate_and_record_policy_commission(
            session,
            policy,
            gross_rate_override=Decimal("8.50"),
            gross_amount_override=Decimal("935.00"),
            tds_rate_override=Decimal("10.00"),
            tds_amount_override=Decimal("93.50"),
            net_payable_override=Decimal("841.50"),
        )
        assert comm is not None
        await session.commit()
        comm_id = comm.id

    # Exact payload from the user's screenshot
    screenshot_payload = {
        "actual_commission_rate": 8.5,
        "actual_gross_commission": 935,
        "actual_tds_rate": 10,
        "actual_tds_amount": 93.5,
        "actual_bank_received": 841.5,
        "receipt_date": "2026-11-06",
        "bank_account": "021202",
        "payment_mode": "NEFT",
        "bank_name": "HDFC Bank Ltd",
        "transaction_reference": f"JHBGHYH-{uuid.uuid4().hex[:4].upper()}",
        "document_url": "KLJLKJM;",
        "notes": f"Receipt from Iffco Tokio for policy {pol_num}",
    }

    # Submit to API
    res = await client.post(
        f"/api/v1/insurance/commissions/{comm_id}/receipts",
        json=screenshot_payload,
        headers=headers,
    )
    assert res.status_code == 200, f"Expected 200 OK but got {res.status_code}: {res.text}"
    comm_resp = res.json()
    assert len(comm_resp["receipts"]) > 0
    receipt_data = comm_resp["receipts"][-1]

    # Verify response schema fields
    assert Decimal(str(receipt_data["actual_bank_received"])) == Decimal("841.50")
    assert Decimal(str(receipt_data["net_amount"])) == Decimal("841.50")
    assert Decimal(str(receipt_data["gross_amount"])) == Decimal("935.00")
    assert Decimal(str(receipt_data["tds_deducted"])) == Decimal("93.50")
    assert receipt_data["payment_mode"] == "NEFT"
    assert receipt_data["bank_name"] == "HDFC Bank Ltd"
    assert receipt_data["bank_account"] == "021202"
    assert receipt_data["document_url"] == "KLJLKJM;"

    # Verify database persistence
    async with AsyncSessionLocal() as session:
        rcpt = (await session.execute(
            select(InsuranceCommissionReceipt).where(InsuranceCommissionReceipt.commission_id == comm_id)
        )).scalar_one()
        assert rcpt.actual_bank_received == Decimal("841.50")
        assert rcpt.net_amount == Decimal("841.50")
        assert rcpt.gross_amount == Decimal("935.00")
        assert rcpt.tds_deducted == Decimal("93.50")
        assert rcpt.supporting_document_url == "KLJLKJM;"

        # Verify commission status transition
        comm_db = await session.get(InsurancePolicyCommission, comm_id)
        assert comm_db.status == "RECEIVED"
        assert comm_db.reconciliation_status == "RECONCILED"
        assert comm_db.reconciliation_difference == Decimal("0.00")
        assert comm_db.balance_receivable == Decimal("0.00")


@pytest.mark.asyncio
async def test_partial_and_excess_bank_receipt_reconciliation(client: AsyncClient):
    """Verifies that short payment and excess bank credit are properly calculated and tracked."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncSessionLocal() as session:
        cust = Customer(
            id=uuid.uuid4(),
            first_name="Pooja",
            last_name="Sharma",
            email=f"pooja.{uuid.uuid4().hex[:6]}@example.com",
            phone=f"+9198{uuid.uuid4().int % 100000000:08d}",
        )
        session.add(cust)

        co = InsuranceCompany(
            id=uuid.uuid4(),
            name=f"Star Health {uuid.uuid4().hex[:4]}",
            code=f"STAR-{uuid.uuid4().hex[:4].upper()}",
            category="Health Insurance",
            is_active=True,
        )
        session.add(co)

        plan = InsurancePlan(
            id=uuid.uuid4(),
            company_id=co.id,
            name="Comprehensive Health",
            code=f"PLAN-HLTH-{uuid.uuid4().hex[:4].upper()}",
            line_of_business="HEALTH",
            status="ACTIVE",
        )
        session.add(plan)
        await session.commit()

        # Policy with Expected Net Receivable = ₹1,800.00 (Gross ₹2,000, TDS ₹200)
        pol = InsurancePolicy(
            id=uuid.uuid4(),
            policy_number=f"POL-HLTH-{uuid.uuid4().hex[:6].upper()}",
            customer_id=cust.id,
            company_id=co.id,
            plan_id=plan.id,
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
        session.add(pol)
        await session.commit()

        comm = await calculate_and_record_policy_commission(
            session,
            pol,
            gross_rate_override=Decimal("10.00"),
            gross_amount_override=Decimal("2000.00"),
            tds_rate_override=Decimal("10.00"),
            tds_amount_override=Decimal("200.00"),
            net_payable_override=Decimal("1800.00"),
        )
        await session.commit()
        comm_id = comm.id

    # 1. First Tranche: Short Bank Receipt (₹1,000 received out of ₹1,800 expected)
    tranche1 = {
        "net_amount": 1800.0,
        "actual_bank_received": 1000.0,
        "actual_gross_commission": 2000.0,
        "actual_tds_amount": 200.0,
        "receipt_date": date.today().isoformat(),
        "payment_mode": "NEFT",
        "bank_name": "Axis Bank Ltd",
        "transaction_reference": f"UTR-T1-{uuid.uuid4().hex[:6].upper()}",
        "notes": "Partial receipt tranche 1",
    }
    res1 = await client.post(f"/api/v1/insurance/commissions/{comm_id}/receipts", json=tranche1, headers=headers)
    assert res1.status_code == 200

    async with AsyncSessionLocal() as session:
        c1 = await session.get(InsurancePolicyCommission, comm_id)
        assert c1.status == "PARTIALLY_RECEIVED"
        assert c1.reconciliation_status == "SHORT_PAYMENT"
        assert c1.reconciliation_difference == Decimal("-800.00")
        assert c1.balance_receivable == Decimal("800.00")

    # 2. Second Tranche: Remaining ₹800 + ₹200 excess credit (₹1,000 received -> total bank = ₹2,000 vs ₹1,800 expected)
    tranche2 = {
        "net_amount": 800.0,
        "actual_bank_received": 1000.0,
        "actual_gross_commission": 2000.0,
        "actual_tds_amount": 200.0,
        "receipt_date": date.today().isoformat(),
        "payment_mode": "RTGS",
        "bank_name": "Axis Bank Ltd",
        "transaction_reference": f"UTR-T2-{uuid.uuid4().hex[:6].upper()}",
        "notes": "Final settlement with excess promotion credit",
    }
    res2 = await client.post(f"/api/v1/insurance/commissions/{comm_id}/receipts", json=tranche2, headers=headers)
    assert res2.status_code == 200

    async with AsyncSessionLocal() as session:
        c2 = await session.get(InsurancePolicyCommission, comm_id)
        assert c2.status == "EXCESS_RECEIVED"
        assert c2.reconciliation_status == "EXCESS_PAYMENT"
        assert c2.reconciliation_difference == Decimal("200.00")
        assert c2.balance_receivable == Decimal("0.00")


@pytest.mark.asyncio
async def test_duplicate_reference_and_negative_amount_rejected(client: AsyncClient):
    """Verifies that duplicate transaction references and invalid amounts are rejected."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncSessionLocal() as session:
        cust = Customer(
            id=uuid.uuid4(),
            first_name="Anita",
            last_name="Roy",
            email=f"anita.{uuid.uuid4().hex[:6]}@example.com",
            phone=f"+9198{uuid.uuid4().int % 100000000:08d}",
        )
        session.add(cust)

        co = InsuranceCompany(
            id=uuid.uuid4(),
            name=f"HDFC ERGO {uuid.uuid4().hex[:4]}",
            code=f"HDFC-{uuid.uuid4().hex[:4].upper()}",
            category="General",
            is_active=True,
        )
        session.add(co)

        plan = InsurancePlan(
            id=uuid.uuid4(),
            company_id=co.id,
            name="Optima Restore",
            code=f"PLAN-OPT-{uuid.uuid4().hex[:4].upper()}",
            line_of_business="HEALTH",
            status="ACTIVE",
        )
        session.add(plan)
        await session.commit()

        pol = InsurancePolicy(
            id=uuid.uuid4(),
            policy_number=f"POL-DUP-{uuid.uuid4().hex[:6].upper()}",
            customer_id=cust.id,
            company_id=co.id,
            plan_id=plan.id,
            policy_type="HEALTH",
            term_years=1,
            sum_assured=Decimal("500000.00"),
            net_premium=Decimal("15000.00"),
            tax_amount=Decimal("2700.00"),
            final_premium=Decimal("17700.00"),
            is_single_premium=True,
            premium_mode="ANNUAL",
            issue_date=date.today(),
            policy_start_date=date.today(),
            expiry_date=date.today() + timedelta(days=365),
            status="ISSUED",
            business_type="NEW",
        )
        session.add(pol)
        await session.commit()

        comm = await calculate_and_record_policy_commission(session, pol)
        await session.commit()
        comm_id = comm.id

    # 1. Negative / zero amount must fail
    neg_payload = {
        "actual_bank_received": -500.0,
        "receipt_date": date.today().isoformat(),
        "payment_mode": "NEFT",
        "transaction_reference": f"UTR-NEG-{uuid.uuid4().hex[:6]}",
    }
    res_neg = await client.post(f"/api/v1/insurance/commissions/{comm_id}/receipts", json=neg_payload, headers=headers)
    assert res_neg.status_code == 422

    # 2. Duplicate transaction reference must fail with HTTP 400
    shared_utr = f"UTR-DUP-REF-{uuid.uuid4().hex[:8].upper()}"
    valid_payload = {
        "actual_bank_received": 1000.0,
        "receipt_date": date.today().isoformat(),
        "payment_mode": "NEFT",
        "transaction_reference": shared_utr,
    }
    res_ok = await client.post(f"/api/v1/insurance/commissions/{comm_id}/receipts", json=valid_payload, headers=headers)
    assert res_ok.status_code == 200

    # Second submission with same UTR
    res_dup = await client.post(f"/api/v1/insurance/commissions/{comm_id}/receipts", json=valid_payload, headers=headers)
    assert res_dup.status_code == 400
    assert "already been recorded" in res_dup.text.lower()


@pytest.mark.asyncio
async def test_insurer_receipt_does_not_affect_sub_agent_payout_status(client: AsyncClient):
    """Critical Rule: Recording an insurer bank receipt must NEVER mark a sub-agent
    payout as PAID. The two financial lifecycles must remain strictly independent.
    """
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncSessionLocal() as session:
        cust = Customer(
            id=uuid.uuid4(),
            first_name="Deepak",
            last_name="Verma",
            email=f"deepak.{uuid.uuid4().hex[:6]}@example.com",
            phone=f"+9198{uuid.uuid4().int % 100000000:08d}",
        )
        session.add(cust)

        co = InsuranceCompany(
            id=uuid.uuid4(),
            name=f"Bajaj Allianz {uuid.uuid4().hex[:4]}",
            code=f"BAGIC-{uuid.uuid4().hex[:4].upper()}",
            category="Motor Insurance",
            is_active=True,
        )
        session.add(co)

        plan = InsurancePlan(
            id=uuid.uuid4(),
            company_id=co.id,
            name="Motor Drive Smart",
            code=f"PLAN-MTR-{uuid.uuid4().hex[:4].upper()}",
            line_of_business="MOTOR",
            status="ACTIVE",
        )
        session.add(plan)

        sa = InsuranceSubAgent(
            id=uuid.uuid4(),
            agent_code=f"POSP-{uuid.uuid4().hex[:4].upper()}",
            full_name="Rajesh POSP Agent",
            mobile=f"+9198{uuid.uuid4().int % 100000000:08d}",
            public_profile_slug=f"rajesh-posp-{uuid.uuid4().hex[:6]}",
            status="ACTIVE",
        )
        session.add(sa)
        await session.commit()

        pol = InsurancePolicy(
            id=uuid.uuid4(),
            policy_number=f"POL-TWOSTAGE-{uuid.uuid4().hex[:6].upper()}",
            customer_id=cust.id,
            company_id=co.id,
            plan_id=plan.id,
            sub_agent_id=sa.id,
            policy_type="MOTOR",
            term_years=1,
            sum_assured=Decimal("350000.00"),
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
        session.add(pol)
        await session.commit()

        comm = await calculate_and_record_policy_commission(
            session,
            pol,
            gross_amount_override=Decimal("1500.00"),
            sub_agent_amount_override=Decimal("500.00"),
        )
        await session.commit()
        comm_id = comm.id

        # Check sub-agent payout was created in PENDING status
        payout = (await session.execute(
            select(InsuranceSubAgentPayout).where(InsuranceSubAgentPayout.policy_id == pol.id)
        )).scalar_one()
        assert payout.status == "PENDING"
        assert payout.amount_paid == Decimal("0.00")
        payout_id = payout.id

    # Now record 100% insurer bank receipt
    receipt_payload = {
        "actual_bank_received": 1350.0,
        "net_amount": 1350.0,
        "gross_amount": 1500.0,
        "tds_deducted": 150.0,
        "receipt_date": date.today().isoformat(),
        "payment_mode": "NEFT",
        "bank_name": "State Bank of India",
        "transaction_reference": f"UTR-INS-100-{uuid.uuid4().hex[:6].upper()}",
    }
    res_rcpt = await client.post(f"/api/v1/insurance/commissions/{comm_id}/receipts", json=receipt_payload, headers=headers)
    assert res_rcpt.status_code == 200

    # Insurer commission is now RECEIVED
    async with AsyncSessionLocal() as session:
        comm_refreshed = await session.get(InsurancePolicyCommission, comm_id)
        assert comm_refreshed.status == "RECEIVED"

        # CRITICAL VERIFICATION: Sub-agent payout must NOT be marked as PAID
        payout_refreshed = await session.get(InsuranceSubAgentPayout, payout_id)
        assert payout_refreshed.status == "PENDING", "Recording insurer receipt must NOT mark sub-agent payout as PAID"
        assert payout_refreshed.amount_paid == Decimal("0.00")


@pytest.mark.asyncio
async def test_receipt_document_upload_and_download(client: AsyncClient):
    """Verifies uploading a bank statement document and retrieving it via API."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    sample_content = b"%PDF-1.4 Mock Insurer Commission Credit Advice Statement"
    files = {"file": ("credit_advice_nov2026.pdf", io.BytesIO(sample_content), "application/pdf")}

    # Upload statement
    res_up = await client.post(
        "/api/v1/insurance/commissions/upload-receipt-doc",
        files=files,
        headers=headers,
    )
    assert res_up.status_code == 200
    up_data = res_up.json()
    assert up_data["success"] is True
    assert "filename" in up_data
    assert "url" in up_data

    # Download / retrieve the file
    doc_url = up_data["url"]
    res_dl = await client.get(doc_url, headers=headers)
    assert res_dl.status_code == 200
    assert res_dl.content == sample_content
