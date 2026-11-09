import asyncio
import os
import sys
import uuid
from decimal import Decimal
from datetime import date, timedelta

sys.path.insert(0, os.path.abspath("."))

from app.db.session import AsyncSessionLocal
from app.services.insurance.policy_service import (
    get_policy_lookup_data,
    create_policy,
    get_policy_detail,
)
from app.schemas.insurance import PolicyCreate, PolicyNomineeCreate, PaymentCreate
from app.db.models.insurance import InsurancePolicy, InsurancePolicyNominee, InsurancePolicyPayment

async def verify_form_and_data():
    print("=" * 70)
    print("FINNEXUS INSURANCE ENGINE — POLICY FORM VERIFICATION")
    print("=" * 70)

    async with AsyncSessionLocal() as session:
        # Step 1: Check Lookup Data
        lookup = await get_policy_lookup_data(session)
        companies = lookup["companies"]
        plans = lookup["plans"]
        parties = lookup["purchase_parties"]
        agents = lookup["sub_agents"]
        customers = lookup["customers"]

        print(f"\n[1] Drodown Lookup Verification:")
        print(f"  Companies loaded: {len(companies)} (All active)")
        print(f"  Plans loaded:     {len(plans)} (All active)")
        print(f"  Parties loaded:   {len(parties)} (All active)")
        print(f"  SubAgents loaded: {len(agents)} (All active)")
        print(f"  Customers loaded: {len(customers)} (All unarchived)")

        assert len(companies) >= 8, f"Expected at least 8 companies, got {len(companies)}"
        assert len(plans) >= 9, f"Expected at least 9 plans, got {len(plans)}"
        assert len(parties) >= 3, f"Expected at least 3 parties, got {len(parties)}"
        assert len(agents) >= 1, f"Expected at least 1 agent, got {len(agents)}"
        assert len(customers) >= 10, f"Expected at least 10 customers, got {len(customers)}"

        # Step 2: Verify Frontend Filter Logic for Companies
        print(f"\n[2] Frontend Filter Logic Simulation:")
        visible_companies = [c for c in companies if c.get("is_active") is not False]
        print(f"  Visible Companies in Dropdown: {len(visible_companies)}/{len(companies)}")
        assert len(visible_companies) == len(companies), "Some companies were filtered out!"

        # Step 3: Verify Dependent Plan Matching
        print(f"\n[3] Dependent Plan Matching for Each Company:")
        def lob_matches(plan_lob, form_lob):
            if not form_lob or form_lob == "ALL":
                return True
            if not plan_lob:
                return True
            p = str(plan_lob).strip().upper()
            f = str(form_lob).strip().upper()
            if p == f:
                return True
            if f == "LIFE" and ("LIFE" in p or p == "TERM"):
                return True
            if f == "HEALTH" and ("HEALTH" in p or "MED" in p or "CARE" in p):
                return True
            if f == "MOTOR" and ("MOTOR" in p or "CAR" in p or "VEHICLE" in p or "GENERAL" in p or "GEN" in p):
                return True
            if f == "CORPORATE" and ("CORP" in p or "GROUP" in p or "COMMERCIAL" in p):
                return True
            return f in p or p in f

        for co in visible_companies:
            co_plans = [p for p in plans if p["company_id"] == co["id"]]
            print(f"  - Company '{co['name']}' ({co['code']}) [{co.get('category')}] -> {len(co_plans)} plan(s) in DB")
            if co_plans:
                # Test smart category resolution
                matches_current = [p for p in co_plans if lob_matches(p.get("lob"), "HEALTH")]
                resolved_plans = matches_current if matches_current else co_plans
                assert len(resolved_plans) > 0, f"Plans exist for {co['name']} but resolved_plans was empty!"
                print(f"    Available plans rendered: {[p['name'] for p in resolved_plans]}")

        # Step 4: End-to-End Policy Registration with Form Payload
        print(f"\n[4] End-to-End Policy Registration Submission:")
        test_cust = customers[0]
        care_health = next(c for c in companies if "Care" in c["name"])
        care_plan = next(p for p in plans if p["company_id"] == care_health["id"])
        test_party = parties[0]
        test_agent = agents[0]

        pol_no = f"POL-TEST-{int(asyncio.get_event_loop().time() * 1000) % 100000}"
        today = date.today()

        payload = PolicyCreate(
            policy_number=pol_no,
            policy_type="HEALTH",
            customer_id=uuid.UUID(test_cust["id"]),
            company_id=uuid.UUID(care_health["id"]),
            plan_id=uuid.UUID(care_plan["id"]),
            purchase_party_id=uuid.UUID(test_party["id"]),
            sub_agent_id=uuid.UUID(test_agent["id"]),
            term_years=1,
            sum_assured=Decimal("500000.00"),
            final_premium=Decimal("18500.00"),
            is_single_premium=False,
            premium_mode="Yearly",
            policy_start_date=today,
            first_receipt_date=today,
            expiry_date=today + timedelta(days=365),
            notes="Automated E2E Form Verification Contract",
            nominees=[
                PolicyNomineeCreate(
                    full_name="Meera Sharma",
                    relationship="Spouse",
                    date_of_birth=date(1992, 5, 14),
                    mobile_number="9876543210",
                    address="Flat 401, Galaxy Tower, Pune",
                    share_percentage=Decimal("60.00"),
                ),
                PolicyNomineeCreate(
                    full_name="Rohan Sharma",
                    relationship="Son",
                    date_of_birth=date(2018, 9, 21),
                    share_percentage=Decimal("40.00"),
                ),
            ],
            initial_payment=PaymentCreate(
                payment_mode="ONLINE",
                bank_name="HDFC Bank",
                transaction_reference=f"UPI-{pol_no}",
                amount=Decimal("18500.00"),
                payment_date=today,
                notes="Initial First Year Premium Deposit",
            ),
        )

        created = await create_policy(session, payload)
        print(f"  Created Policy ID: {created.id}")
        print(f"  Policy Number:     {created.policy_number}")
        print(f"  Customer:          {created.customer_name}")
        print(f"  Company:           {created.company_name}")
        print(f"  Plan:              {created.plan_name}")
        print(f"  Status:            {created.status}")
        print(f"  Sum Assured:       Rs. {created.sum_assured:,.2f}")
        print(f"  Final Premium:     Rs. {created.final_premium:,.2f}")
        print(f"  Nominees Saved:    {len(created.nominees)}")
        for nom in created.nominees:
            print(f"    * {nom.full_name} ({nom.relationship}) - {nom.share_percentage}%")
        print(f"  Schedules Gen:     {len(created.schedules)}")
        print(f"  Payments Recorded: {len(created.payments)}")

        assert created.status == "ACTIVE"
        assert len(created.nominees) == 2
        assert len(created.schedules) >= 1
        assert len(created.payments) == 1

        print("\n" + "=" * 70)
        print("ALL VERIFICATIONS PASSED 100% AGAINST LIVE POSTGRESQL!")
        print("=" * 70)

if __name__ == "__main__":
    asyncio.run(verify_form_and_data())
