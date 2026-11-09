"""PDF Generation Service for FinNexus Insurance Engine.

Utilizes PyMuPDF to generate compliant, binary PDF documents.
"""

from __future__ import annotations

import io
from datetime import UTC, datetime
from typing import Sequence

import pymupdf

from app.db.models.insurance import InsurancePurchaseParty


def generate_purchase_parties_pdf(parties: Sequence[InsurancePurchaseParty]) -> bytes:
    """Generate a formatted binary PDF document of purchase parties."""
    doc = pymupdf.open()
    page_width, page_height = pymupdf.paper_size("A4")  # 595.3 x 841.9 pt

    margin_x = 40.0
    margin_top = 50.0
    margin_bottom = 50.0
    usable_width = page_width - (2 * margin_x)

    def _create_page() -> tuple[pymupdf.Page, float]:
        page = doc.new_page(width=page_width, height=page_height)
        # Header banner
        page.draw_rect(
            pymupdf.Rect(margin_x, margin_top - 20, margin_x + usable_width, margin_top + 28),
            color=None,
            fill=(0.95, 0.96, 0.98),
        )
        page.insert_text(
            (margin_x + 10, margin_top - 4),
            "FINNEXUS ENTERPRISE ECOSYSTEM",
            fontsize=8,
            color=(0.3, 0.35, 0.45),
            fontname="helv",
        )
        page.insert_text(
            (margin_x + 10, margin_top + 16),
            "Purchase Party & Sourcing Partner Directory",
            fontsize=14,
            color=(0.1, 0.15, 0.25),
            fontname="helv",
        )
        timestamp_str = datetime.now(UTC).strftime("%d %b %Y, %H:%M UTC")
        page.insert_text(
            (margin_x + usable_width - 150, margin_top + 16),
            f"Generated: {timestamp_str}",
            fontsize=8,
            color=(0.4, 0.45, 0.55),
            fontname="helv",
        )

        # Table Header
        y_header = margin_top + 45
        page.draw_rect(
            pymupdf.Rect(margin_x, y_header - 12, margin_x + usable_width, y_header + 8),
            color=(0.8, 0.83, 0.88),
            fill=(0.2, 0.25, 0.35),
        )
        page.insert_text((margin_x + 5, y_header), "Code", fontsize=9, color=(1, 1, 1), fontname="helv")
        page.insert_text((margin_x + 75, y_header), "Party Name", fontsize=9, color=(1, 1, 1), fontname="helv")
        page.insert_text((margin_x + 230, y_header), "Contact Person", fontsize=9, color=(1, 1, 1), fontname="helv")
        page.insert_text((margin_x + 350, y_header), "Mobile / Phone", fontsize=9, color=(1, 1, 1), fontname="helv")
        page.insert_text((margin_x + 460, y_header), "Status", fontsize=9, color=(1, 1, 1), fontname="helv")

        return page, y_header + 16

    page, current_y = _create_page()
    row_height = 20.0

    for idx, party in enumerate(parties):
        if current_y + row_height > page_height - margin_bottom:
            # Footer on previous page
            page.insert_text(
                (margin_x, page_height - margin_bottom + 20),
                f"FinNexus Insurance Engine — Confidential Enterprise Export",
                fontsize=7,
                color=(0.5, 0.55, 0.65),
                fontname="helv",
            )
            page, current_y = _create_page()

        # Alternate row background
        if idx % 2 == 1:
            page.draw_rect(
                pymupdf.Rect(margin_x, current_y - 12, margin_x + usable_width, current_y + 8),
                color=None,
                fill=(0.97, 0.98, 0.99),
            )

        # Bottom row line
        page.draw_line(
            pymupdf.Point(margin_x, current_y + 8),
            pymupdf.Point(margin_x + usable_width, current_y + 8),
            color=(0.88, 0.90, 0.93),
            width=0.5,
        )

        code_str = str(party.code)[:12]
        name_str = str(party.name)[:30]
        contact_str = str(party.contact_person or "-")[:22]
        phone_str = str(party.phone or "-")[:18]
        status_str = "ACTIVE" if party.is_active else "INACTIVE"
        status_color = (0.05, 0.5, 0.25) if party.is_active else (0.6, 0.2, 0.2)

        page.insert_text((margin_x + 5, current_y), code_str, fontsize=8, color=(0.15, 0.2, 0.3), fontname="helv")
        page.insert_text((margin_x + 75, current_y), name_str, fontsize=8, color=(0.1, 0.15, 0.25), fontname="helv")
        page.insert_text((margin_x + 230, current_y), contact_str, fontsize=8, color=(0.25, 0.3, 0.4), fontname="helv")
        page.insert_text((margin_x + 350, current_y), phone_str, fontsize=8, color=(0.25, 0.3, 0.4), fontname="helv")
        page.insert_text((margin_x + 460, current_y), status_str, fontsize=8, color=status_color, fontname="helv")

        current_y += row_height

    # Footer on last page
    page.insert_text(
        (margin_x, page_height - margin_bottom + 20),
        f"FinNexus Insurance Engine — Total records: {len(parties)} — Official Enterprise Sourcing Export",
        fontsize=7,
        color=(0.5, 0.55, 0.65),
        fontname="helv",
    )

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

