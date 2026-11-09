"""End-to-end backend tests for Policy History Workflow (Portability & Renewals).

Tests:
1. Policy Issuance with NEW: policy history is omitted / empty, regular creation succeeds.
2. Policy Issuance with PORT: Last Year's Policy (seq=1) and Earlier Policy (seq=2) persisted, sequence maintained, sync fields updated.
3. Policy Issuance with RENEW: previous policy linked or external record saved with sequence=1, history retrievable in detail.
4. Financial Isolation: historical policy records NEVER generate commissions or premium schedules.
5. Update Policy History: updates historical entries on existing policy safely.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models.crm import Customer
from app.db.models.insurance import (
    InsuranceCompany,
    InsurancePlan,
    InsurancePolicy,
    InsurancePolicyHistory,
    InsurancePolicyCommission,
    InsurancePremiumSchedule,
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


async def get_token(client: AsyncClient, email: str = "admin@finnexus.com", password: str = "Admin@12345") -> str:
    """Helper to authenticate and return JWT access token."""
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    if res.status_code != 200:
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@financeflow.com", "password": password},
        )
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json()["access_token"]


async def get_test_carrier_and_plan(session: AsyncSession) -> tuple[InsuranceCompany, InsurancePlan, Customer]:
    """Retrieve or create carrier, plan and customer for policy issuance tests."""
    carrier = (await session.execute(select(InsuranceCompany).where(InsuranceCompany.is_active.is_(True)))).scalars().first()
    if not carrier:
        carrier = InsuranceCompany(
            id=uuid.uuid4(),
            name="Care Health Insurance Ltd",
            code="CARE",
            category="Health",
            is_active=True,
        )
        session.add(carrier)

    plan = (await session.execute(select(InsurancePlan).where(InsurancePlan.company_id == carrier.id))).scalars().first()
    if not plan:
        plan = InsurancePlan(
            id=uuid.uuid4(),
            company_id=carrier.id,
            name="Care Supreme Health Shield",
            code="CARE-SUP",
            line_of_business="Health",
            status="ACTIVE",
        )
        session.add(plan)

    cust = (await session.execute(select(Customer))).scalars().first()
    if not cust:
        cust = Customer(
            id=uuid.uuid4(),
            first_name="Ramesh",
            last_name="Sharma",
            email="ramesh.sharma@example.com",
            phone="+919876543210",
            city="Mumbai",
            pincode="400001",
        )
        session.add(cust)

    await session.commit()
    return carrier, plan, cust


@pytest.mark.asyncio
async def test_01_new_policy_omits_history(client: AsyncClient, test_session: AsyncSession):
    """Test NEW business type omits previous history cleanly."""
    token = await get_token(client)
    carrier, plan, cust = await get_test_carrier_and_plan(test_session)

    payload = {
        "policy_number": f"POL-NEW-{uuid.uuid4().hex[:6].upper()}",
        "policy_type": "Health",
        "customer_id": str(cust.id),
        "company_id": str(carrier.id),
        "plan_id": str(plan.id),
        "term_years": 1,
        "sum_assured": 500000,
        "final_premium": 15000,
        "net_premium": 12711.86,
        "tax_amount": 2288.14,
        "premium_mode": "Yearly",
        "policy_start_date": str(date.today()),
        "business_type": "NEW",
        "coverage_type": "INDIVIDUAL",
        "policy_history": [],
    }

    res = await client.post(
        "/api/v1/insurance/policies",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201, f"Failed to create policy: {res.text}"
    data = res.json()
    assert data["business_type"] == "NEW"
    assert data["policy_history"] == []


@pytest.mark.asyncio
async def test_02_portability_policy_with_multi_year_history(client: AsyncClient, test_session: AsyncSession):
    """Test PORT policy records sequence 1 (Last Year) and sequence 2 (Last-to-Last Year)."""
    token = await get_token(client)
    carrier, plan, cust = await get_test_carrier_and_plan(test_session)

    last_year_start = date.today() - timedelta(days=365)
    last_year_end = date.today() - timedelta(days=1)
    earlier_start = date.today() - timedelta(days=730)
    earlier_end = date.today() - timedelta(days=366)

    payload = {
        "policy_number": f"POL-PORT-{uuid.uuid4().hex[:6].upper()}",
        "policy_type": "Health",
        "customer_id": str(cust.id),
        "company_id": str(carrier.id),
        "plan_id": str(plan.id),
        "term_years": 1,
        "sum_assured": 1000000,
        "final_premium": 22000,
        "net_premium": 18644.07,
        "tax_amount": 3355.93,
        "premium_mode": "Yearly",
        "policy_start_date": str(date.today()),
        "business_type": "PORT",
        "coverage_type": "INDIVIDUAL",
        "policy_history": [
            {
                "history_sequence": 1,
                "insurance_company_name": "Star Health Insurance",
                "previous_policy_number": "STAR-2025-987654",
                "policy_business_type": "PORT",
                "policy_start_date": str(last_year_start),
                "policy_expiry_date": str(last_year_end),
                "sum_insured": 750000,
                "net_premium": 15000,
                "gross_premium": 17700,
                "product_variant": "Comprehensive Optima",
                "policy_status": "ACTIVE",
                "claim_history": "NO_CLAIM",
                "insurer_contact": "care@starhealth.in / 1800-425-2255",
                "cumulative_bonus": "20% NCB accrued (₹1,50,000 bonus)",
                "continuity_details": "48 months continuous coverage ported under IRDAI guidelines",
                "waiting_period_waiver_details": "Pre-existing disease 3-year waiting period fully served",
                "remarks": "Clean claim history, portability approved with 100% time credit",
                "is_external_policy": True,
            },
            {
                "history_sequence": 2,
                "insurance_company_name": "HDFC ERGO General Insurance",
                "previous_policy_number": "HDFC-2024-112233",
                "policy_business_type": "PORT",
                "policy_start_date": str(earlier_start),
                "policy_expiry_date": str(earlier_end),
                "sum_insured": 500000,
                "net_premium": 12000,
                "gross_premium": 14160,
                "product_variant": "Optima Restore Silver",
                "policy_status": "ACTIVE",
                "claim_history": "NO_CLAIM",
                "cumulative_bonus": "10% NCB",
                "remarks": "Original base policy before first portability transfer",
                "is_external_policy": True,
            },
        ],
    }

    res = await client.post(
        "/api/v1/insurance/policies",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201, f"Failed to create PORT policy: {res.text}"
    created = res.json()
    policy_id = created["id"]

    assert created["business_type"] == "PORT"
    # Backward compatibility sync
    assert created["previous_policy_number"] == "STAR-2025-987654"
    assert created["previous_insurer"] == "Star Health Insurance"
    assert "48 months" in (created["portability_continuity_details"] or "")

    # Retrieve policy detail
    det_res = await client.get(f"/api/v1/insurance/policies/{policy_id}", headers={"Authorization": f"Bearer {token}"})
    assert det_res.status_code == 200
    detail = det_res.json()

    history = detail.get("policy_history", [])
    assert len(history) == 2, f"Expected 2 history records, got {len(history)}"

    # Check Sequence 1 (Last Year)
    h1 = history[0]
    assert h1["history_sequence"] == 1
    assert h1["insurance_company_name"] == "Star Health Insurance"
    assert h1["previous_policy_number"] == "STAR-2025-987654"
    assert float(h1["sum_insured"]) == 750000.0
    assert h1["continuity_details"] == "48 months continuous coverage ported under IRDAI guidelines"
    assert "Pre-existing" in h1["waiting_period_waiver_details"]

    # Check Sequence 2 (Last-to-Last Year)
    h2 = history[1]
    assert h2["history_sequence"] == 2
    assert h2["insurance_company_name"] == "HDFC ERGO General Insurance"
    assert h2["previous_policy_number"] == "HDFC-2024-112233"
    assert float(h2["sum_insured"]) == 500000.0


@pytest.mark.asyncio
async def test_03_renewal_policy_with_linked_existing_policy(client: AsyncClient, test_session: AsyncSession):
    """Test RENEW policy links internal previous_policy_id or records external history."""
    token = await get_token(client)
    carrier, plan, cust = await get_test_carrier_and_plan(test_session)

    # 1. Create previous base policy
    prev_payload = {
        "policy_number": f"POL-BASE-{uuid.uuid4().hex[:6].upper()}",
        "policy_type": "Health",
        "customer_id": str(cust.id),
        "company_id": str(carrier.id),
        "plan_id": str(plan.id),
        "term_years": 1,
        "sum_assured": 500000,
        "final_premium": 15000,
        "net_premium": 12711.86,
        "tax_amount": 2288.14,
        "premium_mode": "Yearly",
        "policy_start_date": str(date.today() - timedelta(days=365)),
        "business_type": "NEW",
        "coverage_type": "INDIVIDUAL",
    }
    prev_res = await client.post("/api/v1/insurance/policies", json=prev_payload, headers={"Authorization": f"Bearer {token}"})
    assert prev_res.status_code == 201
    prev_data = prev_res.json()
    prev_policy_id = prev_data["id"]
    prev_policy_number = prev_data["policy_number"]

    # 2. Issue Renewal Policy linking the previous policy
    renew_payload = {
        "policy_number": f"POL-REN-{uuid.uuid4().hex[:6].upper()}",
        "policy_type": "Health",
        "customer_id": str(cust.id),
        "company_id": str(carrier.id),
        "plan_id": str(plan.id),
        "term_years": 1,
        "sum_assured": 600000,
        "final_premium": 16500,
        "net_premium": 13983.05,
        "tax_amount": 2516.95,
        "premium_mode": "Yearly",
        "policy_start_date": str(date.today()),
        "business_type": "RENEW",
        "coverage_type": "INDIVIDUAL",
        "policy_history": [
            {
                "history_sequence": 1,
                "previous_policy_id": prev_policy_id,
                "insurance_company_name": carrier.name,
                "previous_policy_number": prev_policy_number,
                "policy_business_type": "RENEW",
                "policy_start_date": str(date.today() - timedelta(days=365)),
                "policy_expiry_date": str(date.today() - timedelta(days=1)),
                "sum_insured": 500000,
                "net_premium": 12711.86,
                "gross_premium": 15000,
                "product_variant": plan.name,
                "policy_status": "EXPIRED",
                "claim_history": "NO_CLAIM",
                "cumulative_bonus": "10% Cumulative Bonus accrued",
                "remarks": "On-time renewal with no gap in cover",
                "is_external_policy": False,
            }
        ],
    }

    renew_res = await client.post("/api/v1/insurance/policies", json=renew_payload, headers={"Authorization": f"Bearer {token}"})
    assert renew_res.status_code == 201
    renew_data = renew_res.json()
    assert renew_data["business_type"] == "RENEW"
    assert len(renew_data["policy_history"]) == 1
    assert renew_data["policy_history"][0]["previous_policy_id"] == prev_policy_id
    assert renew_data["policy_history"][0]["previous_policy_number"] == prev_policy_number


@pytest.mark.asyncio
async def test_04_history_financial_isolation(client: AsyncClient, test_session: AsyncSession):
    """Ensure historical records do NOT generate commissions, payment schedules or mutate totals."""
    token = await get_token(client)
    carrier, plan, cust = await get_test_carrier_and_plan(test_session)

    pol_num = f"POL-ISO-{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "policy_number": pol_num,
        "policy_type": "Health",
        "customer_id": str(cust.id),
        "company_id": str(carrier.id),
        "plan_id": str(plan.id),
        "term_years": 1,
        "sum_assured": 500000,
        "final_premium": 10000,
        "net_premium": 8474.58,
        "tax_amount": 1525.42,
        "premium_mode": "Yearly",
        "policy_start_date": str(date.today()),
        "business_type": "PORT",
        "coverage_type": "INDIVIDUAL",
        "policy_history": [
            {
                "history_sequence": 1,
                "insurance_company_name": "Old Insurer A",
                "previous_policy_number": "HIST-001",
                "policy_business_type": "PORT",
                "sum_insured": 500000,
                "net_premium": 8000,
                "gross_premium": 9440,
            },
            {
                "history_sequence": 2,
                "insurance_company_name": "Old Insurer B",
                "previous_policy_number": "HIST-002",
                "policy_business_type": "PORT",
                "sum_insured": 300000,
                "net_premium": 6000,
                "gross_premium": 7080,
            },
        ],
    }

    res = await client.post("/api/v1/insurance/policies", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    pol_id = res.json()["id"]

    # Verify that in DB, only 1 policy commission was created (for current policy, not historical)
    comm_count = (await test_session.execute(
        select(func.count(InsurancePolicyCommission.id)).where(InsurancePolicyCommission.policy_id == uuid.UUID(pol_id))
    )).scalar()
    assert comm_count == 1, f"Expected 1 commission for current policy, got {comm_count}"

    # Verify schedules: exactly 1 schedule for 1 year yearly policy
    sched_count = (await test_session.execute(
        select(func.count(InsurancePremiumSchedule.id)).where(InsurancePremiumSchedule.policy_id == uuid.UUID(pol_id))
    )).scalar()
    assert sched_count == 1, f"Expected 1 premium schedule for current policy, got {sched_count}"


@pytest.mark.asyncio
async def test_05_update_policy_history(client: AsyncClient, test_session: AsyncSession):
    """Test updating historical records on an existing policy."""
    token = await get_token(client)
    carrier, plan, cust = await get_test_carrier_and_plan(test_session)

    # 1. Create policy with 1 history record
    payload = {
        "policy_number": f"POL-UPDH-{uuid.uuid4().hex[:6].upper()}",
        "policy_type": "Health",
        "customer_id": str(cust.id),
        "company_id": str(carrier.id),
        "plan_id": str(plan.id),
        "term_years": 1,
        "sum_assured": 500000,
        "final_premium": 12000,
        "premium_mode": "Yearly",
        "policy_start_date": str(date.today()),
        "business_type": "PORT",
        "coverage_type": "INDIVIDUAL",
        "policy_history": [
            {
                "history_sequence": 1,
                "insurance_company_name": "Initial Historical Carrier",
                "previous_policy_number": "OLD-001",
                "policy_business_type": "PORT",
                "sum_insured": 500000,
            }
        ],
    }
    create_res = await client.post("/api/v1/insurance/policies", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert create_res.status_code == 201
    policy_id = create_res.json()["id"]

    # 2. Update policy with modified history (add a second sequence)
    update_payload = {
        "policy_history": [
            {
                "history_sequence": 1,
                "insurance_company_name": "Updated Historical Carrier",
                "previous_policy_number": "OLD-001-MOD",
                "policy_business_type": "PORT",
                "sum_insured": 550000,
            },
            {
                "history_sequence": 2,
                "insurance_company_name": "Second Older Carrier",
                "previous_policy_number": "OLD-002",
                "policy_business_type": "PORT",
                "sum_insured": 300000,
            },
        ]
    }
    upd_res = await client.put(f"/api/v1/insurance/policies/{policy_id}", json=update_payload, headers={"Authorization": f"Bearer {token}"})
    assert upd_res.status_code == 200
    upd_data = upd_res.json()

    assert len(upd_data["policy_history"]) == 2
    assert upd_data["policy_history"][0]["insurance_company_name"] == "Updated Historical Carrier"
    assert upd_data["policy_history"][0]["previous_policy_number"] == "OLD-001-MOD"
    assert float(upd_data["policy_history"][0]["sum_insured"]) == 550000.0
    assert upd_data["policy_history"][1]["insurance_company_name"] == "Second Older Carrier"
