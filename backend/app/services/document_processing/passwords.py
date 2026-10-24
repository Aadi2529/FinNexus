"""Statutory identity document password derivation conventions.

Note:
- Passwords are strictly ephemeral in-memory strings.
- Passwords must NEVER be logged, persisted to disk, or returned in API responses.
"""

from __future__ import annotations

import re

from app.services.document_processing.exceptions import DocumentProcessingError


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
