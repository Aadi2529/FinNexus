"""Fixed automatic crop boundaries and page geometry validation for identity cards."""

from __future__ import annotations

import pymupdf


# =============================================================================
# Fixed Crop Configurations for Standard Identity Documents
# =============================================================================

# Aadhaar Card Crop Settings (Ratios of page dimensions)
AADHAAR_TOP_CROP = 0.72
AADHAAR_LEFT_CROP = 0.08
AADHAAR_BOTTOM_CROP = 0.07  # keep bottom section offset
AADHAAR_RIGHT_CROP = 0.08

# PAN Card Crop Settings (Ratios of page dimensions)
PAN_TOP_CROP = 0.77
PAN_LEFT_CROP = 0.11
PAN_RIGHT_CROP = 0.49
PAN_BOTTOM_CROP = 0.05

# Derived Crop Ratio Bounding Boxes [x0, y0, x1, y1]
AADHAAR_FIXED_CROP_RATIOS = {
    "x0": AADHAAR_LEFT_CROP,                # 0.08 (8% from left)
    "y0": AADHAAR_TOP_CROP,                 # 0.72 (72% from top)
    "x1": 1.0 - AADHAAR_RIGHT_CROP,         # 0.92 (92% width / 8% from right)
    "y1": 1.0 - AADHAAR_BOTTOM_CROP,        # 0.93 (93% height / 7% from bottom)
}

PAN_FIXED_CROP_RATIOS = {
    "x0": PAN_LEFT_CROP,                    # 0.11 (11% from left)
    "y0": PAN_TOP_CROP,                     # 0.77 (77% from top)
    "x1": 1.0 - PAN_RIGHT_CROP,             # 0.51 (51% width / 49% from right)
    "y1": 1.0 - PAN_BOTTOM_CROP,            # 0.95 (95% height / 5% from bottom)
}


def validate_crop_against_page(
    crop_rect: pymupdf.Rect, page_rect: pymupdf.Rect
) -> pymupdf.Rect:
    """Validate and clamp crop coordinates strictly within page boundaries.

    Ensures that coordinates do not fall outside page boundaries, width and height
    are strictly positive, and returns the bounded intersection rectangle.
    """
    x0 = max(page_rect.x0, min(crop_rect.x0, page_rect.x1))
    y0 = max(page_rect.y0, min(crop_rect.y0, page_rect.y1))
    x1 = max(x0 + 10.0, min(crop_rect.x1, page_rect.x1))
    y1 = max(y0 + 10.0, min(crop_rect.y1, page_rect.y1))
    return pymupdf.Rect(x0, y0, x1, y1).intersect(page_rect)


def get_fixed_aadhaar_crop_rect(page: pymupdf.Page) -> pymupdf.Rect:
    """Calculate and validate fixed automatic crop boundary for Aadhaar card on page 1.

    Applies the fixed AADHAAR_FIXED_CROP_RATIOS configuration against page
    dimensions and strictly clamps to page boundaries.
    """
    page_rect = page.rect
    w = page_rect.width
    h = page_rect.height

    raw_rect = pymupdf.Rect(
        w * AADHAAR_FIXED_CROP_RATIOS["x0"],
        h * AADHAAR_FIXED_CROP_RATIOS["y0"],
        w * AADHAAR_FIXED_CROP_RATIOS["x1"],
        h * AADHAAR_FIXED_CROP_RATIOS["y1"],
    )
    return validate_crop_against_page(raw_rect, page_rect)


def get_fixed_pan_crop_rect(page: pymupdf.Page) -> pymupdf.Rect:
    """Calculate and validate fixed automatic crop boundary for PAN card on page 1.

    Applies the fixed PAN_FIXED_CROP_RATIOS configuration against page
    dimensions and strictly clamps to page boundaries.
    """
    page_rect = page.rect
    w = page_rect.width
    h = page_rect.height

    raw_rect = pymupdf.Rect(
        w * PAN_FIXED_CROP_RATIOS["x0"],
        h * PAN_FIXED_CROP_RATIOS["y0"],
        w * PAN_FIXED_CROP_RATIOS["x1"],
        h * PAN_FIXED_CROP_RATIOS["y1"],
    )
    return validate_crop_against_page(raw_rect, page_rect)


def detect_aadhaar_card_crop_rect(
    page: pymupdf.Page, custom_rect: list[float] | None = None
) -> pymupdf.Rect:
    """Locate the Aadhaar card cutout boundary on page 1 using fixed automatic crop.

    Uses fixed automatic Aadhaar crop configuration with page boundary validation.
    If an explicit valid custom_rect is supplied, it is clamped to page boundaries.
    """
    if custom_rect and len(custom_rect) == 4:
        r = pymupdf.Rect(*custom_rect)
        if r.is_valid and r.width > 50 and r.height > 50:
            return validate_crop_against_page(r, page.rect)

    return get_fixed_aadhaar_crop_rect(page)


def detect_pan_card_crop_rect(
    page: pymupdf.Page, custom_rect: list[float] | None = None
) -> pymupdf.Rect:
    """Locate the PAN card cutout boundary on page 1 using fixed automatic crop.

    Uses fixed automatic PAN crop configuration with page boundary validation.
    If an explicit valid custom_rect is supplied, it is clamped to page boundaries.
    """
    if custom_rect and len(custom_rect) == 4:
        r = pymupdf.Rect(*custom_rect)
        if r.is_valid and r.width > 50 and r.height > 50:
            return validate_crop_against_page(r, page.rect)

    return get_fixed_pan_crop_rect(page)
