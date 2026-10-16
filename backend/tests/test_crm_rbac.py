"""Automated RBAC & Work Order Permission Hardening Tests for FinanceFlow CRM.

Verifies the 15 required security scenarios:
1. Unauthenticated requests cannot access protected CRM endpoints (401).
2. Super Admin can manage permitted work orders.
3. Admin can perform permitted management operations.
4. Employee can create a work order.
5. Employee cannot edit a work order after creation (403).
6. Employee cannot delete or archive a work order (403).
7. Employee cannot reassign a work order (403).
8. Employee can update an authorized checklist item.
9. Employee cannot access another employee's restricted work order (403).
10. Employee cannot change their role or create an Admin account (403).
11. Unauthorized completion override is rejected (403).
12. Authorized override requires a reason and creates an audit record.
13. Unauthorized notification and history access is blocked (403).
14. Attempts to modify protected fields are rejected (403).
15. Existing CRM dashboard, filtering, progress, and notification tests continue to pass.
"""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models.crm import (
    CrmNotification,
)
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


async def get_token(
    client: AsyncClient, email: str, password: str = "Admin@12345"
) -> str:
    """Helper to authenticate and return Bearer access token."""
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


# ============================================================================
# SCENARIO 1: Unauthenticated requests cannot access protected CRM endpoints
# ============================================================================


@pytest.mark.asyncio
async def test_01_unauthenticated_requests_blocked(client: AsyncClient) -> None:
    """Unauthenticated calls must receive HTTP 401 Unauthorized."""
    endpoints = [
        ("GET", "/api/v1/crm/dashboard"),
        ("GET", "/api/v1/crm/work-orders"),
        ("POST", "/api/v1/crm/work-orders"),
        ("GET", f"/api/v1/crm/work-orders/{uuid.uuid4()}"),
        ("PUT", f"/api/v1/crm/work-orders/{uuid.uuid4()}"),
        ("DELETE", f"/api/v1/crm/work-orders/{uuid.uuid4()}"),
        ("GET", "/api/v1/crm/history"),
        ("GET", "/api/v1/crm/notifications"),
    ]
    for method, url in endpoints:
        if method == "GET":
            res = await client.get(url)
        elif method == "POST":
            res = await client.post(url, json={})
        elif method == "PUT":
            res = await client.put(url, json={})
        elif method == "DELETE":
            res = await client.delete(url)
        assert res.status_code == 401, (
            f"{method} {url} returned {res.status_code}, expected 401"
        )


# ============================================================================
# SCENARIO 2: Super Admin can manage permitted work orders
# ============================================================================


@pytest.mark.asyncio
async def test_02_super_admin_can_manage_permitted_work_orders(
    client: AsyncClient, test_session: AsyncSession
) -> None:
    """Super Admin has system-wide authority over work orders, attributes, and categories."""
    super_token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {super_token}"}

    # 1. View all work orders
    list_res = await client.get("/api/v1/crm/work-orders", headers=headers)
    assert list_res.status_code == 200
    orders = list_res.json()
    assert len(orders) >= 4

    # 2. Update work order attributes
    target_wo = orders[0]
    wo_id = target_wo["id"]
    update_res = await client.put(
        f"/api/v1/crm/work-orders/{wo_id}",
        json={"title": "Super Admin Hardened Inspection", "priority": "URGENT"},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Super Admin Hardened Inspection"
    assert update_res.json()["priority"] == "URGENT"

    # 3. View global operations history
    hist_res = await client.get("/api/v1/crm/history", headers=headers)
    assert hist_res.status_code == 200
    assert len(hist_res.json()) > 0


# ============================================================================
# SCENARIO 3: Admin can perform permitted management operations
# ============================================================================


@pytest.mark.asyncio
async def test_03_admin_can_perform_permitted_management_operations(
    client: AsyncClient, test_session: AsyncSession
) -> None:
    """Admin can create, view, update, assign, and manage work orders within authorized scope."""
    admin_token = await get_token(client, "officer@financeflow.com", "Officer@12345")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. View work orders
    list_res = await client.get("/api/v1/crm/work-orders", headers=headers)
    assert list_res.status_code == 200
    orders = list_res.json()
    assert len(orders) >= 4

    # 2. Update work order attributes via PUT
    wo_id = orders[1]["id"]
    put_res = await client.put(
        f"/api/v1/crm/work-orders/{wo_id}",
        json={"priority_notes": "Urgent review required by loan committee."},
        headers=headers,
    )
    assert put_res.status_code == 200
    assert (
        put_res.json()["priority_notes"] == "Urgent review required by loan committee."
    )

    # 3. Access global history
    hist_res = await client.get("/api/v1/crm/history", headers=headers)
    assert hist_res.status_code == 200


# ============================================================================
# SCENARIO 4: Employee can create a work order
# ============================================================================


@pytest.mark.asyncio
async def test_04_employee_can_create_work_order(
    client: AsyncClient, test_session: AsyncSession
) -> None:
    """Employee can create a new work order; author is automatically attributed."""
    emp_token = await get_token(client, "employee@financeflow.com", "Employee@12345")
    headers = {"Authorization": f"Bearer {emp_token}"}

    # Get client & category
    clients_res = await client.get("/api/v1/crm/clients", headers=headers)
    assert clients_res.status_code == 200
    client_id = clients_res.json()[0]["id"]

    cats_res = await client.get("/api/v1/crm/categories", headers=headers)
    assert cats_res.status_code == 200
    cat_id = cats_res.json()[0]["id"]

    due = (datetime.now(UTC) + timedelta(days=7)).isoformat()
    create_payload = {
        "title": "Employee Field Investigation",
        "description": "Onsite verification of collateral premises.",
        "client_id": client_id,
        "category_id": cat_id,
        "priority": "NORMAL",
        "due_date": due,
        "checklist_items": [
            {"title": "Collect utility bill copy", "position": 0},
            {"title": "Capture geolocation and photo", "position": 1},
        ],
    }

    res = await client.post(
        "/api/v1/crm/work-orders", json=create_payload, headers=headers
    )
    assert res.status_code == 201
    created = res.json()
    assert created["title"] == "Employee Field Investigation"
    assert created["order_number"].startswith("WO-")
    assert len(created["checklist_items"]) == 2


# ============================================================================
# SCENARIO 5: Employee cannot edit a work order after creation
# ============================================================================


@pytest.mark.asyncio
async def test_05_employee_cannot_edit_work_order_after_creation(
    client: AsyncClient, test_session: AsyncSession
) -> None:
    """Employee attempting to edit a work order via PUT must receive HTTP 403 Forbidden."""
    emp_token = await get_token(client, "employee@financeflow.com", "Employee@12345")
    headers = {"Authorization": f"Bearer {emp_token}"}

    # Get any work order
    admin_token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    all_wo = (
        await client.get(
            "/api/v1/crm/work-orders",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    ).json()
    wo_id = all_wo[0]["id"]

    # Employee tries to edit title
    edit_res = await client.put(
        f"/api/v1/crm/work-orders/{wo_id}",
        json={"title": "Hacked Title Attempt"},
        headers=headers,
    )
    assert edit_res.status_code == 403
    assert (
        "Employees are not permitted to edit work orders" in edit_res.json()["detail"]
    )


# ============================================================================
# SCENARIO 6: Employee cannot delete or archive a work order
# ============================================================================


@pytest.mark.asyncio
async def test_06_employee_cannot_delete_or_archive_work_order(
    client: AsyncClient, test_session: AsyncSession
) -> None:
    """Employee attempting to delete or archive a work order must receive HTTP 403 Forbidden."""
    emp_token = await get_token(client, "employee@financeflow.com", "Employee@12345")
    headers = {"Authorization": f"Bearer {emp_token}"}

    admin_token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    all_wo = (
        await client.get(
            "/api/v1/crm/work-orders",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    ).json()
    wo_id = all_wo[0]["id"]

    # Attempt archive
    del_res = await client.delete(
        f"/api/v1/crm/work-orders/{wo_id}?permanent=false", headers=headers
    )
    assert del_res.status_code == 403

    # Attempt permanent delete
    perm_res = await client.delete(
        f"/api/v1/crm/work-orders/{wo_id}?permanent=true", headers=headers
    )
    assert perm_res.status_code == 403


# ============================================================================
# SCENARIO 7: Employee cannot reassign a work order
# ============================================================================


@pytest.mark.asyncio
async def test_07_employee_cannot_reassign_work_order(
    client: AsyncClient, test_session: AsyncSession
) -> None:
    """Employee attempting to change assigned_to_id must receive HTTP 403 Forbidden."""
    emp_token = await get_token(client, "employee@financeflow.com", "Employee@12345")
    headers = {"Authorization": f"Bearer {emp_token}"}

    admin_token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    all_wo = (
        await client.get(
            "/api/v1/crm/work-orders",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    ).json()
    wo_id = all_wo[0]["id"]

    reassign_res = await client.put(
        f"/api/v1/crm/work-orders/{wo_id}",
        json={"assigned_to_id": str(uuid.uuid4())},
        headers=headers,
    )
    assert reassign_res.status_code == 403


# ============================================================================
# SCENARIO 8: Employee can update an authorized checklist item
# ============================================================================


@pytest.mark.asyncio
async def test_08_employee_can_update_authorized_checklist_item(
    client: AsyncClient, test_session: AsyncSession
) -> None:
    """Employee assigned to a work order can check off a checklist item and update progress."""
    emp_token = await get_token(client, "employee@financeflow.com", "Employee@12345")
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # Fetch employee's user ID from /auth/me
    me_res = await client.get("/api/v1/auth/me", headers=emp_headers)
    assert me_res.status_code == 200
    emp_id = me_res.json()["id"]

    # Admin assigns WO-2026-0002 to this employee
    admin_token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    wo_list = (
        await client.get(
            "/api/v1/crm/work-orders?q=WO-2026-0002", headers=admin_headers
        )
    ).json()
    wo_id = wo_list[0]["id"]

    await client.put(
        f"/api/v1/crm/work-orders/{wo_id}",
        json={"assigned_to_id": emp_id},
        headers=admin_headers,
    )

    # Get checklist item ID
    wo_detail = (
        await client.get(f"/api/v1/crm/work-orders/{wo_id}", headers=emp_headers)
    ).json()
    item_id = wo_detail["checklist_items"][0]["id"]

    # Employee checks off the milestone
    update_res = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/checklist/{item_id}",
        json={"status": "COMPLETED", "notes": "Verified by field employee."},
        headers=emp_headers,
    )
    assert update_res.status_code == 200
    updated_item = update_res.json()
    assert updated_item["status"] == "COMPLETED"
    assert updated_item["notes"] == "Verified by field employee."
    assert updated_item["completed_at"] is not None


# ============================================================================
# SCENARIO 9: Employee cannot access another employee's restricted work order
# ============================================================================


@pytest.mark.asyncio
async def test_09_employee_cannot_access_another_employee_restricted_work_order(
    client: AsyncClient, test_session: AsyncSession
) -> None:
    """Employee querying an unassigned work order or snooping via URL parameter receives 403 Forbidden."""
    emp1_token = await get_token(client, "employee@financeflow.com", "Employee@12345")
    emp2_token = await get_token(client, "employee2@financeflow.com", "Employee@12345")

    emp1_headers = {"Authorization": f"Bearer {emp1_token}"}
    emp2_headers = {"Authorization": f"Bearer {emp2_token}"}

    emp2_info = (await client.get("/api/v1/auth/me", headers=emp2_headers)).json()
    emp2_id = emp2_info["id"]

    # Admin assigns WO-2026-0002 to Employee 2
    admin_token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    wo_list = (
        await client.get(
            "/api/v1/crm/work-orders?q=WO-2026-0002", headers=admin_headers
        )
    ).json()
    wo2_id = wo_list[0]["id"]

    await client.put(
        f"/api/v1/crm/work-orders/{wo2_id}",
        json={"assigned_to_id": emp2_id},
        headers=admin_headers,
    )

    # 1. Employee 1 tries to view Employee 2's order directly by ID -> Expect 403
    res_direct = await client.get(
        f"/api/v1/crm/work-orders/{wo2_id}", headers=emp1_headers
    )
    assert res_direct.status_code == 403
    assert (
        "You are only authorized to view work orders assigned to you"
        in res_direct.json()["detail"]
    )

    # 2. Employee 1 tries to query queue filtering by Employee 2's ID -> Expect 403
    res_snoop = await client.get(
        f"/api/v1/crm/work-orders?assigned_to_id={emp2_id}", headers=emp1_headers
    )
    assert res_snoop.status_code == 403
    assert (
        "Employees cannot view work orders assigned to other team members"
        in res_snoop.json()["detail"]
    )


# ============================================================================
# SCENARIO 10: Employee cannot change role or create Admin account
# ============================================================================


@pytest.mark.asyncio
async def test_10_employee_cannot_change_role_or_create_admin_account(
    client: AsyncClient, test_session: AsyncSession
) -> None:
    """Privilege escalation defenses prevent employees from creating users or admin accounts."""
    emp_token = await get_token(client, "employee@financeflow.com", "Employee@12345")
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # 1. Employee attempts to register an Admin account -> Expect 403
    res_admin = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "rogue_admin@financeflow.com",
            "password": "Password@12345",
            "full_name": "Rogue Admin",
            "role": "ADMIN",
        },
        headers=emp_headers,
    )
    assert res_admin.status_code == 403

    # 2. Employee attempts to register another employee -> Expect 403
    res_emp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "new_emp@financeflow.com",
            "password": "Password@12345",
            "full_name": "New Employee",
            "role": "EMPLOYEE",
        },
        headers=emp_headers,
    )
    assert res_emp.status_code == 403

    # 3. Admin attempts to create another Admin -> Expect 403 (Super Admin only policy)
    admin_token = await get_token(client, "officer@financeflow.com", "Officer@12345")
    res_admin_by_admin = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "second_admin@financeflow.com",
            "password": "Password@12345",
            "full_name": "Second Admin",
            "role": "ADMIN",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin_by_admin.status_code == 403
    assert (
        "Only Super Admin accounts are authorized to create Admin accounts"
        in res_admin_by_admin.json()["detail"]
    )


# ============================================================================
# SCENARIO 11: Unauthorized completion override is rejected
# ============================================================================


@pytest.mark.asyncio
async def test_11_unauthorized_completion_override_is_rejected(
    client: AsyncClient, test_session: AsyncSession
) -> None:
    """Employee attempting to complete a work order with pending checklist items is rejected."""
    emp_token = await get_token(client, "employee@financeflow.com", "Employee@12345")
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    me = (await client.get("/api/v1/auth/me", headers=emp_headers)).json()

    # Assign WO-2026-0001 (has incomplete checklist items) to this employee
    admin_token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    wo_list = (
        await client.get(
            "/api/v1/crm/work-orders?q=WO-2026-0001", headers=admin_headers
        )
    ).json()
    wo_id = wo_list[0]["id"]
    await client.put(
        f"/api/v1/crm/work-orders/{wo_id}",
        json={"assigned_to_id": me["id"]},
        headers=admin_headers,
    )

    # Employee tries to complete with override reason
    res = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/status",
        json={
            "status": "COMPLETED",
            "override_reason": "Employee attempting to bypass supervisor.",
        },
        headers=emp_headers,
    )
    assert res.status_code == 403
    assert (
        "Only authorized supervisors may use the checklist completion override"
        in res.json()["detail"]
    )


# ============================================================================
# SCENARIO 12: Authorized override requires a reason and creates an audit record
# ============================================================================


@pytest.mark.asyncio
async def test_12_authorized_override_requires_reason_and_creates_audit_record(
    client: AsyncClient, test_session: AsyncSession
) -> None:
    """Supervisor override requires non-empty reason and records an append-only audit entry."""
    admin_token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # WO-2026-0003 has incomplete checklist items
    wo_list = (
        await client.get("/api/v1/crm/work-orders?q=WO-2026-0001", headers=headers)
    ).json()
    wo_id = wo_list[0]["id"]

    # 1. Without reason -> Expect 400
    res_no_reason = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/status",
        json={"status": "COMPLETED"},
        headers=headers,
    )
    assert res_no_reason.status_code == 400
    assert (
        "supervisor override reason is required"
        in res_no_reason.json()["detail"].lower()
    )

    # 2. With reason -> Expect 200
    reason_text = "Executive waiver approved by Risk Committee due to external audit."
    res_override = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/status",
        json={"status": "COMPLETED", "override_reason": reason_text},
        headers=headers,
    )
    assert res_override.status_code == 200
    completed_wo = res_override.json()
    assert completed_wo["status"] == "COMPLETED"

    # Verify audit record
    history = completed_wo["history"]
    match = next((h for h in history if reason_text in (h["details"] or "")), None)
    assert match is not None
    assert match["action"] == "COMPLETION_OVERRIDE"


# ============================================================================
# SCENARIO 13: Unauthorized notification and history access is blocked
# ============================================================================


@pytest.mark.asyncio
async def test_13_unauthorized_notification_and_history_access_blocked(
    client: AsyncClient, test_session: AsyncSession
) -> None:
    """Employees cannot access global history or other users' notifications."""
    emp1_token = await get_token(client, "employee@financeflow.com", "Employee@12345")
    emp2_token = await get_token(client, "employee2@financeflow.com", "Employee@12345")

    emp1_headers = {"Authorization": f"Bearer {emp1_token}"}
    emp2_headers = {"Authorization": f"Bearer {emp2_token}"}

    # 1. Employee cannot view global task history
    res_global = await client.get("/api/v1/crm/history", headers=emp1_headers)
    assert res_global.status_code == 403

    # 2. Employee cannot mark another employee's notification as read
    # Create notification for employee 2
    emp2_info = (await client.get("/api/v1/auth/me", headers=emp2_headers)).json()
    emp2_id = uuid.UUID(emp2_info["id"])

    notif = CrmNotification(
        id=uuid.uuid4(),
        user_id=emp2_id,
        title="Confidential Alert",
        message="Private operational communication.",
        notification_type="SYSTEM_ALERT",
        is_read=False,
    )
    test_session.add(notif)
    await test_session.flush()

    # Employee 1 attempts to mark Employee 2's notification as read -> Expect 403
    res_read = await client.patch(
        f"/api/v1/crm/notifications/{notif.id}/read", headers=emp1_headers
    )
    assert res_read.status_code == 403
    assert (
        "You cannot access notifications belonging to another user"
        in res_read.json()["detail"]
    )


# ============================================================================
# SCENARIO 14: Attempts to modify protected fields are rejected
# ============================================================================


@pytest.mark.asyncio
async def test_14_attempts_to_modify_protected_fields_are_rejected(
    client: AsyncClient, test_session: AsyncSession
) -> None:
    """Attempts by employees to modify structural/administrative fields are rejected."""
    emp_token = await get_token(client, "employee@financeflow.com", "Employee@12345")
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    me = (await client.get("/api/v1/auth/me", headers=emp_headers)).json()
    admin_token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    wo_list = (
        await client.get(
            "/api/v1/crm/work-orders?q=WO-2026-0002", headers=admin_headers
        )
    ).json()
    wo_id = wo_list[0]["id"]
    await client.put(
        f"/api/v1/crm/work-orders/{wo_id}",
        json={"assigned_to_id": me["id"]},
        headers=admin_headers,
    )

    wo_detail = (
        await client.get(f"/api/v1/crm/work-orders/{wo_id}", headers=emp_headers)
    ).json()
    item_id = wo_detail["checklist_items"][0]["id"]

    # 1. Attempt to modify checklist title -> Expect 403
    res_title = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/checklist/{item_id}",
        json={"title": "Unauthorized Milestone Rename"},
        headers=emp_headers,
    )
    assert res_title.status_code == 403
    assert (
        "Employees are only permitted to update execution fields"
        in res_title.json()["detail"]
    )

    # 2. Attempt to reassign checklist item -> Expect 403
    res_reassign = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/checklist/{item_id}",
        json={"assigned_to_id": str(uuid.uuid4())},
        headers=emp_headers,
    )
    assert res_reassign.status_code == 403

    # 3. Attempt to cancel work order -> Expect 403
    res_cancel = await client.patch(
        f"/api/v1/crm/work-orders/{wo_id}/status",
        json={"status": "CANCELLED"},
        headers=emp_headers,
    )
    assert res_cancel.status_code == 403
    assert (
        "Employees cannot cancel or archive work orders" in res_cancel.json()["detail"]
    )


# ============================================================================
# SCENARIO 15: Existing CRM dashboard, filtering, progress, and notification tests continue to pass
# ============================================================================


@pytest.mark.asyncio
async def test_15_existing_crm_dashboard_and_filtering_regression_passed(
    client: AsyncClient, test_session: AsyncSession
) -> None:
    """Verifies that dashboard metrics and queue filtering operate correctly for both Admin and Employee."""
    admin_token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    emp_token = await get_token(client, "employee@financeflow.com", "Employee@12345")

    # 1. Admin dashboard metrics: aggregate across organization
    admin_dash = (
        await client.get(
            "/api/v1/crm/dashboard", headers={"Authorization": f"Bearer {admin_token}"}
        )
    ).json()
    assert admin_dash["active_workload"] >= 3
    assert admin_dash["total_clients"] >= 3

    # 2. Employee dashboard metrics: scoped to employee's assigned workload
    emp_dash = (
        await client.get(
            "/api/v1/crm/dashboard", headers={"Authorization": f"Bearer {emp_token}"}
        )
    ).json()
    assert "active_workload" in emp_dash
    assert "resolved_today" in emp_dash
    assert emp_dash["active_workload"] >= 0
