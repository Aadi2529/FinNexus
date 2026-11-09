"""Bulk Policy Import Router for CSV and Excel Spreadsheets."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_manager_or_above
from app.db.models.auth import User
from app.db.session import get_db_session
from app.schemas.insurance import (
    PolicyImportConfirmRequest,
    PolicyImportPreviewResponse,
    PolicyImportResult,
)
from app.services.insurance import (
    confirm_policy_import,
    generate_import_template,
    preview_policy_import,
    export_policies_to_excel,
)

router = APIRouter(tags=["Bulk Policy Import"])


@router.get(
    "/import/template",
    summary="Download Sample Spreadsheet Template for Policy Import",
)
@router.get(
    "/policies/import/template",
    summary="Download Sample Spreadsheet Template for Policy Import",
)
async def download_import_template_endpoint(
    format_type: str = Query(default="csv", alias="format"),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Download standard import template with column headers and example rows."""
    content_bytes, filename, mime = generate_import_template(format_type)
    return Response(
        content=content_bytes,
        media_type=mime,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.post(
    "/import/preview",
    response_model=PolicyImportPreviewResponse,
    summary="Upload and Preview Spreadsheet with Row-Level Validation",
)
@router.post(
    "/policies/import/preview",
    response_model=PolicyImportPreviewResponse,
    summary="Upload and Preview Spreadsheet with Row-Level Validation",
)
async def preview_import_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyImportPreviewResponse:
    """Parse uploaded file and validate references (customer, carrier, plan) and detect duplicate policies."""
    return await preview_policy_import(session, file)


@router.post(
    "/import/confirm",
    response_model=PolicyImportResult,
    summary="Confirm and Execute Bulk Policy Import",
)
@router.post(
    "/policies/import/confirm",
    response_model=PolicyImportResult,
    summary="Confirm and Execute Bulk Policy Import",
)
async def confirm_import_endpoint(
    request: Request,
    current_user: User = Depends(require_manager_or_above),
    session: AsyncSession = Depends(get_db_session),
) -> PolicyImportResult:
    """Import valid rows transactionally with automatic schedule and commission generation."""
    content_type = request.headers.get("content-type", "").lower()
    if "multipart/form-data" in content_type:
        form = await request.form()
        uploaded_file = form.get("file")
        if not uploaded_file:
            raise HTTPException(status_code=400, detail="No file uploaded in form.")
        return await confirm_policy_import(session, uploaded_file, user_id=current_user.id)

    try:
        body = await request.json()
    except Exception:
        body = None

    if isinstance(body, dict) and "rows" in body:
        return await confirm_policy_import(session, body["rows"], user_id=current_user.id)
    if isinstance(body, list):
        return await confirm_policy_import(session, body, user_id=current_user.id)

    raise HTTPException(status_code=400, detail="Either file upload or confirmation payload required.")



@router.get(
    "/policies/export/excel",
    summary="Export Policies to Year-Wise / 33-Heading Excel Workbook",
)
@router.get(
    "/export/excel",
    summary="Export Policies to Year-Wise / 33-Heading Excel Workbook",
)
async def export_policies_excel_endpoint(
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    policy_type: str | None = Query(default=None),
    business_type: str | None = Query(default=None),
    company_id: uuid.UUID | None = Query(default=None),
    customer_id: uuid.UUID | None = Query(default=None),
    issue_year: int | str | None = Query(default=None),
    coverage_year: str | None = Query(default=None),
    year_bucket: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Export registered policies with year-wise lifecycle data in genuine Excel format."""
    content_bytes, filename, mime = await export_policies_to_excel(
        session,
        search=search,
        status_filter=status_filter,
        policy_type=policy_type,
        business_type=business_type,
        company_id=company_id,
        customer_id=customer_id,
        issue_year=issue_year,
        coverage_year=coverage_year,
        year_bucket=year_bucket,
    )
    return Response(
        content=content_bytes,
        media_type=mime,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )
