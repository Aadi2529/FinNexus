"""Document format, PDF signature, file size, and encryption validators."""

from __future__ import annotations

import pymupdf

from app.services.document_processing.exceptions import (
    DecryptionFailedError,
    DocumentProcessingError,
)
from app.services.document_processing.storage import MAX_FILE_SIZE


def validate_pdf_bytes(pdf_bytes: bytes, max_size: int = MAX_FILE_SIZE) -> None:
    """Validate raw bytes header, integrity, and size limits for a PDF file."""
    if not pdf_bytes or len(pdf_bytes) < 4:
        raise DocumentProcessingError("Uploaded file is empty or corrupted.")

    if len(pdf_bytes) > max_size:
        raise DocumentProcessingError(
            f"File size exceeds maximum permitted limit of {max_size // (1024 * 1024)}MB."
        )

    if not pdf_bytes.startswith(b"%PDF"):
        raise DocumentProcessingError(
            "Invalid file format: file does not have a valid PDF header signature."
        )


def open_and_unlock_pdf(
    pdf_bytes: bytes, password: str | None = None
) -> tuple[pymupdf.Document, bool]:
    """Validate PDF magic bytes, open document, and authenticate if encrypted.

    Returns:
        (unlocked_pymupdf_document, was_encrypted)
    """
    validate_pdf_bytes(pdf_bytes)

    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise DocumentProcessingError(f"Malformed or unreadable PDF: {exc}") from exc

    was_encrypted = False
    if doc.is_encrypted:
        was_encrypted = True
        if not password:
            doc.close()
            raise DecryptionFailedError(
                "The PDF is password protected. Required authentication parameters were not provided."
            )
        auth_success = doc.authenticate(password)
        if not auth_success:
            doc.close()
            raise DecryptionFailedError(
                "Decryption failed. The supplied client details do not match the document password convention."
            )

    return doc, was_encrypted
