"""FinNexus Document Processing Service.

Production-grade utilities for:
- Identity document authorized decryption & cropping (Aadhaar, PAN).
- High-fidelity rasterization (300 DPI JPEG).
- Multi-file PDF merging with preserved sequence.
- Images to PDF conversion (A4/fit/letter with margins and aspect-ratio preservation).
- Temporary file management and zero data-leak security.
"""

from __future__ import annotations

import io
import os
import re
import shutil
import time
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any

from PIL import Image
import pymupdf


TOOLKIT_TEMP_DIR = Path("storage/toolkit_temp")
MAX_FILE_SIZE = 35 * 1024 * 1024  # 35 MB per file
MAX_TOTAL_MERGE_SIZE = 120 * 1024 * 1024  # 120 MB aggregate merge
MAX_IMAGES_COUNT = 50


class DocumentProcessingError(Exception):
    """Base error for document processing failures."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class DecryptionFailedError(DocumentProcessingError):
    """Raised when authorized PDF password fails to unlock the document."""

    def __init__(
        self,
        message: str = "Document is encrypted and password verification failed. Please verify that client details match the issuing authority records.",
    ):
        super().__init__(message, status_code=400)


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal and illegal characters."""
    base = Path(filename).name
    # Keep only safe alphanumeric, dash, underscore, and dot
    clean = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    if not clean or clean.startswith("."):
        clean = f"document_{uuid.uuid4().hex[:8]}" + Path(filename).suffix
    return clean


def derive_aadhaar_password(full_name: str, dob_str: str) -> str:
    """Derive UIDAI standard password convention.

    Rule: First 4 alphabetic letters of the client name in uppercase,
    followed by the 4-digit birth year YYYY (e.g. 'Aditya Subhash Thakare', '26/05/2004' -> 'ADIT2004').
    """
    if not full_name or not full_name.strip():
        raise DocumentProcessingError(
            "Client full name is required to process Aadhaar document."
        )

    clean_name = re.sub(r"[^A-Za-z]", "", full_name.strip())
    if len(clean_name) < 4:
        raise DocumentProcessingError(
            "Client full name must contain at least 4 alphabetic characters to derive the standard UIDAI document password."
        )
    prefix = clean_name[:4].upper()

    if not dob_str or not dob_str.strip():
        raise DocumentProcessingError(
            "Client date of birth is required to process Aadhaar document."
        )

    # Find 4-digit year in DOB string
    year_match = re.search(r"\b(19\d{2}|20\d{2})\b", dob_str.strip())
    if not year_match:
        raise DocumentProcessingError(
            "Invalid Date of Birth format. Please provide a valid 4-digit birth year (e.g., DD/MM/YYYY or YYYY-MM-DD)."
        )
    year = year_match.group(1)

    return f"{prefix}{year}"


def derive_pan_password(dob_str: str) -> str:
    """Derive NSDL/UTIITSL standard PAN card password convention.

    Rule: Date of Birth in DDMMYYYY format with leading zeros (e.g. '29/05/2004' -> '29052004').
    """
    if not dob_str or not dob_str.strip():
        raise DocumentProcessingError(
            "Date of birth is required to process PAN card document."
        )

    dob_clean = dob_str.strip()
    # Try DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    m = re.match(r"^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$", dob_clean)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
    else:
        # Try YYYY-MM-DD
        m2 = re.match(r"^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$", dob_clean)
        if m2:
            year, month, day = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))
        else:
            raise DocumentProcessingError(
                "Invalid Date of Birth format. Expected DD/MM/YYYY (e.g. 29/05/2004)."
            )

    if not (1 <= day <= 31 and 1 <= month <= 12 and 1900 <= year <= 2100):
        raise DocumentProcessingError(
            "Invalid Date of Birth values. Please verify day, month, and year."
        )

    return f"{day:02d}{month:02d}{year:04d}"


def open_and_unlock_pdf(
    pdf_bytes: bytes, password: str | None = None
) -> tuple[pymupdf.Document, bool]:
    """Validate PDF magic bytes, open document, and authenticate if encrypted.

    Returns:
        (unlocked_pymupdf_document, was_encrypted)
    """
    if not pdf_bytes or len(pdf_bytes) < 4:
        raise DocumentProcessingError("Uploaded file is empty or corrupted.")

    if not pdf_bytes.startswith(b"%PDF"):
        raise DocumentProcessingError(
            "Invalid file format: file does not have a valid PDF header signature."
        )

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


def detect_aadhaar_card_crop_rect(
    page: pymupdf.Page, custom_rect: list[float] | None = None
) -> pymupdf.Rect:
    """Locate the Aadhaar card cutout boundary on page 1.

    If custom_rect is provided [x0, y0, x1, y1], validate and use it.
    Otherwise, search for UIDAI keywords or fall back to standard bottom-section card geometry.
    """
    page_rect = page.rect
    w = page_rect.width
    h = page_rect.height

    if custom_rect and len(custom_rect) == 4:
        r = pymupdf.Rect(*custom_rect)
        if r.is_valid and r.width > 50 and r.height > 50:
            return r.intersect(page_rect)

    # Search for UIDAI text markers on the page
    # Standard Aadhaar cut-out is at the bottom 42% of the page
    # UIDAI letter has text like "Unique Identification Authority", "Mera Aadhaar", "VID", "Aadhaar No", "Enrollment No"
    rects = []
    keywords = [
        "Unique Identification Authority",
        "Mera Aadhaar",
        "Enrollment No",
        "VID :",
        "1947",
        "help@uidai.gov.in",
        "www.uidai.gov.in",
        "Government of India",
        "DOB:",
        "Date of Birth",
    ]
    for kw in keywords:
        hits = page.search_for(kw)
        for hit in hits:
            # We are interested in hits in the lower portion of the page
            if hit.y0 > h * 0.40:
                rects.append(hit)

    if rects:
        # Enclose the hits and apply generous card padding
        bbox = rects[0]
        for hit in rects[1:]:
            bbox = bbox | hit
        # Extend to standard card width and height around the detected region
        x0 = max(20.0, min(bbox.x0 - 20.0, w * 0.05))
        x1 = min(w - 20.0, max(bbox.x1 + 20.0, w * 0.95))
        y0 = max(h * 0.45, bbox.y0 - 40.0)
        y1 = min(h - 20.0, bbox.y1 + 40.0)
        return pymupdf.Rect(x0, y0, x1, y1)

    # Fallback calibrated UIDAI bottom card cut-box
    return pymupdf.Rect(w * 0.05, h * 0.54, w * 0.95, h * 0.96)


def detect_pan_card_crop_rect(
    page: pymupdf.Page, custom_rect: list[float] | None = None
) -> pymupdf.Rect:
    """Locate the PAN card cutout boundary on page 1.

    If custom_rect is provided [x0, y0, x1, y1], validate and use it.
    Otherwise, search for Income Tax Department markers or use calibrated geometry.
    """
    page_rect = page.rect
    w = page_rect.width
    h = page_rect.height

    if custom_rect and len(custom_rect) == 4:
        r = pymupdf.Rect(*custom_rect)
        if r.is_valid and r.width > 50 and r.height > 50:
            return r.intersect(page_rect)

    keywords = [
        "INCOME TAX DEPARTMENT",
        "GOVT. OF INDIA",
        "Permanent Account Number Card",
        "Father's Name",
        "Date of Birth",
        "Signature",
    ]
    rects = []
    for kw in keywords:
        hits = page.search_for(kw)
        for hit in hits:
            if hit.y0 > h * 0.40:
                rects.append(hit)

    if rects:
        bbox = rects[0]
        for hit in rects[1:]:
            bbox = bbox | hit
        x0 = max(20.0, min(bbox.x0 - 30.0, w * 0.06))
        x1 = min(w - 20.0, max(bbox.x1 + 30.0, w * 0.94))
        y0 = max(h * 0.45, bbox.y0 - 35.0)
        y1 = min(h - 20.0, bbox.y1 + 35.0)
        return pymupdf.Rect(x0, y0, x1, y1)

    # Fallback calibrated PAN card position
    return pymupdf.Rect(w * 0.06, h * 0.54, w * 0.94, h * 0.94)


def create_job_directory(prefix: str = "job") -> tuple[str, Path]:
    """Create an isolated, unpredictable temporary directory for document processing."""
    job_id = f"{prefix}_{uuid.uuid4().hex}"
    job_dir = TOOLKIT_TEMP_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_id, job_dir


def cleanup_job_directory(job_dir: Path | str) -> None:
    """Safely remove a job temporary directory."""
    path = Path(job_dir)
    if path.exists() and path.is_dir():
        try:
            shutil.rmtree(path)
        except Exception:
            pass


def cleanup_expired_jobs(max_age_seconds: int = 3600) -> None:
    """Housekeeping job: delete temporary job folders older than max_age_seconds."""
    if not TOOLKIT_TEMP_DIR.exists():
        return
    now = time.time()
    for child in TOOLKIT_TEMP_DIR.iterdir():
        if child.is_dir():
            try:
                mtime = child.stat().st_mtime
                if now - mtime > max_age_seconds:
                    shutil.rmtree(child, ignore_errors=True)
            except Exception:
                pass


def export_unlocked_pdf(doc: pymupdf.Document, output_path: Path) -> int:
    """Save an unlocked, clean copy of the document."""
    clean_doc = pymupdf.open()
    clean_doc.insert_pdf(doc)
    clean_doc.save(output_path, encryption=pymupdf.PDF_ENCRYPT_NONE)
    size = output_path.stat().st_size
    clean_doc.close()
    return size


def export_cropped_pdf_and_image(
    doc: pymupdf.Document,
    crop_rect: pymupdf.Rect,
    pdf_path: Path,
    img_path: Path,
    dpi: int = 300,
) -> tuple[int, int]:
    """Export cropped single-card PDF and high-resolution JPEG."""
    # 1. Cropped PDF
    crop_doc = pymupdf.open()
    crop_doc.insert_pdf(doc, from_page=0, to_page=0)
    page = crop_doc[0]
    page.set_cropbox(crop_rect)
    crop_doc.save(pdf_path, encryption=pymupdf.PDF_ENCRYPT_NONE)
    pdf_size = pdf_path.stat().st_size
    crop_doc.close()

    # 2. 300 DPI high-quality JPEG
    orig_page = doc[0]
    pix = orig_page.get_pixmap(dpi=dpi, clip=crop_rect)
    pix.save(img_path)
    img_size = img_path.stat().st_size

    return pdf_size, img_size


def create_zip_archive(files_to_zip: list[tuple[Path, str]], zip_path: Path) -> int:
    """Package output files into a ZIP archive with safe relative filenames."""
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path, arcname in files_to_zip:
            if file_path.exists():
                zf.write(file_path, arcname=arcname)
    return zip_path.stat().st_size


def merge_pdf_documents(
    pdf_streams: list[tuple[str, bytes]], output_path: Path
) -> tuple[int, int]:
    """Merge multiple valid PDF streams into one consolidated PDF in exact order.

    Returns:
        (total_pages, file_size_bytes)
    """
    if len(pdf_streams) < 2:
        raise DocumentProcessingError(
            "At least two PDF documents are required to perform a merge."
        )

    merged_doc = pymupdf.open()

    for filename, data in pdf_streams:
        if not data.startswith(b"%PDF"):
            merged_doc.close()
            raise DocumentProcessingError(
                f"File '{filename}' is not a valid PDF or has corrupted headers."
            )
        try:
            sub_doc = pymupdf.open(stream=data, filetype="pdf")
        except Exception as exc:
            merged_doc.close()
            raise DocumentProcessingError(
                f"Unable to read PDF '{filename}': {exc}"
            ) from exc

        if sub_doc.is_encrypted:
            sub_doc.close()
            merged_doc.close()
            raise DocumentProcessingError(
                f"File '{filename}' is password-protected. Please unlock protected documents before merging."
            )

        merged_doc.insert_pdf(sub_doc)
        sub_doc.close()

    total_pages = len(merged_doc)
    merged_doc.save(output_path, encryption=pymupdf.PDF_ENCRYPT_NONE)
    merged_doc.close()

    file_size = output_path.stat().st_size
    return total_pages, file_size


def convert_images_to_pdf(
    image_streams: list[tuple[str, bytes]],
    output_path: Path,
    page_size: str = "a4",
    orientation: str = "auto",
    margin: str = "small",
) -> tuple[int, int]:
    """Convert multiple image byte streams into a consolidated PDF.

    Supported page sizes: 'a4', 'fit', 'letter'
    Supported orientations: 'auto', 'portrait', 'landscape'
    Supported margins: 'none' (0 pt), 'small' (20 pt), 'normal' (36 pt)

    Returns:
        (page_count, file_size_bytes)
    """
    if not image_streams:
        raise DocumentProcessingError("At least one image is required.")

    margin_map = {"none": 0.0, "small": 20.0, "normal": 36.0}
    margin_pts = margin_map.get(margin.lower(), 20.0)

    # Standard dimensions in points (72 points = 1 inch)
    size_dimensions = {
        "a4": (595.3, 841.9),
        "letter": (612.0, 792.0),
    }

    pdf_doc = pymupdf.open()

    for idx, (filename, img_bytes) in enumerate(image_streams):
        # Validate format using Pillow
        try:
            pil_img = Image.open(io.BytesIO(img_bytes))
            img_format = pil_img.format
            img_width, img_height = pil_img.size
            if img_format not in ["JPEG", "PNG", "WEBP", "MPO"]:
                raise ValueError(f"Unsupported image format: {img_format}")
        except Exception as exc:
            pdf_doc.close()
            raise DocumentProcessingError(
                f"File '{filename}' is not a supported image (JPEG, PNG, WebP): {exc}"
            ) from exc

        # Determine target page width and height
        if page_size.lower() == "fit":
            page_w = float(img_width)
            page_h = float(img_height)
            margin_actual = 0.0
        else:
            base_w, base_h = size_dimensions.get(page_size.lower(), (595.3, 841.9))
            margin_actual = margin_pts

            # Determine orientation
            if orientation.lower() == "portrait":
                page_w, page_h = min(base_w, base_h), max(base_w, base_h)
            elif orientation.lower() == "landscape":
                page_w, page_h = max(base_w, base_h), min(base_w, base_h)
            else:  # auto
                if img_width > img_height:
                    page_w, page_h = max(base_w, base_h), min(base_w, base_h)
                else:
                    page_w, page_h = min(base_w, base_h), max(base_w, base_h)

        page = pdf_doc.new_page(width=page_w, height=page_h)

        # Usable canvas rect
        avail_w = max(10.0, page_w - (2 * margin_actual))
        avail_h = max(10.0, page_h - (2 * margin_actual))

        # Compute aspect ratio fit
        scale = min(avail_w / img_width, avail_h / img_height)
        dest_w = img_width * scale
        dest_h = img_height * scale

        # Center inside usable rect
        dest_x = margin_actual + (avail_w - dest_w) / 2.0
        dest_y = margin_actual + (avail_h - dest_h) / 2.0

        target_rect = pymupdf.Rect(dest_x, dest_y, dest_x + dest_w, dest_y + dest_h)

        # Insert image stream directly into page
        page.insert_image(target_rect, stream=img_bytes)

    page_count = len(pdf_doc)
    pdf_doc.save(output_path, encryption=pymupdf.PDF_ENCRYPT_NONE)
    pdf_doc.close()

    file_size = output_path.stat().st_size
    return page_count, file_size
