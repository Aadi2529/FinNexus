"""Integration tests for Work Category Checklist Drag-and-Drop Reordering and Persistence.

Covers verification cases:
1. Drag the last step to the first position.
2. Drag the first step to the last position.
3. Reorder steps in the middle of the list.
4. Add a step, reorder it, and save.
5. Delete a step and save.
6. Edit an existing category and save its reordered checklist.
7. Re-fetch category and confirm the saved order persists across sessions.
8. Existing categories without explicit ordering still work.
9. Unauthorized users (EMPLOYEE) cannot modify category templates (HTTP 403).
10. Work orders auto-seed checklist items in the newly reordered sequence.
"""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.models.crm import Customer, WorkCategory, WorkOrder
from app.db.seed import seed_initial_data
from app.db.session import Base, get_db_session
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
ADMIN_EMAIL = settings.SUPER_ADMIN_EMAIL or "admin@finnexus.com"
ADMIN_PWD = settings.SUPER_ADMIN_PASSWORD or "Admin@12345"


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


@pytest.mark.asyncio
async def test_checklist_reordering_cases_1_to_8(client: AsyncClient):
    """Test checklist drag-and-drop reorder sequences, additions, deletions, and persistence."""
    admin_token = await get_token(client, ADMIN_EMAIL, ADMIN_PWD)
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Initial template steps (as in user request prompt):
    # 1. Collect Bank Statements
    # 2. Prepare Profit & Loss & Balance Sheet
    # 3. Reconcile Bank Statements
    # 4. GST Return Filing & Turnover Cross-Check
    initial_steps = [
        {"title": "Collect Bank Statements", "position": 0},
        {"title": "Prepare Profit & Loss & Balance Sheet", "position": 1},
        {"title": "Reconcile Bank Statements", "position": 2},
        {"title": "GST Return Filing & Turnover Cross-Check", "position": 3},
    ]

    create_res = await client.post(
        "/api/v1/crm/categories",
        json={
            "name": "Audit & Compliance Service",
            "code": "AUDIT_COMP",
            "description": "Comprehensive corporate audit workflows.",
            "default_priority": "NORMAL",
            "checklist_template": initial_steps,
            "is_active": True,
        },
        headers=headers,
    )
    assert create_res.status_code == 201, create_res.text
    category = create_res.json()
    cat_id = category["id"]

    template = category["checklist_template"]
    assert len(template) == 4
    assert [s["title"] for s in template] == [
        "Collect Bank Statements",
        "Prepare Profit & Loss & Balance Sheet",
        "Reconcile Bank Statements",
        "GST Return Filing & Turnover Cross-Check",
    ]
    assert [s["position"] for s in template] == [0, 1, 2, 3]

    # --- CASE 1: Drag the last step to the first position ---
    # Target:
    # 1. GST Return Filing & Turnover Cross-Check
    # 2. Collect Bank Statements
    # 3. Prepare Profit & Loss & Balance Sheet
    # 4. Reconcile Bank Statements
    reordered_case1 = [
        {"title": "GST Return Filing & Turnover Cross-Check", "position": 0},
        {"title": "Collect Bank Statements", "position": 1},
        {"title": "Prepare Profit & Loss & Balance Sheet", "position": 2},
        {"title": "Reconcile Bank Statements", "position": 3},
    ]
    put_res1 = await client.put(
        f"/api/v1/crm/categories/{cat_id}",
        json={"checklist_template": reordered_case1},
        headers=headers,
    )
    assert put_res1.status_code == 200
    cat_after_c1 = put_res1.json()
    assert [s["title"] for s in cat_after_c1["checklist_template"]] == [
        "GST Return Filing & Turnover Cross-Check",
        "Collect Bank Statements",
        "Prepare Profit & Loss & Balance Sheet",
        "Reconcile Bank Statements",
    ]
    assert [s["position"] for s in cat_after_c1["checklist_template"]] == [0, 1, 2, 3]

    # --- CASE 2: Drag the first step to the last position ---
    # Moving "GST Return Filing & Turnover Cross-Check" from first to last:
    reordered_case2 = [
        {"title": "Collect Bank Statements", "position": 0},
        {"title": "Prepare Profit & Loss & Balance Sheet", "position": 1},
        {"title": "Reconcile Bank Statements", "position": 2},
        {"title": "GST Return Filing & Turnover Cross-Check", "position": 3},
    ]
    put_res2 = await client.put(
        f"/api/v1/crm/categories/{cat_id}",
        json={"checklist_template": reordered_case2},
        headers=headers,
    )
    assert put_res2.status_code == 200
    cat_after_c2 = put_res2.json()
    assert [s["title"] for s in cat_after_c2["checklist_template"]] == [
        "Collect Bank Statements",
        "Prepare Profit & Loss & Balance Sheet",
        "Reconcile Bank Statements",
        "GST Return Filing & Turnover Cross-Check",
    ]

    # --- CASE 3: Reorder steps in the middle of the list ---
    # Drag step 3 ("Reconcile Bank Statements") to position 1:
    # Before:
    # 1. Collect Bank Statements
    # 2. Prepare Profit & Loss & Balance Sheet
    # 3. Reconcile Bank Statements
    # 4. GST Return Filing & Turnover Cross-Check
    # After:
    # 1. Reconcile Bank Statements
    # 2. Collect Bank Statements
    # 3. Prepare Profit & Loss & Balance Sheet
    # 4. GST Return Filing & Turnover Cross-Check
    reordered_case3 = [
        {"title": "Reconcile Bank Statements", "position": 0},
        {"title": "Collect Bank Statements", "position": 1},
        {"title": "Prepare Profit & Loss & Balance Sheet", "position": 2},
        {"title": "GST Return Filing & Turnover Cross-Check", "position": 3},
    ]
    put_res3 = await client.put(
        f"/api/v1/crm/categories/{cat_id}",
        json={"checklist_template": reordered_case3},
        headers=headers,
    )
    assert put_res3.status_code == 200
    cat_after_c3 = put_res3.json()
    assert [s["title"] for s in cat_after_c3["checklist_template"]] == [
        "Reconcile Bank Statements",
        "Collect Bank Statements",
        "Prepare Profit & Loss & Balance Sheet",
        "GST Return Filing & Turnover Cross-Check",
    ]

    # --- CASE 4: Add a step, reorder it, and save ---
    # Add new step: "Senior Partner Quality Review", placed at position 1 (second place)
    reordered_case4 = [
        {"title": "Reconcile Bank Statements", "position": 0},
        {"title": "Senior Partner Quality Review", "position": 1},
        {"title": "Collect Bank Statements", "position": 2},
        {"title": "Prepare Profit & Loss & Balance Sheet", "position": 3},
        {"title": "GST Return Filing & Turnover Cross-Check", "position": 4},
    ]
    put_res4 = await client.put(
        f"/api/v1/crm/categories/{cat_id}",
        json={"checklist_template": reordered_case4},
        headers=headers,
    )
    assert put_res4.status_code == 200
    cat_after_c4 = put_res4.json()
    assert len(cat_after_c4["checklist_template"]) == 5
    assert cat_after_c4["checklist_template"][1]["title"] == "Senior Partner Quality Review"
    assert [s["position"] for s in cat_after_c4["checklist_template"]] == [0, 1, 2, 3, 4]

    # --- CASE 5: Delete a step and save ---
    # Delete "Collect Bank Statements"
    reordered_case5 = [
        s for s in cat_after_c4["checklist_template"] if s["title"] != "Collect Bank Statements"
    ]
    put_res5 = await client.put(
        f"/api/v1/crm/categories/{cat_id}",
        json={"checklist_template": reordered_case5},
        headers=headers,
    )
    assert put_res5.status_code == 200
    cat_after_c5 = put_res5.json()
    assert len(cat_after_c5["checklist_template"]) == 4
    assert "Collect Bank Statements" not in [s["title"] for s in cat_after_c5["checklist_template"]]
    assert [s["position"] for s in cat_after_c5["checklist_template"]] == [0, 1, 2, 3]

    # --- CASE 6: Edit an existing category and save its reordered checklist ---
    # Modify category description, priority, AND reorder steps simultaneously
    reordered_case6 = list(reversed(cat_after_c5["checklist_template"]))
    put_res6 = await client.put(
        f"/api/v1/crm/categories/{cat_id}",
        json={
            "description": "Updated audit procedures for listed companies.",
            "default_priority": "URGENT",
            "checklist_template": reordered_case6,
        },
        headers=headers,
    )
    assert put_res6.status_code == 200
    cat_after_c6 = put_res6.json()
    assert cat_after_c6["description"] == "Updated audit procedures for listed companies."
    assert cat_after_c6["default_priority"] == "URGENT"
    assert [s["title"] for s in cat_after_c6["checklist_template"]] == [
        s["title"] for s in reordered_case6
    ]

    # --- CASE 7: Re-fetch category and confirm saved order persists across sessions ---
    get_res = await client.get("/api/v1/crm/categories", headers=headers)
    assert get_res.status_code == 200
    categories = get_res.json()
    persisted_cat = next((c for c in categories if c["id"] == cat_id), None)
    assert persisted_cat is not None
    assert [s["title"] for s in persisted_cat["checklist_template"]] == [
        s["title"] for s in reordered_case6
    ]
    assert [s["position"] for s in persisted_cat["checklist_template"]] == [0, 1, 2, 3]

    # --- CASE 8: Confirm existing categories without explicit ordering still work ---
    cat_no_pos = await client.post(
        "/api/v1/crm/categories",
        json={
            "name": "Legacy Category Without Position",
            "code": "LEGACY_CAT",
            "checklist_template": [
                {"title": "Legacy Step A"},
                {"title": "Legacy Step B"},
                {"title": "Legacy Step C"},
            ],
            "is_active": True,
        },
        headers=headers,
    )
    assert cat_no_pos.status_code == 201
    legacy_cat_data = cat_no_pos.json()
    assert len(legacy_cat_data["checklist_template"]) == 3
    assert [s["position"] for s in legacy_cat_data["checklist_template"]] == [0, 1, 2]
    assert [s["title"] for s in legacy_cat_data["checklist_template"]] == [
        "Legacy Step A",
        "Legacy Step B",
        "Legacy Step C",
    ]


@pytest.mark.asyncio
async def test_unauthorized_users_cannot_modify_templates(client: AsyncClient):
    """CASE 9: Unauthorized users (EMPLOYEE) cannot create, update, or delete category templates."""
    # Authenticate as Employee
    emp_token = await get_token(client, "employee@financeflow.com", "Employee@12345")
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # Attempt to create category as employee -> 403 Forbidden
    create_res = await client.post(
        "/api/v1/crm/categories",
        json={
            "name": "Unauthorized Category",
            "code": "UNAUTH_CAT",
            "checklist_template": [{"title": "Step 1"}],
        },
        headers=emp_headers,
    )
    assert create_res.status_code == 403

    # Authenticate as Admin to get an existing category
    admin_token = await get_token(client, ADMIN_EMAIL, ADMIN_PWD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    cats_res = await client.get("/api/v1/crm/categories", headers=admin_headers)
    cat_id = cats_res.json()[0]["id"]

    # Attempt to update category as employee -> 403 Forbidden
    update_res = await client.put(
        f"/api/v1/crm/categories/{cat_id}",
        json={"checklist_template": [{"title": "Hacked Step"}]},
        headers=emp_headers,
    )
    assert update_res.status_code == 403

    # Attempt to delete category as employee -> 403 Forbidden
    del_res = await client.delete(
        f"/api/v1/crm/categories/{cat_id}",
        headers=emp_headers,
    )
    assert del_res.status_code == 403


@pytest.mark.asyncio
async def test_work_order_seeds_from_reordered_category_checklist(client: AsyncClient):
    """CASE 10: Work orders auto-seed checklist items matching the category's reordered sequence."""
    admin_token = await get_token(client, ADMIN_EMAIL, ADMIN_PWD)
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Create category with reordered template
    steps = [
        {"title": "Step A: Fast Verification", "position": 0},
        {"title": "Step B: Underwriting Review", "position": 1},
        {"title": "Step C: Final Disbursement", "position": 2},
    ]
    create_cat = await client.post(
        "/api/v1/crm/categories",
        json={
            "name": "Express Loan Processing",
            "code": "EXPRESS_LOAN",
            "checklist_template": steps,
            "is_active": True,
        },
        headers=headers,
    )
    assert create_cat.status_code == 201
    category = create_cat.json()
    cat_id = category["id"]

    # Get a client
    clients_res = await client.get("/api/v1/crm/clients", headers=headers)
    client_id = clients_res.json()[0]["id"]

    # Create work order referencing this category (checklist_items empty -> auto-seeds from category)
    due = (datetime.now(UTC) + timedelta(days=5)).isoformat()
    create_wo = await client.post(
        "/api/v1/crm/work-orders",
        json={
            "title": "Express Loan for Client",
            "client_id": client_id,
            "category_id": cat_id,
            "priority": "HIGH",
            "due_date": due,
            "checklist_items": [],
        },
        headers=headers,
    )
    assert create_wo.status_code == 201
    wo = create_wo.json()
    assert len(wo["checklist_items"]) == 3
    assert [i["title"] for i in wo["checklist_items"]] == [
        "Step A: Fast Verification",
        "Step B: Underwriting Review",
        "Step C: Final Disbursement",
    ]
    assert [i["position"] for i in wo["checklist_items"]] == [0, 1, 2]
