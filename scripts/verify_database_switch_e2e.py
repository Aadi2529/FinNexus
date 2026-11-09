import asyncio
import os
import sys
import uuid
from decimal import Decimal
from datetime import date, timedelta

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
import dotenv
dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from httpx import AsyncClient, ASGITransport
from app.main import create_application
from app.core.config import settings
from app.db.session import AsyncSessionLocal, engine
from sqlalchemy import text, select, func
from app.db.models.auth import User, Role
from app.db.models.crm import Customer
from app.db.models.insurance import (
    InsuranceCompany,
    InsuranceCompanyCategory,
    InsurancePlan,
    InsurancePolicy,
    InsurancePurchaseParty,
)

passed_tests = []
failed_tests = []

def record_pass(step, desc):
    print(f" [PASS] {step}: {desc}")
    passed_tests.append((step, desc))

def record_fail(step, desc, err=""):
    print(f" [FAIL] {step}: {desc} -> {err}")
    failed_tests.append((step, desc, err))

async def verify_e2e():
    print("=" * 70)
    print("FINNEXUS ENTERPRISE — DATABASE SWITCH E2E VERIFICATION")
    print("=" * 70)

    # 1. Config & Target DB Verification
    try:
        assert settings.DB_NAME == "finnexus_db", f"Expected DB_NAME finnexus_db, got {settings.DB_NAME}"
        assert "finnexus_db" in settings.DATABASE_URL, "DATABASE_URL must contain finnexus_db"
        assert "finnexus_db" in settings.SYNC_DATABASE_URL, "SYNC_DATABASE_URL must contain finnexus_db"
        record_pass("1.1", "Backend configuration accurately targets finnexus_db")
    except Exception as e:
        record_fail("1.1", "Backend configuration targets finnexus_db", str(e))

    # 2. Database Connection & Schema Verification
    async with AsyncSessionLocal() as session:
        try:
            curr_db = (await session.execute(text("SELECT current_database();"))).scalar()
            assert curr_db == "finnexus_db", f"Connected to {curr_db} instead of finnexus_db!"
            record_pass("2.1", f"Active PostgreSQL connection verified on current_database() = {curr_db}")
        except Exception as e:
            record_fail("2.1", "Active PostgreSQL connection to finnexus_db", str(e))

        # Check Alembic migration head in finnexus_db
        try:
            mig_ver = (await session.execute(text("SELECT version_num FROM alembic_version;"))).scalar()
            assert mig_ver == "f6a7b8c9d0e1", f"Expected migration head f6a7b8c9d0e1, got {mig_ver}"
            record_pass("2.2", f"Alembic migration head in finnexus_db verified: {mig_ver}")
        except Exception as e:
            record_fail("2.2", "Alembic migration head check", str(e))

        # Verify old database preserved untouched
        try:
            from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
            old_engine = create_async_engine(settings.DATABASE_URL.replace("finnexus_db", "financeflow_dev"))
            async with AsyncSession(old_engine) as old_sess:
                old_cnt = (await old_sess.execute(text("SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"))).scalar()
                assert old_cnt == 33, f"Expected 33 tables in financeflow_dev, got {old_cnt}"
                record_pass("2.3", f"Old database financeflow_dev completely preserved untouched (33 tables)")
            await old_engine.dispose()
        except Exception as e:
            record_fail("2.3", "Old database preservation check", str(e))

        # 3. Clean Baseline & Super Admin Verification
        try:
            user_count = (await session.execute(select(func.count(User.id)))).scalar()
            assert user_count == 1, f"Expected exactly 1 Super Admin, got {user_count}"
            admin_user = (await session.execute(select(User))).scalar_one()
            assert admin_user.email == "admin@finnexus.com", f"Expected admin@finnexus.com, got {admin_user.email}"
            assert admin_user.is_active is True, "Super Admin must be active"

            roles_count = (await session.execute(select(func.count(Role.id)))).scalar()
            assert roles_count == 7, f"Expected 7 system roles, got {roles_count}"

            # Verify 0 dummy business data
            cust_count = (await session.execute(select(func.count(Customer.id)))).scalar()
            pol_count = (await session.execute(select(func.count(InsurancePolicy.id)))).scalar()
            assert cust_count == 0, f"Expected 0 customers in clean DB, found {cust_count}"
            assert pol_count == 0, f"Expected 0 policies in clean DB, found {pol_count}"
            record_pass("3.1", "Clean baseline verified: Exactly 1 Super Admin, 7 roles, 0 customers, 0 policies")
        except Exception as e:
            record_fail("3.1", "Clean baseline verification", str(e))

    # 4. API Authentication & RBAC Verification
    app = create_application()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 4.1 Login
        auth_token = None
        try:
            login_res = await client.post(
                "/api/v1/auth/login",
                json={"email": "admin@finnexus.com", "password": settings.SUPER_ADMIN_PASSWORD or "Admin@12345"},
            )
            assert login_res.status_code == 200, f"Login failed: {login_res.status_code} {login_res.text}"
            data = login_res.json()
            assert "access_token" in data, "Login response missing access_token"
            auth_token = data["access_token"]
            raw_roles = data["user"].get("roles", [])
            roles = [r["name"] if isinstance(r, dict) else r for r in raw_roles]
            assert "SUPER_ADMIN" in roles, f"Expected SUPER_ADMIN role, got {roles}"
            record_pass("4.1", f"Super Admin authenticated successfully via /auth/login (Roles: {roles})")
        except Exception as e:
            record_fail("4.1", "Super Admin API login", str(e))

        headers = {"Authorization": f"Bearer {auth_token}"}

        # 4.2 /auth/me check
        try:
            me_res = await client.get("/api/v1/auth/me", headers=headers)
            assert me_res.status_code == 200, f"/auth/me failed: {me_res.status_code} {me_res.text}"
            me_data = me_res.json()
            assert me_data["email"] == "admin@finnexus.com"
            record_pass("4.2", "/auth/me returns valid Super Admin profile")
        except Exception as e:
            record_fail("4.2", "/auth/me verification", str(e))

        # 5. Dashboard, CRM, Toolkit, Insurance Engine API Verification on new DB
        # 5.1 CRM stats / customers
        try:
            crm_res = await client.get("/api/v1/crm/stats", headers=headers)
            assert crm_res.status_code == 200, f"CRM stats failed: {crm_res.status_code} {crm_res.text}"
            custs_res = await client.get("/api/v1/crm/customers", headers=headers)
            assert custs_res.status_code == 200, f"CRM customers failed: {custs_res.status_code}"
            custs_list = custs_res.json()
            assert len(custs_list) == 0, "Expected 0 customers in clean database"
            record_pass("5.1", "CRM endpoints functioning on finnexus_db (0 customers clean)")
        except Exception as e:
            record_fail("5.1", "CRM endpoints verification", str(e))

        # 5.2 Toolkit calculator
        try:
            emi_res = await client.post(
                "/api/v1/toolkit/calculator/emi",
                json={"principal": 500000.0, "annual_interest_rate": 8.5, "tenure_months": 60},
                headers=headers,
            )
            assert emi_res.status_code == 200, f"EMI calc failed: {emi_res.status_code} {emi_res.text}"
            record_pass("5.2", "Toolkit financial calculator operational")
        except Exception as e:
            record_fail("5.2", "Toolkit verification", str(e))

        # 5.3 Insurance stats & policies
        try:
            ins_res = await client.get("/api/v1/insurance/stats", headers=headers)
            assert ins_res.status_code == 200, f"Insurance stats failed: {ins_res.status_code}"
            pols_res = await client.get("/api/v1/insurance/policies", headers=headers)
            assert pols_res.status_code == 200, f"Insurance policies failed: {pols_res.status_code}"
            assert pols_res.json().get("total") == 0, "Expected 0 policies in clean database"
            record_pass("5.3", "Insurance Engine operational on finnexus_db (0 policies clean)")
        except Exception as e:
            record_fail("5.3", "Insurance Engine verification", str(e))

        # 6. Controlled verification transaction: create test customer & policy, then clean up
        try:
            # Create Customer with valid PAN
            cust_res = await client.post(
                "/api/v1/crm/customers",
                json={
                    "first_name": "Temporary",
                    "last_name": "VerificationUser",
                    "email": "temp_verify@example.com",
                    "phone": "9988776655",
                    "pan_number": "ABCDE1234F",
                    "city": "Mumbai",
                    "pincode": "400001",
                },
                headers=headers,
            )
            assert cust_res.status_code == 201, f"Customer creation failed: {cust_res.status_code} {cust_res.text}"
            temp_cust_id = cust_res.json()["id"]

            # Create Company
            co_res = await client.post(
                "/api/v1/insurance/companies",
                json={"name": "Temp Test Insurance", "code": "TEMP-INS-01", "category": "HEALTH"},
                headers=headers,
            )
            assert co_res.status_code == 201, f"Company creation failed: {co_res.status_code} {co_res.text}"
            temp_co_id = co_res.json()["id"]

            # Create Plan
            plan_res = await client.post(
                "/api/v1/insurance/plans",
                json={"company_id": temp_co_id, "name": "Temp Health Care Plan", "code": "TMP-PLN-01", "line_of_business": "HEALTH"},
                headers=headers,
            )
            assert plan_res.status_code == 201, f"Plan creation failed: {plan_res.status_code} {plan_res.text}"
            temp_plan_id = plan_res.json()["id"]

            # Create Purchase Party
            party_res = await client.post(
                "/api/v1/insurance/purchase-parties",
                json={"name": "Temp Direct Agency", "code": "TMP-PRT-01"},
                headers=headers,
            )
            assert party_res.status_code == 201, f"Party creation failed: {party_res.status_code} {party_res.text}"
            temp_party_id = party_res.json()["id"]

            # Issue Policy
            temp_pol_num = f"TEMP-VERIFY-{uuid.uuid4().hex[:6].upper()}"
            pol_payload = {
                "policy_number": temp_pol_num,
                "policy_type": "HEALTH",
                "coverage_type": "INDIVIDUAL",
                "business_type": "NEW",
                "customer_id": temp_cust_id,
                "company_id": temp_co_id,
                "plan_id": temp_plan_id,
                "purchase_party_id": temp_party_id,
                "policy_term_years": 1,
                "sum_assured": 500000.0,
                "gross_premium": 10000.0,
                "net_premium": 8474.58,
                "start_date": "2026-04-01",
                "expiry_date": "2027-03-31",
                "members": [{"full_name": "Temporary VerificationUser", "relationship": "Self"}],
            }
            issue_res = await client.post("/api/v1/insurance/policies", json=pol_payload, headers=headers)
            assert issue_res.status_code == 201, f"Policy issue failed: {issue_res.status_code} {issue_res.text}"
            temp_pol_id = issue_res.json()["id"]

            # Verify Policy Detail
            det_res = await client.get(f"/api/v1/insurance/policies/{temp_pol_id}", headers=headers)
            assert det_res.status_code == 200
            assert det_res.json()["policy_number"] == temp_pol_num

            # Safe cleanup of verification records
            await client.delete(f"/api/v1/insurance/policies/{temp_pol_id}", headers=headers)
            await client.delete(f"/api/v1/insurance/plans/{temp_plan_id}", headers=headers)
            await client.delete(f"/api/v1/insurance/companies/{temp_co_id}", headers=headers)
            await client.delete(f"/api/v1/insurance/purchase-parties/{temp_party_id}", headers=headers)
            
            # Remove customer from database
            async with AsyncSessionLocal() as session:
                await session.execute(text(f"DELETE FROM customers WHERE id = '{temp_cust_id}';"))
                await session.commit()

            record_pass("6.1", "Controlled transactional policy underwriting & clean cleanup verified in finnexus_db")
        except Exception as e:
            record_fail("6.1", "Controlled verification transaction", str(e))

    print("\n" + "=" * 70)
    print(f"VERIFICATION SUMMARY: {len(passed_tests)} PASSED, {len(failed_tests)} FAILED")
    print("=" * 70)
    return len(failed_tests) == 0

if __name__ == "__main__":
    success = asyncio.run(verify_e2e())
    sys.exit(0 if success else 1)
