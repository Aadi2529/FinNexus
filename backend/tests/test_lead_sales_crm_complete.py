"""Comprehensive E2E Integration Tests for FinNexus Insurance Engine Lead Management & Sales CRM."""

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select

from app.db.models.auth import Role, User
from app.db.models.crm import Customer, CrmNotification
from app.db.models.insurance import (
    HealthQuotation,
    InsuranceAgentInquiry,
    InsuranceCompany,
    InsuranceLeadActivity,
    InsuranceLeadNote,
    InsuranceLeadReminder,
    InsurancePlan,
    InsuranceSubAgent,
)
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


@pytest.fixture(scope="function")
async def employee_auth_token(client: AsyncClient):
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "employee@financeflow.com", "password": "Employee@12345"},
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    return login_res.json()["access_token"]


@pytest.mark.asyncio
async def test_lead_full_lifecycle_and_conversion(client: AsyncClient, admin_auth_token: str, test_session: AsyncSession):
    headers = {"Authorization": f"Bearer {admin_auth_token}"}

    # 1. Create a Lead Manually
    lead_payload = {
        "lead_type": "INDIVIDUAL",
        "full_name": "Siddharth Malhotra",
        "mobile": "9812345678",
        "alternate_mobile": "9812345679",
        "email": "siddharth.m@example.com",
        "policy_type": "Health",
        "expected_premium": 35000,
        "city": "Pune",
        "state": "Maharashtra",
        "pincode": "411001",
        "priority": "HIGH",
        "lead_source": "PHONE_CALL",
        "notes": "Interested in 15 Lakhs Health Floater with parents covered.",
    }
    create_res = await client.post("/api/v1/insurance/leads", json=lead_payload, headers=headers)
    assert create_res.status_code == 201, create_res.text
    lead = create_res.json()
    lead_id = lead["id"]
    assert lead["lead_number"].startswith("LEAD-")
    assert lead["full_name"] == "Siddharth Malhotra"
    assert lead["status"] == "NEW"
    assert lead["priority"] == "HIGH"

    # 2. Verify it appears in the Lead List
    list_res = await client.get("/api/v1/insurance/leads?search=Siddharth", headers=headers)
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == lead_id

    # 3. Test Duplicate Detection
    dupe_res = await client.post(
        "/api/v1/insurance/leads/check-duplicates",
        json={"mobile": "9812345678", "email": "siddharth.m@example.com"},
        headers=headers,
    )
    assert dupe_res.status_code == 200
    dupe_data = dupe_res.json()
    assert dupe_data["has_duplicates"] is True
    assert len(dupe_data["matching_leads"]) >= 1

    # Attempting to create duplicate without force_duplicate flag returns HTTP 409
    dupe_create_res = await client.post("/api/v1/insurance/leads", json=lead_payload, headers=headers)
    assert dupe_create_res.status_code == 409

    # 4. Assign Lead to Employee
    emp = (await test_session.execute(select(User).where(User.email == "employee@financeflow.com"))).scalar_one()
    assign_res = await client.patch(
        f"/api/v1/insurance/leads/{lead_id}/assign",
        json={"assigned_user_id": str(emp.id)},
        headers=headers,
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["assigned_user_name"] == emp.full_name

    # 5. Schedule a Follow-up
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    follow_up_payload = {
        "title": "Initial Plan Presentation Call",
        "reminder_date": tomorrow,
        "reminder_time": "11:30 AM",
        "reminder_type": "CALL",
        "priority": "HIGH",
        "description": "Walk through Star Health vs HDFC Ergo comparison sheet.",
    }
    follow_up_res = await client.post(
        f"/api/v1/insurance/leads/{lead_id}/follow-ups",
        json=follow_up_payload,
        headers=headers,
    )
    assert follow_up_res.status_code == 201
    follow_up = follow_up_res.json()
    reminder_id = follow_up["id"]
    assert follow_up["status"] == "PENDING"

    # 6. Complete Follow-up and Schedule Next
    next_date = (date.today() + timedelta(days=3)).isoformat()
    complete_payload = {
        "completion_remarks": "Prospect reviewed comparison. Requested quotation with 10% deductible option.",
        "outcome": "QUOTATION_REQUESTED",
        "schedule_next": True,
        "next_reminder_date": next_date,
        "next_reminder_time": "03:00 PM",
        "next_reminder_type": "CALL",
        "next_reminder_title": "Send Final Quotation",
    }
    comp_res = await client.post(
        f"/api/v1/insurance/leads/{lead_id}/follow-ups/{reminder_id}/complete",
        json=complete_payload,
        headers=headers,
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["completed_reminder"]["status"] == "COMPLETED"
    assert comp_res.json()["next_reminder"] is not None

    # 7. Add Internal Note
    note_res = await client.post(
        f"/api/v1/insurance/leads/{lead_id}/notes",
        json={"title": "Client Medical History", "description": "No pre-existing conditions reported for self and spouse."},
        headers=headers,
    )
    assert note_res.status_code == 201
    assert note_res.json()["title"] == "Client Medical History"

    # 8. Update Lead Status across Pipeline
    status_res = await client.patch(
        f"/api/v1/insurance/leads/{lead_id}/status",
        json={"status": "INTERESTED", "remarks": "Client satisfied with coverage proposal."},
        headers=headers,
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "INTERESTED"

    # 9. Verify Lead 360 View Aggregation
    detail_res = await client.get(f"/api/v1/insurance/leads/{lead_id}/360", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["lead"]["id"] == lead_id
    assert len(detail["activities"]) >= 4  # CREATED, ASSIGNED, FOLLOW_UP_SCHEDULED, FOLLOW_UP_COMPLETED, STATUS_CHANGED, NOTE_ADDED
    assert len(detail["notes"]) >= 2
    assert len(detail["reminders"]) >= 2

    # 10. Convert Lead to Customer (Phase 10)
    convert_payload = {
        "first_name": "Siddharth",
        "last_name": "Malhotra",
        "phone": "9812345678",
        "email": "siddharth.m@example.com",
        "customer_type": "INDIVIDUAL",
        "address": "Flat 402, Green Valley Apartments",
        "city": "Pune",
        "state": "Maharashtra",
        "pincode": "411001",
        "pan_number": "ABCDE1234F",
    }
    convert_res = await client.post(
        f"/api/v1/insurance/leads/{lead_id}/convert",
        json=convert_payload,
        headers=headers,
    )
    assert convert_res.status_code == 200
    conv_data = convert_res.json()
    assert conv_data["status"] == "CONVERTED"
    customer_id = conv_data["customer_id"]

    # Verify Customer was created in Customer table
    cust = (await test_session.execute(select(Customer).where(Customer.id == uuid.UUID(customer_id)))).scalar_one_or_none()
    assert cust is not None
    assert cust.phone == "9812345678"
    assert cust.first_name == "Siddharth"

    # Verify Lead status is now CONVERTED and customer_id is linked
    updated_lead = (await test_session.execute(select(InsuranceAgentInquiry).where(InsuranceAgentInquiry.id == uuid.UUID(lead_id)))).scalar_one()
    assert updated_lead.status == "CONVERTED"
    assert updated_lead.customer_id == cust.id


@pytest.mark.asyncio
async def test_lead_dashboard_kpis_and_kanban(client: AsyncClient, admin_auth_token: str):
    headers = {"Authorization": f"Bearer {admin_auth_token}"}

    # 1. Fetch Dashboard Stats
    stats_res = await client.get("/api/v1/insurance/leads/stats", headers=headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "total_leads" in stats
    assert "conversion_rate" in stats
    assert "pipeline_summary" in stats
    assert "agent_performance" in stats
    assert "source_performance" in stats

    # 2. Fetch Kanban Board
    kanban_res = await client.get("/api/v1/insurance/leads/kanban", headers=headers)
    assert kanban_res.status_code == 200
    kanban = kanban_res.json()
    assert len(kanban["stages"]) == 12  # All 12 required stages present
    stage_names = [s["stage"] for s in kanban["stages"]]
    assert "NEW" in stage_names
    assert "REQUIREMENT_COLLECTED" in stage_names
    assert "QUOTATION_SENT" in stage_names
    assert "CONVERTED" in stage_names
    assert "LOST" in stage_names


@pytest.mark.asyncio
async def test_bulk_import_and_export_leads(client: AsyncClient, admin_auth_token: str):
    headers = {"Authorization": f"Bearer {admin_auth_token}"}

    # 1. Download Import Template
    template_res = await client.get("/api/v1/insurance/leads/import/template?format=xlsx", headers=headers)
    assert template_res.status_code == 200
    assert len(template_res.content) > 1000

    # 2. Confirm Bulk Import
    import_payload = {
        "rows": [
            {
                "lead_type": "INDIVIDUAL",
                "full_name": "Aakash Verma",
                "mobile": "9988776655",
                "email": "aakash.v@example.com",
                "policy_type": "Motor",
                "expected_premium": "18000",
                "city": "Bengaluru",
                "priority": "HIGH",
            },
            {
                "lead_type": "CORPORATE",
                "full_name": "Zenith Infotech Pvt Ltd",
                "mobile": "9988776656",
                "email": "contact@zenithinfo.example",
                "policy_type": "Corporate",
                "expected_premium": "150000",
                "city": "Mumbai",
                "priority": "URGENT",
            },
        ]
    }
    confirm_res = await client.post("/api/v1/insurance/leads/import/confirm", json=import_payload, headers=headers)
    assert confirm_res.status_code == 200
    res_data = confirm_res.json()
    assert res_data["imported_count"] == 2
    assert res_data["failed_count"] == 0

    # 3. Export Filtered Leads (CSV & XLSX)
    csv_res = await client.get("/api/v1/insurance/leads/export?format=csv", headers=headers)
    assert csv_res.status_code == 200
    assert "Prospect Name" in csv_res.text
    assert "Aakash Verma" in csv_res.text

    xlsx_res = await client.get("/api/v1/insurance/leads/export?format=xlsx", headers=headers)
    assert xlsx_res.status_code == 200
    assert len(xlsx_res.content) > 2000


@pytest.mark.asyncio
async def test_public_inquiry_submission(client: AsyncClient, test_session: AsyncSession):
    # Create active agent
    sub_agent = InsuranceSubAgent(
        id=uuid.uuid4(),
        full_name="Pooja Deshmukh",
        agent_code="AG-POOJA-01",
        mobile="9823000001",
        email="pooja@finnexus.com",
        public_profile_slug="pooja-insurance",
        status="ACTIVE",
        show_contact_info=True,
    )
    test_session.add(sub_agent)
    await test_session.commit()

    # 1. Fetch public profile
    prof_res = await client.get("/api/v1/insurance/agents/public/pooja-insurance")
    assert prof_res.status_code == 200
    assert prof_res.json()["full_name"] == "Pooja Deshmukh"

    # 2. Submit customer inquiry via public profile
    inquiry_payload = {
        "full_name": "Meera Patel",
        "mobile": "9823999888",
        "email": "meera.patel@example.com",
        "policy_type": "Health",
        "city": "Ahmedabad",
        "pincode": "380001",
        "message": "Need health cover for family of 4.",
        "consent": True,
    }
    submit_res = await client.post("/api/v1/insurance/agents/public/pooja-insurance/inquiries", json=inquiry_payload)
    assert submit_res.status_code == 201
    resp = submit_res.json()
    assert resp["status"] == "success"
    assert resp["lead_number"].startswith("LEAD-")

    # 3. Test Honeypot Spam Rejection
    spam_payload = {**inquiry_payload, "hp_field": "I am a spam bot"}
    spam_res = await client.post("/api/v1/insurance/agents/public/pooja-insurance/inquiries", json=spam_payload)
    assert spam_res.status_code == 400

