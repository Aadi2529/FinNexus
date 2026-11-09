"""Bulk Policy Import & Export Service for 33-Heading Excel and CSV Spreadsheets."""

from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.crm import Customer
from app.core.insurance_categories import (
    normalize_category_code,
    normalize_category_label,
    categories_match,
)
from app.db.models.insurance import (
    InsuranceCompany,
    InsuranceCompanyCategory,
    InsurancePlan,
    InsurancePolicy,
    InsurancePolicyMember,
    InsurancePurchaseParty,
    InsuranceSubAgent,
)
from app.schemas.insurance import (
    PolicyCreate,
    PolicyImportPreviewResponse,
    PolicyImportResult,
    PolicyImportRowPreview,
    PolicyMemberCreate,
)
from app.services.insurance.policy_service import create_policy

EXCEL_33_COLUMNS = [
    "POLICY HOLDER NAME",
    "PORT/NEW/ RENEW",
    "PIN CODE",
    "CITY",
    "PROPOSAL FORM",
    "POLICY NUMBER",
    "POLICY TYPE",
    "POLICY START DATE ",
    "POLICY END DATE",
    "GROSS PREMIUM (with Tax)",
    "NET PREMIUM(without Tax)",
    "COMMISION RATE",
    "COMMISION",
    "TDS",
    "NET COMMISION",
    "COMMISSION RECIVED",
    "BASE SUM INSURED ",
    "HOSPITAL CASH",
    "MEMBER 1",
    "MEMBER 1 DOB",
    "MEMBER 2",
    "MEMBER 2 DOB",
    "MEMBER 3",
    "MEMBER 3 DOB",
    "MEMBER 4",
    "MEMBER 4 DOB",
    "Registration No / Vehicle No",
    "Compay Name",
    "Model Name",
    "MOBILE NUMBER",
    "EMAIL ID",
    "COMPANY",
    "Intermediary Name",
]

SAMPLE_33_ROWS = [
    [
        "Aarav Thakur",
        "PORT",
        "431001",
        "Chhatrapati Sambhaji Nagar",
        "PROP-2026-501",
        "FF-HEA-2026-1001",
        "Health Insurance - Individual Health",
        "2026-05-06",
        "2027-05-05",
        "9676",
        "8200",
        "5.0%",
        "410",
        "20.5",
        "389.5",
        "Pending",
        "2500000",
        "Included",
        "Aarav Thakur",
        "2002-07-02",
        "Aarav Patil",
        "1978-04-17",
        "",
        "",
        "",
        "",
        "",
        "SafeLife Health Cover",
        "",
        "9193349856",
        "aarav.thakur1@example.com",
        "SafeLife Health Cover",
        "Summit Risk Advisors",
    ],
    [
        "Rahul More",
        "NEW",
        "411001",
        "Pune",
        "PROP-2026-511",
        "FF-MOT-2026-2001",
        "Motor Insurance - Private Car Comprehensive",
        "2026-03-01",
        "2027-02-28",
        "18500",
        "15678",
        "15.0%",
        "2351.7",
        "235.17",
        "2116.53",
        "Yes",
        "750000",
        "N/A",
        "Rahul More",
        "1990-05-12",
        "",
        "",
        "",
        "",
        "",
        "",
        "MH12AB1234",
        "Hyundai",
        "Creta SX",
        "9876543210",
        "rahul.more@example.com",
        "DriveGuard General Insurance",
        "PrimeCover Associates",
    ],
]


def _sanitize_formula(val: Any) -> str:
    """Protect against spreadsheet formula injection (=, +, -, @)."""
    s = str(val if val is not None else "").strip()
    if s.startswith(("=", "+", "-", "@")):
        return "'" + s
    return s


def _parse_date(val: Any) -> date | None:
    if not val:
        return None
    if isinstance(val, (datetime, date)):
        return val.date() if isinstance(val, datetime) else val
    s = str(val).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%d.%m.%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s.split("T")[0], fmt).date()
        except ValueError:
            continue
    return None


def _parse_decimal(val: Any, default: Decimal = Decimal("0.00")) -> Decimal:
    if val is None or val == "":
        return default
    if isinstance(val, (int, float, Decimal)):
        return Decimal(str(val))
    s = str(val).replace(",", "").replace("₹", "").replace("Rs.", "").replace("%", "").strip()
    try:
        return Decimal(s)
    except Exception:
        return default


def generate_import_template(format_type: str = "xlsx") -> tuple[bytes, str, str]:
    """Generate a downloadable sample template with all 33 Excel headings."""
    if format_type.lower() == "xlsx":
        try:
            import openpyxl
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Policy Import 33-Cols"
            ws.append(EXCEL_33_COLUMNS)
            for r in SAMPLE_33_ROWS:
                ws.append([_sanitize_formula(c) for c in r])
            buf = io.BytesIO()
            wb.save(buf)
            return (
                buf.getvalue(),
                "policy_import_template_33_headings.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        except ImportError:
            pass

    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(EXCEL_33_COLUMNS)
    for r in SAMPLE_33_ROWS:
        writer.writerow([_sanitize_formula(c) for c in r])

    csv_data = out.getvalue().encode("utf-8-sig")
    filename = "policy_import_template_33_headings.csv"
    mime = "text/csv"
    return csv_data, filename, mime


def _clean_header_key(h: str) -> str:
    """Normalize arbitrary header string into clean lowercase identifier."""
    return re.sub(r"[^a-zA-Z0-9_]", "", h.strip().lower().replace(" ", "_").replace("/", "_"))


def _extract_canonical_row(raw_dict: dict[str, Any]) -> dict[str, Any]:
    """Map raw cell values from either 33-column Excel or legacy format into unified dict."""
    normalized = {_clean_header_key(k): (v if v is not None else "") for k, v in raw_dict.items()}

    def get_val(*keys: str) -> Any:
        for k in keys:
            clean = _clean_header_key(k)
            if clean in normalized and normalized[clean] != "":
                return normalized[clean]
        return ""

    # 1. Policy Identification & Type
    pol_num = str(get_val("POLICY NUMBER", "policy_number")).strip().upper()
    prop_num = str(get_val("PROPOSAL FORM", "proposal_number", "proposal_form")).strip()
    raw_type = str(get_val("POLICY TYPE", "policy_type", "lob", "line_of_business")).strip()

    # Determine canonical category and product variant
    variant = raw_type
    coverage_type = "INDIVIDUAL"
    if " - " in raw_type:
        cat_part, _, var_part = raw_type.partition(" - ")
        variant = var_part.strip()
        category = normalize_category_code(cat_part)
    else:
        category = normalize_category_code(raw_type)

    if "floater" in raw_type.lower() or "family" in raw_type.lower():
        coverage_type = "FAMILY_FLOATER"

    # 2. Business Type (NEW, PORT, RENEW)
    b_type_raw = str(get_val("PORT/NEW/ RENEW", "port_new_renew", "business_type")).strip().upper()
    if "PORT" in b_type_raw:
        business_type = "PORT"
    elif "RENEW" in b_type_raw:
        business_type = "RENEW"
    else:
        business_type = "NEW"

    # 3. Customer & Contact
    cust_name = str(get_val("POLICY HOLDER NAME", "customer_name", "policyholder")).strip()
    mobile = re.sub(r"\D", "", str(get_val("MOBILE NUMBER", "customer_mobile", "customer_phone", "phone")).strip())
    email = str(get_val("EMAIL ID", "customer_email", "email")).strip()
    pincode = str(get_val("PIN CODE", "pincode", "postal_code")).strip()
    city = str(get_val("CITY", "city")).strip()

    # 4. Dates
    start_dt = _parse_date(get_val("POLICY START DATE ", "POLICY START DATE", "policy_start_date", "start_date"))
    expiry_dt = _parse_date(get_val("POLICY END DATE", "policy_end_date", "expiry_date", "end_date"))
    term_years = _parse_decimal(get_val("policy_term_years", "term_years", "term"), default=Decimal("1"))
    if not expiry_dt and start_dt:
        try:
            years_to_add = int(term_years) if term_years > 0 else 1
            expiry_dt = date(start_dt.year + years_to_add, start_dt.month, start_dt.day)
        except (ValueError, TypeError):
            expiry_dt = start_dt + timedelta(days=365)

    # 5. Economics
    gross_prem = _parse_decimal(get_val("GROSS PREMIUM (with Tax)", "gross_premium", "final_premium"))
    net_prem = _parse_decimal(get_val("NET PREMIUM(without Tax)", "net_premium"), default=gross_prem)
    sum_assured = _parse_decimal(get_val("BASE SUM INSURED ", "BASE SUM INSURED", "base_sum_insured", "sum_assured"))

    # 6. Commission & TDS
    comm_rate_raw = get_val("COMMISION RATE", "commission_rate")
    if isinstance(comm_rate_raw, (int, float)) and 0 < comm_rate_raw < 1:
        comm_rate = Decimal(str(round(comm_rate_raw * 100, 2)))
    elif comm_rate_raw:
        comm_rate = _parse_decimal(comm_rate_raw)
    else:
        comm_rate = Decimal("15.0")

    comm_amt = _parse_decimal(get_val("COMMISION", "commission_amount"), default=(net_prem * comm_rate / Decimal("100")))
    tds_amt = _parse_decimal(get_val("TDS", "tds_amount"), default=(comm_amt * Decimal("0.10")))
    net_comm = _parse_decimal(get_val("NET COMMISION", "net_commission"), default=(comm_amt - tds_amt))

    cr_raw = str(get_val("COMMISSION RECIVED", "commission_received_status", "commission_received")).strip().lower()
    if cr_raw in ("yes", "received", "true"):
        commission_received_status = "RECEIVED"
    elif cr_raw in ("no", "not_received", "false"):
        commission_received_status = "NOT_RECEIVED"
    else:
        commission_received_status = "PENDING"

    # 7. Coverage specific
    hosp_raw = str(get_val("HOSPITAL CASH", "hospital_cash_benefit")).strip().lower()
    if "not" in hosp_raw:
        hospital_cash = "NOT_INCLUDED"
    elif "included" in hosp_raw or "yes" in hosp_raw:
        hospital_cash = "INCLUDED"
    else:
        hospital_cash = "NOT_APPLICABLE"

    # 8. Motor specific
    veh_reg = str(get_val("Registration No / Vehicle No", "vehicle_registration_number", "registration_no")).strip()
    veh_mfg = str(get_val("Compay Name", "vehicle_manufacturer", "manufacturer")).strip()
    veh_model = str(get_val("Model Name", "vehicle_model", "model")).strip()

    # 9. Company & Intermediary
    company_name = str(get_val("COMPANY", "company_name", "company_code", "insurer")).strip()
    intermediary_name = str(get_val("Intermediary Name", "intermediary", "purchase_party", "purchase_party_name")).strip()

    # 10. Members (1 to 4)
    members = []
    m1_name = str(get_val("MEMBER 1", "member_1")).strip() or cust_name
    m1_dob = _parse_date(get_val("MEMBER 1 DOB", "member_1_dob"))
    if m1_name:
        members.append({
            "full_name": m1_name,
            "relationship": "Self",
            "date_of_birth": m1_dob,
            "gender": "MALE",
        })

    m2_name = str(get_val("MEMBER 2", "member_2")).strip()
    m2_dob = _parse_date(get_val("MEMBER 2 DOB", "member_2_dob"))
    if m2_name:
        members.append({
            "full_name": m2_name,
            "relationship": "Spouse",
            "date_of_birth": m2_dob,
            "gender": "FEMALE",
        })

    m3_name = str(get_val("MEMBER 3", "member_3")).strip()
    m3_dob = _parse_date(get_val("MEMBER 3 DOB", "member_3_dob"))
    if m3_name:
        members.append({
            "full_name": m3_name,
            "relationship": "Child",
            "date_of_birth": m3_dob,
            "gender": "OTHER",
        })

    m4_name = str(get_val("MEMBER 4", "member_4")).strip()
    m4_dob = _parse_date(get_val("MEMBER 4 DOB", "member_4_dob"))
    if m4_name:
        members.append({
            "full_name": m4_name,
            "relationship": "Child",
            "date_of_birth": m4_dob,
            "gender": "OTHER",
        })

    return {
        "policy_number": pol_num,
        "proposal_number": prop_num or None,
        "policy_type": category,
        "product_variant": variant or None,
        "coverage_type": coverage_type,
        "business_type": business_type,
        "customer_name": cust_name,
        "mobile": mobile,
        "email": email or None,
        "city": city or None,
        "pincode": pincode or None,
        "policy_start_date": start_dt,
        "expiry_date": expiry_dt,
        "gross_premium": gross_prem,
        "net_premium": net_prem,
        "sum_assured": sum_assured,
        "commission_rate": comm_rate,
        "commission_amount": comm_amt,
        "tds_amount": tds_amt,
        "net_commission": net_comm,
        "commission_received_status": commission_received_status,
        "hospital_cash_benefit": hospital_cash,
        "vehicle_registration_number": veh_reg or None,
        "vehicle_manufacturer": veh_mfg if category == "MOTOR" else None,
        "vehicle_model": veh_model if category == "MOTOR" else None,
        "company_name": company_name or "General Insurance",
        "intermediary_name": intermediary_name or "Direct Firm",
        "members": members,
    }


async def preview_policy_import(
    session: AsyncSession,
    file: UploadFile,
) -> PolicyImportPreviewResponse:
    """Validate each row of an uploaded spreadsheet and produce row-level preview and errors."""
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    fn = (file.filename or "import.xlsx").lower()
    raw_rows: list[dict[str, Any]] = []

    if fn.endswith(".xlsx"):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
            ws = wb.active
            sheet_rows = list(ws.iter_rows(values_only=True))
            if sheet_rows:
                raw_headers = [str(c or "").strip() for c in sheet_rows[0]]
                for r in sheet_rows[1:]:
                    if not r or all(c is None or str(c).strip() == "" for c in r):
                        continue
                    row_dict = {}
                    for idx, h in enumerate(raw_headers):
                        row_dict[h] = r[idx] if idx < len(r) else None
                    raw_rows.append(row_dict)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel .xlsx file: {str(e)}")
    else:
        text_content = content.decode("utf-8-sig", errors="replace")
        f = io.StringIO(text_content)
        reader = csv.reader(f)
        try:
            raw_headers = next(reader)
        except StopIteration:
            raw_headers = []
        for r in reader:
            if not r or all(not cell.strip() for cell in r):
                continue
            row_dict = {}
            for idx, h in enumerate(raw_headers):
                row_dict[h] = r[idx].strip() if idx < len(r) else ""
            raw_rows.append(row_dict)

    if not raw_rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No data rows discovered in the uploaded file.",
        )

    existing_pols = {
        p.upper() for p in (await session.execute(select(InsurancePolicy.policy_number))).scalars().all()
    }
    cust_res = (await session.execute(select(Customer.phone, Customer.first_name, Customer.last_name))).all()
    phone_to_name: dict[str, str] = {}
    for c_phone, c_first, c_last in cust_res:
        if c_phone:
            clean = re.sub(r"\D", "", c_phone)
            if len(clean) >= 10:
                phone_to_name[clean[-10:]] = f"{c_first or ''} {c_last or ''}".strip()

    preview_rows: list[PolicyImportRowPreview] = []
    seen_in_batch: set[str] = set()

    for idx, raw in enumerate(raw_rows, start=2):
        canon = _extract_canonical_row(raw)
        errors: list[str] = []
        warnings: list[str] = []
        is_duplicate = False

        # 1. Policy Number
        pol_num = canon["policy_number"]
        if not pol_num:
            errors.append("Policy Number is required.")
        elif pol_num in existing_pols:
            is_duplicate = True
            warnings.append(f"Policy Number '{pol_num}' already exists in database (will be skipped during import).")
        elif pol_num in seen_in_batch:
            is_duplicate = True
            errors.append(f"Duplicate Policy Number '{pol_num}' within file.")
        else:
            seen_in_batch.add(pol_num)

        # 2. Customer
        if not canon["customer_name"] and canon["mobile"]:
            clean_m = canon["mobile"][-10:] if len(canon["mobile"]) >= 10 else canon["mobile"]
            if clean_m in phone_to_name:
                canon["customer_name"] = phone_to_name[clean_m]
        if not canon["customer_name"]:
            errors.append("Policyholder name is required.")
        if not canon["mobile"]:
            warnings.append("Contact Mobile number not provided.")

        # 3. Dates
        if not canon["policy_start_date"]:
            errors.append("Policy Start Date is missing or invalid.")
        if not canon["expiry_date"]:
            errors.append("Policy End Date is missing or invalid.")
        elif canon["policy_start_date"] and canon["expiry_date"] <= canon["policy_start_date"]:
            errors.append("Policy End Date must be after Start Date.")

        # 4. Financials
        if canon["gross_premium"] <= Decimal("0"):
            errors.append("Gross Premium must be positive.")
        if canon["net_premium"] > canon["gross_premium"]:
            errors.append("Net Premium cannot exceed Gross Premium.")

        # 5. Motor Validation
        if canon["policy_type"] == "MOTOR" and not canon["vehicle_registration_number"]:
            warnings.append("Vehicle registration number not specified for Motor policy.")

        has_errors = len(errors) > 0
        if is_duplicate and not has_errors:
            row_status = "DUPLICATE"
            row_is_valid = False
        elif has_errors:
            row_status = "INVALID"
            row_is_valid = False
        else:
            row_status = "VALID"
            row_is_valid = True

        row_preview = PolicyImportRowPreview(
            row_number=idx,
            data=canon,
            is_valid=row_is_valid,
            is_duplicate=is_duplicate,
            status=row_status,
            errors=errors,
            warnings=warnings,
        )
        preview_rows.append(row_preview)

    valid_count = sum(1 for r in preview_rows if r.status == "VALID")
    duplicate_count = sum(1 for r in preview_rows if r.status == "DUPLICATE")
    invalid_count = sum(1 for r in preview_rows if r.status == "INVALID")

    return PolicyImportPreviewResponse(
        total_rows=len(preview_rows),
        valid_rows_count=valid_count,
        invalid_rows_count=invalid_count,
        duplicate_rows_count=duplicate_count,
        valid_rows=valid_count,
        invalid_rows=invalid_count,
        duplicate_rows=duplicate_count,
        rows=preview_rows,
    )


async def confirm_policy_import(
    session: AsyncSession,
    file_or_rows: Any,
    user_id: uuid.UUID | None = None,
) -> PolicyImportResult:
    """Execute bulk policy registration into PostgreSQL with carrier, plan, customer, and members resolution."""
    # 1. Extract rows
    if isinstance(file_or_rows, list):
        rows_to_process = [r.data if hasattr(r, "data") else r for r in file_or_rows]
    elif isinstance(file_or_rows, UploadFile) or hasattr(file_or_rows, "file"):
        preview = await preview_policy_import(session, file_or_rows)
        rows_to_process = [r.data for r in preview.rows if r.status == "VALID" or (r.is_valid and not r.is_duplicate)]
    else:
        raise HTTPException(status_code=400, detail="Invalid import payload.")

    if not rows_to_process:
        return PolicyImportResult(imported_count=0, skipped_count=0, failed_count=0)

    # 2. Cache entities for resolution
    all_companies = (await session.execute(select(InsuranceCompany))).scalars().all()
    existing_companies = {c.name.lower(): c for c in all_companies}
    for c in all_companies:
        if c.code:
            existing_companies[c.code.lower()] = c

    existing_parties = {
        p.name.lower(): p for p in (await session.execute(select(InsurancePurchaseParty))).scalars().all()
    }
    for p in list(existing_parties.values()):
        if p.code:
            existing_parties[p.code.lower()] = p

    all_plans = (await session.execute(select(InsurancePlan))).scalars().all()
    existing_plans = {
        (p.company_id, p.name.lower()): p for p in all_plans
    }
    for p in all_plans:
        if p.code:
            existing_plans[(p.company_id, p.code.lower())] = p

    imported = 0
    skipped = 0
    failed = 0
    errors: list[dict[str, Any]] = []

    for idx, r in enumerate(rows_to_process, start=1):
        try:
            canon = _extract_canonical_row(r) if "customer_name" not in r else r
            pol_num = canon["policy_number"]

            # Check duplicate
            existing = (
                await session.execute(
                    select(InsurancePolicy).where(InsurancePolicy.policy_number == pol_num)
                )
            ).scalar_one_or_none()
            if existing:
                skipped += 1
                continue

            # Resolve Customer
            cust_name = canon["customer_name"] or "Imported Customer"
            mobile = canon["mobile"] or "9999999999"
            email = canon["email"] or f"cust_{uuid.uuid4().hex[:6]}@example.com"

            cust = (
                await session.execute(
                    select(Customer).where(
                        or_(
                            Customer.phone == mobile,
                            Customer.email == email,
                        )
                    )
                )
            ).scalar_one_or_none()

            if not cust:
                parts = cust_name.split(" ", 1)
                first_name = parts[0]
                last_name = parts[1] if len(parts) > 1 else ""
                cust = Customer(
                    first_name=first_name,
                    last_name=last_name,
                    email=email,
                    phone=mobile,
                    city=canon.get("city") or "Mumbai",
                    pincode=canon.get("pincode") or "400001",
                    address=f"{canon.get('city', '')} {canon.get('pincode', '')}".strip() or "Imported Address",
                    is_archived=False,
                )
                session.add(cust)
                await session.flush()

            # Resolve Company
            co_name = canon.get("company_name") or "National Insurance"
            comp = existing_companies.get(co_name.lower())
            if not comp:
                co_code = f"{re.sub(r'[^A-Z0-9]', '', co_name.upper())[:6]}-{uuid.uuid4().hex[:4].upper()}"
                canonical_cat = normalize_category_label(canon.get("policy_type"))
                canonical_code = normalize_category_code(canon.get("policy_type"))
                comp = InsuranceCompany(
                    name=co_name,
                    code=co_code,
                    category=canonical_cat,
                    is_active=True,
                )
                session.add(comp)
                await session.flush()
                # add category link
                cat_link_label = InsuranceCompanyCategory(
                    company_id=comp.id,
                    category=canonical_cat,
                )
                cat_link_code = InsuranceCompanyCategory(
                    company_id=comp.id,
                    category=canonical_code,
                )
                session.add_all([cat_link_label, cat_link_code])
                await session.flush()
                existing_companies[co_name.lower()] = comp

            # Resolve Plan
            variant_name = canon.get("product_variant") or f"{canon.get('policy_type', 'GENERAL')} Comprehensive Plan"
            plan = existing_plans.get((comp.id, variant_name.lower()))
            if not plan:
                plan = (
                    await session.execute(
                        select(InsurancePlan).where(
                            InsurancePlan.company_id == comp.id,
                            InsurancePlan.name == variant_name,
                        )
                    )
                ).scalar_one_or_none()

            if not plan:
                plan_code = f"{comp.code[:4]}-{re.sub(r'[^A-Z0-9]', '', variant_name.upper())[:6]}-{uuid.uuid4().hex[:4].upper()}"
                plan = InsurancePlan(
                    company_id=comp.id,
                    name=variant_name,
                    code=plan_code,
                    line_of_business=normalize_category_label(canon.get("policy_type")),
                    status="ACTIVE",
                )
                session.add(plan)
                await session.flush()
                existing_plans[(comp.id, variant_name.lower())] = plan

            # Resolve Purchase Party / Intermediary
            inter_name = canon.get("intermediary_name") or "Direct Firm"
            party = existing_parties.get(inter_name.lower())
            if not party:
                party_code = f"{re.sub(r'[^A-Z0-9]', '', inter_name.upper())[:6]}-{uuid.uuid4().hex[:4].upper()}"
                party = InsurancePurchaseParty(
                    name=inter_name,
                    code=party_code,
                    contact_person=inter_name,
                    is_active=True,
                )
                session.add(party)
                await session.flush()
                existing_parties[inter_name.lower()] = party

            # Prepare PolicyCreate Payload
            members_payload = []
            for m in (canon.get("members") or []):
                members_payload.append(
                    PolicyMemberCreate(
                        full_name=m["full_name"],
                        relationship=m.get("relationship", "Self"),
                        date_of_birth=m.get("date_of_birth"),
                        gender=m.get("gender", "MALE"),
                        individual_sum_insured=canon.get("sum_assured") if canon.get("coverage_type") == "INDIVIDUAL" else None,
                    )
                )

            policy_payload = PolicyCreate(
                policy_number=pol_num,
                proposal_number=canon.get("proposal_number"),
                policy_type=canon.get("policy_type", "HEALTH"),
                product_variant=canon.get("product_variant"),
                coverage_type=canon.get("coverage_type", "INDIVIDUAL"),
                business_type=canon.get("business_type", "NEW"),
                customer_id=cust.id,
                company_id=comp.id,
                plan_id=plan.id,
                purchase_party_id=party.id,
                policy_term_years=1,
                sum_assured=canon.get("sum_assured") or Decimal("500000"),
                net_premium=canon.get("net_premium"),
                gross_premium=canon.get("gross_premium"),
                final_premium=canon.get("gross_premium"),
                start_date=canon.get("policy_start_date") or date.today(),
                expiry_date=canon.get("expiry_date"),
                hospital_cash_benefit=canon.get("hospital_cash_benefit", "NOT_APPLICABLE"),
                vehicle_registration_number=canon.get("vehicle_registration_number"),
                vehicle_manufacturer=canon.get("vehicle_manufacturer"),
                vehicle_model=canon.get("vehicle_model"),
                vehicle_type=canon.get("vehicle_type"),
                travel_destination=canon.get("travel_destination"),
                travel_type=canon.get("travel_type"),
                intermediary_name=canon.get("intermediary_name"),
                contact_city=canon.get("city"),
                contact_pincode=canon.get("pincode"),
                contact_mobile=canon.get("mobile"),
                contact_email=canon.get("email"),
                commission_rate=canon.get("commission_rate"),
                commission_amount=canon.get("commission_amount"),
                tds_amount=canon.get("tds_amount"),
                net_commission_payable=canon.get("net_commission"),
                commission_received_status=canon.get("commission_received_status", "PENDING"),
                members=members_payload,
            )

            await create_policy(session, policy_payload, user_id=user_id)
            imported += 1

        except Exception as e:
            await session.rollback()
            failed += 1
            errors.append({"row": idx, "error": str(e)})

    await session.commit()
    return PolicyImportResult(
        imported_count=imported,
        skipped_count=skipped,
        failed_count=failed,
        errors=errors,
    )


async def export_policies_to_excel(
    session: AsyncSession,
    search: str | None = None,
    status_filter: str | None = None,
    policy_type: str | None = None,
    business_type: str | None = None,
    company_id: uuid.UUID | None = None,
    customer_id: uuid.UUID | None = None,
    issue_year: int | str | None = None,
    coverage_year: str | None = None,
    year_bucket: str | None = None,
) -> tuple[bytes, str, str]:
    """Export policies with year-wise lifecycle data and formatting into a genuine Excel workbook."""
    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    query = (
        select(InsurancePolicy)
        .options(
            selectinload(InsurancePolicy.customer),
            selectinload(InsurancePolicy.company),
            selectinload(InsurancePolicy.plan),
            selectinload(InsurancePolicy.purchase_party),
            selectinload(InsurancePolicy.sub_agent),
            selectinload(InsurancePolicy.members),
            selectinload(InsurancePolicy.commissions),
            selectinload(InsurancePolicy.renewals),
            selectinload(InsurancePolicy.previous_policy),
        )
    )

    if search and search.strip():
        s = f"%{search.strip().lower()}%"
        query = query.outerjoin(Customer, InsurancePolicy.customer_id == Customer.id).where(
            or_(
                func.lower(InsurancePolicy.policy_number).like(s),
                func.lower(func.coalesce(InsurancePolicy.proposal_number, "")).like(s),
                func.lower(func.coalesce(InsurancePolicy.previous_policy_number, "")).like(s),
                func.lower(Customer.first_name).like(s),
                func.lower(Customer.last_name).like(s),
                func.lower(Customer.phone).like(s),
            )
        )
    if status_filter and status_filter != "ALL":
        query = query.where(InsurancePolicy.status == status_filter.upper())
    if policy_type and policy_type != "ALL":
        query = query.where(InsurancePolicy.policy_type == policy_type)
    if business_type and business_type != "ALL":
        query = query.where(InsurancePolicy.business_type == business_type.upper())
    if company_id:
        query = query.where(InsurancePolicy.company_id == company_id)
    if customer_id:
        query = query.where(InsurancePolicy.customer_id == customer_id)

    # Policy Issue-Year Filter (authoritative issue date)
    effective_issue_date = func.coalesce(
        InsurancePolicy.issue_date,
        InsurancePolicy.first_receipt_date,
        func.date(InsurancePolicy.created_at),
        InsurancePolicy.policy_start_date,
    )
    target_year: int | None = None
    if issue_year is not None and str(issue_year).strip().upper() != "ALL":
        try:
            target_year = int(str(issue_year).strip())
        except ValueError:
            pass
    elif coverage_year and coverage_year.strip().upper() != "ALL":
        cy = coverage_year.strip().replace("–", "-")
        first_part = cy.split("-")[0].strip()
        try:
            target_year = int(first_part)
        except ValueError:
            pass
    elif year_bucket and year_bucket.strip().isdigit():
        target_year = int(year_bucket.strip())

    if target_year is not None:
        query = query.where(func.extract("year", effective_issue_date) == target_year)
    elif year_bucket and year_bucket.upper() not in ("ALL", ""):
        today = date.today()
        bucket = year_bucket.upper()
        if bucket == "CURRENT":
            query = query.where(
                InsurancePolicy.policy_start_date <= today,
                InsurancePolicy.expiry_date >= today,
            )
        elif bucket == "PREVIOUS":
            query = query.where(InsurancePolicy.expiry_date < today)
        elif bucket == "UPCOMING":
            query = query.where(InsurancePolicy.policy_start_date > today)

    query = query.order_by(effective_issue_date.desc(), InsurancePolicy.created_at.desc())
    policies = (await session.execute(query)).scalars().all()

    wb = openpyxl.Workbook()

    # Sheet 1: Year-Wise Policy Register
    ws_yw = wb.active
    ws_yw.title = "Year-Wise Policy Register"

    headers_yw = [
        "Policy Issue Year",
        "Policy Issue Date",
        "Policy Number",
        "Policyholder",
        "Customer Name",
        "Insurance Company",
        "Plan",
        "Policy Type",
        "Policy Start Date",
        "Policy End Date",
        "Coverage Year",
        "Sum Insured (₹)",
        "Net Premium (₹)",
        "Gross Premium (₹)",
        "Payment Frequency",
        "Status",
        "Mobile Number",
        "Email ID",
        "City",
        "Business Type",
        "Previous Policy Number",
        "Renewal Reference",
        "Intermediary / Agent",
    ]
    ws_yw.append(headers_yw)

    # Styles
    header_fill = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Calibri", size=10)
    border_thin = Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0"),
    )

    for cell in ws_yw[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    row_idx = 2
    for p in policies:
        iss_date = p.issue_date or p.first_receipt_date or (p.created_at.date() if p.created_at else p.policy_start_date)
        iss_year = iss_date.year if iss_date else "N/A"
        iss_date_str = iss_date.strftime("%d-%m-%Y") if iss_date else "N/A"
        start_date_str = p.policy_start_date.strftime("%d-%m-%Y") if p.policy_start_date else ""
        end_date_str = p.expiry_date.strftime("%d-%m-%Y") if p.expiry_date else ""

        ren_ref = ""
        if p.previous_policy:
            ren_ref = f"Renewed from {p.previous_policy.policy_number}"
        elif p.previous_policy_number:
            ren_ref = f"Prior {p.previous_policy_number}"
        elif p.renewals:
            ren_ref = f"Renewals: {len(p.renewals)}"

        cust_name = p.customer.full_name if p.customer else "N/A"
        row_yw = [
            iss_year,
            iss_date_str,
            p.policy_number,
            cust_name,
            cust_name,
            p.company.name if p.company else "",
            p.plan.name if p.plan else (p.product_variant or "Standard"),
            p.policy_type,
            start_date_str,
            end_date_str,
            f"{p.policy_start_date.year}–{p.expiry_date.year}",
            float(p.sum_assured or Decimal("0.00")),
            float(p.net_premium or p.final_premium or Decimal("0.00")),
            float(p.final_premium or Decimal("0.00")),
            p.premium_mode,
            p.status,
            p.contact_mobile or (p.customer.phone if p.customer else ""),
            p.contact_email or (p.customer.email if p.customer else ""),
            p.contact_city or (p.customer.city if p.customer else ""),
            p.business_type or "NEW",
            p.previous_policy_number or "N/A",
            ren_ref,
            p.intermediary_name or (p.sub_agent.full_name if p.sub_agent else (p.purchase_party.name if p.purchase_party else "Direct")),
        ]
        ws_yw.append([_sanitize_formula(c) for c in row_yw])

        # Formatting data cells
        for col_idx in range(1, len(row_yw) + 1):
            c = ws_yw.cell(row=row_idx, column=col_idx)
            c.font = data_font
            c.border = border_thin
            if col_idx in (12, 13, 14):
                c.number_format = "#,##0.00"
                c.alignment = Alignment(horizontal="right")
            elif col_idx in (1, 2, 8, 9, 10, 11, 15, 16):
                c.alignment = Alignment(horizontal="center")
            else:
                c.alignment = Alignment(horizontal="left")
        row_idx += 1

    # Auto column width
    for col in ws_yw.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws_yw.column_dimensions[col_letter].width = max(max_len + 3, 12)

    ws_yw.auto_filter.ref = ws_yw.dimensions

    # Sheet 2: Standard 33-Headings Format (for round-trip compatibility)
    ws_33 = wb.create_sheet(title="Policies (33 Headings)")
    ws_33.append(EXCEL_33_COLUMNS)

    for cell in ws_33[1]:
        cell.fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for p in policies:
        mems = list(p.members or [])
        m1 = mems[0] if len(mems) > 0 else None
        m2 = mems[1] if len(mems) > 1 else None
        m3 = mems[2] if len(mems) > 2 else None
        m4 = mems[3] if len(mems) > 3 else None

        comm = p.commissions[0] if p.commissions else None
        comm_rate = float(comm.gross_commission_rate) / 100 if comm and comm.gross_commission_rate else 0.15
        comm_amt = float(comm.gross_commission_amount) if comm and comm.gross_commission_amount else float(p.final_premium * Decimal("0.15"))
        tds_amt = float(comm.tds_amount) if comm and comm.tds_amount else float(comm_amt * 0.10)
        net_comm = float(comm.net_commission_payable) if comm and comm.net_commission_payable else (comm_amt - tds_amt)

        comm_status = p.commission_received_status or "PENDING"
        comm_rec_text = "Yes" if comm_status == "RECEIVED" else "No" if comm_status == "NOT_RECEIVED" else "Pending"

        hc_status = p.hospital_cash_benefit or "NOT_APPLICABLE"
        hc_text = "Included" if hc_status == "INCLUDED" else "Not Included" if hc_status == "NOT_INCLUDED" else "N/A"
        prod_type_text = f"{p.policy_type} Insurance - {p.product_variant or (p.plan.name if p.plan else 'Standard')}"

        row_33 = [
            p.customer.full_name if p.customer else "Customer",
            p.business_type or "NEW",
            p.contact_pincode or (p.customer.pincode if p.customer else ""),
            p.contact_city or (p.customer.city if p.customer else ""),
            p.proposal_number or "",
            p.policy_number,
            prod_type_text,
            str(p.policy_start_date),
            str(p.expiry_date),
            float(p.final_premium),
            float(p.net_premium or p.final_premium),
            comm_rate,
            comm_amt,
            tds_amt,
            net_comm,
            comm_rec_text,
            float(p.sum_assured),
            hc_text,
            m1.full_name if m1 else "",
            str(m1.date_of_birth) if m1 and m1.date_of_birth else "",
            m2.full_name if m2 else "",
            str(m2.date_of_birth) if m2 and m2.date_of_birth else "",
            m3.full_name if m3 else "",
            str(m3.date_of_birth) if m3 and m3.date_of_birth else "",
            m4.full_name if m4 else "",
            str(m4.date_of_birth) if m4 and m4.date_of_birth else "",
            p.vehicle_registration_number or "",
            p.vehicle_manufacturer or "",
            p.vehicle_model or "",
            p.contact_mobile or (p.customer.phone if p.customer else ""),
            p.contact_email or (p.customer.email if p.customer else ""),
            p.company.name if p.company else "",
            p.intermediary_name or (p.purchase_party.name if p.purchase_party else "Direct"),
        ]
        ws_33.append([_sanitize_formula(c) for c in row_33])

    buf = io.BytesIO()
    wb.save(buf)
    tag = f"issued_{target_year}" if target_year else (coverage_year or (year_bucket.lower() if year_bucket else "all_years"))
    filename = f"finnexus_policies_{tag}_{date.today().isoformat()}.xlsx"
    mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return buf.getvalue(), filename, mime
