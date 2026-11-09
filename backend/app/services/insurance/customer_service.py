"""Customer Onboarding, Corporate Management, and KYC Security Service for FinNexus Insurance Engine."""

from __future__ import annotations

import hashlib
import os
import re
import uuid
from decimal import Decimal
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Sequence

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.audit import AuditLog
from app.db.models.auth import User
from app.db.models.crm import Customer, CustomerNote
from app.db.models.documents import Document
from app.db.models.insurance import InsurancePolicy
from app.schemas.insurance import (
    CustomerDocumentInfo,
    InsuranceCustomerCreate,
    InsuranceCustomerResponse,
    InsuranceCustomerUpdate,
    PaginatedResponse,
)
from app.services.insurance.kyc_crypto import (
    decrypt_kyc_value,
    encrypt_kyc_value,
    hash_kyc_value,
    is_masked_value,
    mask_aadhaar,
    mask_pan,
    validate_aadhaar,
    validate_gstin,
    validate_pan,
)

# Private directory for securely stored KYC documents
KYC_STORAGE_DIR = Path("storage/kyc_documents").resolve()
KYC_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]", "_", name)
    return cleaned[:100]


def _format_doc_info(d: Document) -> CustomerDocumentInfo:
    uploader_name = None
    if getattr(d, "verified_by", None):
        uploader_name = getattr(d.verified_by, "full_name", None) or getattr(d.verified_by, "email", None)
    return CustomerDocumentInfo(
        id=d.id,
        document_type=d.document_type,
        original_filename=d.original_filename,
        file_size_bytes=d.file_size_bytes,
        mime_type=d.mime_type,
        verification_status=d.verification_status,
        uploaded_by_id=d.verified_by_id,
        uploaded_by_name=uploader_name,
        rejection_reason=d.rejection_reason,
        created_at=d.created_at,
    )


def _format_customer_response(c: Customer, pol_count: int = 0) -> InsuranceCustomerResponse:
    """Format Customer model instance into safe, masked response DTO."""
    decrypted_aadhaar = decrypt_kyc_value(c.aadhaar_encrypted)
    masked_aadhaar_str = mask_aadhaar(decrypted_aadhaar)
    masked_pan_str = mask_pan(c.pan_number)

    docs = [_format_doc_info(d) for d in (c.documents or [])]

    return InsuranceCustomerResponse(
        id=c.id,
        first_name=c.first_name,
        last_name=c.last_name,
        full_name=c.full_name,
        phone=c.phone,
        email=c.email,
        gender=c.gender,
        date_of_birth=c.date_of_birth,
        anniversary_date=c.anniversary_date,
        marital_status=c.marital_status,
        nationality=c.nationality,
        state=c.state,
        city=c.city,
        address=c.address,
        pincode=c.pincode,
        occupation=c.occupation,
        source_of_income=c.source_of_income,
        pan_number=masked_pan_str,
        aadhaar_number=masked_aadhaar_str,
        customer_type=c.customer_type or "INDIVIDUAL",
        company_name=c.company_name,
        corporate_code=c.corporate_code,
        gstin=c.gstin,
        contact_person_name=c.contact_person_name,
        contact_person_phone=c.contact_person_phone,
        contact_person_email=c.contact_person_email,
        created_at=c.created_at,
        updated_at=c.updated_at,
        policies_count=pol_count,
        documents=docs,
    )


async def create_customer(
    session: AsyncSession,
    payload: InsuranceCustomerCreate,
    user_id: uuid.UUID | None = None,
) -> Customer:
    """Register a new individual or corporate customer with KYC encryption and validation."""
    ctype = (payload.customer_type or "INDIVIDUAL").strip().upper()

    # 1. Validate Formats
    if payload.pan_number and not is_masked_value(payload.pan_number):
        ok, msg = validate_pan(payload.pan_number)
        if not ok:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    if payload.aadhaar_number and not is_masked_value(payload.aadhaar_number):
        ok, msg = validate_aadhaar(payload.aadhaar_number)
        if not ok:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    if ctype == "CORPORATE" and payload.gstin:
        ok, msg = validate_gstin(payload.gstin)
        if not ok:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    # 2. Check Uniqueness & Duplicate Detection
    # Phone Uniqueness
    phone_clean = payload.phone.strip()
    existing_phone = (
        await session.execute(select(Customer).where(Customer.phone == phone_clean))
    ).scalar_one_or_none()
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Customer with phone number '{phone_clean}' already exists.",
        )

    # Email Uniqueness (if provided)
    email_val = payload.email.strip().lower() if payload.email and payload.email.strip() else None
    if email_val:
        existing_email = (
            await session.execute(select(Customer).where(Customer.email == email_val))
        ).scalar_one_or_none()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Customer with email '{email_val}' already exists.",
            )

    # PAN Uniqueness & Encryption (if provided)
    if payload.pan_number and payload.pan_number.strip() and not is_masked_value(payload.pan_number):
        pan_clean = payload.pan_number.strip().upper()
        existing_pan = (
            await session.execute(select(Customer).where(Customer.pan_number == pan_clean))
        ).scalar_one_or_none()
        if existing_pan:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Customer with PAN '{pan_clean}' is already registered.",
            )
        pan_val = pan_clean
        pan_enc = encrypt_kyc_value(pan_clean)
    else:
        pan_val = None
        pan_enc = None

    # Aadhaar Uniqueness & Encryption (if provided)
    if payload.aadhaar_number and payload.aadhaar_number.strip() and not is_masked_value(payload.aadhaar_number):
        aadh_clean = "".join(c for c in payload.aadhaar_number if c.isdigit())
        aadh_hash = hash_kyc_value(aadh_clean)
        existing_aadh = (
            await session.execute(select(Customer).where(Customer.aadhaar_hash == aadh_hash))
        ).scalar_one_or_none()
        if existing_aadh:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Customer with this Aadhaar number is already registered.",
            )
        aadh_enc = encrypt_kyc_value(aadh_clean)
    else:
        aadh_enc = None
        aadh_hash = None

    # Corporate Code Uniqueness (if corporate)
    corp_code_val = payload.corporate_code.strip().upper() if payload.corporate_code and payload.corporate_code.strip() else None
    if corp_code_val:
        existing_corp = (
            await session.execute(select(Customer).where(Customer.corporate_code == corp_code_val))
        ).scalar_one_or_none()
        if existing_corp:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Corporate Code '{corp_code_val}' is already registered to another client.",
            )

    now = datetime.now(UTC)
    customer = Customer(
        id=uuid.uuid4(),
        first_name=payload.first_name.strip() if payload.first_name else (payload.company_name or "Corporate Client").strip(),
        last_name=payload.last_name.strip() if payload.last_name else "Entity",
        phone=phone_clean,
        email=email_val,
        pan_number=pan_val,
        pan_encrypted=pan_enc,
        aadhaar_encrypted=aadh_enc,
        aadhaar_hash=aadh_hash,
        gender=payload.gender.strip().upper() if payload.gender else "MALE",
        date_of_birth=payload.date_of_birth,
        anniversary_date=payload.anniversary_date,
        marital_status=payload.marital_status.strip() if payload.marital_status else None,
        nationality=payload.nationality.strip() if payload.nationality else "Indian",
        state=payload.state.strip() if payload.state else None,
        city=payload.city.strip() if payload.city else None,
        address=payload.address.strip() if payload.address else None,
        pincode=payload.pincode.strip() if payload.pincode else None,
        occupation=payload.occupation.strip() if payload.occupation else None,
        source_of_income=payload.source_of_income.strip() if payload.source_of_income else None,
        customer_type=ctype,
        company_name=payload.company_name.strip() if payload.company_name else None,
        corporate_code=corp_code_val,
        gstin=payload.gstin.strip().upper() if payload.gstin else None,
        contact_person_name=payload.contact_person_name.strip() if payload.contact_person_name else None,
        contact_person_phone=payload.contact_person_phone.strip() if payload.contact_person_phone else None,
        contact_person_email=payload.contact_person_email.strip().lower() if payload.contact_person_email else None,
        pipeline_status="INSURANCE_CLIENT",
        reference_source="Insurance Agency Portal",
        created_by_id=user_id,
        created_at=now,
        updated_at=now,
    )
    session.add(customer)

    # Audit Trail
    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=user_id,
        action="CUSTOMER_CREATED",
        resource_type="customer",
        resource_id=customer.id,
        state_delta={
            "customer_type": ctype,
            "full_name": customer.full_name,
            "phone": customer.phone,
            "has_pan": bool(pan_val),
            "has_aadhaar": bool(aadh_enc),
        },
        created_at=now,
    )
    session.add(audit)

    await session.commit()
    await session.refresh(customer)
    return customer


async def list_customers(
    session: AsyncSession,
    search: str | None = None,
    customer_type: str | None = None,
    gender: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> PaginatedResponse[InsuranceCustomerResponse]:
    """Retrieve paginated and filtered customers with document counts, policies count, and masked KYC."""
    query = select(Customer).options(
        selectinload(Customer.documents).selectinload(Document.verified_by)
    )

    if search and search.strip():
        s = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(Customer.first_name).like(s),
                func.lower(Customer.last_name).like(s),
                func.lower(Customer.company_name).like(s),
                func.lower(Customer.corporate_code).like(s),
                func.lower(Customer.phone).like(s),
                func.lower(Customer.email).like(s),
                func.lower(Customer.pan_number).like(s),
                func.lower(Customer.gstin).like(s),
            )
        )
    if customer_type and customer_type != "ALL":
        query = query.where(Customer.customer_type == customer_type.upper())
    if gender and gender != "ALL":
        query = query.where(Customer.gender == gender.upper())

    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(Customer.created_at.desc()).offset(offset).limit(page_size)
    customers = (await session.execute(query)).scalars().all()

    items: list[InsuranceCustomerResponse] = []
    for c in customers:
        pol_count_stmt = select(func.count()).where(InsurancePolicy.customer_id == c.id)
        pol_count = (await session.execute(pol_count_stmt)).scalar_one()
        items.append(_format_customer_response(c, pol_count))

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


async def get_customer_by_id(
    session: AsyncSession,
    customer_id: uuid.UUID,
) -> InsuranceCustomerResponse:
    """Retrieve full customer profile with KYC documents, policy count, and masked KYC values."""
    query = (
        select(Customer)
        .options(selectinload(Customer.documents).selectinload(Document.verified_by))
        .where(Customer.id == customer_id)
    )
    customer = (await session.execute(query)).scalar_one_or_none()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found.",
        )

    pol_count_stmt = select(func.count()).where(InsurancePolicy.customer_id == customer.id)
    pol_count = (await session.execute(pol_count_stmt)).scalar_one()

    return _format_customer_response(customer, pol_count)


async def unmask_customer_kyc(
    session: AsyncSession,
    customer_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
) -> dict[str, str | None]:
    """Authorized endpoint for viewing unmasked PAN and Aadhaar for policy underwriting.

    Generates a secure audit log for sensitive KYC access.
    """
    customer = (
        await session.execute(select(Customer).where(Customer.id == customer_id))
    ).scalar_one_or_none()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found.",
        )

    decrypted_aadhaar = decrypt_kyc_value(customer.aadhaar_encrypted)
    decrypted_pan = decrypt_kyc_value(customer.pan_encrypted) or customer.pan_number

    # Audit logging for sensitive KYC access
    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=user_id,
        action="CUSTOMER_KYC_UNMASKED",
        resource_type="customer",
        resource_id=customer.id,
        state_delta={
            "customer_id": str(customer.id),
            "full_name": customer.full_name,
            "access_type": "FULL_KYC_DISCLOSURE",
        },
        created_at=datetime.now(UTC),
    )
    session.add(audit)
    await session.commit()

    return {
        "customer_id": str(customer.id),
        "pan_number": decrypted_pan,
        "aadhaar_number": decrypted_aadhaar,
    }


async def update_customer(
    session: AsyncSession,
    customer_id: uuid.UUID,
    payload: InsuranceCustomerUpdate,
    user_id: uuid.UUID | None = None,
) -> Customer:
    """Update existing customer details without overwriting sensitive values with masked placeholders."""
    customer = (
        await session.execute(select(Customer).where(Customer.id == customer_id))
    ).scalar_one_or_none()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found.",
        )

    actor = None
    if user_id:
        actor = (
            await session.execute(
                select(User).options(selectinload(User.roles)).where(User.id == user_id)
            )
        ).scalar_one_or_none()
    actor_name = actor.full_name if actor else "System User"
    actor_role = actor.roles[0].name if (actor and actor.roles) else "ADMIN"

    changes: list[dict[str, Any]] = []

    # 1. Individual core fields
    if payload.first_name is not None and payload.first_name.strip():
        new_fn = payload.first_name.strip()
        if new_fn != customer.first_name:
            changes.append({
                "field": "first_name",
                "field_label": "First Name",
                "previous": customer.first_name,
                "new": new_fn,
            })
            customer.first_name = new_fn

    if payload.last_name is not None and payload.last_name.strip():
        new_ln = payload.last_name.strip()
        if new_ln != customer.last_name:
            changes.append({
                "field": "last_name",
                "field_label": "Last Name",
                "previous": customer.last_name,
                "new": new_ln,
            })
            customer.last_name = new_ln

    if payload.phone is not None and payload.phone.strip():
        new_phone = payload.phone.strip()
        if new_phone != customer.phone:
            existing = (
                await session.execute(
                    select(Customer).where(Customer.phone == new_phone, Customer.id != customer_id)
                )
            ).scalar_one_or_none()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Phone number '{new_phone}' is already registered to another customer.",
                )
            changes.append({
                "field": "phone",
                "field_label": "Phone Number",
                "previous": customer.phone or "None",
                "new": new_phone,
            })
            customer.phone = new_phone

    # Alternate phone (persisted on contact_person_phone)
    alt_phone_val = payload.alternate_phone if payload.alternate_phone is not None else payload.contact_person_phone
    if alt_phone_val is not None:
        new_alt = alt_phone_val.strip() if alt_phone_val.strip() else None
        if new_alt != customer.contact_person_phone:
            changes.append({
                "field": "alternate_phone",
                "field_label": "Alternate Phone",
                "previous": customer.contact_person_phone or "None",
                "new": new_alt or "None",
            })
            customer.contact_person_phone = new_alt

    if payload.email is not None:
        new_email = payload.email.strip().lower() if payload.email.strip() else None
        if new_email != customer.email:
            if new_email:
                existing = (
                    await session.execute(
                        select(Customer).where(Customer.email == new_email, Customer.id != customer_id)
                    )
                ).scalar_one_or_none()
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Email '{new_email}' is already registered to another customer.",
                    )
            changes.append({
                "field": "email",
                "field_label": "Email Address",
                "previous": customer.email or "None",
                "new": new_email or "None",
            })
            customer.email = new_email

    if payload.gender is not None and payload.gender.strip():
        new_gender = payload.gender.strip().upper()
        if new_gender != customer.gender:
            changes.append({
                "field": "gender",
                "field_label": "Gender",
                "previous": customer.gender or "None",
                "new": new_gender,
            })
            customer.gender = new_gender

    if payload.date_of_birth is not None:
        if payload.date_of_birth != customer.date_of_birth:
            changes.append({
                "field": "date_of_birth",
                "field_label": "Date of Birth",
                "previous": str(customer.date_of_birth) if customer.date_of_birth else "None",
                "new": str(payload.date_of_birth),
            })
            customer.date_of_birth = payload.date_of_birth

    if payload.anniversary_date is not None:
        if payload.anniversary_date != customer.anniversary_date:
            changes.append({
                "field": "anniversary_date",
                "field_label": "Anniversary Date",
                "previous": str(customer.anniversary_date) if customer.anniversary_date else "None",
                "new": str(payload.anniversary_date),
            })
            customer.anniversary_date = payload.anniversary_date

    if payload.marital_status is not None:
        new_ms = payload.marital_status.strip() if payload.marital_status.strip() else None
        if new_ms != customer.marital_status:
            changes.append({
                "field": "marital_status",
                "field_label": "Marital Status",
                "previous": customer.marital_status or "None",
                "new": new_ms or "None",
            })
            customer.marital_status = new_ms

    if payload.nationality is not None:
        new_nat = payload.nationality.strip() if payload.nationality.strip() else "Indian"
        if new_nat != customer.nationality:
            changes.append({
                "field": "nationality",
                "field_label": "Nationality",
                "previous": customer.nationality or "None",
                "new": new_nat,
            })
            customer.nationality = new_nat

    if payload.state is not None:
        new_state = payload.state.strip() if payload.state.strip() else None
        if new_state != customer.state:
            changes.append({
                "field": "state",
                "field_label": "State",
                "previous": customer.state or "None",
                "new": new_state or "None",
            })
            customer.state = new_state

    if payload.city is not None:
        new_city = payload.city.strip() if payload.city.strip() else None
        if new_city != customer.city:
            changes.append({
                "field": "city",
                "field_label": "City",
                "previous": customer.city or "None",
                "new": new_city or "None",
            })
            customer.city = new_city

    if payload.address is not None:
        new_addr = payload.address.strip() if payload.address.strip() else None
        if new_addr != customer.address:
            changes.append({
                "field": "address",
                "field_label": "Address",
                "previous": customer.address or "None",
                "new": new_addr or "None",
            })
            customer.address = new_addr

    if payload.pincode is not None:
        new_pin = payload.pincode.strip() if payload.pincode.strip() else None
        if new_pin != customer.pincode:
            changes.append({
                "field": "pincode",
                "field_label": "PIN Code",
                "previous": customer.pincode or "None",
                "new": new_pin or "None",
            })
            customer.pincode = new_pin

    if payload.occupation is not None:
        new_occ = payload.occupation.strip() if payload.occupation.strip() else None
        if new_occ != customer.occupation:
            changes.append({
                "field": "occupation",
                "field_label": "Occupation",
                "previous": customer.occupation or "None",
                "new": new_occ or "None",
            })
            customer.occupation = new_occ

    if payload.source_of_income is not None:
        new_soi = payload.source_of_income.strip() if payload.source_of_income.strip() else None
        if new_soi != customer.source_of_income:
            changes.append({
                "field": "source_of_income",
                "field_label": "Source of Income",
                "previous": customer.source_of_income or "None",
                "new": new_soi or "None",
            })
            customer.source_of_income = new_soi

    if payload.customer_type is not None:
        new_ct = payload.customer_type.strip().upper()
        if new_ct != customer.customer_type:
            changes.append({
                "field": "customer_type",
                "field_label": "Customer Type",
                "previous": customer.customer_type or "None",
                "new": new_ct,
            })
            customer.customer_type = new_ct

    # 2. Corporate Fields
    if payload.company_name is not None:
        new_cn = payload.company_name.strip() if payload.company_name.strip() else None
        if new_cn != customer.company_name:
            changes.append({
                "field": "company_name",
                "field_label": "Company Name",
                "previous": customer.company_name or "None",
                "new": new_cn or "None",
            })
            customer.company_name = new_cn

    if payload.corporate_code is not None:
        new_corp = payload.corporate_code.strip().upper() if payload.corporate_code.strip() else None
        if new_corp and new_corp != customer.corporate_code:
            existing_c = (
                await session.execute(
                    select(Customer).where(Customer.corporate_code == new_corp, Customer.id != customer_id)
                )
            ).scalar_one_or_none()
            if existing_c:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Corporate Code '{new_corp}' already in use.",
                )
            changes.append({
                "field": "corporate_code",
                "field_label": "Corporate Code",
                "previous": customer.corporate_code or "None",
                "new": new_corp or "None",
            })
            customer.corporate_code = new_corp

    if payload.gstin is not None:
        new_gstin = payload.gstin.strip().upper() if payload.gstin.strip() else None
        if new_gstin and new_gstin != customer.gstin:
            ok, msg = validate_gstin(new_gstin)
            if not ok:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
            changes.append({
                "field": "gstin",
                "field_label": "GSTIN",
                "previous": customer.gstin or "None",
                "new": new_gstin or "None",
            })
            customer.gstin = new_gstin

    if payload.contact_person_name is not None:
        new_cpn = payload.contact_person_name.strip() if payload.contact_person_name.strip() else None
        if new_cpn != customer.contact_person_name:
            changes.append({
                "field": "contact_person_name",
                "field_label": "Contact Person Name",
                "previous": customer.contact_person_name or "None",
                "new": new_cpn or "None",
            })
            customer.contact_person_name = new_cpn

    if payload.contact_person_email is not None:
        new_cpe = payload.contact_person_email.strip().lower() if payload.contact_person_email.strip() else None
        if new_cpe != customer.contact_person_email:
            changes.append({
                "field": "contact_person_email",
                "field_label": "Contact Person Email",
                "previous": customer.contact_person_email or "None",
                "new": new_cpe or "None",
            })
            customer.contact_person_email = new_cpe

    # 3. PAN Update (Ignore if masked placeholder is passed)
    if payload.pan_number is not None and not is_masked_value(payload.pan_number):
        pan_raw = payload.pan_number.strip().upper()
        if pan_raw:
            ok, msg = validate_pan(pan_raw)
            if not ok:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
            if pan_raw != customer.pan_number:
                existing_p = (
                    await session.execute(
                        select(Customer).where(Customer.pan_number == pan_raw, Customer.id != customer_id)
                    )
                ).scalar_one_or_none()
                if existing_p:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"PAN '{pan_raw}' is already registered to another customer.",
                    )
                changes.append({
                    "field": "pan_number",
                    "field_label": "PAN Card",
                    "previous": mask_pan(customer.pan_number),
                    "new": mask_pan(pan_raw),
                })
                customer.pan_number = pan_raw
                customer.pan_encrypted = encrypt_kyc_value(pan_raw)
        else:
            if customer.pan_number:
                changes.append({
                    "field": "pan_number",
                    "field_label": "PAN Card",
                    "previous": mask_pan(customer.pan_number),
                    "new": "Removed",
                })
                customer.pan_number = None
                customer.pan_encrypted = None

    # 4. Aadhaar Update (Ignore if masked placeholder is passed)
    if payload.aadhaar_number is not None and not is_masked_value(payload.aadhaar_number):
        aadh_raw = "".join(c for c in payload.aadhaar_number if c.isdigit())
        if aadh_raw:
            ok, msg = validate_aadhaar(aadh_raw)
            if not ok:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
            aadh_hash = hash_kyc_value(aadh_raw)
            if aadh_hash != customer.aadhaar_hash:
                existing_a = (
                    await session.execute(
                        select(Customer).where(Customer.aadhaar_hash == aadh_hash, Customer.id != customer_id)
                    )
                ).scalar_one_or_none()
                if existing_a:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="This Aadhaar number is already registered to another customer.",
                    )
                prev_dec = decrypt_kyc_value(customer.aadhaar_encrypted)
                changes.append({
                    "field": "aadhaar_number",
                    "field_label": "Aadhaar Card",
                    "previous": mask_aadhaar(prev_dec),
                    "new": mask_aadhaar(aadh_raw),
                })
                customer.aadhaar_encrypted = encrypt_kyc_value(aadh_raw)
                customer.aadhaar_hash = aadh_hash
        else:
            if customer.aadhaar_hash:
                changes.append({
                    "field": "aadhaar_number",
                    "field_label": "Aadhaar Card",
                    "previous": mask_aadhaar(decrypt_kyc_value(customer.aadhaar_encrypted)),
                    "new": "Removed",
                })
                customer.aadhaar_encrypted = None
                customer.aadhaar_hash = None

    now = datetime.now(UTC)
    customer.updated_at = now

    if changes:
        field_names = {c["field"] for c in changes}
        if field_names.issubset({"phone", "alternate_phone"}):
            action_type = "CUSTOMER_PHONE_UPDATED"
            action_title = "Customer Phone Number Updated"
        elif field_names.issubset({"email"}):
            action_type = "CUSTOMER_EMAIL_UPDATED"
            action_title = "Customer Email Updated"
        elif field_names.issubset({"address", "city", "state", "pincode"}):
            action_type = "CUSTOMER_ADDRESS_UPDATED"
            action_title = "Customer Address Updated"
        elif field_names.issubset({"occupation", "source_of_income"}):
            action_type = "CUSTOMER_OCCUPATION_UPDATED"
            action_title = "Customer Occupation Updated"
        else:
            action_type = "CUSTOMER_UPDATED"
            action_title = "Customer Details Updated"

        change_strs = [f"{c['field_label']}: {c['new']}" for c in changes]
        desc = "Changed: " + ", ".join(change_strs)

        audit = AuditLog(
            id=uuid.uuid4(),
            actor_id=user_id,
            action=action_type,
            resource_type="customer",
            resource_id=customer.id,
            state_delta={
                "customer_id": str(customer.id),
                "actor_name": actor_name,
                "actor_role": actor_role,
                "title": action_title,
                "description": desc,
                "changes": changes,
            },
            created_at=now,
        )
        session.add(audit)

    await session.commit()
    await session.refresh(customer)
    return customer


async def upload_customer_kyc_document(
    session: AsyncSession,
    customer_id: uuid.UUID,
    document_type: str,
    file: UploadFile,
    user_id: uuid.UUID | None = None,
) -> Document:
    """Securely upload and register KYC document (Aadhaar, PAN, Address Proof, GSTIN)."""
    customer = (
        await session.execute(select(Customer).where(Customer.id == customer_id))
    ).scalar_one_or_none()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {customer_id} not found.",
        )

    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{content_type}'. Allowed types: PDF, JPG, PNG.",
        )

    content = await file.read()
    file_size = len(content)
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)} MB.",
        )

    sha256 = hashlib.sha256(content).hexdigest()
    ext = ALLOWED_MIME_TYPES[content_type]
    secure_filename = f"{uuid.uuid4().hex}_{sha256[:12]}{ext}"
    storage_file_path = KYC_STORAGE_DIR / secure_filename

    with open(storage_file_path, "wb") as f:
        f.write(content)

    original_clean = _sanitize_filename(file.filename or f"document{ext}")
    now = datetime.now(UTC)

    doc = Document(
        id=uuid.uuid4(),
        customer_id=customer_id,
        document_type=document_type.upper(),
        original_filename=original_clean,
        storage_path=str(storage_file_path),
        file_size_bytes=file_size,
        mime_type=content_type,
        sha256_hash=sha256,
        verification_status="VERIFIED",
        verified_by_id=user_id,
        created_at=now,
    )
    session.add(doc)

    actor = None
    if user_id:
        actor = (
            await session.execute(
                select(User).options(selectinload(User.roles)).where(User.id == user_id)
            )
        ).scalar_one_or_none()
    actor_name = actor.full_name if actor else "Enterprise User"
    actor_role = actor.roles[0].name if (actor and actor.roles) else "STAFF"

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=user_id,
        action="CUSTOMER_DOCUMENT_UPLOADED",
        resource_type="customer",
        resource_id=customer_id,
        state_delta={
            "customer_id": str(customer_id),
            "document_id": str(doc.id),
            "document_type": document_type.upper(),
            "filename": original_clean,
            "size": file_size,
            "actor_name": actor_name,
            "actor_role": actor_role,
            "title": f"Document Uploaded: {original_clean}",
            "description": f"Uploaded {document_type.replace('_', ' ').title()} document ({file_size // 1024} KB)",
            "changes": [
                {
                    "field": "document_type",
                    "field_label": "Document Type",
                    "previous": "None",
                    "new": document_type.replace("_", " ").title(),
                },
                {
                    "field": "filename",
                    "field_label": "File Name",
                    "previous": "None",
                    "new": original_clean,
                },
                {
                    "field": "file_size",
                    "field_label": "File Size",
                    "previous": "None",
                    "new": f"{max(1, file_size // 1024)} KB",
                },
            ],
        },
        created_at=now,
    )
    session.add(audit)

    await session.commit()
    await session.refresh(doc)
    return doc


async def verify_customer_kyc_document(
    session: AsyncSession,
    customer_id: uuid.UUID,
    document_id: uuid.UUID,
    verification_status: str,
    user_id: uuid.UUID | None = None,
    remarks: str | None = None,
) -> Document:
    """Verify or unverify customer KYC document with audit logging."""
    doc = (
        await session.execute(
            select(Document).where(
                Document.id == document_id,
                Document.customer_id == customer_id,
            )
        )
    ).scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found for this customer.",
        )

    prev_status = doc.verification_status
    new_status = verification_status.strip().upper()
    doc.verification_status = new_status
    doc.verified_by_id = user_id
    if remarks is not None:
        doc.rejection_reason = remarks.strip() if remarks.strip() else None

    actor = None
    if user_id:
        actor = (
            await session.execute(
                select(User).options(selectinload(User.roles)).where(User.id == user_id)
            )
        ).scalar_one_or_none()
    actor_name = actor.full_name if actor else "Supervisor"
    actor_role = actor.roles[0].name if (actor and actor.roles) else "ADMIN"

    now = datetime.now(UTC)
    is_verified = new_status == "VERIFIED"
    action_type = "CUSTOMER_DOCUMENT_VERIFIED" if is_verified else "CUSTOMER_DOCUMENT_UNVERIFIED"
    action_title = f"Document {'Verified' if is_verified else 'Marked Unverified'}: {doc.original_filename}"

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=user_id,
        action=action_type,
        resource_type="customer",
        resource_id=customer_id,
        state_delta={
            "customer_id": str(customer_id),
            "document_id": str(doc.id),
            "document_type": doc.document_type,
            "filename": doc.original_filename,
            "actor_name": actor_name,
            "actor_role": actor_role,
            "title": action_title,
            "description": f"Verification status changed from {prev_status} to {new_status}" + (f" (Remarks: {remarks})" if remarks else ""),
            "changes": [
                {
                    "field": "verification_status",
                    "field_label": "Verification Status",
                    "previous": prev_status,
                    "new": new_status,
                }
            ],
        },
        created_at=now,
    )
    session.add(audit)
    await session.commit()
    await session.refresh(doc)
    return doc


async def delete_customer_kyc_document(
    session: AsyncSession,
    customer_id: uuid.UUID,
    document_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    """Securely remove customer KYC document from disk and database with audit logging."""
    doc = (
        await session.execute(
            select(Document).where(
                Document.id == document_id,
                Document.customer_id == customer_id,
            )
        )
    ).scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document record not found.",
        )

    file_name = doc.original_filename
    doc_type = doc.document_type
    p = Path(doc.storage_path)
    if p.exists():
        p.unlink(missing_ok=True)

    actor = None
    if user_id:
        actor = (
            await session.execute(
                select(User).options(selectinload(User.roles)).where(User.id == user_id)
            )
        ).scalar_one_or_none()
    actor_name = actor.full_name if actor else "Supervisor"
    actor_role = actor.roles[0].name if (actor and actor.roles) else "ADMIN"

    now = datetime.now(UTC)
    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=user_id,
        action="CUSTOMER_DOCUMENT_DELETED",
        resource_type="customer",
        resource_id=customer_id,
        state_delta={
            "customer_id": str(customer_id),
            "document_id": str(document_id),
            "document_type": doc_type,
            "filename": file_name,
            "actor_name": actor_name,
            "actor_role": actor_role,
            "title": f"Document Deleted: {file_name}",
            "description": f"Document {doc_type} ({file_name}) was deleted by {actor_name}",
            "changes": [
                {
                    "field": "document",
                    "field_label": "Deleted Document",
                    "previous": f"{doc_type} ({file_name})",
                    "new": "Deleted / Removed",
                }
            ],
        },
        created_at=now,
    )
    session.add(audit)

    await session.delete(doc)
    await session.commit()
    return {"message": f"Document '{file_name}' deleted successfully."}


async def add_customer_note(
    session: AsyncSession,
    customer_id: uuid.UUID,
    note: str,
    user_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    """Add customer interaction note and record audit trail."""
    customer = (
        await session.execute(select(Customer).where(Customer.id == customer_id))
    ).scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    actor = None
    if user_id:
        actor = (
            await session.execute(
                select(User).options(selectinload(User.roles)).where(User.id == user_id)
            )
        ).scalar_one_or_none()
    actor_name = actor.full_name if actor else "Staff"
    actor_role = actor.roles[0].name if (actor and actor.roles) else "STAFF"

    now = datetime.now(UTC)
    note_obj = CustomerNote(
        id=uuid.uuid4(),
        customer_id=customer_id,
        author_id=user_id,
        content=note.strip(),
        created_at=now,
    )
    session.add(note_obj)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=user_id,
        action="CUSTOMER_NOTE_ADDED",
        resource_type="customer",
        resource_id=customer_id,
        state_delta={
            "customer_id": str(customer_id),
            "actor_name": actor_name,
            "actor_role": actor_role,
            "title": "Customer Interaction Note Added",
            "description": note.strip()[:150] + ("..." if len(note.strip()) > 150 else ""),
            "changes": [
                {
                    "field": "note",
                    "field_label": "Interaction Note",
                    "previous": "None",
                    "new": note.strip(),
                }
            ],
        },
        created_at=now,
    )
    session.add(audit)
    await session.commit()
    return {"message": "Note added successfully.", "note_id": str(note_obj.id)}


async def get_document_for_download(
    session: AsyncSession,
    customer_id: uuid.UUID,
    document_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
) -> tuple[Path, str, str]:
    """Retrieve document path, filename, and mime type for authorized streaming download with audit logging."""
    doc = (
        await session.execute(
            select(Document).where(
                Document.id == document_id,
                Document.customer_id == customer_id,
            )
        )
    ).scalar_one_or_none()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document record not found.",
        )

    path = Path(doc.storage_path)
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical document file missing from storage.",
        )

    actor = None
    if user_id:
        actor = (
            await session.execute(
                select(User).options(selectinload(User.roles)).where(User.id == user_id)
            )
        ).scalar_one_or_none()
    actor_name = actor.full_name if actor else "Enterprise User"
    actor_role = actor.roles[0].name if (actor and actor.roles) else "STAFF"

    # Audit logging for sensitive document download
    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=user_id,
        action="CUSTOMER_DOCUMENT_DOWNLOADED",
        resource_type="customer",
        resource_id=customer_id,
        state_delta={
            "customer_id": str(customer_id),
            "document_id": str(doc.id),
            "document_type": doc.document_type,
            "filename": doc.original_filename,
            "actor_name": actor_name,
            "actor_role": actor_role,
            "title": f"Document Downloaded: {doc.original_filename}",
            "description": f"Downloaded {doc.document_type} ({doc.original_filename})",
        },
        created_at=datetime.now(UTC),
    )
    session.add(audit)
    await session.commit()

    return path, doc.original_filename, doc.mime_type



# ===========================================================================
# CUSTOMER 360° PROFILE & HISTORY DASHBOARD SERVICE
# ===========================================================================

from app.db.models.insurance import (
    InsuranceCompany,
    InsurancePlan,
    InsuranceFamilyGroup,
    InsuranceFamilyMember,
    InsurancePolicyNominee,
    InsurancePolicyMember,
    InsurancePolicyDocument,
    InsurancePolicyPayment,
    InsurancePremiumSchedule,
    InsurancePolicyCommission,
)
from app.db.models.crm import WorkOrder, WorkCategory
from app.db.models.auth import User
from app.schemas.insurance import (
    Customer360Response,
    Customer360Profile,
    Customer360KPIs,
    Customer360Category,
    Customer360Family,
    Customer360FamilyMember,
    Customer360PolicyNominee,
    Customer360PolicyMember,
    Customer360Policy,
    Customer360YearGroup,
    Customer360Payment,
    Customer360PremiumSummary,
    Customer360Claim,
    Customer360TimelineEvent,
)
from app.services.insurance.quotation_service import calculate_exact_age
from app.services.insurance.policy_service import get_customer_family_group_members


def _format_exact_age_safe(dob: date | None, ref_date: date) -> tuple[str | None, int | None]:
    """Helper to compute exact human-readable age and completed years."""
    if not dob:
        return None, None
    try:
        years, months, days = calculate_exact_age(dob, ref_date)
        age_str = f"{years} Years"
        if months > 0:
            age_str += f", {months} Months"
        return age_str, years
    except Exception:
        years = ref_date.year - dob.year - ((ref_date.month, ref_date.day) < (dob.month, dob.day))
        return f"{years} Years", years


def _classify_insurance_category(
    policy_type: str | None,
    plan_lob: str | None,
    company_cat: str | None,
) -> tuple[str, str, str]:
    """Classify policy into 1 of the 8 canonical FinNexus insurance categories."""
    combined = f"{policy_type or ''} {plan_lob or ''} {company_cat or ''}".lower()
    if any(k in combined for k in ["health", "mediclaim", "medical", "critical"]):
        return "Health Insurance", "HEALTH", "HeartPulse"
    if any(k in combined for k in ["life", "term", "endowment", "ulip", "annuity", "pension"]):
        return "Life Insurance", "LIFE", "Shield"
    if any(k in combined for k in ["marine", "cargo", "hull", "transit", "freight"]):
        return "Marine Insurance", "MARINE", "Ship"
    if any(k in combined for k in ["travel", "overseas", "flight", "trip"]):
        return "Travel Insurance", "TRAVEL", "Plane"
    if any(k in combined for k in ["fire", "flame", "conflagration"]):
        return "Fire Insurance", "FIRE", "Flame"
    if any(k in combined for k in ["home", "house", "property", "dwelling"]):
        return "Home Insurance", "HOME", "Home"
    if any(k in combined for k in ["motor", "car", "bike", "vehicle", "two wheeler", "four wheeler", "auto"]):
        return "Motor Insurance", "MOTOR", "Car"
    return "Other Insurance", "OTHER", "FileText"


async def get_customer_360_profile(
    session: AsyncSession,
    customer_id: uuid.UUID,
    current_user: User,
) -> Customer360Response:
    """Retrieve complete, unified 360-degree customer profile, portfolio, policies, family, and history."""
    today = datetime.now(UTC).date()
    now_utc = datetime.now(UTC)

    # 1. Fetch Customer with KYC Documents and verified_by
    stmt = (
        select(Customer)
        .options(selectinload(Customer.documents).selectinload(Document.verified_by))
        .where(Customer.id == customer_id)
    )
    customer = (await session.execute(stmt)).scalar_one_or_none()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer record not found.",
        )

    # Check RBAC for commission viewing
    user_roles = getattr(current_user, "roles", [])
    if not isinstance(user_roles, list):
        user_roles = [user_roles]
    role_names = [getattr(r, "name", str(r)) for r in user_roles]
    can_view_commission = any(
        rn in ["SUPER_ADMIN", "ADMIN", "MANAGER"] for rn in role_names
    )

    # 2. Format Masked KYC & Age
    decrypted_aadhaar = decrypt_kyc_value(customer.aadhaar_encrypted)
    masked_aadhaar_str = mask_aadhaar(decrypted_aadhaar)
    decrypted_pan = decrypt_kyc_value(customer.pan_encrypted) or customer.pan_number
    masked_pan_str = mask_pan(decrypted_pan)
    exact_age_str, exact_age_years = _format_exact_age_safe(customer.date_of_birth, today)

    customer_code = (
        customer.corporate_code
        if (customer.customer_type == "CORPORATE" and customer.corporate_code)
        else f"CUST-{customer.id.hex[:8].upper()}"
    )

    # 3. Fetch Customer Documents
    customer_docs = [_format_doc_info(d) for d in (customer.documents or [])]

    profile_dto = Customer360Profile(
        id=customer.id,
        customer_code=customer_code,
        first_name=customer.first_name,
        last_name=customer.last_name,
        full_name=customer.full_name,
        phone=customer.phone,
        alternate_phone=customer.contact_person_phone or None,
        email=customer.email,
        gender=customer.gender,
        date_of_birth=customer.date_of_birth,
        exact_age=exact_age_str,
        exact_age_years=exact_age_years,
        anniversary_date=customer.anniversary_date,
        marital_status=customer.marital_status,
        nationality=customer.nationality or "Indian",
        occupation=customer.occupation,
        source_of_income=customer.source_of_income,
        address=customer.address,
        state=customer.state,
        city=customer.city,
        pincode=customer.pincode,
        pan_number=masked_pan_str,
        aadhaar_number=masked_aadhaar_str,
        has_pan=bool(customer.pan_number or customer.pan_encrypted),
        has_aadhaar=bool(customer.aadhaar_encrypted or customer.aadhaar_hash),
        customer_type=customer.customer_type or "INDIVIDUAL",
        company_name=customer.company_name,
        corporate_code=customer.corporate_code,
        gstin=customer.gstin,
        contact_person_name=customer.contact_person_name,
        contact_person_phone=customer.contact_person_phone,
        contact_person_email=customer.contact_person_email,
        is_archived=customer.is_archived,
        status_label="INACTIVE" if customer.is_archived else "ACTIVE",
        documents=customer_docs,
        created_at=customer.created_at,
        updated_at=customer.updated_at,
    )

    # 4. Fetch All Customer Policies with Eager Loading
    pol_stmt = (
        select(InsurancePolicy)
        .options(
            selectinload(InsurancePolicy.company),
            selectinload(InsurancePolicy.plan),
            selectinload(InsurancePolicy.nominees),
            selectinload(InsurancePolicy.members),
            selectinload(InsurancePolicy.documents),
            selectinload(InsurancePolicy.payments),
            selectinload(InsurancePolicy.premium_schedules),
            selectinload(InsurancePolicy.commissions),
        )
        .where(InsurancePolicy.customer_id == customer_id)
        .order_by(
            InsurancePolicy.issue_date.desc().nullslast(),
            InsurancePolicy.policy_start_date.desc(),
        )
    )
    raw_policies = (await session.execute(pol_stmt)).scalars().all()

    # Pre-build lookup for renewal links
    policy_by_id = {p.id: p for p in raw_policies}
    renewed_into_map = {}
    for p in raw_policies:
        if p.previous_policy_id and p.previous_policy_id in policy_by_id:
            renewed_into_map[p.previous_policy_id] = p

    # Canonical Category Buckets
    category_buckets = {
        "HEALTH": {"name": "Health Insurance", "icon": "HeartPulse", "total": 0, "active": 0, "si": Decimal("0.00"), "prem": Decimal("0.00")},
        "LIFE": {"name": "Life Insurance", "icon": "Shield", "total": 0, "active": 0, "si": Decimal("0.00"), "prem": Decimal("0.00")},
        "MOTOR": {"name": "Motor Insurance", "icon": "Car", "total": 0, "active": 0, "si": Decimal("0.00"), "prem": Decimal("0.00")},
        "TRAVEL": {"name": "Travel Insurance", "icon": "Plane", "total": 0, "active": 0, "si": Decimal("0.00"), "prem": Decimal("0.00")},
        "FIRE": {"name": "Fire Insurance", "icon": "Flame", "total": 0, "active": 0, "si": Decimal("0.00"), "prem": Decimal("0.00")},
        "HOME": {"name": "Home Insurance", "icon": "Home", "total": 0, "active": 0, "si": Decimal("0.00"), "prem": Decimal("0.00")},
        "MARINE": {"name": "Marine Insurance", "icon": "Ship", "total": 0, "active": 0, "si": Decimal("0.00"), "prem": Decimal("0.00")},
        "OTHER": {"name": "Other Insurance", "icon": "FileText", "total": 0, "active": 0, "si": Decimal("0.00"), "prem": Decimal("0.00")},
    }

    formatted_policies: list[Customer360Policy] = []
    payments_list: list[Customer360Payment] = []
    total_paid_premium = Decimal("0.00")
    total_gross_premium = Decimal("0.00")
    overdue_premium_amount = Decimal("0.00")
    upcoming_due_dates = []
    upcoming_renewals_count = 0
    active_policies_count = 0
    expired_policies_count = 0
    total_active_sum_insured = Decimal("0.00")

    for p in raw_policies:
        comp_name = p.company.name if p.company else None
        comp_code = p.company.code if p.company else None
        comp_cat = p.company.category if p.company else None
        plan_name = p.plan.name if p.plan else None
        plan_code = p.plan.code if p.plan else None
        plan_lob = p.plan.line_of_business if p.plan else None

        cat_name, cat_key, _ = _classify_insurance_category(p.policy_type, plan_lob, comp_cat)

        sum_ins = Decimal(str(p.sum_assured or Decimal("0.00")))
        gross_prem = Decimal(str(p.final_premium or Decimal("0.00")))
        net_prem = Decimal(str(p.net_premium)) if p.net_premium is not None else None
        total_gross_premium += gross_prem

        # Status & renewal logic
        is_active = (p.status in ["ACTIVE", "ISSUED"] and p.expiry_date >= today)
        is_expired = (p.status == "EXPIRED" or p.expiry_date < today)
        if is_active:
            active_policies_count += 1
            total_active_sum_insured += sum_ins
        if is_expired:
            expired_policies_count += 1

        days_to_expiry = (p.expiry_date - today).days
        if 0 <= days_to_expiry <= 30 and p.status in ["ACTIVE", "ISSUED"]:
            upcoming_renewals_count += 1
            renewal_status = "UPCOMING"
        elif is_expired:
            renewal_status = "EXPIRED"
        elif p.business_type == "RENEWAL":
            renewal_status = "RENEWED"
        else:
            renewal_status = "NOT_DUE"

        # Tally in category bucket
        b = category_buckets[cat_key]
        b["total"] += 1
        if is_active:
            b["active"] += 1
        b["si"] += sum_ins
        b["prem"] += gross_prem

        # Renewal chains
        prev_num = policy_by_id[p.previous_policy_id].policy_number if p.previous_policy_id in policy_by_id else p.previous_policy_number
        renewed_into = renewed_into_map.get(p.id)
        renewed_into_id = renewed_into.id if renewed_into else None
        renewed_into_num = renewed_into.policy_number if renewed_into else None

        # Document download url
        doc_url = None
        if p.documents:
            first_doc = p.documents[0]
            doc_url = f"/api/v1/insurance/policies/{p.id}/documents/{first_doc.id}/download"

        # Commission
        comm_amt = None
        if can_view_commission and p.commissions:
            comm_amt = sum(
                (
                    getattr(c, "firm_net_amount", None)
                    or getattr(c, "gross_commission_amount", None)
                    or getattr(c, "net_firm_commission_amount", None)
                    or Decimal("0.00")
                )
                for c in p.commissions
            )

        nominees_dto = [
            Customer360PolicyNominee(
                id=n.id,
                nominee_name=getattr(n, "full_name", None) or getattr(n, "nominee_name", "Nominee"),
                relationship=n.relationship or "Nominee",
                share_percentage=Decimal(str(n.share_percentage or 100)),
                date_of_birth=n.date_of_birth,
            )
            for n in (p.nominees or [])
        ]

        members_dto = [
            Customer360PolicyMember(
                id=m.id,
                member_name=getattr(m, "full_name", None) or getattr(m, "member_name", "Member"),
                relationship=m.relationship or "Insured",
                date_of_birth=m.date_of_birth,
                sum_insured=Decimal(str(m.sum_insured)) if getattr(m, "sum_insured", None) is not None else None,
            )
            for m in (p.members or [])
        ]

        issue_year = getattr(p, "issue_year", None) or (p.issue_date.year if p.issue_date else p.policy_start_date.year)

        dto = Customer360Policy(
            id=p.id,
            policy_number=p.policy_number,
            policy_type=p.policy_type,
            company_id=p.company_id,
            company_name=comp_name,
            company_code=comp_code,
            plan_id=p.plan_id,
            plan_name=plan_name,
            plan_code=plan_code,
            category=cat_name,
            business_type=p.business_type or "NEW",
            issue_date=p.issue_date,
            issue_year=issue_year,
            start_date=p.policy_start_date,
            expiry_date=p.expiry_date,
            sum_insured=sum_ins,
            gross_premium=gross_prem,
            net_premium=net_prem,
            payment_frequency=p.premium_mode or "YEARLY",
            status=p.status,
            renewal_status=renewal_status,
            nominee_count=len(p.nominees or []),
            member_count=len(p.members or []),
            nominees=nominees_dto,
            members=members_dto,
            previous_policy_id=p.previous_policy_id,
            previous_policy_number=prev_num,
            renewed_into_policy_id=renewed_into_id,
            renewed_into_policy_number=renewed_into_num,
            documents_count=len(p.documents or []),
            payments_count=len(p.payments or []),
            document_download_url=doc_url,
            can_view_commission=can_view_commission,
            commission_amount=comm_amt,
        )
        formatted_policies.append(dto)

        # Collect payments
        for pay in (p.payments or []):
            amt = Decimal(str(pay.amount or 0))
            st = getattr(pay, "status", None) or getattr(pay, "payment_status", "COMPLETED")
            if str(st).upper() in ["COMPLETED", "SUCCESS", "PAID"]:
                total_paid_premium += amt
            payments_list.append(
                Customer360Payment(
                    id=pay.id,
                    policy_id=p.id,
                    policy_number=p.policy_number,
                    payment_date=pay.payment_date,
                    amount=amt,
                    payment_mode=pay.payment_mode or "UPI",
                    transaction_reference=pay.transaction_reference,
                    payment_status=st or "COMPLETED",
                    document_id=getattr(pay, "document_id", None),
                    receipt_filename=pay.document.original_filename if getattr(pay, "document", None) else None,
                )
            )

        # Collect upcoming and overdue schedules
        for sch in (p.premium_schedules or []):
            sch_amt = Decimal(str(sch.amount or 0))
            if sch.status in ["PENDING", "OVERDUE"]:
                if sch.due_date < today:
                    overdue_premium_amount += sch_amt
                else:
                    upcoming_due_dates.append(sch.due_date)

    # Sort payments descending
    payments_list.sort(key=lambda x: x.payment_date, reverse=True)

    # Year-wise Grouping
    year_groups_dict: dict[int, list[Customer360Policy]] = {}
    for p_dto in formatted_policies:
        year_groups_dict.setdefault(p_dto.issue_year, []).append(p_dto)

    year_groups: list[Customer360YearGroup] = []
    for yr in sorted(year_groups_dict.keys(), reverse=True):
        p_list = year_groups_dict[yr]
        year_groups.append(
            Customer360YearGroup(
                year=yr,
                total_policies=len(p_list),
                total_sum_insured=sum(x.sum_insured for x in p_list),
                total_premium=sum(x.gross_premium for x in p_list),
                policies=p_list,
            )
        )

    # 5. Fetch Family Group Details
    family_dto = None
    try:
        raw_family = await get_customer_family_group_members(session, customer_id)
        if raw_family and raw_family.get("id"):
            members_list: list[Customer360FamilyMember] = []
            for m in raw_family.get("members", []):
                m_dob = m.get("date_of_birth")
                m_age_str, _ = _format_exact_age_safe(m_dob, today)
                m_cust_id = m.get("customer_id")
                # Count linked policies for this family member
                linked_pols = 0
                if m_cust_id:
                    linked_pols = sum(
                        1 for pol in raw_policies if str(pol.customer_id) == str(m_cust_id)
                    )

                rel = m.get("relationship", "DEPENDENT").upper()
                label_map = {
                    "PRIMARY_HEAD": "Primary Head",
                    "SPOUSE": "Spouse",
                    "CHILD": "Child",
                    "PARENT": "Parent",
                    "DEPENDENT": "Dependent",
                    "OTHER": "Other",
                }
                members_list.append(
                    Customer360FamilyMember(
                        id=uuid.UUID(str(m["id"])),
                        customer_id=uuid.UUID(str(m_cust_id)) if m_cust_id else None,
                        name=m.get("customer_name") or m.get("name") or "Family Member",
                        relationship=rel,
                        relationship_label=label_map.get(rel, rel.title()),
                        date_of_birth=m_dob,
                        exact_age=m_age_str,
                        gender=m.get("gender"),
                        phone=m.get("phone"),
                        email=m.get("email"),
                        linked_policies_count=linked_pols,
                        is_dependent=m.get("is_dependent", True),
                        notes=m.get("notes"),
                    )
                )

            family_dto = Customer360Family(
                group_id=uuid.UUID(str(raw_family["id"])),
                group_name=raw_family.get("name") or f"{customer.last_name} Family",
                primary_head_id=uuid.UUID(str(raw_family["primary_head_id"])),
                primary_head_name=raw_family.get("primary_head_name") or customer.full_name,
                members=members_list,
            )
    except Exception:
        family_dto = None

    total_family_members_count = len(family_dto.members) if family_dto else 0

    # 6. Fetch Claims (Operational CRM Claims)
    claims_list: list[Customer360Claim] = []
    try:
        wo_stmt = (
            select(WorkOrder)
            .join(WorkCategory, WorkOrder.category_id == WorkCategory.id)
            .where(
                WorkOrder.client_id == customer_id,
                WorkCategory.code == "WORK_INSURANCE_CLAIM",
            )
            .order_by(WorkOrder.created_at.desc())
        )
        claim_orders = (await session.execute(wo_stmt)).scalars().all()
        for wo in claim_orders:
            settle_date = wo.completed_at.date() if wo.completed_at else None
            claims_list.append(
                Customer360Claim(
                    id=wo.id,
                    claim_number=wo.order_number,
                    policy_id=None,
                    policy_number=None,
                    claim_type=wo.title,
                    claim_date=wo.created_at,
                    claim_amount=None,
                    approved_amount=None,
                    claim_status=wo.status,
                    settlement_date=settle_date,
                    description=wo.description,
                )
            )
    except Exception:
        claims_list = []

    # 7. Build Chronological Activity Timeline
    timeline_events: list[Customer360TimelineEvent] = []

    # A. Customer Created Base Event
    creator_name = "System"
    creator_role = "SYSTEM"
    creator_id = customer.created_by_id
    if customer.created_by_id:
        try:
            creator = (
                await session.execute(
                    select(User).options(selectinload(User.roles)).where(User.id == customer.created_by_id)
                )
            ).scalar_one_or_none()
            if creator:
                creator_name = creator.full_name or creator.email
                creator_role = creator.roles[0].name if creator.roles else "ADMIN"
        except Exception:
            pass

    timeline_events.append(
        Customer360TimelineEvent(
            id=f"evt_reg_{customer.id}",
            event_type="CUSTOMER_CREATED",
            title="Customer Profile Created",
            description=f"Client registered as {customer.customer_type or 'INDIVIDUAL'} profile",
            timestamp=customer.created_at,
            actor_id=creator_id,
            actor_name=creator_name,
            actor_role=creator_role,
            badge_color="emerald",
            icon="user-plus",
            changes=[
                {"field": "customer_type", "field_label": "Customer Type", "previous": "None", "new": customer.customer_type or "INDIVIDUAL"},
                {"field": "full_name", "field_label": "Customer Name", "previous": "None", "new": customer.full_name},
                {"field": "phone", "field_label": "Phone Number", "previous": "None", "new": customer.phone},
            ],
            details={"customer_id": str(customer.id), "full_name": customer.full_name},
        )
    )

    # B. Policy Events
    for p in formatted_policies:
        timeline_events.append(
            Customer360TimelineEvent(
                id=f"evt_pol_iss_{p.id}",
                event_type="POLICY_ISSUED",
                title=f"Policy Issued: {p.policy_number}",
                description=f"{p.company_name or 'Insurer'} - {p.plan_name or p.category} (Sum Insured: ₹{p.sum_insured:,.0f})",
                timestamp=datetime.combine(p.issue_date or p.start_date, datetime.min.time()).replace(tzinfo=UTC),
                actor_name="Insurance Desk",
                actor_role="STAFF",
                badge_color="indigo",
                icon="shield-check",
                changes=[
                    {"field": "policy_number", "field_label": "Policy Number", "previous": "None", "new": p.policy_number},
                    {"field": "insurer", "field_label": "Insurance Company", "previous": "None", "new": p.company_name or "N/A"},
                    {"field": "sum_insured", "field_label": "Sum Insured", "previous": "None", "new": f"₹{p.sum_insured:,.0f}"},
                    {"field": "gross_premium", "field_label": "Gross Premium", "previous": "None", "new": f"₹{p.gross_premium:,.0f}"},
                ],
                details={"policy_id": str(p.id), "policy_number": p.policy_number},
            )
        )
        if p.business_type == "RENEWAL":
            timeline_events.append(
                Customer360TimelineEvent(
                    id=f"evt_pol_ren_{p.id}",
                    event_type="POLICY_RENEWED",
                    title=f"Policy Contract Renewed: {p.policy_number}",
                    description=f"Renewed from prior contract {p.previous_policy_number or ''}",
                    timestamp=datetime.combine(p.start_date, datetime.min.time()).replace(tzinfo=UTC),
                    actor_name="Renewal Desk",
                    actor_role="STAFF",
                    badge_color="purple",
                    icon="refresh-cw",
                    changes=[
                        {"field": "renewal", "field_label": "Renewal Contract", "previous": p.previous_policy_number or "Initial", "new": p.policy_number},
                    ],
                    details={"policy_id": str(p.id), "previous_policy_number": p.previous_policy_number},
                )
            )

    # C. Payment Events
    for pay in payments_list:
        timeline_events.append(
            Customer360TimelineEvent(
                id=f"evt_pay_{pay.id}",
                event_type="PAYMENT_RECEIVED",
                title=f"Premium Payment Received: ₹{pay.amount:,.2f}",
                description=f"Mode: {pay.payment_mode} (Ref: {pay.transaction_reference or 'N/A'}) for Policy #{pay.policy_number}",
                timestamp=datetime.combine(pay.payment_date, datetime.min.time()).replace(tzinfo=UTC),
                actor_name="Accounts Desk",
                actor_role="ACCOUNTANT",
                badge_color="teal",
                icon="credit-card",
                changes=[
                    {"field": "amount", "field_label": "Amount Paid", "previous": "Pending", "new": f"₹{pay.amount:,.2f}"},
                    {"field": "mode", "field_label": "Payment Mode", "previous": "None", "new": pay.payment_mode},
                    {"field": "ref", "field_label": "Transaction Reference", "previous": "None", "new": pay.transaction_reference or "N/A"},
                ],
                details={"payment_id": str(pay.id), "policy_number": pay.policy_number},
            )
        )

    # D. Audit Logs
    try:
        policy_ids = [p.id for p in raw_policies]
        doc_ids = [d.id for d in (customer.documents or [])]
        audit_filters = [
            AuditLog.resource_id == customer_id,
        ]
        if doc_ids:
            audit_filters.append(
                and_(
                    AuditLog.resource_type.in_(["customer_document", "document"]),
                    AuditLog.resource_id.in_(doc_ids),
                )
            )
        if policy_ids:
            audit_filters.append(
                and_(
                    AuditLog.resource_type.in_(["policy", "insurance_policy"]),
                    AuditLog.resource_id.in_(policy_ids),
                )
            )
        audit_records = (
            await session.execute(
                select(AuditLog)
                .options(selectinload(AuditLog.actor).selectinload(User.roles))
                .where(or_(*audit_filters))
                .order_by(AuditLog.created_at.desc())
                .limit(50)
            )
        ).scalars().all()

        for a in audit_records:
            if a.action == "CUSTOMER_CREATED":
                continue  # Base event already added

            delta = a.state_delta or {}
            actor_name = delta.get("actor_name")
            actor_role = delta.get("actor_role")
            if a.actor:
                actor_name = actor_name or a.actor.full_name or a.actor.email
                if a.actor.roles:
                    actor_role = actor_role or a.actor.roles[0].name
            actor_name = actor_name or "Enterprise User"
            actor_role = actor_role or "ADMIN"

            title = delta.get("title")
            if not title:
                act_clean = (
                    a.action.replace("CUSTOMER_KYC_", "")
                    .replace("CUSTOMER_", "")
                    .replace("INSURANCE_POLICY_", "")
                    .replace("_", " ")
                    .title()
                )
                title = f"Customer {act_clean}" if not act_clean.startswith("Customer") else act_clean

            description = delta.get("description") or f"Action performed on {a.resource_type}"
            changes = delta.get("changes") or []
            if not changes and "updated_fields" in delta:
                field_labels = {
                    "first_name": "First Name",
                    "last_name": "Last Name",
                    "phone": "Phone Number",
                    "alternate_phone": "Alternate Phone",
                    "email": "Email Address",
                    "city": "City",
                    "state": "State",
                    "pincode": "PIN Code",
                    "address": "Address",
                    "occupation": "Occupation",
                    "gender": "Gender",
                    "date_of_birth": "Date of Birth",
                }
                changes = [
                    {
                        "field": f,
                        "field_label": field_labels.get(f, f.replace("_", " ").title()),
                        "previous": "Prior value",
                        "new": "Updated",
                    }
                    for f in delta["updated_fields"]
                ]

            act_str = a.action.upper()
            if "DELETE" in act_str:
                badge_color = "rose"
                icon = "trash-2"
            elif "VERIF" in act_str:
                badge_color = "emerald"
                icon = "shield-check"
            elif "UPLOAD" in act_str:
                badge_color = "teal"
                icon = "file-up"
            elif any(k in act_str for k in ["UPDATE", "PHONE", "EMAIL", "ADDRESS", "OCCUPATION"]):
                badge_color = "amber"
                icon = "edit"
            elif "NOTE" in act_str:
                badge_color = "sky"
                icon = "file-text"
            elif "UNMASK" in act_str:
                badge_color = "purple"
                icon = "eye"
            else:
                badge_color = "indigo"
                icon = "activity"

            timeline_events.append(
                Customer360TimelineEvent(
                    id=f"evt_audit_{a.id}",
                    event_type=a.action,
                    title=title,
                    description=description,
                    timestamp=a.created_at,
                    actor_id=a.actor_id,
                    actor_name=actor_name,
                    actor_role=actor_role,
                    badge_color=badge_color,
                    icon=icon,
                    changes=changes,
                    details=delta,
                )
            )
    except Exception:
        pass

    timeline_events.sort(key=lambda x: x.timestamp, reverse=True)

    # 8. Portfolio Categories List
    categories_list = [
        Customer360Category(
            category=v["name"],
            key=k,
            icon=v["icon"],
            total_policies=v["total"],
            policy_count=v["total"],
            active_policies=v["active"],
            active_policy_count=v["active"],
            total_sum_insured=v["si"],
            total_premium=v["prem"],
        )
        for k, v in category_buckets.items()
    ]

    # 9. KPI Summary
    kpis_dto = Customer360KPIs(
        total_policies=len(formatted_policies),
        active_policies=active_policies_count,
        expired_policies=expired_policies_count,
        total_family_members=total_family_members_count,
        total_sum_insured=total_active_sum_insured,
        total_gross_premium=total_gross_premium,
        upcoming_renewals=upcoming_renewals_count,
    )

    # 10. Premium Summary
    pending_prem = max(Decimal("0.00"), total_gross_premium - total_paid_premium)
    next_due = min(upcoming_due_dates) if upcoming_due_dates else None
    premiums_dto = Customer360PremiumSummary(
        total_premium=total_gross_premium,
        paid_premium=total_paid_premium,
        pending_premium=pending_prem,
        overdue_premium=overdue_premium_amount,
        next_due_date=next_due,
    )

    return Customer360Response(
        customer=profile_dto,
        kpis=kpis_dto,
        portfolio_categories=categories_list,
        categories=categories_list,
        family=family_dto,
        documents=customer_docs,
        policies=formatted_policies,
        policy_year_groups=year_groups,
        year_groups=year_groups,
        premiums=premiums_dto,
        payments=payments_list,
        claims=claims_list,
        timeline=timeline_events,
    )


async def list_customer_activities(
    session: AsyncSession,
    customer_id: uuid.UUID,
    page: int = 1,
    page_size: int = 10,
    action_type: str | None = None,
    user_id: uuid.UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict[str, Any]:
    """Retrieve filtered, paginated customer audit logs and timeline events."""
    customer = (
        await session.execute(
            select(Customer)
            .options(selectinload(Customer.documents))
            .where(Customer.id == customer_id)
        )
    ).scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    doc_ids = [d.id for d in (customer.documents or [])]
    pol_rows = (
        await session.execute(
            select(InsurancePolicy.id).where(InsurancePolicy.customer_id == customer_id)
        )
    ).scalars().all()

    audit_filters = [
        AuditLog.resource_id == customer_id,
    ]
    if doc_ids:
        audit_filters.append(
            and_(
                AuditLog.resource_type.in_(["customer_document", "document"]),
                AuditLog.resource_id.in_(doc_ids),
            )
        )
    if pol_rows:
        audit_filters.append(
            and_(
                AuditLog.resource_type.in_(["policy", "insurance_policy"]),
                AuditLog.resource_id.in_(pol_rows),
            )
        )

    base_query = select(AuditLog).where(or_(*audit_filters))

    if user_id:
        base_query = base_query.where(AuditLog.actor_id == user_id)
    if action_type and action_type != "ALL":
        act_filter = f"%{action_type.upper()}%"
        base_query = base_query.where(AuditLog.action.ilike(act_filter))
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=UTC)
        base_query = base_query.where(AuditLog.created_at >= start_dt)
    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=UTC)
        base_query = base_query.where(AuditLog.created_at <= end_dt)

    count_q = select(func.count()).select_from(base_query.subquery())
    total = (await session.execute(count_q)).scalar_one()

    offset = (page - 1) * page_size
    query = (
        base_query.options(selectinload(AuditLog.actor).selectinload(User.roles))
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    records = (await session.execute(query)).scalars().all()

    field_labels = {
        "first_name": "First Name",
        "last_name": "Last Name",
        "phone": "Phone Number",
        "alternate_phone": "Alternate Phone",
        "email": "Email Address",
        "city": "City",
        "state": "State",
        "pincode": "PIN Code",
        "address": "Address",
        "occupation": "Occupation",
        "gender": "Gender",
        "date_of_birth": "Date of Birth",
    }

    items = []
    for a in records:
        delta = a.state_delta or {}
        actor_name = delta.get("actor_name")
        actor_role = delta.get("actor_role")
        if a.actor:
            actor_name = actor_name or a.actor.full_name or a.actor.email
            if a.actor.roles:
                actor_role = actor_role or a.actor.roles[0].name
        actor_name = actor_name or "Enterprise User"
        actor_role = actor_role or "ADMIN"

        title = delta.get("title")
        if not title:
            act_clean = (
                a.action.replace("CUSTOMER_KYC_", "")
                .replace("CUSTOMER_", "")
                .replace("INSURANCE_POLICY_", "")
                .replace("_", " ")
                .title()
            )
            title = f"Customer {act_clean}" if not act_clean.startswith("Customer") else act_clean

        description = delta.get("description") or f"Action performed on {a.resource_type}"
        changes = delta.get("changes") or []
        if not changes and "updated_fields" in delta:
            changes = [
                {
                    "field": f,
                    "field_label": field_labels.get(f, f.replace("_", " ").title()),
                    "previous": "Prior value",
                    "new": "Updated",
                }
                for f in delta["updated_fields"]
            ]

        act_str = a.action.upper()
        if "DELETE" in act_str:
            badge_color = "rose"
            icon = "trash-2"
        elif "VERIF" in act_str:
            badge_color = "emerald"
            icon = "shield-check"
        elif "UPLOAD" in act_str:
            badge_color = "teal"
            icon = "file-up"
        elif any(k in act_str for k in ["UPDATE", "PHONE", "EMAIL", "ADDRESS", "OCCUPATION"]):
            badge_color = "amber"
            icon = "edit"
        elif "NOTE" in act_str:
            badge_color = "sky"
            icon = "file-text"
        elif "UNMASK" in act_str:
            badge_color = "purple"
            icon = "eye"
        else:
            badge_color = "indigo"
            icon = "activity"

        items.append(
            Customer360TimelineEvent(
                id=f"evt_audit_{a.id}",
                event_type=a.action,
                title=title,
                description=description,
                timestamp=a.created_at,
                actor_id=a.actor_id,
                actor_name=actor_name,
                actor_role=actor_role,
                badge_color=badge_color,
                icon=icon,
                changes=changes,
                details=delta,
            )
        )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return {
        "items": [item.model_dump() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }
