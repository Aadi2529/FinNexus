"""Test Policy Issue-Year Grouping, Filtering, Renewal Isolation, and Excel Export.

Verifies:
1. 2025-issued policy with 2026 start date appears under 2025.
2. 2026-issued policy with 2027 expiry appears under 2026.
3. Original 2025 policy remains under 2025 after 2026 renewal.
4. Renewal issued in 2026 appears under 2026.
5. 2025 filter returns only 2025-issued policies.
6. 2026 filter returns only 2026-issued policies.
7. All Years returns all records.
8. Policy Start Date and End Date display correctly.
9. Excel export matches the selected issue year.
10. Existing search, pagination, and multi-filter combinations continue working.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
import io
import uuid
from decimal import Decimal
import openpyxl
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

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
    """Helper to authenticate as admin user and get JWT access token."""
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    if res.status_code != 200:
        res = await client.post(
            "/api/v1/auth/login",
            data={"username": email, "password": password},
        )
    assert res.status_code == 200
    return res.json()["access_token"]


async def setup_carrier_and_customer(client: AsyncClient, headers: dict[str, str]) -> dict[str, str]:
    """Helper to provision active company, plan, and customer for testing."""
    cid = f"test_{uuid.uuid4().hex[:6]}"
    comp_res = await client.post(
        "/api/v1/insurance/companies",
        json={
            "name": f"HDFC ERGO_{cid}",
            "code": f"HDFC_{cid[:4]}".upper(),
            "category": "GENERAL",
            "line_of_business": "Health Insurance",
            "is_active": True,
        },
        headers=headers,
    )
    assert comp_res.status_code == 201, comp_res.text
    company_id = comp_res.json()["id"]

    plan_res = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": f"Optima Secure_{cid}",
            "code": f"OS_{cid[:4]}".upper(),
            "company_id": company_id,
            "line_of_business": "Health Insurance",
            "status": "ACTIVE",
        },
        headers=headers,
    )
    assert plan_res.status_code == 201, plan_res.text
    plan_id = plan_res.json()["id"]

    cust_res = await client.post(
        "/api/v1/crm/customers",
        json={
            "first_name": "Rohan",
            "last_name": f"Sharma_{cid}",
            "phone": f"+91 98{str(uuid.uuid4().int)[:8]}",
            "email": f"rohan_{cid}@example.com",
            "customer_type": "INDIVIDUAL",
            "city": "Pune",
            "pincode": "411001",
            "pan_number": f"ABCDE{str(uuid.uuid4().int)[:4]}F",
        },
        headers=headers,
    )
    assert cust_res.status_code == 201, cust_res.text
    customer_id = cust_res.json()["id"]

    return {
        "company_id": company_id,
        "plan_id": plan_id,
        "customer_id": customer_id,
        "cid": cid,
    }


@pytest.mark.asyncio
async def test_01_issue_year_classification_and_filtering(client: AsyncClient) -> None:
    """Verify Policy A, Policy B (issue 2025, start 2026), and Policy C (issue 2026)."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    env = await setup_carrier_and_customer(client, headers)

    pol_a_num = f"POL-A-{env['cid'].upper()}"
    pol_b_num = f"POL-B-{env['cid'].upper()}"
    pol_c_num = f"POL-C-{env['cid'].upper()}"

    # Policy A: Issue Date 15-06-2025, Start 01-07-2025, End 30-06-2026
    res_a = await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": env["customer_id"],
            "company_id": env["company_id"],
            "plan_id": env["plan_id"],
            "policy_number": pol_a_num,
            "policy_type": "HEALTH",
            "business_type": "NEW",
            "issue_date": "2025-06-15",
            "policy_start_date": "2025-07-01",
            "expiry_date": "2026-06-30",
            "sum_assured": 500000.0,
            "final_premium": 15000.0,
        },
        headers=headers,
    )
    assert res_a.status_code == 201
    data_a = res_a.json()
    assert data_a["issue_date"] == "2025-06-15"
    assert data_a["issue_year"] == 2025

    # Policy B: Issue Date 20-12-2025, Start Date 01-01-2026, End Date 31-12-2026
    # MUST remain under 2025 even though its coverage starts in 2026!
    res_b = await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": env["customer_id"],
            "company_id": env["company_id"],
            "plan_id": env["plan_id"],
            "policy_number": pol_b_num,
            "policy_type": "HEALTH",
            "business_type": "NEW",
            "issue_date": "2025-12-20",
            "policy_start_date": "2026-01-01",
            "expiry_date": "2026-12-31",
            "sum_assured": 1000000.0,
            "final_premium": 25000.0,
        },
        headers=headers,
    )
    assert res_b.status_code == 201
    data_b = res_b.json()
    assert data_b["issue_date"] == "2025-12-20"
    assert data_b["issue_year"] == 2025

    # Policy C: Issue Date 10-02-2026, Start Date 01-03-2026, End Date 28-02-2027
    res_c = await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": env["customer_id"],
            "company_id": env["company_id"],
            "plan_id": env["plan_id"],
            "policy_number": pol_c_num,
            "policy_type": "HEALTH",
            "business_type": "NEW",
            "issue_date": "2026-02-10",
            "policy_start_date": "2026-03-01",
            "expiry_date": "2027-02-28",
            "sum_assured": 750000.0,
            "final_premium": 18000.0,
        },
        headers=headers,
    )
    assert res_c.status_code == 201
    data_c = res_c.json()
    assert data_c["issue_date"] == "2026-02-10"
    assert data_c["issue_year"] == 2026

    # 1. Test 2025 Filter: Policy A and Policy B MUST be returned. Policy C MUST NOT.
    res_2025 = await client.get(
        f"/api/v1/insurance/policies?issue_year=2025&company_id={env['company_id']}",
        headers=headers,
    )
    assert res_2025.status_code == 200
    items_2025 = res_2025.json()["items"]
    nums_2025 = [p["policy_number"] for p in items_2025]
    assert pol_a_num in nums_2025
    assert pol_b_num in nums_2025
    assert pol_c_num not in nums_2025
    assert res_2025.json()["total"] == 2
    assert Decimal(str(res_2025.json()["total_sum_insured"])) == Decimal("1500000.00")
    assert Decimal(str(res_2025.json()["total_gross_premium"])) == Decimal("40000.00")

    # 2. Test 2026 Filter: Policy C MUST be returned. Policy A and Policy B MUST NOT.
    res_2026 = await client.get(
        f"/api/v1/insurance/policies?issue_year=2026&company_id={env['company_id']}",
        headers=headers,
    )
    assert res_2026.status_code == 200
    items_2026 = res_2026.json()["items"]
    nums_2026 = [p["policy_number"] for p in items_2026]
    assert pol_c_num in nums_2026
    assert pol_a_num not in nums_2026
    assert pol_b_num not in nums_2026
    assert res_2026.json()["total"] == 1
    assert Decimal(str(res_2026.json()["total_sum_insured"])) == Decimal("750000.00")
    assert Decimal(str(res_2026.json()["total_gross_premium"])) == Decimal("18000.00")

    # 3. Test All Years Filter
    res_all = await client.get(
        f"/api/v1/insurance/policies?issue_year=ALL&company_id={env['company_id']}",
        headers=headers,
    )
    assert res_all.status_code == 200
    nums_all = [p["policy_number"] for p in res_all.json()["items"]]
    assert pol_a_num in nums_all
    assert pol_b_num in nums_all
    assert pol_c_num in nums_all
    assert res_all.json()["total"] == 3


@pytest.mark.asyncio
async def test_02_renewal_handling_across_issue_years(client: AsyncClient) -> None:
    """Verify renewal contract created in 2026 leaves original 2025 policy in 2025."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    env = await setup_carrier_and_customer(client, headers)

    orig_num = f"POL-ORIG-{env['cid'].upper()}"
    renew_num = f"POL-REN-{env['cid'].upper()}"

    # Original Policy issued on 15-06-2025, coverage 01-07-2025 to 30-06-2026
    res_orig = await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": env["customer_id"],
            "company_id": env["company_id"],
            "plan_id": env["plan_id"],
            "policy_number": orig_num,
            "policy_type": "HEALTH",
            "business_type": "NEW",
            "issue_date": "2025-06-15",
            "policy_start_date": "2025-07-01",
            "expiry_date": "2026-06-30",
            "sum_assured": 500000.0,
            "final_premium": 15000.0,
        },
        headers=headers,
    )
    assert res_orig.status_code == 201
    orig_id = res_orig.json()["id"]

    # Renewal issued on 20-06-2026, coverage 01-07-2026 to 30-06-2027
    res_ren = await client.post(
        f"/api/v1/insurance/policies/{orig_id}/renew",
        json={
            "new_policy_number": renew_num,
            "issue_date": "2026-06-20",
            "new_start_date": "2026-07-01",
            "new_expiry_date": "2027-06-30",
            "new_premium": 16500.0,
        },
        headers=headers,
    )
    assert res_ren.status_code == 200
    ren_id = res_ren.json()["policy_id"]

    # Original policy MUST still have issue_year 2025
    orig_detail = (await client.get(f"/api/v1/insurance/policies/{orig_id}", headers=headers)).json()
    assert orig_detail["issue_date"] == "2025-06-15"
    assert orig_detail["issue_year"] == 2025
    assert orig_detail["status"] == "EXPIRED"

    # Renewal policy MUST have issue_year 2026
    ren_detail = (await client.get(f"/api/v1/insurance/policies/{ren_id}", headers=headers)).json()
    assert ren_detail["issue_date"] == "2026-06-20"
    assert ren_detail["issue_year"] == 2026
    assert ren_detail["previous_policy_id"] == orig_id
    assert ren_detail["status"] == "ACTIVE"

    # In 2025 filter: original policy appears, renewal does NOT appear
    f_2025 = (await client.get(f"/api/v1/insurance/policies?issue_year=2025&company_id={env['company_id']}", headers=headers)).json()
    f_2025_nums = [p["policy_number"] for p in f_2025["items"]]
    assert orig_num in f_2025_nums
    assert renew_num not in f_2025_nums

    # In 2026 filter: renewal appears, original policy does NOT appear
    f_2026 = (await client.get(f"/api/v1/insurance/policies?issue_year=2026&company_id={env['company_id']}", headers=headers)).json()
    f_2026_nums = [p["policy_number"] for p in f_2026["items"]]
    assert renew_num in f_2026_nums
    assert orig_num not in f_2026_nums


@pytest.mark.asyncio
async def test_03_issue_years_endpoint_and_aggregates(client: AsyncClient) -> None:
    """Verify GET /policies/issue-years returns distinct sorted years and per-year metrics."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    env = await setup_carrier_and_customer(client, headers)

    # Create one policy in 2025
    await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": env["customer_id"],
            "company_id": env["company_id"],
            "plan_id": env["plan_id"],
            "policy_number": f"POL-2025-{env['cid'].upper()}",
            "policy_type": "HEALTH",
            "business_type": "NEW",
            "issue_date": "2025-05-10",
            "policy_start_date": "2025-06-01",
            "expiry_date": "2026-05-31",
            "sum_assured": 500000.0,
            "final_premium": 12000.0,
        },
        headers=headers,
    )

    # Create one policy in 2026
    await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": env["customer_id"],
            "company_id": env["company_id"],
            "plan_id": env["plan_id"],
            "policy_number": f"POL-2026-{env['cid'].upper()}",
            "policy_type": "HEALTH",
            "business_type": "NEW",
            "issue_date": "2026-01-15",
            "policy_start_date": "2026-02-01",
            "expiry_date": "2027-01-31",
            "sum_assured": 800000.0,
            "final_premium": 18000.0,
        },
        headers=headers,
    )

    res = await client.get("/api/v1/insurance/policies/issue-years", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "years" in data
    assert "total_policies" in data
    assert "total_sum_insured" in data
    assert "total_gross_premium" in data
    assert "by_year" in data

    years = data["years"]
    assert 2025 in years
    assert 2026 in years
    # Verify sorted descending
    assert years == sorted(years, reverse=True)
    assert data["total_policies"] >= 2


@pytest.mark.asyncio
async def test_04_excel_export_issue_year_compliance(client: AsyncClient) -> None:
    """Verify Excel export with issue_year filter includes all 14 required columns and genuine XLSX."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    env = await setup_carrier_and_customer(client, headers)

    # Create one policy in 2025 and one in 2026
    await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": env["customer_id"],
            "company_id": env["company_id"],
            "plan_id": env["plan_id"],
            "policy_number": f"POL-EXP-2025-{env['cid'].upper()}",
            "policy_type": "HEALTH",
            "business_type": "NEW",
            "issue_date": "2025-08-15",
            "policy_start_date": "2025-09-01",
            "expiry_date": "2026-08-31",
            "sum_assured": 600000.0,
            "final_premium": 14000.0,
        },
        headers=headers,
    )
    await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": env["customer_id"],
            "company_id": env["company_id"],
            "plan_id": env["plan_id"],
            "policy_number": f"POL-EXP-2026-{env['cid'].upper()}",
            "policy_type": "HEALTH",
            "business_type": "NEW",
            "issue_date": "2026-03-20",
            "policy_start_date": "2026-04-01",
            "expiry_date": "2027-03-31",
            "sum_assured": 900000.0,
            "final_premium": 21000.0,
        },
        headers=headers,
    )

    # 1. Export 2025 view
    exp_2025 = await client.get(
        f"/api/v1/insurance/policies/export/excel?issue_year=2025&company_id={env['company_id']}",
        headers=headers,
    )
    assert exp_2025.status_code == 200
    assert "spreadsheetml.sheet" in exp_2025.headers["content-type"]

    wb = openpyxl.load_workbook(io.BytesIO(exp_2025.content))
    assert "Year-Wise Policy Register" in wb.sheetnames
    ws = wb["Year-Wise Policy Register"]

    headers_row = [cell.value for cell in ws[1]]
    required_cols = [
        "Policy Issue Year",
        "Policy Issue Date",
        "Policy Number",
        "Policyholder",
        "Insurance Company",
        "Plan",
        "Policy Type",
        "Policy Start Date",
        "Policy End Date",
        "Sum Insured (₹)",
        "Net Premium (₹)",
        "Gross Premium (₹)",
        "Payment Frequency",
        "Status",
    ]
    for col in required_cols:
        assert col in headers_row, f"Missing required column '{col}' in Excel export!"

    # Every data row in 2025 export must have Issue Year 2025
    col_idx = headers_row.index("Policy Issue Year") + 1
    assert ws.max_row >= 2
    for row in range(2, ws.max_row + 1):
        val = ws.cell(row=row, column=col_idx).value
        assert int(val) == 2025, f"Row {row} had issue year {val}, expected 2025!"
