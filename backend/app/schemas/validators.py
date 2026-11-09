"""Strict Field Validation Utilities for FinNexus Insurance Engine Pydantic Schemas.

Enforces:
- Indian Mobile: Exactly 10 digits, numeric only, starts with 6-9
- Email: RFC-compliant address format with valid domain
- PIN code: Exactly 6 digits
- Aadhaar: Exactly 12 digits
- PAN: 5 uppercase letters, 4 digits, 1 letter
- GSTIN: 15-character Indian GST identification
- Vehicle Reg: Indian motor vehicle registration
- Financial amounts: Positive decimal amounts
- Rates & percentages: 0.00 to 100.00%
- Date relationships: Renewal >= Tieup, Expiry >= Start, DOB not future
"""

from __future__ import annotations

import re
from datetime import date
from decimal import Decimal
from typing import Any


def validate_indian_mobile(
    v: Any,
    required: bool = False,
    field_name: str = "Mobile number",
    sanitize: bool = False,
) -> str | None:
    """Validate Indian 10-digit mobile number starting with 6, 7, 8, or 9.
    
    If `sanitize=True`, safely normalizes valid Indian country code prefixes (+91, 91, 0)
    and hyphens/spaces when the resulting string is a valid 10-digit mobile number.
    """
    if v is None:
        if required:
            raise ValueError(f"{field_name} is required.")
        return None

    raw = str(v).strip()
    if not raw:
        if required:
            raise ValueError(f"{field_name} is required.")
        return None

    if sanitize:
        cleaned = raw
        if cleaned.startswith("+91"):
            cleaned = cleaned[3:].lstrip("- ")
        elif cleaned.startswith("91") and len(cleaned) > 10:
            cleaned = cleaned[2:].lstrip("- ")
        elif cleaned.startswith("0") and len(cleaned) == 11:
            cleaned = cleaned[1:]
        cleaned = re.sub(r"[\s\-]", "", cleaned)
        if len(cleaned) == 10 and cleaned.isdigit() and cleaned[0] in ("6", "7", "8", "9"):
            raw = cleaned

    # Reject alphabets, spaces, and special characters
    if not raw.isdigit():
        raise ValueError(
            f"{field_name} must contain only numeric digits (no letters, spaces, or symbols)."
        )

    if len(raw) != 10:
        raise ValueError(f"{field_name} must be exactly 10 digits (received {len(raw)}).")

    if raw[0] not in ("6", "7", "8", "9"):
        raise ValueError(
            f"{field_name} must begin with 6, 7, 8, or 9 (starts with '{raw[0]}')."
        )

    return raw


def validate_email_format(
    v: Any,
    required: bool = False,
    field_name: str = "Email address",
) -> str | None:
    """Validate standard email address format."""
    if v is None:
        if required:
            raise ValueError(f"{field_name} is required.")
        return None

    raw = str(v).strip()
    if not raw:
        if required:
            raise ValueError(f"{field_name} is required.")
        return None

    email_regex = re.compile(
        r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
    )
    if not email_regex.match(raw) or ".." in raw or raw.endswith("."):
        raise ValueError(
            f"{field_name} must follow a valid email address format (e.g. user@domain.com)."
        )

    return raw.lower()


def validate_pincode(
    v: Any,
    required: bool = False,
    field_name: str = "PIN code",
) -> str | None:
    """Validate 6-digit Indian postal code."""
    if v is None:
        if required:
            raise ValueError(f"{field_name} is required.")
        return None

    raw = str(v).strip()
    if not raw:
        if required:
            raise ValueError(f"{field_name} is required.")
        return None

    if not re.match(r"^[1-9]\d{5}$", raw):
        raise ValueError(f"{field_name} must be a valid 6-digit Indian postal PIN code.")

    return raw


def validate_pan(
    v: Any,
    required: bool = False,
    field_name: str = "PAN",
) -> str | None:
    """Validate Indian Permanent Account Number (PAN)."""
    if v is None:
        if required:
            raise ValueError(f"{field_name} is required.")
        return None

    raw = str(v).strip().upper()
    if not raw:
        if required:
            raise ValueError(f"{field_name} is required.")
        return None

    if not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", raw):
        raise ValueError(
            f"{field_name} must be in standard 10-character Indian PAN format (e.g. ABCDE1234F)."
        )

    return raw


def validate_aadhaar(
    v: Any,
    required: bool = False,
    field_name: str = "Aadhaar number",
) -> str | None:
    """Validate Indian 12-digit Aadhaar number."""
    if v is None:
        if required:
            raise ValueError(f"{field_name} is required.")
        return None

    raw = str(v).strip()
    if not raw:
        if required:
            raise ValueError(f"{field_name} is required.")
        return None

    if not re.match(r"^\d{12}$", raw):
        raise ValueError(f"{field_name} must be exactly 12 numeric digits.")

    return raw


def validate_gstin(
    v: Any,
    required: bool = False,
    field_name: str = "GSTIN",
) -> str | None:
    """Validate Indian 15-character GSTIN."""
    if v is None:
        if required:
            raise ValueError(f"{field_name} is required.")
        return None

    raw = str(v).strip().upper()
    if not raw:
        if required:
            raise ValueError(f"{field_name} is required.")
        return None

    if not re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", raw):
        raise ValueError(
            f"{field_name} must be in valid 15-character GSTIN format (e.g. 27ABCDE1234F1Z5)."
        )

    return raw


def validate_vehicle_reg(
    v: Any,
    required: bool = False,
    field_name: str = "Vehicle registration number",
) -> str | None:
    """Validate Indian motor vehicle registration number."""
    if v is None:
        if required:
            raise ValueError(f"{field_name} is required.")
        return None

    raw = str(v).strip().upper().replace(" ", "").replace("-", "")
    if not raw:
        if required:
            raise ValueError(f"{field_name} is required.")
        return None

    standard_re = re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$")
    bh_re = re.compile(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$")

    if not standard_re.match(raw) and not bh_re.match(raw):
        raise ValueError(
            f"{field_name} must follow Indian vehicle registration format (e.g. MH12AB1234 or 22BH1234AB)."
        )

    return raw


def validate_positive_amount(
    v: Any,
    allow_zero: bool = False,
    field_name: str = "Amount",
) -> Decimal | None:
    """Validate positive decimal currency amount."""
    if v is None:
        return None

    try:
        d = Decimal(str(v))
    except Exception:
        raise ValueError(f"{field_name} must be a valid numeric amount.")

    if d < 0:
        raise ValueError(f"{field_name} cannot be negative.")

    if not allow_zero and d == 0:
        raise ValueError(f"{field_name} must be greater than zero.")

    return d


def validate_percentage_rate(
    v: Any,
    field_name: str = "Rate",
) -> Decimal | None:
    """Validate percentage (0.00 to 100.00%)."""
    if v is None:
        return None

    try:
        d = Decimal(str(v))
    except Exception:
        raise ValueError(f"{field_name} must be a valid numeric percentage.")

    if d < 0 or d > 100:
        raise ValueError(f"{field_name} must be between 0.00% and 100.00%.")

    return d


def validate_dob_not_future(
    v: Any,
    field_name: str = "Date of Birth",
) -> Any:
    """Ensure Date of Birth cannot be in the future."""
    if v is None:
        return None

    parsed_date = v
    if isinstance(v, str):
        try:
            parsed_date = date.fromisoformat(v)
        except Exception:
            raise ValueError(f"{field_name} must be a valid ISO date (YYYY-MM-DD).")

    if parsed_date > date.today():
        raise ValueError(f"{field_name} cannot be in the future.")

    return v


def validate_date_sequence(
    start: Any,
    end: Any,
    start_label: str = "Start Date",
    end_label: str = "End Date",
) -> bool:
    """Ensure end date is on or after start date."""
    if not start or not end:
        return True

    s_date = start
    e_date = end
    if isinstance(start, str):
        try:
            s_date = date.fromisoformat(start)
        except Exception:
            raise ValueError(f"{start_label} must be a valid ISO date.")
    if isinstance(end, str):
        try:
            e_date = date.fromisoformat(end)
        except Exception:
            raise ValueError(f"{end_label} must be a valid ISO date.")

    if e_date < s_date:
        s_str = s_date.strftime("%d-%m-%Y") if hasattr(s_date, "strftime") else str(s_date)
        e_str = e_date.strftime("%d-%m-%Y") if hasattr(e_date, "strftime") else str(e_date)
        raise ValueError(
            f"{end_label} ({e_str}) cannot precede {start_label} ({s_str})."
        )
    return True


# Convenience aliases
validate_email = validate_email_format
validate_pin_code = validate_pincode
validate_vehicle_registration = validate_vehicle_reg
validate_percentage = validate_percentage_rate
