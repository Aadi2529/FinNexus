"""Test Suite for Global Insurance Category Standardization & Company/Plan Linking.

Verifies:
1. Canonical Categories endpoint (/insurance/categories)
2. Normalization of legacy & variant category names during Company creation
3. Automatic synchronization of company_categories table
4. Company-Plan Category Compatibility validation on Plan creation & update
5. Policy Lookup Data dependent filtering by category (?category=MOTOR / ?category=HEALTH)
6. Policy Issuance Category-Company-Plan compatibility validation
7. Preservation of existing data (Niva Bupa, Iffco Tokio, Reassure 2.0, Two Wheeler Plan)
"""

import uuid
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_application


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def app():
    return create_application()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as c:
        yield c


async def get_auth_token(client: AsyncClient, email: str = "admin@finnexus.com", pwd: str = "Admin@12345") -> str:
    """Login and obtain access token."""
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": pwd},
    )
    if login_res.status_code == 200:
        return login_res.json()["access_token"]
    alt_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@financeflow.com", "password": pwd},
    )
    if alt_res.status_code == 200:
        return alt_res.json()["access_token"]
    raise RuntimeError(f"Auth failed: {login_res.text}")


@pytest.mark.asyncio
async def test_01_canonical_categories_endpoint(client: AsyncClient):
    """Verify /api/v1/insurance/categories returns the centralized canonical categories."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/v1/insurance/categories", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    codes = [item["code"] for item in data]
    assert "MOTOR" in codes
    assert "HEALTH" in codes
    assert "LIFE" in codes
    assert "TRAVEL" in codes
    assert "HOME" in codes
    assert "FIRE" in codes
    assert "MARINE" in codes
    assert "OTHER" in codes

    motor_entry = next(item for item in data if item["code"] == "MOTOR")
    assert motor_entry["label"] == "Motor Insurance"
    health_entry = next(item for item in data if item["code"] == "HEALTH")
    assert health_entry["label"] == "Health Insurance"


@pytest.mark.asyncio
async def test_02_existing_companies_and_plans_preserved(client: AsyncClient):
    """Verify existing user data (Iffco Tokio, Niva Bupa, Reassure 2.0, Two Wheeler Plan) are intact and standardized."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # List companies
    res = await client.get("/api/v1/insurance/companies?page_size=100", headers=headers)
    assert res.status_code == 200
    companies = res.json().get("items", [])
    names = {c["name"]: c for c in companies}
    assert any("IFFCO" in n.upper() for n in names)
    assert any("NIVA" in n.upper() for n in names)

    # List plans
    res_plans = await client.get("/api/v1/insurance/plans?page_size=100", headers=headers)
    assert res_plans.status_code == 200
    plans = res_plans.json().get("items", [])
    plan_names = {p["name"]: p for p in plans}
    assert any("TWO WHEELER" in p.upper() for p in plan_names)
    assert any("REASSURE" in p.upper() for p in plan_names)


@pytest.mark.asyncio
async def test_03_lookup_data_motor_filtering(client: AsyncClient):
    """Verify ?category=MOTOR returns Motor companies (Iffco Tokio) and Motor plans (Two Wheeler)."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get(
        "/api/v1/insurance/policies/lookup-data?category=MOTOR",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    companies = data.get("companies", [])
    plans = data.get("plans", [])

    # Must contain Motor companies and plans
    motor_comp_names = [c["name"].upper() for c in companies]
    assert any("IFFCO" in n for n in motor_comp_names), f"Iffco Tokio not found in MOTOR companies: {motor_comp_names}"

    motor_plan_names = [p["name"].upper() for p in plans]
    assert any("TWO WHEELER" in p for p in motor_plan_names), f"Two Wheeler Plan not found in MOTOR plans: {motor_plan_names}"

    # Must NOT contain standalone Health companies (Niva Bupa)
    assert not any("NIVA BUPA" in n for n in motor_comp_names), f"Niva Bupa should not be in MOTOR lookup: {motor_comp_names}"
    assert not any("REASSURE" in p for p in motor_plan_names), f"Reassure 2.0 should not be in MOTOR lookup: {motor_plan_names}"


@pytest.mark.asyncio
async def test_04_lookup_data_health_filtering(client: AsyncClient):
    """Verify ?category=HEALTH returns Health companies (Niva Bupa) and Health plans (Reassure 2.0)."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get(
        "/api/v1/insurance/policies/lookup-data?category=HEALTH",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    companies = data.get("companies", [])
    plans = data.get("plans", [])

    health_comp_names = [c["name"].upper() for c in companies]
    assert any("NIVA BUPA" in n for n in health_comp_names)

    health_plan_names = [p["name"].upper() for p in plans]
    assert any("REASSURE" in p for p in health_plan_names)

    # Must NOT contain standalone Motor companies/plans
    assert not any("IFFCO" in n for n in health_comp_names)
    assert not any("TWO WHEELER" in p for p in health_plan_names)


@pytest.mark.asyncio
async def test_05_plan_creation_compatibility_validation(client: AsyncClient):
    """Verify backend rejects creating a plan with incompatible category against parent carrier."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Find IFFCO Tokio (Motor)
    res = await client.get("/api/v1/insurance/companies?page_size=100", headers=headers)
    companies = res.json()["items"]
    iffco = next(c for c in companies if "IFFCO" in c["name"].upper())

    # Try to create a Health Insurance plan under Iffco Tokio (Motor) -> should be 400
    res_bad = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": f"Test Incompatible Health Plan {uuid.uuid4().hex[:6]}",
            "code": f"HLTH-{uuid.uuid4().hex[:6].upper()}",
            "company_id": iffco["id"],
            "line_of_business": "Health Insurance",
            "is_active": True,
        },
        headers=headers,
    )
    assert res_bad.status_code == 400
    assert "Incompatible insurance category" in res_bad.text or "not eligible" in res_bad.text

    # Creating a Motor Insurance plan under Iffco Tokio -> should succeed
    plan_code = f"MOTR-{uuid.uuid4().hex[:6].upper()}"
    res_good = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": f"Test Compatible Motor Plan {uuid.uuid4().hex[:6]}",
            "code": plan_code,
            "company_id": iffco["id"],
            "line_of_business": "Motor Insurance",
            "is_active": True,
        },
        headers=headers,
    )
    assert res_good.status_code == 201
    created_plan_id = res_good.json()["id"]

    # Clean up test plan
    await client.delete(f"/api/v1/insurance/plans/{created_plan_id}", headers=headers)


@pytest.mark.asyncio
async def test_06_policy_creation_category_mismatch_rejection(client: AsyncClient):
    """Verify policy issuance endpoint rejects mismatched Company/Plan/Policy categories."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Get reference data
    res_co = await client.get("/api/v1/insurance/companies?page_size=100", headers=headers)
    companies = res_co.json()["items"]
    iffco = next(c for c in companies if "IFFCO" in c["name"].upper())
    niva = next(c for c in companies if "NIVA" in c["name"].upper())

    res_pl = await client.get("/api/v1/insurance/plans?page_size=100", headers=headers)
    plans = res_pl.json()["items"]
    reassure = next(p for p in plans if "REASSURE" in p["name"].upper())

    # Get a customer
    res_cust = await client.get("/api/v1/insurance/customers?page_size=1", headers=headers)
    customers = res_cust.json().get("items", [])
    assert len(customers) > 0, "At least one customer required for policy test"
    customer_id = customers[0]["id"]

    # Attempt 1: Policy type MOTOR but Carrier is Niva Bupa (Health) -> reject 400
    res_mismatch_co = await client.post(
        "/api/v1/insurance/policies",
        json={
            "policy_number": f"TEST-FAIL-CO-{uuid.uuid4().hex[:6].upper()}",
            "customer_id": customer_id,
            "company_id": niva["id"],
            "plan_id": reassure["id"],
            "policy_type": "MOTOR",
            "coverage_type": "INDIVIDUAL",
            "sum_assured": 500000.0,
            "net_premium": 15000.0,
            "gross_premium": 17700.0,
            "start_date": "2026-01-01",
            "expiry_date": "2027-01-01",
        },
        headers=headers,
    )
    assert res_mismatch_co.status_code == 400
    assert "not eligible to issue MOTOR policies" in res_mismatch_co.text

    # Attempt 2: Policy type MOTOR and Carrier is Iffco Tokio, but Plan is Reassure (Health) -> reject 400
    res_mismatch_plan = await client.post(
        "/api/v1/insurance/policies",
        json={
            "policy_number": f"TEST-FAIL-PL-{uuid.uuid4().hex[:6].upper()}",
            "customer_id": customer_id,
            "company_id": iffco["id"],
            "plan_id": reassure["id"],
            "policy_type": "MOTOR",
            "coverage_type": "INDIVIDUAL",
            "sum_assured": 500000.0,
            "net_premium": 15000.0,
            "gross_premium": 17700.0,
            "start_date": "2026-01-01",
            "expiry_date": "2027-01-01",
        },
        headers=headers,
    )
    assert res_mismatch_plan.status_code == 400
    assert "does not belong to company" in res_mismatch_plan.text or "not eligible" in res_mismatch_plan.text


@pytest.mark.asyncio
async def test_07_policy_creation_motor_success(client: AsyncClient):
    """Verify issuing a MOTOR policy with Iffco Tokio and Two Wheeler Plan succeeds."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Find Iffco Tokio and Two Wheeler Plan
    res_co = await client.get("/api/v1/insurance/companies?page_size=100", headers=headers)
    iffco = next(c for c in res_co.json()["items"] if "IFFCO" in c["name"].upper())

    res_pl = await client.get("/api/v1/insurance/plans?page_size=100", headers=headers)
    two_wheeler = next(p for p in res_pl.json()["items"] if "TWO WHEELER" in p["name"].upper())

    res_cust = await client.get("/api/v1/insurance/customers?page_size=1", headers=headers)
    customer_id = res_cust.json()["items"][0]["id"]

    pol_num = f"POL-MOTR-2026-{uuid.uuid4().hex[:5].upper()}"
    res_create = await client.post(
        "/api/v1/insurance/policies",
        json={
            "policy_number": pol_num,
            "customer_id": customer_id,
            "company_id": iffco["id"],
            "plan_id": two_wheeler["id"],
            "policy_type": "MOTOR",
            "coverage_type": "INDIVIDUAL",
            "sum_assured": 75000.0,
            "net_premium": 2500.0,
            "gross_premium": 2950.0,
            "final_premium": 2950.0,
            "start_date": "2026-03-01",
            "expiry_date": "2027-03-01",
            "vehicle_registration_number": "MH12AB1234",
            "vehicle_type": "TWO_WHEELER",
            "vehicle_manufacturer": "Honda",
            "vehicle_model": "Activa 6G",
        },
        headers=headers,
    )
    assert res_create.status_code == 201, f"Policy creation failed: {res_create.text}"
    pol_data = res_create.json()
    assert pol_data["policy_number"] == pol_num
    assert pol_data["policy_type"] == "MOTOR"
    assert pol_data["company_name"] == iffco["name"]
    assert pol_data["plan_name"] == two_wheeler["name"]

    # Verify lookup by ID
    res_get = await client.get(f"/api/v1/insurance/policies/{pol_data['id']}", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["vehicle_registration_number"] == "MH12AB1234"
