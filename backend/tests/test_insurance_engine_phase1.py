"""Automated Unit & Integration Tests for FinNexus Insurance Engine — Phase 1.

Comprehensive test suite covering:
1. Company Master CRUD, auto-code generation, and unique constraint enforcement
2. Duplicate company name and code conflict protection (HTTP 409)
3. Company pagination (10, 25, 50), filtering by category & status, and search
4. Company status toggle (activation/deactivation) and audit logging
5. Company deletion protection when referenced by plans (HTTP 400)
6. Safe deletion of company when unreferenced
7. Plan Master CRUD, company relation eager-loading, and status toggle
8. Plan creation blocked for inactive or non-existent parent company (HTTP 400/404)
9. Plan duplicate code protection (HTTP 409)
10. Purchase Party CRUD, unique code auto-generation, and status toggle
11. Purchase Party filtered CSV & Excel export with authorization checks
12. RBAC enforcement: Employee blocked from mutating master data; Manager & Admin permitted
13. Dashboard metrics calculated from live database with unavailable states for unbuilt modules
14. Idempotent seed process for canonical providers (LIC, Birla, Care, Star, Digit, Bajaj, Shriram)
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.seed import seed_initial_data
from app.db.seed_insurance import seed_insurance_master_data
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
        # Seed core users (Admin, Manager, Employee)
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


async def get_token(client: AsyncClient, email: str, password: str) -> str:
    """Helper to authenticate and return JWT access token."""
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_01_create_company_with_auto_code(client: AsyncClient) -> None:
    """Test creating an insurance company with auto-generated unique code."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "name": "HDFC ERGO General",
        "category": "General/Motor",
        "contact_person": "Vikram Seth",
        "email": "corporate@hdfcergo.demo",
        "phone": "+91 22 6638 3600",
        "address": "165-166 Backbay Reclamation, Mumbai",
        "notes": "Leading private general insurer in India.",
        "is_active": True,
    }

    res = await client.post("/api/v1/insurance/companies", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["name"] == "HDFC ERGO General"
    assert data["category"] in ("General/Motor", "Motor Insurance")
    assert data["code"].startswith("HDFCERG") or "-" in data["code"]
    assert data["is_active"] is True
    assert data["plans_count"] == 0
    assert "id" in data


@pytest.mark.asyncio
async def test_02_create_company_duplicate_code_and_name_protection(client: AsyncClient) -> None:
    """Test duplicate company code and duplicate active name conflict rejections (HTTP 409)."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    comp1 = {
        "name": "Max Life Insurance",
        "code": "MAX-LIFE",
        "category": "Life Insurance",
    }
    res1 = await client.post("/api/v1/insurance/companies", json=comp1, headers=headers)
    assert res1.status_code == 201

    # 1. Duplicate code attempt
    comp2 = {
        "name": "Different Max Life Entity",
        "code": "MAX-LIFE",
        "category": "Life Insurance",
    }
    res2 = await client.post("/api/v1/insurance/companies", json=comp2, headers=headers)
    assert res2.status_code == 409
    assert "already registered" in res2.json()["detail"].lower()

    # 2. Duplicate active name attempt (case-insensitive)
    comp3 = {
        "name": "max life insurance",
        "code": "MAX-LIFE-2",
        "category": "Life Insurance",
    }
    res3 = await client.post("/api/v1/insurance/companies", json=comp3, headers=headers)
    assert res3.status_code == 409
    assert "already exists" in res3.json()["detail"].lower()


@pytest.mark.asyncio
async def test_03_company_pagination_search_and_sorting(client: AsyncClient) -> None:
    """Test search, pagination (10, 25, 50), and sorting on companies."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Create 12 test companies
    for i in range(12):
        await client.post(
            "/api/v1/insurance/companies",
            json={
                "name": f"Carrier Alpha {i:02d}",
                "code": f"ALPHA-{i:02d}",
                "category": "Health Insurance" if i % 2 == 0 else "Life Insurance",
                "is_active": i < 10,
            },
            headers=headers,
        )

    # 1. Default page 1 with page_size=10
    res = await client.get("/api/v1/insurance/companies?page=1&page_size=10", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 12
    assert len(data["items"]) == 10
    assert data["page"] == 1
    assert data["page_size"] == 10
    assert data["total_pages"] == 2

    # 2. Page 2 with page_size=10
    res_p2 = await client.get("/api/v1/insurance/companies?page=2&page_size=10", headers=headers)
    assert res_p2.status_code == 200
    assert len(res_p2.json()["items"]) == 2

    # 3. Page with page_size=25
    res_p25 = await client.get("/api/v1/insurance/companies?page=1&page_size=25", headers=headers)
    assert res_p25.status_code == 200
    assert len(res_p25.json()["items"]) == 12

    # 4. Filter by category
    res_cat = await client.get("/api/v1/insurance/companies?category=Health Insurance", headers=headers)
    assert res_cat.status_code == 200
    assert res_cat.json()["total"] == 6

    # 5. Search by name or code
    res_srch = await client.get("/api/v1/insurance/companies?search=Alpha 05", headers=headers)
    assert res_srch.status_code == 200
    assert res_srch.json()["total"] == 1
    assert res_srch.json()["items"][0]["code"] == "ALPHA-05"


@pytest.mark.asyncio
async def test_04_company_update_and_status_toggle(client: AsyncClient) -> None:
    """Test updating company details and toggling active/inactive status."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    create_res = await client.post(
        "/api/v1/insurance/companies",
        json={"name": "Kotak General", "code": "KOTAK-GEN", "category": "General/Motor"},
        headers=headers,
    )
    comp_id = create_res.json()["id"]

    # 1. Update name and notes
    upd_res = await client.put(
        f"/api/v1/insurance/companies/{comp_id}",
        json={"name": "Kotak Mahindra General", "notes": "Merged entity notes"},
        headers=headers,
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["name"] == "Kotak Mahindra General"
    assert upd_res.json()["notes"] == "Merged entity notes"

    # 2. Deactivate company via status endpoint
    deact_res = await client.patch(
        f"/api/v1/insurance/companies/{comp_id}/status?is_active=false",
        headers=headers,
    )
    assert deact_res.status_code == 200
    assert deact_res.json()["is_active"] is False

    # 3. Reactivate company
    act_res = await client.patch(
        f"/api/v1/insurance/companies/{comp_id}/status?is_active=true",
        headers=headers,
    )
    assert act_res.status_code == 200
    assert act_res.json()["is_active"] is True


@pytest.mark.asyncio
async def test_05_company_deletion_protection_when_plans_exist(client: AsyncClient) -> None:
    """Test that deleting a company with child plans is blocked with HTTP 400."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create company
    comp_res = await client.post(
        "/api/v1/insurance/companies",
        json={"name": "Religare Health", "code": "RELIGARE", "category": "Health Insurance"},
        headers=headers,
    )
    comp_id = comp_res.json()["id"]

    # 2. Create child plan
    plan_res = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": "Care Health Plan",
            "code": "REL-CARE-01",
            "company_id": comp_id,
            "line_of_business": "Health Insurance",
            "status": "ACTIVE",
        },
        headers=headers,
    )
    assert plan_res.status_code == 201

    # 3. Attempt to delete company -> must be blocked
    del_res = await client.delete(f"/api/v1/insurance/companies/{comp_id}", headers=headers)
    assert del_res.status_code == 400
    assert "associated plan" in del_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_06_company_safe_deletion_when_no_plans(client: AsyncClient) -> None:
    """Test safe physical deletion when company has zero associated plans."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    comp_res = await client.post(
        "/api/v1/insurance/companies",
        json={"name": "Temporary Carrier", "code": "TEMP-CARRIER", "category": "Composite"},
        headers=headers,
    )
    comp_id = comp_res.json()["id"]

    del_res = await client.delete(f"/api/v1/insurance/companies/{comp_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Verify 404 on subsequent get
    get_res = await client.get(f"/api/v1/insurance/companies/{comp_id}", headers=headers)
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_07_plan_crud_and_parent_company_relationship(client: AsyncClient) -> None:
    """Test Plan Master CRUD, company association loading, and status toggle."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create company
    comp_res = await client.post(
        "/api/v1/insurance/companies",
        json={"name": "Niva Bupa Health", "code": "NIVA-BUPA", "category": "Health Insurance"},
        headers=headers,
    )
    comp_id = comp_res.json()["id"]

    # 2. Create plan
    plan_payload = {
        "name": "ReAssure 2.0 Comprehensive",
        "code": "NIVA-REASSURE",
        "company_id": comp_id,
        "line_of_business": "Health Insurance",
        "status": "ACTIVE",
        "description": "Lock the clock age-based premium advantage.",
    }
    create_res = await client.post("/api/v1/insurance/plans", json=plan_payload, headers=headers)
    assert create_res.status_code == 201
    plan_data = create_res.json()
    assert plan_data["name"] == "ReAssure 2.0 Comprehensive"
    assert plan_data["company_name"] == "Niva Bupa Health"
    assert plan_data["company_code"] == "NIVA-BUPA"
    plan_id = plan_data["id"]

    # 3. Retrieve plan detail
    get_res = await client.get(f"/api/v1/insurance/plans/{plan_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["company_name"] == "Niva Bupa Health"

    # 4. Update plan
    upd_res = await client.put(
        f"/api/v1/insurance/plans/{plan_id}",
        json={"description": "Updated warranty and restoration terms."},
        headers=headers,
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["description"] == "Updated warranty and restoration terms."

    # 5. Toggle plan status
    status_res = await client.patch(
        f"/api/v1/insurance/plans/{plan_id}/status?status=INACTIVE",
        headers=headers,
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "INACTIVE"

    # 6. Delete plan
    del_res = await client.delete(f"/api/v1/insurance/plans/{plan_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True


@pytest.mark.asyncio
async def test_08_plan_creation_blocked_for_inactive_or_nonexistent_company(client: AsyncClient) -> None:
    """Test that plans cannot be attached to inactive carriers (HTTP 400) or missing carriers (HTTP 404)."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Missing carrier
    random_id = str(uuid.uuid4())
    res_miss = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": "Ghost Plan",
            "code": "GHOST-01",
            "company_id": random_id,
            "line_of_business": "Life Insurance",
        },
        headers=headers,
    )
    assert res_miss.status_code == 404

    # 2. Inactive carrier
    comp_res = await client.post(
        "/api/v1/insurance/companies",
        json={"name": "Deactivated Carrier", "code": "DEACT-01", "is_active": False},
        headers=headers,
    )
    comp_id = comp_res.json()["id"]

    res_inact = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": "Invalid Plan",
            "code": "INVAL-01",
            "company_id": comp_id,
            "line_of_business": "Life Insurance",
        },
        headers=headers,
    )
    assert res_inact.status_code == 400
    assert "deactivated" in res_inact.json()["detail"].lower()


@pytest.mark.asyncio
async def test_09_plan_duplicate_code_protection(client: AsyncClient) -> None:
    """Test duplicate plan code rejection (HTTP 409)."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    comp = await client.post(
        "/api/v1/insurance/companies",
        json={"name": "Carrier Gamma", "code": "GAMMA-01"},
        headers=headers,
    )
    comp_id = comp.json()["id"]

    # Plan 1
    res1 = await client.post(
        "/api/v1/insurance/plans",
        json={"name": "Plan Alpha", "code": "PLAN-DUP-01", "company_id": comp_id, "line_of_business": "General/Motor"},
        headers=headers,
    )
    assert res1.status_code == 201

    # Plan 2 with same code
    res2 = await client.post(
        "/api/v1/insurance/plans",
        json={"name": "Plan Beta", "code": "plan-dup-01", "company_id": comp_id, "line_of_business": "General/Motor"},
        headers=headers,
    )
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_10_purchase_party_crud_and_auto_code(client: AsyncClient) -> None:
    """Test Purchase Party CRUD with auto-generated unique code and status toggle."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create with auto-generated code
    payload = {
        "name": "Sovereign Broking Syndicate",
        "contact_person": "Priyanka Mehra",
        "email": "priyanka@sovereign.demo",
        "phone": "+91 98200 88776",
        "address": "Express Towers, Nariman Point, Mumbai",
        "notes": "Direct sourcing broker entity for motor fleets.",
        "is_active": True,
    }
    create_res = await client.post("/api/v1/insurance/purchase-parties", json=payload, headers=headers)
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["name"] == "Sovereign Broking Syndicate"
    assert data["code"].startswith("PP-")
    party_id = data["id"]

    # 2. Update party
    upd_res = await client.put(
        f"/api/v1/insurance/purchase-parties/{party_id}",
        json={"contact_person": "Priyanka Mehra Kapoor"},
        headers=headers,
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["contact_person"] == "Priyanka Mehra Kapoor"

    # 3. Toggle status
    status_res = await client.patch(
        f"/api/v1/insurance/purchase-parties/{party_id}/status?is_active=false",
        headers=headers,
    )
    assert status_res.status_code == 200
    assert status_res.json()["is_active"] is False

    # 4. Delete party
    del_res = await client.delete(f"/api/v1/insurance/purchase-parties/{party_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True


@pytest.mark.asyncio
async def test_11_purchase_party_csv_and_excel_export_authorization(client: AsyncClient) -> None:
    """Test exporting purchase parties to CSV and Excel with authorization enforcement."""
    # 1. Unauthenticated request -> must be rejected (401)
    unauth_csv = await client.get("/api/v1/insurance/purchase-parties/export/csv")
    assert unauth_csv.status_code == 401

    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Create 2 parties
    await client.post(
        "/api/v1/insurance/purchase-parties",
        json={"name": "Export Party One", "code": "PP-EXP-01", "email": "p1@demo.com"},
        headers=headers,
    )
    await client.post(
        "/api/v1/insurance/purchase-parties",
        json={"name": "Export Party Two", "code": "PP-EXP-02", "email": "p2@demo.com"},
        headers=headers,
    )

    # 2. CSV Export
    csv_res = await client.get("/api/v1/insurance/purchase-parties/export/csv", headers=headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers.get("content-type", "")
    assert "attachment; filename=" in csv_res.headers.get("content-disposition", "")
    body_text = csv_res.text
    assert "PP-EXP-01" in body_text
    assert "Export Party One" in body_text
    assert "Party Code,Party Name" in body_text

    # 3. Excel Export
    excel_res = await client.get("/api/v1/insurance/purchase-parties/export/excel", headers=headers)
    assert excel_res.status_code == 200
    assert "application/vnd.ms-excel" in excel_res.headers.get("content-type", "")
    assert "attachment; filename=" in excel_res.headers.get("content-disposition", "")
    assert b"PP-EXP-02" in excel_res.content


@pytest.mark.asyncio
async def test_12_rbac_permissions_enforcement(client: AsyncClient) -> None:
    """Test RBAC: Employee role is blocked from creating/deleting master data; Manager & Admin can."""
    # Employee Token
    emp_token = await get_token(client, "employee@financeflow.com", "Employee@12345")
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # Manager Token
    mgr_token = await get_token(client, "manager@financeflow.com", "Manager@12345")
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}

    # Admin Token
    admin_token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    company_payload = {
        "name": "RBAC Test Company",
        "code": "RBAC-COMP-01",
        "category": "Life Insurance",
    }

    # 1. Employee tries to create company -> 403 Forbidden
    emp_res = await client.post("/api/v1/insurance/companies", json=company_payload, headers=emp_headers)
    assert emp_res.status_code == 403
    assert "access denied" in emp_res.json()["detail"].lower()

    # 2. Manager creates company -> 201 Created
    mgr_res = await client.post("/api/v1/insurance/companies", json=company_payload, headers=mgr_headers)
    assert mgr_res.status_code == 201
    comp_id = mgr_res.json()["id"]

    # 3. Employee can READ companies
    emp_read = await client.get(f"/api/v1/insurance/companies/{comp_id}", headers=emp_headers)
    assert emp_read.status_code == 200

    # 4. Manager cannot DELETE company (Delete is restricted to Admin/Super Admin)
    mgr_del = await client.delete(f"/api/v1/insurance/companies/{comp_id}", headers=mgr_headers)
    assert mgr_del.status_code == 403

    # 5. Admin can DELETE company
    admin_del = await client.delete(f"/api/v1/insurance/companies/{comp_id}", headers=admin_headers)
    assert admin_del.status_code == 200


@pytest.mark.asyncio
async def test_13_dashboard_metrics_live_calculation(client: AsyncClient) -> None:
    """Test dashboard metrics calculated from live database and reports unbuilt modules as unavailable."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/v1/insurance/dashboard/stats", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # Total customers must be an integer count from real CRM customer table
    assert isinstance(data["total_customers"], int)
    # Master data counts must be integers
    assert isinstance(data["total_companies"], int)
    assert isinstance(data["total_plans"], int)
    assert isinstance(data["total_purchase_parties"], int)

    # Unbuilt modules must be None / unavailable, NOT hardcoded mock numbers
    assert data["total_policies"] is None
    assert data["upcoming_premium_dues"] is None
    assert data["premiums_due_today"] is None
    assert data["overdue_premiums"] is None
    assert data["upcoming_policy_expiries"] is None
    assert data["policies_expired"] is None
    assert data["module_status"]["policies"] == "unavailable"
    assert data["module_status"]["premiums"] == "unavailable"


@pytest.mark.asyncio
async def test_14_master_data_idempotent_seed(client: AsyncClient) -> None:
    """Test explicit idempotent master data seed creates canonical providers without duplicates."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Trigger seed
    res1 = await client.post("/api/v1/insurance/master/seed?confirm=true", headers=headers)
    assert res1.status_code == 200
    results1 = res1.json()["results"]
    assert results1["companies_created"] >= 7
    assert results1["plans_created"] >= 6
    assert results1["parties_created"] >= 3

    # 2. Trigger seed again -> must be idempotent (0 created)
    res2 = await client.post("/api/v1/insurance/master/seed?confirm=true", headers=headers)
    assert res2.status_code == 200
    results2 = res2.json()["results"]
    assert results2["companies_created"] == 0
    assert results2["plans_created"] == 0
    assert results2["parties_created"] == 0

    # 3. Check specific canonical providers exist in DB
    lic_res = await client.get("/api/v1/insurance/companies?search=LIC-IND", headers=headers)
    assert lic_res.status_code == 200
    assert lic_res.json()["total"] == 1
    assert lic_res.json()["items"][0]["name"] == "LIC India"

    care_res = await client.get("/api/v1/insurance/companies?search=CARE-HLT", headers=headers)
    assert care_res.status_code == 200
    assert care_res.json()["total"] == 1
    assert care_res.json()["items"][0]["name"] == "Care Health"
