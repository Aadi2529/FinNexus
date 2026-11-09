/**
 * Canonical Insurance Categories & Classification Architecture for FinNexus Insurance Engine.
 * 
 * Centralized definition matching backend app/core/insurance_categories.py
 */

export const COMPANY_TYPES = [
  "Life Insurance",
  "General Insurance",
  "Standalone Health Insurance",
  "Composite Insurance",
];

export const MOTOR_PLAN_TYPES = [
  "Third Party",
  "Comprehensive",
  "Own Damage",
];

export const INSURANCE_CATEGORIES = [
  {
    code: "MOTOR",
    label: "Motor Insurance",
    icon: "Car",
    subcategories: [
      "Car Insurance",
      "Two-Wheeler Insurance",
      "Commercial Vehicle Insurance",
    ],
    motor_plan_types: MOTOR_PLAN_TYPES,
  },
  {
    code: "HEALTH",
    label: "Health Insurance",
    icon: "HeartPulse",
    subcategories: [
      "Individual Health Insurance",
      "Family Floater Health Insurance",
      "Senior Citizen Health Insurance",
      "Critical Illness Insurance",
      "Super Top-Up Insurance",
      "Group Health Insurance",
      "Personal Accident Insurance",
    ],
  },
  {
    code: "LIFE",
    label: "Life Insurance",
    icon: "Shield",
    subcategories: [
      "Term Life Insurance",
      "Whole Life Insurance",
      "Endowment / Savings",
      "ULIP",
      "Money-Back Policy",
      "Retirement & Pension",
      "Child Career Plan",
      "Group Life Insurance",
    ],
  },
  {
    code: "TRAVEL",
    label: "Travel Insurance",
    icon: "Plane",
    subcategories: [
      "International Travel",
      "Domestic Travel",
      "Student Travel",
      "Corporate Travel",
    ],
  },
  {
    code: "PROPERTY",
    label: "Property & Home Insurance",
    icon: "Home",
    subcategories: [
      "Home Structure",
      "Home Contents",
      "Renters Insurance",
    ],
  },
  {
    code: "COMMERCIAL",
    label: "Commercial / Business Insurance",
    icon: "Building2",
    subcategories: [
      "Shopkeeper Insurance",
      "Marine / Cargo",
      "Fire & Special Perils",
      "Liability Insurance",
      "Professional Indemnity",
      "Workers' Compensation",
    ],
  },
  {
    code: "HOME",
    label: "Home Insurance",
    icon: "Home",
    subcategories: [
      "Home Structure",
      "Home Contents",
      "Renters Insurance",
    ],
  },
  {
    code: "FIRE",
    label: "Fire Insurance",
    icon: "Flame",
    subcategories: [
      "Fire & Special Perils",
      "Industrial All Risks",
    ],
  },
  {
    code: "MARINE",
    label: "Marine Insurance",
    icon: "Ship",
    subcategories: [
      "Marine / Cargo",
      "Marine Hull",
      "Transit / Freight",
    ],
  },
  {
    code: "OTHER",
    label: "Other General Insurance",
    icon: "FileText",
    subcategories: [
      "Other General Insurance",
      "Cyber Insurance",
      "Trade Credit",
      "Miscellaneous",
    ],
  },
  {
    code: "CORPORATE",
    label: "Corporate / Group",
    icon: "Building2",
    subcategories: [
      "Group Health Insurance",
      "Group Life Insurance",
      "Group Personal Accident",
      "Commercial Liability",
    ],
  },
];

// Display options for company creation multi-select (Phase 2.B)
export const SUPPORTED_CATEGORY_OPTIONS = [
  "Life Insurance",
  "Health Insurance",
  "Motor Insurance",
  "Travel Insurance",
  "Property & Home Insurance",
  "Commercial / Business Insurance",
  "Other General Insurance",
];

// Compatibility rules mapping Company Type to allowed categories (Phase 2.C)
export const COMPANY_TYPE_ALLOWED_CATEGORIES = {
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
};

const ALIAS_MAP = {
  // Motor
  MOTOR: "MOTOR",
  "MOTOR INSURANCE": "MOTOR",
  "GENERAL/MOTOR": "MOTOR",
  "GENERAL / MOTOR": "MOTOR",
  MOTOR_INSURANCE: "MOTOR",
  CAR: "MOTOR",
  VEHICLE: "MOTOR",
  BIKE: "MOTOR",
  AUTO: "MOTOR",
  "TWO WHEELER": "MOTOR",
  "FOUR WHEELER": "MOTOR",

  // Health
  HEALTH: "HEALTH",
  "HEALTH INSURANCE": "HEALTH",
  HEALTH_INSURANCE: "HEALTH",
  MEDICLAIM: "HEALTH",
  MEDICAL: "HEALTH",
  CARE: "HEALTH",
  "PERSONAL ACCIDENT": "HEALTH",

  // Life
  LIFE: "LIFE",
  "LIFE INSURANCE": "LIFE",
  LIFE_INSURANCE: "LIFE",
  TERM: "LIFE",
  "TERM LIFE": "LIFE",
  ENDOWMENT: "LIFE",
  ULIP: "LIFE",

  // Travel
  TRAVEL: "TRAVEL",
  "TRAVEL INSURANCE": "TRAVEL",
  TRAVEL_INSURANCE: "TRAVEL",
  OVERSEAS: "TRAVEL",

  // Property & Home
  PROPERTY: "PROPERTY",
  "PROPERTY & HOME INSURANCE": "PROPERTY",
  "PROPERTY & HOME": "PROPERTY",
  "PROPERTY INSURANCE": "PROPERTY",
  HOME: "PROPERTY",
  "HOME INSURANCE": "PROPERTY",
  HOME_INSURANCE: "PROPERTY",
  HOUSE: "PROPERTY",

  // Commercial / Business / Corporate
  COMMERCIAL: "COMMERCIAL",
  "COMMERCIAL / BUSINESS INSURANCE": "COMMERCIAL",
  "COMMERCIAL / BUSINESS": "COMMERCIAL",
  "COMMERCIAL INSURANCE": "COMMERCIAL",
  "BUSINESS INSURANCE": "COMMERCIAL",
  CORPORATE: "COMMERCIAL",
  "CORPORATE / GROUP": "COMMERCIAL",
  "CORPORATE INSURANCE": "COMMERCIAL",
  GROUP: "COMMERCIAL",
  FIRE: "COMMERCIAL",
  "FIRE INSURANCE": "COMMERCIAL",
  MARINE: "COMMERCIAL",
  "MARINE INSURANCE": "COMMERCIAL",

  // Composite / General / Other
  COMPOSITE: "COMPOSITE",
  "COMPOSITE INSURANCE": "COMPOSITE",
  GENERAL: "GENERAL",
  "GENERAL INSURANCE": "GENERAL",
  OTHER: "OTHER",
  "OTHER INSURANCE": "OTHER",
  "OTHER GENERAL INSURANCE": "OTHER",
};

const CODE_TO_LABEL = {
  MOTOR: "Motor Insurance",
  HEALTH: "Health Insurance",
  LIFE: "Life Insurance",
  TRAVEL: "Travel Insurance",
  PROPERTY: "Property & Home Insurance",
  COMMERCIAL: "Commercial / Business Insurance",
  HOME: "Property & Home Insurance",
  FIRE: "Fire Insurance",
  MARINE: "Marine Insurance",
  OTHER: "Other General Insurance",
  CORPORATE: "Commercial / Business Insurance",
  COMPOSITE: "Composite Insurance",
  GENERAL: "General Insurance",
};

/**
 * Normalize any input string into its canonical code (e.g., 'MOTOR', 'HEALTH').
 */
export function getCategoryCode(raw) {
  if (!raw) return "OTHER";
  const cleaned = String(raw).trim().toUpperCase();
  if (ALIAS_MAP[cleaned]) return ALIAS_MAP[cleaned];
  if (cleaned.includes("MOTOR") || cleaned.includes("CAR") || cleaned.includes("VEHICLE")) return "MOTOR";
  if (cleaned.includes("HEALTH") || cleaned.includes("MED") || cleaned.includes("CARE")) return "HEALTH";
  if (cleaned.includes("LIFE") || cleaned.includes("TERM")) return "LIFE";
  if (cleaned.includes("TRAVEL") || cleaned.includes("TRIP")) return "TRAVEL";
  if (cleaned.includes("PROPERTY") || cleaned.includes("HOME") || cleaned.includes("HOUSE")) return "PROPERTY";
  if (cleaned.includes("FIRE") || cleaned.includes("FLAME")) return "COMMERCIAL";
  if (cleaned.includes("MARINE") || cleaned.includes("CARGO")) return "COMMERCIAL";
  if (cleaned.includes("COMMERCIAL") || cleaned.includes("CORP") || cleaned.includes("BUSINESS")) return "COMMERCIAL";
  return "OTHER";
}

/**
 * Return user-facing display label for any category representation.
 */
export function getCategoryLabel(raw) {
  const code = getCategoryCode(raw);
  return CODE_TO_LABEL[code] || "Other General Insurance";
}

/**
 * Check if two category representations match or are compatible.
 */
export function categoriesMatch(cat1, cat2) {
  if (!cat1 || !cat2) return false;
  const c1 = String(cat1).trim().toUpperCase();
  const c2 = String(cat2).trim().toUpperCase();
  if (c1 === "ALL" || c2 === "ALL") return true;
  if (c1 === "COMPOSITE" || c2 === "COMPOSITE" || c1 === "COMPOSITE INSURANCE" || c2 === "COMPOSITE INSURANCE") return true;
  if (c1 === "GENERAL" || c2 === "GENERAL" || c1 === "GENERAL INSURANCE" || c2 === "GENERAL INSURANCE") return true;
  const code1 = getCategoryCode(c1);
  const code2 = getCategoryCode(c2);
  if (code1 === "COMPOSITE" || code2 === "COMPOSITE") return true;
  if (code1 === "GENERAL" || code2 === "GENERAL") return true;
  return code1 === code2;
}

/**
 * Matching function for UI dropdown filtering.
 */
export function lobMatches(planLobRaw, formLobRaw) {
  if (!formLobRaw || formLobRaw === "ALL") return true;
  if (!planLobRaw) return true;
  return categoriesMatch(planLobRaw, formLobRaw);
}

/**
 * Get subcategories for an insurance category.
 */
export function getSubcategoriesForCategory(category) {
  if (!category) return [];
  const code = getCategoryCode(category);
  const cat = INSURANCE_CATEGORIES.find((c) => c.code === code);
  return cat ? cat.subcategories || [] : [];
}

/**
 * Get allowed categories for a company type.
 */
export function getAllowedCategoriesForCompanyType(companyType) {
  if (!companyType) return COMPANY_TYPE_ALLOWED_CATEGORIES["General Insurance"];
  return COMPANY_TYPE_ALLOWED_CATEGORIES[companyType] || COMPANY_TYPE_ALLOWED_CATEGORIES["Composite Insurance"];
}

/**
 * Validate categories against company type.
 */
export function validateCompanyTypeCategories(companyType, categories = [], isSuperAdmin = false) {
  if (isSuperAdmin) return { valid: true };
  const allowed = getAllowedCategoriesForCompanyType(companyType);
  for (const cat of categories) {
    const code = getCategoryCode(cat);
    const isAllowed = allowed.some((a) => getCategoryCode(a) === code);
    if (!isAllowed) {
      return {
        valid: false,
        error: `Category "${cat}" is not permitted under Company Type "${companyType}". Allowed: ${allowed.join(", ")}`,
      };
    }
  }
  return { valid: true };
}
