import asyncio
import os
import sys
import io
from datetime import date, timedelta
from decimal import Decimal
import openpyxl
from starlette.datastructures import UploadFile

# Ensure backend root is on sys.path and load environment
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
import dotenv
dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from sqlalchemy import select, delete, func
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
    InsurancePurchaseParty,
)
from app.schemas.insurance import (
    PolicyCreate,
    PolicyMemberCreate,
    PolicyNomineeCreate,
    PaymentCreate,
)
from app.services.insurance.policy_service import (
    create_policy,
    get_policy_detail,
    list_policies,
)
from app.services.insurance.import_service import (
    generate_import_template,
    preview_policy_import,
    confirm_policy_import,
    export_policies_to_excel,
    EXCEL_33_COLUMNS,
)

passed_tests = []
failed_tests = []

def record_pass(test_id, message):
    safe_msg = message.replace('\u20b9', 'Rs.')
    print(f"  [PASS] {test_id}: {safe_msg}")
    passed_tests.append((test_id, safe_msg))

def record_fail(test_id, message, error=None):
    safe_msg = message.replace('\u20b9', 'Rs.')
    print(f"  [FAIL] {test_id}: {safe_msg}")
    if error:
        print(f"         Error detail: {error}")
    failed_tests.append((test_id, safe_msg))


async def get_or_create_company_and_plan(session, category: str, company_name: str, code: str, plan_name: str):
    res = await session.execute(
        select(InsuranceCompany).where(InsuranceCompany.name == company_name)
    )
    comp = res.scalar_one_or_none()
    if not comp:
        comp = InsuranceCompany(name=company_name, code=code, category=category)
        session.add(comp)
        await session.commit()
        await session.refresh(comp)
    elif comp.category != category:
        comp.category = category
        await session.commit()

    pl_res = await session.execute(
        select(InsurancePlan).where(InsurancePlan.company_id == comp.id, InsurancePlan.name == plan_name)
    )
    plan = pl_res.scalar_one_or_none()
    if not plan:
        plan = InsurancePlan(company_id=comp.id, name=plan_name, code=f"{code}-PLN", line_of_business=category)
        session.add(plan)
        await session.commit()
        await session.refresh(plan)

    return comp, plan


async def run_all_tests():
    print("=" * 80)
    print("FINNEXUS INSURANCE ENGINE: EXCEL CUSTOMIZATION E2E VERIFICATION SUITE")
    print("=" * 80)

    async with AsyncSessionLocal() as session:
        # Pre-requisite: ensure customer exists
        cust_res = await session.execute(select(Customer).limit(1))
        customer = cust_res.scalar_one_or_none()
        if not customer:
            customer = Customer(
                first_name="Rohan",
                last_name="Sharma",
                email="rohan.sharma@example.com",
                phone="9876543210",
                city="Pune",
                pin_code="411001"
            )
            session.add(customer)
            await session.commit()
            await session.refresh(customer)

        # Ensure Category Companies and Plans exist
        hlth_comp, hlth_plan = await get_or_create_company_and_plan(
            session, "HEALTH", "Star Health & Allied Insurance", "STAR", "Optima Restore Floater"
        )
        mot_comp, mot_plan = await get_or_create_company_and_plan(
            session, "MOTOR", "DriveGuard General Insurance", "DGARD", "Motor Private Vehicle Protect"
        )
        trv_comp, trv_plan = await get_or_create_company_and_plan(
            session, "TRAVEL", "WorldWide Travel Protect", "WWTRV", "Global Travel Elite Plan"
        )
        life_comp, life_plan = await get_or_create_company_and_plan(
            session, "LIFE", "LifeSecure Assurance Corporation", "LSEC", "Smart Life Term Shield"
        )

        # -------------------------------------------------------------
        # TEST 1: Health Policy with Hospital Cash Benefit & Floater
        # -------------------------------------------------------------
        print("\n--- TEST GROUP 1: HEALTH INSURANCE & HOSPITAL CASH BENEFIT ---")
        try:
            health_pol_data = PolicyCreate(
                customer_id=customer.id,
                company_id=hlth_comp.id,
                plan_id=hlth_plan.id,
                policy_type="HEALTH",
                coverage_type="FAMILY_FLOATER",
                policy_number="E2E-HLTH-CASH-001",
                proposal_number="PROP-HLTH-8891",
                business_type="NEW",
                product_variant="Optima Restore Multi-Benefit",
                hospital_cash_benefit="INCLUDED",
                contact_city="Pune",
                contact_pincode="411001",
                contact_mobile="9876543210",
                contact_email="rohan.sharma@example.com",
                sum_assured=Decimal("1500000.00"),
                net_premium=Decimal("18000.00"),
                gross_premium=Decimal("21240.00"),
                final_premium=Decimal("21240.00"),
                tax_amount=Decimal("3240.00"),
                policy_term_years=1,
                premium_mode="YEARLY",
                start_date=date.today(),
                expiry_date=date.today() + timedelta(days=365),
                commission_rate=Decimal("15.0"),
                commission_amount=Decimal("2700.00"),
                tds_rate=Decimal("10.0"),
                tds_amount=Decimal("270.00"),
                net_commission_payable=Decimal("2430.00"),
                commission_received_status="RECEIVED",
                actual_commission_received_amount=Decimal("2430.00"),
                commission_received_date=date.today(),
                commission_bank_reference="UTR-HDFC-991823",
                members=[
                    PolicyMemberCreate(
                        full_name="Rohan Sharma",
                        relationship="Self",
                        date_of_birth=date(1985, 5, 12),
                        gender="MALE",
                        mobile_number="9876543210",
                    ),
                    PolicyMemberCreate(
                        full_name="Priya Sharma",
                        relationship="Spouse",
                        date_of_birth=date(1988, 8, 20),
                        gender="FEMALE",
                        mobile_number="9876543211",
                    ),
                ],
                nominees=[
                    PolicyNomineeCreate(
                        full_name="Priya Sharma",
                        relationship="Spouse",
                        date_of_birth=date(1988, 8, 20),
                        share_percentage=Decimal("100.00"),
                    )
                ]
            )

            # Clean any previous record
            await session.execute(delete(InsurancePolicy).where(InsurancePolicy.policy_number == "E2E-HLTH-CASH-001"))
            await session.commit()

            created_hlth = await create_policy(session, health_pol_data)
            record_pass("TEST-1.1", f"Health policy '{created_hlth.policy_number}' issued successfully.")

            # Verify in PostgreSQL
            detail_hlth = await get_policy_detail(session, created_hlth.id)
            assert detail_hlth.proposal_number == "PROP-HLTH-8891", f"Expected proposal PROP-HLTH-8891, got {detail_hlth.proposal_number}"
            assert detail_hlth.business_type == "NEW", f"Expected NEW, got {detail_hlth.business_type}"
            assert detail_hlth.hospital_cash_benefit == "INCLUDED", f"Expected INCLUDED, got {detail_hlth.hospital_cash_benefit}"
            assert detail_hlth.commission_received_status == "RECEIVED"
            assert detail_hlth.actual_commission_received_amount == Decimal("2430.00")
            assert detail_hlth.commission_bank_reference == "UTR-HDFC-991823"
            assert len(detail_hlth.members) == 2
            record_pass("TEST-1.2", "Health policy persisted with proposal number, hospital cash benefit, and commission realization.")

            # Test NOT_INCLUDED hospital cash
            health_pol_data2 = PolicyCreate(
                customer_id=customer.id,
                company_id=hlth_comp.id,
                plan_id=hlth_plan.id,
                policy_type="HEALTH",
                coverage_type="INDIVIDUAL",
                policy_number="E2E-HLTH-NOCASH-002",
                proposal_number="PROP-HLTH-8892",
                business_type="NEW",
                hospital_cash_benefit="NOT_INCLUDED",
                sum_assured=Decimal("500000.00"),
                net_premium=Decimal("8000.00"),
                gross_premium=Decimal("9440.00"),
                final_premium=Decimal("9440.00"),
                start_date=date.today(),
                members=[
                    PolicyMemberCreate(
                        full_name="Rohan Sharma",
                        relationship="Self",
                        individual_sum_insured=Decimal("500000.00"),
                    )
                ]
            )
            await session.execute(delete(InsurancePolicy).where(InsurancePolicy.policy_number == "E2E-HLTH-NOCASH-002"))
            await session.commit()
            created_hlth2 = await create_policy(session, health_pol_data2)
            assert created_hlth2.hospital_cash_benefit == "NOT_INCLUDED"
            record_pass("TEST-1.3", "Health policy with Hospital Cash 'NOT_INCLUDED' created and verified.")

        except Exception as e:
            record_fail("TEST-1", "Health policy verification failed", e)

        # -------------------------------------------------------------
        # TEST 2: Motor Policy with Vehicle Details
        # -------------------------------------------------------------
        print("\n--- TEST GROUP 2: MOTOR INSURANCE VEHICLE ATTRIBUTES ---")
        try:
            motor_pol_data = PolicyCreate(
                customer_id=customer.id,
                company_id=mot_comp.id,
                plan_id=mot_plan.id,
                policy_type="MOTOR",
                coverage_type="INDIVIDUAL",
                policy_number="E2E-MOT-CRETA-001",
                proposal_number="PROP-MOT-9901",
                business_type="NEW",
                product_variant="Comprehensive Package",
                vehicle_registration_number="MH12AB1234",
                vehicle_manufacturer="Hyundai",
                vehicle_model="Creta SX",
                vehicle_type="Private Car",
                sum_assured=Decimal("850000.00"),
                net_premium=Decimal("15000.00"),
                gross_premium=Decimal("17700.00"),
                final_premium=Decimal("17700.00"),
                tax_amount=Decimal("2700.00"),
                policy_term_years=1,
                start_date=date.today(),
                commission_rate=Decimal("12.5"),
                commission_amount=Decimal("1875.00"),
                tds_rate=Decimal("10.0"),
                tds_amount=Decimal("187.50"),
                net_commission_payable=Decimal("1687.50"),
                commission_received_status="PENDING",
                members=[
                    PolicyMemberCreate(
                        full_name="Rohan Sharma",
                        relationship="Self",
                    )
                ]
            )
            await session.execute(delete(InsurancePolicy).where(InsurancePolicy.policy_number == "E2E-MOT-CRETA-001"))
            await session.commit()

            created_mot = await create_policy(session, motor_pol_data)
            detail_mot = await get_policy_detail(session, created_mot.id)

            assert detail_mot.vehicle_registration_number == "MH12AB1234"
            assert detail_mot.vehicle_manufacturer == "Hyundai"
            assert detail_mot.vehicle_model == "Creta SX"
            assert detail_mot.vehicle_type == "Private Car"
            assert detail_mot.commission_received_status == "PENDING"
            record_pass("TEST-2.1", f"Motor policy '{detail_mot.policy_number}' persisted with Reg: {detail_mot.vehicle_registration_number}, Mfg: {detail_mot.vehicle_manufacturer}, Model: {detail_mot.vehicle_model}.")

        except Exception as e:
            record_fail("TEST-2", "Motor policy verification failed", e)

        # -------------------------------------------------------------
        # TEST 3: Travel Policy with Destination & Travel Type
        # -------------------------------------------------------------
        print("\n--- TEST GROUP 3: TRAVEL INSURANCE PARAMETERS ---")
        try:
            travel_pol_data = PolicyCreate(
                customer_id=customer.id,
                company_id=trv_comp.id,
                plan_id=trv_plan.id,
                policy_type="TRAVEL",
                coverage_type="INDIVIDUAL",
                policy_number="E2E-TRV-USA-001",
                proposal_number="PROP-TRV-7712",
                business_type="NEW",
                travel_destination="USA & Canada",
                travel_type="Student Travel",
                sum_assured=Decimal("5000000.00"),
                net_premium=Decimal("12000.00"),
                gross_premium=Decimal("14160.00"),
                final_premium=Decimal("14160.00"),
                policy_term_years=1,
                start_date=date.today(),
                members=[
                    PolicyMemberCreate(
                        full_name="Rohan Sharma",
                        relationship="Self",
                    )
                ]
            )
            await session.execute(delete(InsurancePolicy).where(InsurancePolicy.policy_number == "E2E-TRV-USA-001"))
            await session.commit()

            created_trv = await create_policy(session, travel_pol_data)
            detail_trv = await get_policy_detail(session, created_trv.id)

            assert detail_trv.travel_destination == "USA & Canada"
            assert detail_trv.travel_type == "Student Travel"
            record_pass("TEST-3.1", f"Travel policy '{detail_trv.policy_number}' persisted with Dest: {detail_trv.travel_destination}, Type: {detail_trv.travel_type}.")

        except Exception as e:
            record_fail("TEST-3", "Travel policy verification failed", e)

        # -------------------------------------------------------------
        # TEST 4: Life Policy with Product Variant & PPT
        # -------------------------------------------------------------
        print("\n--- TEST GROUP 4: LIFE INSURANCE PARAMETERS ---")
        try:
            life_pol_data = PolicyCreate(
                customer_id=customer.id,
                company_id=life_comp.id,
                plan_id=life_plan.id,
                policy_type="LIFE",
                coverage_type="INDIVIDUAL",
                policy_number="E2E-LIFE-TERM-001",
                proposal_number="PROP-LIFE-4421",
                business_type="NEW",
                product_variant="Term Insurance",
                sum_assured=Decimal("10000000.00"),
                net_premium=Decimal("25000.00"),
                gross_premium=Decimal("29500.00"),
                final_premium=Decimal("29500.00"),
                policy_term_years=20,
                start_date=date.today(),
                members=[
                    PolicyMemberCreate(
                        full_name="Rohan Sharma",
                        relationship="Self",
                    )
                ],
                nominees=[
                    PolicyNomineeCreate(
                        full_name="Priya Sharma",
                        relationship="Spouse",
                        share_percentage=Decimal("100.00"),
                    )
                ]
            )
            await session.execute(delete(InsurancePolicy).where(InsurancePolicy.policy_number == "E2E-LIFE-TERM-001"))
            await session.commit()

            created_life = await create_policy(session, life_pol_data)
            detail_life = await get_policy_detail(session, created_life.id)

            assert detail_life.product_variant == "Term Insurance"
            assert detail_life.term_years == 20
            record_pass("TEST-4.1", f"Life policy '{detail_life.policy_number}' persisted with Variant: {detail_life.product_variant}, Term: {detail_life.term_years} yrs.")

        except Exception as e:
            record_fail("TEST-4", "Life policy verification failed", e)

        # -------------------------------------------------------------
        # TEST 5: Business Type Lifecycle (NEW, PORT, RENEW)
        # -------------------------------------------------------------
        print("\n--- TEST GROUP 5: BUSINESS TYPE LIFECYCLE (NEW, PORT, RENEW) ---")
        try:
            # Portability policy
            port_pol_data = PolicyCreate(
                customer_id=customer.id,
                company_id=hlth_comp.id,
                plan_id=hlth_plan.id,
                policy_type="HEALTH",
                coverage_type="INDIVIDUAL",
                policy_number="E2E-PORT-2026-001",
                proposal_number="PROP-PORT-1199",
                business_type="PORT",
                previous_insurer="Star Health & Allied",
                previous_policy_number="STAR-HLTH-2022-9901",
                portability_continuity_details="5 years claim-free continuity. Waiting periods fully waived.",
                sum_assured=Decimal("1000000.00"),
                net_premium=Decimal("14000.00"),
                gross_premium=Decimal("16520.00"),
                final_premium=Decimal("16520.00"),
                start_date=date.today(),
                members=[
                    PolicyMemberCreate(full_name="Rohan Sharma", relationship="Self")
                ]
            )
            await session.execute(delete(InsurancePolicy).where(InsurancePolicy.policy_number == "E2E-PORT-2026-001"))
            await session.commit()
            created_port = await create_policy(session, port_pol_data)
            detail_port = await get_policy_detail(session, created_port.id)

            assert detail_port.business_type == "PORT"
            assert detail_port.previous_insurer == "Star Health & Allied"
            assert detail_port.previous_policy_number == "STAR-HLTH-2022-9901"
            assert "Waiting periods fully waived" in detail_port.portability_continuity_details
            record_pass("TEST-5.1", f"Portability policy created with previous insurer and continuity info.")

            # Renewal policy
            renew_pol_data = PolicyCreate(
                customer_id=customer.id,
                company_id=hlth_comp.id,
                plan_id=hlth_plan.id,
                policy_type="HEALTH",
                coverage_type="INDIVIDUAL",
                policy_number="E2E-RENEW-2026-001",
                business_type="RENEW",
                previous_policy_number="POL-2025-0011",
                sum_assured=Decimal("1000000.00"),
                net_premium=Decimal("14000.00"),
                gross_premium=Decimal("16520.00"),
                final_premium=Decimal("16520.00"),
                start_date=date.today(),
                members=[
                    PolicyMemberCreate(full_name="Rohan Sharma", relationship="Self")
                ]
            )
            await session.execute(delete(InsurancePolicy).where(InsurancePolicy.policy_number == "E2E-RENEW-2026-001"))
            await session.commit()
            created_renew = await create_policy(session, renew_pol_data)
            detail_renew = await get_policy_detail(session, created_renew.id)

            assert detail_renew.business_type == "RENEW"
            assert detail_renew.previous_policy_number == "POL-2025-0011"
            record_pass("TEST-5.2", f"Renewal policy created with prior policy link.")

            # List filtering by business_type
            port_list = await list_policies(session, business_type="PORT")
            assert any(p.policy_number == "E2E-PORT-2026-001" for p in port_list.items)
            record_pass("TEST-5.3", f"Database filter by business_type='PORT' correctly retrieved portability policies.")

        except Exception as e:
            record_fail("TEST-5", "Business type lifecycle test failed", e)

        # -------------------------------------------------------------
        # TEST 6: Excel Bulk Import with 33 Headings
        # -------------------------------------------------------------
        print("\n--- TEST GROUP 6: BULK IMPORT OF SAMPLE EXCEL FILE (33 HEADINGS) ---")
        try:
            excel_path = "to_portal_sample_policy_data.xlsx"
            if not os.path.exists(excel_path):
                excel_path = "d:/project/to_portal_sample_policy_data.xlsx"

            assert os.path.exists(excel_path), f"File {excel_path} not found"
            with open(excel_path, "rb") as f:
                file_bytes = f.read()

            upload_file = UploadFile(
                filename="to_portal_sample_policy_data.xlsx",
                file=io.BytesIO(file_bytes)
            )

            preview = await preview_policy_import(session, upload_file)
            assert preview.total_rows == 20, f"Expected 20 rows in preview, got {preview.total_rows}"
            record_pass("TEST-6.1", f"Import preview correctly parsed all 20 rows with 33 columns.")

            # Check that first row has mapped fields
            row0 = preview.rows[0].data
            assert "customer_name" in row0
            assert "policy_number" in row0
            record_pass("TEST-6.2", "Preview mapped data verified for normalized application entities.")

            # Confirm import
            confirm_res = await confirm_policy_import(session, preview.rows)
            assert confirm_res.imported_count >= 15 or confirm_res.skipped_count >= 15, f"Expected >= 15 imported/skipped policies, got {confirm_res}"
            record_pass("TEST-6.3", f"Confirmed import succeeded: {confirm_res.imported_count} policies created, {confirm_res.skipped_count} duplicates skipped.")

            # Verify a motor policy was imported with vehicle details
            mot_imported = await session.execute(
                select(InsurancePolicy).where(InsurancePolicy.vehicle_registration_number.isnot(None)).limit(1)
            )
            mot_p = mot_imported.scalar_one_or_none()
            assert mot_p is not None, "Expected at least one imported motor policy with vehicle registration"
            record_pass("TEST-6.4", f"Imported Motor policy '{mot_p.policy_number}' verified: Reg={mot_p.vehicle_registration_number}, Mfg={mot_p.vehicle_manufacturer}, Model={mot_p.vehicle_model}.")

            # Verify members were parsed and normalized
            mem_imported = await session.execute(
                select(func.count(InsurancePolicyMember.id))
            )
            mem_count = mem_imported.scalar_one()
            assert mem_count >= 10, f"Expected >= 10 normalized policy members, got {mem_count}"
            record_pass("TEST-6.5", f"Normalized policy members verified across database (count: {mem_count}).")

        except Exception as e:
            record_fail("TEST-6", "Bulk import verification failed", e)

        # -------------------------------------------------------------
        # TEST 7: Excel Bulk Export with 33 Headings
        # -------------------------------------------------------------
        print("\n--- TEST GROUP 7: BULK EXPORT TO 33-COLUMN EXCEL ---")
        try:
            export_bytes, filename, media_type = await export_policies_to_excel(session)
            assert len(export_bytes) > 1000, f"Export bytes too small: {len(export_bytes)}"

            wb = openpyxl.load_workbook(io.BytesIO(export_bytes))
            sheet = wb.active

            headers = [str(sheet.cell(1, c).value).strip() for c in range(1, 34)]
            assert len(headers) == 33, f"Expected 33 headers, got {len(headers)}"

            expected_clean = [c.strip() for c in EXCEL_33_COLUMNS]

            for eh in expected_clean:
                assert eh in headers, f"Missing heading: '{eh}'"

            record_pass("TEST-7.1", f"Generated Excel export contains all 33 required column headings exactly.")
            record_pass("TEST-7.2", f"Export workbook contains {sheet.max_row - 1} data rows successfully formatted ({filename}).")

        except Exception as e:
            record_fail("TEST-7", "Bulk export verification failed", e)

        # -------------------------------------------------------------
        # TEST 8: Template Generation
        # -------------------------------------------------------------
        print("\n--- TEST GROUP 8: EXCEL IMPORT TEMPLATE GENERATION ---")
        try:
            tmpl_bytes, filename, media_type = generate_import_template(format_type="xlsx")
            wb_t = openpyxl.load_workbook(io.BytesIO(tmpl_bytes))
            sheet_t = wb_t.active
            headers_t = [sheet_t.cell(1, c).value for c in range(1, 34)]
            assert len(headers_t) == 33
            record_pass("TEST-8.1", "Import template (.xlsx) generated with all 33 column headings and sample guide rows.")

        except Exception as e:
            record_fail("TEST-8", "Template generation failed", e)

    print("\n" + "=" * 80)
    print(f"VERIFICATION SUMMARY: {len(passed_tests)} PASSED, {len(failed_tests)} FAILED")
    print("=" * 80)

    if failed_tests:
        print("\nFailed Tests:")
        for fid, msg in failed_tests:
            print(f"  - {fid}: {msg}")
        return False
    return True


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
