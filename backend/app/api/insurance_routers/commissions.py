"""Commission Management, Insurer Receivable Ledger, Sub-Agent Payouts, and Financial Reporting Router."""

from __future__ import annotations

import uuid
from datetime import date
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_manager_or_above
from app.db.models.auth import User
from app.db.session import get_db_session
from app.schemas.insurance import (
    AgentPerformanceReportItem,
    CommissionApprovalRequest,
    CommissionKPIResponse,
    CommissionReceiptCreate,
    CommissionReceiptResponse,
    CommissionReversalRequest,
    CompanyCommissionAgreementCreate,
    CompanyCommissionAgreementResponse,
    CompanyCommissionAgreementUpdate,
    ComprehensiveCommissionDashboardResponse,
    PaginatedResponse,
    PolicyCommissionResponse,
    PolicyCommissionStatusUpdate,
    PolicyCommissionUpdate,
    SubAgentPayoutApprovalRequest,
    SubAgentPayoutOnHoldRequest,
    SubAgentPayoutPaymentCreate,
    SubAgentPayoutPaymentResponse,
    SubAgentPayoutResponse,
    SubAgentPayoutReversalRequest,
    SubAgentPayoutUpdate,
)
from app.services.insurance import (
    approve_commission,
    approve_sub_agent_payout,
    calculate_and_record_policy_commission,
    create_commission_agreement,
    dispute_commission,
    export_commissions_csv,
    export_commissions_excel,
    export_report_1_insurer_receivables,
    export_report_2_insurer_bank_receipts,
    export_report_3_insurer_tds,
    export_report_4_sub_agent_payables,
    export_report_5_sub_agent_payment_history,
    export_report_6_policy_wise,
    export_report_7_agent_wise,
    export_report_8_financial_reconciliation,
    get_agent_performance_reports,
    get_commission_detail,
    get_commission_kpis,
    get_commission_reports,
    get_comprehensive_commission_dashboard,
    get_sub_agent_payout_detail,
    list_commission_agreements,
    list_commissions,
    list_sub_agent_payouts,
    record_commission_receipt,
    record_sub_agent_payout_payment,
    resolve_insurer_commission_agreement,
    reverse_commission,
    reverse_sub_agent_payout,
    set_sub_agent_payout_on_hold,
    update_commission_agreement,
    update_commission_status,
    update_policy_commission,
    update_sub_agent_payout_allocation,
)

router = APIRouter(tags=["Commission Management"])


class CommissionDisputeRequest(BaseModel):
    dispute_reason: str = Field(..., min_length=3, description="Reason for commission discrepancy or dispute")


# ===========================================================================
# 1. FINANCIAL DASHBOARD (3 DISTINCT SECTIONS)
# ===========================================================================


@router.get(
    "/commissions/dashboard",
    response_model=ComprehensiveCommissionDashboardResponse,
    summary="Get Comprehensive 3-Section Financial Dashboard",
)
async def get_commission_dashboard_endpoint(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ComprehensiveCommissionDashboardResponse:
    """Retrieve 3 distinct sections: A. Insurer Commission Receivable, B. Sub-Agent Payables, and C. Firm Financial Position."""
    return await get_comprehensive_commission_dashboard(session=session)


@router.get(
    "/commissions/kpis",
    response_model=CommissionKPIResponse,
    summary="Get 8 Real Database Financial KPI Cards (Legacy Compatibility)",
)
async def get_commission_kpis_endpoint(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CommissionKPIResponse:
    """Retrieve database-driven KPI metrics including gross, pending, approved, net received, TDS, and reversals."""
    return await get_commission_kpis(session=session)


# ===========================================================================
# 2. SUB-AGENT PAYOUTS (DEDICATED SEPARATE FINANCIAL WORKFLOW)
# ===========================================================================


@router.get(
    "/commissions/sub-agent-payouts",
    response_model=PaginatedResponse[SubAgentPayoutResponse],
    summary="List Sub-Agent Commission Payout Obligations",
)
async def list_sub_agent_payouts_endpoint(
    sub_agent_id: uuid.UUID | None = Query(default=None),
    company_id: uuid.UUID | None = Query(default=None),
    commission_type: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[SubAgentPayoutResponse]:
    """Retrieve money payable by FinNexus to its sub-agents, completely separate from insurer receivables."""
    return await list_sub_agent_payouts(
        session=session,
        sub_agent_id=sub_agent_id,
        company_id=company_id,
        commission_type=commission_type,
        status_filter=status_filter,
        from_date=from_date,
        to_date=to_date,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/commissions/sub-agent-payouts/{payout_id}",
    response_model=SubAgentPayoutResponse,
    summary="Get Sub-Agent Payout Detail and Payment History",
)
async def get_sub_agent_payout_detail_endpoint(
    payout_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> SubAgentPayoutResponse:
    """Retrieve full sub-agent payout record with payment disbursements and audit trails."""
    return await get_sub_agent_payout_detail(session=session, payout_id=payout_id)


@router.post(
    "/commissions/sub-agent-payouts/{payout_id}/approve",
    response_model=SubAgentPayoutResponse,
    summary="Approve Sub-Agent Commission Payout",
)
async def approve_sub_agent_payout_endpoint(
    payout_id: uuid.UUID,
    payload: SubAgentPayoutApprovalRequest,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> SubAgentPayoutResponse:
    """Approve a pending sub-agent payout obligation for outgoing payment."""
    return await approve_sub_agent_payout(
        session=session,
        payout_id=payout_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.post(
    "/commissions/sub-agent-payouts/{payout_id}/payments",
    response_model=SubAgentPayoutResponse,
    summary="Disburse Outgoing Payment to Sub-Agent",
)
async def record_sub_agent_payout_payment_endpoint(
    payout_id: uuid.UUID,
    payload: SubAgentPayoutPaymentCreate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> SubAgentPayoutResponse:
    """Record an outgoing disbursement (partial or full) against an approved sub-agent payout."""
    return await record_sub_agent_payout_payment(
        session=session,
        payout_id=payout_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.post(
    "/commissions/sub-agent-payouts/{payout_id}/hold",
    response_model=SubAgentPayoutResponse,
    summary="Place Sub-Agent Payout On Hold",
)
async def set_sub_agent_payout_on_hold_endpoint(
    payout_id: uuid.UUID,
    payload: SubAgentPayoutOnHoldRequest,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> SubAgentPayoutResponse:
    """Place a sub-agent payout on hold with an audit reason."""
    return await set_sub_agent_payout_on_hold(
        session=session,
        payout_id=payout_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.post(
    "/commissions/sub-agent-payouts/{payout_id}/reverse",
    response_model=SubAgentPayoutResponse,
    summary="Reverse Sub-Agent Payout Obligation",
)
async def reverse_sub_agent_payout_endpoint(
    payout_id: uuid.UUID,
    payload: SubAgentPayoutReversalRequest,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> SubAgentPayoutResponse:
    """Reverse a sub-agent payout obligation with mandatory audit justification."""
    return await reverse_sub_agent_payout(
        session=session,
        payout_id=payout_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.put(
    "/commissions/sub-agent-payouts/{payout_id}",
    response_model=SubAgentPayoutResponse,
    summary="Update Sub-Agent Payout Allocation Split",
)
async def update_sub_agent_payout_endpoint(
    payout_id: uuid.UUID,
    payload: SubAgentPayoutUpdate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> SubAgentPayoutResponse:
    """Configure or update sub-agent commission allocation split."""
    return await update_sub_agent_payout_allocation(
        session=session,
        payout_id=payout_id,
        user_id=current_user.id,
        payload=payload,
    )


# ===========================================================================
# 3. INSURER COMMISSION RECEIVABLE LEDGER & REALIZATION
# ===========================================================================


@router.get(
    "/commissions",
    response_model=PaginatedResponse[PolicyCommissionResponse],
    summary="List Insurer Commission Receivable Ledger",
)
async def list_commissions_endpoint(
    agent_id: uuid.UUID | None = Query(default=None),
    company_id: uuid.UUID | None = Query(default=None),
    policy_category: str | None = Query(default=None),
    commission_type: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[PolicyCommissionResponse]:
    """Retrieve FinNexus's insurer commission receivable records with filtering by company, category, status, and dates."""
    return await list_commissions(
        session=session,
        agent_id=agent_id,
        company_id=company_id,
        policy_category=policy_category,
        commission_type=commission_type,
        status_filter=status_filter,
        from_date=from_date,
        to_date=to_date,
        search=search,
        page=page,
        page_size=page_size,
    )


# ===========================================================================
# 5. INSURER COMMISSION AGREEMENTS (CRUD)
# ===========================================================================


@router.get(
    "/commissions/agreements",
    response_model=list[CompanyCommissionAgreementResponse],
    summary="List Insurer Commission Agreements",
)
async def list_commission_agreements_endpoint(
    company_id: uuid.UUID | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[CompanyCommissionAgreementResponse]:
    """Retrieve insurer commission percentage agreements and terms."""
    return await list_commission_agreements(session=session, company_id=company_id, is_active=is_active)


@router.post(
    "/commissions/agreements",
    response_model=CompanyCommissionAgreementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Insurer Commission Agreement",
)
async def create_commission_agreement_endpoint(
    payload: CompanyCommissionAgreementCreate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> CompanyCommissionAgreementResponse:
    """Configure commission terms with an insurance company."""
    return await create_commission_agreement(session=session, payload=payload)


@router.put(
    "/commissions/agreements/{agreement_id}",
    response_model=CompanyCommissionAgreementResponse,
    summary="Update Insurer Commission Agreement",
)
async def update_commission_agreement_endpoint(
    agreement_id: uuid.UUID,
    payload: CompanyCommissionAgreementUpdate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> CompanyCommissionAgreementResponse:
    """Update insurer commission terms (preserves historical snapshots)."""
    return await update_commission_agreement(session=session, agreement_id=agreement_id, payload=payload)




@router.get(
    "/commissions/{commission_id}",
    response_model=PolicyCommissionResponse,
    summary="Get Commission Receivable Detail",
)
async def get_commission_detail_endpoint(
    commission_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyCommissionResponse:
    """Retrieve complete insurer commission receivable record with calculation breakdown, snapshot, and receipts."""
    return await get_commission_detail(session=session, commission_id=commission_id)


@router.post(
    "/commissions/{commission_id}/approve",
    response_model=PolicyCommissionResponse,
    summary="Approve Insurer Commission Receivable",
)
async def approve_commission_endpoint(
    commission_id: uuid.UUID,
    payload: CommissionApprovalRequest,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyCommissionResponse:
    """Approve a pending insurer commission record."""
    return await approve_commission(
        session=session,
        commission_id=commission_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.post(
    "/commissions/{commission_id}/receipts",
    response_model=PolicyCommissionResponse,
    summary="Record Actual Carrier Bank Receipt",
)
async def record_commission_receipt_endpoint(
    commission_id: uuid.UUID,
    payload: CommissionReceiptCreate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyCommissionResponse:
    """Record an actual bank receipt (partial or full) against an insurer commission receivable."""
    return await record_commission_receipt(
        session=session,
        commission_id=commission_id,
        user_id=current_user.id,
        payload=payload,
    )


COMMISSION_RECEIPT_STORAGE_DIR = Path("storage/commission_receipts").resolve()
COMMISSION_RECEIPT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_RECEIPT_DOC_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"}


@router.post(
    "/commissions/upload-receipt-doc",
    summary="Upload Supporting Commission Bank Statement or Receipt Document",
)
async def upload_commission_receipt_document_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(require_manager_or_above),
) -> dict[str, Any]:
    """Upload bank statement or receipt document (PDF, PNG, JPG, XLS, etc.) up to 15MB."""
    filename = file.filename or "receipt_document.pdf"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_RECEIPT_DOC_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed extensions: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG.",
        )
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File size exceeds maximum 15MB limit.")

    clean_name = "".join(c for c in filename if c.isalnum() or c in "._- ")
    storage_name = f"receipt_{uuid.uuid4().hex[:8]}_{clean_name}"
    storage_path = COMMISSION_RECEIPT_STORAGE_DIR / storage_name
    storage_path.write_bytes(content)

    doc_url = f"/api/v1/insurance/commissions/receipt-docs/{storage_name}"
    return {
        "success": True,
        "url": doc_url,
        "document_url": doc_url,
        "filename": filename,
        "storage_name": storage_name,
    }


@router.get(
    "/commissions/receipt-docs/{filename}",
    summary="Download / View Commission Bank Statement or Receipt Document",
)
async def download_commission_receipt_document_endpoint(
    filename: str,
    current_user: User = Depends(get_current_user),
):
    """Retrieve an uploaded commission receipt document."""
    p = (COMMISSION_RECEIPT_STORAGE_DIR / filename).resolve()
    if not p.is_relative_to(COMMISSION_RECEIPT_STORAGE_DIR) or not p.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt document not found.")
    return FileResponse(path=str(p), filename=filename)


@router.post(
    "/commissions/{commission_id}/dispute",
    response_model=PolicyCommissionResponse,
    summary="Flag Commission Discrepancy as Disputed",
)
async def dispute_commission_endpoint(
    commission_id: uuid.UUID,
    payload: CommissionDisputeRequest,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyCommissionResponse:
    """Flag an insurer commission as DISPUTED due to carrier discrepancy under review."""
    return await dispute_commission(
        session=session,
        commission_id=commission_id,
        user_id=current_user.id,
        dispute_reason=payload.dispute_reason,
    )


@router.post(
    "/commissions/{commission_id}/reverse",
    response_model=PolicyCommissionResponse,
    summary="Reverse Commission Receivable with Audit Reason",
)
async def reverse_commission_endpoint(
    commission_id: uuid.UUID,
    payload: CommissionReversalRequest,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyCommissionResponse:
    """Reverse an insurer commission receivable with mandatory audit explanation."""
    return await reverse_commission(
        session=session,
        commission_id=commission_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.patch(
    "/commissions/{commission_id}/status",
    response_model=PolicyCommissionResponse,
    summary="Update Commission Status (Legacy Compatibility)",
)
async def update_commission_status_endpoint(
    commission_id: uuid.UUID,
    payload: PolicyCommissionStatusUpdate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyCommissionResponse:
    """Transition commission record state."""
    return await update_commission_status(session, commission_id, payload)


@router.put(
    "/commissions/{commission_id}",
    response_model=PolicyCommissionResponse,
    summary="Update or Override Insurer Commission Details",
)
async def update_commission_endpoint(
    commission_id: uuid.UUID,
    payload: PolicyCommissionUpdate,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyCommissionResponse:
    """Configure or manually override insurer commission calculation values with reason."""
    return await update_policy_commission(
        session=session,
        commission_id=commission_id,
        user_id=current_user.id,
        payload=payload,
    )


# ===========================================================================
# 4. THE 8 FINANCIAL REPORTS AND CSV / EXCEL EXPORTS
# ===========================================================================


@router.get(
    "/commissions/reports/insurer-receivables/export",
    summary="Export Report 1: Insurer Commission Receivable Report",
)
async def export_report_1_endpoint(
    company_id: uuid.UUID | None = Query(default=None),
    policy_category: str | None = Query(default=None),
    commission_type: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    search: str | None = Query(default=None),
    format: str = Query(default="csv", pattern="^(csv|excel)$"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Download Report 1: Insurer Commission Receivable Report."""
    data = await export_report_1_insurer_receivables(
        session=session,
        company_id=company_id,
        policy_category=policy_category,
        commission_type=commission_type,
        status_filter=status_filter,
        from_date=from_date,
        to_date=to_date,
        search=search,
        output_format=format,
    )
    if format == "excel":
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=report_1_insurer_commission_receivables.xlsx"},
        )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=report_1_insurer_commission_receivables.csv"},
    )


@router.get(
    "/commissions/reports/insurer-receipts/export",
    summary="Export Report 2: Insurer Bank Receipt Report",
)
async def export_report_2_endpoint(
    company_id: uuid.UUID | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    search: str | None = Query(default=None),
    format: str = Query(default="csv", pattern="^(csv|excel)$"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Download Report 2: Insurer Bank Receipt Report."""
    data = await export_report_2_insurer_bank_receipts(
        session=session,
        company_id=company_id,
        from_date=from_date,
        to_date=to_date,
        search=search,
        output_format=format,
    )
    if format == "excel":
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=report_2_insurer_bank_receipts.xlsx"},
        )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=report_2_insurer_bank_receipts.csv"},
    )


@router.get(
    "/commissions/reports/insurer-tds/export",
    summary="Export Report 3: Insurer TDS Report",
)
async def export_report_3_endpoint(
    company_id: uuid.UUID | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    search: str | None = Query(default=None),
    format: str = Query(default="csv", pattern="^(csv|excel)$"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Download Report 3: Insurer TDS Report."""
    data = await export_report_3_insurer_tds(
        session=session,
        company_id=company_id,
        from_date=from_date,
        to_date=to_date,
        search=search,
        output_format=format,
    )
    if format == "excel":
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=report_3_insurer_tds.xlsx"},
        )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=report_3_insurer_tds.csv"},
    )


@router.get(
    "/commissions/reports/sub-agent-payables/export",
    summary="Export Report 4: Sub-Agent Payable Report",
)
async def export_report_4_endpoint(
    sub_agent_id: uuid.UUID | None = Query(default=None),
    company_id: uuid.UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    search: str | None = Query(default=None),
    format: str = Query(default="csv", pattern="^(csv|excel)$"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Download Report 4: Sub-Agent Payable Report."""
    data = await export_report_4_sub_agent_payables(
        session=session,
        sub_agent_id=sub_agent_id,
        company_id=company_id,
        status_filter=status_filter,
        from_date=from_date,
        to_date=to_date,
        search=search,
        output_format=format,
    )
    if format == "excel":
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=report_4_sub_agent_payables.xlsx"},
        )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=report_4_sub_agent_payables.csv"},
    )


@router.get(
    "/commissions/reports/sub-agent-payments/export",
    summary="Export Report 5: Sub-Agent Payment History",
)
async def export_report_5_endpoint(
    sub_agent_id: uuid.UUID | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    search: str | None = Query(default=None),
    format: str = Query(default="csv", pattern="^(csv|excel)$"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Download Report 5: Sub-Agent Payment History."""
    data = await export_report_5_sub_agent_payment_history(
        session=session,
        sub_agent_id=sub_agent_id,
        from_date=from_date,
        to_date=to_date,
        search=search,
        output_format=format,
    )
    if format == "excel":
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=report_5_sub_agent_payment_history.xlsx"},
        )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=report_5_sub_agent_payment_history.csv"},
    )


@router.get(
    "/commissions/reports/policy-wise/export",
    summary="Export Report 6: Policy-wise Commission Report",
)
async def export_report_6_endpoint(
    company_id: uuid.UUID | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    search: str | None = Query(default=None),
    format: str = Query(default="csv", pattern="^(csv|excel)$"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Download Report 6: Policy-wise Commission Report."""
    data = await export_report_6_policy_wise(
        session=session,
        company_id=company_id,
        from_date=from_date,
        to_date=to_date,
        search=search,
        output_format=format,
    )
    if format == "excel":
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=report_6_policy_wise_commission.xlsx"},
        )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=report_6_policy_wise_commission.csv"},
    )


@router.get(
    "/commissions/reports/agent-wise/export",
    summary="Export Report 7: Agent-wise Commission Report",
)
async def export_report_7_endpoint(
    company_id: uuid.UUID | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    format: str = Query(default="csv", pattern="^(csv|excel)$"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Download Report 7: Agent-wise Commission Report."""
    data = await export_report_7_agent_wise(
        session=session,
        company_id=company_id,
        from_date=from_date,
        to_date=to_date,
        output_format=format,
    )
    if format == "excel":
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=report_7_agent_wise_commission.xlsx"},
        )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=report_7_agent_wise_commission.csv"},
    )


@router.get(
    "/commissions/reports/financial-reconciliation/export",
    summary="Export Report 8: Financial Reconciliation Report",
)
async def export_report_8_endpoint(
    format: str = Query(default="csv", pattern="^(csv|excel)$"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Download Report 8: Financial Reconciliation Report."""
    data = await export_report_8_financial_reconciliation(
        session=session,
        output_format=format,
    )
    if format == "excel":
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=report_8_financial_reconciliation.xlsx"},
        )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=report_8_financial_reconciliation.csv"},
    )


@router.get(
    "/commissions/reports/agent-performance",
    response_model=list[AgentPerformanceReportItem],
    summary="Get Real Agent Performance Metrics",
)
async def get_agent_performance_reports_endpoint(
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    company_id: uuid.UUID | None = Query(default=None),
    policy_category: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[AgentPerformanceReportItem]:
    """Retrieve aggregated performance metrics grouped by sub-agent and firm direct."""
    return await get_agent_performance_reports(
        session=session,
        from_date=from_date,
        to_date=to_date,
        company_id=company_id,
        policy_category=policy_category,
    )


@router.get(
    "/commissions/reports/export/csv",
    summary="Export Commission Ledger to CSV (Legacy Compatibility)",
)
async def export_commissions_csv_endpoint(
    agent_id: uuid.UUID | None = Query(default=None),
    company_id: uuid.UUID | None = Query(default=None),
    policy_category: str | None = Query(default=None),
    commission_type: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    search: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Download filtered commission ledger as CSV with formatted Indian currency columns."""
    csv_data = await export_commissions_csv(
        session=session,
        agent_id=agent_id,
        company_id=company_id,
        policy_category=policy_category,
        commission_type=commission_type,
        status_filter=status_filter,
        from_date=from_date,
        to_date=to_date,
        search=search,
    )
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=insurance_commission_ledger.csv"},
    )


@router.get(
    "/commissions/reports/export/excel",
    summary="Export Commission Ledger to Excel (Legacy Compatibility)",
)
async def export_commissions_excel_endpoint(
    agent_id: uuid.UUID | None = Query(default=None),
    company_id: uuid.UUID | None = Query(default=None),
    policy_category: str | None = Query(default=None),
    commission_type: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    search: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Download filtered commission ledger as a styled Excel spreadsheet."""
    excel_data = await export_commissions_excel(
        session=session,
        agent_id=agent_id,
        company_id=company_id,
        policy_category=policy_category,
        commission_type=commission_type,
        status_filter=status_filter,
        from_date=from_date,
        to_date=to_date,
        search=search,
    )
    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=insurance_commission_ledger.xlsx"},
    )




@router.get(
    "/commissions/reports",
    summary="Get Agent-wise Commission Summary Reports (Legacy Compatibility)",
)
async def get_commission_reports_endpoint(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Retrieve total gross commissions, sub-agent allocations, net firm earnings, and agent breakdown."""
    return await get_commission_reports(session)
