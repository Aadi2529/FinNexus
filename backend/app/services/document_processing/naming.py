"""Filename normalization, sanitization, and client-based naming conventions."""

from __future__ import annotations

import re
import uuid
from pathlib import Path


WINDOWS_RESERVED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
}


def sanitize_filename(filename: str) -> str:
    """Sanitize generic filename to prevent directory traversal and illegal characters."""
    base = Path(filename).name
    # Keep only safe alphanumeric, dash, underscore, and dot
    clean = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    if not clean or clean.startswith("."):
        clean = f"document_{uuid.uuid4().hex[:8]}" + Path(filename).suffix
    return clean


def normalize_client_name(name: str | None) -> str:
    """Normalize client name for safe, human-readable file naming.

    - Trims leading/trailing whitespace.
    - Strips path traversal sequences ('..' or separators).
    - Replaces unsafe characters with single spaces.
    - Collapses consecutive whitespace.
    - Converts to UPPERCASE.
    - Avoids Windows reserved filenames.
    - Defaults to 'CLIENT' if empty or invalid.
    """
    if not name or not isinstance(name, str):
        return "CLIENT"

    # Remove path traversal sequences and separators
    cleaned = name.replace("..", " ").replace("/", " ").replace("\\", " ")
    # Replace any character that is not alphanumeric, hyphen, underscore, or dot
    cleaned = re.sub(r"[^A-Za-z0-9_\-.]+", " ", cleaned)
    # Collapse multiple whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # Upper case for standard identity file naming
    normalized = cleaned.upper()

    # Guard against Windows reserved device names
    base_check = normalized.split(".")[0]
    if base_check in WINDOWS_RESERVED_NAMES or not re.search(r"[A-Z0-9]", normalized):
        return "CLIENT"

    return normalized


def is_safe_filename(filename: str) -> bool:
    """Validate that a filename has no path traversal and contains only safe characters."""
    if not filename or len(filename) > 255:
        return False
    if "/" in filename or "\\" in filename or ".." in filename:
        return False
    # Allow alphanumeric, spaces, hyphens, underscores, dots
    return bool(re.match(r"^[A-Za-z0-9_\-. ]+$", filename))


def get_aadhaar_filenames(client_name: str) -> dict[str, str]:
    """Get standardized client-based output filenames for Aadhaar processing.

    Returns dict mapping output keys to client-based filenames.
    """
    name = normalize_client_name(client_name)
    return {
        "normal_unlocked": f"{name} NORMAL UNLOCKED.pdf",
        "normal_cropped": f"{name} NORMAL CROPPED.pdf",
        "normal_jpg": f"{name} NORMAL.jpg",
        "masked_unlocked": f"{name} MASKED UNLOCKED.pdf",
        "masked_cropped": f"{name} MASKED CROPPED.pdf",
        "masked_jpg": f"{name} MASKED.jpg",
        "zip": f"{name} AADHAAR FILES.zip",
    }


def get_pan_filenames(client_name: str) -> dict[str, str]:
    """Get standardized client-based output filenames for PAN processing.

    Returns dict mapping output keys to client-based filenames.
    """
    name = normalize_client_name(client_name)
    return {
        "unlocked": f"{name} PAN UNLOCKED.pdf",
        "cropped": f"{name} PAN CROPPED.pdf",
        "jpg": f"{name} PAN.jpg",
        "zip": f"{name} PAN FILES.zip",
    }
