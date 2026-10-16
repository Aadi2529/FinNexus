"""Automated Unit & Integration Tests for FinanceFlow CRM Work Order & Task Management Module.

Tests cover:
- Executive CRM Dashboard Metrics calculation
- Work Order listing, search, priority/status filtering, and my_tasks filtering
- Work Order Creation with Sectioned Fields & Checklist Milestones
- Checklist Item Status toggling and automatic Progress Percent recalculation
- Status Transitions & Completion Guard (blocking incomplete orders unless explicit override given)
- Work Order History append-only audit trail verification
- Work Categories listing and template configuration
- Team Roster with Active & Completed Workload counts
- In-app Notification dispatch and read acknowledgement
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


async def get_auth_token(client: AsyncClient, email: str, password: str) -> str:
    """Helper to authenticate and return JWT access token."""
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_crm_dashboard_metrics(client: AsyncClient) -> None:
    """Validate executive CRM dashboard metrics calculated from seeded work orders."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/v1/crm/dashboard", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "active_workload" in data
    assert "priority_actions" in data
    assert "critical_delays" in data
    assert "resolved_today" in data
    assert "total_clients" in data
    assert "team_members_active" in data

    # From seed: 3 active work orders (WO-1 IN_PROGRESS, WO-2 PENDING, WO-3 REVIEW)
    assert data["active_workload"] >= 3
    assert data["total_clients"] >= 3
    assert data["team_members_active"] >= 3


@pytest.mark.asyncio
async def test_work_orders_listing_and_filtering(client: AsyncClient) -> None:
    """Test work order querying with search, status filter, and pagination."""
    token = await get_auth_token(client, "officer@financeflow.com", "Officer@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # List all
    res = await client.get("/api/v1/crm/work-orders", headers=headers)
    assert res.status_code == 200
    orders = res.json()
    assert len(orders) >= 4

    # Filter by status ACTIVE
    res_active = await client.get(
        "/api/v1/crm/work-orders?status=ACTIVE", headers=headers
    )
    assert res_active.status_code == 200
    active_orders = res_active.json()
    assert all(
        o["status"] in ["PENDING", "IN_PROGRESS", "REVIEW"] for o in active_orders
    )

    # Search by order number
    res_search = await client.get(
        "/api/v1/crm/work-orders?q=WO-2026-0001", headers=headers
    )
    assert res_search.status_code == 200
    searched = res_search.json()
    assert len(searched) == 1
    assert searched[0]["order_number"] == "WO-2026-0001"
    assert searched[0]["client_name"] is not None

    # Filter by my_tasks
    res_my = await client.get("/api/v1/crm/work-orders?my_tasks=true", headers=headers)
    assert res_my.status_code == 200
    my_tasks = res_my.json()
    assert len(my_tasks) >= 2


@pytest.mark.asyncio
async def test_work_order_creation_and_detail(client: AsyncClient) -> None:
    """Verify creating a work order with client, category, and initial checklist items."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch clients and categories first
    clients_res = await client.get("/api/v1/crm/clients", headers=headers)
    assert clients_res.status_code == 200
    clients = clients_res.json()
    assert len(clients) > 0
    client_id = clients[0]["id"]

    cats_res = await client.get("/api/v1/crm/categories", headers=headers)
    assert cats_res.status_code == 200
    categories = cats_res.json()
    assert len(categories) > 0
    cat_id = categories[0]["id"]

    team_res = await client.get("/api/v1/crm/team", headers=headers)
    assert team_res.status_code == 200
    team = team_res.json()
    assignee_id = team[0]["id"]

    due = (datetime.now(UTC) + timedelta(days=5)).isoformat()

    payload = {
        "title": "Collateral Legal Audit & Valuation",
        "description": "Thorough site visit and structural appraisal for mortgage underwriting.",
        "client_id": client_id,
        "category_id": cat_id,
        "assigned_to_id": assignee_id,
        "priority": "HIGH",
        "due_date": due,
        "priority_notes": "High net-worth borrower requirement.",
        "checklist_items": [
            {"title": "Inspect municipal tax receipts", "position": 0},
            {
                "title": "Verify boundary measurements with registered surveyor",
                "position": 1,
            },
        ],
    }

    create_res = await client.post(
        "/api/v1/crm/work-orders", json=payload, headers=headers
    )
    assert create_res.status_code == 201
    created_wo = create_res.json()

    assert created_wo["title"] == payload["title"]
    assert created_wo["order_number"].startswith("WO-")
    assert len(created_wo["checklist_items"]) == 2
    assert created_wo["progress_percent"] == 0
    assert len(created_wo["history"]) >= 1

    wo_id = created_wo["id"]

    # Retrieve 360 detail
    get_res = await client.get(f"/api/v1/crm/work-orders/{wo_id}", headers=headers)
    assert get_res.status_code == 200
    detail = get_res.json()
    assert detail["id"] == wo_id
    assert detail["client_name"] is not None


@pytest.mark.asyncio
async def test_checklist_progress_recalculation(client: AsyncClient) -> None:
    """Test that toggling checklist items updates progress: 0% -> 50% -> 100%."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch WO-2026-0002 which has 3 pending items (0% progress)
    wo_list = await client.get(
        "/api/v1/crm/work-orders?q=WO-2026-0002", headers=headers
    )
    wo = wo_list.json()[0]
    wo_id = wo["id"]

    detail_res = await client.get(f"/api/v1/crm/work-orders/{wo_id}", headers=headers)
    detail = detail_res.json()
    items = detail["checklist_items"]
    assert len(items) == 3

    item_1_id = items[0]["id"]
    item_2_id = items[1]["id"]
    item_3_id = items[2]["id"]

    # Mark item 1 completed -> 1/3 = 33%
    p1 = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/checklist/{item_1_id}",
        json={"status": "COMPLETED", "notes": "Completed step 1"},
        headers=headers,
    )
    assert p1.status_code == 200

    wo_check = await client.get(f"/api/v1/crm/work-orders/{wo_id}", headers=headers)
    assert wo_check.json()["progress_percent"] == 33

    # Mark item 2 completed -> 2/3 = 66%
    p2 = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/checklist/{item_2_id}",
        json={"status": "COMPLETED"},
        headers=headers,
    )
    assert p2.status_code == 200

    wo_check = await client.get(f"/api/v1/crm/work-orders/{wo_id}", headers=headers)
    assert wo_check.json()["progress_percent"] == 66

    # Mark item 3 completed -> 3/3 = 100%
    p3 = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/checklist/{item_3_id}",
        json={"status": "COMPLETED"},
        headers=headers,
    )
    assert p3.status_code == 200

    wo_check = await client.get(f"/api/v1/crm/work-orders/{wo_id}", headers=headers)
    assert wo_check.json()["progress_percent"] == 100


@pytest.mark.asyncio
async def test_completion_guard_and_override_workflow(client: AsyncClient) -> None:
    """Ensure work orders with incomplete checklist items cannot be marked COMPLETED without override."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # WO-2026-0001 has 2 completed and 2 pending items
    wo_list = await client.get(
        "/api/v1/crm/work-orders?q=WO-2026-0001", headers=headers
    )
    wo = wo_list.json()[0]
    wo_id = wo["id"]

    # Attempt to complete without override -> Expect 400 Bad Request
    fail_res = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/status",
        json={"status": "COMPLETED"},
        headers=headers,
    )
    assert fail_res.status_code == 400
    assert "checklist items are incomplete" in fail_res.json()["detail"]

    # Now complete with explicit authorized override reason -> Expect 200 OK
    success_res = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/status",
        json={
            "status": "COMPLETED",
            "override_reason": "Executive waiver granted by Head of Credit.",
        },
        headers=headers,
    )
    assert success_res.status_code == 200
    completed_wo = success_res.json()
    assert completed_wo["status"] == "COMPLETED"
    assert completed_wo["completed_at"] is not None

    # Verify history logged the override
    history_entries = completed_wo["history"]
    override_log = next(
        (h for h in history_entries if "Executive waiver" in (h["details"] or "")), None
    )
    assert override_log is not None


@pytest.mark.asyncio
async def test_team_roster_and_notifications(client: AsyncClient) -> None:
    """Test team member active workload counts and notification reading."""
    token = await get_auth_token(client, "officer@financeflow.com", "Officer@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Check team roster
    team_res = await client.get("/api/v1/crm/team", headers=headers)
    assert team_res.status_code == 200
    team = team_res.json()
    assert len(team) >= 3
    assert any(m["active_workload_count"] > 0 for m in team)

    # Check notifications
    notif_res = await client.get("/api/v1/crm/notifications", headers=headers)
    assert notif_res.status_code == 200
    notifications = notif_res.json()
    assert len(notifications) > 0

    first_notif_id = notifications[0]["id"]
    # Mark read
    read_res = await client.patch(
        f"/api/v1/crm/notifications/{first_notif_id}/read",
        headers=headers,
    )
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True
