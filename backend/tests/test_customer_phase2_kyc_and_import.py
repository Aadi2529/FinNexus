"""Automated Integration Tests for Customer KYC Encryption, Corporate Client, Unmasking, and Bulk Import."""

import io
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select

from app.db.models.crm import Customer
from app.db.models.audit import AuditLog
from app.db.seed import seed_initial_data
from app.db.session import Base, get_db_session
from app.main import app
from app.services.insurance.kyc_crypto import (
    encrypt_kyc_value,
    decrypt_kyc_value,
    hash_kyc_value,
    mask_aadhaar,
    mask_pan,
    is_masked_value,
)

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
async def test_individual_customer_kyc_encryption_and_masking(client: AsyncClient, auth_headers: dict, test_session: AsyncSession):
    """Test individual customer creation with Aadhaar & PAN encryption at rest and masked display."""
    payload = {
        "customer_type": "INDIVIDUAL",
        "first_name": "Arjun",
        "last_name": "Sharma",
        "email": "arjun.sharma@example.com",
        "phone": "+91 98765 43210",
        "gender": "MALE",
        "marital_status": "MARRIED",
        "nationality": "Indian",
        "occupation": "Software Engineer",
        "source_of_income": "SALARY",
        "address": "404 Tech Park, Whitefield",
        "city": "Bengaluru",
        "state": "Karnataka",
        "pincode": "560066",
        "date_of_birth": "1990-05-15",
        "pan_number": "ABCDE1234F",
        "aadhaar_number": "987654321098",
    }

    create_resp = await client.post("/api/v1/insurance/customers", json=payload, headers=auth_headers)
    assert create_resp.status_code == 201, create_resp.text
    created = create_resp.json()
    cust_id = created["id"]

    # Verify masked output in API response
    assert created["pan_number"] == "XXXXX1234F"
    assert created["aadhaar_number"] == "XXXX-XXXX-1098"
    assert created["occupation"] == "Software Engineer"
    assert created["marital_status"] == "MARRIED"

    # Verify raw database record: Aadhaar must be Fernet ciphertext and hash must be 64-char hex
    stmt = select(Customer).where(Customer.id == uuid.UUID(cust_id))
    result = await test_session.execute(stmt)
    db_cust = result.scalar_one()

    assert db_cust.aadhaar_encrypted is not None
    assert db_cust.aadhaar_encrypted != "987654321098"
    assert db_cust.aadhaar_hash == hash_kyc_value("987654321098")
    assert decrypt_kyc_value(db_cust.aadhaar_encrypted) == "987654321098"

    assert db_cust.pan_encrypted is not None
    assert db_cust.pan_encrypted != "ABCDE1234F"
    assert decrypt_kyc_value(db_cust.pan_encrypted) == "ABCDE1234F"

    # Test update with masked value does NOT overwrite ciphertext
    update_resp = await client.put(
        f"/api/v1/insurance/customers/{cust_id}",
        json={
            "first_name": "Arjun",
            "last_name": "Sharma",
            "occupation": "Senior Architect",
            "pan_number": "XXXXX1234F",  # Masked placeholder sent by frontend
            "aadhaar_number": "XXXX-XXXX-1098",
        },
        headers=auth_headers,
    )
    assert update_resp.status_code == 200, update_resp.text

    # Re-verify DB ciphertext was preserved
    await test_session.refresh(db_cust)
    assert decrypt_kyc_value(db_cust.aadhaar_encrypted) == "987654321098"
    assert decrypt_kyc_value(db_cust.pan_encrypted) == "ABCDE1234F"
    assert db_cust.occupation == "Senior Architect"

    # Test Unmask KYC endpoint
    unmask_resp = await client.get(f"/api/v1/insurance/customers/{cust_id}/unmask-kyc", headers=auth_headers)
    assert unmask_resp.status_code == 200, unmask_resp.text
    unmasked = unmask_resp.json()
    assert unmasked["aadhaar_number"] == "987654321098"
    assert unmasked["pan_number"] == "ABCDE1234F"

    # Verify AuditLog recorded the unmasking
    audit_stmt = select(AuditLog).where(
        AuditLog.action == "CUSTOMER_KYC_UNMASKED",
        AuditLog.resource_id == uuid.UUID(cust_id),
    )
    audit_result = await test_session.execute(audit_stmt)
    audit_log = audit_result.scalar_one_or_none()
    assert audit_log is not None


@pytest.mark.asyncio
async def test_corporate_customer_validation(client: AsyncClient, auth_headers: dict):
    """Test corporate client creation with GSTIN, Corporate Code, and validation."""
    corp_payload = {
        "customer_type": "CORPORATE",
        "company_name": "Apex Logistics Private Limited",
        "corporate_code": "APEX-LOG-01",
        "gstin": "27AABCA1234A1Z5",
        "pan_number": "AABCA1234A",
        "email": "procurement@apexlogistics.com",
        "phone": "+91 22 2456 7890",
        "contact_person_name": "Vikram Malhotra",
        "contact_person_phone": "+91 99887 76655",
        "contact_person_email": "vikram@apexlogistics.com",
        "address": "Floor 12, Tower B, Business Bay",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400013",
    }

    resp = await client.post("/api/v1/insurance/customers", json=corp_payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["company_name"] == "Apex Logistics Private Limited"
    assert data["corporate_code"] == "APEX-LOG-01"
    assert data["gstin"] == "27AABCA1234A1Z5"
    assert data["contact_person_name"] == "Vikram Malhotra"

    # Duplicate corporate code should fail with 409
    dup_resp = await client.post("/api/v1/insurance/customers", json=corp_payload, headers=auth_headers)
    assert dup_resp.status_code == 409


@pytest.mark.asyncio
async def test_bulk_customer_import_workflow(client: AsyncClient, auth_headers: dict):
    """Test bulk customer import workflow: template download, preview with diagnostics, and confirmed import."""
    # 1. Download CSV template
    tpl_resp = await client.get("/api/v1/insurance/customers/import/template?format=csv&type=INDIVIDUAL", headers=auth_headers)
    assert tpl_resp.status_code == 200
    assert "attachment; filename=" in tpl_resp.headers["content-disposition"]
    assert b"First Name,Last Name,Mobile Number" in tpl_resp.content

    # 2. Preview with valid and invalid rows
    csv_content = (
        "first_name,last_name,email,phone,gender,city,state,pincode,pan_number,aadhaar_number\n"
        "Rohan,Verma,rohan.verma@example.com,9876500001,MALE,Pune,Maharashtra,411001,XYZPK1234Q,123456789012\n"
        "Sneha,Patel,sneha.patel@example.com,9876500002,FEMALE,Surat,Gujarat,395001,INVLD123,9999\n"
    ).encode("utf-8")

    files = {"file": ("test_import.csv", csv_content, "text/csv")}
    prev_resp = await client.post("/api/v1/insurance/customers/import/preview?client_type=INDIVIDUAL", files=files, headers=auth_headers)
    assert prev_resp.status_code == 200, prev_resp.text
    prev_data = prev_resp.json()

    assert prev_data["total_rows"] == 2
    assert prev_data["valid_rows"] == 1
    assert prev_data["invalid_rows"] == 1

    # Row 3 (Sneha Patel) must have PAN and Aadhaar format errors
    r_invalid = next(r for r in prev_data["rows"] if r["row_number"] == 3)
    assert r_invalid["is_valid"] is False
    assert len(r_invalid["errors"]) >= 1

    # 3. Confirm import of valid rows
    confirm_payload = {
        "client_type": "INDIVIDUAL",
        "rows": [
            {
                "first_name": "Rohan",
                "last_name": "Verma",
                "email": "rohan.verma@example.com",
                "phone": "+91 98765 00001",
                "gender": "MALE",
                "city": "Pune",
                "state": "Maharashtra",
                "pincode": "411001",
                "pan_number": "XYZPK1234Q",
                "aadhaar_number": "123456789012",
            }
        ],
    }

    conf_resp = await client.post("/api/v1/insurance/customers/import/confirm", json=confirm_payload, headers=auth_headers)
    assert conf_resp.status_code == 200, conf_resp.text
    conf_data = conf_resp.json()
    assert conf_data["status"] == "COMPLETED"
    assert conf_data["successful_count"] == 1
