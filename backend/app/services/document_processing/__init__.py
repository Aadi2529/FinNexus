"""FinNexus Document Processing Suite.

Modular architecture for identity document processing, conversion, and archival.
"""

from __future__ import annotations

from app.services.document_processing.aadhaar_service import (
    AadhaarProcessResult,
    process_aadhaar_documents,
)
from app.services.document_processing.archive import create_zip_archive
from app.services.document_processing.cropping import (
    AADHAAR_BOTTOM_CROP,
    AADHAAR_FIXED_CROP_RATIOS,
    AADHAAR_LEFT_CROP,
    AADHAAR_RIGHT_CROP,
    AADHAAR_TOP_CROP,
    PAN_BOTTOM_CROP,
    PAN_FIXED_CROP_RATIOS,
    PAN_LEFT_CROP,
    PAN_RIGHT_CROP,
    PAN_TOP_CROP,
    detect_aadhaar_card_crop_rect,
    detect_pan_card_crop_rect,
    get_fixed_aadhaar_crop_rect,
    get_fixed_pan_crop_rect,
    validate_crop_against_page,
)
from app.services.document_processing.exceptions import (
    DecryptionFailedError,
    DocumentProcessingError,
)
from app.services.document_processing.naming import (
    get_aadhaar_filenames,
    get_pan_filenames,
    is_safe_filename,
    normalize_client_name,
    sanitize_filename,
)
from app.services.document_processing.pan_service import (
    PANProcessResult,
    process_pan_document,
)
from app.services.document_processing.passwords import (
    derive_aadhaar_password,
    derive_pan_password,
)
from app.services.document_processing.pdf_export import (
    convert_images_to_pdf,
    export_cropped_pdf_and_image,
    export_unlocked_pdf,
    merge_pdf_documents,
)
from app.services.document_processing.storage import (
    MAX_FILE_SIZE,
    MAX_IMAGES_COUNT,
    MAX_TOTAL_MERGE_SIZE,
    TOOLKIT_TEMP_DIR,
    cleanup_expired_jobs,
    cleanup_job_directory,
    create_job_directory,
)
from app.services.document_processing.validators import (
    open_and_unlock_pdf,
    validate_pdf_bytes,
)

__all__ = [
    # Exceptions
    "DocumentProcessingError",
    "DecryptionFailedError",
    # Storage & Limits
    "TOOLKIT_TEMP_DIR",
    "MAX_FILE_SIZE",
    "MAX_TOTAL_MERGE_SIZE",
    "MAX_IMAGES_COUNT",
    "create_job_directory",
    "cleanup_job_directory",
    "cleanup_expired_jobs",
    # Naming
    "sanitize_filename",
    "normalize_client_name",
    "is_safe_filename",
    "get_aadhaar_filenames",
    "get_pan_filenames",
    # Passwords
    "derive_aadhaar_password",
    "derive_pan_password",
    # Cropping
    "AADHAAR_TOP_CROP",
    "AADHAAR_LEFT_CROP",
    "AADHAAR_BOTTOM_CROP",
    "AADHAAR_RIGHT_CROP",
    "PAN_TOP_CROP",
    "PAN_LEFT_CROP",
    "PAN_RIGHT_CROP",
    "PAN_BOTTOM_CROP",
    "AADHAAR_FIXED_CROP_RATIOS",
    "PAN_FIXED_CROP_RATIOS",
    "validate_crop_against_page",
    "get_fixed_aadhaar_crop_rect",
    "get_fixed_pan_crop_rect",
    "detect_aadhaar_card_crop_rect",
    "detect_pan_card_crop_rect",
    # Validators
    "validate_pdf_bytes",
    "open_and_unlock_pdf",
    # PDF Export & Conversion
    "export_unlocked_pdf",
    "export_cropped_pdf_and_image",
    "merge_pdf_documents",
    "convert_images_to_pdf",
    # Archival
    "create_zip_archive",
    # Services
    "AadhaarProcessResult",
    "process_aadhaar_documents",
    "PANProcessResult",
    "process_pan_document",
]
