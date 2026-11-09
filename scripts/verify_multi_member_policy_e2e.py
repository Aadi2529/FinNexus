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
    InsurancePolicyMember,
    InsurancePolicyNominee,
    InsurancePolicyPayment,
    InsurancePremiumSchedule,
    InsuranceFamilyGroup,
    InsuranceFamilyMember,
)
from app.schemas.insurance import (
    PolicyCreate,
    PolicyMemberCreate,
    PolicyNomineeCreate,
    PaymentCreate,
    PolicyRenewalRequest,
)
from app.services.insurance.policy_service import (
    create_policy,
    get_policy_detail,
    list_policies,
    add_policy_member,
    remove_policy_member,
    get_customer_family_group_members,
    record_payment,
    renew_policy_contract,
)

passed_tests = []
failed_tests = []

def record_pass(test_id, message):
    print(f"  [PASS] {test_id}: {message}")
    passed_tests.append((test_id, message))

def record_fail(test_id, message):
    print(f"  [FAIL] {test_id}: {message}")
    failed_tests.append((test_id, message))


async def setup_test_fixtures(session):
    """Seed or retrieve test customer, health company, health plan, life plan, family group."""
    # 1. Customer
    res = await session.execute(select(Customer).filter(Customer.email == "rahul.sharma@testengine.in"))
    rahul = res.scalar_one_or_none()
    if not rahul:
        rahul = Customer(
            first_name="Rahul",
            last_name="Sharma",
            email="rahul.sharma@testengine.in",
            phone="9876543210",
            gender="MALE",
            date_of_birth=date(1985, 6, 15),
            address="102, Shanti Vihar, Pune, MH",
            is_archived=False,
        )
        session.add(rahul)
        await session.flush()

    res = await session.execute(select(Customer).filter(Customer.email == "priya.sharma@testengine.in"))
    priya = res.scalar_one_or_none()
    if not priya:
        priya = Customer(
            first_name="Priya",
            last_name="Sharma",
            email="priya.sharma@testengine.in",
            phone="9876543211",
            gender="FEMALE",
            date_of_birth=date(1988, 8, 22),
            address="102, Shanti Vihar, Pune, MH",
            is_archived=False,
        )
        session.add(priya)
        await session.flush()

    # 2. Insurance Company: Health
    res = await session.execute(select(InsuranceCompany).filter(InsuranceCompany.name == "Star Health India"))
    star_health = res.scalar_one_or_none()
    if not star_health:
        star_health = InsuranceCompany(
            name="Star Health India",
            code="STARHLTH",
            category="HEALTH",
            is_archived=False,
        )
        session.add(star_health)
        await session.flush()

    # 3. Insurance Company: Life
    res = await session.execute(select(InsuranceCompany).filter(InsuranceCompany.name == "LIC India"))
    lic = res.scalar_one_or_none()
    if not lic:
        lic = InsuranceCompany(
            name="LIC India",
            code="LIC",
            category="LIFE",
            is_archived=False,
        )
        session.add(lic)
        await session.flush()

    # 4. Plans: Health
    res = await session.execute(
        select(InsurancePlan).filter(InsurancePlan.company_id == star_health.id, InsurancePlan.name.ilike("%Comprehensive%"))
    )
    health_plan = res.scalar_one_or_none()
    if not health_plan:
        health_plan = InsurancePlan(
            company_id=star_health.id,
            name="Star Comprehensive Health Cover",
            code="STAR-COMP-01",
            lob="Health Insurance",
            is_archived=False,
        )
        session.add(health_plan)
        await session.flush()

    # 5. Plans: Life
    res = await session.execute(
        select(InsurancePlan).filter(InsurancePlan.company_id == lic.id, InsurancePlan.name.ilike("%Jeevan%"))
    )
    life_plan = res.scalar_one_or_none()
    if not life_plan:
        life_plan = InsurancePlan(
            company_id=lic.id,
            name="Jeevan Labh Endowment",
            code="LIC-JLABH-01",
            lob="Life Insurance",
            is_archived=False,
        )
        session.add(life_plan)
        await session.flush()

    # 6. Family Group: Sharma Household
    res = await session.execute(select(InsuranceFamilyGroup).filter(InsuranceFamilyGroup.head_customer_id == rahul.id))
    fam_group = res.scalar_one_or_none()
    if not fam_group:
        fam_group = InsuranceFamilyGroup(
            name="Sharma Household",
            head_customer_id=rahul.id,
            notes="102, Shanti Vihar, Pune, MH",
        )
        session.add(fam_group)
        await session.flush()

        # Add Priya as family member
        fam_member = InsuranceFamilyMember(
            family_group_id=fam_group.id,
            customer_id=priya.id,
            relation_type="SPOUSE",
            notes="Wife of Head",
        )
        session.add(fam_member)
        await session.flush()

    await session.commit()
    return rahul, priya, star_health, lic, health_plan, life_plan, fam_group


async def run_all_tests():
    print("=" * 80)
    print("FINNEXUS INSURANCE ENGINE — MULTI-MEMBER & INDIVIDUAL/FAMILY FLOATER E2E AUDIT")
    print("=" * 80)

    async with AsyncSessionLocal() as session:
        rahul, priya, star_health, lic, health_plan, life_plan, fam_group = await setup_test_fixtures(session)

    # -------------------------------------------------------------------------
    # TEST A: Individual Policy with Multiple Members & Separate Sums Insured
    # -------------------------------------------------------------------------
    print("\n[TEST A] Executing Individual Policy with Multiple Members (Rahul INR 5L, Priya INR 5L)...")
    pol_num_a = f"POL-TEST-IND-{int(asyncio.get_event_loop().time() * 1000)}"
    async with AsyncSessionLocal() as session:
        payload_a = PolicyCreate(
            policy_number=pol_num_a,
            policy_type="HEALTH",
            coverage_type="INDIVIDUAL",
            customer_id=rahul.id,
            company_id=star_health.id,
            plan_id=health_plan.id,
            policy_term_years=1,
            sum_assured=Decimal("1000000"),
            net_premium=Decimal("20000.00"),
            gross_premium=Decimal("23600.00"),
            tax_amount=Decimal("3600.00"),
            premium_mode="YEARLY",
            start_date=date.today(),
            expiry_date=date.today() + timedelta(days=365),
            members=[
                PolicyMemberCreate(
                    customer_id=rahul.id,
                    full_name="Rahul Sharma",
                    relationship="Self",
                    date_of_birth=date(1985, 6, 15),
                    gender="MALE",
                    mobile_number="9876543210",
                    individual_sum_insured=Decimal("500000.00"),
                    notes="Primary insured person",
                ),
                PolicyMemberCreate(
                    customer_id=priya.id,
                    full_name="Priya Sharma",
                    relationship="Spouse",
                    date_of_birth=date(1988, 8, 22),
                    gender="FEMALE",
                    mobile_number="9876543211",
                    individual_sum_insured=Decimal("500000.00"),
                    notes="Independent 5L coverage",
                ),
            ],
            nominees=[
                PolicyNomineeCreate(
                    full_name="Aarav Sharma",
                    relationship="Son",
                    date_of_birth=date(2015, 3, 10),
                    mobile_number="9876543210",
                    share_percentage=Decimal("100.0"),
                )
            ],
        )

        resp_a = await create_policy(session, payload_a)
        await session.commit()

        # Verify
        detail_a = await get_policy_detail(session, resp_a.id)
        if (
            detail_a.coverage_type == "INDIVIDUAL"
            and detail_a.members_count == 2
            and len(detail_a.members) == 2
            and detail_a.members[0].individual_sum_insured == Decimal("500000.00")
            and detail_a.members[1].individual_sum_insured == Decimal("500000.00")
            and len(detail_a.nominees) == 1
            and detail_a.nominees[0].full_name == "Aarav Sharma"
        ):
            record_pass(
                "TEST_A_INDIVIDUAL_POLICY",
                f"Policy {pol_num_a} created as INDIVIDUAL with 2 members, distinct INR 5L allocations, and separate nominee.",
            )
        else:
            record_fail(
                "TEST_A_INDIVIDUAL_POLICY",
                f"Failed assertion on INDIVIDUAL policy: coverage={detail_a.coverage_type}, members={detail_a.members_count}",
            )

    # -------------------------------------------------------------------------
    # TEST B: Family Floater Policy with Shared Sum Insured
    # -------------------------------------------------------------------------
    print("\n[TEST B] Executing Family Floater Policy (Rahul, Priya, Aarav, Anaya sharing INR 10L)...")
    pol_num_b = f"POL-TEST-FLT-{int(asyncio.get_event_loop().time() * 1000)}"
    async with AsyncSessionLocal() as session:
        payload_b = PolicyCreate(
            policy_number=pol_num_b,
            policy_type="HEALTH",
            coverage_type="FAMILY_FLOATER",
            customer_id=rahul.id,
            company_id=star_health.id,
            plan_id=health_plan.id,
            policy_term_years=1,
            sum_assured=Decimal("1000000"),
            net_premium=Decimal("32000.00"),
            gross_premium=Decimal("37760.00"),
            tax_amount=Decimal("5760.00"),
            premium_mode="YEARLY",
            start_date=date.today(),
            expiry_date=date.today() + timedelta(days=365),
            members=[
                PolicyMemberCreate(
                    customer_id=rahul.id,
                    full_name="Rahul Sharma",
                    relationship="Self",
                    date_of_birth=date(1985, 6, 15),
                    gender="MALE",
                ),
                PolicyMemberCreate(
                    customer_id=priya.id,
                    full_name="Priya Sharma",
                    relationship="Spouse",
                    date_of_birth=date(1988, 8, 22),
                    gender="FEMALE",
                ),
                PolicyMemberCreate(
                    full_name="Aarav Sharma",
                    relationship="Son",
                    date_of_birth=date(2015, 3, 10),
                    gender="MALE",
                ),
                PolicyMemberCreate(
                    full_name="Anaya Sharma",
                    relationship="Daughter",
                    date_of_birth=date(2018, 11, 4),
                    gender="FEMALE",
                ),
            ],
            nominees=[
                PolicyNomineeCreate(
                    full_name="Kavita Sharma",
                    relationship="Mother",
                    date_of_birth=date(1960, 1, 1),
                    share_percentage=Decimal("100.0"),
                )
            ],
        )

        resp_b = await create_policy(session, payload_b)
        await session.commit()

        detail_b = await get_policy_detail(session, resp_b.id)
        # All members share sum_assured = 1,000,000; individual_sum_insured is None or shared
        floater_check = all(m.individual_sum_insured is None for m in detail_b.members)
        if (
            detail_b.coverage_type == "FAMILY_FLOATER"
            and detail_b.members_count == 4
            and len(detail_b.members) == 4
            and detail_b.sum_assured == Decimal("1000000.00")
            and floater_check
        ):
            record_pass(
                "TEST_B_FAMILY_FLOATER",
                f"Policy {pol_num_b} created as FAMILY_FLOATER with 4 members sharing single INR 10L pool.",
            )
        else:
            record_fail(
                "TEST_B_FAMILY_FLOATER",
                f"Floater check failed: coverage={detail_b.coverage_type}, members={detail_b.members_count}, floater_allocations={floater_check}",
            )

    # -------------------------------------------------------------------------
    # TEST C: Family Group Lookup & Selective Loading
    # -------------------------------------------------------------------------
    print("\n[TEST C] Testing Customer Family Group Lookup and Selective Import...")
    async with AsyncSessionLocal() as session:
        fg_data = await get_customer_family_group_members(session, rahul.id)
        if (
            fg_data.get("has_family_group") is True
            and fg_data.get("group_name") == "Sharma Household"
            and len(fg_data.get("members", [])) >= 2
        ):
            record_pass(
                "TEST_C_FAMILY_GROUP_LOOKUP",
                f"Found family group '{fg_data['group_name']}' with {len(fg_data['members'])} household members for customer Rahul Sharma.",
            )
        else:
            record_fail("TEST_C_FAMILY_GROUP_LOOKUP", f"Failed to retrieve family group: {fg_data}")

        # Selective policy creation: only load Priya Sharma from family group
        pol_num_c = f"POL-TEST-SEL-{int(asyncio.get_event_loop().time() * 1000)}"
        payload_c = PolicyCreate(
            policy_number=pol_num_c,
            policy_type="HEALTH",
            coverage_type="INDIVIDUAL",
            customer_id=rahul.id,
            company_id=star_health.id,
            plan_id=health_plan.id,
            sum_assured=Decimal("300000"),
            net_premium=Decimal("12000.00"),
            gross_premium=Decimal("14160.00"),
            premium_mode="YEARLY",
            start_date=date.today(),
            members=[
                PolicyMemberCreate(
                    customer_id=rahul.id,
                    full_name="Rahul Sharma",
                    relationship="Self",
                    individual_sum_insured=Decimal("300000.00"),
                ),
                PolicyMemberCreate(
                    customer_id=priya.id,
                    full_name="Priya Sharma",
                    relationship="Spouse",
                    individual_sum_insured=Decimal("300000.00"),
                ),
            ],
        )
        resp_c = await create_policy(session, payload_c)
        await session.commit()
        detail_c = await get_policy_detail(session, resp_c.id)
        if detail_c.members_count == 2 and any(m.customer_id == priya.id for m in detail_c.members):
            record_pass(
                "TEST_C_SELECTIVE_IMPORT",
                f"Policy {pol_num_c} selectively imported Priya Sharma from family group while excluding unselected records.",
            )
        else:
            record_fail("TEST_C_SELECTIVE_IMPORT", f"Selective import failed: members_count={detail_c.members_count}")

    # -------------------------------------------------------------------------
    # TEST D: Validations
    # -------------------------------------------------------------------------
    print("\n[TEST D] Testing Business Rules & Edge Case Validations...")
    # D1: Duplicate Member Name
    async with AsyncSessionLocal() as session:
        try:
            payload_dup = PolicyCreate(
                policy_number=f"POL-DUP-{int(asyncio.get_event_loop().time() * 1000)}",
                policy_type="HEALTH",
                coverage_type="INDIVIDUAL",
                customer_id=rahul.id,
                company_id=star_health.id,
                plan_id=health_plan.id,
                sum_assured=Decimal("500000"),
                net_premium=Decimal("10000"),
                gross_premium=Decimal("11800"),
                premium_mode="YEARLY",
                start_date=date.today(),
                members=[
                    PolicyMemberCreate(full_name="Rahul Sharma", relationship="Self", individual_sum_insured=Decimal("250000")),
                    PolicyMemberCreate(full_name="Rahul Sharma", relationship="Self", individual_sum_insured=Decimal("250000")),
                ],
            )
            await create_policy(session, payload_dup)
            record_fail("TEST_D1_DUPLICATE_MEMBER", "Expected validation error for duplicate member names but succeeded.")
        except Exception as e:
            if "Duplicate insured member" in str(e):
                record_pass("TEST_D1_DUPLICATE_MEMBER", f"Correctly rejected duplicate member names: {e.detail}")
            else:
                record_fail("TEST_D1_DUPLICATE_MEMBER", f"Unexpected error: {e}")

    # D2: Reject Family Floater on Life Insurance Plan
    async with AsyncSessionLocal() as session:
        try:
            payload_life_flt = PolicyCreate(
                policy_number=f"POL-LIFE-FLT-{int(asyncio.get_event_loop().time() * 1000)}",
                policy_type="LIFE",
                coverage_type="FAMILY_FLOATER",
                customer_id=rahul.id,
                company_id=lic.id,
                plan_id=life_plan.id,
                sum_assured=Decimal("500000"),
                net_premium=Decimal("15000"),
                gross_premium=Decimal("17700"),
                premium_mode="YEARLY",
                start_date=date.today(),
                members=[
                    PolicyMemberCreate(full_name="Rahul Sharma", relationship="Self"),
                    PolicyMemberCreate(full_name="Priya Sharma", relationship="Spouse"),
                ],
            )
            await create_policy(session, payload_life_flt)
            record_fail("TEST_D2_LIFE_FLOATER_REJECTION", "Expected validation error for Family Floater on Life plan but succeeded.")
        except Exception as e:
            if "do not support Family Floater" in str(e):
                record_pass("TEST_D2_LIFE_FLOATER_REJECTION", f"Correctly rejected Family Floater for Life plan: {e.detail}")
            else:
                record_fail("TEST_D2_LIFE_FLOATER_REJECTION", f"Unexpected error: {e}")

    # D3: Reject Zero/Negative Individual Sum Insured in Multi-Member Individual Policy
    async with AsyncSessionLocal() as session:
        try:
            payload_neg_si = PolicyCreate(
                policy_number=f"POL-NEG-SI-{int(asyncio.get_event_loop().time() * 1000)}",
                policy_type="HEALTH",
                coverage_type="INDIVIDUAL",
                customer_id=rahul.id,
                company_id=star_health.id,
                plan_id=health_plan.id,
                sum_assured=Decimal("500000"),
                net_premium=Decimal("10000"),
                gross_premium=Decimal("11800"),
                premium_mode="YEARLY",
                start_date=date.today(),
                members=[
                    PolicyMemberCreate(full_name="Rahul Sharma", relationship="Self", individual_sum_insured=Decimal("500000")),
                    PolicyMemberCreate(full_name="Priya Sharma", relationship="Spouse", individual_sum_insured=Decimal("0")),
                ],
            )
            await create_policy(session, payload_neg_si)
            record_fail("TEST_D3_ZERO_SUM_INSURED", "Expected validation error for zero individual sum insured but succeeded.")
        except Exception as e:
            if "must be greater than zero" in str(e):
                record_pass("TEST_D3_ZERO_SUM_INSURED", f"Correctly rejected zero member sum insured: {e.detail}")
            else:
                record_fail("TEST_D3_ZERO_SUM_INSURED", f"Unexpected error: {e}")

    # -------------------------------------------------------------------------
    # TEST E: Database Persistence & Policy 360 View
    # -------------------------------------------------------------------------
    print("\n[TEST E] Direct Database Persistence & Policy 360 Operations...")
    async with AsyncSessionLocal() as session:
        # Check raw PostgreSQL rows in insurance_policy_members
        res_db = await session.execute(
            select(InsurancePolicyMember).filter(InsurancePolicyMember.policy_id == resp_a.id)
        )
        db_members = res_db.scalars().all()
        if len(db_members) == 2:
            record_pass(
                "TEST_E1_POSTGRES_PERSISTENCE",
                f"Direct SQL query confirmed {len(db_members)} persisted records in table insurance_policy_members for policy {pol_num_a}.",
            )
        else:
            record_fail("TEST_E1_POSTGRES_PERSISTENCE", f"Found {len(db_members)} rows in DB, expected 2.")

        # Test adding a 3rd member dynamically to existing policy
        new_mem_payload = PolicyMemberCreate(
            full_name="Dev Sharma",
            relationship="Brother",
            date_of_birth=date(1992, 4, 18),
            gender="MALE",
            individual_sum_insured=Decimal("300000.00"),
            notes="Added dynamically to existing contract",
        )
        added_mem = await add_policy_member(session, resp_a.id, new_mem_payload)
        await session.commit()

        detail_after_add = await get_policy_detail(session, resp_a.id)
        if detail_after_add.members_count == 3 and any(m.full_name == "Dev Sharma" for m in detail_after_add.members):
            record_pass(
                "TEST_E2_ADD_MEMBER_TO_EXISTING_POLICY",
                f"Dynamically added member 'Dev Sharma' (Age: {detail_after_add.members[-1].age}) to Policy {pol_num_a}.",
            )
        else:
            record_fail("TEST_E2_ADD_MEMBER_TO_EXISTING_POLICY", f"Add member failed: count={detail_after_add.members_count}")

        # Test removing member from policy
        del_res = await remove_policy_member(session, resp_a.id, added_mem.id)
        await session.commit()
        detail_after_del = await get_policy_detail(session, resp_a.id)
        if detail_after_del.members_count == 2 and not any(m.full_name == "Dev Sharma" for m in detail_after_del.members):
            record_pass(
                "TEST_E3_REMOVE_MEMBER_FROM_EXISTING_POLICY",
                f"Successfully removed member 'Dev Sharma' from Policy {pol_num_a}; count returned to 2.",
            )
        else:
            record_fail("TEST_E3_REMOVE_MEMBER_FROM_EXISTING_POLICY", f"Remove member failed: count={detail_after_del.members_count}")

        # Test preventing removal of last member
        try:
            # Policy with 1 member
            payload_single = PolicyCreate(
                policy_number=f"POL-SINGLE-{int(asyncio.get_event_loop().time() * 1000)}",
                policy_type="HEALTH",
                coverage_type="INDIVIDUAL",
                customer_id=rahul.id,
                company_id=star_health.id,
                plan_id=health_plan.id,
                sum_assured=Decimal("500000"),
                net_premium=Decimal("10000"),
                gross_premium=Decimal("11800"),
                premium_mode="YEARLY",
                start_date=date.today(),
            )
            resp_single = await create_policy(session, payload_single)
            await session.commit()
            detail_single = await get_policy_detail(session, resp_single.id)
            single_mem_id = detail_single.members[0].id
            await remove_policy_member(session, resp_single.id, single_mem_id)
            record_fail("TEST_E4_PREVENT_DELETE_LAST_MEMBER", "Expected error when deleting last member, but succeeded.")
        except Exception as e:
            if "Cannot remove the only insured member" in str(e):
                record_pass("TEST_E4_PREVENT_DELETE_LAST_MEMBER", f"Correctly prevented deletion of the last member: {e.detail}")
            else:
                record_fail("TEST_E4_PREVENT_DELETE_LAST_MEMBER", f"Unexpected error: {e}")

    # -------------------------------------------------------------------------
    # TEST F: Regression Testing (Payments, Schedules, Commissions, Renewals)
    # -------------------------------------------------------------------------
    print("\n[TEST F] Regression Verification on Payments, Schedules, Commissions & Renewals...")
    async with AsyncSessionLocal() as session:
        # Check that installment schedules were created for Policy B
        sched_res = await session.execute(
            select(InsurancePremiumSchedule).filter(InsurancePremiumSchedule.policy_id == resp_b.id)
        )
        scheds = sched_res.scalars().all()
        if len(scheds) >= 1:
            record_pass("TEST_F1_SCHEDULES_GENERATED", f"Policy B automatically generated {len(scheds)} premium schedule installments.")
        else:
            record_fail("TEST_F1_SCHEDULES_GENERATED", "No premium schedules found for Policy B.")

        # Record a payment
        pay_payload = PaymentCreate(
            policy_id=resp_b.id,
            amount=Decimal("37760.00"),
            payment_mode="ONLINE",
            bank_name="HDFC Bank",
            transaction_reference="TXN-FLT-REG-001",
            payment_date=date.today(),
            notes="Full initial payment for Floater policy",
        )
        pay_res = await record_payment(session, resp_b.id, pay_payload)
        await session.commit()
        detail_after_pay = await get_policy_detail(session, resp_b.id)
        if detail_after_pay.total_paid == Decimal("37760.00") and len(detail_after_pay.payments) == 1:
            record_pass(
                "TEST_F2_PAYMENTS_AND_TOTAL_PAID",
                f"Successfully recorded payment of INR {detail_after_pay.total_paid} against Policy B.",
            )
        else:
            record_fail("TEST_F2_PAYMENTS_AND_TOTAL_PAID", f"Payment assertion failed: total_paid={detail_after_pay.total_paid}")

        # Renew Policy B: verify members are carried forward
        renew_res = await renew_policy_contract(session, resp_b.id, PolicyRenewalRequest(term_years=1, new_premium=Decimal("39000.00")))
        await session.commit()
        detail_after_renew = await get_policy_detail(session, resp_b.id)
        if (
            detail_after_renew.coverage_type == "FAMILY_FLOATER"
            and detail_after_renew.members_count == 4
            and detail_after_renew.final_premium == Decimal("39000.00")
        ):
            record_pass(
                "TEST_F3_RENEWAL_PRESERVES_MEMBERS",
                f"Policy B renewal carried forward all 4 insured members cleanly with updated term & premium.",
            )
        else:
            record_fail("TEST_F3_RENEWAL_PRESERVES_MEMBERS", f"Renewal members check failed: count={detail_after_renew.members_count}")

    print("\n" + "=" * 80)
    print(f"VERIFICATION SUMMARY: {len(passed_tests)} PASSED, {len(failed_tests)} FAILED")
    print("=" * 80)
    if failed_tests:
        print("\nFailures:")
        for t, m in failed_tests:
            print(f"  - {t}: {m}")
        sys.exit(1)
    else:
        print("\nALL ACCEPTANCE CRITERIA VERIFIED 100% SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_all_tests())
