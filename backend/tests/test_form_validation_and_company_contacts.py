"""Acceptance Tests for Form Validation & Separated Company Contact Fields.

Tests cover:
1. Unit validation utilities in `app.schemas.validators`.
2. Pydantic schema validation for:
   - Indian mobile numbers (10 digits, starts with 6-9)
   - Email format
   - PIN code (6 digits)
   - PAN, Aadhaar, GSTIN format
   - Vehicle registration format
   - Positive decimals & percentages
   - Date relationships (renewal >= tieup, expiry >= start, DOB not in future)
3. FastAPI endpoint validation (HTTP 422 responses on invalid inputs).
4. Full CRUD on Insurance Company with all 11 separated contact fields:
   - Agent Direct Mobile & Email
   - Renewal Team Contact Person, Mobile, Email
   - Claims Team Contact Person, Mobile, Email
   - KAM Name, Mobile, Email
   - Website
5. Preservation of existing database records (legacy HDFC ERGO record intact).
"""

import os
import sys
import uuid
import datetime
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

# Ensure backend root is on sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app
from app.db.session import AsyncSessionLocal, engine
from app.db.models.insurance import InsuranceCompany
from app.schemas.validators import (
    validate_indian_mobile,
    validate_email,
    validate_pin_code,
    validate_pan,
    validate_aadhaar,
    validate_gstin,
    validate_vehicle_registration,
    validate_positive_amount,
    validate_percentage,
    validate_dob_not_future,
    validate_date_sequence,
)
from app.schemas.insurance import (
    CompanyCreate,
    CompanyUpdate,
    InsuranceCustomerCreate,
    PlanCreate,
    PolicyCreate,
    SubAgentCreate,
)


@pytest.fixture(autouse=True)
async def cleanup_pool():
    yield
    await engine.dispose()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest.fixture
async def auth_headers(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@financeflow.com", "password": "Admin@12345"},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# =========================================================================
# 1. UNIT VALIDATOR TESTS
# =========================================================================

def test_mobile_number_validation():
    # Valid Indian mobiles (10 digits, starts with 6, 7, 8, 9)
    assert validate_indian_mobile("9876543210") == "9876543210"
    assert validate_indian_mobile("8123456789") == "8123456789"
    assert validate_indian_mobile("7000000000") == "7000000000"
    assert validate_indian_mobile("6999999999") == "6999999999"
    assert validate_indian_mobile(None, required=False) is None

    # Invalid mobiles
    invalid_cases = [
        "98765ABCDE",        # contains letters
        "987654321",          # 9 digits
        "98765432100",        # 11 digits
        "1234567890",         # starts with 1
        "5876543210",         # starts with 5
        "98765@3210",         # special chars
        "+91 98765 43210",    # has prefix and spaces
        "",                   # empty
    ]
    for case in invalid_cases:
        with pytest.raises(ValueError):
            validate_indian_mobile(case, required=True)


def test_email_validation():
    # Valid emails
    assert validate_email("user@example.com") == "user@example.com"
    assert validate_email("  SUPPORT@DOMAIN.CO.IN  ") == "support@domain.co.in"
    assert validate_email(None, required=False) is None

    # Invalid emails
    invalid_emails = [
        "plainaddress",
        "@missingusername.com",
        "username@.com",
        "user@domain",       # no TLD
        "user name@domain.com",
    ]
    for email in invalid_emails:
        with pytest.raises(ValueError):
            validate_email(email, required=True)


def test_pin_code_validation():
    assert validate_pin_code("400001") == "400001"
    assert validate_pin_code(" 110001 ") == "110001"
    assert validate_pin_code(None, required=False) is None

    invalid_pins = ["012345", "40001", "4000001", "40000A", "ABCDEF"]
    for pin in invalid_pins:
        with pytest.raises(ValueError):
            validate_pin_code(pin, required=True)


def test_pan_and_aadhaar_validation():
    # PAN
    assert validate_pan("ABCDE1234F") == "ABCDE1234F"
    assert validate_pan("abcde1234f") == "ABCDE1234F"
    assert validate_pan(None, required=False) is None
    with pytest.raises(ValueError):
        validate_pan("ABC1234F")
    with pytest.raises(ValueError):
        validate_pan("ABCDE12345")

    # Aadhaar
    assert validate_aadhaar("123456789012") == "123456789012"
    assert validate_aadhaar(None, required=False) is None
    with pytest.raises(ValueError):
        validate_aadhaar("1234 5678 9012")  # contains spaces
    with pytest.raises(ValueError):
        validate_aadhaar("12345678901")  # 11 digits
    with pytest.raises(ValueError):
        validate_aadhaar("1234567890123")  # 13 digits


def test_gstin_and_vehicle_validation():
    # GSTIN
    assert validate_gstin("27ABCDE1234F1Z5") == "27ABCDE1234F1Z5"
    assert validate_gstin(None, required=False) is None
    with pytest.raises(ValueError):
        validate_gstin("27ABCDE")

    # Vehicle Registration
    assert validate_vehicle_registration("MH12AB1234") == "MH12AB1234"
    assert validate_vehicle_registration("DL-01-A-1234") == "DL01A1234"
    assert validate_vehicle_registration(None, required=False) is None
    with pytest.raises(ValueError):
        validate_vehicle_registration("INVALID_VEHICLE")


def test_positive_amount_and_percentage():
    # Positive amount
    assert validate_positive_amount(100.50) == 100.50
    assert validate_positive_amount(0, allow_zero=True) == 0.0
    with pytest.raises(ValueError):
        validate_positive_amount(0, allow_zero=False)
    with pytest.raises(ValueError):
        validate_positive_amount(-5.0)

    # Percentage
    assert validate_percentage(50.0) == 50.0
    assert validate_percentage(0.0) == 0.0
    assert validate_percentage(100.0) == 100.0
    with pytest.raises(ValueError):
        validate_percentage(100.01)
    with pytest.raises(ValueError):
        validate_percentage(-0.5)


def test_date_relationship_validation():
    # Date sequence
    assert validate_date_sequence("2026-01-01", "2026-12-31") is True
    assert validate_date_sequence("2026-01-01", "2026-01-01") is True
    with pytest.raises(ValueError):
        validate_date_sequence("2026-12-31", "2026-01-01")

    # DOB not future
    past_date = (datetime.date.today() - datetime.timedelta(days=365 * 25)).isoformat()
    assert validate_dob_not_future(past_date) == past_date
    with pytest.raises(ValueError):
        validate_dob_not_future("2099-01-01")


# =========================================================================
# 2. PYDANTIC SCHEMA VALIDATION TESTS
# =========================================================================

def test_company_schema_strict_validation():
    # Valid CompanyCreate with separated contact fields
    company_data = {
        "name": f"Test Insurer {uuid.uuid4().hex[:6]}",
        "code": f"TEST_{uuid.uuid4().hex[:4].upper()}",
        "category": "Health Insurance",
        "supported_categories": ["Health Insurance"],
        "company_type": "Standalone Health Insurer (SAHI)",
        "agent_direct_mobile": "9876543210",
        "agent_email": "agent@testinsurer.com",
        "renewal_contact_person": "Priya Sharma",
        "renewal_contact_mobile": "9876543211",
        "renewal_contact_email": "renewals@testinsurer.com",
        "claims_contact_person": "Vikram Sethi",
        "claims_contact_mobile": "9876543212",
        "claims_contact_email": "claims@testinsurer.com",
        "kam_name": "Rohan Gupta",
        "kam_mobile": "9876543213",
        "kam_email": "kam@testinsurer.com",
        "website": "https://testinsurer.com",
        "tieup_date": "2026-01-01",
        "tieup_renewal_date": "2027-01-01",
    }
    comp = CompanyCreate(**company_data)
    assert comp.agent_direct_mobile == "9876543210"
    assert comp.renewal_contact_person == "Priya Sharma"
    assert comp.claims_contact_mobile == "9876543212"
    assert comp.kam_name == "Rohan Gupta"

    # Reject invalid mobile in separated fields
    with pytest.raises(Exception):
        CompanyCreate(**{**company_data, "agent_direct_mobile": "12345"})

    with pytest.raises(Exception):
        CompanyCreate(**{**company_data, "renewal_contact_mobile": "invalid-phone"})

    with pytest.raises(Exception):
        CompanyCreate(**{**company_data, "claims_contact_mobile": "987654321000"})

    # Reject invalid email in separated fields
    with pytest.raises(Exception):
        CompanyCreate(**{**company_data, "renewal_contact_email": "not-an-email"})

    # Reject renewal date preceding tie-up date
    with pytest.raises(Exception):
        CompanyCreate(**{**company_data, "tieup_date": "2026-12-01", "tieup_renewal_date": "2026-01-01"})


def test_customer_schema_strict_validation():
    cust_data = {
        "first_name": "Aditya",
        "last_name": "Thakre",
        "phone": "9876543210",
        "email": "aditya@example.com",
        "pincode": "400001",
        "pan_number": "ABCDE1234F",
        "aadhaar_number": "123456789012",
        "date_of_birth": "1995-05-15",
    }
    cust = InsuranceCustomerCreate(**cust_data)
    assert cust.phone == "9876543210"

    # Reject invalid phone
    with pytest.raises(Exception):
        InsuranceCustomerCreate(**{**cust_data, "phone": "12345"})

    # Reject invalid PIN
    with pytest.raises(Exception):
        InsuranceCustomerCreate(**{**cust_data, "pincode": "012345"})

    # Reject invalid PAN
    with pytest.raises(Exception):
        InsuranceCustomerCreate(**{**cust_data, "pan_number": "INVALID"})

    # Reject future DOB
    with pytest.raises(Exception):
        InsuranceCustomerCreate(**{**cust_data, "date_of_birth": "2099-01-01"})


def test_plan_schema_strict_validation():
    plan_data = {
        "name": "Super Comprehensive Plan",
        "code": f"PLAN_{uuid.uuid4().hex[:4].upper()}",
        "company_id": uuid.uuid4(),
        "line_of_business": "Health Insurance",
        "sum_insured_min": 500000.0,
        "sum_insured_max": 2500000.0,
        "policy_term_min_years": 1,
        "policy_term_max_years": 3,
    }
    plan = PlanCreate(**plan_data)
    assert plan.sum_insured_min == 500000.0

    # Reject max < min sum insured
    with pytest.raises(Exception):
        PlanCreate(**{**plan_data, "sum_insured_min": 5000000.0, "sum_insured_max": 100000.0})

    # Reject max < min policy term
    with pytest.raises(Exception):
        PlanCreate(**{**plan_data, "policy_term_min_years": 5, "policy_term_max_years": 2})


# =========================================================================
# 3. ENDPOINT INTEGRATION TESTS (FASTAPI HTTP 422 ON INVALID DATA)
# =========================================================================

@pytest.mark.asyncio
async def test_api_company_separated_contact_fields_lifecycle(client: AsyncClient, auth_headers: dict):
    """Verify Company creation, retrieval, and update with separated contact fields."""
    suffix = uuid.uuid4().hex[:6]
    payload = {
        "name": f"Apex General Insurance {suffix}",
        "code": f"APEX_{suffix.upper()}",
        "category": "General Insurance",
        "supported_categories": ["General Insurance", "Health Insurance"],
        "company_type": "General Insurer (Multi-line)",
        "agent_name": "Sunil Varma",
        "agent_direct_mobile": "9876543210",
        "agent_code": f"AG-{suffix.upper()}",
        "agent_email": "sunil.varma@apexinsurance.in",
        "renewal_contact_person": "Rekha Nair",
        "renewal_contact_mobile": "9876543211",
        "renewal_contact_email": "renewals@apexinsurance.in",
        "claims_contact_person": "Amitabh Bose",
        "claims_contact_mobile": "9876543212",
        "claims_contact_email": "claims@apexinsurance.in",
        "kam_name": "Deepak Mehta",
        "kam_mobile": "9876543213",
        "kam_email": "deepak.mehta@apexinsurance.in",
        "official_email": "contact@apexinsurance.in",
        "company_helpline": "1800-258-9999",
        "website": "https://apexinsurance.in",
        "tieup_date": "2026-01-15",
        "tieup_renewal_date": "2027-01-15",
    }

    # 1. Create company
    create_resp = await client.post("/api/v1/insurance/companies", json=payload, headers=auth_headers)
    assert create_resp.status_code in (200, 201), f"Create failed: {create_resp.text}"
    comp_data = create_resp.json()
    company_id = comp_data["id"]

    try:
        # Verify all separated fields are returned
        assert comp_data["agent_direct_mobile"] == "9876543210"
        assert comp_data["agent_email"] == "sunil.varma@apexinsurance.in"
        assert comp_data["renewal_contact_person"] == "Rekha Nair"
        assert comp_data["renewal_contact_mobile"] == "9876543211"
        assert comp_data["renewal_contact_email"] == "renewals@apexinsurance.in"
        assert comp_data["claims_contact_person"] == "Amitabh Bose"
        assert comp_data["claims_contact_mobile"] == "9876543212"
        assert comp_data["claims_contact_email"] == "claims@apexinsurance.in"
        assert comp_data["kam_name"] == "Deepak Mehta"
        assert comp_data["kam_mobile"] == "9876543213"
        assert comp_data["kam_email"] == "deepak.mehta@apexinsurance.in"
        assert comp_data["website"] == "https://apexinsurance.in"

        # 2. Retrieve via GET
        get_resp = await client.get(f"/api/v1/insurance/companies/{company_id}", headers=auth_headers)
        assert get_resp.status_code == 200
        retrieved = get_resp.json()
        assert retrieved["renewal_contact_person"] == "Rekha Nair"
        assert retrieved["claims_contact_person"] == "Amitabh Bose"
        assert retrieved["kam_name"] == "Deepak Mehta"

        # 3. Update separated fields
        update_payload = {
            "renewal_contact_person": "Pooja Malhotra",
            "renewal_contact_mobile": "9812345678",
            "renewal_contact_email": "pooja.m@apexinsurance.in",
            "kam_name": "Siddharth Sen",
            "kam_mobile": "9834567890",
        }
        put_resp = await client.put(
            f"/api/v1/insurance/companies/{company_id}",
            json=update_payload,
            headers=auth_headers,
        )
        assert put_resp.status_code == 200, f"Update failed: {put_resp.text}"
        updated = put_resp.json()
        assert updated["renewal_contact_person"] == "Pooja Malhotra"
        assert updated["renewal_contact_mobile"] == "9812345678"
        assert updated["kam_name"] == "Siddharth Sen"
        assert updated["claims_contact_person"] == "Amitabh Bose"  # Unchanged field preserved
    finally:
        # Cleanup created company
        await client.delete(f"/api/v1/insurance/companies/{company_id}", headers=auth_headers)


@pytest.mark.asyncio
async def test_api_company_validation_rejects_invalid_inputs(client: AsyncClient, auth_headers: dict):
    """Verify API returns 422 when company contact details violate validation rules."""
    base_payload = {
        "name": f"Invalid Test Insurer {uuid.uuid4().hex[:6]}",
        "code": f"INV_{uuid.uuid4().hex[:4].upper()}",
        "category": "Health Insurance",
        "company_type": "Standalone Health Insurer (SAHI)",
    }

    # 1. Invalid mobile (less than 10 digits)
    resp1 = await client.post(
        "/api/v1/insurance/companies",
        json={**base_payload, "agent_direct_mobile": "98765"},
        headers=auth_headers,
    )
    assert resp1.status_code == 422, f"Expected 422, got {resp1.status_code}: {resp1.text}"

    # 2. Invalid mobile (starting with 1)
    resp2 = await client.post(
        "/api/v1/insurance/companies",
        json={**base_payload, "renewal_contact_mobile": "1234567890"},
        headers=auth_headers,
    )
    assert resp2.status_code == 422

    # 3. Invalid email format
    resp3 = await client.post(
        "/api/v1/insurance/companies",
        json={**base_payload, "claims_contact_email": "claims-at-insurer.com"},
        headers=auth_headers,
    )
    assert resp3.status_code == 422

    # 4. Tie-up renewal date preceding tie-up date
    resp4 = await client.post(
        "/api/v1/insurance/companies",
        json={
            **base_payload,
            "tieup_date": "2026-12-01",
            "tieup_renewal_date": "2026-01-01",
        },
        headers=auth_headers,
    )
    assert resp4.status_code == 422


@pytest.mark.asyncio
async def test_api_customer_validation_rejects_invalid_inputs(client: AsyncClient, auth_headers: dict):
    """Verify API returns 422 on invalid customer phone, PIN, PAN, or future DOB."""
    base_cust = {
        "first_name": "Test",
        "last_name": "Client",
        "phone": "9876543210",
        "email": "testclient@example.com",
    }

    # 1. Phone with 9 digits
    r1 = await client.post(
        "/api/v1/insurance/customers",
        json={**base_cust, "phone": "987654321"},
        headers=auth_headers,
    )
    assert r1.status_code == 422

    # 2. Phone starting with 2
    r2 = await client.post(
        "/api/v1/insurance/customers",
        json={**base_cust, "phone": "2876543210"},
        headers=auth_headers,
    )
    assert r2.status_code == 422

    # 3. PIN code with 5 digits
    r3 = await client.post(
        "/api/v1/insurance/customers",
        json={**base_cust, "pincode": "40001"},
        headers=auth_headers,
    )
    assert r3.status_code == 422

    # 4. Future DOB
    r4 = await client.post(
        "/api/v1/insurance/customers",
        json={**base_cust, "date_of_birth": "2099-01-01"},
        headers=auth_headers,
    )
    assert r4.status_code == 422


@pytest.mark.asyncio
async def test_existing_hdfc_ergo_company_intact():
    """Verify that the pre-existing HDFC ERGO record is preserved intact with all legacy and new columns."""
    async with AsyncSessionLocal() as session:
        query = select(InsuranceCompany).where(InsuranceCompany.name == "HDFC ERGO General Insurance")
        result = await session.execute(query)
        company = result.scalar_one_or_none()
        assert company is not None, "Pre-existing HDFC ERGO record must exist in PostgreSQL"
        assert company.name == "HDFC ERGO General Insurance"
        # Verify both legacy columns and new separated columns exist on the model
        assert hasattr(company, "renewal_team_contact")
        assert hasattr(company, "claims_team_contact")
        assert hasattr(company, "renewal_contact_person")
        assert hasattr(company, "renewal_contact_mobile")
        assert hasattr(company, "claims_contact_person")
        assert hasattr(company, "claims_contact_mobile")
        assert hasattr(company, "kam_name")
        assert hasattr(company, "kam_mobile")
        assert hasattr(company, "website")
