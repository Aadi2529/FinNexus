"""Customer Onboarding, Corporate Client, KYC Privacy & Bulk Import Router."""

from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_manager_or_above
from app.db.models.audit import AuditLog
from app.db.models.auth import User
from app.db.session import get_db_session
from app.schemas.insurance import (
    Customer360Response,
    CustomerDocumentInfo,
    CustomerDocumentVerifyRequest,
    CustomerNoteCreate,
    InsuranceCustomerCreate,
    InsuranceCustomerResponse,
    InsuranceCustomerUpdate,
    PaginatedResponse,
)
from app.services.insurance import (
    add_customer_note,
    create_customer,
    delete_customer_kyc_document,
    get_customer_360_profile,
    get_customer_by_id,
    get_document_for_download,
    list_customer_activities,
    list_customers,
    unmask_customer_kyc,
    update_customer,
    upload_customer_kyc_document,
    verify_customer_kyc_document,
)
from app.services.insurance.customer_import_service import (
    confirm_customer_import,
    generate_customer_template,
    preview_customer_import,
)

router = APIRouter(tags=["Insurance Customers"])


# ===========================================================================
# BULK IMPORT ENDPOINTS (Placed before parameterized paths)
# ===========================================================================


@router.get(
    "/customers/import/template",
    summary="Download Sample Spreadsheet Template for Customer Import",
)
async def download_customer_template_endpoint(
    customer_type: str = Query(default="INDIVIDUAL", description="INDIVIDUAL or CORPORATE"),
    format_type: str = Query(default="csv", alias="format", description="csv or xlsx"),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Download standardized customer import template for Individual or Corporate onboarding."""
    content_bytes, filename, media_type = generate_customer_template(
        customer_type=customer_type,
        format_type=format_type,
    )
    return Response(
        content=content_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.post(
    "/customers/import/preview",
    summary="Preview Uploaded Customer Spreadsheet with Duplicate & Error Checks",
)
async def preview_customer_import_endpoint(
    file: UploadFile = File(...),
    customer_type: str = Query(default="INDIVIDUAL", description="INDIVIDUAL or CORPORATE"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Parse CSV or XLSX file and run validation, format, and duplicate detection checks."""
    return await preview_customer_import(
        session=session,
        file=file,
        customer_type=customer_type,
    )


@router.post(
    "/customers/import/confirm",
    summary="Confirm and Execute Bulk Customer Import",
)
async def confirm_customer_import_endpoint(
    payload: dict[str, Any] = Body(...),
    customer_type: str = Query(default="INDIVIDUAL", description="INDIVIDUAL or CORPORATE"),
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Execute transactional insertion of validated rows into PostgreSQL with KYC encryption."""
    valid_rows = payload.get("rows", [])
    if not isinstance(valid_rows, list) or len(valid_rows) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload must contain a non-empty list of confirmed 'rows'.",
        )

    return await confirm_customer_import(
        session=session,
        valid_rows=valid_rows,
        customer_type=customer_type,
        user_id=current_user.id,
    )


# ===========================================================================
# STANDARD CUSTOMER CRUD
# ===========================================================================


@router.get(
    "/customers",
    response_model=PaginatedResponse[InsuranceCustomerResponse],
    summary="List Insurance Customers with Search and Pagination",
)
async def get_customers_endpoint(
    search: str | None = Query(default=None),
    customer_type: str | None = Query(default=None),
    gender: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[InsuranceCustomerResponse]:
    """Retrieve paginated customers for insurance onboarding with masked KYC values."""
    return await list_customers(
        session=session,
        search=search,
        customer_type=customer_type,
        gender=gender,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/customers",
    response_model=InsuranceCustomerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register New Insurance Customer (Individual or Corporate)",
)
async def create_customer_endpoint(
    payload: InsuranceCustomerCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> InsuranceCustomerResponse:
    """Register customer with personal/corporate details, encrypted KYC, and validation."""
    cust = await create_customer(session, payload, user_id=current_user.id)
    return await get_customer_by_id(session, cust.id)


@router.get(
    "/customers/{customer_id}",
    response_model=InsuranceCustomerResponse,
    summary="Get Customer Detail with Documents and Masked KYC",
)
async def get_customer_endpoint(
    customer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> InsuranceCustomerResponse:
    """Retrieve individual customer profile with uploaded KYC document metadata and masked values."""
    return await get_customer_by_id(session, customer_id)


@router.get(
    "/customers/{customer_id}/360",
    response_model=Customer360Response,
    summary="Get Complete Customer 360° Profile, Portfolio, Family, and History",
)
async def get_customer_360_endpoint(
    customer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Customer360Response:
    """Retrieve comprehensive Customer 360 profile with category breakdown, family, policy history, payments, and timeline."""
    return await get_customer_360_profile(
        session=session,
        customer_id=customer_id,
        current_user=current_user,
    )


@router.get(
    "/customers/{customer_id}/unmask-kyc",
    summary="Authorized Reveal of Full Aadhaar and PAN (Requires Manager/Admin)",
)
async def unmask_customer_kyc_endpoint(
    customer_id: uuid.UUID,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str | None]:
    """Decrypted unmasking of PAN and Aadhaar restricted to authorized supervisors with full audit logging."""
    return await unmask_customer_kyc(
        session=session,
        customer_id=customer_id,
        user_id=current_user.id,
    )


@router.put(
    "/customers/{customer_id}",
    response_model=InsuranceCustomerResponse,
    summary="Update Customer Information",
)
async def update_customer_endpoint(
    customer_id: uuid.UUID,
    payload: InsuranceCustomerUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> InsuranceCustomerResponse:
    """Update customer details without overwriting sensitive values with masked placeholders."""
    cust = await update_customer(session, customer_id, payload, user_id=current_user.id)
    return await get_customer_by_id(session, cust.id)


@router.patch(
    "/customers/{customer_id}/status",
    response_model=InsuranceCustomerResponse,
    summary="Toggle Customer Active / Archived Status",
)
async def toggle_customer_status_endpoint(
    customer_id: uuid.UUID,
    is_archived: bool = Query(...),
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> InsuranceCustomerResponse:
    """Archive or reactivate a customer record."""
    from app.db.models.crm import Customer
    from datetime import datetime, UTC
    from sqlalchemy import select

    cust = (await session.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found.")

    cust.is_archived = is_archived
    cust.archived_at = datetime.now(UTC) if is_archived else None
    await session.commit()
    return await get_customer_by_id(session, customer_id)


@router.delete(
    "/customers/{customer_id}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate or Archive Customer",
)
async def archive_customer_endpoint(
    customer_id: uuid.UUID,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Safely deactivate a customer without deleting existing policies or dependent relationships."""
    from app.db.models.crm import Customer
    from datetime import datetime, UTC
    from sqlalchemy import select

    cust = (await session.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found.")

    cust.is_archived = True
    cust.archived_at = datetime.now(UTC)
    await session.commit()
    return {"message": f"Customer '{cust.full_name}' was successfully archived.", "customer_id": str(customer_id)}


# ===========================================================================
# KYC DOCUMENT MANAGEMENT
# ===========================================================================


@router.post(
    "/customers/{customer_id}/documents",
    response_model=CustomerDocumentInfo,
    status_code=status.HTTP_201_CREATED,
    summary="Upload KYC Document (Aadhaar, PAN, Address Proof, GSTIN)",
)
async def upload_kyc_document_endpoint(
    customer_id: uuid.UUID,
    document_type: str = Query(..., description="AADHAAR, PAN, ADDRESS_PROOF, GSTIN, INCORPORATION_CERT"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerDocumentInfo:
    """Securely upload Aadhaar, PAN, or corporate registration proof with private storage."""
    doc = await upload_customer_kyc_document(
        session=session,
        customer_id=customer_id,
        document_type=document_type,
        file=file,
        user_id=current_user.id,
    )
    return CustomerDocumentInfo(
        id=doc.id,
        document_type=doc.document_type,
        original_filename=doc.original_filename,
        file_size_bytes=doc.file_size_bytes,
        mime_type=doc.mime_type,
        verification_status=doc.verification_status,
        uploaded_by_id=doc.verified_by_id,
        uploaded_by_name=current_user.full_name,
        rejection_reason=doc.rejection_reason,
        created_at=doc.created_at,
    )


@router.patch(
    "/customers/{customer_id}/documents/{document_id}/verify",
    response_model=CustomerDocumentInfo,
    summary="Verify or Unverify Customer KYC Document",
)
async def verify_kyc_document_endpoint(
    customer_id: uuid.UUID,
    document_id: uuid.UUID,
    payload: CustomerDocumentVerifyRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerDocumentInfo:
    """Toggle or set document verification status with user attribution and audit trail."""
    doc = await verify_customer_kyc_document(
        session=session,
        customer_id=customer_id,
        document_id=document_id,
        verification_status=payload.verification_status,
        user_id=current_user.id,
        remarks=payload.remarks,
    )
    return CustomerDocumentInfo(
        id=doc.id,
        document_type=doc.document_type,
        original_filename=doc.original_filename,
        file_size_bytes=doc.file_size_bytes,
        mime_type=doc.mime_type,
        verification_status=doc.verification_status,
        uploaded_by_id=doc.verified_by_id,
        uploaded_by_name=current_user.full_name,
        rejection_reason=doc.rejection_reason,
        created_at=doc.created_at,
    )


@router.delete(
    "/customers/{customer_id}/documents/{document_id}",
    summary="Delete Customer Document",
)
async def delete_kyc_document_endpoint(
    customer_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Securely remove customer KYC document from disk and database with audit logging."""
    return await delete_customer_kyc_document(
        session=session,
        customer_id=customer_id,
        document_id=document_id,
        user_id=current_user.id,
    )


@router.post(
    "/customers/{customer_id}/notes",
    summary="Add Customer Interaction Note",
)
async def add_customer_note_endpoint(
    customer_id: uuid.UUID,
    payload: CustomerNoteCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Record customer interaction notes with supervisor audit trails."""
    return await add_customer_note(
        session=session,
        customer_id=customer_id,
        note=payload.note,
        user_id=current_user.id,
    )


@router.get(
    "/customers/{customer_id}/activities",
    summary="Get Paginated & Filtered Customer Activity Timeline",
)
async def get_customer_activities_endpoint(
    customer_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    action_type: str | None = Query(default=None),
    user_id: uuid.UUID | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Retrieve chronological, searchable activity logs and audit timeline for customer."""
    from datetime import date as dt_date
    parsed_start = dt_date.fromisoformat(start_date) if start_date else None
    parsed_end = dt_date.fromisoformat(end_date) if end_date else None
    return await list_customer_activities(
        session=session,
        customer_id=customer_id,
        page=page,
        page_size=page_size,
        action_type=action_type,
        user_id=user_id,
        start_date=parsed_start,
        end_date=parsed_end,
    )


@router.get(
    "/customers/{customer_id}/documents/{document_id}",
    summary="Secure Download of KYC Document",
)
@router.get(
    "/customers/{customer_id}/documents/{document_id}/download",
    summary="Secure Download of KYC Document",
)
async def download_kyc_document_endpoint(
    customer_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FileResponse:
    """Download stored KYC document with audit logging (restricted to authenticated enterprise users)."""
    file_path, filename, media_type = await get_document_for_download(
        session=session,
        customer_id=customer_id,
        document_id=document_id,
        user_id=current_user.id,
    )
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type=media_type,
    )
