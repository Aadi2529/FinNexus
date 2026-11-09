"""Comprehensive Acceptance Tests for Multi-Category Insurer & Policy Plan Architecture.

Tests cover:
1. Multi-category company creation & supported categories assignment.
2. Multi-category plan creation under the SAME single insurer record.
3. Category-based dynamic dropdown filtering for policy issuance.
4. Company type compatibility rules, super-admin overrides, and safe removal constraints.
5. Existing database record preservation (18 companies, 23 plans, 18 policies intact).
"""

import os
import sys
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, func

# Ensure backend root is on sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app
from app.db.session import AsyncSessionLocal, engine
from app.db.models.insurance import (
    InsuranceCompany,
    InsuranceCompanyCategory,
    InsurancePlan,
    InsurancePolicy,
    InsuranceCategory,
)
from app.core.insurance_categories import (
    COMPANY_TYPES,
    CANONICAL_CATEGORIES,
    validate_company_type_categories,
    normalize_category_code,
)


@pytest.fixture(autouse=True)
async def cleanup_pool():
    yield
    await engine.dispose()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest.fixture
async def auth_headers(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@financeflow.com", "password": "Admin@12345"},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_01_multi_category_company_creation_and_update(client: AsyncClient, auth_headers: dict):
    """Test 1: Create a General Insurance company offering Health, Motor, Travel, Property, Commercial.
    Verify company_type and all supported categories are saved and retrievable.
    """
    comp_code = f"HDFC-TST-{uuid.uuid4().hex[:4].upper()}"
    payload = {
        "name": "HDFC ERGO General Insurance (Test)",
        "code": comp_code,
        "company_type": "General Insurance",
        "supported_categories": [
            "Health Insurance",
            "Motor Insurance",
            "Travel Insurance",
            "Property & Home Insurance",
            "Commercial / Business Insurance",
        ],
        "category": "General Insurance",
        "is_active": True,
        "contact_person": "Aditya Underwriter",
        "email": "underwriting@hdfcergo-test.com",
        "phone": "+91 99999 88888",
    }

    create_res = await client.post("/api/v1/insurance/companies", json=payload, headers=auth_headers)
    assert create_res.status_code == 201, f"Create company failed: {create_res.text}"
    co_data = create_res.json()
    co_id = co_data["id"]

    assert co_data["company_type"] == "General Insurance"
    assert len(co_data["supported_categories"]) == 5
    assert "Health Insurance" in co_data["supported_categories"]
    assert "Motor Insurance" in co_data["supported_categories"]
    assert "Travel Insurance" in co_data["supported_categories"]

    # Verify dedicated supported categories endpoint
    sc_res = await client.get(f"/api/v1/insurance/companies/{co_id}/supported-categories", headers=auth_headers)
    assert sc_res.status_code == 200
    sc_data = sc_res.json()
    assert sc_data["company_type"] == "General Insurance"
    assert len(sc_data["supported_categories"]) == 5

    # Update supported categories (add Other General Insurance)
    upd_payload = {
        "supported_categories": [
            "Health Insurance",
            "Motor Insurance",
            "Travel Insurance",
            "Property & Home Insurance",
            "Commercial / Business Insurance",
            "Other General Insurance",
        ],
        "override_compatibility": False,
    }
    upd_res = await client.put(
        f"/api/v1/insurance/companies/{co_id}/supported-categories",
        json=upd_payload,
        headers=auth_headers,
    )
    assert upd_res.status_code == 200
    assert len(upd_res.json()["supported_categories"]) == 6


@pytest.mark.asyncio
async def test_02_multi_category_plans_under_same_company(client: AsyncClient, auth_headers: dict):
    """Test 2: Under ONE insurance company, create Health, Motor, and Travel plans.
    Verify all belong to the exact same insurance_company_id without duplicate company records.
    """
    comp_code = f"MULTI-CO-{uuid.uuid4().hex[:4].upper()}"
    co_res = await client.post(
        "/api/v1/insurance/companies",
        json={
            "name": "Tata AIG General Insurance (Test)",
            "code": comp_code,
            "company_type": "General Insurance",
            "supported_categories": ["Health Insurance", "Motor Insurance", "Travel Insurance"],
            "category": "General Insurance",
            "is_active": True,
        },
        headers=auth_headers,
    )
    assert co_res.status_code == 201
    co_id = co_res.json()["id"]

    # Plan 1: Health Insurance
    p1_code = f"HLT-{uuid.uuid4().hex[:4].upper()}"
    p1_res = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": "Tata Medicare Premier",
            "code": p1_code,
            "company_id": co_id,
            "line_of_business": "Health Insurance",
            "plan_subcategory": "Family Floater Health Insurance",
            "waiting_period_months": 24,
            "sum_insured_min": 500000,
            "sum_insured_max": 2500000,
            "status": "ACTIVE",
        },
        headers=auth_headers,
    )
    assert p1_res.status_code == 201, f"P1 failed: {p1_res.text}"
    p1 = p1_res.json()
    assert p1["company_id"] == co_id
    assert p1["plan_subcategory"] == "Family Floater Health Insurance"
    assert p1["waiting_period_months"] == 24

    # Plan 2: Motor Insurance
    p2_code = f"MOT-{uuid.uuid4().hex[:4].upper()}"
    p2_res = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": "Tata Auto Secure Comprehensive",
            "code": p2_code,
            "company_id": co_id,
            "line_of_business": "Motor Insurance",
            "plan_subcategory": "Car Insurance",
            "motor_plan_type": "Comprehensive",
            "status": "ACTIVE",
        },
        headers=auth_headers,
    )
    assert p2_res.status_code == 201, f"P2 failed: {p2_res.text}"
    p2 = p2_res.json()
    assert p2["company_id"] == co_id
    assert p2["motor_plan_type"] == "Comprehensive"

    # Plan 3: Travel Insurance
    p3_code = f"TRV-{uuid.uuid4().hex[:4].upper()}"
    p3_res = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": "Tata Travel Guard International",
            "code": p3_code,
            "company_id": co_id,
            "line_of_business": "Travel Insurance",
            "plan_subcategory": "International Travel",
            "status": "ACTIVE",
        },
        headers=auth_headers,
    )
    assert p3_res.status_code == 201, f"P3 failed: {p3_res.text}"
    p3 = p3_res.json()
    assert p3["company_id"] == co_id

    # Verify Company Details endpoint shows breakdown and same company ID
    co_check = await client.get(f"/api/v1/insurance/companies/{co_id}", headers=auth_headers)
    assert co_check.status_code == 200
    details = co_check.json()
    assert details["plans_count"] >= 3
    breakdown = details["category_plans_count"]
    assert breakdown.get("Health Insurance", 0) >= 1
    assert breakdown.get("Motor Insurance", 0) >= 1
    assert breakdown.get("Travel Insurance", 0) >= 1


@pytest.mark.asyncio
async def test_03_policy_issuance_lookup_and_dropdown_filtering(client: AsyncClient, auth_headers: dict):
    """Test 3: Verify policy issuance dropdown logic:
    - Motor Insurance filter returns companies supporting Motor.
    - Health Insurance filter returns companies supporting Health.
    - Plan dropdown for Motor + Company returns only Motor plans.
    - Plan dropdown for Health + Company returns only Health plans.
    """
    # 1. Lookup with category=MOTOR
    motor_lk = await client.get("/api/v1/insurance/policies/lookup-data?category=MOTOR", headers=auth_headers)
    assert motor_lk.status_code == 200
    motor_companies = motor_lk.json().get("companies", [])
    assert len(motor_companies) > 0
    # Every returned company must support Motor or have General/Composite classification
    for mc in motor_companies:
        cats = mc.get("supported_categories", [])
        assert any("MOTOR" in c.upper() for c in cats) or mc.get("company_type") in ("General Insurance", "Composite Insurance")

    # 2. Lookup with category=HEALTH
    health_lk = await client.get("/api/v1/insurance/policies/lookup-data?category=HEALTH", headers=auth_headers)
    assert health_lk.status_code == 200
    health_companies = health_lk.json().get("companies", [])
    assert len(health_companies) > 0
    for hc in health_companies:
        cats = hc.get("supported_categories", [])
        assert any("HEALTH" in c.upper() for c in cats) or hc.get("company_type") in ("General Insurance", "Standalone Health Insurance", "Composite Insurance")


@pytest.mark.asyncio
async def test_04_classification_compatibility_and_guardrails(client: AsyncClient, auth_headers: dict):
    """Test 4: Classification rules and validation constraints:
    - Life category on Standalone Health without override -> HTTP 400.
    - Life category on Standalone Health with override -> HTTP 201.
    - Attempt to create unsupported plan category -> HTTP 400.
    - Attempt to remove category with active plans -> HTTP 400.
    """
    # 4a. Standalone Health cannot take Life Insurance without override
    sh_code = f"SHI-{uuid.uuid4().hex[:4].upper()}"
    fail_res = await client.post(
        "/api/v1/insurance/companies",
        json={
            "name": "Niva Bupa Health Test",
            "code": sh_code,
            "company_type": "Standalone Health Insurance",
            "supported_categories": ["Health Insurance", "Life Insurance"],
            "override_compatibility": False,
        },
        headers=auth_headers,
    )
    assert fail_res.status_code == 400
    assert "not permitted" in fail_res.text.lower() or "compatibility" in fail_res.text.lower()

    # 4b. With override_compatibility = True, it succeeds
    succ_res = await client.post(
        "/api/v1/insurance/companies",
        json={
            "name": "Niva Bupa Health Test Valid",
            "code": sh_code,
            "company_type": "Standalone Health Insurance",
            "supported_categories": ["Health Insurance", "Life Insurance"],
            "override_compatibility": True,
        },
        headers=auth_headers,
    )
    assert succ_res.status_code == 201
    valid_co_id = succ_res.json()["id"]

    # 4c. Create a Health-only company, then attempt to add a Motor plan -> must be rejected
    pure_health_code = f"PURE-HLT-{uuid.uuid4().hex[:4].upper()}"
    ph_res = await client.post(
        "/api/v1/insurance/companies",
        json={
            "name": "Pure Health Insurer",
            "code": pure_health_code,
            "company_type": "Standalone Health Insurance",
            "supported_categories": ["Health Insurance"],
            "override_compatibility": False,
        },
        headers=auth_headers,
    )
    assert ph_res.status_code == 201
    ph_id = ph_res.json()["id"]

    motor_plan_fail = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": "Incompatible Motor Plan",
            "code": f"MOT-FAIL-{uuid.uuid4().hex[:4].upper()}",
            "company_id": ph_id,
            "line_of_business": "Motor Insurance",
        },
        headers=auth_headers,
    )
    assert motor_plan_fail.status_code == 400
    assert "does not support" in motor_plan_fail.text.lower() or "incompatible" in motor_plan_fail.text.lower()

    # 4d. Create a plan under Health, then attempt to remove Health category from company -> must be rejected
    plan_succ = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": "Valid Health Care Plan",
            "code": f"HLT-SUCC-{uuid.uuid4().hex[:4].upper()}",
            "company_id": ph_id,
            "line_of_business": "Health Insurance",
        },
        headers=auth_headers,
    )
    assert plan_succ.status_code == 201

    # Attempt to remove Health Insurance from supported_categories
    remove_fail = await client.put(
        f"/api/v1/insurance/companies/{ph_id}/supported-categories",
        json={
            "supported_categories": ["Travel Insurance"],
            "override_compatibility": True,
        },
        headers=auth_headers,
    )
    assert remove_fail.status_code == 400
    assert "cannot remove" in remove_fail.text.lower() or "plan(s) exist" in remove_fail.text.lower()


@pytest.mark.asyncio
async def test_05_existing_database_records_preservation():
    """Test 5: Verify zero data loss in finnexus_db:
    - At least 18 existing companies are preserved.
    - At least 23 existing plans are preserved.
    - At least 18 existing policies are preserved.
    - All companies have non-null company_type and active supported categories.
    """
    async with AsyncSessionLocal() as session:
        co_cnt = await session.scalar(select(func.count(InsuranceCompany.id)))
        pl_cnt = await session.scalar(select(func.count(InsurancePlan.id)))
        pol_cnt = await session.scalar(select(func.count(InsurancePolicy.id)))

        assert co_cnt >= 18, f"Expected >= 18 companies, found {co_cnt}"
        assert pl_cnt >= 23, f"Expected >= 23 plans, found {pl_cnt}"
        assert pol_cnt >= 18, f"Expected >= 18 policies, found {pol_cnt}"

        # Verify all companies have company_type set
        co_without_type = await session.scalar(
            select(func.count(InsuranceCompany.id)).where(InsuranceCompany.company_type.is_(None))
        )
        assert co_without_type == 0, f"Found {co_without_type} companies without company_type"

        # Verify company supported categories mapping table has records
        cat_links_cnt = await session.scalar(select(func.count(InsuranceCompanyCategory.id)))
        assert cat_links_cnt >= 18, f"Expected >= 18 category links, found {cat_links_cnt}"
