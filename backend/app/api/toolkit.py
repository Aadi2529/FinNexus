"""FinanceFlow Toolkit Module Endpoints."""

import hashlib
import re
import uuid
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.models.auth import User
from app.db.models.documents import Document
from app.db.session import get_db_session
from app.schemas.toolkit import (
    AmortizationMonth,
    DocumentProcessResponse,
    DocumentUploadResponse,
    EMICalculatorRequest,
    EMICalculatorResponse,
    ImagesToPDFResponse,
    PanVerifyRequest,
    PanVerifyResponse,
    PDFMergeResponse,
    ProcessedFileItem,
    SIPCalculatorRequest,
    SIPCalculatorResponse,
    SIPYearBreakdown,
)
from app.services.document_processor import (
    TOOLKIT_TEMP_DIR,
    DocumentProcessingError,
    cleanup_expired_jobs,
    convert_images_to_pdf,
    create_job_directory,
    create_zip_archive,
    derive_aadhaar_password,
    derive_pan_password,
    detect_aadhaar_card_crop_rect,
    detect_pan_card_crop_rect,
    export_cropped_pdf_and_image,
    export_unlocked_pdf,
    merge_pdf_documents,
    open_and_unlock_pdf,
    sanitize_filename,
)

router = APIRouter(prefix="/toolkit", tags=["Finance Toolkit"])

# Storage directory outside web root
STORAGE_DIR = Path("storage/documents")
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

MAGIC_BYTES = {
    "application/pdf": b"%PDF",
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/jpeg": b"\xff\xd8\xff",
}

PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
PAN_ENTITY_TYPES = {
    "P": "Individual",
    "C": "Company",
    "H": "Hindu Undivided Family (HUF)",
    "F": "Firm / Partnership",
    "A": "Association of Persons (AOP)",
    "T": "Trust",
    "B": "Body of Individuals (BOI)",
    "L": "Local Authority",
    "J": "Artificial Juridical Person",
    "G": "Government Agency",
}


@router.post(
    "/calculator/emi",
    response_model=EMICalculatorResponse,
    summary="Reducing Balance Loan EMI Calculator",
)
async def calculate_emi(
    payload: EMICalculatorRequest,
    current_user: User = Depends(get_current_user),
) -> EMICalculatorResponse:
    """Calculate monthly installment (EMI), interest, and amortization schedule using Python Decimal."""
    p = payload.principal
    annual_rate = payload.annual_interest_rate
    n = payload.tenure_months

    # Monthly interest rate r = annual_rate / 12 / 100
    r = annual_rate / Decimal("1200")

    # Formula: EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
    # Using decimal power
    factor = (Decimal("1") + r) ** n
    numerator = p * r * factor
    denominator = factor - Decimal("1")

    emi = (numerator / denominator).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total_payment = (emi * Decimal(str(n))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    total_interest = (total_payment - p).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    # First 12 months amortization schedule
    schedule: list[AmortizationMonth] = []
    current_balance = p

    for m in range(1, min(13, n + 1)):
        interest_comp = (current_balance * r).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        principal_comp = (emi - interest_comp).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        ending_balance = max(Decimal("0.00"), current_balance - principal_comp)

        schedule.append(
            AmortizationMonth(
                month=m,
                beginning_balance=current_balance,
                emi=emi,
                principal_component=principal_comp,
                interest_component=interest_comp,
                ending_balance=ending_balance,
            )
        )
        current_balance = ending_balance

    return EMICalculatorResponse(
        monthly_emi=emi,
        total_interest=total_interest,
        total_payment=total_payment,
        principal=p,
        tenure_months=n,
        annual_interest_rate=annual_rate,
        amortization_schedule=schedule,
    )


@router.post(
    "/calculator/sip",
    response_model=SIPCalculatorResponse,
    summary="SIP Compound Wealth Planner",
)
async def calculate_sip(
    payload: SIPCalculatorRequest,
    current_user: User = Depends(get_current_user),
) -> SIPCalculatorResponse:
    """Calculate systematic investment compounding and wealth projections using Python Decimal."""
    p = payload.monthly_investment
    annual_rate = payload.expected_annual_return_pct
    years = payload.tenure_years
    total_months = years * 12

    # Monthly return rate i = annual_rate / 12 / 100
    i = annual_rate / Decimal("1200")

    # Formula: M = P * ((1 + i)^n - 1) / i * (1 + i)
    factor = (Decimal("1") + i) ** total_months
    total_maturity = (p * ((factor - Decimal("1")) / i) * (Decimal("1") + i)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    total_invested = (p * Decimal(str(total_months))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    est_returns = (total_maturity - total_invested).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    # Yearly breakdown
    yearly_breakdown: list[SIPYearBreakdown] = []
    for yr in range(1, years + 1):
        m_count = yr * 12
        yr_factor = (Decimal("1") + i) ** m_count
        yr_val = (p * ((yr_factor - Decimal("1")) / i) * (Decimal("1") + i)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        yr_inv = (p * Decimal(str(m_count))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        yearly_breakdown.append(
            SIPYearBreakdown(
                year=yr,
                amount_invested=yr_inv,
                total_value=yr_val,
                wealth_gained=(yr_val - yr_inv).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                ),
            )
        )

    return SIPCalculatorResponse(
        total_invested=total_invested,
        estimated_returns=est_returns,
        total_maturity_value=total_maturity,
        tenure_years=years,
        monthly_investment=p,
        yearly_breakdown=yearly_breakdown,
    )


@router.post(
    "/documents/verify-pan",
    response_model=PanVerifyResponse,
    summary="Validate Indian PAN Format and Entity Classification",
)
async def verify_pan(
    payload: PanVerifyRequest,
    current_user: User = Depends(get_current_user),
) -> PanVerifyResponse:
    """Validate Indian Permanent Account Number against statutory syntax rules."""
    pan = payload.pan_number.strip().upper()

    if not PAN_REGEX.match(pan):
        return PanVerifyResponse(
            pan_number=pan,
            is_valid=False,
            entity_type=None,
            message="Invalid PAN format. Must be 5 uppercase letters, 4 digits, and 1 letter (e.g. ABCDE1234F).",
        )

    entity_code = pan[3]
    entity_name = PAN_ENTITY_TYPES.get(entity_code, "Unknown Entity")

    return PanVerifyResponse(
        pan_number=pan,
        is_valid=True,
        entity_type=entity_name,
        message=f"Valid PAN card number for {entity_name}.",
    )


@router.post(
    "/documents/upload",
    response_model=DocumentUploadResponse,
    summary="Secure File Upload with Magic-Byte Inspection & Integrity Hash",
)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> DocumentUploadResponse:
    """Upload document, inspect magic bytes, enforce MIME security, and generate SHA-256 digest."""
    contents = await file.read()
    file_size = len(contents)

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    # Magic byte inspection
    detected_mime = None
    for mime, magic in MAGIC_BYTES.items():
        if contents.startswith(magic):
            detected_mime = mime
            break

    if not detected_mime:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Invalid file format. Only authentic PDF, PNG, and JPEG documents are permitted.",
        )

    # Calculate cryptographic SHA-256 hash
    sha256_hash = hashlib.sha256(contents).hexdigest()

    # Generate safe storage filename outside web root
    ext = (
        ".pdf"
        if detected_mime == "application/pdf"
        else (".png" if detected_mime == "image/png" else ".jpg")
    )
    safe_filename = f"{uuid.uuid4()}{ext}"

    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    destination_path = STORAGE_DIR / safe_filename

    with open(destination_path, "wb") as f:
        f.write(contents)

    return DocumentUploadResponse(
        id=str(uuid.uuid4()),
        original_filename=file.filename or "unknown",
        file_size_bytes=file_size,
        mime_type=detected_mime,
        sha256_hash=sha256_hash,
        verification_status="PENDING",
        message="Document uploaded and cryptographically verified successfully.",
    )


@router.get(
    "/documents",
    summary="List Verified Vault Documents",
)
async def list_documents(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Retrieve list of registered compliance documents."""
    stmt = select(Document).order_by(Document.created_at.desc()).limit(50)
    res = await session.execute(stmt)
    docs = res.scalars().all()
    return [
        {
            "id": str(d.id),
            "customer_id": str(d.customer_id),
            "document_type": d.document_type,
            "original_filename": d.original_filename,
            "file_size_bytes": d.file_size_bytes,
            "mime_type": d.mime_type,
            "sha256_hash": d.sha256_hash,
            "verification_status": d.verification_status,
            "created_at": d.created_at.isoformat(),
        }
        for d in docs
    ]


@router.post(
    "/identity/aadhaar",
    response_model=DocumentProcessResponse,
    summary="Process Aadhaar Card PDF (Normal / Masked)",
)
async def process_aadhaar(
    full_name: str = Form(...),
    dob: str = Form(...),
    normal_file: UploadFile | None = File(None),
    masked_file: UploadFile | None = File(None),
    custom_crop_json: str | None = Form(None),
    current_user: User = Depends(get_current_user),
) -> DocumentProcessResponse:
    """Process Normal and/or Masked Aadhaar PDF, authenticate via UIDAI password rule, and extract print-ready card."""
    cleanup_expired_jobs()
    if not normal_file and not masked_file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one Aadhaar PDF (Normal or Masked) must be provided for processing.",
        )

    try:
        password = derive_aadhaar_password(full_name, dob)
    except DocumentProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    custom_rect = None
    if custom_crop_json:
        try:
            import json

            rect_data = json.loads(custom_crop_json)
            if isinstance(rect_data, list) and len(rect_data) == 4:
                custom_rect = [float(x) for x in rect_data]
        except Exception:
            pass

    job_id, job_dir = create_job_directory("aadhaar")
    processed_items: list[ProcessedFileItem] = []
    files_to_zip: list[tuple[Path, str]] = []

    try:
        # Process Normal Aadhaar if present
        if normal_file:
            content = await normal_file.read()
            doc, _ = open_and_unlock_pdf(content, password)

            # 1. Unlocked full PDF
            unlocked_filename = "normal_aadhaar_unlocked.pdf"
            unlocked_path = job_dir / unlocked_filename
            export_unlocked_pdf(doc, unlocked_path)
            unlocked_size = unlocked_path.stat().st_size
            processed_items.append(
                ProcessedFileItem(
                    name=unlocked_filename,
                    file_type="unlocked_pdf",
                    size_bytes=unlocked_size,
                    mime_type="application/pdf",
                    download_url=f"/api/v1/toolkit/download/{job_id}/{unlocked_filename}",
                    preview_url=f"/api/v1/toolkit/preview/{job_id}/{unlocked_filename}",
                )
            )
            files_to_zip.append((unlocked_path, unlocked_filename))

            # 2. Cropped PDF and 300 DPI JPEG
            crop_rect = detect_aadhaar_card_crop_rect(doc[0], custom_rect)
            cropped_pdf_filename = "normal_aadhaar_cropped.pdf"
            cropped_img_filename = "normal_aadhaar.jpg"
            cropped_pdf_path = job_dir / cropped_pdf_filename
            cropped_img_path = job_dir / cropped_img_filename

            pdf_size, img_size = export_cropped_pdf_and_image(
                doc, crop_rect, cropped_pdf_path, cropped_img_path, dpi=300
            )

            processed_items.append(
                ProcessedFileItem(
                    name=cropped_pdf_filename,
                    file_type="cropped_pdf",
                    size_bytes=pdf_size,
                    mime_type="application/pdf",
                    download_url=f"/api/v1/toolkit/download/{job_id}/{cropped_pdf_filename}",
                    preview_url=f"/api/v1/toolkit/preview/{job_id}/{cropped_pdf_filename}",
                )
            )
            files_to_zip.append((cropped_pdf_path, cropped_pdf_filename))

            processed_items.append(
                ProcessedFileItem(
                    name=cropped_img_filename,
                    file_type="card_image",
                    size_bytes=img_size,
                    mime_type="image/jpeg",
                    download_url=f"/api/v1/toolkit/download/{job_id}/{cropped_img_filename}",
                    preview_url=f"/api/v1/toolkit/preview/{job_id}/{cropped_img_filename}",
                )
            )
            files_to_zip.append((cropped_img_path, cropped_img_filename))
            doc.close()

        # Process Masked Aadhaar if present
        if masked_file:
            content = await masked_file.read()
            doc, _ = open_and_unlock_pdf(content, password)

            unlocked_filename = "masked_aadhaar_unlocked.pdf"
            unlocked_path = job_dir / unlocked_filename
            export_unlocked_pdf(doc, unlocked_path)
            unlocked_size = unlocked_path.stat().st_size
            processed_items.append(
                ProcessedFileItem(
                    name=unlocked_filename,
                    file_type="unlocked_pdf",
                    size_bytes=unlocked_size,
                    mime_type="application/pdf",
                    download_url=f"/api/v1/toolkit/download/{job_id}/{unlocked_filename}",
                    preview_url=f"/api/v1/toolkit/preview/{job_id}/{unlocked_filename}",
                )
            )
            files_to_zip.append((unlocked_path, unlocked_filename))

            crop_rect = detect_aadhaar_card_crop_rect(doc[0], custom_rect)
            cropped_pdf_filename = "masked_aadhaar_cropped.pdf"
            cropped_img_filename = "masked_aadhaar.jpg"
            cropped_pdf_path = job_dir / cropped_pdf_filename
            cropped_img_path = job_dir / cropped_img_filename

            pdf_size, img_size = export_cropped_pdf_and_image(
                doc, crop_rect, cropped_pdf_path, cropped_img_path, dpi=300
            )

            processed_items.append(
                ProcessedFileItem(
                    name=cropped_pdf_filename,
                    file_type="cropped_pdf",
                    size_bytes=pdf_size,
                    mime_type="application/pdf",
                    download_url=f"/api/v1/toolkit/download/{job_id}/{cropped_pdf_filename}",
                    preview_url=f"/api/v1/toolkit/preview/{job_id}/{cropped_pdf_filename}",
                )
            )
            files_to_zip.append((cropped_pdf_path, cropped_pdf_filename))

            processed_items.append(
                ProcessedFileItem(
                    name=cropped_img_filename,
                    file_type="card_image",
                    size_bytes=img_size,
                    mime_type="image/jpeg",
                    download_url=f"/api/v1/toolkit/download/{job_id}/{cropped_img_filename}",
                    preview_url=f"/api/v1/toolkit/preview/{job_id}/{cropped_img_filename}",
                )
            )
            files_to_zip.append((cropped_img_path, cropped_img_filename))
            doc.close()

        zip_download_url = None
        if len(files_to_zip) > 1:
            zip_filename = "aadhaar_processed_files.zip"
            zip_path = job_dir / zip_filename
            create_zip_archive(files_to_zip, zip_path)
            zip_download_url = f"/api/v1/toolkit/download/{job_id}/{zip_filename}"

        return DocumentProcessResponse(
            job_id=job_id,
            status="SUCCESS",
            tool="aadhaar_processor",
            message=f"Successfully processed {len(files_to_zip)} Aadhaar documents and generated unlocked, cropped card outputs.",
            files=processed_items,
            zip_download_url=zip_download_url,
        )
    except DocumentProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing Aadhaar document: {str(exc)}",
        )


@router.post(
    "/identity/pan",
    response_model=DocumentProcessResponse,
    summary="Process PAN Card PDF",
)
async def process_pan(
    file: UploadFile = File(...),
    full_name: str = Form(...),
    dob: str = Form(...),
    custom_crop_json: str | None = Form(None),
    current_user: User = Depends(get_current_user),
) -> DocumentProcessResponse:
    """Process PAN PDF, unlock using DDMMYYYY password convention, and extract print-ready PAN card."""
    cleanup_expired_jobs()
    try:
        password = derive_pan_password(dob)
    except DocumentProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    custom_rect = None
    if custom_crop_json:
        try:
            import json

            rect_data = json.loads(custom_crop_json)
            if isinstance(rect_data, list) and len(rect_data) == 4:
                custom_rect = [float(x) for x in rect_data]
        except Exception:
            pass

    job_id, job_dir = create_job_directory("pan")
    content = await file.read()

    try:
        doc, _ = open_and_unlock_pdf(content, password)

        # 1. Unlocked full PDF
        unlocked_filename = "pan_unlocked.pdf"
        unlocked_path = job_dir / unlocked_filename
        export_unlocked_pdf(doc, unlocked_path)
        unlocked_size = unlocked_path.stat().st_size

        # 2. Cropped PDF and 300 DPI JPEG
        crop_rect = detect_pan_card_crop_rect(doc[0], custom_rect)
        cropped_pdf_filename = "pan_cropped.pdf"
        cropped_img_filename = "pan_card.jpg"
        cropped_pdf_path = job_dir / cropped_pdf_filename
        cropped_img_path = job_dir / cropped_img_filename

        pdf_size, img_size = export_cropped_pdf_and_image(
            doc, crop_rect, cropped_pdf_path, cropped_img_path, dpi=300
        )
        doc.close()

        files_to_zip = [
            (unlocked_path, unlocked_filename),
            (cropped_pdf_path, cropped_pdf_filename),
            (cropped_img_path, cropped_img_filename),
        ]

        zip_filename = "pan_processed_files.zip"
        zip_path = job_dir / zip_filename
        create_zip_archive(files_to_zip, zip_path)

        return DocumentProcessResponse(
            job_id=job_id,
            status="SUCCESS",
            tool="pan_processor",
            message="PAN document decrypted and cropped successfully.",
            files=[
                ProcessedFileItem(
                    name=unlocked_filename,
                    file_type="unlocked_pdf",
                    size_bytes=unlocked_size,
                    mime_type="application/pdf",
                    download_url=f"/api/v1/toolkit/download/{job_id}/{unlocked_filename}",
                    preview_url=f"/api/v1/toolkit/preview/{job_id}/{unlocked_filename}",
                ),
                ProcessedFileItem(
                    name=cropped_pdf_filename,
                    file_type="cropped_pdf",
                    size_bytes=pdf_size,
                    mime_type="application/pdf",
                    download_url=f"/api/v1/toolkit/download/{job_id}/{cropped_pdf_filename}",
                    preview_url=f"/api/v1/toolkit/preview/{job_id}/{cropped_pdf_filename}",
                ),
                ProcessedFileItem(
                    name=cropped_img_filename,
                    file_type="card_image",
                    size_bytes=img_size,
                    mime_type="image/jpeg",
                    download_url=f"/api/v1/toolkit/download/{job_id}/{cropped_img_filename}",
                    preview_url=f"/api/v1/toolkit/preview/{job_id}/{cropped_img_filename}",
                ),
            ],
            zip_download_url=f"/api/v1/toolkit/download/{job_id}/{zip_filename}",
        )
    except DocumentProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing PAN document: {str(exc)}",
        )


@router.post(
    "/pdf/merge",
    response_model=PDFMergeResponse,
    summary="Merge Multiple PDF Documents",
)
async def merge_pdfs(
    files: list[UploadFile] = File(...),
    output_filename: str = Form("merged_document.pdf"),
    current_user: User = Depends(get_current_user),
) -> PDFMergeResponse:
    """Merge two or more PDFs into a single file preserving order."""
    cleanup_expired_jobs()
    if len(files) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 2 PDF documents are required to perform a merge.",
        )
    if len(files) > 25:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 25 PDF documents can be merged in a single request.",
        )

    safe_name = sanitize_filename(output_filename)
    if not safe_name.lower().endswith(".pdf"):
        safe_name += ".pdf"

    job_id, job_dir = create_job_directory("merge")
    out_path = job_dir / safe_name

    pdf_streams = []
    total_bytes = 0
    for f in files:
        data = await f.read()
        total_bytes += len(data)
        if total_bytes > 120 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Total upload size exceeds 120MB merge limit.",
            )
        pdf_streams.append((f.filename or "doc.pdf", data))

    try:
        total_pages, file_size = merge_pdf_documents(pdf_streams, out_path)
        return PDFMergeResponse(
            job_id=job_id,
            status="SUCCESS",
            total_pages=total_pages,
            file_size_bytes=file_size,
            output_filename=safe_name,
            download_url=f"/api/v1/toolkit/download/{job_id}/{safe_name}",
        )
    except DocumentProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to merge PDF documents: {str(exc)}",
        )


@router.post(
    "/images/to-pdf",
    response_model=ImagesToPDFResponse,
    summary="Convert Multiple Images into a Consolidated PDF",
)
async def convert_images(
    files: list[UploadFile] = File(...),
    page_size: str = Form("a4"),
    orientation: str = Form("auto"),
    margin: str = Form("small"),
    output_filename: str = Form("converted_images.pdf"),
    current_user: User = Depends(get_current_user),
) -> ImagesToPDFResponse:
    """Convert multiple images (JPEG, PNG, WebP) into a clean, proportion-preserved PDF."""
    cleanup_expired_jobs()
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one image is required.",
        )
    if len(files) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 50 images can be compiled in a single request.",
        )

    safe_name = sanitize_filename(output_filename)
    if not safe_name.lower().endswith(".pdf"):
        safe_name += ".pdf"

    job_id, job_dir = create_job_directory("img2pdf")
    out_path = job_dir / safe_name

    img_streams = []
    for f in files:
        data = await f.read()
        img_streams.append((f.filename or "image.jpg", data))

    try:
        pages, file_size = convert_images_to_pdf(
            img_streams,
            out_path,
            page_size=page_size,
            orientation=orientation,
            margin=margin,
        )
        return ImagesToPDFResponse(
            job_id=job_id,
            status="SUCCESS",
            total_pages=pages,
            file_size_bytes=file_size,
            output_filename=safe_name,
            download_url=f"/api/v1/toolkit/download/{job_id}/{safe_name}",
        )
    except DocumentProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to convert images to PDF: {str(exc)}",
        )


@router.get(
    "/download/{job_id}/{filename}",
    summary="Download Processed Document or ZIP Package",
)
async def download_processed_file(
    job_id: str,
    filename: str,
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Securely download a processed document with strict filename and path verification."""
    if not re.match(r"^[a-zA-Z0-9_-]+$", job_id) or not re.match(
        r"^[a-zA-Z0-9._-]+$", filename
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request parameters.",
        )

    target_file = (TOOLKIT_TEMP_DIR / job_id / filename).resolve()
    base_dir = TOOLKIT_TEMP_DIR.resolve()

    if (
        not str(target_file).startswith(str(base_dir))
        or not target_file.exists()
        or not target_file.is_file()
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requested file was not found or has expired.",
        )

    ext = target_file.suffix.lower()
    media_type = "application/octet-stream"
    if ext == ".pdf":
        media_type = "application/pdf"
    elif ext in [".jpg", ".jpeg"]:
        media_type = "image/jpeg"
    elif ext == ".png":
        media_type = "image/png"
    elif ext == ".zip":
        media_type = "application/zip"

    return FileResponse(
        path=target_file,
        filename=filename,
        media_type=media_type,
        headers={
            "Cache-Control": "private, no-store, max-age=0, must-revalidate",
            "Pragma": "no-cache",
        },
    )


@router.get(
    "/preview/{job_id}/{filename}",
    summary="Preview Processed Document or Card Image Inline",
)
async def preview_processed_file(
    job_id: str,
    filename: str,
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Inline preview of generated cropped card image or PDF."""
    if not re.match(r"^[a-zA-Z0-9_-]+$", job_id) or not re.match(
        r"^[a-zA-Z0-9._-]+$", filename
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request parameters.",
        )

    target_file = (TOOLKIT_TEMP_DIR / job_id / filename).resolve()
    base_dir = TOOLKIT_TEMP_DIR.resolve()

    if (
        not str(target_file).startswith(str(base_dir))
        or not target_file.exists()
        or not target_file.is_file()
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requested preview was not found or has expired.",
        )

    ext = target_file.suffix.lower()
    media_type = (
        "application/pdf"
        if ext == ".pdf"
        else ("image/jpeg" if ext in [".jpg", ".jpeg"] else "image/png")
    )

    return FileResponse(
        path=target_file,
        media_type=media_type,
        content_disposition_type="inline",
        headers={
            "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        },
    )

