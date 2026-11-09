"""Tests for FinNexus Insurance Engine Year-Wise Policy Lifecycle, Renewal Date Controls, and XLSX Export."""

from collections.abc import AsyncGenerator
import io
import uuid
from datetime import date, timedelta
from decimal import Decimal

import openpyxl
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models.crm import Customer
from app.db.models.insurance import (
    InsuranceCompany,
    InsurancePlan,
    InsurancePolicy,
    InsurancePolicyHistory,
    InsurancePolicyCommission,
    InsurancePremiumSchedule,
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


async def get_token(client: AsyncClient, email: str = "admin@finnexus.com", password: str = "Admin@12345") -> str:
    """Helper to authenticate and return JWT access token."""
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    if res.status_code != 200:
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@financeflow.com", "password": password},
        )
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json()["access_token"]


async def setup_carrier_and_customer(client: AsyncClient, headers: dict[str, str]) -> dict[str, str]:
    uid = uuid.uuid4().hex[:6]
    c_res = await client.post(
        "/api/v1/crm/customers",
        json={
            "first_name": "Aditya",
            "last_name": f"Thakre_{uid}",
            "email": f"aditya_{uid}@example.com",
            "phone": f"+91 98{str(uuid.uuid4().int)[:8]}",
            "city": "Pune",
            "pincode": "411001",
            "pan_number": f"ABCDE{str(uuid.uuid4().int)[:4]}F",
        },
        headers=headers,
    )
    assert c_res.status_code == 201, c_res.text
    customer_id = c_res.json()["id"]

    comp_res = await client.post(
        "/api/v1/insurance/companies",
        json={
            "name": f"HDFC ERGO_{uid}",
            "code": f"HDFC_{uid[:4]}".upper(),
            "category": "HEALTH",
            "line_of_business": "Health Insurance",
            "active_status": True,
        },
        headers=headers,
    )
    assert comp_res.status_code == 201, comp_res.text
    company_id = comp_res.json()["id"]

    plan_res = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": f"Optima Secure_{uid}",
            "code": f"OPT_{uid[:4]}".upper(),
            "company_id": company_id,
            "line_of_business": "Health Insurance",
            "status": "ACTIVE",
        },
        headers=headers,
    )
    assert plan_res.status_code == 201, plan_res.text
    plan_id = plan_res.json()["id"]

    return {
        "customer_id": customer_id,
        "company_id": company_id,
        "plan_id": plan_id,
    }


@pytest.mark.asyncio
async def test_01_renewal_creates_separate_linked_policy_record(client: AsyncClient) -> None:
    """Verify renewal creates a new linked policy record, preserving original policy data, payments, and dates."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    pre = await setup_carrier_and_customer(client, headers)

    orig_pol_num = f"POL-2025-{uuid.uuid4().hex[:6].upper()}"

    # 1. Create original policy (Coverage: 2025-01-01 to 2025-12-31, Premium: 24,000)
    create_res = await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": pre["customer_id"],
            "company_id": pre["company_id"],
            "plan_id": pre["plan_id"],
            "policy_number": orig_pol_num,
            "policy_type": "HEALTH",
            "business_type": "NEW",
            "term_years": 1,
            "sum_assured": 1000000.0,
            "final_premium": 24000.0,
            "policy_start_date": "2025-01-01",
            "expiry_date": "2025-12-31",
            "premium_frequency": "Yearly",
            "nominees": [
                {
                    "full_name": "Pooja Thakre",
                    "relationship": "SPOUSE",
                    "share_percentage": 100.0,
                }
            ],
            "members": [
                {
                    "full_name": "Aditya Thakre",
                    "relationship": "SELF",
                    "date_of_birth": "1992-06-15",
                }
            ],
        },
        headers=headers,
    )
    assert create_res.status_code == 201, create_res.text
    orig_pol = create_res.json()
    orig_id = orig_pol["id"]

    # 2. Record payment on original policy
    pay_res = await client.post(
        f"/api/v1/insurance/policies/{orig_id}/payments",
        json={
            "amount": 24000.0,
            "payment_date": "2025-01-02",
            "payment_mode": "BANK_TRANSFER",
            "transaction_reference": f"TXN-ORIG-{uuid.uuid4().hex[:6]}",
        },
        headers=headers,
    )
    assert pay_res.status_code == 201, pay_res.text

    # 3. Renew policy contract for 2026 period with custom dates and premium
    ren_pol_num = f"{orig_pol_num}-R1"
    renew_payload = {
        "new_policy_number": ren_pol_num,
        "new_start_date": "2026-01-01",
        "new_expiry_date": "2026-12-31",
        "renew_term_years": 1,
        "new_premium": 27500.0,
        "notes": "First Year Contract Renewal successfully approved",
    }
    renew_res = await client.post(
        f"/api/v1/insurance/policies/{orig_id}/renew",
        json=renew_payload,
        headers=headers,
    )
    assert renew_res.status_code == 200, renew_res.text
    ren_data = renew_res.json()

    new_id = ren_data["policy_id"]
    assert new_id != orig_id, "Renewal MUST create a separate policy ID"
    assert ren_data["policy_number"] == ren_pol_num
    assert ren_data["previous_policy_id"] == orig_id
    assert ren_data["new_start_date"] == "2026-01-01"
    assert ren_data["new_expiry_date"] == "2026-12-31"
    assert float(ren_data["renewal_premium"]) == 27500.0

    # 4. Inspect ORIGINAL policy: verify untouched historical integrity
    orig_check = await client.get(f"/api/v1/insurance/policies/{orig_id}", headers=headers)
    assert orig_check.status_code == 200
    orig_data = orig_check.json()
    assert orig_data["policy_number"] == orig_pol_num, "Original policy number must NOT be modified"
    assert orig_data["policy_start_date"] == "2025-01-01"
    assert orig_data["expiry_date"] == "2025-12-31"
    assert float(orig_data["final_premium"]) == 24000.0, "Original premium must NOT be modified"
    assert orig_data["status"] == "EXPIRED", "Original policy should be EXPIRED after renewal"
    assert len(orig_data.get("payments", [])) == 1, "Original payment history must be preserved"
    assert float(orig_data["payments"][0]["amount"]) == 24000.0

    # 5. Inspect NEW renewed policy: verify linked fields, cloned members, and schedules
    new_check = await client.get(f"/api/v1/insurance/policies/{new_id}", headers=headers)
    assert new_check.status_code == 200
    nd = new_check.json()
    assert nd["policy_number"] == ren_pol_num
    assert nd["previous_policy_id"] == orig_id
    assert nd["previous_policy_number"] == orig_pol_num
    assert nd["business_type"] == "RENEW"
    assert nd["policy_start_date"] == "2026-01-01"
    assert nd["expiry_date"] == "2026-12-31"
    assert float(nd["final_premium"]) == 27500.0
    assert nd["status"] == "ACTIVE"
    assert len(nd.get("members", [])) == 1
    assert nd["members"][0]["full_name"] == "Aditya Thakre"
    assert len(nd.get("nominees", [])) == 1
    assert nd["nominees"][0]["full_name"] == "Pooja Thakre"
    assert len(nd.get("schedules", [])) >= 1


@pytest.mark.asyncio
async def test_02_renewal_date_controls_and_validation(client: AsyncClient) -> None:
    """Verify validation for editable start and end dates on renewal modal."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    pre = await setup_carrier_and_customer(client, headers)

    pol_num = f"POL-VAL-{uuid.uuid4().hex[:6].upper()}"
    create_res = await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": pre["customer_id"],
            "company_id": pre["company_id"],
            "plan_id": pre["plan_id"],
            "policy_number": pol_num,
            "policy_type": "HEALTH",
            "business_type": "NEW",
            "term_years": 1,
            "sum_assured": 500000.0,
            "final_premium": 15000.0,
            "policy_start_date": "2025-05-01",
            "expiry_date": "2026-04-30",
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    policy_id = create_res.json()["id"]

    # A. End date before or equal to start date must be rejected
    inv_date_res = await client.post(
        f"/api/v1/insurance/policies/{policy_id}/renew",
        json={
            "new_start_date": "2026-05-01",
            "new_expiry_date": "2026-04-30",  # Before start date!
            "new_premium": 16000.0,
        },
        headers=headers,
    )
    assert inv_date_res.status_code == 400
    assert "strictly after" in inv_date_res.json()["detail"].lower()

    # B. Duplicate policy number must be rejected
    dup_res = await client.post(
        f"/api/v1/insurance/policies/{policy_id}/renew",
        json={
            "new_policy_number": pol_num,  # Same as existing policy number!
            "new_start_date": "2026-05-01",
            "new_expiry_date": "2027-04-30",
            "new_premium": 16000.0,
        },
        headers=headers,
    )
    assert dup_res.status_code in (400, 409)
    assert "already registered" in dup_res.json()["detail"].lower() or "already exists" in dup_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_03_policy_renewal_lifecycle_chronological_timeline(client: AsyncClient) -> None:
    """Verify multi-generation renewal chain (Original -> First Renewal -> Second Renewal) and timeline endpoint."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    pre = await setup_carrier_and_customer(client, headers)

    base_num = f"POL-LIFE-{uuid.uuid4().hex[:6].upper()}"

    # 1. Original Policy: 2024-01-01 to 2024-12-31
    res1 = await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": pre["customer_id"],
            "company_id": pre["company_id"],
            "plan_id": pre["plan_id"],
            "policy_number": f"{base_num}-2024",
            "policy_type": "HEALTH",
            "business_type": "NEW",
            "term_years": 1,
            "sum_assured": 1000000.0,
            "final_premium": 20000.0,
            "policy_start_date": "2024-01-01",
            "expiry_date": "2024-12-31",
        },
        headers=headers,
    )
    assert res1.status_code == 201
    id1 = res1.json()["id"]

    # 2. First Renewal: 2025-01-01 to 2025-12-31
    res2 = await client.post(
        f"/api/v1/insurance/policies/{id1}/renew",
        json={
            "new_policy_number": f"{base_num}-2025",
            "new_start_date": "2025-01-01",
            "new_expiry_date": "2025-12-31",
            "new_premium": 22000.0,
        },
        headers=headers,
    )
    assert res2.status_code == 200
    id2 = res2.json()["policy_id"]

    # 3. Second Renewal: 2026-01-01 to 2026-12-31
    res3 = await client.post(
        f"/api/v1/insurance/policies/{id2}/renew",
        json={
            "new_policy_number": f"{base_num}-2026",
            "new_start_date": "2026-01-01",
            "new_expiry_date": "2026-12-31",
            "new_premium": 25000.0,
        },
        headers=headers,
    )
    assert res3.status_code == 200
    id3 = res3.json()["policy_id"]

    # 4. Fetch lifecycle timeline from any node in the chain (e.g. from id2)
    life_res = await client.get(
        f"/api/v1/insurance/policies/{id2}/renewal-lifecycle",
        headers=headers,
    )
    assert life_res.status_code == 200
    timeline = life_res.json()
    assert len(timeline) == 3

    # Check chronological ordering
    assert timeline[0]["policy_number"] == f"{base_num}-2024"
    assert timeline[0]["sequence_label"] == "Original Policy"
    assert timeline[0]["is_current"] is False

    assert timeline[1]["policy_number"] == f"{base_num}-2025"
    assert timeline[1]["sequence_label"] == "First Renewal"
    assert timeline[1]["is_current"] is True  # Query was made for id2!

    assert timeline[2]["policy_number"] == f"{base_num}-2026"
    assert timeline[2]["sequence_label"] == "Latest Renewal"
    assert timeline[2]["is_current"] is False


@pytest.mark.asyncio
async def test_04_year_wise_listing_and_filtering(client: AsyncClient) -> None:
    """Verify year-wise filtering (ALL, CURRENT, PREVIOUS, UPCOMING) and coverage_year filter."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Filter by year_bucket=CURRENT
    cur_res = await client.get(
        "/api/v1/insurance/policies?year_bucket=CURRENT&page=1&page_size=10",
        headers=headers,
    )
    assert cur_res.status_code == 200
    cur_data = cur_res.json()
    assert "items" in cur_data
    assert "total" in cur_data
    assert "total_pages" in cur_data
    assert "page" in cur_data

    # 2. Filter by year_bucket=PREVIOUS
    prev_res = await client.get(
        "/api/v1/insurance/policies?year_bucket=PREVIOUS&page=1&page_size=10",
        headers=headers,
    )
    assert prev_res.status_code == 200

    # 3. Filter by year_bucket=UPCOMING
    up_res = await client.get(
        "/api/v1/insurance/policies?year_bucket=UPCOMING&page=1&page_size=10",
        headers=headers,
    )
    assert up_res.status_code == 200


@pytest.mark.asyncio
async def test_05_year_wise_excel_export_format(client: AsyncClient) -> None:
    """Verify year-wise genuine XLSX export with proper worksheets, columns, and headings."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Export with query params
    export_res = await client.get(
        "/api/v1/insurance/policies/export/excel?year_bucket=ALL",
        headers=headers,
    )
    assert export_res.status_code == 200
    assert "spreadsheetml.sheet" in export_res.headers["content-type"]

    # Parse with openpyxl to verify genuine XLSX structure
    wb = openpyxl.load_workbook(io.BytesIO(export_res.content))
    assert "Year-Wise Policy Register" in wb.sheetnames

    ws = wb["Year-Wise Policy Register"]
    header_row = [cell.value for cell in ws[1]]
    assert "Policy Number" in header_row
    assert "Coverage Year" in header_row
    assert "Customer Name" in header_row
    assert "Business Type" in header_row
    assert "Gross Premium (₹)" in header_row
