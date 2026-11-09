import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.seed import seed_initial_data
from app.db.session import Base, get_db_session
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="function")
async def test_session():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with session_maker() as session:
        await seed_initial_data(session, include_demo_data=True)

    async with session_maker() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def client(test_session: AsyncSession):
    async def override_get_db():
        yield test_session

    app.dependency_overrides[get_db_session] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def admin_auth_token(client: AsyncClient):
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@financeflow.com", "password": "Admin@12345"},
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    return login_res.json()["access_token"]


@pytest.mark.asyncio
async def test_kanban_5_stage_view(client: AsyncClient, admin_auth_token: str):
    headers = {"Authorization": f"Bearer {admin_auth_token}"}

    # 1. Fetch 5-stage kanban
    res = await client.get("/api/v1/insurance/leads/kanban?view=5_stage", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data["stages"]) == 5
    stage_names = [s["stage"] for s in data["stages"]]
    assert stage_names == ["Pending", "Call Later", "Schedule Meeting", "Hold", "Done"]

    # 2. Fetch default 12-stage kanban
    res12 = await client.get("/api/v1/insurance/leads/kanban", headers=headers)
    assert res12.status_code == 200
    assert len(res12.json()["stages"]) == 12


@pytest.mark.asyncio
async def test_lead_lifecycle_notes_and_delete(client: AsyncClient, admin_auth_token: str):
    headers = {"Authorization": f"Bearer {admin_auth_token}"}

    # 1. Create a lead
    unique_mobile = "98" + str(uuid.uuid4().int)[:8]
    create_payload = {
        "full_name": "Test Lead For Lifecycle",
        "mobile": unique_mobile,
        "email": f"test_{uuid.uuid4().hex[:6]}@example.com",
        "policy_type": "Health Insurance",
        "lead_type": "INDIVIDUAL",
        "lead_source": "WEBSITE",
        "priority": "HIGH",
        "expected_premium": 25000.0,
    }
    create_res = await client.post("/api/v1/insurance/leads", json=create_payload, headers=headers)
    assert create_res.status_code in (200, 201)
    lead = create_res.json()
    lead_id = lead["id"]

    # 2. Update status to CALL_LATER
    stat_res = await client.patch(
        f"/api/v1/insurance/leads/{lead_id}/status",
        json={"status": "CALL_LATER", "remarks": "Need to follow up tomorrow"},
        headers=headers,
    )
    assert stat_res.status_code == 200
    assert stat_res.json()["status"] == "CALL_LATER"

    # 3. Add note
    note_res = await client.post(
        f"/api/v1/insurance/leads/{lead_id}/notes",
        json={"title": "Client Requirement", "description": "Needs ₹10 Lakh sum insured with OPD cover", "note_type": "GENERAL"},
        headers=headers,
    )
    assert note_res.status_code == 201
    note = note_res.json()
    note_id = note["id"]

    # 4. Update note
    up_note_res = await client.patch(
        f"/api/v1/insurance/leads/{lead_id}/notes/{note_id}",
        json={"title": "Updated Requirement", "description": "Needs ₹15 Lakh sum insured with OPD cover", "note_type": "GENERAL"},
        headers=headers,
    )
    assert up_note_res.status_code == 200
    assert "₹15 Lakh" in up_note_res.json()["description"]

    # 5. Delete note
    del_note_res = await client.delete(
        f"/api/v1/insurance/leads/{lead_id}/notes/{note_id}",
        headers=headers,
    )
    assert del_note_res.status_code == 200

    # 6. Verify in 5-stage kanban it appears in Call Later
    kanban5 = await client.get("/api/v1/insurance/leads/kanban?view=5_stage", headers=headers)
    assert kanban5.status_code == 200
    call_later_stage = next(s for s in kanban5.json()["stages"] if s["stage"] == "Call Later")
    lead_ids_in_stage = [l["id"] for l in call_later_stage["leads"]]
    assert lead_id in lead_ids_in_stage

    # 7. Delete lead
    del_res = await client.delete(f"/api/v1/insurance/leads/{lead_id}", headers=headers)
    assert del_res.status_code == 200
    assert "deleted successfully" in del_res.json()["message"]

    # 8. Verify 404 on get
    get_res = await client.get(f"/api/v1/insurance/leads/{lead_id}", headers=headers)
    assert get_res.status_code == 404
