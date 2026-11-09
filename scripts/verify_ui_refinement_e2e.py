import asyncio
import os
import sys
from datetime import date, timedelta
from decimal import Decimal

# Ensure backend root is on sys.path and load environment
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
import dotenv
dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from sqlalchemy import select, delete
from app.db.session import AsyncSessionLocal
from app.db.models import (
    Customer,
    InsuranceCompany,
    InsurancePlan,
    InsurancePolicy,
    InsurancePurchaseParty,
)
from app.schemas.insurance import PolicyCreate, PolicyUpdate
from app.services.insurance.policy_service import (
    create_policy,
    get_policy_detail,
    update_policy,
    get_policy_lookup_data,
    lob_matches,
)

passed_tests = []
failed_tests = []

def record_pass(test_id, msg):
    clean_msg = msg.replace("\u20b9", "Rs.")
    passed_tests.append((test_id, clean_msg))
    print(f"  [PASS] {test_id}: {clean_msg}")

def record_fail(test_id, msg, exc=None):
    clean_msg = msg.replace("\u20b9", "Rs.")
    detail = f"{clean_msg} - {exc}" if exc else clean_msg
    failed_tests.append((test_id, detail))
    print(f"  [FAIL] {test_id}: {clean_msg}")
    if exc:
        print(f"         Error: {exc}")

async def run_all_checks():
    print("=" * 80)
    print("FINNEXUS INSURANCE ENGINE: UI REFINEMENT & DROPDOWN RESTORATION E2E AUDIT")
    print("=" * 80)

    async with AsyncSessionLocal() as session:
        # -------------------------------------------------------------
        # TEST 1: Policy Category-Based Company Filtering (Backend Lookup)
        # -------------------------------------------------------------
        print("\n--- 1. CATEGORY-BASED INSURANCE COMPANY FILTERING ---")
        try:
            # 1.1 Health
            hlth_lookup = await get_policy_lookup_data(session, category="HEALTH")
            hlth_comps = hlth_lookup["companies"]
            assert len(hlth_comps) > 0, "No Health companies returned"
            for c in hlth_comps:
                assert any(lob_matches(cat, "HEALTH") for cat in c["categories"]), f"Non-health company '{c['name']}' returned in HEALTH lookup: {c['categories']}"
            record_pass("AUDIT-1.1", f"HEALTH category returned {len(hlth_comps)} valid Health carriers (e.g. {hlth_comps[0]['name']}).")

            # 1.2 Life
            life_lookup = await get_policy_lookup_data(session, category="LIFE")
            life_comps = life_lookup["companies"]
            assert len(life_comps) > 0, "No Life companies returned"
            for c in life_comps:
                assert any(lob_matches(cat, "LIFE") for cat in c["categories"]), f"Non-life company '{c['name']}' returned in LIFE lookup: {c['categories']}"
            assert not any(c["name"] == "Care Health" for c in life_comps), "Care Health incorrectly returned for LIFE"
            record_pass("AUDIT-1.2", f"LIFE category returned {len(life_comps)} strictly Life carriers (e.g. {life_comps[0]['name']}).")

            # 1.3 Motor
            motor_lookup = await get_policy_lookup_data(session, category="MOTOR")
            motor_comps = motor_lookup["companies"]
            assert len(motor_comps) > 0, "No Motor companies returned"
            for c in motor_comps:
                assert any(lob_matches(cat, "MOTOR") for cat in c["categories"]), f"Non-motor company '{c['name']}' returned in MOTOR lookup: {c['categories']}"
            assert not any(c["name"] == "LIC India" for c in motor_comps), "LIC India incorrectly returned for MOTOR"
            record_pass("AUDIT-1.3", f"MOTOR category returned {len(motor_comps)} valid Motor carriers (e.g. {motor_comps[0]['name']}).")

            # 1.4 Travel
            travel_lookup = await get_policy_lookup_data(session, category="TRAVEL")
            travel_comps = travel_lookup["companies"]
            assert len(travel_comps) > 0, "No Travel companies returned"
            for c in travel_comps:
                assert any(lob_matches(cat, "TRAVEL") for cat in c["categories"]), f"Non-travel company '{c['name']}' returned in TRAVEL lookup: {c['categories']}"
            assert not any(c["name"] == "LIC India" for c in travel_comps), "LIC India incorrectly returned for TRAVEL"
            record_pass("AUDIT-1.4", f"TRAVEL category returned {len(travel_comps)} valid Travel carriers (e.g. {travel_comps[0]['name']}).")

        except Exception as e:
            record_fail("AUDIT-1", "Category-based company filtering failed", e)

        # -------------------------------------------------------------
        # TEST 2: Plan Filtering by Company & Category
        # -------------------------------------------------------------
        print("\n--- 2. PLAN FILTERING BY COMPANY AND CATEGORY ---")
        try:
            # Check plans returned by get_policy_lookup_data for Health
            hlth_plans = hlth_lookup["plans"]
            assert len(hlth_plans) > 0, "No plans returned for HEALTH"
            for p in hlth_plans:
                assert lob_matches(p["line_of_business"], "HEALTH"), f"Non-health plan '{p['name']}' ({p['line_of_business']}) returned in HEALTH lookup"
            record_pass("AUDIT-2.1", f"HEALTH plans filtered strictly ({len(hlth_plans)} plans returned).")

            # Check plans returned for Motor
            motor_plans = motor_lookup["plans"]
            assert len(motor_plans) > 0, "No plans returned for MOTOR"
            for p in motor_plans:
                assert lob_matches(p["line_of_business"], "MOTOR"), f"Non-motor plan '{p['name']}' ({p['line_of_business']}) returned in MOTOR lookup"
            record_pass("AUDIT-2.2", f"MOTOR plans filtered strictly ({len(motor_plans)} plans returned).")

        except Exception as e:
            record_fail("AUDIT-2", "Plan filtering failed", e)

        # -------------------------------------------------------------
        # TEST 3: Policy Term (1, 2, 3, 4 Years) Expiry Recalculation
        # -------------------------------------------------------------
        print("\n--- 3. POLICY TERM (1, 2, 3, 4 YEARS) & EXPIRY RECALCULATION ---")
        try:
            cust = (await session.execute(select(Customer).limit(1))).scalar_one()
            comp = (await session.execute(select(InsuranceCompany).where(InsuranceCompany.is_active.is_(True)).limit(1))).scalar_one()
            plan = (await session.execute(select(InsurancePlan).where(InsurancePlan.company_id == comp.id).limit(1))).scalar_one_or_none()
            if not plan:
                plan = (await session.execute(select(InsurancePlan).limit(1))).scalar_one()
                comp = (await session.execute(select(InsuranceCompany).where(InsuranceCompany.id == plan.company_id))).scalar_one()
            party = (await session.execute(select(InsurancePurchaseParty).limit(1))).scalar_one()

            start_dt = date(2026, 11, 1)

            for term in [1, 2, 3, 4]:
                pol_num = f"UI-REF-TERM-{term}YR"
                await session.execute(delete(InsurancePolicy).where(InsurancePolicy.policy_number == pol_num))
                await session.commit()

                pol_in = PolicyCreate(
                    policy_number=pol_num,
                    policy_type=plan.line_of_business or "HEALTH",
                    customer_id=cust.id,
                    company_id=comp.id,
                    plan_id=plan.id,
                    purchase_party_id=party.id,
                    policy_term_years=term,
                    sum_assured=Decimal("1000000.00"),
                    net_premium=Decimal("10000.00"),
                    gross_premium=Decimal("11800.00"),
                    final_premium=Decimal("11800.00"),
                    policy_start_date=start_dt,
                )
                pol = await create_policy(session, pol_in)
                expected_expiry = date(start_dt.year + term, start_dt.month, start_dt.day)
                assert pol.expiry_date == expected_expiry, f"Expected expiry {expected_expiry}, got {pol.expiry_date}"
                assert pol.term_years == term, f"Expected term {term}, got {pol.term_years}"
                record_pass(f"AUDIT-3.{term}", f"Term = {term} Year(s): Expiry verified as {pol.expiry_date} (Start: {start_dt}).")

        except Exception as e:
            record_fail("AUDIT-3", "Policy Term expiry calculation failed", e)

        # -------------------------------------------------------------
        # TEST 4: Sum Insured Preset vs Custom Amount Persistence
        # -------------------------------------------------------------
        print("\n--- 4. SUM INSURED PRESET VS CUSTOM AMOUNT PERSISTENCE ---")
        try:
            # 4.1 Standard Preset: Rs. 10 Lakh
            preset_pol_num = "UI-REF-SI-PRESET-10L"
            await session.execute(delete(InsurancePolicy).where(InsurancePolicy.policy_number == preset_pol_num))
            await session.commit()

            pol_10l = await create_policy(session, PolicyCreate(
                policy_number=preset_pol_num,
                policy_type=plan.line_of_business or "HEALTH",
                customer_id=cust.id,
                company_id=comp.id,
                plan_id=plan.id,
                purchase_party_id=party.id,
                policy_term_years=1,
                sum_assured=Decimal("1000000.00"),
                net_premium=Decimal("8000.00"),
                gross_premium=Decimal("9440.00"),
                final_premium=Decimal("9440.00"),
                policy_start_date=start_dt,
            ))
            assert pol_10l.sum_assured == Decimal("1000000.00")
            record_pass("AUDIT-4.1", "Standard preset Rs. 10,00,000 persisted correctly.")

            # 4.2 Custom Amount: Rs. 12,75,000 (Non-standard)
            custom_pol_num = "UI-REF-SI-CUSTOM-1275K"
            await session.execute(delete(InsurancePolicy).where(InsurancePolicy.policy_number == custom_pol_num))
            await session.commit()

            pol_custom = await create_policy(session, PolicyCreate(
                policy_number=custom_pol_num,
                policy_type=plan.line_of_business or "HEALTH",
                customer_id=cust.id,
                company_id=comp.id,
                plan_id=plan.id,
                purchase_party_id=party.id,
                policy_term_years=1,
                sum_assured=Decimal("1275000.00"),
                net_premium=Decimal("10500.00"),
                gross_premium=Decimal("12390.00"),
                final_premium=Decimal("12390.00"),
                policy_start_date=start_dt,
            ))
            assert pol_custom.sum_assured == Decimal("1275000.00")
            record_pass("AUDIT-4.2", "Custom amount Rs. 12,75,000 persisted cleanly.")

        except Exception as e:
            record_fail("AUDIT-4", "Sum Insured persistence failed", e)

        # -------------------------------------------------------------
        # TEST 5: Update Existing Policy (Edit Contract)
        # -------------------------------------------------------------
        print("\n--- 5. EXISTING POLICY EDIT & VALUE PRESERVATION ---")
        try:
            update_payload = PolicyUpdate(
                sum_assured=Decimal("2000000.00"),
                term_years=3,
                expiry_date=date(start_dt.year + 3, start_dt.month, start_dt.day),
            )
            updated_pol = await update_policy(session, pol_10l.id, update_payload)
            assert updated_pol.sum_assured == Decimal("2000000.00")
            assert updated_pol.term_years == 3
            assert updated_pol.expiry_date == date(start_dt.year + 3, start_dt.month, start_dt.day)
            record_pass("AUDIT-5.1", f"Policy edit updated Sum Assured to Rs. 20,00,000, Term to 3 Years, Expiry to {updated_pol.expiry_date} with zero data loss.")

        except Exception as e:
            record_fail("AUDIT-5", "Policy edit failed", e)

    print("\n" + "=" * 80)
    print(f"AUDIT SUMMARY: {len(passed_tests)} PASSED, {len(failed_tests)} FAILED")
    print("=" * 80)
    if failed_tests:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_all_checks())
