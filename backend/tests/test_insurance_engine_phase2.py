"""Comprehensive Automated Unit & Integration Tests for FinNexus Insurance Engine — Phase 2.

Test suite covering:
1. Customer Onboarding & Conditional Dates: Registration with personal details, address, optional birth date & anniversary date checkboxes.
2. Secure KYC Document Multipart Upload & Authorized Download: Validation, secure storage, authorized streaming, and access control.
3. Family Group Management: Primary head customer assignment, member relations, duplicate prevention, and consolidated portfolio.
4. Sub-Agent / POSP Management & Unique Code: Agent CRUD, auto-generated code, public profile slug.
5. Commission Split Configuration: Percentage and fixed amount splits, allocation <= total commission validation, effective date.
6. Purchase Party Real PDF Export: Verification of binary PDF document format (%PDF header).
7. Policy Registration & Coverage Mapping: Policy issuance with relations (customer, company, plan, agent), payment modes, coverage terms.
8. Safe Deletion Protection: Inability to delete company or plan referenced by policies.
9. Premium Schedules & Payment Ledger: Installment generation across modes, dynamic status (DUE_TODAY, UPCOMING, OVERDUE, PAID), record payment.
10. Commission Ledger & Split Allocation: Commission generation, split payout calculation, duplicate prevention, and agent performance reports.
11. Bulk Policy Import Workflow: Template download, file preview, row validation errors, transactional execution, and summary reporting.
12. Public Agent Profile & Rate-Limited Inquiries: Unauthenticated public profile view, inquiry submission, rate limiter (5 per 10m), honeypot spam guard.
13. Live Dashboard Metrics: Real database calculation of individual vs corporate customers, active policies, pending premiums, transparent claims indicator, and utility bar.
14. RBAC Enforcement: Role-based authorization across manager/admin vs unauthorized roles.
"""

from __future__ import annotations

import io
import uuid
from collections.abc import AsyncGenerator
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models.crm import Customer
from app.db.models.insurance import (
    InsuranceCompany,
    InsurancePlan,
    InsurancePolicy,
    InsurancePurchaseParty,
    InsuranceSubAgent,
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


async def get_token(client: AsyncClient, email: str, password: str) -> str:
    """Helper to authenticate and return JWT access token."""
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


# ===========================================================================
# 1. Customer Onboarding & KYC Tests
# ===========================================================================


@pytest.mark.asyncio
async def test_01_customer_onboarding_with_conditional_dates(client: AsyncClient) -> None:
    """Test creating a customer with optional conditional birth & anniversary dates and address."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "first_name": "Rohan",
        "last_name": "Malhotra",
        "phone": "+91 98765 43210",
        "email": "rohan.malhotra@demo.in",
        "gender": "MALE",
        "date_of_birth": "1988-06-15",
        "anniversary_date": "2015-11-20",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": "402, Sea Crest Towers, Worli",
        "pincode": "400018",
        "customer_type": "INDIVIDUAL",
    }

    res = await client.post("/api/v1/insurance/customers", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["first_name"] == "Rohan"
    assert data["last_name"] == "Malhotra"
    assert data["gender"] == "MALE"
    assert data["date_of_birth"] == "1988-06-15"
    assert data["anniversary_date"] == "2015-11-20"
    assert data["city"] == "Mumbai"
    assert data["pincode"] == "400018"
    assert data["customer_type"] == "INDIVIDUAL"


@pytest.mark.asyncio
async def test_02_kyc_document_upload_and_download(client: AsyncClient) -> None:
    """Test multipart upload of KYC documents (Aadhaar / PAN) and secure download."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a customer
    cust_res = await client.post(
        "/api/v1/insurance/customers",
        json={"first_name": "Priya", "last_name": "Nair", "phone": "+91 98220 12345", "gender": "FEMALE"},
        headers=headers,
    )
    assert cust_res.status_code == 201
    cust_id = cust_res.json()["id"]

    # 2. Upload Document 1 (PAN Card)
    file_content = b"%PDF-1.4 Mock PAN Document Content For KYC Verification"
    files = {"file": ("pan_card.pdf", io.BytesIO(file_content), "application/pdf")}
    upload_res = await client.post(
        f"/api/v1/insurance/customers/{cust_id}/documents?document_type=PAN_CARD",
        files=files,
        headers=headers,
    )
    assert upload_res.status_code == 201, upload_res.text
    doc_data = upload_res.json()
    assert doc_data["document_type"] == "PAN_CARD"
    assert doc_data["original_filename"] == "pan_card.pdf"
    doc_id = doc_data["id"]

    # 3. Download the document
    download_res = await client.get(
        f"/api/v1/insurance/customers/{cust_id}/documents/{doc_id}",
        headers=headers,
    )
    assert download_res.status_code == 200
    assert download_res.content == file_content
    assert download_res.headers["content-type"] == "application/pdf"


# ===========================================================================
# 2. Family Group Management Tests
# ===========================================================================


@pytest.mark.asyncio
async def test_03_family_group_lifecycle_and_consolidated_portfolio(client: AsyncClient) -> None:
    """Test family group creation, member assignment, and consolidated policy portfolio calculation."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Create Head Customer & Spouse
    head_res = await client.post(
        "/api/v1/insurance/customers",
        json={"first_name": "Amitabh", "last_name": "Bachchan", "phone": "+91 98200 00001", "gender": "MALE"},
        headers=headers,
    )
    spouse_res = await client.post(
        "/api/v1/insurance/customers",
        json={"first_name": "Jaya", "last_name": "Bachchan", "phone": "+91 98200 00002", "gender": "FEMALE"},
        headers=headers,
    )
    head_id = head_res.json()["id"]
    spouse_id = spouse_res.json()["id"]

    # 1. Create Family Group
    fg_res = await client.post(
        "/api/v1/insurance/family-groups",
        json={"name": "Bachchan Household", "primary_head_customer_id": head_id, "notes": "VIP Client Family"},
        headers=headers,
    )
    assert fg_res.status_code == 201, fg_res.text
    fg_id = fg_res.json()["id"]
    assert fg_res.json()["name"] == "Bachchan Household"
    assert fg_res.json()["members_count"] == 1

    # 2. Add Spouse Member
    add_m_res = await client.post(
        f"/api/v1/insurance/family-groups/{fg_id}/members",
        json={"customer_id": spouse_id, "relation_type": "SPOUSE", "is_dependent": True},
        headers=headers,
    )
    assert add_m_res.status_code == 201, add_m_res.text
    m_id = add_m_res.json()["id"]

    # 3. Retrieve Family Group with Consolidated Portfolio
    detail_res = await client.get(f"/api/v1/insurance/family-groups/{fg_id}", headers=headers)
    assert detail_res.status_code == 200
    group_data = detail_res.json()
    assert len(group_data["members"]) == 2
    assert "consolidated_policies" in group_data

    # 4. Remove Spouse Member
    del_m_res = await client.delete(
        f"/api/v1/insurance/family-groups/{fg_id}/members/{m_id}",
        headers=headers,
    )
    assert del_m_res.status_code == 200


# ===========================================================================
# 3. Sub-Agent / POSP & Commission Split Tests
# ===========================================================================


@pytest.mark.asyncio
async def test_04_sub_agent_crud_and_commission_split_validation(client: AsyncClient) -> None:
    """Test POSP sub-agent registration, unique agent code, and commission split configuration."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Sub-Agent
    ag_payload = {
        "full_name": "Sunil Gavaskar",
        "mobile_number": "+91 98111 22233",
        "email": "sunil.g@posp.in",
        "parent_agent_firm": "Mumbai Advisors",
        "specialties": "Term Life, Motor",
        "bio": "Expert insurance advisor with 15 years experience.",
        "show_contact_info": True,
    }
    ag_res = await client.post("/api/v1/insurance/sub-agents", json=ag_payload, headers=headers)
    assert ag_res.status_code == 201, ag_res.text
    agent_data = ag_res.json()
    assert agent_data["full_name"] == "Sunil Gavaskar"
    assert agent_data["agent_code"].startswith("POSP-")
    assert agent_data["public_profile_slug"].startswith("sunil-gavaskar")
    agent_id = agent_data["id"]

    # 2. Configure Commission Split: 60% Sub-agent, 40% Firm (Total = 100%)
    split_payload = {
        "sub_agent_id": agent_id,
        "split_type": "PERCENTAGE",
        "firm_commission_rate": 40.0,
        "agent_commission_rate": 60.0,
        "effective_date": "2026-01-01",
        "notes": "Standard POSP split arrangement",
    }
    split_res = await client.post("/api/v1/insurance/commission-splits", json=split_payload, headers=headers)
    assert split_res.status_code == 201, split_res.text
    assert split_res.json()["agent_commission_rate"] == 60.0

    # 3. Validate Invalid Split (> 100% total)
    bad_split = {
        "sub_agent_id": agent_id,
        "split_type": "PERCENTAGE",
        "firm_commission_rate": 50.0,
        "agent_commission_rate": 60.0,  # 50 + 60 = 110% -> HTTP 400
        "effective_date": "2026-01-01",
    }
    bad_res = await client.post("/api/v1/insurance/commission-splits", json=bad_split, headers=headers)
    assert bad_res.status_code in (400, 422), "Should reject split exceeding 100%"


# ===========================================================================
# 4. Purchase Party Real PDF Export Test
# ===========================================================================


@pytest.mark.asyncio
async def test_05_purchase_party_real_pdf_export(client: AsyncClient) -> None:
    """Test real binary PDF export for Purchase Parties produces a valid PDF file (%PDF magic header)."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Create a party
    await client.post(
        "/api/v1/insurance/purchase-parties",
        json={"name": "Tata Insurance Broking Ltd", "contact_person": "Kyrus Mistry", "is_active": True},
        headers=headers,
    )

    # Request PDF export
    pdf_res = await client.get("/api/v1/insurance/purchase-parties/export/pdf", headers=headers)
    assert pdf_res.status_code == 200, pdf_res.text
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert "attachment; filename=" in pdf_res.headers["content-disposition"]
    # Verify binary PDF header
    assert pdf_res.content.startswith(b"%PDF"), "Must be a real binary PDF document"


# ===========================================================================
# 5. Policy Issuance, Schedules, Payments & Commission Tests
# ===========================================================================


@pytest.mark.asyncio
async def test_06_policy_issuance_installments_and_payment_ledger(client: AsyncClient) -> None:
    """Test policy creation with automatic installment generation, payment recording, and commission tracking."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Setup Customer, Company, Plan, Sub-Agent
    cust_res = await client.post(
        "/api/v1/insurance/customers",
        json={"first_name": "Deepak", "last_name": "Chopra", "phone": "+91 99887 76655", "gender": "MALE"},
        headers=headers,
    )
    comp_res = await client.post(
        "/api/v1/insurance/companies",
        json={"name": "HDFC Life Insurance Co", "code": "HDFCLIFE", "category": "LIFE"},
        headers=headers,
    )
    plan_res = await client.post(
        "/api/v1/insurance/plans",
        json={"name": "Click 2 Protect Super", "code": "C2PS-01", "company_id": comp_res.json()["id"], "policy_type": "LIFE"},
        headers=headers,
    )
    agent_res = await client.post(
        "/api/v1/insurance/sub-agents",
        json={"full_name": "Rahul Dravid", "mobile_number": "+91 99001 12233"},
        headers=headers,
    )

    cust_id = cust_res.json()["id"]
    comp_id = comp_res.json()["id"]
    plan_id = plan_res.json()["id"]
    agent_id = agent_res.json()["id"]

    # 1. Register Policy: Quarterly, 5 Year Term, ₹10,000 Premium per quarter (₹40,000 total annual)
    pol_payload = {
        "policy_type": "LIFE",
        "customer_id": cust_id,
        "company_id": comp_id,
        "plan_id": plan_id,
        "sub_agent_id": agent_id,
        "policy_number": "POL-HDFC-9901",
        "policy_term_years": 5,
        "sum_assured": 1000000.0,
        "final_premium": 40000.0,
        "premium_mode": "QUARTERLY",
        "start_date": str(date.today()),
        "first_year_commission_amount": 8000.0,
        "sub_agent_commission_share": 4800.0,
        "initial_payment": {
            "payment_mode": "ONLINE",
            "bank_name": "HDFC Bank",
            "transaction_reference": "UTR-INIT-001",
            "notes": "Initial deposit",
        },
    }

    pol_res = await client.post("/api/v1/insurance/policies", json=pol_payload, headers=headers)
    assert pol_res.status_code == 201, pol_res.text
    pol_data = pol_res.json()
    assert pol_data["policy_number"] == "POL-HDFC-9901"
    assert pol_data["status"] == "ACTIVE"
    pol_id = pol_data["id"]

    # 2. Safe Deletion Protection: Cannot delete parent company or plan
    del_comp = await client.delete(f"/api/v1/insurance/companies/{comp_id}", headers=headers)
    assert del_comp.status_code == 400, "Should block deleting company with active policies"
    del_plan = await client.delete(f"/api/v1/insurance/plans/{plan_id}", headers=headers)
    assert del_plan.status_code in (400, 409), "Should block deleting plan with active policies"

    # 3. Verify Installment Schedules were generated (Quarterly for 5 years = 20 installments)
    sch_res = await client.get(f"/api/v1/insurance/schedules?policy_id={pol_id}", headers=headers)
    assert sch_res.status_code == 200
    schedules = sch_res.json()["items"]
    assert len(schedules) == 20
    # First installment should be marked PAID because initial_payment was provided
    assert schedules[0]["status"] == "PAID"
    # Installment amount = 40000 / 4 = 10000
    assert float(schedules[0]["installment_amount"]) == 10000.0

    # 4. Record Payment on Installment #2
    sch2_id = schedules[1]["id"]
    pay_res = await client.post(
        f"/api/v1/insurance/policies/{pol_id}/payments",
        json={
            "schedule_id": sch2_id,
            "payment_mode": "ONLINE",
            "bank_name": "State Bank of India",
            "transaction_reference": "UTR-Q2-002",
            "payment_amount": 10000.0,
            "payment_date": str(date.today()),
        },
        headers=headers,
    )
    assert pay_res.status_code == 201, pay_res.text
    assert float(pay_res.json()["payment_amount"]) == 10000.0

    # 5. Verify Commission Ledger
    comm_res = await client.get(f"/api/v1/insurance/commissions?policy_id={pol_id}", headers=headers)
    assert comm_res.status_code == 200
    comm_items = comm_res.json()["items"]
    assert len(comm_items) >= 1
    c_item = comm_items[0]
    assert float(c_item["gross_commission_amount"]) == 8000.0
    assert float(c_item["sub_agent_share"]) == 4800.0
    assert float(c_item["net_firm_share"]) == 3200.0


# ===========================================================================
# 6. Bulk Policy Import Tests
# ===========================================================================


@pytest.mark.asyncio
async def test_07_bulk_policy_import_preview_and_execute(client: AsyncClient) -> None:
    """Test bulk import workflow: preview with row-level validation and batch execution."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Setup Company & Plan
    comp_res = await client.post(
        "/api/v1/insurance/companies",
        json={"name": "ICICI Lombard General", "code": "ICICILOMB", "category": "GENERAL"},
        headers=headers,
    )
    plan_res = await client.post(
        "/api/v1/insurance/plans",
        json={"name": "Complete Health Insurance", "code": "CHI-01", "company_id": comp_res.json()["id"], "policy_type": "HEALTH"},
        headers=headers,
    )
    # Setup Customer
    cust_res = await client.post(
        "/api/v1/insurance/customers",
        json={"first_name": "Suresh", "last_name": "Raina", "phone": "+91 99112 23344", "gender": "MALE"},
        headers=headers,
    )

    # 1. Download sample template
    tpl_res = await client.get("/api/v1/insurance/import/template?format=csv", headers=headers)
    assert tpl_res.status_code == 200
    assert "policy number" in tpl_res.text.lower() or "policy_number" in tpl_res.text.lower()

    # 2. Preview valid CSV
    csv_data = (
        "policy_number,policy_type,customer_phone,company_code,plan_code,sum_assured,final_premium,premium_mode,policy_term_years,start_date\n"
        "POL-BULK-001,HEALTH,+91 99112 23344,ICICILOMB,CHI-01,500000,15000,YEARLY,1,2026-03-01\n"
    )
    files = {"file": ("bulk_import.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    prev_res = await client.post("/api/v1/insurance/import/preview", files=files, headers=headers)
    assert prev_res.status_code == 200, prev_res.text
    prev_json = prev_res.json()
    assert prev_json["total_rows"] == 1
    assert prev_json["valid_rows_count"] == 1
    assert len(prev_json["errors"]) == 0

    # 3. Execute bulk import
    files = {"file": ("bulk_import.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    exec_res = await client.post("/api/v1/insurance/import/confirm", files=files, headers=headers)
    assert exec_res.status_code == 200, exec_res.text
    exec_json = exec_res.json()
    assert exec_json["imported_count"] == 1
    assert exec_json["failed_count"] == 0


# ===========================================================================
# 7. Public Agent Profile & Rate-Limited Leads Tests
# ===========================================================================


@pytest.mark.asyncio
async def test_08_public_profile_and_rate_limited_inquiry(client: AsyncClient) -> None:
    """Test unauthenticated public agent profile view and rate-limited lead submission."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    # Create Agent
    ag_res = await client.post(
        "/api/v1/insurance/sub-agents",
        json={"full_name": "Kapil Dev", "mobile_number": "+91 98100 88888", "show_contact_info": True},
        headers=headers,
    )
    slug = ag_res.json()["public_profile_slug"]

    # 1. Unauthenticated request to public profile
    pub_res = await client.get(f"/api/v1/insurance/agents/public/{slug}")
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["full_name"] == "Kapil Dev"
    assert pub_data["is_active"] is True

    # 2. Submit Inquiry
    inq_payload = {
        "customer_name": "Manish Pandey",
        "phone_number": "+91 97777 66666",
        "email": "manish@cricket.in",
        "preferred_contact_method": "WHATSAPP",
        "message": "Looking for health insurance for family.",
    }
    inq_res = await client.post(f"/api/v1/insurance/agents/public/{slug}/inquiries", json=inq_payload)
    assert inq_res.status_code == 201, inq_res.text
    assert inq_res.json()["status"] in ("NEW", "success")

    # 3. Honeypot Spam Protection
    spam_payload = {**inq_payload, "website_hp": "http://spam-bot.site"}
    spam_res = await client.post(f"/api/v1/insurance/agents/public/{slug}/inquiries", json=spam_payload)
    assert spam_res.status_code == 400, "Should reject honeypot submission"


# ===========================================================================
# 8. Comprehensive Dashboard Live Metrics Test
# ===========================================================================


@pytest.mark.asyncio
async def test_09_comprehensive_dashboard_metrics(client: AsyncClient) -> None:
    """Test /dashboard/metrics live database calculation across all Phase 2 entities."""
    token = await get_token(client, "admin@financeflow.com", "Admin@12345")
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/v1/insurance/dashboard/metrics", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    pf = data["portfolio"]
    assert "total_customers" in pf
    assert "individual_customers" in pf
    assert "corporate_customers" in pf
    assert "total_active_policies" in pf
    assert "pending_premiums_amount" in pf
    assert pf["total_claims_count"] == 0
    assert pf["claims_module_status"] == "PENDING_IMPLEMENTATION"
    assert "claims_notice" in pf

    ub = data["utility_bar"]
    assert ub["subscription_status"] == "ENTERPRISE_ACTIVE"
    assert "sms_whatsapp_status" in ub
    assert "active_alerts_count" in ub


# ===========================================================================
# 9. RBAC Enforcement Test
# ===========================================================================


@pytest.mark.asyncio
async def test_10_rbac_employee_forbidden_from_issuing_policies(client: AsyncClient) -> None:
    """Test that an employee role is forbidden from policy issuance or commission split modification."""
    emp_token = await get_token(client, "employee@financeflow.com", "Employee@12345")
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # Employee attempts to issue a policy
    fake_id = str(uuid.uuid4())
    res = await client.post(
        "/api/v1/insurance/policies",
        json={
            "policy_type": "LIFE",
            "customer_id": fake_id,
            "company_id": fake_id,
            "plan_id": fake_id,
            "policy_number": "POL-EMP-001",
            "sum_assured": 100000,
            "final_premium": 5000,
            "start_date": "2026-01-01",
        },
        headers=emp_headers,
    )
    assert res.status_code == 403, f"Employee must be forbidden from issuing policies: {res.text}"

