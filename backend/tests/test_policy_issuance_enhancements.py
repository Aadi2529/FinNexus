"""End-to-end backend tests for Advanced Policy Issuance Form Enhancements.

Tests:
1. Family Floater rejection with HTTP 422 when coverage_type='FAMILY_FLOATER' and members < 2.
2. Family Floater success with 2+ members.
3. Multi-Year policy contract persistence and detail retrieval.
4. Customer lookup data returning city, pincode, state, and address.
5. Payment proof document upload and linkage to payment record.
"""

from __future__ import annotations

import io
import uuid
from collections.abc import AsyncGenerator
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models.crm import Customer
from app.db.models.insurance import (
    InsuranceCompany,
    InsurancePlan,
    InsurancePolicy,
    InsurancePolicyYear,
    InsurancePolicyPayment,
    InsurancePolicyDocument,
)
from app.db.seed import seed_initial_data
from app.db.session import Base, get_db_session
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="function")
async def test_session() -> AsyncGenerator[AsyncSession, None]:
    """Create in-memory SQLite database initialized with core platform and insurance tables."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with session_maker() as session:
        await seed_initial_data(session, include_demo_data=True)

    async with session_maker() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def client(test_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provide AsyncClient with overridden database session."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield test_session

    app.dependency_overrides[get_db_session] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


async def get_token(client: AsyncClient, email: str = "admin@financeflow.com", password: str = "Admin@12345") -> str:
    """Helper to authenticate and return JWT access token."""
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_01_family_floater_validation_rejection(client: AsyncClient) -> None:
    """Verify backend rejects FAMILY_FLOATER policy with < 2 members with HTTP 422."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create customer
    c_res = await client.post(
        "/api/v1/insurance/customers",
        headers=headers,
        json={
            "first_name": "Floater",
            "last_name": "Applicant",
            "phone": "9811122233",
            "email": "floater.app@example.com",
            "customer_type": "INDIVIDUAL",
        },
    )
    assert c_res.status_code == 201
    cust_id = c_res.json()["id"]

    # 2. Create company & plan
    comp_res = await client.post(
        "/api/v1/insurance/companies",
        headers=headers,
        json={"name": "HDFC ERGO General", "code": f"HEG_{uuid.uuid4().hex[:6].upper()}", "category": "HEALTH"},
    )
    assert comp_res.status_code == 201
    comp_id = comp_res.json()["id"]

    plan_res = await client.post(
        "/api/v1/insurance/plans",
        headers=headers,
        json={
            "company_id": comp_id,
            "name": "Optima Secure Floater",
            "code": f"OPT_{uuid.uuid4().hex[:6].upper()}",
            "policy_type": "HEALTH",
            "min_sum_assured": 500000,
            "max_sum_assured": 5000000,
        },
    )
    assert plan_res.status_code == 201
    plan_id = plan_res.json()["id"]

    # 3. Attempt policy with FAMILY_FLOATER but only 1 member
    pol_num_single = f"FF-FAIL-{uuid.uuid4().hex[:6].upper()}"
    fail_res = await client.post(
        "/api/v1/insurance/policies",
        headers=headers,
        json={
            "customer_id": cust_id,
            "company_id": comp_id,
            "plan_id": plan_id,
            "policy_number": pol_num_single,
            "policy_type": "HEALTH",
            "coverage_type": "FAMILY_FLOATER",
            "sum_assured": 1000000,
            "net_premium": 15000,
            "gross_premium": 17700,
            "final_premium": 17700,
            "start_date": str(date.today()),
            "members": [
                {
                    "customer_id": cust_id,
                    "full_name": "Floater Applicant",
                    "relationship": "Self",
                    "gender": "MALE",
                }
            ],
        },
    )
    assert fail_res.status_code == 422, f"Expected 422 but got {fail_res.status_code}: {fail_res.text}"
    assert "Family Floater" in str(fail_res.json()["detail"])


@pytest.mark.asyncio
async def test_02_family_floater_success_with_two_members(client: AsyncClient) -> None:
    """Verify backend accepts FAMILY_FLOATER policy with >= 2 members."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create customer
    c_res = await client.post(
        "/api/v1/insurance/customers",
        headers=headers,
        json={
            "first_name": "Priya",
            "last_name": "Sharma",
            "phone": "9822233344",
            "email": "priya.sharma@example.com",
            "customer_type": "INDIVIDUAL",
        },
    )
    cust_id = c_res.json()["id"]

    # Create company & plan
    comp_res = await client.post(
        "/api/v1/insurance/companies",
        headers=headers,
        json={"name": "Star Health", "code": f"STAR_{uuid.uuid4().hex[:6].upper()}", "category": "HEALTH"},
    )
    comp_id = comp_res.json()["id"]

    plan_res = await client.post(
        "/api/v1/insurance/plans",
        headers=headers,
        json={
            "company_id": comp_id,
            "name": "Family Health Optima",
            "code": f"FHO_{uuid.uuid4().hex[:6].upper()}",
            "policy_type": "HEALTH",
            "min_sum_assured": 500000,
            "max_sum_assured": 5000000,
        },
    )
    plan_id = plan_res.json()["id"]

    pol_num_success = f"FF-PASS-{uuid.uuid4().hex[:6].upper()}"
    pass_res = await client.post(
        "/api/v1/insurance/policies",
        headers=headers,
        json={
            "customer_id": cust_id,
            "company_id": comp_id,
            "plan_id": plan_id,
            "policy_number": pol_num_success,
            "policy_type": "HEALTH",
            "coverage_type": "FAMILY_FLOATER",
            "sum_assured": 1500000,
            "net_premium": 20000,
            "gross_premium": 23600,
            "final_premium": 23600,
            "start_date": str(date.today()),
            "members": [
                {
                    "customer_id": cust_id,
                    "full_name": "Priya Sharma",
                    "relationship": "Self",
                    "gender": "FEMALE",
                },
                {
                    "full_name": "Amit Sharma",
                    "relationship": "Spouse",
                    "gender": "MALE",
                },
            ],
        },
    )
    assert pass_res.status_code == 201, pass_res.text
    body = pass_res.json()
    assert body["coverage_type"] == "FAMILY_FLOATER"
    assert len(body["members"]) == 2


@pytest.mark.asyncio
async def test_03_multi_year_policy_data_persistence_and_detail(client: AsyncClient) -> None:
    """Verify multi-year policy contract details are validated and saved into insurance_policy_years."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create customer
    c_res = await client.post(
        "/api/v1/insurance/customers",
        headers=headers,
        json={"first_name": "Multi", "last_name": "Year", "phone": "9833344455", "customer_type": "INDIVIDUAL"},
    )
    cust_id = c_res.json()["id"]

    # 2. Company & Plan
    comp_res = await client.post(
        "/api/v1/insurance/companies",
        headers=headers,
        json={"name": "Care Health", "code": f"CARE_{uuid.uuid4().hex[:6].upper()}", "category": "HEALTH"},
    )
    comp_id = comp_res.json()["id"]

    plan_res = await client.post(
        "/api/v1/insurance/plans",
        headers=headers,
        json={"company_id": comp_id, "name": "Care Supreme Multi", "code": f"CSM_{uuid.uuid4().hex[:6].upper()}", "policy_type": "HEALTH", "min_sum_assured": 500000, "max_sum_assured": 5000000},
    )
    plan_id = plan_res.json()["id"]

    # 3. Issue policy with 3 distinct policy years
    base_num = f"MY-{uuid.uuid4().hex[:6].upper()}"
    p_yr1 = f"{base_num}-YR1"
    p_yr2 = f"{base_num}-YR2"
    p_yr3 = f"{base_num}-YR3"

    today = date.today()
    yr1_start = today
    yr1_end = today + timedelta(days=364)
    yr2_start = yr1_end + timedelta(days=1)
    yr2_end = yr2_start + timedelta(days=364)
    yr3_start = yr2_end + timedelta(days=1)
    yr3_end = yr3_start + timedelta(days=364)

    policy_payload = {
        "customer_id": cust_id,
        "company_id": comp_id,
        "plan_id": plan_id,
        "policy_number": p_yr1,
        "policy_type": "HEALTH",
        "coverage_type": "INDIVIDUAL",
        "sum_assured": 1000000,
        "net_premium": 10000,
        "gross_premium": 11800,
        "final_premium": 11800,
        "start_date": str(yr1_start),
        "expiry_date": str(yr1_end),
        "members": [{"customer_id": cust_id, "full_name": "Multi Year Customer", "relationship": "Self"}],
        "policy_years": [
            {
                "policy_year": 1,
                "policy_number": p_yr1,
                "business_type": "NEW",
                "start_date": str(yr1_start),
                "end_date": str(yr1_end),
                "net_premium": 10000,
                "gross_premium": 11800,
                "remarks": "Year 1 inception",
            },
            {
                "policy_year": 2,
                "policy_number": p_yr2,
                "business_type": "RENEWAL",
                "prior_policy_number": p_yr1,
                "start_date": str(yr2_start),
                "end_date": str(yr2_end),
                "net_premium": 10500,
                "gross_premium": 12390,
                "remarks": "Year 2 lock-in",
            },
            {
                "policy_year": 3,
                "policy_number": p_yr3,
                "business_type": "RENEWAL",
                "prior_policy_number": p_yr2,
                "start_date": str(yr3_start),
                "end_date": str(yr3_end),
                "net_premium": 11000,
                "gross_premium": 12980,
                "remarks": "Year 3 lock-in",
            },
        ],
    }

    create_res = await client.post(
        "/api/v1/insurance/policies",
        headers=headers,
        json=policy_payload,
    )
    assert create_res.status_code == 201, create_res.text
    created = create_res.json()
    assert len(created["policy_years"]) == 3
    assert created["policy_years"][0]["policy_number"] == p_yr1
    assert created["policy_years"][1]["policy_number"] == p_yr2
    assert created["policy_years"][2]["policy_number"] == p_yr3

    # Check detail endpoint returns them
    detail_res = await client.get(
        f"/api/v1/insurance/policies/{created['id']}",
        headers=headers,
    )
    assert detail_res.status_code == 200, detail_res.text
    detail = detail_res.json()
    assert len(detail["policy_years"]) == 3


@pytest.mark.asyncio
async def test_04_customer_lookup_data_contains_city_and_pincode(client: AsyncClient) -> None:
    """Verify customer lookup data includes city, state, pincode, and address."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create customer with city and pincode
    phone = f"98{uuid.uuid4().hex[:8]}"[:10]
    c_res = await client.post(
        "/api/v1/insurance/customers",
        headers=headers,
        json={
            "first_name": "Aditya",
            "last_name": "Thakre",
            "phone": phone,
            "city": "Nagpur",
            "state": "Maharashtra",
            "pincode": "440010",
            "address": "Civil Lines",
            "customer_type": "INDIVIDUAL",
        },
    )
    assert c_res.status_code == 201, c_res.text
    cust_id = c_res.json()["id"]

    # Fetch lookup data from /policies/lookup-data
    lookup_res = await client.get("/api/v1/insurance/policies/lookup-data", headers=headers)
    assert lookup_res.status_code == 200, lookup_res.text
    data = lookup_res.json()

    matched = [c for c in data["customers"] if str(c["id"]) == str(cust_id)]
    assert len(matched) == 1
    found = matched[0]
    assert found["city"] == "Nagpur"
    assert found["pincode"] == "440010"
    assert found["state"] == "Maharashtra"
    assert found["address"] == "Civil Lines"


@pytest.mark.asyncio
async def test_05_payment_proof_linkage_to_policy_payment(client: AsyncClient) -> None:
    """Verify document upload with document_type='PREMIUM_RECEIPT' links to payment record."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create customer
    c_res = await client.post(
        "/api/v1/insurance/customers",
        headers=headers,
        json={"first_name": "Proof", "last_name": "Tester", "phone": "9844455566"},
    )
    cust_id = c_res.json()["id"]

    # Create company & plan
    comp_res = await client.post(
        "/api/v1/insurance/companies",
        headers=headers,
        json={"name": "ICICI Lombard", "code": f"ICL_{uuid.uuid4().hex[:6].upper()}", "category": "HEALTH"},
    )
    comp_id = comp_res.json()["id"]

    plan_res = await client.post(
        "/api/v1/insurance/plans",
        headers=headers,
        json={"company_id": comp_id, "name": "Health Shield", "code": f"HS_{uuid.uuid4().hex[:6].upper()}", "policy_type": "HEALTH", "min_sum_assured": 500000, "max_sum_assured": 5000000},
    )
    plan_id = plan_res.json()["id"]

    # Issue policy with initial payment
    pol_res = await client.post(
        "/api/v1/insurance/policies",
        headers=headers,
        json={
            "customer_id": cust_id,
            "company_id": comp_id,
            "plan_id": plan_id,
            "policy_number": f"PROOF-{uuid.uuid4().hex[:6].upper()}",
            "policy_type": "HEALTH",
            "coverage_type": "INDIVIDUAL",
            "sum_assured": 1000000,
            "net_premium": 12000,
            "gross_premium": 14160,
            "final_premium": 14160,
            "start_date": str(date.today()),
            "members": [{"customer_id": cust_id, "full_name": "Proof Tester", "relationship": "Self"}],
            "initial_payment": {
                "payment_mode": "ONLINE",
                "bank_name": "HDFC Bank",
                "transaction_reference": f"TXN-{uuid.uuid4().hex[:8].upper()}",
                "amount": 14160,
                "payment_date": str(date.today()),
            },
        },
    )
    assert pol_res.status_code == 201, pol_res.text
    pol_id = pol_res.json()["id"]

    # Upload payment proof document
    fake_pdf = b"%PDF-1.4 Fake Payment Receipt Content for testing"
    files = {"file": ("payment_receipt_chq.pdf", fake_pdf, "application/pdf")}
    data = {
        "title": "First Installment Payment Proof",
        "document_type": "PREMIUM_RECEIPT",
        "description": "Proof of payment receipt",
    }
    upload_res = await client.post(
        f"/api/v1/insurance/policies/{pol_id}/documents",
        headers=headers,
        data=data,
        files=files,
    )
    assert upload_res.status_code == 201, upload_res.text
    doc_id = upload_res.json()["id"]

    # Verify policy payments now shows document_id and document_filename
    pmts_res = await client.get(
        f"/api/v1/insurance/policies/{pol_id}/payments",
        headers=headers,
    )
    assert pmts_res.status_code == 200, pmts_res.text
    pmts = pmts_res.json()
    assert len(pmts) == 1
    assert str(pmts[0]["document_id"]) == str(doc_id)
    assert pmts[0]["document_filename"] == "payment_receipt_chq.pdf"
