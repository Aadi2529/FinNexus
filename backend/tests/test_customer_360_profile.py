"""Comprehensive Integration Tests for FinNexus Insurance Engine Customer 360° Profile & History Dashboard."""

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models.crm import Customer
from app.db.models.insurance import (
    InsuranceCompany,
    InsurancePlan,
    InsurancePolicy,
    InsurancePolicyNominee,
    InsurancePolicyPayment,
)
from app.db.seed import seed_initial_data
from app.db.session import Base, get_db_session
from app.main import app
from app.services.insurance.customer_service import _classify_insurance_category, _format_exact_age_safe
from app.services.insurance.kyc_crypto import encrypt_kyc_value, mask_aadhaar, mask_pan

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
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest.fixture
async def auth_headers(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@financeflow.com", "password": "Admin@12345"},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_format_exact_age_safe_unit():
    """Unit test exact age calculation helper."""
    today = date(2026, 11, 5)
    # Exactly 25 years ago
    dob_25 = date(2001, 11, 5)
    age_str, completed_years = _format_exact_age_safe(dob_25, today)
    assert completed_years == 25
    assert "25" in age_str

    # Complex age: 34 years, 6 months, 18 days
    dob_complex = date(1992, 4, 18)
    age_c, yrs_c = _format_exact_age_safe(dob_complex, today)
    assert yrs_c == 34
    assert "34 Years" in age_c
    assert "6 Months" in age_c

    # None DOB
    age_none, years_none = _format_exact_age_safe(None, today)
    assert age_none is None
    assert years_none is None


@pytest.mark.asyncio
async def test_classify_insurance_category_unit():
    """Unit test canonical category classifier."""
    assert _classify_insurance_category("HEALTH", "Comprehensive Health", None)[0] == "Health Insurance"
    assert _classify_insurance_category("TERM", "Term Life Shield", None)[0] == "Life Insurance"
    assert _classify_insurance_category("MOTOR", "Comprehensive Car", None)[0] == "Motor Insurance"
    assert _classify_insurance_category("TRAVEL", "World Travel Gold", None)[0] == "Travel Insurance"
    assert _classify_insurance_category("FIRE", "Industrial Fire", None)[0] == "Fire Insurance"
    assert _classify_insurance_category("HOME", "Home Shield", None)[0] == "Home Insurance"
    assert _classify_insurance_category("MARINE", "Cargo Ocean", None)[0] == "Marine Insurance"
    assert _classify_insurance_category("MISCELLANEOUS", "Cyber Protect", None)[0] == "Other Insurance"


@pytest.mark.asyncio
async def test_customer_360_profile_endpoint_success(
    client: AsyncClient, auth_headers: dict, test_session: AsyncSession
):
    """Test full Customer 360 profile retrieval via GET /api/v1/insurance/customers/{customer_id}/360."""
    # 1. Create a customer with encrypted KYC and exact DOB
    dob = date(1992, 4, 18)
    cust_id = uuid.uuid4()
    cust = Customer(
        id=cust_id,
        first_name="Rajesh",
        last_name="Kumar",
        phone="+91 99887 76655",
        email="rajesh.kumar@example.com",
        customer_type="INDIVIDUAL",
        gender="MALE",
        marital_status="MARRIED",
        nationality="Indian",
        occupation="Chartered Accountant",
        source_of_income="PROFESSIONAL_FEES",
        address="Flat 502, Prestige Tower, MG Road",
        city="Mumbai",
        state="Maharashtra",
        pincode="400001",
        date_of_birth=dob,
        pan_encrypted=encrypt_kyc_value("ABCDE1234F"),
        aadhaar_encrypted=encrypt_kyc_value("234567890123"),
    )
    test_session.add(cust)
    await test_session.commit()

    # 2. Call Customer 360 endpoint
    resp = await client.get(
        f"/api/v1/insurance/customers/{cust_id}/360",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # 3. Verify Customer Basic & Personal Info
    c_info = data["customer"]
    assert c_info["id"] == str(cust_id)
    assert c_info["first_name"] == "Rajesh"
    assert c_info["last_name"] == "Kumar"
    assert c_info["phone"] == "+91 99887 76655"
    assert c_info["email"] == "rajesh.kumar@example.com"
    assert c_info["customer_type"] == "INDIVIDUAL"
    assert c_info["occupation"] == "Chartered Accountant"
    assert "34 Years" in c_info["exact_age"]

    # 4. Verify Masked KYC values by default
    assert c_info["pan_number"] == mask_pan("ABCDE1234F")
    assert "XXXXX" in c_info["pan_number"]
    assert c_info["aadhaar_number"] == mask_aadhaar("234567890123")

    # 5. Verify KPIs structure
    kpis = data["kpis"]
    assert kpis["total_policies"] == 0
    assert kpis["active_policies"] == 0
    assert kpis["expired_policies"] == 0
    assert kpis["total_family_members"] == 0
    assert float(kpis["total_sum_insured"]) == 0.0

    # 6. Verify 8 Canonical Categories are all present
    cats = data["categories"]
    assert len(cats) == 8
    cat_names = [cat["category"] for cat in cats]
    expected_cats = [
        "Health Insurance",
        "Life Insurance",
        "Motor Insurance",
        "Travel Insurance",
        "Fire Insurance",
        "Home Insurance",
        "Marine Insurance",
        "Other Insurance",
    ]
    for ec in expected_cats:
        assert ec in cat_names

    # 7. Verify Timeline has profile creation event
    timeline = data["timeline"]
    assert len(timeline) >= 1
    assert any("Profile Created" in t["title"] for t in timeline)


@pytest.mark.asyncio
async def test_customer_360_with_policy_lineage_and_payments(
    client: AsyncClient, auth_headers: dict, test_session: AsyncSession
):
    """Test Customer 360 profile with issued policy, renewal lineage, and payment ledger."""
    # 1. Create customer
    cust_id = uuid.uuid4()
    cust = Customer(
        id=cust_id,
        first_name="Priya",
        last_name="Nair",
        phone="+91 98765 11223",
        email="priya.nair@example.com",
        customer_type="INDIVIDUAL",
    )
    test_session.add(cust)

    # 2. Create Insurance Company & Plan
    comp_id = uuid.uuid4()
    comp = InsuranceCompany(
        id=comp_id,
        name="HDFC ERGO General Insurance",
        code="HDFC_ERGO",
        is_active=True,
    )
    test_session.add(comp)

    plan_id = uuid.uuid4()
    plan = InsurancePlan(
        id=plan_id,
        company_id=comp_id,
        name="Optima Secure Health",
        code="OSH_01",
        line_of_business="HEALTH",
        status="ACTIVE",
    )
    test_session.add(plan)

    # 3. Create Original Policy (2025)
    pol1_id = uuid.uuid4()
    pol1 = InsurancePolicy(
        id=pol1_id,
        customer_id=cust_id,
        company_id=comp_id,
        plan_id=plan_id,
        policy_number="POL-2025-0001",
        policy_type="HEALTH",
        policy_start_date=date(2025, 1, 1),
        expiry_date=date(2025, 12, 31),
        issue_date=date(2025, 1, 1),
        sum_assured=Decimal("500000.00"),
        net_premium=Decimal("12000.00"),
        final_premium=Decimal("14160.00"),
        premium_mode="Yearly",
        business_type="NEW",
        status="EXPIRED",
    )
    test_session.add(pol1)

    # 4. Create Renewed Policy (2026) linked to pol1
    pol2_id = uuid.uuid4()
    pol2 = InsurancePolicy(
        id=pol2_id,
        customer_id=cust_id,
        company_id=comp_id,
        plan_id=plan_id,
        previous_policy_id=pol1_id,
        policy_number="POL-2026-0002",
        policy_type="HEALTH",
        policy_start_date=date(2026, 1, 1),
        expiry_date=date(2026, 12, 31),
        issue_date=date(2026, 1, 1),
        sum_assured=Decimal("750000.00"),
        net_premium=Decimal("15000.00"),
        final_premium=Decimal("17700.00"),
        premium_mode="Yearly",
        business_type="RENEWAL",
        status="ACTIVE",
    )
    test_session.add(pol2)

    # 5. Add Nominee to pol2
    nom = InsurancePolicyNominee(
        id=uuid.uuid4(),
        policy_id=pol2_id,
        full_name="Anand Nair",
        relationship="Spouse",
        share_percentage=Decimal("100.00"),
    )
    test_session.add(nom)

    # 6. Add Payment to pol2
    pmt = InsurancePolicyPayment(
        id=uuid.uuid4(),
        policy_id=pol2_id,
        amount=Decimal("17700.00"),
        payment_date=date(2026, 1, 1),
        payment_mode="NET_BANKING",
        transaction_reference="HDFC_TXN_998877",
        status="COMPLETED",
    )
    test_session.add(pmt)

    await test_session.commit()

    # 7. Query Customer 360 profile
    resp = await client.get(
        f"/api/v1/insurance/customers/{cust_id}/360",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # 8. Assert KPIs
    kpis = data["kpis"]
    assert kpis["total_policies"] == 2
    assert kpis["active_policies"] == 1
    assert kpis["expired_policies"] == 1
    assert float(kpis["total_sum_insured"]) == 750000.0

    # 9. Assert Policies list & Renewal Lineage
    policies = data["policies"]
    assert len(policies) == 2

    # Find renewed policy
    pol2_data = next(p for p in policies if p["policy_number"] == "POL-2026-0002")
    assert pol2_data["business_type"] == "RENEWAL"
    assert pol2_data["previous_policy_number"] == "POL-2025-0001"
    assert pol2_data["nominee_count"] == 1
    assert pol2_data["nominees"][0]["nominee_name"] == "Anand Nair"
    assert pol2_data["company_name"] == "HDFC ERGO General Insurance"

    # 10. Assert Year Groups
    year_groups = data["year_groups"]
    assert len(year_groups) == 2
    y_2026 = next(y for y in year_groups if y["year"] == 2026)
    assert len(y_2026["policies"]) == 1
    y_2025 = next(y for y in year_groups if y["year"] == 2025)
    assert len(y_2025["policies"]) == 1

    # 11. Assert Premium & Payment Summary
    premiums = data["premiums"]
    assert float(premiums["total_premium"]) == 31860.0
    assert float(premiums["paid_premium"]) == 17700.0
    assert len(data["payments"]) == 1
    assert data["payments"][0]["transaction_reference"] == "HDFC_TXN_998877"

    # 12. Assert Health Insurance category count
    health_cat = next(c for c in data["categories"] if c["category"] == "Health Insurance")
    assert health_cat["policy_count"] == 2
    assert health_cat["active_policy_count"] == 1


@pytest.mark.asyncio
async def test_customer_360_nonexistent_customer(
    client: AsyncClient, auth_headers: dict
):
    """Test 404 response for nonexistent customer ID."""
    random_id = uuid.uuid4()
    resp = await client.get(
        f"/api/v1/insurance/customers/{random_id}/360",
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert "Customer record not found" in resp.json()["detail"]
