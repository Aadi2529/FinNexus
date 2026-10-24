"""PDF generation, unlocked export, cropping, rasterization, and multi-file conversions."""

from __future__ import annotations

import io
from pathlib import Path
from PIL import Image
import pymupdf

from app.services.document_processing.exceptions import DocumentProcessingError


def export_unlocked_pdf(doc: pymupdf.Document, output_path: Path) -> int:
    """Save an unlocked, clean copy of the document without encryption."""
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
