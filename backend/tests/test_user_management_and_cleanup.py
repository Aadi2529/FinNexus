"""Automated Test Suite for Super Admin Control, Dynamic Accounts, Cleanup & Work Orders.

Verifies Objectives A, B, C, D, and E as specified in the Master Implementation Plan:
1. Clean baseline starts with only one verified Super Admin account and master categories.
2. Super Admin can authenticate and invalid credentials are rejected.
3. Super Admin can dynamically provision Admin, Manager, and Employee accounts.
4. Each newly created user can log in independently and obtain valid JWT tokens.
5. Duplicate logins / emails and weak passwords are rejected.
6. RBAC boundaries prevent employees from managing users or escalating privileges.
7. Deactivating a user immediately revokes all refresh tokens and blocks future logins.
8. Safety protections prevent deactivating or demoting the last active Super Admin.
9. Transactional demo data cleanup safely purges demo fixtures while preserving Super Admin.
10. Work orders persist correctly with multi-category checklists and client resolution.
"""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.security import verify_password
from app.db.cleanup import execute_demo_data_cleanup
from app.db.models.auth import RefreshToken, Role, User, UserRole
from app.db.models.crm import Customer, WorkCategory, WorkOrder, WorkOrderChecklistItem
from app.db.seed import seed_demo_fixtures, seed_initial_data
from app.core.config import settings
from app.db.session import Base, get_db_session
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
SUPER_ADMIN_EMAIL = getattr(settings, "SUPER_ADMIN_EMAIL", "admin@finnexus.com") or "admin@finnexus.com"
SUPER_ADMIN_PWD = "Admin@12345"


@pytest.fixture(scope="function")
async def test_session() -> AsyncGenerator[AsyncSession, None]:
    """Create in-memory SQLite database initialized with clean production seed catalog."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Seed baseline WITHOUT demo fixtures (clean operational state)
    async with session_maker() as session:
        await seed_initial_data(session, include_demo_data=False)

    async with session_maker() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def client(test_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provide AsyncClient with get_db_session dependency override."""
    async def override_get_db():
        yield test_session

    app.dependency_overrides[get_db_session] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_clean_baseline_has_only_super_admin(test_session: AsyncSession):
    """Verify clean operational state contains exactly one initial user: Super Admin."""
    user_res = await test_session.execute(select(User))
    all_users = user_res.scalars().all()

    # Must contain exactly 1 verified Super Admin user
    assert len(all_users) == 1
    admin_user = all_users[0]
    assert admin_user.email == SUPER_ADMIN_EMAIL
    assert admin_user.is_active is True

    # Must have SUPER_ADMIN role
    roles_res = await test_session.execute(
        select(Role).join(UserRole, UserRole.role_id == Role.id).where(UserRole.user_id == admin_user.id)
    )
    user_roles = [r.name for r in roles_res.scalars().all()]
    assert "SUPER_ADMIN" in user_roles

    # Verify 5 canonical categories exist
    cat_res = await test_session.execute(select(WorkCategory))
    categories = cat_res.scalars().all()
    cat_codes = {c.code for c in categories}
    assert "WORK_MFU" in cat_codes
    assert "WORK_INSURANCE" in cat_codes
    assert "WORK_INSURANCE_CLAIM" in cat_codes
    assert "WORK_ACCOUNTING" in cat_codes
    assert "WORK_OFFICE_WORK" in cat_codes


@pytest.mark.asyncio
async def test_super_admin_login_and_invalid_credentials(client: AsyncClient):
    """Verify Super Admin can authenticate and invalid credentials are rejected."""
    # 1. Valid login
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PWD},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert "refresh_token" in login_data
    assert login_data["user"]["email"] == SUPER_ADMIN_EMAIL
    assert login_data["user"]["role"] == "SUPER_ADMIN"

    # 2. Invalid password
    bad_res = await client.post(
        "/api/v1/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": "WrongPassword999!"},
    )
    assert bad_res.status_code == 401

    # 3. Nonexistent user
    unknown_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@financeflow.com", "password": SUPER_ADMIN_PWD},
    )
    assert unknown_res.status_code == 401


@pytest.mark.asyncio
async def test_super_admin_provisions_admin_manager_employee(client: AsyncClient, test_session: AsyncSession):
    """Verify Super Admin can create Admin, Manager, and Employee accounts dynamically."""
    # Authenticate as Super Admin
    auth_res = await client.post(
        "/api/v1/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PWD},
    )
    token = auth_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create an ADMIN
    admin_payload = {
        "email": "sarah.admin@financeflow.com",
        "password": "SecurePassword123!",
        "full_name": "Sarah Connor",
        "role": "ADMIN",
    }
    r1 = await client.post("/api/v1/auth/register", json=admin_payload, headers=headers)
    assert r1.status_code == 201
    d1 = r1.json()
    assert d1["email"] == "sarah.admin@financeflow.com"
    assert d1["role"] == "ADMIN"
    assert "password" not in d1
    assert "hashed_password" not in d1

    # 2. Create a MANAGER
    mgr_payload = {
        "email": "rajesh.mgr@financeflow.com",
        "password": "SecurePassword123!",
        "full_name": "Rajesh Kumar",
        "role": "MANAGER",
    }
    r2 = await client.post("/api/v1/auth/register", json=mgr_payload, headers=headers)
    assert r2.status_code == 201
    assert r2.json()["role"] == "MANAGER"

    # 3. Create an EMPLOYEE
    emp_payload = {
        "email": "amit.emp@financeflow.com",
        "password": "SecurePassword123!",
        "full_name": "Amit Sharma",
        "role": "EMPLOYEE",
    }
    r3 = await client.post("/api/v1/auth/register", json=emp_payload, headers=headers)
    assert r3.status_code == 201
    assert r3.json()["role"] == "EMPLOYEE"

    # Verify password hashes stored properly (never plaintext)
    user_res = await test_session.execute(
        select(User).where(User.email == "amit.emp@financeflow.com")
    )
    emp_user = user_res.scalar_one()
    assert emp_user.hashed_password != "SecurePassword123!"
    assert verify_password("SecurePassword123!", emp_user.hashed_password) is True


@pytest.mark.asyncio
async def test_created_users_can_authenticate_independently(client: AsyncClient):
    """Verify each created user can log in with their own credentials."""
    # Super Admin logs in to create an employee
    sa_res = await client.post(
        "/api/v1/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PWD},
    )
    sa_token = sa_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {sa_token}"}

    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "priya.specialist@financeflow.com",
            "password": "SpecialistPassword123!",
            "full_name": "Priya Sharma",
            "role": "EMPLOYEE",
        },
        headers=headers,
    )

    # Priya logs in via the public /auth/login endpoint
    emp_login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "priya.specialist@financeflow.com",
            "password": "SpecialistPassword123!",
        },
    )
    assert emp_login.status_code == 200
    emp_data = emp_login.json()
    assert emp_data["user"]["email"] == "priya.specialist@financeflow.com"
    assert emp_data["user"]["role"] == "EMPLOYEE"
    assert "access_token" in emp_data
    assert "refresh_token" in emp_data


@pytest.mark.asyncio
async def test_duplicate_email_and_weak_password_rejected(client: AsyncClient):
    """Verify registration rejects duplicate email and passwords that lack complexity."""
    sa_res = await client.post(
        "/api/v1/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PWD},
    )
    sa_token = sa_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {sa_token}"}

    # 1. Duplicate email rejection
    dup_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": SUPER_ADMIN_EMAIL,
            "password": "AnotherPassword123!",
            "full_name": "Fake Admin",
            "role": "ADMIN",
        },
        headers=headers,
    )
    assert dup_res.status_code == 409

    # 2. Weak password (< 8 chars or no numbers/letters)
    weak_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "weak.user@financeflow.com",
            "password": "123",
            "full_name": "Weak User",
            "role": "EMPLOYEE",
        },
        headers=headers,
    )
    assert weak_res.status_code == 422


@pytest.mark.asyncio
async def test_employee_cannot_manage_users(client: AsyncClient):
    """Verify RBAC enforces that employees cannot register, list, or edit users."""
    # Create employee as Super Admin
    sa_res = await client.post(
        "/api/v1/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PWD},
    )
    sa_token = sa_res.json()["access_token"]
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "restricted.emp@financeflow.com",
            "password": "ValidPassword123!",
            "full_name": "Restricted Employee",
            "role": "EMPLOYEE",
        },
        headers={"Authorization": f"Bearer {sa_token}"},
    )

    # Employee logs in
    emp_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "restricted.emp@financeflow.com", "password": "ValidPassword123!"},
    )
    emp_token = emp_login.json()["access_token"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # Attempt to list all users -> 403 Forbidden
    list_res = await client.get("/api/v1/auth/users", headers=emp_headers)
    assert list_res.status_code == 403

    # Attempt to register an admin -> 403 Forbidden
    create_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "rogue.admin@financeflow.com",
            "password": "RoguePassword123!",
            "full_name": "Rogue Admin",
            "role": "ADMIN",
        },
        headers=emp_headers,
    )
    assert create_res.status_code == 403


@pytest.mark.asyncio
async def test_deactivate_user_revokes_tokens_and_blocks_login(client: AsyncClient, test_session: AsyncSession):
    """Verify deactivating an account revokes refresh tokens and blocks authentication."""
    # 1. Create and log in a manager
    sa_res = await client.post(
        "/api/v1/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PWD},
    )
    sa_token = sa_res.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "term.mgr@financeflow.com",
            "password": "ValidPassword123!",
            "full_name": "Terminated Manager",
            "role": "MANAGER",
        },
        headers=sa_headers,
    )
    mgr_id = reg_res.json()["id"]

    # Manager logs in to establish refresh token session
    mgr_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "term.mgr@financeflow.com", "password": "ValidPassword123!"},
    )
    assert mgr_login.status_code == 200
    mgr_refresh = mgr_login.json()["refresh_token"]

    # Verify refresh token exists in DB and is active
    rt_res = await test_session.execute(
        select(RefreshToken).where(RefreshToken.user_id == uuid.UUID(mgr_id))
    )
    tokens_before = rt_res.scalars().all()
    assert any(t.revoked_at is None for t in tokens_before)

    # 2. Super Admin deactivates the manager
    deact_res = await client.patch(
        f"/api/v1/auth/users/{mgr_id}",
        json={"is_active": False},
        headers=sa_headers,
    )
    assert deact_res.status_code == 200
    assert deact_res.json()["is_active"] is False

    # Verify refresh tokens are now revoked in DB
    rt_after_res = await test_session.execute(
        select(RefreshToken).where(RefreshToken.user_id == uuid.UUID(mgr_id))
    )
    tokens_after = rt_after_res.scalars().all()
    assert all(t.revoked_at is not None for t in tokens_after)

    # 3. Deactivated user cannot log in
    blocked_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "term.mgr@financeflow.com", "password": "ValidPassword123!"},
    )
    assert blocked_login.status_code == 403
    assert "deactivated" in blocked_login.json()["detail"].lower()

    # 4. Refreshing with old refresh token is rejected
    refresh_attempt = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": mgr_refresh},
    )
    assert refresh_attempt.status_code == 401


@pytest.mark.asyncio
async def test_cannot_deactivate_or_delete_last_super_admin(client: AsyncClient):
    """Verify safety guards protect the last remaining Super Admin."""
    sa_res = await client.post(
        "/api/v1/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PWD},
    )
    sa_token = sa_res.json()["access_token"]
    sa_id = sa_res.json()["user"]["id"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # Attempt to deactivate Super Admin
    deact_res = await client.patch(
        f"/api/v1/auth/users/{sa_id}",
        json={"is_active": False},
        headers=sa_headers,
    )
    assert deact_res.status_code == 400
    assert "last active super admin" in deact_res.json()["detail"].lower()

    # Attempt to delete Super Admin
    del_res = await client.delete(
        f"/api/v1/auth/users/{sa_id}",
        headers=sa_headers,
    )
    assert del_res.status_code == 400
    assert "last active super admin" in del_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_demo_data_cleanup_execution(test_session: AsyncSession):
    """Verify execute_demo_data_cleanup safely purges demo fixtures and preserves Super Admin."""
    # First seed demo fixtures to simulate an environment with unwanted demo data
    await seed_demo_fixtures(test_session)

    # Confirm demo fixtures are present
    users_with_demo = (await test_session.execute(select(User))).scalars().all()
    assert len(users_with_demo) > 1

    # Execute transactional cleanup
    result = await execute_demo_data_cleanup(test_session)
    assert result["status"] == "completed"
    assert result["super_admin_preserved"] == SUPER_ADMIN_EMAIL
    assert result["deleted_users"] >= 1

    # Verify only verified Super Admin remains
    remaining_users = (await test_session.execute(select(User))).scalars().all()
    assert len(remaining_users) == 1
    assert remaining_users[0].email == SUPER_ADMIN_EMAIL

    # Verify cleanup is idempotent (running it again does not error or delete Super Admin)
    idempotent_result = await execute_demo_data_cleanup(test_session)
    assert idempotent_result["status"] == "completed"
    assert idempotent_result["deleted_users"] == 0

    recheck_users = (await test_session.execute(select(User))).scalars().all()
    assert len(recheck_users) == 1
    assert recheck_users[0].email == SUPER_ADMIN_EMAIL


@pytest.mark.asyncio
async def test_work_order_creation_with_canonical_categories(client: AsyncClient, test_session: AsyncSession):
    """Verify creating a work order with canonical MFU category, checklist tasks, and inline client."""
    # Authenticate as Super Admin
    sa_res = await client.post(
        "/api/v1/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PWD},
    )
    sa_token = sa_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {sa_token}"}

    # Get WORK_MFU category
    cat_res = await test_session.execute(
        select(WorkCategory).where(WorkCategory.code == "WORK_MFU")
    )
    mfu_cat = cat_res.scalar_one()

    # Create work order with inline client and multiple checklist items matching reference screenshot
    wo_payload = {
        "title": "Work: MFU: Arvind Sharma",
        "description": "Urgent physical KYC and Can Generation for new mutual fund portfolio.",
        "category_id": str(mfu_cat.id),
        "priority": "HIGH",
        "due_date": (datetime.now(UTC) + timedelta(days=3)).isoformat(),
        "priority_notes": "Client Ref: REF-2026-901",
        "new_client": {
            "first_name": "Arvind",
            "last_name": "Sharma",
            "phone": "+91 9876543210",
            "email": "arvind.sharma@example.com",
            "reference_source": "Work Order Queue",
        },
        "checklist_items": [
            {"title": "[MFU] Do Physical KYC Client", "position": 0},
            {"title": "[MFU] Can Generation", "position": 1},
            {"title": "[MFU] Start SIP", "position": 2},
            {"title": "[MFU] Other: Collect cancelled cheque copy", "position": 3},
        ],
    }

    create_res = await client.post("/api/v1/crm/work-orders", json=wo_payload, headers=headers)
    assert create_res.status_code == 201
    wo_data = create_res.json()
    assert wo_data["order_number"].startswith("WO-")
    assert wo_data["title"] == "Work: MFU: Arvind Sharma"
    assert wo_data["status"] == "PENDING"
    assert wo_data["progress_percent"] == 0

    # Verify items and client were created in DB
    wo_db_res = await test_session.execute(
        select(WorkOrder).where(WorkOrder.id == uuid.UUID(wo_data["id"]))
    )
    wo_db = wo_db_res.scalar_one()
    assert wo_db.client_id is not None

    items_res = await test_session.execute(
        select(WorkOrderChecklistItem).where(WorkOrderChecklistItem.work_order_id == wo_db.id)
    )
    items = items_res.scalars().all()
    assert len(items) == 4
    titles = [i.title for i in items]
    assert "[MFU] Do Physical KYC Client" in titles
    assert "[MFU] Other: Collect cancelled cheque copy" in titles


@pytest.mark.asyncio
async def test_followup_task_crud_lifecycle(client: AsyncClient, test_session: AsyncSession):
    """Verify full CRUD lifecycle for follow-up tasks: create, read, patch/put update, and delete."""
    # Authenticate as Super Admin
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PWD},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a customer
    cust_res = await client.post(
        "/api/v1/crm/customers",
        json={
            "first_name": "Karan",
            "last_name": "Mehta",
            "email": "karan.mehta@example.com",
            "phone": "+91 9123456780",
            "pan_number": "ABCDE1234F",
            "pipeline_status": "NEW_LEAD",
            "employment_type": "SALARIED",
            "monthly_income": 95000,
            "monthly_obligations": 15000,
            "cibil_score": 760,
        },
        headers=headers,
    )
    assert cust_res.status_code == 201
    cust_id = cust_res.json()["id"]

    # 2. CREATE Task
    due = (datetime.now(UTC) + timedelta(days=5)).date().isoformat()
    create_task_res = await client.post(
        f"/api/v1/crm/customers/{cust_id}/tasks",
        json={
            "title": "Call client for Form 16 verification",
            "description": "Collect last 2 years IT returns and salary slips.",
            "priority": "HIGH",
            "due_date": due,
        },
        headers=headers,
    )
    assert create_task_res.status_code == 201
    task_data = create_task_res.json()
    task_id = task_data["id"]
    assert task_data["title"] == "Call client for Form 16 verification"
    assert task_data["status"] == "PENDING"
    assert task_data["priority"] == "HIGH"

    # 3. READ Task
    get_task_res = await client.get(f"/api/v1/crm/tasks/{task_id}", headers=headers)
    assert get_task_res.status_code == 200
    assert get_task_res.json()["id"] == task_id
    assert get_task_res.json()["title"] == "Call client for Form 16 verification"

    # Also verify client alias
    client_task_res = await client.post(
        f"/api/v1/crm/clients/{cust_id}/tasks",
        json={
            "title": "Secondary client follow-up task",
            "due_date": due,
            "priority": "LOW",
        },
        headers=headers,
    )
    assert client_task_res.status_code == 201
    sec_task_id = client_task_res.json()["id"]

    # 4. UPDATE Task (PATCH/PUT)
    patch_res = await client.patch(
        f"/api/v1/crm/tasks/{task_id}",
        json={
            "title": "Call client for Form 16 verification (URGENT)",
            "priority": "URGENT",
            "status": "COMPLETED",
        },
        headers=headers,
    )
    assert patch_res.status_code == 200
    updated_task = patch_res.json()
    assert updated_task["title"] == "Call client for Form 16 verification (URGENT)"
    assert updated_task["status"] == "COMPLETED"
    assert updated_task["priority"] == "URGENT"
    assert updated_task["completed_at"] is not None

    # Verify updated state in customer 360 view
    cust_360 = await client.get(f"/api/v1/crm/customers/{cust_id}", headers=headers)
    assert cust_360.status_code == 200
    tasks_360 = cust_360.json()["tasks"]
    assert len(tasks_360) == 2
    completed_task = next(t for t in tasks_360 if t["id"] == task_id)
    assert completed_task["status"] == "COMPLETED"

    # 5. DELETE Task
    del_res = await client.delete(f"/api/v1/crm/tasks/{task_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["deleted_id"] == task_id

    # Verify 404 after delete
    get_deleted = await client.get(f"/api/v1/crm/tasks/{task_id}", headers=headers)
    assert get_deleted.status_code == 404

    # Delete secondary task as well
    del_sec = await client.delete(f"/api/v1/crm/tasks/{sec_task_id}", headers=headers)
    assert del_sec.status_code == 200


@pytest.mark.asyncio
async def test_work_category_crud_super_admin(client: AsyncClient):
    """Verify Super Admin can Create, Read, Update, and Delete work categories."""
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PWD},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. CREATE Category
    create_cat_res = await client.post(
        "/api/v1/crm/categories",
        json={
            "name": "Custom Wealth Review",
            "code": "WORK_WEALTH",
            "description": "High net-worth wealth review and tax optimization.",
            "default_priority": "HIGH",
            "checklist_template": [
                {"title": "Collect asset disclosure"},
                {"title": "Review mutual fund portfolio"},
                {"title": "Execute wealth rebalancing"},
            ],
            "is_active": True,
        },
        headers=headers,
    )
    assert create_cat_res.status_code == 201
    cat_data = create_cat_res.json()
    cat_id = cat_data["id"]
    assert cat_data["name"] == "Custom Wealth Review"
    assert cat_data["code"] == "WORK_WEALTH"

    # 2. READ Categories
    list_res = await client.get("/api/v1/crm/categories", headers=headers)
    assert list_res.status_code == 200
    codes = [c["code"] for c in list_res.json()]
    assert "WORK_WEALTH" in codes

    # 3. UPDATE Category
    update_res = await client.put(
        f"/api/v1/crm/categories/{cat_id}",
        json={
            "description": "Updated wealth management workflows for ultra HNI clients.",
            "default_priority": "URGENT",
            "is_active": False,
        },
        headers=headers,
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["default_priority"] == "URGENT"
    assert updated["is_active"] is False

    # 4. DELETE Category
    del_res = await client.delete(f"/api/v1/crm/categories/{cat_id}", headers=headers)
    assert del_res.status_code == 200

    # Verify it is deleted
    recheck_res = await client.get("/api/v1/crm/categories?active_only=false", headers=headers)
    remaining_codes = [c["code"] for c in recheck_res.json()]
    assert "WORK_WEALTH" not in remaining_codes


@pytest.mark.asyncio
async def test_work_order_delete_super_admin(client: AsyncClient, test_session: AsyncSession):
    """Verify Super Admin can permanently delete a work order."""
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PWD},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    cat_res = await test_session.execute(
        select(WorkCategory).where(WorkCategory.code == "WORK_OFFICE_WORK")
    )
    office_cat = cat_res.scalar_one()

    # Create work order
    wo_res = await client.post(
        "/api/v1/crm/work-orders",
        json={
            "title": "Temporary Office Work Order",
            "category_id": str(office_cat.id),
            "priority": "NORMAL",
            "due_date": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
            "new_client": {
                "first_name": "Temporary",
                "last_name": "Client",
                "phone": "+91 9998887776",
                "email": "temp.client@example.com",
            },
            "checklist_items": [{"title": "Initial scan"}],
        },
        headers=headers,
    )
    assert wo_res.status_code == 201
    wo_id = wo_res.json()["id"]

    # Delete permanently
    del_res = await client.delete(f"/api/v1/crm/work-orders/{wo_id}?permanent=true", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "DELETED"

    # Verify 404
    get_res = await client.get(f"/api/v1/crm/work-orders/{wo_id}", headers=headers)
    assert get_res.status_code == 404
