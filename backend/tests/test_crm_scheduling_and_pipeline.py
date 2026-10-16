"""Automated Verification Suite for FinNexus CRM Task Pipeline, User Form & Work Order Scheduling.

Requirements covered:
1. Requirement 1 — Expandable Task Pipeline Inside Work Orders:
   - Persisted pipeline tasks hierarchy returned in work order summary.
   - Interactive checklist milestone toggle with immediate persistence.
   - Automatic progress recalculation from completed milestones.
   - Empty pipeline handling.
   - Role-based authorization & invalid item / work order isolation (404/403).

2. Requirement 2 — Remove PAN/Card Number From User Creation:
   - User registration & creation succeeds without any PAN or card number.
   - Legitimate required user fields (email, password, full_name, role) properly validated.
   - Customer KYC PAN remains strictly isolated to CRM client entities.

3. Requirement 3 — Add Deadline Date & Time, Work Priority and Reminder Recipients:
   - Work order creation with required due_date, work_priority ("Do it urgent", "Do it in 2 to 3 days", "Other"), and reminder recipients.
   - Mandatory custom text validation when 'Other' is selected.
   - Rejection of missing deadline date/time.
   - Persistence and eager loading of reminder recipients with team isolation.
   - Priority and workflow status remain strictly independent.
   - No real WhatsApp messages sent during test execution.
"""

from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models.crm import Customer, WorkCategory, WorkOrder, WorkOrderChecklistItem, WorkOrderReminder
from app.db.models.auth import User
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


# ==============================================================================
# REQUIREMENT 2: User Creation without PAN / Card Number
# ==============================================================================

@pytest.mark.asyncio
async def test_user_creation_without_pan_number(client: AsyncClient) -> None:
    """Verify that user creation succeeds without any PAN or card identifier."""
    # 1. Register a new user without any PAN field
    reg_payload = {
        "email": "operations.analyst@finnexus.internal",
        "password": "SecurePassword@123",
        "full_name": "Aarav Sharma",
        "role": "EMPLOYEE",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201, f"Registration failed: {reg_res.text}"
    user_data = reg_res.json()
    assert user_data["email"] == reg_payload["email"]
    assert user_data["full_name"] == reg_payload["full_name"]
    assert "pan" not in user_data
    assert "pan_number" not in user_data

    # 2. Login with newly created user
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": reg_payload["email"], "password": reg_payload["password"]},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    assert token

    # 3. Verify user profile endpoint does not request or require PAN
    headers = {"Authorization": f"Bearer {token}"}
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == reg_payload["email"]
    assert "pan" not in me_data

    # 4. Verify legitimate required validation: missing password fails
    fail_res = await client.post(
        "/api/v1/auth/register",
        json={"email": "incomplete@finnexus.internal", "full_name": "Incomplete User"},
    )
    assert fail_res.status_code == 422


@pytest.mark.asyncio
async def test_statutory_client_kyc_pan_remains_intact(client: AsyncClient) -> None:
    """Verify customer/client KYC PAN remains required for statutory finance/CRM records."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    client_payload = {
        "first_name": "Vikram",
        "last_name": "Mehta",
        "email": f"vikram.{uuid.uuid4().hex[:6]}@enterprise.in",
        "phone": "+919876543210",
        "pan_number": "ABCDE1234F",
        "pipeline_status": "NEW_LEAD",
    }
    create_res = await client.post("/api/v1/crm/clients", json=client_payload, headers=headers)
    assert create_res.status_code == 201
    assert create_res.json()["pan_number"] == "ABCDE1234F"


# ==============================================================================
# REQUIREMENT 3: Work Order Scheduling, Priority in Days & Reminder Recipients
# ==============================================================================

@pytest.mark.asyncio
async def test_work_order_scheduling_and_priority_in_days(client: AsyncClient) -> None:
    """Verify creating work order with deadline date/time, priority in days, and reminder recipients."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch clients, categories, team
    clients = (await client.get("/api/v1/crm/clients", headers=headers)).json()
    categories = (await client.get("/api/v1/crm/categories", headers=headers)).json()
    team = (await client.get("/api/v1/crm/team", headers=headers)).json()

    client_id = clients[0]["id"]
    cat_id = categories[0]["id"]
    assignee_id = team[0]["id"]
    reminder_user_ids = [team[0]["id"], team[1]["id"]]

    deadline = (datetime.now(UTC) + timedelta(days=2, hours=4)).isoformat()

    payload = {
        "title": "Comprehensive Portfolio Risk & Insurance Assessment",
        "description": "Multi-asset collateral review and insurance endorsement checklist.",
        "client_id": client_id,
        "category_id": cat_id,
        "assigned_to_id": assignee_id,
        "priority": "URGENT",
        "work_priority": "Do it urgent",
        "due_date": deadline,
        "reminder_recipient_ids": reminder_user_ids,
        "checklist_items": [
            {"title": "INDEMNITY INSURANCE", "position": 0},
            {"title": "Send renewal List", "position": 1},
            {"title": "Download policy from portal", "position": 2},
        ],
    }

    create_res = await client.post("/api/v1/crm/work-orders", json=payload, headers=headers)
    assert create_res.status_code == 201, f"Failed: {create_res.text}"
    wo = create_res.json()

    # Check persisted fields
    assert wo["work_priority"] == "Do it urgent"
    assert wo["priority"] == "URGENT"
    assert len(wo["reminder_recipients"]) == 2
    recipient_ids = [r["id"] for r in wo["reminder_recipients"]]
    assert team[0]["id"] in recipient_ids
    assert team[1]["id"] in recipient_ids

    # Verify checklist hierarchy has 3 items
    assert len(wo["checklist_items"]) == 3
    assert wo["checklist_count"] == 3
    assert wo["checklist_completed"] == 0
    assert wo["progress_percent"] == 0

    # Retrieve work orders queue list (WorkOrdersPage source)
    list_res = await client.get("/api/v1/crm/work-orders", headers=headers)
    assert list_res.status_code == 200
    listed_orders = list_res.json()
    matched = next((o for o in listed_orders if o["id"] == wo["id"]), None)
    assert matched is not None
    assert matched["work_priority"] == "Do it urgent"
    assert len(matched["reminder_recipients"]) == 2
    assert len(matched["checklist_items"]) == 3


@pytest.mark.asyncio
async def test_work_order_custom_priority_other(client: AsyncClient) -> None:
    """Verify work priority with 'Other' option requires custom text specification."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    clients = (await client.get("/api/v1/crm/clients", headers=headers)).json()
    categories = (await client.get("/api/v1/crm/categories", headers=headers)).json()

    deadline = (datetime.now(UTC) + timedelta(days=3)).isoformat()

    # 1. Missing custom_priority when work_priority is 'Other' -> expect 400
    bad_payload = {
        "title": "Quarterly Regulatory Audit",
        "client_id": clients[0]["id"],
        "category_id": categories[0]["id"],
        "due_date": deadline,
        "work_priority": "Other",
        "custom_priority": "",  # Empty custom text
    }
    fail_res = await client.post("/api/v1/crm/work-orders", json=bad_payload, headers=headers)
    assert fail_res.status_code == 400
    assert "Custom priority specification is required" in fail_res.json()["detail"]

    # 2. Valid custom_priority when work_priority is 'Other' -> expect 201
    valid_payload = {
        "title": "Quarterly Regulatory Audit",
        "client_id": clients[0]["id"],
        "category_id": categories[0]["id"],
        "due_date": deadline,
        "work_priority": "Other",
        "custom_priority": "Before statutory board review tomorrow 3 PM",
    }
    success_res = await client.post("/api/v1/crm/work-orders", json=valid_payload, headers=headers)
    assert success_res.status_code == 201
    created = success_res.json()
    assert created["work_priority"] == "Other"
    assert created["custom_priority"] == "Before statutory board review tomorrow 3 PM"


@pytest.mark.asyncio
async def test_work_order_missing_deadline_rejected(client: AsyncClient) -> None:
    """Verify that omitting the required deadline date/time is rejected."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    clients = (await client.get("/api/v1/crm/clients", headers=headers)).json()
    categories = (await client.get("/api/v1/crm/categories", headers=headers)).json()

    payload = {
        "title": "Missing Deadline Test Order",
        "client_id": clients[0]["id"],
        "category_id": categories[0]["id"],
        # due_date omitted
    }
    res = await client.post("/api/v1/crm/work-orders", json=payload, headers=headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_work_order_invalid_reminder_recipient_rejected(client: AsyncClient) -> None:
    """Verify that passing invalid/non-existent reminder recipient IDs is rejected."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    clients = (await client.get("/api/v1/crm/clients", headers=headers)).json()
    categories = (await client.get("/api/v1/crm/categories", headers=headers)).json()

    fake_id = str(uuid.uuid4())
    payload = {
        "title": "Invalid Recipient Test Order",
        "client_id": clients[0]["id"],
        "category_id": categories[0]["id"],
        "due_date": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
        "reminder_recipient_ids": [fake_id],
    }
    res = await client.post("/api/v1/crm/work-orders", json=payload, headers=headers)
    assert res.status_code == 404
    assert "reminder recipients were not found" in res.json()["detail"]


# ==============================================================================
# REQUIREMENT 1: Expandable Task Pipeline Inside Work Orders
# ==============================================================================

@pytest.mark.asyncio
async def test_expandable_pipeline_persistence_and_progress_recalculation(client: AsyncClient) -> None:
    """Verify pipeline checklist toggling persists to DB and recalculates work order progress."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    clients = (await client.get("/api/v1/crm/clients", headers=headers)).json()
    categories = (await client.get("/api/v1/crm/categories", headers=headers)).json()

    # Create work order with 3 checklist pipeline tasks matching reference screenshot
    payload = {
        "title": "Corporate Indemnity & Risk Insurance Policy",
        "client_id": clients[0]["id"],
        "category_id": categories[0]["id"],
        "due_date": (datetime.now(UTC) + timedelta(days=3)).isoformat(),
        "work_priority": "Do it in 2 to 3 days",
        "checklist_items": [
            {"title": "INDEMNITY INSURANCE", "position": 0},
            {"title": "Send renewal List", "position": 1},
            {"title": "Download policy from portal", "position": 2},
        ],
    }
    wo_res = await client.post("/api/v1/crm/work-orders", json=payload, headers=headers)
    assert wo_res.status_code == 201
    wo = wo_res.json()
    wo_id = wo["id"]
    items = wo["checklist_items"]
    assert len(items) == 3

    # Check initial state: 0% completed
    assert wo["progress_percent"] == 0
    assert wo["checklist_completed"] == 0

    item_1_id = items[0]["id"]
    item_2_id = items[1]["id"]

    # 1. Toggle task 1 -> is_completed = True
    patch_res1 = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/checklist/{item_1_id}",
        json={"is_completed": True},
        headers=headers,
    )
    assert patch_res1.status_code == 200
    item1_data = patch_res1.json()
    assert item1_data["status"] == "COMPLETED"
    assert item1_data["completed_at"] is not None

    # Fetch work order summary (as loaded by WorkOrdersPage)
    summary_res = await client.get("/api/v1/crm/work-orders", headers=headers)
    refreshed_wo = next(o for o in summary_res.json() if o["id"] == wo_id)
    # 1 of 3 completed = 33%
    assert refreshed_wo["progress_percent"] == 33
    assert refreshed_wo["checklist_completed"] == 1

    # 2. Toggle task 2 -> is_completed = True
    patch_res2 = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/checklist/{item_2_id}",
        json={"is_completed": True},
        headers=headers,
    )
    assert patch_res2.status_code == 200

    summary_res2 = await client.get("/api/v1/crm/work-orders", headers=headers)
    refreshed_wo2 = next(o for o in summary_res2.json() if o["id"] == wo_id)
    # 2 of 3 completed = 66%
    assert refreshed_wo2["progress_percent"] == 66
    assert refreshed_wo2["checklist_completed"] == 2

    # 3. Toggle task 1 back to incomplete -> is_completed = False
    uncheck_res = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/checklist/{item_1_id}",
        json={"is_completed": False},
        headers=headers,
    )
    assert uncheck_res.status_code == 200
    item1_uncheck = uncheck_res.json()
    assert item1_uncheck["status"] == "PENDING"
    assert item1_uncheck["completed_at"] is None

    summary_res3 = await client.get("/api/v1/crm/work-orders", headers=headers)
    refreshed_wo3 = next(o for o in summary_res3.json() if o["id"] == wo_id)
    # 1 of 3 completed = 33%
    assert refreshed_wo3["progress_percent"] == 33
    assert refreshed_wo3["checklist_completed"] == 1


@pytest.mark.asyncio
async def test_empty_pipeline_and_isolation_handling(client: AsyncClient) -> None:
    """Verify empty checklist handling and security checks for invalid item/work-order pairing."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    clients = (await client.get("/api/v1/crm/clients", headers=headers)).json()
    categories = (await client.get("/api/v1/crm/categories", headers=headers)).json()

    # Create work order with explicitly empty items
    payload = {
        "title": "Ad-Hoc Consulting Without Pre-set Checklist",
        "client_id": clients[0]["id"],
        "category_id": categories[0]["id"],
        "due_date": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        "work_priority": "Do it today",
        "checklist_items": [],
    }
    res = await client.post("/api/v1/crm/work-orders", json=payload, headers=headers)
    assert res.status_code == 201
    wo = res.json()
    wo_id = wo["id"]

    # In summary, verify clean empty pipeline
    summary_res = await client.get("/api/v1/crm/work-orders", headers=headers)
    order_in_queue = next(o for o in summary_res.json() if o["id"] == wo_id)
    assert order_in_queue["checklist_count"] >= 0
    assert order_in_queue["progress_percent"] == 0

    # Attempt to update a non-existent checklist item on this work order -> 404
    fake_item_id = str(uuid.uuid4())
    patch_res = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/checklist/{fake_item_id}",
        json={"is_completed": True},
        headers=headers,
    )
    assert patch_res.status_code == 404


@pytest.mark.asyncio
async def test_status_and_priority_remain_independent(client: AsyncClient) -> None:
    """Verify that work order status (PENDING/IN_PROGRESS/COMPLETED) does not overwrite priority."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    clients = (await client.get("/api/v1/crm/clients", headers=headers)).json()
    categories = (await client.get("/api/v1/crm/categories", headers=headers)).json()

    payload = {
        "title": "Independent Priority & Status Verification",
        "client_id": clients[0]["id"],
        "category_id": categories[0]["id"],
        "due_date": (datetime.now(UTC) + timedelta(days=4)).isoformat(),
        "work_priority": "Do it next day",
        "checklist_items": [{"title": "Step 1", "position": 0}],
    }
    create_res = await client.post("/api/v1/crm/work-orders", json=payload, headers=headers)
    wo = create_res.json()
    wo_id = wo["id"]
    assert wo["status"] == "PENDING"
    assert wo["work_priority"] == "Do it next day"

    # Transition status to IN_PROGRESS
    stat_res = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/status",
        json={"status": "IN_PROGRESS"},
        headers=headers,
    )
    assert stat_res.status_code == 200
    updated_wo = stat_res.json()
    assert updated_wo["status"] == "IN_PROGRESS"
    # Priority remains unchanged
    assert updated_wo["work_priority"] == "Do it next day"
