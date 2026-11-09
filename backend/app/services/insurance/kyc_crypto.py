"""KYC Security, Application-Level Encryption, and Data Masking Utilities.

Implements:
- AES-128-CBC + HMAC-SHA256 authenticated encryption at rest (Fernet)
- Environment-managed encryption key with deterministic fallback
- Masking for Aadhaar (XXXX-XXXX-1234) and PAN (XXXXX1234X)
- Blind indexing via SHA-256 for fast duplicate detection without plaintext exposure
- Validation for PAN, Aadhaar, and GSTIN formats
- Protection against overwriting sensitive values with masked placeholders
"""

from __future__ import annotations

import base64
import hashlib
import os
import re
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

_fernet_instance: Fernet | None = None


def get_fernet() -> Fernet:
    """Retrieve or initialize the application-level Fernet cipher engine."""
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    key_str = os.getenv("KYC_ENCRYPTION_KEY")
    if not key_str:
        # Derive secure key from JWT access secret
        secret = os.getenv(
            "JWT_ACCESS_SECRET",
            "financeflow_super_secret_jwt_access_token_32chars"
        )
        derived = hashlib.sha256(secret.encode("utf-8")).digest()
        key_str = base64.urlsafe_b64encode(derived).decode("utf-8")

    _fernet_instance = Fernet(key_str.encode("utf-8"))
    return _fernet_instance


def encrypt_kyc_value(plaintext: str | None) -> str | None:
    """Encrypt sensitive KYC string (Aadhaar, PAN) at rest using Fernet."""
    if not plaintext or not plaintext.strip():
        return None
    val = plaintext.strip()
    f = get_fernet()
    encrypted_bytes = f.encrypt(val.encode("utf-8"))
    return encrypted_bytes.decode("utf-8")


def decrypt_kyc_value(ciphertext: str | None) -> str | None:
    """Decrypt sensitive KYC ciphertext stored at rest."""
    if not ciphertext or not ciphertext.strip():
        return None
    val = ciphertext.strip()
    try:
        f = get_fernet()
        decrypted_bytes = f.decrypt(val.encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except (InvalidToken, Exception):
        # Fallback if already plaintext
        return val


def hash_kyc_value(val: str | None) -> str | None:
    """Compute SHA-256 blind-index digest for exact-match duplicate queries."""
    if not val or not val.strip():
        return None
    cleaned = "".join(c for c in val.strip() if c.isalnum()).upper()
    if not cleaned:
        return None
    return hashlib.sha256(cleaned.encode("utf-8")).hexdigest()


def mask_aadhaar(val: str | None) -> str | None:
    """Format Aadhaar as XXXX-XXXX-1234."""
    if not val or not val.strip():
        return None
    s = val.strip()
    if "XXXX" in s.upper():
        return s
    digits = "".join(c for c in s if c.isdigit())
    if len(digits) >= 4:
        return f"XXXX-XXXX-{digits[-4:]}"
    return "XXXX-XXXX-XXXX"


def mask_pan(val: str | None) -> str | None:
    """Format PAN as XXXXX1234X."""
    if not val or not val.strip():
        return None
    s = val.strip().upper()
    if "XXXX" in s:
        return s
    clean = "".join(c for c in s if c.isalnum())
    if len(clean) == 10:
        return f"XXXXX{clean[5:9]}{clean[9]}"
    if len(clean) >= 4:
        return f"XXXXX{clean[-4:]}"
    return "XXXXX1234X"


def is_masked_value(val: str | None) -> bool:
    """Check whether a string value is a masked placeholder (e.g. XXXX-XXXX-1234)."""
    if not val:
        return False
    val_upper = val.strip().upper()
    return "XXXX" in val_upper


def validate_pan(val: str | None) -> tuple[bool, str]:
    """Validate 10-character Indian Permanent Account Number (PAN)."""
    if not val:
        return True, ""
    clean = val.strip().upper()
    pattern = r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
    if not re.match(pattern, clean):
        return False, "PAN must follow standard format (e.g. ABCDE1234F - 5 letters, 4 digits, 1 letter)."
    return True, ""


def validate_aadhaar(val: str | None) -> tuple[bool, str]:
    """Validate 12-digit Indian Aadhaar number."""
    if not val:
        return True, ""
    digits = "".join(c for c in val.strip() if c.isdigit())
    if len(digits) != 12:
        return False, "Aadhaar number must contain exactly 12 numeric digits."
    return True, ""


def validate_gstin(val: str | None) -> tuple[bool, str]:
    """Validate 15-character Indian Goods and Services Tax Identification Number (GSTIN)."""
    if not val:
        return True, ""
    clean = val.strip().upper()
    pattern = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
    if not re.match(pattern, clean):
        return False, "GSTIN must follow standard 15-character format (e.g. 27ABCDE1234F1Z5)."
    return True, ""
