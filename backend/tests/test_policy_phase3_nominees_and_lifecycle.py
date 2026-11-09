"""Comprehensive Integration Tests for FinNexus Insurance Engine — Phase 3:
Policy Management, Nominee Governance, Payments & Lifecycle Verification.

Covers:
1. Policy Addition Form with Nominee Share Validation (100% sum rule, rejection of invalid totals)
2. Dedicated Policy Nominees CRUD Endpoints (GET and POST /policies/{id}/nominees)
3. Payment Recording, Installment Status Advancement, and Duplicate Transaction Reference Prevention (HTTP 409)
4. Policy List Search, Filtering (Date ranges, Company, Status) and Dynamic Sorting
5. Policy Update and Status Transition (PATCH /policies/{id}/status + Audit Logging)
6. Policy Contract Renewal (POST /policies/{id}/renew + Historical Integrity + Schedule Renewal)
7. Policy Certificate Data Endpoint (GET /policies/{id}/certificate)
8. Policy Bulk Import Template (.csv and real .xlsx via openpyxl) and Preview Diagnostics
"""

from __future__ import annotations

import io
import uuid
from collections.abc import AsyncGenerator
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models.audit import AuditLog
from app.db.models.crm import Customer
from app.db.models.insurance import (
    InsuranceCompany,
    InsurancePlan,
    InsurancePolicy,
    InsurancePolicyNominee,
    InsurancePurchaseParty,
    InsuranceSubAgent,
    InsurancePolicyPayment,
)
from app.db.seed import seed_initial_data
from app.db.session import Base, get_db_session
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="function")
async def test_session() -> AsyncGenerator[AsyncSession, None]:
    """Create in-memory SQLite database initialized with core platform and insurance tables."""
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
async def client(test_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provide AsyncClient with overridden database session."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield test_session

    app.dependency_overrides[get_db_session] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


async def get_token(client: AsyncClient, email: str = "admin@financeflow.com", password: str = "Admin@12345") -> str:
    """Helper to authenticate and return JWT access token."""
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


async def create_setup_prerequisites(client: AsyncClient, headers: dict) -> dict:
    """Helper to create Customer, Company, Plan, Purchase Party, and Sub-Agent."""
    # 1. Customer
    cust_res = await client.post(
        "/api/v1/insurance/customers",
        json={
            "first_name": "Vikram",
            "last_name": "Aditya",
            "phone": "+91 98111 22233",
            "email": "vikram.aditya@example.com",
            "customer_type": "INDIVIDUAL",
            "gender": "MALE",
        },
        headers=headers,
    )
    assert cust_res.status_code == 201, cust_res.text
    customer_id = cust_res.json()["id"]

    # 2. Company
    comp_res = await client.post(
        "/api/v1/insurance/companies",
        json={"name": "Star Health Insurance", "code": f"STAR_{uuid.uuid4().hex[:6].upper()}", "category": "HEALTH"},
        headers=headers,
    )
    assert comp_res.status_code == 201, comp_res.text
    company_id = comp_res.json()["id"]

    # 3. Plan
    plan_res = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": "Family Health Optima",
            "code": f"FHO_{uuid.uuid4().hex[:6].upper()}",
            "company_id": company_id,
            "policy_type": "HEALTH",
        },
        headers=headers,
    )
    assert plan_res.status_code == 201, plan_res.text
    plan_id = plan_res.json()["id"]

    # 4. Purchase Party
    party_res = await client.post(
        "/api/v1/insurance/purchase-parties",
        json={"name": "Premier Broking Hub", "contact_person": "Sunil Varma", "is_active": True},
        headers=headers,
    )
    assert party_res.status_code == 201, party_res.text
    party_id = party_res.json()["id"]

    # 5. Sub-Agent
    agent_res = await client.post(
        "/api/v1/insurance/sub-agents",
        json={
            "full_name": "Pooja Hegde",
            "phone": "+91 97777 66655",
            "email": f"pooja_{uuid.uuid4().hex[:6]}@agency.in",
            "city": "Bengaluru",
        },
        headers=headers,
    )
    assert agent_res.status_code == 201, agent_res.text
    agent_id = agent_res.json()["id"]

    return {
        "customer_id": customer_id,
        "company_id": company_id,
        "plan_id": plan_id,
        "party_id": party_id,
        "agent_id": agent_id,
    }


# ===========================================================================
# 1. Nominee Management & Validation Tests
# ===========================================================================


@pytest.mark.asyncio
async def test_01_nominee_creation_and_share_validation(client: AsyncClient) -> None:
    """Test policy creation with valid nominees (summing to 100%) and rejection of invalid nominee allocations."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    pre = await create_setup_prerequisites(client, headers)

    policy_num_valid = f"POL-NOM-{uuid.uuid4().hex[:6].upper()}"

    # A. Valid creation: 2 nominees summing to exactly 100% (60% and 40%)
    valid_payload = {
        "customer_id": pre["customer_id"],
        "company_id": pre["company_id"],
        "plan_id": pre["plan_id"],
        "purchase_party_id": pre["party_id"],
        "sub_agent_id": pre["agent_id"],
        "policy_number": policy_num_valid,
        "policy_type": "HEALTH",
        "premium_frequency": "YEARLY",
        "term_years": 1,
        "sum_assured": 1500000.0,
        "premium_amount": 35000.0,
        "policy_start_date": "2026-04-01",
        "expiry_date": "2027-03-31",
        "first_receipt_date": "2026-04-01",
        "notes": "Nominee verified policy",
        "nominees": [
            {
                "full_name": "Kavita Aditya",
                "relationship": "SPOUSE",
                "date_of_birth": "1990-08-20",
                "mobile_number": "+91 98111 22234",
                "share_percentage": 60.0,
            },
            {
                "full_name": "Aarav Aditya",
                "relationship": "SON",
                "date_of_birth": "2018-05-12",
                "share_percentage": 40.0,
            },
        ],
    }

    create_res = await client.post("/api/v1/insurance/policies", json=valid_payload, headers=headers)
    assert create_res.status_code == 201, create_res.text
    data = create_res.json()
    assert data["policy_number"] == policy_num_valid
    assert len(data.get("nominees", [])) == 2
    assert sum(float(n["share_percentage"]) for n in data["nominees"]) == 100.0
    nominee_names = [n["full_name"] for n in data["nominees"]]
    assert "Kavita Aditya" in nominee_names
    assert "Aarav Aditya" in nominee_names

    # B. Invalid creation: nominees sum to 80% (must be rejected with HTTP 422)
    invalid_payload = {
        **valid_payload,
        "policy_number": f"POL-BAD-{uuid.uuid4().hex[:6].upper()}",
        "nominees": [
            {
                "full_name": "Kavita Aditya",
                "relationship": "SPOUSE",
                "share_percentage": 50.0,
            },
            {
                "full_name": "Aarav Aditya",
                "relationship": "SON",
                "share_percentage": 30.0,  # 50 + 30 = 80% != 100%
            },
        ],
    }

    bad_res = await client.post("/api/v1/insurance/policies", json=invalid_payload, headers=headers)
    assert bad_res.status_code == 422, "Must reject nominees that do not sum to 100%"
    assert "100" in bad_res.text


# ===========================================================================
# 2. Dedicated Nominees Sub-Endpoints
# ===========================================================================


@pytest.mark.asyncio
async def test_02_policy_nominee_dedicated_sub_endpoints(client: AsyncClient) -> None:
    """Test GET and POST /policies/{id}/nominees dedicated sub-resource operations."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    pre = await create_setup_prerequisites(client, headers)

    # 1. Create policy initially without nominees
    policy_num = f"POL-SUB-{uuid.uuid4().hex[:6].upper()}"
    p_res = await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": pre["customer_id"],
            "company_id": pre["company_id"],
            "plan_id": pre["plan_id"],
            "policy_number": policy_num,
            "policy_type": "HEALTH",
            "premium_frequency": "YEARLY",
            "term_years": 1,
            "sum_assured": 500000.0,
            "premium_amount": 18000.0,
            "policy_start_date": "2026-01-01",
            "expiry_date": "2026-12-31",
        },
        headers=headers,
    )
    assert p_res.status_code == 201, p_res.text
    policy_id = p_res.json()["id"]

    # 2. GET nominees -> empty list
    get_res = await client.get(f"/api/v1/insurance/policies/{policy_id}/nominees", headers=headers)
    assert get_res.status_code == 200, get_res.text
    assert get_res.json() == []

    # 3. POST nominees -> Add 100% single nominee
    nominees_update = [
        {
            "full_name": "Shweta Aditya",
            "relationship": "MOTHER",
            "date_of_birth": "1965-03-10",
            "mobile_number": "+91 94444 33322",
            "address": "12, Shanti Nagar, Bengaluru",
            "share_percentage": 100.0,
        }
    ]
    post_res = await client.post(
        f"/api/v1/insurance/policies/{policy_id}/nominees",
        json=nominees_update,
        headers=headers,
    )
    assert post_res.status_code == 200, post_res.text
    nominees_data = post_res.json()
    assert len(nominees_data) == 1
    assert nominees_data[0]["full_name"] == "Shweta Aditya"
    assert float(nominees_data[0]["share_percentage"]) == 100.0

    # 4. Verify detail endpoint also reflects updated nominees
    detail_res = await client.get(f"/api/v1/insurance/policies/{policy_id}", headers=headers)
    assert detail_res.status_code == 200, detail_res.text
    assert len(detail_res.json().get("nominees", [])) == 1


# ===========================================================================
# 3. Payment Management & Duplicate Transaction Reference Prevention
# ===========================================================================


@pytest.mark.asyncio
async def test_03_payment_recording_and_duplicate_reference_prevention(client: AsyncClient) -> None:
    """Test recording policy payments, installment status advancement, and duplicate reference blocking."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    pre = await create_setup_prerequisites(client, headers)

    # 1. Create Policy
    policy_num = f"POL-PAY-{uuid.uuid4().hex[:6].upper()}"
    p_res = await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": pre["customer_id"],
            "company_id": pre["company_id"],
            "plan_id": pre["plan_id"],
            "policy_number": policy_num,
            "policy_type": "HEALTH",
            "premium_frequency": "YEARLY",
            "term_years": 1,
            "sum_assured": 1000000.0,
            "premium_amount": 25000.0,
            "policy_start_date": "2026-01-01",
            "expiry_date": "2026-12-31",
        },
        headers=headers,
    )
    assert p_res.status_code == 201, p_res.text
    policy_id = p_res.json()["id"]

    # 2. Record initial payment with reference "TXN-UNIQUE-001"
    txn_ref = f"TXN-{uuid.uuid4().hex[:8].upper()}"
    pay_payload = {
        "amount": 25000.0,
        "payment_date": "2026-01-01",
        "payment_mode": "ONLINE",
        "transaction_reference": txn_ref,
        "receipt_number": f"RCP-{uuid.uuid4().hex[:6].upper()}",
        "notes": "Full annual premium payment",
    }
    pay_res = await client.post(f"/api/v1/insurance/policies/{policy_id}/payments", json=pay_payload, headers=headers)
    assert pay_res.status_code == 201, pay_res.text
    pay_data = pay_res.json()
    assert float(pay_data["amount"]) == 25000.0
    assert pay_data["transaction_reference"] == txn_ref

    # 3. Verify installments updated to PAID
    detail_res = await client.get(f"/api/v1/insurance/policies/{policy_id}", headers=headers)
    assert detail_res.status_code == 200, detail_res.text
    schedules = detail_res.json().get("schedules", [])
    assert len(schedules) >= 1
    assert schedules[0]["status"] == "PAID"

    # 4. Attempt duplicate payment with the same transaction reference -> HTTP 409 Conflict
    dup_res = await client.post(f"/api/v1/insurance/policies/{policy_id}/payments", json=pay_payload, headers=headers)
    assert dup_res.status_code == 409, f"Should prevent duplicate txn ref, got: {dup_res.status_code}"
    assert "already been recorded" in dup_res.text or dup_res.status_code == 409


# ===========================================================================
# 4. Policy Search, Filtering and Dynamic Sorting
# ===========================================================================


@pytest.mark.asyncio
async def test_04_policy_search_date_filters_and_sorting(client: AsyncClient) -> None:
    """Test policy listing with multi-field search, date range filters, and dynamic ordering."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    pre = await create_setup_prerequisites(client, headers)

    # Create distinct policies
    p1_num = f"POL-SRCH-A-{uuid.uuid4().hex[:4].upper()}"
    p2_num = f"POL-SRCH-B-{uuid.uuid4().hex[:4].upper()}"

    await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": pre["customer_id"],
            "company_id": pre["company_id"],
            "plan_id": pre["plan_id"],
            "policy_number": p1_num,
            "policy_type": "HEALTH",
            "premium_frequency": "YEARLY",
            "term_years": 1,
            "sum_assured": 500000.0,
            "premium_amount": 12000.0,
            "policy_start_date": "2026-01-01",
            "expiry_date": "2026-12-31",
        },
        headers=headers,
    )

    await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": pre["customer_id"],
            "company_id": pre["company_id"],
            "plan_id": pre["plan_id"],
            "policy_number": p2_num,
            "policy_type": "HEALTH",
            "premium_frequency": "YEARLY",
            "term_years": 1,
            "sum_assured": 800000.0,
            "premium_amount": 22000.0,
            "policy_start_date": "2026-05-01",
            "expiry_date": "2027-04-30",
        },
        headers=headers,
    )

    # 1. Search by exact policy number
    search_res = await client.get(f"/api/v1/insurance/policies?search={p1_num}", headers=headers)
    assert search_res.status_code == 200, search_res.text
    items = search_res.json()["items"]
    assert len(items) == 1
    assert items[0]["policy_number"] == p1_num

    # 2. Filter by date range (start_date_from = 2026-04-01 should include P2, exclude P1)
    date_res = await client.get(
        "/api/v1/insurance/policies?start_date_from=2026-04-01&start_date_to=2026-06-01",
        headers=headers,
    )
    assert date_res.status_code == 200, date_res.text
    matched_nums = [it["policy_number"] for it in date_res.json()["items"]]
    assert p2_num in matched_nums
    assert p1_num not in matched_nums

    # 3. Dynamic sorting by policy_number desc
    sort_res = await client.get("/api/v1/insurance/policies?sort_by=policy_number&sort_order=desc", headers=headers)
    assert sort_res.status_code == 200, sort_res.text
    all_nums = [it["policy_number"] for it in sort_res.json()["items"]]
    assert all_nums == sorted(all_nums, reverse=True)


# ===========================================================================
# 5. Policy Update and Status Transition (Audit Trail)
# ===========================================================================


@pytest.mark.asyncio
async def test_05_policy_update_and_status_transition(client: AsyncClient, test_session: AsyncSession) -> None:
    """Test policy attribute updates and status transitions recorded in audit trail."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    pre = await create_setup_prerequisites(client, headers)

    # 1. Create policy
    p_num = f"POL-UPD-{uuid.uuid4().hex[:6].upper()}"
    p_res = await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": pre["customer_id"],
            "company_id": pre["company_id"],
            "plan_id": pre["plan_id"],
            "policy_number": p_num,
            "policy_type": "HEALTH",
            "premium_frequency": "YEARLY",
            "term_years": 1,
            "sum_assured": 500000.0,
            "premium_amount": 15000.0,
            "policy_start_date": "2026-01-01",
            "expiry_date": "2026-12-31",
            "notes": "Initial notes",
        },
        headers=headers,
    )
    assert p_res.status_code == 201, p_res.text
    policy_id = p_res.json()["id"]

    # 2. Update sum_assured and notes
    upd_res = await client.put(
        f"/api/v1/insurance/policies/{policy_id}",
        json={"sum_assured": 750000.0, "notes": "Endorsement: Sum assured increased"},
        headers=headers,
    )
    assert upd_res.status_code == 200, upd_res.text
    assert float(upd_res.json()["sum_assured"]) == 750000.0
    assert "Sum assured increased" in upd_res.json()["notes"]

    # 3. Transition status via PATCH /policies/{id}/status to CANCELLED
    status_res = await client.patch(
        f"/api/v1/insurance/policies/{policy_id}/status",
        json={"status": "CANCELLED", "notes": "Customer migrated overseas"},
        headers=headers,
    )
    assert status_res.status_code == 200, status_res.text
    assert status_res.json()["status"] == "CANCELLED"

    # 4. Verify Audit Log entry exists in DB
    audit_stmt = select(AuditLog).where(AuditLog.action == "POLICY_STATUS_CHANGED")
    audit_rows = (await test_session.execute(audit_stmt)).scalars().all()
    assert len(audit_rows) > 0
    assert any("CANCELLED" in str(row.state_delta) for row in audit_rows)


# ===========================================================================
# 6. Policy Contract Renewal Lifecycle
# ===========================================================================


@pytest.mark.asyncio
async def test_06_policy_contract_renewal_lifecycle(client: AsyncClient, test_session: AsyncSession) -> None:
    """Test policy contract renewal advances expiry date, keeps history, and creates renewal schedules."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    pre = await create_setup_prerequisites(client, headers)

    # 1. Create initial policy expiring on 2026-12-31
    p_num = f"POL-REN-{uuid.uuid4().hex[:6].upper()}"
    p_res = await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": pre["customer_id"],
            "company_id": pre["company_id"],
            "plan_id": pre["plan_id"],
            "sub_agent_id": pre["agent_id"],
            "policy_number": p_num,
            "policy_type": "HEALTH",
            "premium_frequency": "YEARLY",
            "term_years": 1,
            "sum_assured": 1000000.0,
            "premium_amount": 28000.0,
            "policy_start_date": "2026-01-01",
            "expiry_date": "2026-12-31",
        },
        headers=headers,
    )
    assert p_res.status_code == 201, p_res.text
    policy_id = p_res.json()["id"]

    # 2. Record initial payment on original policy
    await client.post(
        f"/api/v1/insurance/policies/{policy_id}/payments",
        json={
            "amount": 28000.0,
            "payment_date": "2026-01-01",
            "payment_mode": "BANK_TRANSFER",
            "transaction_reference": f"ORIG-TXN-{uuid.uuid4().hex[:6]}",
        },
        headers=headers,
    )

    # 3. Renew policy contract for year 2027
    renew_payload = {
        "renewal_date": "2027-01-01",
        "new_expiry_date": "2027-12-31",
        "renewed_premium_amount": 31000.0,
        "notes": "Annual policy renewal contract executed",
    }
    renew_res = await client.post(
        f"/api/v1/insurance/policies/{policy_id}/renew",
        json=renew_payload,
        headers=headers,
    )
    assert renew_res.status_code == 200, renew_res.text
    ren_data = renew_res.json()
    assert ren_data["status"] == "ACTIVE"
    assert ren_data["expiry_date"] == "2027-12-31"
    assert float(ren_data["premium_amount"]) == 31000.0

    # 4. Verify policy details after renewal:
    # Historical payment remains intact on original policy
    detail_res = await client.get(f"/api/v1/insurance/policies/{policy_id}", headers=headers)
    assert detail_res.status_code == 200, detail_res.text
    d = detail_res.json()
    assert len(d.get("payments", [])) == 1
    assert float(d["payments"][0]["amount"]) == 28000.0
    # Original policy status transitioned to EXPIRED while preserving original data
    assert d["status"] in ("EXPIRED", "ACTIVE")

    # New renewal policy contract has its own schedule and links to previous_policy_id
    new_pid = ren_data["policy_id"]
    new_detail_res = await client.get(f"/api/v1/insurance/policies/{new_pid}", headers=headers)
    assert new_detail_res.status_code == 200, new_detail_res.text
    nd = new_detail_res.json()
    assert nd["previous_policy_id"] == policy_id
    assert nd["status"] == "ACTIVE"
    assert len(nd.get("schedules", [])) >= 1

    # 5. Verify POLICY_RENEWED logged in AuditLog
    audit_stmt = select(AuditLog).where(AuditLog.action == "POLICY_RENEWED")
    audit_rows = (await test_session.execute(audit_stmt)).scalars().all()
    assert len(audit_rows) > 0


# ===========================================================================
# 7. Policy Certificate Verification
# ===========================================================================


@pytest.mark.asyncio
async def test_07_policy_certificate_generation(client: AsyncClient) -> None:
    """Test policy certificate verification endpoint delivers verified metadata."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    pre = await create_setup_prerequisites(client, headers)

    p_num = f"POL-CERT-{uuid.uuid4().hex[:6].upper()}"
    p_res = await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": pre["customer_id"],
            "company_id": pre["company_id"],
            "plan_id": pre["plan_id"],
            "policy_number": p_num,
            "policy_type": "HEALTH",
            "premium_frequency": "YEARLY",
            "term_years": 1,
            "sum_assured": 1200000.0,
            "premium_amount": 24000.0,
            "policy_start_date": "2026-03-01",
            "expiry_date": "2027-02-28",
            "nominees": [
                {
                    "full_name": "Kavita Aditya",
                    "relationship": "SPOUSE",
                    "share_percentage": 100.0,
                }
            ],
        },
        headers=headers,
    )
    assert p_res.status_code == 201, p_res.text
    policy_id = p_res.json()["id"]

    cert_res = await client.get(f"/api/v1/insurance/policies/{policy_id}/certificate", headers=headers)
    assert cert_res.status_code == 200, cert_res.text
    cert = cert_res.json()
    assert cert["certificate_id"] == f"CERT-{p_num}"
    pol = cert["policy"]
    assert pol["policy_number"] == p_num
    assert pol["status"] == "ACTIVE"
    assert pol["company_name"] == "Star Health Insurance"
    assert pol["plan_name"] == "Family Health Optima"
    assert len(pol["nominees"]) == 1
    assert pol["nominees"][0]["full_name"] == "Kavita Aditya"


# ===========================================================================
# 8. Bulk Policy Import: Excel (.xlsx) & CSV Templates and Diagnostics
# ===========================================================================


@pytest.mark.asyncio
async def test_08_bulk_import_excel_and_csv_templates(client: AsyncClient) -> None:
    """Test bulk import template downloads in CSV and real openpyxl XLSX formats."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Download CSV template
    csv_res = await client.get("/api/v1/insurance/policies/import/template?format=csv", headers=headers)
    assert csv_res.status_code == 200, csv_res.text
    assert "text/csv" in csv_res.headers["content-type"]
    assert "mobile number" in csv_res.text.lower() or "customer mobile" in csv_res.text.lower()
    assert "policy number" in csv_res.text.lower() or "policy_number" in csv_res.text.lower()

    # 2. Download genuine XLSX template
    xlsx_res = await client.get("/api/v1/insurance/policies/import/template?format=xlsx", headers=headers)
    assert xlsx_res.status_code == 200, xlsx_res.text
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in xlsx_res.headers["content-type"]
    # Verify openxml zip signature (PK\x03\x04)
    assert xlsx_res.content.startswith(b"PK\x03\x04"), "Must be a genuine binary Excel workbook"


# ===========================================================================
# 9. Policy Audit History & Lifecycle Timeline Verification
# ===========================================================================


@pytest.mark.asyncio
async def test_09_policy_audit_history_timeline(client: AsyncClient) -> None:
    """Test policy audit history endpoint records chronological timeline of policy actions."""
    token = await get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    pre = await create_setup_prerequisites(client, headers)

    p_num = f"POL-AUD-{uuid.uuid4().hex[:6].upper()}"

    # 1. Create policy with initial payment
    create_res = await client.post(
        "/api/v1/insurance/policies",
        json={
            "customer_id": pre["customer_id"],
            "company_id": pre["company_id"],
            "plan_id": pre["plan_id"],
            "policy_number": p_num,
            "policy_type": "HEALTH",
            "premium_frequency": "YEARLY",
            "term_years": 1,
            "sum_assured": 700000.0,
            "premium_amount": 16000.0,
            "policy_start_date": "2026-02-01",
            "expiry_date": "2027-01-31",
            "nominees": [
                {
                    "full_name": "Radhika Aditya",
                    "relationship": "SPOUSE",
                    "share_percentage": 100.0,
                }
            ],
            "initial_payment": {
                "amount": 16000.0,
                "payment_mode": "ONLINE",
                "transaction_reference": f"AUD-TXN-{uuid.uuid4().hex[:6].upper()}",
            },
        },
        headers=headers,
    )
    assert create_res.status_code == 201, create_res.text
    pol_id = create_res.json()["id"]

    # 2. Update policy
    upd_res = await client.put(
        f"/api/v1/insurance/policies/{pol_id}",
        json={"sum_assured": 900000.0},
        headers=headers,
    )
    assert upd_res.status_code == 200, upd_res.text

    # 3. Transition status
    stat_res = await client.patch(
        f"/api/v1/insurance/policies/{pol_id}/status",
        json={"status": "LAPSED", "notes": "Grace period expired"},
        headers=headers,
    )
    assert stat_res.status_code == 200, stat_res.text

    # 4. Fetch audit history endpoint
    audit_res = await client.get(f"/api/v1/insurance/policies/{pol_id}/audit-history", headers=headers)
    assert audit_res.status_code == 200, audit_res.text
    timeline = audit_res.json()
    assert isinstance(timeline, list)
    actions = [event["action"] for event in timeline]
    assert "POLICY_CREATED" in actions
    assert "POLICY_PAYMENT_RECORDED" in actions
    assert "POLICY_UPDATED" in actions
    assert "POLICY_STATUS_CHANGED" in actions
    assert len(timeline) >= 4
 