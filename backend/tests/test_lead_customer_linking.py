import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select
from app.core.config import settings
from app.db.session import Base, get_db_session
from app.db.models.crm import Customer
from app.db.seed import seed_initial_data
from app.main import app

TEST_DATABASE_URL = str(settings.DATABASE_URL)


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
async def test_customer_suggestion_and_lead_linking(
    client: AsyncClient,
    admin_auth_token: str,
    test_session: AsyncSession,
):
    headers = {"Authorization": f"Bearer {admin_auth_token}"}

    # 1. Fetch or create a test customer in database
    cust_res = await test_session.execute(select(Customer).limit(1))
    customer = cust_res.scalar_one_or_none()
    if not customer:
        customer = Customer(
            first_name="Aditya",
            last_name="Thakre",
            phone="8446090974",
            email="tadityafin@gmail.com",
            address="GATE NO 56 NEAR TULJA BHAVANI SCHOOL MUKUNDNAGAR CHH SAMBHAJINAGAR",
            city="Chhatrapati Sambhajinagar",
            state="Maharashtra",
            pincode="431003",
            customer_type="INDIVIDUAL",
        )
        test_session.add(customer)
        await test_session.commit()
        await test_session.refresh(customer)

    # 2. Test customer search API (used by autocomplete suggestions in UI)
    search_res = await client.get(
        "/api/v1/insurance/customers",
        params={"search": customer.phone, "page_size": 5},
        headers=headers,
    )
    assert search_res.status_code == 200
    search_data = search_res.json()
    items = search_data.get("items", [])
    assert len(items) >= 1
    found = next((c for c in items if str(c["id"]) == str(customer.id)), None)
    assert found is not None
    assert found["phone"] == customer.phone

    # 3. Test duplicate check detects customer
    dupe_res = await client.post(
        "/api/v1/insurance/leads/check-duplicates",
        json={"mobile": customer.phone, "email": customer.email},
        headers=headers,
    )
    assert dupe_res.status_code == 200
    dupe_data = dupe_res.json()
    assert dupe_data["has_duplicates"] is True
    assert len(dupe_data["matching_customers"]) >= 1

    # 4. Create lead explicitly linked to this customer
    lead_payload = {
        "customer_id": str(customer.id),
        "lead_type": "INDIVIDUAL",
        "full_name": f"{customer.first_name} {customer.last_name}",
        "mobile": customer.phone,
        "email": customer.email,
        "address_line1": customer.address,
        "city": customer.city,
        "state": customer.state,
        "pincode": customer.pincode,
        "policy_type": "Health",
        "coverage_amount": 1000000,
        "expected_premium": 25000,
        "priority": "HIGH",
        "lead_source": "EXISTING_CUSTOMER",
    }

    create_res = await client.post(
        "/api/v1/insurance/leads",
        json=lead_payload,
        headers=headers,
    )
    assert create_res.status_code == 201, f"Failed to create lead: {create_res.text}"
    lead_data = create_res.json()
    lead_id = lead_data["id"]
    assert lead_data["customer_id"] == str(customer.id)

    # 5. Verify Lead 360 reflects linked customer
    lead_360_res = await client.get(
        f"/api/v1/insurance/leads/{lead_id}/360",
        headers=headers,
    )
    assert lead_360_res.status_code == 200
    lead_360 = lead_360_res.json()
    assert lead_360["lead"]["customer_id"] == str(customer.id)
    assert customer.first_name in lead_360["lead"]["customer_name"]

    # 6. Verify Kanban returns 200 and includes this lead
    kanban_res = await client.get(
        "/api/v1/insurance/leads/kanban",
        headers=headers,
    )
    assert kanban_res.status_code == 200
    stages = kanban_res.json()["stages"]
    new_stage = next((s for s in stages if s["status"] == "NEW"), None)
    assert new_stage is not None
    matching_in_kanban = next((l for l in new_stage["leads"] if l["id"] == lead_id), None)
    assert matching_in_kanban is not None
    assert matching_in_kanban["customer_id"] == str(customer.id)
