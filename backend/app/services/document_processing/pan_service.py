"""PAN card document processing orchestration service.

Handles:
- Client name normalization.
- Ephemeral DDMMYYYY password derivation and unlocking.
- Fixed ID-1 boundary cropping and 300 DPI rasterization.
- Standardized client name-based output file naming.
- ZIP package assembly.
- Zero-leak cleanup on error or success.
"""

from __future__ import annotations

import urllib.parse
from dataclasses import dataclass
from pathlib import Path

from app.schemas.toolkit import DocumentProcessResponse, ProcessedFileItem
from app.services.document_processing.archive import create_zip_archive
from app.services.document_processing.cropping import detect_pan_card_crop_rect
from app.services.document_processing.exceptions import DocumentProcessingError
from app.services.document_processing.naming import get_pan_filenames
from app.services.document_processing.passwords import derive_pan_password
from app.services.document_processing.pdf_export import (
    export_cropped_pdf_and_image,
    export_unlocked_pdf,
)
from app.services.document_processing.storage import (
    cleanup_job_directory,
    create_job_directory,
)
from app.services.document_processing.validators import open_and_unlock_pdf


@dataclass
class PANProcessResult:
    """Structured result returned by PAN processing pipeline."""

    job_id: str
    status: str
    tool: str
    message: str
    files: list[ProcessedFileItem]
    zip_download_url: str | None

    def to_response(self) -> DocumentProcessResponse:
        return DocumentProcessResponse(
            job_id=self.job_id,
            status=self.status,
            tool=self.tool,
            message=self.message,
            files=self.files,
            zip_download_url=self.zip_download_url,
        )


def process_pan_document(
    file_bytes: bytes,
    full_name: str,
    dob: str,
    custom_rect: list[float] | None = None,
) -> PANProcessResult:
    """Orchestrate PAN document processing.

    Args:
        file_bytes: Raw bytes of uploaded PAN PDF
        full_name: Client's full name (used for output file naming)
        dob: Client's Date of Birth (DD/MM/YYYY or YYYY-MM-DD for password derivation)
        custom_rect: Optional custom boundary override (if valid)

    Returns:
        PANProcessResult containing generated files metadata and download links.
    """
    if not file_bytes:
        raise DocumentProcessingError("Uploaded PAN file is empty.")

    # Derive password (validates inputs; never stored, logged, or returned)
    password = derive_pan_password(dob)

    # Get standardized client-based output filenames
    filenames = get_pan_filenames(full_name)

    job_id, job_dir = create_job_directory("pan")

    try:
        doc, _ = open_and_unlock_pdf(file_bytes, password)

        # 1. Unlocked full PDF
        unlocked_name = filenames["unlocked"]
        unlocked_path = job_dir / unlocked_name
        export_unlocked_pdf(doc, unlocked_path)
        unlocked_size = unlocked_path.stat().st_size
        encoded_unlocked = urllib.parse.quote(unlocked_name)

        # 2. Cropped PDF and 300 DPI JPEG
        crop_rect = detect_pan_card_crop_rect(doc[0], custom_rect)
        cropped_pdf_name = filenames["cropped"]
        cropped_img_name = filenames["jpg"]
        cropped_pdf_path = job_dir / cropped_pdf_name
        cropped_img_path = job_dir / cropped_img_name

        pdf_size, img_size = export_cropped_pdf_and_image(
            doc, crop_rect, cropped_pdf_path, cropped_img_path, dpi=300
        )
        doc.close()

        encoded_pdf = urllib.parse.quote(cropped_pdf_name)
        encoded_img = urllib.parse.quote(cropped_img_name)

        files_to_zip = [
            (unlocked_path, unlocked_name),
            (cropped_pdf_path, cropped_pdf_name),
            (cropped_img_path, cropped_img_name),
        ]

        # 3. ZIP package
        zip_name = filenames["zip"]
        zip_path = job_dir / zip_name
        create_zip_archive(files_to_zip, zip_path)
        encoded_zip = urllib.parse.quote(zip_name)

        processed_items = [
            ProcessedFileItem(
                name=unlocked_name,
                file_type="unlocked_pdf",
                size_bytes=unlocked_size,
                mime_type="application/pdf",
                download_url=f"/api/v1/toolkit/download/{job_id}/{encoded_unlocked}",
                preview_url=f"/api/v1/toolkit/preview/{job_id}/{encoded_unlocked}",
            ),
            ProcessedFileItem(
                name=cropped_pdf_name,
                file_type="cropped_pdf",
                size_bytes=pdf_size,
                mime_type="application/pdf",
                download_url=f"/api/v1/toolkit/download/{job_id}/{encoded_pdf}",
                preview_url=f"/api/v1/toolkit/preview/{job_id}/{encoded_pdf}",
            ),
            ProcessedFileItem(
                name=cropped_img_name,
                file_type="card_image",
                size_bytes=img_size,
                mime_type="image/jpeg",
                download_url=f"/api/v1/toolkit/download/{job_id}/{encoded_img}",
                preview_url=f"/api/v1/toolkit/preview/{job_id}/{encoded_img}",
            ),
        ]

        return PANProcessResult(
            job_id=job_id,
            status="SUCCESS",
            tool="pan_processor",
            message="PAN document decrypted and cropped successfully.",
            files=processed_items,
            zip_download_url=f"/api/v1/toolkit/download/{job_id}/{encoded_zip}",
        )
    except Exception:
        # On failure, clean up the job directory to prevent leaving orphaned temporary files
        cleanup_job_directory(job_dir)
        raise
