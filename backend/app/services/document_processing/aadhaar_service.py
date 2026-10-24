"""Aadhaar document processing orchestration service.

Handles:
- Client name normalization.
- Ephemeral password derivation and unlocking.
- Fixed boundary cropping and 300 DPI rasterization for Normal and/or Masked documents.
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
from app.services.document_processing.cropping import detect_aadhaar_card_crop_rect
from app.services.document_processing.exceptions import DocumentProcessingError
from app.services.document_processing.naming import get_aadhaar_filenames
from app.services.document_processing.passwords import derive_aadhaar_password
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
class AadhaarProcessResult:
    """Structured result returned by Aadhaar processing pipeline."""

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


def process_aadhaar_documents(
    normal_bytes: bytes | None,
    masked_bytes: bytes | None,
    full_name: str,
    dob: str,
    custom_rect: list[float] | None = None,
) -> AadhaarProcessResult:
    """Orchestrate Aadhaar document processing for Normal and/or Masked files.

    Args:
        normal_bytes: Raw bytes of normal Aadhaar PDF (if uploaded)
        masked_bytes: Raw bytes of masked Aadhaar PDF (if uploaded)
        full_name: Client's full name
        dob: Client's Date of Birth (DD/MM/YYYY or YYYY-MM-DD)
        custom_rect: Optional custom boundary override (if valid)

    Returns:
        AadhaarProcessResult containing generated files metadata and download links.
    """
    if not normal_bytes and not masked_bytes:
        raise DocumentProcessingError(
            "At least one Aadhaar PDF (Normal or Masked) must be provided for processing."
        )

    # Derive password (validates inputs; never stored, logged, or returned)
    password = derive_aadhaar_password(full_name, dob)

    # Get standardized client-based output filenames
    filenames = get_aadhaar_filenames(full_name)

    job_id, job_dir = create_job_directory("aadhaar")
    processed_items: list[ProcessedFileItem] = []
    files_to_zip: list[tuple[Path, str]] = []

    try:
        # Process Normal Aadhaar if present
        if normal_bytes:
            doc, _ = open_and_unlock_pdf(normal_bytes, password)

            # 1. Normal Unlocked full PDF
            unlocked_name = filenames["normal_unlocked"]
            unlocked_path = job_dir / unlocked_name
            export_unlocked_pdf(doc, unlocked_path)
            unlocked_size = unlocked_path.stat().st_size
            encoded_unlocked = urllib.parse.quote(unlocked_name)

            processed_items.append(
                ProcessedFileItem(
                    name=unlocked_name,
                    file_type="unlocked_pdf",
                    size_bytes=unlocked_size,
                    mime_type="application/pdf",
                    download_url=f"/api/v1/toolkit/download/{job_id}/{encoded_unlocked}",
                    preview_url=f"/api/v1/toolkit/preview/{job_id}/{encoded_unlocked}",
                )
            )
            files_to_zip.append((unlocked_path, unlocked_name))

            # 2. Normal Cropped PDF and 300 DPI JPEG
            crop_rect = detect_aadhaar_card_crop_rect(doc[0], custom_rect)
            cropped_pdf_name = filenames["normal_cropped"]
            cropped_img_name = filenames["normal_jpg"]
            cropped_pdf_path = job_dir / cropped_pdf_name
            cropped_img_path = job_dir / cropped_img_name

            pdf_size, img_size = export_cropped_pdf_and_image(
                doc, crop_rect, cropped_pdf_path, cropped_img_path, dpi=300
            )

            encoded_pdf = urllib.parse.quote(cropped_pdf_name)
            encoded_img = urllib.parse.quote(cropped_img_name)

            processed_items.append(
                ProcessedFileItem(
                    name=cropped_pdf_name,
                    file_type="cropped_pdf",
                    size_bytes=pdf_size,
                    mime_type="application/pdf",
                    download_url=f"/api/v1/toolkit/download/{job_id}/{encoded_pdf}",
                    preview_url=f"/api/v1/toolkit/preview/{job_id}/{encoded_pdf}",
                )
            )
            files_to_zip.append((cropped_pdf_path, cropped_pdf_name))

            processed_items.append(
                ProcessedFileItem(
                    name=cropped_img_name,
                    file_type="card_image",
                    size_bytes=img_size,
                    mime_type="image/jpeg",
                    download_url=f"/api/v1/toolkit/download/{job_id}/{encoded_img}",
                    preview_url=f"/api/v1/toolkit/preview/{job_id}/{encoded_img}",
                )
            )
            files_to_zip.append((cropped_img_path, cropped_img_name))
            doc.close()

        # Process Masked Aadhaar if present
        if masked_bytes:
            doc, _ = open_and_unlock_pdf(masked_bytes, password)

            # 1. Masked Unlocked full PDF
            unlocked_name = filenames["masked_unlocked"]
            unlocked_path = job_dir / unlocked_name
            export_unlocked_pdf(doc, unlocked_path)
            unlocked_size = unlocked_path.stat().st_size
            encoded_unlocked = urllib.parse.quote(unlocked_name)

            processed_items.append(
                ProcessedFileItem(
                    name=unlocked_name,
                    file_type="unlocked_pdf",
                    size_bytes=unlocked_size,
                    mime_type="application/pdf",
                    download_url=f"/api/v1/toolkit/download/{job_id}/{encoded_unlocked}",
                    preview_url=f"/api/v1/toolkit/preview/{job_id}/{encoded_unlocked}",
                )
            )
            files_to_zip.append((unlocked_path, unlocked_name))

            # 2. Masked Cropped PDF and 300 DPI JPEG
            crop_rect = detect_aadhaar_card_crop_rect(doc[0], custom_rect)
            cropped_pdf_name = filenames["masked_cropped"]
            cropped_img_name = filenames["masked_jpg"]
            cropped_pdf_path = job_dir / cropped_pdf_name
            cropped_img_path = job_dir / cropped_img_name

            pdf_size, img_size = export_cropped_pdf_and_image(
                doc, crop_rect, cropped_pdf_path, cropped_img_path, dpi=300
            )

            encoded_pdf = urllib.parse.quote(cropped_pdf_name)
            encoded_img = urllib.parse.quote(cropped_img_name)

            processed_items.append(
                ProcessedFileItem(
                    name=cropped_pdf_name,
                    file_type="cropped_pdf",
                    size_bytes=pdf_size,
                    mime_type="application/pdf",
                    download_url=f"/api/v1/toolkit/download/{job_id}/{encoded_pdf}",
                    preview_url=f"/api/v1/toolkit/preview/{job_id}/{encoded_pdf}",
                )
            )
            files_to_zip.append((cropped_pdf_path, cropped_pdf_name))

            processed_items.append(
                ProcessedFileItem(
                    name=cropped_img_name,
                    file_type="card_image",
                    size_bytes=img_size,
                    mime_type="image/jpeg",
                    download_url=f"/api/v1/toolkit/download/{job_id}/{encoded_img}",
                    preview_url=f"/api/v1/toolkit/preview/{job_id}/{encoded_img}",
                )
            )
            files_to_zip.append((cropped_img_path, cropped_img_name))
            doc.close()

        # Generate ZIP archive containing all processed outputs
        zip_download_url = None
        if files_to_zip:
            zip_filename = filenames["zip"]
            zip_path = job_dir / zip_filename
            create_zip_archive(files_to_zip, zip_path)
            encoded_zip = urllib.parse.quote(zip_filename)
            zip_download_url = f"/api/v1/toolkit/download/{job_id}/{encoded_zip}"

        return AadhaarProcessResult(
            job_id=job_id,
            status="SUCCESS",
            tool="aadhaar_processor",
            message=f"Successfully processed {len(files_to_zip)} Aadhaar documents and generated unlocked, cropped card outputs.",
            files=processed_items,
            zip_download_url=zip_download_url,
        )
    except Exception:
        # On failure, clean up the job directory to prevent leaving orphaned temporary files
        cleanup_job_directory(job_dir)
        raise
