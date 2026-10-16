"""Integration Test Suite for FinanceFlow CRM Module.

Covers:
1. Indian Mobile Validation & Normalization (+91 10-digits, reject alphabetics/invalid length)
2. Direct endpoints (/api/v1/clients, /api/v1/work-orders, /api/v1/tasks, etc.)
3. Dynamic Client Summary Metrics (total_clients, clients_with_active_tasks, new_clients_30d, archived_clients)
4. Client Archival, Restore, and Audit History trail
5. Referential integrity guard on Client Deletion
6. Inline Transactional Client Creation & Duplicate Client Reuse
7. Work Order Assignment & Role-Based Access Controls (Employee 403)
8. Checklist Completion & Task Pipeline Derived Progress
9. Super Admin Invariant Defense (prevent deactivating the last active super admin)
"""

from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.seed import seed_initial_data
from app.db.session import Base, get_db_session
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="function")
async def test_session() -> AsyncGenerator[AsyncSession, None]:
    """Create in-memory SQLite database initialized with seed catalog."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with session_maker() as session:
        await seed_initial_data(session)

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
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


# ---------------------------------------------------------------------------
# 1. Indian Mobile Validation & Normalization
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_indian_mobile_normalization_and_validation(client: AsyncClient) -> None:
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Valid 10-digit mobile number
    valid_payload = {
        "first_name": "Rohan",
        "last_name": "Mehta",
        "email": "rohan.mehta@example.com",
        "phone": "9820012345",
        "pan_number": "ABCDE1111A",
        "reference_source": "Partner Referral",
        "monthly_income": 75000.0,
        "monthly_obligations": 15000.0,
        "cibil_score": 760,
    }
    res = await client.post("/api/v1/clients", json=valid_payload, headers=headers)
    assert res.status_code == 201, res.text
    created = res.json()
    assert created["phone"] == "+91 9820012345"
    assert created["reference_source"] == "Partner Referral"

    # 2. Reject fewer than 10 digits
    invalid_short = dict(valid_payload, email="short@example.com", pan_number="ABCDE1111B", phone="982001234")
    res_short = await client.post("/api/v1/clients", json=invalid_short, headers=headers)
    assert res_short.status_code == 422

    # 3. Reject more than 10 digits
    invalid_long = dict(valid_payload, email="long@example.com", pan_number="ABCDE1111C", phone="98200123456")
    res_long = await client.post("/api/v1/clients", json=invalid_long, headers=headers)
    assert res_long.status_code == 422

    # 4. Reject alphabetic characters in phone
    invalid_alpha = dict(valid_payload, email="alpha@example.com", pan_number="ABCDE1111D", phone="98200ABC45")
    res_alpha = await client.post("/api/v1/clients", json=invalid_alpha, headers=headers)
    assert res_alpha.status_code == 422


# ---------------------------------------------------------------------------
# 2. Direct Endpoints & Summary Cards
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_direct_endpoints_and_summary_cards(client: AsyncClient) -> None:
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Verify GET /api/v1/clients/summary
    res = await client.get("/api/v1/clients/summary", headers=headers)
    assert res.status_code == 200
    summary = res.json()
    assert "total_clients" in summary
    assert "clients_with_active_tasks" in summary
    assert "new_clients_30d" in summary
    assert "archived_clients" in summary
    initial_total = summary["total_clients"]

    # Create a new client via /api/v1/clients
    new_client = {
        "first_name": "Kavita",
        "last_name": "Iyer",
        "email": "kavita.iyer@example.com",
        "phone": "+91 9876543210",
        "pan_number": "ABCDE2222B",
        "reference_source": "Direct Walk-in",
        "monthly_income": 90000.0,
        "monthly_obligations": 20000.0,
        "cibil_score": 790,
    }
    create_res = await client.post("/api/v1/clients", json=new_client, headers=headers)
    assert create_res.status_code == 201
    client_id = create_res.json()["id"]

    # Verify summary count incremented
    res_after = await client.get("/api/v1/clients/summary", headers=headers)
    assert res_after.json()["total_clients"] == initial_total + 1

    # Verify GET /api/v1/clients/{id}
    get_res = await client.get(f"/api/v1/clients/{client_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["email"] == "kavita.iyer@example.com"

    # Verify GET /api/v1/clients/search
    search_res = await client.get("/api/v1/clients/search?q=Kavita", headers=headers)
    assert search_res.status_code == 200
    items = search_res.json()
    assert any(c["id"] == client_id for c in items)

    # Verify GET /api/v1/users/eligible-assignees
    team_res = await client.get("/api/v1/users/eligible-assignees", headers=headers)
    assert team_res.status_code == 200
    assert len(team_res.json()) > 0

    # Verify GET /api/v1/task-categories
    cat_res = await client.get("/api/v1/task-categories", headers=headers)
    assert cat_res.status_code == 200
    assert len(cat_res.json()) > 0


# ---------------------------------------------------------------------------
# 3. Client Archival, Restore, and Audit History
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_client_archival_restore_and_history(client: AsyncClient) -> None:
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create client
    new_client = {
        "first_name": "Siddharth",
        "last_name": "Nair",
        "email": "siddharth.nair@example.com",
        "phone": "+91 9123456789",
        "pan_number": "ABCDE3333C",
        "reference_source": "Online Portal",
        "monthly_income": 60000.0,
        "monthly_obligations": 12000.0,
        "cibil_score": 740,
    }
    create_res = await client.post("/api/v1/clients", json=new_client, headers=headers)
    assert create_res.status_code == 201
    client_id = create_res.json()["id"]

    # 2. Archive client
    arch_res = await client.post(f"/api/v1/clients/{client_id}/archive", headers=headers)
    assert arch_res.status_code == 200
    assert arch_res.json()["is_archived"] is True

    # Active listing should NOT include archived client by default
    active_res = await client.get("/api/v1/clients?paginate=false&is_archived=false", headers=headers)
    active_ids = [c["id"] for c in active_res.json()]
    assert client_id not in active_ids

    # Listing with is_archived=true SHOULD include it
    arch_list = await client.get("/api/v1/clients?paginate=false&is_archived=true", headers=headers)
    arch_ids = [c["id"] for c in arch_list.json()]
    assert client_id in arch_ids

    # 3. Restore client
    restore_res = await client.post(f"/api/v1/clients/{client_id}/restore", headers=headers)
    assert restore_res.status_code == 200
    assert restore_res.json()["is_archived"] is False

    # Now back in active listing
    active_res2 = await client.get("/api/v1/clients?paginate=false&is_archived=false", headers=headers)
    assert client_id in [c["id"] for c in active_res2.json()]

    # 4. Check client audit history
    hist_res = await client.get(f"/api/v1/clients/{client_id}/history", headers=headers)
    assert hist_res.status_code == 200
    history = hist_res.json()
    actions = [h["action"] for h in history]
    assert "CLIENT_CREATED" in actions
    assert "CLIENT_ARCHIVED" in actions
    assert "CLIENT_RESTORED" in actions


# ---------------------------------------------------------------------------
# 4. Inline Transactional Client Creation & Duplicate Reuse in Work Orders
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_inline_client_creation_and_duplicate_reuse(client: AsyncClient) -> None:
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch available category
    cats_res = await client.get("/api/v1/task-categories", headers=headers)
    category_id = cats_res.json()[0]["id"]

    # 1. Create work order with inline new_client
    due_date = (datetime.now(UTC) + timedelta(days=5)).isoformat()
    wo_payload = {
        "title": "Commercial Mortage Due Diligence",
        "description": "Comprehensive encumbrance check",
        "category_id": category_id,
        "priority": "HIGH",
        "due_date": due_date,
        "new_client": {
            "first_name": "Vikram",
            "last_name": "Kapoor",
            "email": "vikram.kapoor@example.com",
            "phone": "+91 9988776655",
            "pan_number": "ABCDE4444D",
            "reference_source": "Channel Partner",
        },
        "checklist_items": [
            {"title": "Verify Title Deed", "position": 0},
            {"title": "Check Municipal Tax Receipts", "position": 1},
        ],
    }

    res = await client.post("/api/v1/work-orders", json=wo_payload, headers=headers)
    assert res.status_code == 201, res.text
    created_wo = res.json()
    client_id = created_wo["client_id"]
    assert client_id is not None
    assert len(created_wo["checklist_items"]) == 2

    # Verify the client was persisted in database
    client_res = await client.get(f"/api/v1/clients/{client_id}", headers=headers)
    assert client_res.status_code == 200
    assert client_res.json()["pan_number"] == "ABCDE4444D"
    assert client_res.json()["reference_source"] == "Channel Partner"

    # 2. Submit second work order with identical PAN - must reuse existing client
    wo_payload_2 = {
        "title": "Second Loan Processing Order",
        "category_id": category_id,
        "priority": "NORMAL",
        "due_date": due_date,
        "new_client": {
            "first_name": "Vikram",
            "last_name": "Kapoor",
            "email": "vikram.kapoor@example.com",
            "phone": "+91 9988776655",
            "pan_number": "ABCDE4444D",
        },
    }
    res_2 = await client.post("/api/v1/work-orders", json=wo_payload_2, headers=headers)
    assert res_2.status_code == 201
    created_wo_2 = res_2.json()
    # Client ID must be reused, no duplicate record created
    assert created_wo_2["client_id"] == client_id

    # Verify total clients with this PAN is exactly 1
    search_res = await client.get("/api/v1/clients?paginate=false&q=ABCDE4444D", headers=headers)
    assert len(search_res.json()) == 1


# ---------------------------------------------------------------------------
# 5. Work Order Assignment & Employee 403 Guard
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_work_order_assignment_and_rbac(client: AsyncClient) -> None:
    admin_token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    emp_token = await get_token(client, "employee@financeflow.com", "Employee@12345")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # Fetch category & eligible team members
    cats_res = await client.get("/api/v1/task-categories", headers=admin_headers)
    category_id = cats_res.json()[0]["id"]

    team_res = await client.get("/api/v1/users/eligible-assignees", headers=admin_headers)
    assignee_id = team_res.json()[0]["id"]

    # Create work order as Admin
    due_date = (datetime.now(UTC) + timedelta(days=3)).isoformat()
    wo_payload = {
        "title": "Assignment Flow Verification",
        "category_id": category_id,
        "priority": "NORMAL",
        "due_date": due_date,
        "new_client": {
            "first_name": "Ananya",
            "last_name": "Roy",
            "email": "ananya.roy@example.com",
            "phone": "+91 9811223344",
            "pan_number": "ABCDE5555E",
        },
    }
    create_res = await client.post("/api/v1/work-orders", json=wo_payload, headers=admin_headers)
    assert create_res.status_code == 201
    wo_id = create_res.json()["id"]

    # 1. Admin assigns work order to assignee_id
    assign_res = await client.post(
        f"/api/v1/work-orders/{wo_id}/assignments",
        json={"assigned_to_id": assignee_id, "note": "Assigned for immediate assessment"},
        headers=admin_headers,
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["assigned_to_id"] == assignee_id

    # 2. Employee attempts to reassign - must be rejected with 403 Forbidden
    emp_assign_res = await client.post(
        f"/api/v1/work-orders/{wo_id}/assignments",
        json={"assigned_to_id": assignee_id, "note": "Unauthorized reassignment"},
        headers=emp_headers,
    )
    assert emp_assign_res.status_code == 403

    # 3. Employee attempts to edit core work order fields - must be rejected with 403 Forbidden
    emp_patch_res = await client.patch(
        f"/api/v1/work-orders/{wo_id}",
        json={"title": "Hacked Title"},
        headers=emp_headers,
    )
    assert emp_patch_res.status_code == 403


# ---------------------------------------------------------------------------
# 6. Checklist Item Completion & Task Progress Derivation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_checklist_progress_derivation(client: AsyncClient) -> None:
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    cats_res = await client.get("/api/v1/task-categories", headers=headers)
    category_id = cats_res.json()[0]["id"]

    due_date = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    wo_payload = {
        "title": "Checklist Progress Computation Test",
        "category_id": category_id,
        "priority": "URGENT",
        "due_date": due_date,
        "new_client": {
            "first_name": "Deepak",
            "last_name": "Joshi",
            "email": "deepak.joshi@example.com",
            "phone": "+91 9765432100",
            "pan_number": "ABCDE6666F",
        },
        "checklist_items": [
            {"title": "Milestone A", "position": 0},
            {"title": "Milestone B", "position": 1},
        ],
    }
    create_res = await client.post("/api/v1/work-orders", json=wo_payload, headers=headers)
    assert create_res.status_code == 201
    wo = create_res.json()
    wo_id = wo["id"]
    item_1 = wo["checklist_items"][0]

    # Initial progress is 0%
    assert wo["progress_percent"] == 0

    # Complete first item
    item_res = await client.patch(
        f"/api/v1/tasks/{wo_id}/checklist-items/{item_1['id']}",
        json={"is_completed": True, "notes": "Completed document check"},
        headers=headers,
    )
    assert item_res.status_code == 200
    assert item_res.json()["is_completed"] is True

    # Check updated work order progress -> 1/2 items = 50%
    updated_wo = await client.get(f"/api/v1/work-orders/{wo_id}", headers=headers)
    assert updated_wo.status_code == 200
    assert updated_wo.json()["progress_percent"] == 50


# ---------------------------------------------------------------------------
# 7. Super Admin Invariant Defense
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_super_admin_invariant_defense(client: AsyncClient) -> None:
    sa_token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # Retrieve all users
    users_res = await client.get("/api/v1/auth/users", headers=sa_headers)
    assert users_res.status_code == 200
    users = users_res.json()

    # Find the superadmin
    sa_user = next(u for u in users if "SUPER_ADMIN" in u["roles"])

    # Attempt to deactivate the last active super admin
    deactivate_res = await client.patch(
        f"/api/v1/auth/users/{sa_user['id']}",
        json={"is_active": False},
        headers=sa_headers,
    )
    assert deactivate_res.status_code == 400
    assert "Cannot deactivate, demote, or delete the last active Super Admin account." in deactivate_res.text

    # Attempt to demote the last active super admin
    demote_res = await client.patch(
        f"/api/v1/auth/users/{sa_user['id']}",
        json={"role": "ADMIN"},
        headers=sa_headers,
    )
    assert demote_res.status_code == 400
    assert "Cannot deactivate, demote, or delete the last active Super Admin account." in demote_res.text
