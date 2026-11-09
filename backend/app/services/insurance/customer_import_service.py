"""Bulk Customer Import Service for CSV and Excel (XLSX) Spreadsheets.

Handles:
- Template generation for Individual and Corporate customer onboarding (CSV and native XLSX)
- Formula injection prevention (=, +, -, @)
- File format & size validation
- Column schema inspection and missing column detection
- Row-level validation (phone, email, PAN, Aadhaar, GSTIN, dates)
- Two-tier duplicate detection (intra-file and PostgreSQL database)
- Preview generation with validation breakdowns
- Transactional confirmed import with application-level KYC encryption and audit trails
"""

from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import UTC, date, datetime
from typing import Any

import openpyxl
from fastapi import HTTPException, UploadFile, status
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.audit import AuditLog
from app.db.models.crm import Customer
from app.services.insurance.kyc_crypto import (
    encrypt_kyc_value,
    hash_kyc_value,
    validate_aadhaar,
    validate_gstin,
    validate_pan,
)

INDIVIDUAL_COLUMNS = [
    "First Name",
    "Last Name",
    "Mobile Number",
    "Email",
    "Gender",
    "Date of Birth",
    "Marital Status",
    "Anniversary Date",
    "Nationality",
    "State",
    "City",
    "PIN Code",
    "Complete Address",
    "Occupation",
    "Source of Income",
    "PAN Number",
    "Aadhaar Number",
]

CORPORATE_COLUMNS = [
    "Corporate Name",
    "Corporate Code",
    "GSTIN",
    "PAN Number",
    "Contact Person Name",
    "Contact Person Mobile",
    "Contact Person Email",
    "State",
    "City",
    "PIN Code",
    "Complete Address",
]

MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def sanitize_formula(val: Any) -> str:
    """Protect against spreadsheet formula injection (=, +, -, @)."""
    if val is None:
        return ""
    s = str(val).strip()
    if s.startswith(("=", "+", "-", "@")):
        return "'" + s
    return s


def generate_customer_template(
    customer_type: str = "INDIVIDUAL",
    format_type: str = "csv",
) -> tuple[bytes, str, str]:
    """Generate sample spreadsheet template for Individual or Corporate bulk customer import."""
    ctype = customer_type.upper()
    is_corp = ctype == "CORPORATE"
    headers = CORPORATE_COLUMNS if is_corp else INDIVIDUAL_COLUMNS

    sample_individual = [
        [
            "Rajesh",
            "Sharma",
            "9876543210",
            "rajesh.sharma@example.com",
            "Male",
            "1985-06-15",
            "Married",
            "2012-11-20",
            "Indian",
            "Maharashtra",
            "Mumbai",
            "400001",
            "Flat 402, Sea Green Apts, Nariman Point",
            "Salaried",
            "Salary",
            "ABCDE1234F",
            "234567890123",
        ]
    ]

    sample_corporate = [
        [
            "Acme Global Technologies Pvt Ltd",
            "CORP-ACME-01",
            "27ABCDE1234F1Z5",
            "ABCDE1234F",
            "Ananya Deshmukh",
            "9876543211",
            "ananya.d@acmeglobal.com",
            "Maharashtra",
            "Pune",
            "411001",
            "Level 5, Cyber City, Magarpatta",
        ]
    ]

    sample_rows = sample_corporate if is_corp else sample_individual
    base_name = f"customer_import_template_{ctype.lower()}"

    if format_type.lower() == "xlsx":
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = f"{ctype.capitalize()} Import"

        header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

        ws.append(headers)
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")

        sample_font = Font(name="Calibri", size=10, italic=True, color="4B5563")
        for row in sample_rows:
            ws.append([sanitize_formula(v) for v in row])
            for col_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=ws.max_row, column=col_idx)
                cell.font = sample_font

        # Auto-adjust column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 14)

        buf = io.BytesIO()
        wb.save(buf)
        return (
            buf.getvalue(),
            f"{base_name}.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    else:
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(headers)
        for row in sample_rows:
            writer.writerow([sanitize_formula(v) for v in row])

        # Prepend UTF-8 BOM for Microsoft Excel compatibility
        csv_bytes = ("\ufeff" + out.getvalue()).encode("utf-8")
        return csv_bytes, f"{base_name}.csv", "text/csv; charset=utf-8"


def _parse_raw_rows_from_bytes(file_bytes: bytes, filename: str) -> tuple[list[str], list[dict[str, str]]]:
    """Parse raw tabular rows from CSV or XLSX bytes, handling encoding and whitespace."""
    fn = filename.lower()
    headers: list[str] = []
    rows: list[dict[str, str]] = []

    if fn.endswith(".xlsx"):
        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
            ws = wb.active
            raw_rows = list(ws.iter_rows(values_only=True))
            if not raw_rows:
                return [], []
            headers = [str(h).strip() for h in raw_rows[0] if h is not None]
            for row in raw_rows[1:]:
                if not any(v is not None and str(v).strip() for v in row):
                    continue
                row_dict: dict[str, str] = {}
                for idx, h in enumerate(headers):
                    val = row[idx] if idx < len(row) else ""
                    row_dict[h] = str(val).strip() if val is not None else ""
                rows.append(row_dict)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")
    else:
        try:
            # Handle UTF-8 with or without BOM, fallback to latin-1
            text_content = ""
            for enc in ("utf-8-sig", "utf-8", "latin-1"):
                try:
                    text_content = file_bytes.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue

            if not text_content:
                raise ValueError("Could not decode file encoding.")

            f_io = io.StringIO(text_content)
            reader = csv.reader(f_io)
            raw_rows = list(reader)
            if not raw_rows:
                return [], []
            headers = [h.strip() for h in raw_rows[0] if h.strip()]
            for r in raw_rows[1:]:
                if not any(v.strip() for v in r):
                    continue
                row_dict = {}
                for idx, h in enumerate(headers):
                    val = r[idx].strip() if idx < len(r) else ""
                    row_dict[h] = val
                rows.append(row_dict)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")

    return headers, rows


def _normalize_column_key(name: str) -> str:
    """Normalize user column headers e.g. 'First_Name', 'first-name', 'First Name' -> 'first_name'."""
    clean = re.sub(r"[^a-zA-Z0-9]", "_", name.strip().lower())
    clean = re.sub(r"_+", "_", clean).strip("_")
    aliases = {
        "mobile": "phone",
        "mobile_number": "phone",
        "phone_number": "phone",
        "contact_number": "phone",
        "email_id": "email",
        "email_address": "email",
        "dob": "date_of_birth",
        "birth_date": "date_of_birth",
        "pin": "pincode",
        "postal_code": "pincode",
        "zip": "pincode",
        "zipcode": "pincode",
        "pan": "pan_number",
        "pan_no": "pan_number",
        "aadhaar": "aadhaar_number",
        "aadhaar_no": "aadhaar_number",
        "company": "company_name",
        "corporate": "company_name",
        "organization_name": "company_name",
        "corp_name": "company_name",
        "corp_code": "corporate_code",
        "gst": "gstin",
        "gst_number": "gstin",
        "gst_no": "gstin",
        "contact_person": "contact_person_name",
        "contact_name": "contact_person_name",
        "contact_phone": "contact_person_phone",
        "contact_mobile": "contact_person_phone",
        "contact_email": "contact_person_email",
    }
    return aliases.get(clean, clean)


async def preview_customer_import(
    session: AsyncSession,
    file: UploadFile,
    customer_type: str = "INDIVIDUAL",
) -> dict[str, Any]:
    """Parse, validate, and check for duplicates without inserting into database."""
    ctype = customer_type.strip().upper()
    is_corp = ctype == "CORPORATE"

    # 1. Validate file extension and MIME
    fn = file.filename or "import.csv"
    if not (fn.lower().endswith(".csv") or fn.lower().endswith(".xlsx")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only .csv and .xlsx files are supported.",
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(file_bytes) > MAX_IMPORT_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds maximum 10 MB limit.")

    headers, raw_rows = _parse_raw_rows_from_bytes(file_bytes, fn)
    if not raw_rows:
        raise HTTPException(status_code=400, detail="The spreadsheet contains no data rows.")

    # 2. Check duplicate headers
    norm_headers = [_normalize_column_key(h) for h in headers]
    if len(norm_headers) != len(set(norm_headers)):
        raise HTTPException(
            status_code=400,
            detail="Spreadsheet contains duplicate column headers. Please ensure each column is unique.",
        )

    # 3. Check required columns
    required_cols = (
        ["company_name", "phone"] if is_corp else ["first_name", "phone"]
    )
    # Check if full_name is present instead of first_name
    header_set = set(norm_headers)
    if not is_corp and "full_name" in header_set:
        required_cols = ["phone"]

    missing = [c for c in required_cols if c not in header_set and (c != "phone" or "contact_person_phone" not in header_set)]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required column(s) for {ctype} import: {', '.join(missing)}.",
        )

    # 4. Fetch existing database records for duplicate checking
    existing_phones = set((await session.execute(select(Customer.phone))).scalars().all())
    existing_emails = set((await session.execute(select(Customer.email).where(Customer.email.is_not(None)))).scalars().all())
    existing_pans = set((await session.execute(select(Customer.pan_number).where(Customer.pan_number.is_not(None)))).scalars().all())
    existing_aadhaar_hashes = set((await session.execute(select(Customer.aadhaar_hash).where(Customer.aadhaar_hash.is_not(None)))).scalars().all())
    existing_corp_codes = set((await session.execute(select(Customer.corporate_code).where(Customer.corporate_code.is_not(None)))).scalars().all())

    # Intra-file tracking
    seen_file_phones: set[str] = set()
    seen_file_emails: set[str] = set()
    seen_file_pans: set[str] = set()
    seen_file_aadhaar_hashes: set[str] = set()
    seen_file_corp_codes: set[str] = set()

    preview_rows: list[dict[str, Any]] = []
    valid_count = 0
    invalid_count = 0
    duplicate_count = 0

    for idx, r in enumerate(raw_rows, start=2):
        row_norm: dict[str, Any] = {}
        for orig_k, orig_v in r.items():
            k_norm = _normalize_column_key(orig_k)
            row_norm[k_norm] = orig_v.strip()

        errors: list[dict[str, str]] = []
        is_duplicate = False

        # Extract & validate fields
        phone = row_norm.get("phone") or row_norm.get("contact_person_phone") or ""
        clean_phone = "".join(c for c in phone if c.isdigit())
        if not clean_phone or len(clean_phone) < 7 or len(clean_phone) > 15:
            errors.append({"field": "Mobile Number", "message": "Valid phone number (7-15 digits) is required."})
        else:
            if clean_phone in seen_file_phones:
                errors.append({"field": "Mobile Number", "message": f"Duplicate phone '{clean_phone}' in uploaded file."})
                is_duplicate = True
            elif clean_phone in existing_phones:
                errors.append({"field": "Mobile Number", "message": f"Phone '{clean_phone}' already registered in database."})
                is_duplicate = True
            seen_file_phones.add(clean_phone)
            row_norm["phone"] = clean_phone

        # Name validation
        if is_corp:
            comp_name = row_norm.get("company_name") or row_norm.get("full_name") or ""
            if not comp_name:
                errors.append({"field": "Corporate Name", "message": "Corporate / Organization name is required."})
            row_norm["company_name"] = comp_name
            row_norm["first_name"] = comp_name
            row_norm["last_name"] = "Entity"

            corp_code = (row_norm.get("corporate_code") or "").upper()
            if corp_code:
                if corp_code in seen_file_corp_codes:
                    errors.append({"field": "Corporate Code", "message": f"Duplicate Corporate Code '{corp_code}' in file."})
                    is_duplicate = True
                elif corp_code in existing_corp_codes:
                    errors.append({"field": "Corporate Code", "message": f"Corporate Code '{corp_code}' already exists in database."})
                    is_duplicate = True
                seen_file_corp_codes.add(corp_code)
                row_norm["corporate_code"] = corp_code

            gstin = (row_norm.get("gstin") or "").upper()
            if gstin:
                ok, msg = validate_gstin(gstin)
                if not ok:
                    errors.append({"field": "GSTIN", "message": msg})
                row_norm["gstin"] = gstin
        else:
            first_name = row_norm.get("first_name") or ""
            last_name = row_norm.get("last_name") or ""
            if not first_name and row_norm.get("full_name"):
                parts = row_norm["full_name"].split(maxsplit=1)
                first_name = parts[0]
                last_name = parts[1] if len(parts) > 1 else ""
            if not first_name:
                errors.append({"field": "First Name", "message": "First name is required."})
            row_norm["first_name"] = first_name
            row_norm["last_name"] = last_name or ""

        # Email validation
        email = (row_norm.get("email") or row_norm.get("contact_person_email") or "").lower()
        if email:
            if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
                errors.append({"field": "Email", "message": "Invalid email address format."})
            elif email in seen_file_emails:
                errors.append({"field": "Email", "message": f"Duplicate email '{email}' in uploaded file."})
                is_duplicate = True
            elif email in existing_emails:
                errors.append({"field": "Email", "message": f"Email '{email}' already exists in database."})
                is_duplicate = True
            seen_file_emails.add(email)
            row_norm["email"] = email

        # PAN validation
        pan = (row_norm.get("pan_number") or "").upper()
        if pan:
            ok, msg = validate_pan(pan)
            if not ok:
                errors.append({"field": "PAN Number", "message": msg})
            elif pan in seen_file_pans:
                errors.append({"field": "PAN Number", "message": f"Duplicate PAN '{pan}' in uploaded file."})
                is_duplicate = True
            elif pan in existing_pans:
                errors.append({"field": "PAN Number", "message": f"PAN '{pan}' already exists in database."})
                is_duplicate = True
            seen_file_pans.add(pan)
            row_norm["pan_number"] = pan

        # Aadhaar validation
        aadhaar = row_norm.get("aadhaar_number") or ""
        clean_aadhaar = "".join(c for c in aadhaar if c.isdigit())
        if clean_aadhaar:
            ok, msg = validate_aadhaar(clean_aadhaar)
            if not ok:
                errors.append({"field": "Aadhaar Number", "message": msg})
            else:
                aadh_h = hash_kyc_value(clean_aadhaar)
                if aadh_h in seen_file_aadhaar_hashes:
                    errors.append({"field": "Aadhaar Number", "message": "Duplicate Aadhaar in uploaded file."})
                    is_duplicate = True
                elif aadh_h in existing_aadhaar_hashes:
                    errors.append({"field": "Aadhaar Number", "message": "Aadhaar already registered in database."})
                    is_duplicate = True
                seen_file_aadhaar_hashes.add(aadh_h)
            row_norm["aadhaar_number"] = clean_aadhaar

        # Dates validation
        for date_key, label in [("date_of_birth", "Date of Birth"), ("anniversary_date", "Anniversary Date")]:
            d_val = row_norm.get(date_key)
            if d_val:
                try:
                    datetime.strptime(d_val[:10], "%Y-%m-%d")
                except ValueError:
                    errors.append({"field": label, "message": "Invalid date format (must be YYYY-MM-DD)."})

        is_valid = len(errors) == 0
        if is_valid:
            valid_count += 1
        else:
            if is_duplicate:
                duplicate_count += 1
            else:
                invalid_count += 1

        preview_rows.append({
            "row_number": idx,
            "data": row_norm,
            "is_valid": is_valid,
            "is_duplicate": is_duplicate,
            "errors": errors,
        })

    return {
        "customer_type": ctype,
        "total_rows": len(preview_rows),
        "valid_rows": valid_count,
        "invalid_rows": invalid_count,
        "duplicate_rows": duplicate_count,
        "rows": preview_rows,
    }


async def confirm_customer_import(
    session: AsyncSession,
    valid_rows: list[dict[str, Any]],
    customer_type: str = "INDIVIDUAL",
    user_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    """Insert validated rows into PostgreSQL database with application-level encryption."""
    ctype = customer_type.strip().upper()
    is_corp = ctype == "CORPORATE"

    successful_count = 0
    skipped_count = 0
    failed_count = 0
    errors: list[dict[str, Any]] = []

    now = datetime.now(UTC)

    for r in valid_rows:
        phone = r.get("phone", "").strip()
        if not phone:
            skipped_count += 1
            continue

        # Double check DB constraint before insert
        existing = (
            await session.execute(select(Customer.id).where(Customer.phone == phone))
        ).scalar_one_or_none()
        if existing:
            skipped_count += 1
            errors.append({"row_data": r, "reason": f"Phone '{phone}' already registered."})
            continue

        try:
            pan_val = r.get("pan_number") or None
            pan_enc = encrypt_kyc_value(pan_val) if pan_val else None

            aadh_raw = r.get("aadhaar_number") or None
            aadh_enc = encrypt_kyc_value(aadh_raw) if aadh_raw else None
            aadh_hash = hash_kyc_value(aadh_raw) if aadh_raw else None

            dob = None
            if r.get("date_of_birth"):
                try:
                    dob = datetime.strptime(r["date_of_birth"][:10], "%Y-%m-%d").date()
                except Exception:
                    pass

            anniv = None
            if r.get("anniversary_date"):
                try:
                    anniv = datetime.strptime(r["anniversary_date"][:10], "%Y-%m-%d").date()
                except Exception:
                    pass

            customer = Customer(
                id=uuid.uuid4(),
                first_name=r.get("first_name") or (r.get("company_name") or "Corporate Client"),
                last_name=r.get("last_name") or "Entity",
                phone=phone,
                email=r.get("email") or None,
                pan_number=pan_val,
                pan_encrypted=pan_enc,
                aadhaar_encrypted=aadh_enc,
                aadhaar_hash=aadh_hash,
                gender=(r.get("gender") or ("Corporate" if is_corp else "Male")).strip().upper(),
                date_of_birth=dob,
                anniversary_date=anniv,
                marital_status=r.get("marital_status") or None,
                nationality=r.get("nationality") or "Indian",
                state=r.get("state") or None,
                city=r.get("city") or None,
                address=r.get("complete_address") or r.get("address") or None,
                pincode=r.get("pincode") or None,
                occupation=r.get("occupation") or None,
                source_of_income=r.get("source_of_income") or None,
                customer_type=ctype,
                company_name=r.get("company_name") or None,
                corporate_code=r.get("corporate_code") or None,
                gstin=r.get("gstin") or None,
                contact_person_name=r.get("contact_person_name") or None,
                contact_person_phone=r.get("contact_person_phone") or None,
                contact_person_email=r.get("contact_person_email") or None,
                pipeline_status="INSURANCE_CLIENT",
                reference_source="Bulk Import",
                created_by_id=user_id,
                created_at=now,
                updated_at=now,
            )
            session.add(customer)
            successful_count += 1
        except Exception as e:
            failed_count += 1
            errors.append({"row_data": r, "reason": str(e)})

    # Log bulk import audit trail
    if successful_count > 0:
        audit = AuditLog(
            id=uuid.uuid4(),
            actor_id=user_id,
            action="BULK_CUSTOMER_IMPORT",
            resource_type="customer",
            resource_id=uuid.uuid4(),
            state_delta={
                "customer_type": ctype,
                "successful": successful_count,
                "skipped": skipped_count,
                "failed": failed_count,
            },
            created_at=now,
        )
        session.add(audit)

    await session.commit()

    return {
        "status": "COMPLETED",
        "customer_type": ctype,
        "successful_count": successful_count,
        "skipped_count": skipped_count,
        "failed_count": failed_count,
        "errors": errors,
    }
