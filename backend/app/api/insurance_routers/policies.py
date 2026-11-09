"""Policy Issuance, Contract Management, and Lifecycle Router."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_admin_or_super_admin, require_manager_or_above
from app.db.models.auth import User
from app.db.session import get_db_session
from datetime import date
from app.schemas.insurance import (
    PaginatedResponse,
    PolicyCreate,
    PolicyNomineeCreate,
    PolicyNomineeResponse,
    PolicyMemberCreate,
    PolicyMemberResponse,
    PolicyRenewalRequest,
    PolicyRenewalResponse,
    PolicyResponse,
    PolicyStatusUpdate,
    PolicyUpdate,
)

import hashlib
from datetime import UTC, datetime
from pathlib import Path
from fastapi import File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models.audit import AuditLog
from app.db.models.insurance import (
    InsurancePlan,
    InsurancePolicy,
    InsurancePolicyDocument,
    InsurancePlanDocument,
    InsurancePolicyPayment,
)
from app.schemas.insurance import (
    PolicyDocumentResponse,
    PolicyDocumentUpdate,
    PolicyAllDocumentsResponse,
    PlanDocumentResponse,
)

from app.services.insurance import (
    add_or_replace_policy_nominees,
    create_policy,
    delete_policy,
    get_policy_audit_history,
    get_policy_detail,
    get_policy_issue_years,
    get_policy_lookup_data,
    get_policy_nominees,
    get_policy_members,
    add_policy_member,
    remove_policy_member,
    get_customer_family_group_members,
    list_policies,
    renew_policy_contract,
    get_policy_renewal_lifecycle,
    update_policy,
    update_policy_status,
)

router = APIRouter(tags=["Insurance Policies"])

POLICY_STORAGE_DIR = Path("storage/policy_documents").resolve()
POLICY_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_POLICY_DOC_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"
}
ALLOWED_POLICY_DOC_MIMES = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "image/jpeg": ".jpg",
    "image/pjpeg": ".jpg",
    "image/png": ".png",
}
MAX_POLICY_DOC_SIZE = 25 * 1024 * 1024  # 25MB

POLICY_DOCUMENT_CATEGORIES = [
    "Official Policy Certificate",
    "Proposal Form",
    "Premium Receipt",
    "Customer KYC",
    "Medical Report",
    "Endorsement",
    "Renewal Document",
    "Claim-related Document",
    "Other Policy Attachments",
]

POLICY_DOC_TYPE_MAP = {
    "OFFICIAL_POLICY_CERTIFICATE": "Official Policy Certificate",
    "POLICY_CERTIFICATE": "Official Policy Certificate",
    "CERTIFICATE": "Official Policy Certificate",
    "PROPOSAL_FORM": "Proposal Form",
    "PROPOSAL": "Proposal Form",
    "PREMIUM_RECEIPT": "Premium Receipt",
    "RECEIPT": "Premium Receipt",
    "CUSTOMER_KYC": "Customer KYC",
    "KYC": "Customer KYC",
    "MEDICAL_REPORT": "Medical Report",
    "MEDICAL": "Medical Report",
    "ENDORSEMENT": "Endorsement",
    "RENEWAL_DOCUMENT": "Renewal Document",
    "RENEWAL": "Renewal Document",
    "CLAIM_RELATED": "Claim-related Document",
    "CLAIM_DOCUMENT": "Claim-related Document",
    "CLAIM": "Claim-related Document",
    "OTHER": "Other Policy Attachments",
    "OTHER_ATTACHMENT": "Other Policy Attachments",
    "OTHER_POLICY_ATTACHMENTS": "Other Policy Attachments",
}


def _normalize_policy_doc_type(dt: str | None) -> str:
    if not dt:
        return "Official Policy Certificate"
    clean = dt.strip()
    if clean in POLICY_DOC_TYPE_MAP:
        return POLICY_DOC_TYPE_MAP[clean]
    clean_upper = clean.upper().replace(" ", "_").replace("&", "AND").replace("-", "_")
    if clean_upper in POLICY_DOC_TYPE_MAP:
        return POLICY_DOC_TYPE_MAP[clean_upper]
    for std in POLICY_DOCUMENT_CATEGORIES:
        if std.lower() == clean.lower():
            return std
    return clean



@router.get(
    "/policies",
    response_model=PaginatedResponse[PolicyResponse],
    summary="List Managed Insurance Policies with Live Database Filtering",
)
async def list_policies_endpoint(
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    policy_type: str | None = Query(default=None),
    business_type: str | None = Query(default=None),
    company_id: uuid.UUID | None = Query(default=None),
    sub_agent_id: uuid.UUID | None = Query(default=None),
    customer_id: uuid.UUID | None = Query(default=None),
    start_date_from: date | None = Query(default=None),
    start_date_to: date | None = Query(default=None),
    expiry_date_from: date | None = Query(default=None),
    expiry_date_to: date | None = Query(default=None),
    issue_year: int | str | None = Query(default=None),
    coverage_year: str | None = Query(default=None),
    year_bucket: str | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[PolicyResponse]:
    """Retrieve policies from live database with pagination, search, carrier, date ranges, and status filtering."""
    return await list_policies(
        session=session,
        search=search,
        status_filter=status_filter,
        policy_type=policy_type,
        business_type=business_type,
        company_id=company_id,
        sub_agent_id=sub_agent_id,
        customer_id=customer_id,
        start_date_from=start_date_from,
        start_date_to=start_date_to,
        expiry_date_from=expiry_date_from,
        expiry_date_to=expiry_date_to,
        issue_year=issue_year,
        coverage_year=coverage_year,
        year_bucket=year_bucket,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/policies/issue-years",
    summary="Get Available Policy Issue Years and Statistics",
)
async def get_policy_issue_years_endpoint(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Retrieve distinct policy issue years and year-wise summaries from database records."""
    return await get_policy_issue_years(session)


@router.get(
    "/policies/lookup-data",
    summary="Get Dropdown Lookup Options for Policy Registration",
)
async def get_lookup_data_endpoint(
    category: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Retrieve active companies, plans, purchase parties, sub-agents, and customers for form dropdowns."""
    return await get_policy_lookup_data(session, category=category)


@router.post(
    "/policies",
    response_model=PolicyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register New Insurance Policy Contract",
)
async def create_policy_endpoint(
    payload: PolicyCreate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyResponse:
    """Issue a new policy contract with automatic installment schedules and first-year commission generation."""
    return await create_policy(session, payload, user_id=current_user.id)


@router.get(
    "/policies/{policy_id}",
    response_model=PolicyResponse,
    summary="Get Policy Detail with Schedules and Ledger",
)
async def get_policy_endpoint(
    policy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyResponse:
    """Retrieve complete policy details with carrier, customer, schedules, payments, and commissions."""
    return await get_policy_detail(session, policy_id)


@router.put(
    "/policies/{policy_id}",
    response_model=PolicyResponse,
    summary="Update Policy Details",
)
async def update_policy_endpoint(
    policy_id: uuid.UUID,
    payload: PolicyUpdate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyResponse:
    """Update policy attributes."""
    return await update_policy(session, policy_id, payload, user_id=current_user.id)


@router.delete(
    "/policies/{policy_id}",
    status_code=status.HTTP_200_OK,
    summary="Safe Delete Policy Contract",
)
async def delete_policy_endpoint(
    policy_id: uuid.UUID,
    current_user: User = Depends(require_admin_or_super_admin),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Safely delete policy contract if no payment transactions are recorded."""
    await delete_policy(session, policy_id)
    return {"status": "success", "message": "Policy deleted successfully."}



@router.post(
    "/policies/{policy_id}/renew",
    response_model=PolicyRenewalResponse,
    summary="Process Policy Renewal Contract",
)
async def renew_policy_endpoint(
    policy_id: uuid.UUID,
    payload: PolicyRenewalRequest,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyRenewalResponse:
    """Execute policy renewal contract and generate renewal premium installments without altering history."""
    return await renew_policy_contract(session, policy_id, payload, user_id=current_user.id)


@router.get(
    "/policies/{policy_id}/renewal-lifecycle",
    summary="Get Chronological Policy Renewal Lifecycle (Original -> Renewals)",
)
async def get_policy_renewal_lifecycle_endpoint(
    policy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    """Return ordered lifecycle nodes representing Original Policy, Renewals, and Prior coverage."""
    return await get_policy_renewal_lifecycle(session, policy_id)


@router.patch(
    "/policies/{policy_id}/status",
    response_model=PolicyResponse,
    summary="Update Policy Lifecycle Status",
)
async def update_policy_status_endpoint(
    policy_id: uuid.UUID,
    payload: PolicyStatusUpdate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyResponse:
    """Transition policy status (ACTIVE, INACTIVE, LAPSED, CANCELLED, EXPIRED) with immutable audit log."""
    return await update_policy_status(session, policy_id, payload, user_id=current_user.id)


@router.get(
    "/policies/{policy_id}/nominees",
    response_model=list[PolicyNomineeResponse],
    summary="List Nominees for Policy",
)
async def get_policy_nominees_endpoint(
    policy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[PolicyNomineeResponse]:
    """Retrieve all registered nominees for policy."""
    return await get_policy_nominees(session, policy_id)


@router.post(
    "/policies/{policy_id}/nominees",
    response_model=list[PolicyNomineeResponse],
    summary="Set or Replace Nominees for Policy",
)
async def set_policy_nominees_endpoint(
    policy_id: uuid.UUID,
    payload: list[PolicyNomineeCreate],
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> list[PolicyNomineeResponse]:
    """Replace all nominees ensuring share percentages total 100%."""
    return await add_or_replace_policy_nominees(session, policy_id, payload, user_id=current_user.id)


@router.get(
    "/policies/{policy_id}/certificate",
    summary="Generate Printable Policy Certificate",
)
async def get_policy_certificate_endpoint(
    policy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Return complete verified policy certificate payload for client-side printing or official export."""
    pol = await get_policy_detail(session, policy_id)
    return {
        "certificate_id": f"CERT-{pol.policy_number}",
        "issued_at": pol.created_at.isoformat(),
        "policy": pol.model_dump(),
        "disclaimer": "This document certifies that the insurance policy described herein is registered in the FinNexus Enterprise Insurance Ecosystem.",
    }


@router.get(
    "/policies/{policy_id}/audit-history",
    summary="Get Policy Audit and Lifecycle Transition History",
)
async def get_policy_audit_history_endpoint(
    policy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    """Retrieve chronological audit and status transition events for a policy contract."""
    return await get_policy_audit_history(session, policy_id)



@router.get(
    "/policies/{policy_id}/members",
    response_model=list[PolicyMemberResponse],
    summary="Get Insured Members for Policy",
)
async def get_policy_members_endpoint(
    policy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[PolicyMemberResponse]:
    """Retrieve all insured members covered under the specified policy contract."""
    return await get_policy_members(session, policy_id)


@router.post(
    "/policies/{policy_id}/members",
    response_model=PolicyMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add Insured Member to Policy",
)
async def add_policy_member_endpoint(
    policy_id: uuid.UUID,
    payload: PolicyMemberCreate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyMemberResponse:
    """Add a covered person/member to an existing policy contract."""
    return await add_policy_member(session, policy_id, payload)


@router.delete(
    "/policies/{policy_id}/members/{member_id}",
    summary="Remove Insured Member from Policy",
)
async def remove_policy_member_endpoint(
    policy_id: uuid.UUID,
    member_id: uuid.UUID,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    """Remove a covered member from an existing policy contract."""
    return await remove_policy_member(session, policy_id, member_id)


@router.get(
    "/customers/{customer_id}/family-group-members",
    summary="Get Family Group Members for Customer",
)
async def get_customer_family_group_members_endpoint(
    customer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Retrieve family group members associated with a customer for selective inclusion in policy coverage."""
    return await get_customer_family_group_members(session, customer_id)


# ===========================================================================
# POLICY DOCUMENTS & ATTACHMENTS (POLICY-SPECIFIC & INHERITED PLAN DOCS)
# ===========================================================================


@router.get(
    "/policies/{policy_id}/documents",
    response_model=PolicyAllDocumentsResponse,
    summary="List Policy-Specific & Inherited Plan Documents",
)
async def list_policy_all_documents(
    policy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyAllDocumentsResponse:
    """Retrieve both policy-specific uploaded attachments and inherited read-only plan documents."""
    policy = (
        await session.execute(
            select(InsurancePolicy)
            .options(
                selectinload(InsurancePolicy.plan).selectinload(InsurancePlan.documents).selectinload(InsurancePlanDocument.uploaded_by),
                selectinload(InsurancePolicy.documents).selectinload(InsurancePolicyDocument.uploaded_by),
            )
            .where(InsurancePolicy.id == policy_id)
        )
    ).scalar_one_or_none()

    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy with ID '{policy_id}' not found.",
        )

    policy_docs = [
        PolicyDocumentResponse.model_validate(d)
        for d in (policy.documents or [])
    ]

    plan_docs = []
    if policy.plan and policy.plan.documents:
        for pdoc in policy.plan.documents:
            plan_docs.append(PlanDocumentResponse.model_validate(pdoc))

    return PolicyAllDocumentsResponse(
        policy_id=policy.id,
        policy_number=policy.policy_number,
        plan_id=policy.plan_id,
        plan_name=policy.plan.name if policy.plan else None,
        policy_documents=policy_docs,
        policy_documents_count=len(policy_docs),
        plan_documents=plan_docs,
        plan_documents_count=len(plan_docs),
        total_documents_count=len(policy_docs) + len(plan_docs),
    )


@router.post(
    "/policies/{policy_id}/documents",
    response_model=PolicyDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Policy-Specific Document / Certificate / Attachment",
)
async def upload_policy_document(
    policy_id: uuid.UUID,
    title: str | None = Form(default=None),
    document_type: str | None = Form(default=None),
    description: str | None = Form(default=None),
    payment_id: uuid.UUID | None = Form(default=None),
    title_q: str | None = Query(default=None, alias="title"),
    doc_type_q: str | None = Query(default=None, alias="document_type"),
    desc_q: str | None = Query(default=None, alias="description"),
    payment_id_q: uuid.UUID | None = Query(default=None, alias="payment_id"),
    file: UploadFile = File(...),
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyDocumentResponse:
    """Upload a policy-specific attachment (certificate, receipt, KYC, proposal, medical report, endorsement)."""
    policy = (
        await session.execute(
            select(InsurancePolicy).where(InsurancePolicy.id == policy_id)
        )
    ).scalar_one_or_none()

    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy with ID '{policy_id}' not found.",
        )

    raw_type = document_type or doc_type_q or "Official Policy Certificate"
    effective_doc_type = _normalize_policy_doc_type(raw_type)
    effective_title = (title or title_q or file.filename or effective_doc_type).strip()
    effective_desc = (description or desc_q or "").strip() or None

    filename = file.filename or "document"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_POLICY_DOC_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed extensions: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG.",
        )

    mime = file.content_type or "application/octet-stream"
    if mime not in ALLOWED_POLICY_DOC_MIMES and ext in ALLOWED_POLICY_DOC_EXTENSIONS:
        ext_to_mime = {
            ".pdf": "application/pdf",
            ".doc": "application/msword",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls": "application/vnd.ms-excel",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
        }
        mime = ext_to_mime.get(ext, "application/octet-stream")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
    if len(content) > MAX_POLICY_DOC_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of 25MB (received {len(content) / (1024 * 1024):.2f}MB).",
        )

    sha256 = hashlib.sha256(content).hexdigest()
    doc_id = uuid.uuid4()
    clean_name = "".join(c for c in filename if c.isalnum() or c in "._- ")
    storage_name = f"policy_{policy_id}_{doc_id.hex[:8]}_{clean_name}"
    storage_path = str(POLICY_STORAGE_DIR / storage_name)

    with open(storage_path, "wb") as f_out:
        f_out.write(content)

    doc = InsurancePolicyDocument(
        id=doc_id,
        policy_id=policy_id,
        document_type=effective_doc_type,
        title=effective_title,
        description=effective_desc,
        original_filename=filename,
        storage_path=storage_path,
        file_size_bytes=len(content),
        mime_type=mime,
        sha256_hash=sha256,
        uploaded_by_id=current_user.id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(doc)

    # Link to payment transaction if document is a receipt or payment_id is provided
    target_payment_id = payment_id or payment_id_q
    if target_payment_id or effective_doc_type == "Premium Receipt" or (raw_type and raw_type.upper() in ("PREMIUM_RECEIPT", "PAYMENT_RECEIPT", "RECEIPT")):
        pay_stmt = select(InsurancePolicyPayment).where(InsurancePolicyPayment.policy_id == policy_id)
        if target_payment_id:
            pay_stmt = pay_stmt.where(InsurancePolicyPayment.id == target_payment_id)
        else:
            pay_stmt = pay_stmt.order_by(InsurancePolicyPayment.created_at.desc()).limit(1)
        pay_res = await session.execute(pay_stmt)
        pay_obj = pay_res.scalar_one_or_none()
        if pay_obj:
            pay_obj.document_id = doc.id
            pay_obj.document_filename = filename

    # Audit Trail
    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="INSURANCE_POLICY_DOCUMENT_UPLOADED",
        resource_type="insurance_policy_document",
        resource_id=doc.id,
        state_delta={
            "policy_id": str(policy_id),
            "document_type": effective_doc_type,
            "title": effective_title,
            "filename": filename,
            "size": len(content),
        },
        created_at=datetime.now(UTC),
    )
    session.add(audit)

    await session.commit()
    await session.refresh(doc)

    doc_with_user = (
        await session.execute(
            select(InsurancePolicyDocument)
            .options(selectinload(InsurancePolicyDocument.uploaded_by))
            .where(InsurancePolicyDocument.id == doc.id)
        )
    ).scalar_one()

    return PolicyDocumentResponse.model_validate(doc_with_user)


@router.get(
    "/policies/{policy_id}/documents/{document_id}/download",
    summary="Download Policy Document (Attachment)",
)
async def download_policy_document(
    policy_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FileResponse:
    """Stream authorized policy document file as an attachment."""
    doc = (
        await session.execute(
            select(InsurancePolicyDocument).where(
                InsurancePolicyDocument.id == document_id,
                InsurancePolicyDocument.policy_id == policy_id,
            )
        )
    ).scalar_one_or_none()

    if not doc or not Path(doc.storage_path).exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy document file not found on storage server.",
        )

    return FileResponse(
        path=doc.storage_path,
        media_type=doc.mime_type or "application/octet-stream",
        filename=doc.original_filename,
        content_disposition_type="attachment",
    )


@router.get(
    "/policies/{policy_id}/documents/{document_id}/view",
    summary="View Policy Document (Inline Browser Preview)",
)
async def view_policy_document(
    policy_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FileResponse:
    """Stream authorized policy document file for inline browser viewing (PDF/images)."""
    doc = (
        await session.execute(
            select(InsurancePolicyDocument).where(
                InsurancePolicyDocument.id == document_id,
                InsurancePolicyDocument.policy_id == policy_id,
            )
        )
    ).scalar_one_or_none()

    if not doc or not Path(doc.storage_path).exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy document file not found on storage server.",
        )

    return FileResponse(
        path=doc.storage_path,
        media_type=doc.mime_type or "application/octet-stream",
        filename=doc.original_filename,
        content_disposition_type="inline",
    )


@router.put(
    "/policies/{policy_id}/documents/{document_id}",
    response_model=PolicyDocumentResponse,
    summary="Update Policy Document Metadata or Replace File",
)
async def update_policy_document(
    policy_id: uuid.UUID,
    document_id: uuid.UUID,
    title: str | None = Form(default=None),
    document_type: str | None = Form(default=None),
    description: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyDocumentResponse:
    """Update document metadata or replace the document file for a policy contract."""
    doc = (
        await session.execute(
            select(InsurancePolicyDocument).where(
                InsurancePolicyDocument.id == document_id,
                InsurancePolicyDocument.policy_id == policy_id,
            )
        )
    ).scalar_one_or_none()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy document record not found.",
        )

    delta = {}

    if title is not None and title.strip():
        new_title = title.strip()
        delta["title"] = {"from": doc.title, "to": new_title}
        doc.title = new_title

    if document_type is not None and document_type.strip():
        new_type = _normalize_policy_doc_type(document_type.strip())
        delta["document_type"] = {"from": doc.document_type, "to": new_type}
        doc.document_type = new_type

    if description is not None:
        new_desc = description.strip() or None
        delta["description"] = {"from": doc.description, "to": new_desc}
        doc.description = new_desc

    if file is not None and file.filename:
        filename = file.filename
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_POLICY_DOC_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{ext}'. Allowed extensions: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG.",
            )

        mime = file.content_type or "application/octet-stream"
        if mime not in ALLOWED_POLICY_DOC_MIMES and ext in ALLOWED_POLICY_DOC_EXTENSIONS:
            ext_to_mime = {
                ".pdf": "application/pdf",
                ".doc": "application/msword",
                ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xls": "application/vnd.ms-excel",
                ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
            }
            mime = ext_to_mime.get(ext, "application/octet-stream")

        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Replacement file is empty.")
        if len(content) > MAX_POLICY_DOC_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File exceeds 25MB limit.",
            )

        old_p = Path(doc.storage_path)
        if old_p.exists():
            old_p.unlink(missing_ok=True)

        sha256 = hashlib.sha256(content).hexdigest()
        clean_name = "".join(c for c in filename if c.isalnum() or c in "._- ")
        storage_name = f"policy_{policy_id}_{doc.id.hex[:8]}_{clean_name}"
        storage_path = str(POLICY_STORAGE_DIR / storage_name)

        with open(storage_path, "wb") as f_out:
            f_out.write(content)

        delta["file_replacement"] = {
            "from_filename": doc.original_filename,
            "to_filename": filename,
            "from_size": doc.file_size_bytes,
            "to_size": len(content),
        }
        doc.original_filename = filename
        doc.storage_path = storage_path
        doc.file_size_bytes = len(content)
        doc.mime_type = mime
        doc.sha256_hash = sha256

    doc.updated_at = datetime.now(UTC)

    if delta:
        audit = AuditLog(
            id=uuid.uuid4(),
            actor_id=current_user.id,
            action="INSURANCE_POLICY_DOCUMENT_UPDATED",
            resource_type="insurance_policy_document",
            resource_id=doc.id,
            state_delta=delta,
            created_at=datetime.now(UTC),
        )
        session.add(audit)

    await session.commit()
    await session.refresh(doc)

    doc_with_user = (
        await session.execute(
            select(InsurancePolicyDocument)
            .options(selectinload(InsurancePolicyDocument.uploaded_by))
            .where(InsurancePolicyDocument.id == doc.id)
        )
    ).scalar_one()

    return PolicyDocumentResponse.model_validate(doc_with_user)


@router.delete(
    "/policies/{policy_id}/documents/{document_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Policy Document",
)
async def delete_policy_document(
    policy_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Delete a policy document and remove its physical file from storage server."""
    doc = (
        await session.execute(
            select(InsurancePolicyDocument).where(
                InsurancePolicyDocument.id == document_id,
                InsurancePolicyDocument.policy_id == policy_id,
            )
        )
    ).scalar_one_or_none()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy document record not found.",
        )

    file_name = doc.original_filename
    doc_title = doc.title
    p = Path(doc.storage_path)
    if p.exists():
        p.unlink(missing_ok=True)

    await session.delete(doc)

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=current_user.id,
        action="INSURANCE_POLICY_DOCUMENT_DELETED",
        resource_type="insurance_policy_document",
        resource_id=document_id,
        state_delta={"policy_id": str(policy_id), "title": doc_title, "filename": file_name},
        created_at=datetime.now(UTC),
    )
    session.add(audit)

    await session.commit()

    return {
        "status": "success",
        "message": f"Document '{doc_title}' was successfully deleted.",
    }


@router.get(
    "/policies/{policy_id}/plan-documents/{document_id}/download",
    summary="Download Inherited Plan Document via Policy Scope",
)
async def download_policy_plan_document(
    policy_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FileResponse:
    """Download an inherited plan document with plan-level isolation verification."""
    policy = (
        await session.execute(
            select(InsurancePolicy).where(InsurancePolicy.id == policy_id)
        )
    ).scalar_one_or_none()

    if not policy or not policy.plan_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy or associated insurance plan not found.",
        )

    doc = (
        await session.execute(
            select(InsurancePlanDocument).where(
                InsurancePlanDocument.id == document_id,
                InsurancePlanDocument.plan_id == policy.plan_id,
            )
        )
    ).scalar_one_or_none()

    if not doc or not Path(doc.storage_path).exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inherited plan document not found on storage server.",
        )

    return FileResponse(
        path=doc.storage_path,
        media_type=doc.mime_type or "application/octet-stream",
        filename=doc.original_filename,
        content_disposition_type="attachment",
    )


@router.get(
    "/policies/{policy_id}/plan-documents/{document_id}/view",
    summary="View Inherited Plan Document via Policy Scope",
)
async def view_policy_plan_document(
    policy_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FileResponse:
    """Stream an inherited plan document for inline preview with plan-level isolation verification."""
    policy = (
        await session.execute(
            select(InsurancePolicy).where(InsurancePolicy.id == policy_id)
        )
    ).scalar_one_or_none()

    if not policy or not policy.plan_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy or associated insurance plan not found.",
        )

    doc = (
        await session.execute(
            select(InsurancePlanDocument).where(
                InsurancePlanDocument.id == document_id,
                InsurancePlanDocument.plan_id == policy.plan_id,
            )
        )
    ).scalar_one_or_none()

    if not doc or not Path(doc.storage_path).exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inherited plan document not found on storage server.",
        )

    return FileResponse(
        path=doc.storage_path,
        media_type=doc.mime_type or "application/octet-stream",
        filename=doc.original_filename,
        content_disposition_type="inline",
    )
