"""Canonical Insurance Category Standardization & Multi-Category Architecture for FinNexus Insurance Engine.

Defines the single source of truth for all insurance categories and company classification rules across:
- Insurance Companies (Company Master & Supported Categories)
- Insurance Plans (Plan Master, Subcategories, Motor Plan Types)
- Policies (Issue Policy & Lifecycle)
- Commissions, Leads, Customers & Analytics
"""

from __future__ import annotations

from typing import Any, Final

# ---------------------------------------------------------------------------
# Company Legal Classification Types (Phase 2.A)
# ---------------------------------------------------------------------------
COMPANY_TYPES: Final[list[str]] = [
    "Life Insurance",
    "General Insurance",
    "Standalone Health Insurance",
    "Composite Insurance",
]

# ---------------------------------------------------------------------------
# Motor Plan Types (Phase 2.B.3)
# ---------------------------------------------------------------------------
MOTOR_PLAN_TYPES: Final[list[str]] = [
    "Third Party",
    "Comprehensive",
    "Own Damage",
]

# ---------------------------------------------------------------------------
# Canonical Categories Registry (Phase 2.B)
# ---------------------------------------------------------------------------
CANONICAL_CATEGORIES: Final[list[dict[str, Any]]] = [
    {
        "code": "MOTOR",
        "label": "Motor Insurance",
        "icon": "Car",
        "subcategories": [
            "Car Insurance",
            "Two-Wheeler Insurance",
            "Commercial Vehicle Insurance",
        ],
        "motor_plan_types": MOTOR_PLAN_TYPES,
        "aliases": [
            "MOTOR",
            "MOTOR INSURANCE",
            "GENERAL/MOTOR",
            "GENERAL / MOTOR",
            "MOTOR_INSURANCE",
            "GENERAL INSURANCE",
            "CAR",
            "VEHICLE",
            "BIKE",
            "AUTO",
            "TWO WHEELER",
            "TWO-WHEELER",
            "FOUR WHEELER",
            "FOUR-WHEELER",
            "COMMERCIAL FLEET & MOTOR COVER",
        ],
    },
    {
        "code": "HEALTH",
        "label": "Health Insurance",
        "icon": "HeartPulse",
        "subcategories": [
            "Individual Health Insurance",
            "Family Floater Health Insurance",
            "Senior Citizen Health Insurance",
            "Critical Illness Insurance",
            "Super Top-Up Insurance",
            "Group Health Insurance",
            "Personal Accident Insurance",
        ],
        "aliases": [
            "HEALTH",
            "HEALTH INSURANCE",
            "HEALTH_INSURANCE",
            "MEDICLAIM",
            "MEDICAL",
            "CARE",
            "HEALTH SHIELD",
            "CRITICAL ILLNESS",
            "PERSONAL ACCIDENT",
            "PERSONAL ACCIDENT INSURANCE",
            "OPTIMA COMPREHENSIVE HEALTH PLAN",
        ],
    },
    {
        "code": "LIFE",
        "label": "Life Insurance",
        "icon": "Shield",
        "subcategories": [
            "Term Life Insurance",
            "Whole Life Insurance",
            "Endowment / Savings",
            "ULIP",
            "Money-Back Policy",
            "Retirement & Pension",
            "Child Career Plan",
            "Group Life Insurance",
        ],
        "aliases": [
            "LIFE",
            "LIFE INSURANCE",
            "LIFE_INSURANCE",
            "TERM",
            "TERM LIFE",
            "ENDOWMENT",
            "ULIP",
            "ANNUITY",
            "PENSION",
            "SAVINGS",
            "ENTERPRISE TERM LIFE SHIELD",
        ],
    },
    {
        "code": "TRAVEL",
        "label": "Travel Insurance",
        "icon": "Plane",
        "subcategories": [
            "International Travel",
            "Domestic Travel",
            "Student Travel",
            "Corporate Travel",
        ],
        "aliases": [
            "TRAVEL",
            "TRAVEL INSURANCE",
            "TRAVEL_INSURANCE",
            "OVERSEAS",
            "TRIP",
            "FLIGHT",
        ],
    },
    {
        "code": "PROPERTY",
        "label": "Property & Home Insurance",
        "icon": "Home",
        "subcategories": [
            "Home Structure",
            "Home Contents",
            "Renters Insurance",
        ],
        "aliases": [
            "PROPERTY",
            "PROPERTY & HOME INSURANCE",
            "PROPERTY & HOME",
            "PROPERTY INSURANCE",
            "HOME",
            "HOME INSURANCE",
            "HOME_INSURANCE",
            "HOUSE",
            "DWELLING",
        ],
    },
    {
        "code": "COMMERCIAL",
        "label": "Commercial / Business Insurance",
        "icon": "Building2",
        "subcategories": [
            "Shopkeeper Insurance",
            "Marine / Cargo",
            "Fire & Special Perils",
            "Liability Insurance",
            "Professional Indemnity",
            "Workers' Compensation",
        ],
        "aliases": [
            "COMMERCIAL",
            "COMMERCIAL / BUSINESS INSURANCE",
            "COMMERCIAL / BUSINESS",
            "COMMERCIAL INSURANCE",
            "BUSINESS INSURANCE",
            "CORPORATE",
            "CORPORATE / GROUP",
            "CORPORATE INSURANCE",
            "GROUP",
            "SHOPKEEPER",
            "LIABILITY",
            "WORKERS COMPENSATION",
        ],
    },
    {
        "code": "HOME",
        "label": "Home Insurance",
        "icon": "Home",
        "subcategories": [
            "Home Structure",
            "Home Contents",
            "Renters Insurance",
        ],
        "aliases": [
            "HOME",
            "HOME INSURANCE",
            "HOME_INSURANCE",
            "HOUSE",
            "PROPERTY",
            "DWELLING",
        ],
    },
    {
        "code": "FIRE",
        "label": "Fire Insurance",
        "icon": "Flame",
        "subcategories": [
            "Fire & Special Perils",
            "Industrial All Risks",
        ],
        "aliases": [
            "FIRE",
            "FIRE INSURANCE",
            "FIRE_INSURANCE",
            "FLAME",
            "CONFLAGRATION",
        ],
    },
    {
        "code": "MARINE",
        "label": "Marine Insurance",
        "icon": "Ship",
        "subcategories": [
            "Marine / Cargo",
            "Marine Hull",
            "Transit / Freight",
        ],
        "aliases": [
            "MARINE",
            "MARINE INSURANCE",
            "MARINE_INSURANCE",
            "CARGO",
            "HULL",
            "TRANSIT",
            "FREIGHT",
        ],
    },
    {
        "code": "OTHER",
        "label": "Other General Insurance",
        "icon": "FileText",
        "subcategories": [
            "Other General Insurance",
            "Cyber Insurance",
            "Trade Credit",
            "Miscellaneous",
        ],
        "aliases": [
            "OTHER",
            "OTHER INSURANCE",
            "OTHER_INSURANCE",
            "OTHER GENERAL INSURANCE",
            "MISCELLANEOUS",
            "GENERAL",
        ],
    },
    {
        "code": "CORPORATE",
        "label": "Corporate / Group",
        "icon": "Building2",
        "subcategories": [
            "Group Health Insurance",
            "Group Life Insurance",
            "Group Personal Accident",
            "Commercial Liability",
        ],
        "aliases": [
            "CORPORATE",
            "CORPORATE / GROUP",
            "CORPORATE INSURANCE",
            "GROUP",
            "COMMERCIAL",
            "GROUP HEALTH",
        ],
    },
]

# Quick lookup structures
_CODE_TO_CATEGORY: dict[str, dict[str, Any]] = {c["code"]: c for c in CANONICAL_CATEGORIES}

_ALIAS_TO_CODE: dict[str, str] = {}
for cat in CANONICAL_CATEGORIES:
    _ALIAS_TO_CODE[cat["code"].upper()] = cat["code"]
    _ALIAS_TO_CODE[cat["label"].upper()] = cat["code"]
    for alias in cat["aliases"]:
        _ALIAS_TO_CODE[alias.upper()] = cat["code"]

# ---------------------------------------------------------------------------
# Default Company Type Compatibility Rules (Phase 2.C)
# ---------------------------------------------------------------------------
COMPANY_TYPE_ALLOWED_CATEGORY_CODES: Final[dict[str, list[str]]] = {
    "Life Insurance": ["LIFE"],
    "General Insurance": [
        "HEALTH",
        "MOTOR",
        "TRAVEL",
        "PROPERTY",
        "COMMERCIAL",
        "HOME",
        "FIRE",
        "MARINE",
        "OTHER",
        "CORPORATE",
    ],
    "Standalone Health Insurance": ["HEALTH"],
    "Composite Insurance": [
        "LIFE",
        "HEALTH",
        "MOTOR",
        "TRAVEL",
        "PROPERTY",
        "COMMERCIAL",
        "HOME",
        "FIRE",
        "MARINE",
        "OTHER",
        "CORPORATE",
    ],
}

COMPANY_TYPE_ALLOWED_CATEGORIES: Final[dict[str, list[str]]] = {
    "Life Insurance": [
        "Life Insurance",
    ],
    "General Insurance": [
        "Health Insurance",
        "Motor Insurance",
        "Travel Insurance",
        "Property & Home Insurance",
        "Commercial / Business Insurance",
        "Other General Insurance",
    ],
    "Standalone Health Insurance": [
        "Health Insurance",
    ],
    "Composite Insurance": [
        "Life Insurance",
        "Health Insurance",
        "Motor Insurance",
        "Travel Insurance",
        "Property & Home Insurance",
        "Commercial / Business Insurance",
        "Other General Insurance",
    ],
}


def normalize_category_code(raw_value: str | None) -> str:
    """Normalize any raw category string, legacy abbreviation, or label to its canonical uppercase code."""
    if not raw_value:
        return "OTHER"
    cleaned = str(raw_value).strip().upper()
    if cleaned in ("COMPOSITE", "COMPOSITE INSURANCE"):
        return "COMPOSITE"
    if cleaned in ("GENERAL", "GENERAL INSURANCE"):
        return "GENERAL"
    if cleaned in _ALIAS_TO_CODE:
        return _ALIAS_TO_CODE[cleaned]
    # Substring heuristic checks
    if any(k in cleaned for k in ["MOTOR", "CAR", "VEHICLE", "BIKE", "AUTO"]):
        return "MOTOR"
    if any(k in cleaned for k in ["HEALTH", "MEDIC", "CARE"]):
        return "HEALTH"
    if any(k in cleaned for k in ["LIFE", "TERM", "ENDOW", "ULIP"]):
        return "LIFE"
    if any(k in cleaned for k in ["TRAVEL", "TRIP", "OVERSEAS"]):
        return "TRAVEL"
    if any(k in cleaned for k in ["PROPERTY"]):
        return "PROPERTY"
    if any(k in cleaned for k in ["HOME", "HOUSE", "DWELLING"]):
        return "HOME"
    if any(k in cleaned for k in ["FIRE", "FLAME"]):
        return "FIRE"
    if any(k in cleaned for k in ["MARINE", "CARGO", "HULL"]):
        return "MARINE"
    if any(k in cleaned for k in ["COMMERCIAL", "BUSINESS", "SHOPKEEPER", "LIABILITY"]):
        return "COMMERCIAL"
    if any(k in cleaned for k in ["CORP", "GROUP"]):
        return "CORPORATE"
    return "OTHER"


def normalize_category_label(raw_value: str | None) -> str:
    """Return the user-facing canonical display label for any category representation."""
    code = normalize_category_code(raw_value)
    if code == "COMPOSITE":
        return "Composite Insurance"
    if code == "GENERAL":
        return "General Insurance"
    cat = _CODE_TO_CATEGORY.get(code)
    return cat["label"] if cat else "Other General Insurance"


def get_category_aliases(raw_value: str | None) -> list[str]:
    """Retrieve all known uppercase aliases for a category to allow robust SQL matching."""
    code = normalize_category_code(raw_value)
    if code == "COMPOSITE":
        return ["COMPOSITE", "COMPOSITE INSURANCE"]
    if code == "GENERAL":
        return ["GENERAL", "GENERAL INSURANCE"]
    cat = _CODE_TO_CATEGORY.get(code)
    if not cat:
        return ["OTHER"]
    aliases = {code, cat["label"].upper()}
    for a in cat.get("aliases", []):
        aliases.add(a.upper())
    # Cross-match PROPERTY and HOME
    if code in ("PROPERTY", "HOME"):
        aliases.update(["PROPERTY", "HOME", "HOME INSURANCE", "PROPERTY & HOME INSURANCE", "PROPERTY INSURANCE"])
    # Cross-match COMMERCIAL and CORPORATE
    if code in ("COMMERCIAL", "CORPORATE"):
        aliases.update(["COMMERCIAL", "CORPORATE", "COMMERCIAL / BUSINESS INSURANCE", "CORPORATE / GROUP", "COMMERCIAL INSURANCE"])
    return list(aliases)


def categories_match(cat1: str | None, cat2: str | None) -> bool:
    """Check if two category representations are compatible."""
    if not cat1 or not cat2:
        return False
    c1 = str(cat1).strip().upper()
    c2 = str(cat2).strip().upper()
    if any(k in (c1, c2) for k in ("ALL", "COMPOSITE", "GENERAL", "GENERAL INSURANCE")):
        return True
    code1 = normalize_category_code(c1)
    code2 = normalize_category_code(c2)
    if code1 in ("ALL", "COMPOSITE", "GENERAL") or code2 in ("ALL", "COMPOSITE", "GENERAL"):
        return True
    if code1 == code2:
        return True
    # Cross-match aliases
    if code1 in ("PROPERTY", "HOME") and code2 in ("PROPERTY", "HOME"):
        return True
    if code1 in ("COMMERCIAL", "CORPORATE") and code2 in ("COMMERCIAL", "CORPORATE"):
        return True
    return False


def get_allowed_categories_for_company_type(company_type: str | None) -> list[str]:
    """Return the list of allowed category labels for a given company type."""
    if not company_type:
        return COMPANY_TYPE_ALLOWED_CATEGORIES["General Insurance"]
    return COMPANY_TYPE_ALLOWED_CATEGORIES.get(
        company_type,
        COMPANY_TYPE_ALLOWED_CATEGORIES["Composite Insurance"],
    )


def validate_company_type_categories(
    company_type: str,
    categories: list[str],
    is_super_admin: bool = False,
) -> tuple[bool, str | None]:
    """Validate that the assigned categories comply with Company Type classification rules.

    Super Admins can configure exceptions if insurer authorization requires it.
    """
    if is_super_admin:
        return True, None

    allowed_codes = COMPANY_TYPE_ALLOWED_CATEGORY_CODES.get(
        company_type,
        COMPANY_TYPE_ALLOWED_CATEGORY_CODES["Composite Insurance"],
    )

    for cat in categories:
        code = normalize_category_code(cat)
        if code not in allowed_codes:
            allowed_labels = ", ".join(COMPANY_TYPE_ALLOWED_CATEGORIES.get(company_type, []))
            return (
                False,
                f"Category '{cat}' is not permitted under Company Type '{company_type}'. "
                f"Allowed categories: {allowed_labels}. (Super Admin authorization required for exception)",
            )

    return True, None


def get_subcategories_for_category(category: str | None) -> list[str]:
    """Retrieve configured subcategories for an insurance category."""
    code = normalize_category_code(category)
    cat = _CODE_TO_CATEGORY.get(code)
    return cat.get("subcategories", []) if cat else []


def get_motor_plan_types() -> list[str]:
    """Return supported Motor Insurance plan types."""
    return list(MOTOR_PLAN_TYPES)
