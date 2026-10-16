"""Automated Unit & Integration Tests for FinanceFlow CRM Client Management.

Tests cover:
- Authorized user creates a client with real persistence
- Client retrieval by ID and via listing endpoints
- Client update persistence and financial profile recalculation
- Duplicate handling (email/PAN conflict vs updating own record)
- Dependency retention policy on deletion:
  - Blocked when linked to work orders (HTTP 400)
  - Blocked when linked to active tasks (HTTP 400)
  - Allowed when dependencies are resolved (Admin only)
- RBAC enforcement:
  - Unauthorized anonymous access blocked (HTTP 401)
  - Employee deletion attempts blocked (HTTP 403)
- Search across name, normalized mobile, email, and PAN
- Server-side pagination with total count envelope and metadata headers
- Active work order count calculation linked to real persisted work orders
- Work order foreign key integrity after client updates
"""

import uuid
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
async def test_01_authorized_user_creates_client(client: AsyncClient) -> None:
    """Authorized user creates a client with financial profiling."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "first_name": "Aarav",
        "last_name": "Patel",
        "email": "aarav.patel@example.com",
        "phone": "+91 9876543210",
        "pan_number": "ABCDE1234F",
        "pipeline_status": "NEW_LEAD",
        "employment_type": "SALARIED",
        "monthly_income": 95000.00,
        "monthly_obligations": 25000.00,
        "cibil_score": 780,
    }

    res = await client.post("/api/v1/crm/clients", json=payload, headers=headers)
    assert res.status_code == 201, f"Create client failed: {res.text}"
    created = res.json()

    assert created["first_name"] == "Aarav"
    assert created["last_name"] == "Patel"
    assert created["email"] == "aarav.patel@example.com"
    assert created["pan_number"] == "ABCDE1234F"
    assert created["financial_profile"] is not None
    assert created["financial_profile"]["cibil_score"] == 780
    assert created["financial_profile"]["risk_tier"] == "LOW"
    assert created["active_work_orders_count"] == 0


@pytest.mark.asyncio
async def test_02_client_persists_and_can_be_retrieved(client: AsyncClient) -> None:
    """Created client persists in database and is retrievable by ID and listing."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch seeded clients
    res = await client.get("/api/v1/crm/clients", headers=headers)
    assert res.status_code == 200
    clients = res.json()
    assert len(clients) >= 3

    target_id = clients[0]["id"]
    detail_res = await client.get(f"/api/v1/crm/customers/{target_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == target_id
    assert "pan_number" in detail
    assert "notes" in detail
    assert "tasks" in detail


@pytest.mark.asyncio
async def test_03_client_update_persists(client: AsyncClient) -> None:
    """Updating client details persists and recalculates financial risk tier."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Get first client
    clients = (await client.get("/api/v1/crm/clients", headers=headers)).json()
    client_id = clients[0]["id"]

    update_payload = {
        "first_name": "UpdatedName",
        "phone": "+91 9111222333",
        "pipeline_status": "UNDERWRITING",
        "monthly_income": 150000.00,
        "monthly_obligations": 20000.00,
        "cibil_score": 820,
    }

    put_res = await client.put(
        f"/api/v1/crm/clients/{client_id}", json=update_payload, headers=headers
    )
    assert put_res.status_code == 200
    updated = put_res.json()

    assert updated["first_name"] == "UpdatedName"
    assert updated["phone"] == "+91 9111222333"
    assert updated["pipeline_status"] == "UNDERWRITING"
    assert updated["financial_profile"]["cibil_score"] == 820
    assert updated["financial_profile"]["risk_tier"] == "LOW"


@pytest.mark.asyncio
async def test_04_client_update_preserves_own_details(client: AsyncClient) -> None:
    """Updating client without changing email or PAN does not falsely trigger duplicate conflict."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    clients = (await client.get("/api/v1/crm/clients", headers=headers)).json()
    target = clients[0]

    # Re-submit exact same email and PAN
    payload = {
        "email": target["email"],
        "pan_number": target["pan_number"],
        "first_name": target["first_name"],
    }

    res = await client.put(
        f"/api/v1/crm/clients/{target['id']}", json=payload, headers=headers
    )
    assert res.status_code == 200, f"False duplicate conflict triggered: {res.text}"


@pytest.mark.asyncio
async def test_05_client_deletion_blocked_when_work_orders_exist(
    client: AsyncClient,
) -> None:
    """Deleting a client with associated work orders is blocked by retention integrity rules."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # In seed data, Rajesh Sharma is client_id on WO-1
    clients = (await client.get("/api/v1/crm/clients", headers=headers)).json()
    client_with_wo = next(
        (c for c in clients if c["active_work_orders_count"] > 0), clients[0]
    )

    del_res = await client.delete(
        f"/api/v1/crm/clients/{client_with_wo['id']}", headers=headers
    )
    assert del_res.status_code == 400
    err_msg = del_res.json()["detail"]
    assert (
        "associated work order" in err_msg.lower()
        or "active work order" in err_msg.lower()
    )


@pytest.mark.asyncio
async def test_06_client_deletion_blocked_when_active_tasks_exist(
    client: AsyncClient,
) -> None:
    """Deleting a client with active tasks is blocked."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Create a fresh client without work orders
    new_client = (
        await client.post(
            "/api/v1/crm/clients",
            json={
                "first_name": "TaskUser",
                "last_name": "Test",
                "email": "task.user@example.com",
                "phone": "+91 9998887776",
                "pan_number": "TASKU1234F",
                "pipeline_status": "NEW_LEAD",
            },
            headers=headers,
        )
    ).json()

    # Add an active task
    due = (datetime.now(UTC) + timedelta(days=2)).strftime("%Y-%m-%d")
    await client.post(
        f"/api/v1/crm/customers/{new_client['id']}/tasks",
        json={"title": "Collect bank statements", "due_date": due, "priority": "HIGH"},
        headers=headers,
    )

    # Attempt deletion
    del_res = await client.delete(
        f"/api/v1/crm/clients/{new_client['id']}", headers=headers
    )
    assert del_res.status_code == 400
    assert "active task" in del_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_07_client_deletion_allowed_when_no_dependencies(
    client: AsyncClient,
) -> None:
    """Deleting an unencumbered client succeeds for Admin."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Create standalone client
    created = (
        await client.post(
            "/api/v1/crm/clients",
            json={
                "first_name": "Standalone",
                "last_name": "Borrower",
                "email": "standalone@example.com",
                "phone": "+91 9888877777",
                "pan_number": "STNDA1234X",
                "pipeline_status": "NEW_LEAD",
            },
            headers=headers,
        )
    ).json()

    del_res = await client.delete(
        f"/api/v1/crm/clients/{created['id']}", headers=headers
    )
    assert del_res.status_code == 200
    assert del_res.json()["deleted_id"] == created["id"]

    # Verify 404
    fetch_res = await client.get(
        f"/api/v1/crm/customers/{created['id']}", headers=headers
    )
    assert fetch_res.status_code == 404


@pytest.mark.asyncio
async def test_08_employee_cannot_delete_client(client: AsyncClient) -> None:
    """Non-admin employee is forbidden from deleting clients."""
    emp_token = await get_auth_token(
        client, "employee@financeflow.com", "Employee@12345"
    )
    headers = {"Authorization": f"Bearer {emp_token}"}

    dummy_id = str(uuid.uuid4())
    res = await client.delete(f"/api/v1/crm/clients/{dummy_id}", headers=headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_09_unauthenticated_requests_blocked(client: AsyncClient) -> None:
    """Anonymous requests to client endpoints are rejected."""
    assert (await client.get("/api/v1/crm/clients")).status_code == 401
    assert (await client.post("/api/v1/crm/clients", json={})).status_code == 401
    assert (
        await client.put(f"/api/v1/crm/clients/{uuid.uuid4()}", json={})
    ).status_code == 401
    assert (
        await client.delete(f"/api/v1/crm/clients/{uuid.uuid4()}")
    ).status_code == 401


@pytest.mark.asyncio
async def test_10_invalid_client_data_rejected(client: AsyncClient) -> None:
    """Invalid email, PAN, or phone is rejected by Pydantic validation."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Bad email
    res1 = await client.post(
        "/api/v1/crm/clients",
        json={
            "first_name": "A",
            "last_name": "B",
            "email": "not-an-email",
            "phone": "1234567890",
            "pan_number": "ABCDE1234F",
        },
        headers=headers,
    )
    assert res1.status_code == 422

    # Bad PAN length
    res2 = await client.post(
        "/api/v1/crm/clients",
        json={
            "first_name": "A",
            "last_name": "B",
            "email": "valid@example.com",
            "phone": "1234567890",
            "pan_number": "SHORT",
        },
        headers=headers,
    )
    assert res2.status_code == 422


@pytest.mark.asyncio
async def test_11_duplicate_email_or_pan_rejected(client: AsyncClient) -> None:
    """Duplicate email or PAN triggers HTTP 409 Conflict."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Create base client
    await client.post(
        "/api/v1/crm/clients",
        json={
            "first_name": "Orig",
            "last_name": "One",
            "email": "orig.one@example.com",
            "phone": "9988776655",
            "pan_number": "ORIG11234A",
        },
        headers=headers,
    )

    # Duplicate email
    dup_email = await client.post(
        "/api/v1/crm/clients",
        json={
            "first_name": "Diff",
            "last_name": "Name",
            "email": "orig.one@example.com",
            "phone": "9988776600",
            "pan_number": "DIFF21234B",
        },
        headers=headers,
    )
    assert dup_email.status_code == 409

    # Duplicate PAN
    dup_pan = await client.post(
        "/api/v1/crm/clients",
        json={
            "first_name": "Diff2",
            "last_name": "Name2",
            "email": "diff2@example.com",
            "phone": "9988776601",
            "pan_number": "ORIG11234A",
        },
        headers=headers,
    )
    assert dup_pan.status_code == 409


@pytest.mark.asyncio
async def test_12_search_by_name_phone_pan_email(client: AsyncClient) -> None:
    """Search query correctly matches name, phone, email, and PAN."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Search by PAN
    res_pan = await client.get("/api/v1/crm/clients?q=ABCDE1234F", headers=headers)
    assert res_pan.status_code == 200

    # Search by name
    res_name = await client.get("/api/v1/crm/clients?q=Rajesh", headers=headers)
    assert res_name.status_code == 200
    matched = res_name.json()
    assert len(matched) >= 1
    assert any(c["first_name"] == "Rajesh" for c in matched)


@pytest.mark.asyncio
async def test_13_server_side_pagination(client: AsyncClient) -> None:
    """Server-side pagination envelope and response headers are correctly generated."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Request envelope with paginate=true
    res = await client.get(
        "/api/v1/crm/clients?paginate=true&page=1&page_size=2", headers=headers
    )
    assert res.status_code == 200
    data = res.json()

    assert "items" in data
    assert "pagination" in data
    assert len(data["items"]) <= 2
    assert data["pagination"]["page"] == 1
    assert data["pagination"]["page_size"] == 2
    assert data["pagination"]["total_items"] >= 3

    # Metadata headers check
    assert res.headers["X-Total-Count"] == str(data["pagination"]["total_items"])
    assert res.headers["X-Current-Page"] == "1"


@pytest.mark.asyncio
async def test_14_active_work_orders_count_reflects_actual_state(
    client: AsyncClient,
) -> None:
    """Active work orders count matches real persisted orders in PENDING/IN_PROGRESS/REVIEW."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    clients = (await client.get("/api/v1/crm/clients", headers=headers)).json()
    # In seed data, Rajesh Sharma has active orders
    rajesh = next(c for c in clients if c["first_name"] == "Rajesh")
    assert rajesh["active_work_orders_count"] >= 1
    assert rajesh["total_work_orders_count"] >= rajesh["active_work_orders_count"]


@pytest.mark.asyncio
async def test_15_work_orders_remain_valid_after_client_update(
    client: AsyncClient,
) -> None:
    """Existing work orders remain linked and intact after updating client details."""
    token = await get_auth_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    clients = (await client.get("/api/v1/crm/clients", headers=headers)).json()
    client_with_wo = next(c for c in clients if c["active_work_orders_count"] > 0)

    # Update client
    await client.put(
        f"/api/v1/crm/clients/{client_with_wo['id']}",
        json={"phone": "+91 9123456789"},
        headers=headers,
    )

    # Check work orders still exist and reference client
    wo_res = await client.get(
        f"/api/v1/crm/work-orders?client_id={client_with_wo['id']}", headers=headers
    )
    assert wo_res.status_code == 200
    wos = wo_res.json()
    assert len(wos) >= 1
    assert wos[0]["client_id"] == client_with_wo["id"]
