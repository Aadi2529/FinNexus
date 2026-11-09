/**
 * FinNexus Insurance Engine — Strict Validation Utilities & Sanitizers
 * 
 * Complies with strict regulatory & actuarial standards:
 * - Indian Mobile: Exactly 10 digits, starts with 6, 7, 8, or 9
 * - PIN Code: Exactly 6 digits
 * - Aadhaar: Exactly 12 digits
 * - PAN: Standard Indian Income Tax PAN format (5 letters, 4 digits, 1 letter)
 * - GSTIN: 15-character Indian GST identification format
 * - Email: RFC-compliant address format with valid domain
 * - Financial amounts: Positive decimals, non-floating-point accurate
 * - Percentages: 0.00% to 100.00%
 * - Dates: Consistent DD-MM-YYYY display and ISO YYYY-MM-DD storage
 */

// ---------------------------------------------------------------------------
// A. MOBILE NUMBER VALIDATION (Indian standard)
// ---------------------------------------------------------------------------

/**
 * Sanitizes input to retain only up to 10 numeric digits.
 */
export function sanitizeIndianMobile(value) {
  if (!value) return "";
  return String(value).replace(/\D/g, "").slice(0, 10);
}

/**
 * Validates an Indian mobile number.
 * Rules:
 * - Exactly 10 digits
 * - Numeric only
 * - First digit must be 6, 7, 8, or 9
 * - Rejects alphabets, special characters, spaces
 */
export function validateIndianMobile(value, fieldLabel = "Mobile number", required = true) {
  const raw = value == null ? "" : String(value).trim();

  if (!raw) {
    if (required) {
      return { isValid: false, error: `${fieldLabel} is required.` };
    }
    return { isValid: true, error: null };
  }

  // Check for any non-digit characters in original raw input
  if (/\D/.test(raw)) {
    return {
      isValid: false,
      error: `${fieldLabel} must contain only numeric digits (no alphabets, spaces, or special characters).`,
    };
  }

  if (raw.length !== 10) {
    return {
      isValid: false,
      error: `${fieldLabel} must be exactly 10 digits (currently ${raw.length}).`,
    };
  }

  const firstDigit = raw.charAt(0);
  if (!["6", "7", "8", "9"].includes(firstDigit)) {
    return {
      isValid: false,
      error: `${fieldLabel} must start with 6, 7, 8, or 9 (starts with '${firstDigit}').`,
    };
  }

  return { isValid: true, error: null, sanitized: raw };
}

// ---------------------------------------------------------------------------
// B. NUMERIC & IDENTIFIER VALIDATION
// ---------------------------------------------------------------------------

/**
 * Sanitizes input to digits only with an optional maximum length.
 */
export function sanitizeDigitsOnly(value, maxLength = null) {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  return maxLength ? digits.slice(0, maxLength) : digits;
}

/**
 * Validates Indian PIN code (exactly 6 digits, non-zero starting digit).
 */
export function validatePinCode(value, fieldLabel = "PIN code", required = true) {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) {
    if (required) return { isValid: false, error: `${fieldLabel} is required.` };
    return { isValid: true, error: null };
  }

  if (/\D/.test(raw)) {
    return { isValid: false, error: `${fieldLabel} must contain digits only.` };
  }

  if (!/^[1-9]\d{5}$/.test(raw)) {
    return { isValid: false, error: `${fieldLabel} must be a valid 6-digit Indian postal code.` };
  }

  return { isValid: true, error: null, sanitized: raw };
}

/**
 * Validates Indian Aadhaar number (exactly 12 numeric digits).
 */
export function validateAadhaar(value, fieldLabel = "Aadhaar number", required = true) {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) {
    if (required) return { isValid: false, error: `${fieldLabel} is required.` };
    return { isValid: true, error: null };
  }

  if (/\D/.test(raw)) {
    return { isValid: false, error: `${fieldLabel} must contain digits only.` };
  }

  if (!/^\d{12}$/.test(raw)) {
    return { isValid: false, error: `${fieldLabel} must be exactly 12 numeric digits.` };
  }

  return { isValid: true, error: null, sanitized: raw };
}

/**
 * Validates Indian PAN format: 5 uppercase letters, 4 digits, 1 uppercase letter.
 */
export function validatePan(value, fieldLabel = "PAN", required = true) {
  const raw = value == null ? "" : String(value).trim().toUpperCase();
  if (!raw) {
    if (required) return { isValid: false, error: `${fieldLabel} is required.` };
    return { isValid: true, error: null };
  }

  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(raw)) {
    return {
      isValid: false,
      error: `${fieldLabel} must be in standard 10-character Indian PAN format (e.g. ABCDE1234F).`,
    };
  }

  return { isValid: true, error: null, sanitized: raw };
}

/**
 * Validates Indian GSTIN format: 15 characters (state code + PAN + entity + Z + check).
 */
export function validateGstin(value, fieldLabel = "GSTIN", required = true) {
  const raw = value == null ? "" : String(value).trim().toUpperCase();
  if (!raw) {
    if (required) return { isValid: false, error: `${fieldLabel} is required.` };
    return { isValid: true, error: null };
  }

  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(raw)) {
    return {
      isValid: false,
      error: `${fieldLabel} must be in valid 15-character GSTIN format (e.g. 27ABCDE1234F1Z5).`,
    };
  }

  return { isValid: true, error: null, sanitized: raw };
}

/**
 * Validates Indian vehicle registration number (Standard and BH series).
 * Examples: MH12AB1234, DL-01-A-1234, 22BH1234AA
 */
export function validateVehicleRegistration(value, fieldLabel = "Vehicle registration number", required = true) {
  const raw = value == null ? "" : String(value).trim().toUpperCase();
  if (!raw) {
    if (required) return { isValid: false, error: `${fieldLabel} is required.` };
    return { isValid: true, error: null };
  }

  const clean = raw.replace(/[\s-]/g, "");
  // Standard: 2 state letters + 1-2 RTO digits + 1-3 series letters + 4 digits
  const standardRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
  // BH series: 2 year digits + BH + 4 digits + 1-2 letters
  const bhRegex = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;

  if (!standardRegex.test(clean) && !bhRegex.test(clean)) {
    return {
      isValid: false,
      error: `${fieldLabel} must follow standard Indian registration rules (e.g. MH12AB1234 or 22BH1234AB).`,
    };
  }

  return { isValid: true, error: null, sanitized: clean };
}

// ---------------------------------------------------------------------------
// C. FINANCIAL & DECIMAL VALIDATION
// ---------------------------------------------------------------------------

/**
 * Validates positive decimal financial amount.
 * Prevents negative numbers, non-numeric values, and optionally zero.
 */
export function validatePositiveDecimal(value, fieldLabel = "Amount", required = true, allowZero = false) {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) {
    if (required) return { isValid: false, error: `${fieldLabel} is required.` };
    return { isValid: true, error: null };
  }

  const num = Number(raw);
  if (isNaN(num)) {
    return { isValid: false, error: `${fieldLabel} must be a valid numeric amount.` };
  }

  if (num < 0) {
    return { isValid: false, error: `${fieldLabel} cannot be negative.` };
  }

  if (!allowZero && num === 0) {
    return { isValid: false, error: `${fieldLabel} must be greater than zero.` };
  }

  return { isValid: true, error: null, value: num };
}

/**
 * Validates percentage values (0.00% to 100.00%).
 */
export function validatePercentage(value, fieldLabel = "Rate / Percentage", required = true, min = 0, max = 100) {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) {
    if (required) return { isValid: false, error: `${fieldLabel} is required.` };
    return { isValid: true, error: null };
  }

  const num = Number(raw);
  if (isNaN(num)) {
    return { isValid: false, error: `${fieldLabel} must be a valid numeric percentage.` };
  }

  if (num < min || num > max) {
    return { isValid: false, error: `${fieldLabel} must be between ${min}% and ${max}%.` };
  }

  return { isValid: true, error: null, value: num };
}

/**
 * Validates positive integer values (e.g. policy term in years).
 */
export function validatePositiveInteger(value, fieldLabel = "Value", required = true, min = 1) {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) {
    if (required) return { isValid: false, error: `${fieldLabel} is required.` };
    return { isValid: true, error: null };
  }

  if (!/^\d+$/.test(raw)) {
    return { isValid: false, error: `${fieldLabel} must be a whole positive integer.` };
  }

  const num = parseInt(raw, 10);
  if (num < min) {
    return { isValid: false, error: `${fieldLabel} must be at least ${min}.` };
  }

  return { isValid: true, error: null, value: num };
}

// ---------------------------------------------------------------------------
// D. EMAIL VALIDATION
// ---------------------------------------------------------------------------

/**
 * Validates email address format with strict domain checks.
 * Trims leading/trailing whitespace.
 */
export function validateEmail(value, fieldLabel = "Email address", required = true) {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) {
    if (required) return { isValid: false, error: `${fieldLabel} is required.` };
    return { isValid: true, error: null };
  }

  // Standard RFC 5322 compatible regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(raw)) {
    return {
      isValid: false,
      error: `${fieldLabel} must be a valid email format (e.g. advisor@company.com).`,
    };
  }

  // Reject double dots or trailing dots
  if (raw.includes("..") || raw.endsWith(".")) {
    return { isValid: false, error: `${fieldLabel} contains an invalid domain.` };
  }

  return { isValid: true, error: null, sanitized: raw.toLowerCase() };
}

// ---------------------------------------------------------------------------
// E. TEXT & NAME VALIDATION
// ---------------------------------------------------------------------------

/**
 * Validates names.
 * Rules:
 * - Reject numeric-only names
 * - Allow legitimate spaces, apostrophes, hyphens, periods
 * - Support Unicode characters and Indian regional language scripts
 * - Prevent whitespace-only values
 */
export function validateName(value, fieldLabel = "Name", required = true) {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) {
    if (required) return { isValid: false, error: `${fieldLabel} is required.` };
    return { isValid: true, error: null };
  }

  // Reject pure numbers
  if (/^\d+$/.test(raw)) {
    return { isValid: false, error: `${fieldLabel} cannot be purely numeric.` };
  }

  // Check minimum length
  if (raw.length < 2) {
    return { isValid: false, error: `${fieldLabel} must be at least 2 characters.` };
  }

  // Check that it contains at least one letter character (supports Unicode letters)
  if (!/\p{L}/u.test(raw)) {
    return { isValid: false, error: `${fieldLabel} must contain valid letters.` };
  }

  return { isValid: true, error: null, sanitized: raw };
}

// ---------------------------------------------------------------------------
// F. DATE UTILITIES & BUSINESS RULES
// ---------------------------------------------------------------------------

/**
 * Formats ISO YYYY-MM-DD (or Date object) into consistent display format DD-MM-YYYY.
 */
export function formatDisplayDate(dateInput) {
  if (!dateInput) return "";
  let year, month, day;

  if (typeof dateInput === "string") {
    // If already in DD-MM-YYYY format
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateInput)) {
      return dateInput;
    }
    // If in YYYY-MM-DD or ISO timestamp
    const parts = dateInput.slice(0, 10).split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
      return `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  day = String(d.getDate()).padStart(2, "0");
  month = String(d.getMonth() + 1).padStart(2, "0");
  year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Parses DD-MM-YYYY or ISO date string into ISO YYYY-MM-DD for backend storage.
 */
export function parseToIsoDate(dateInput) {
  if (!dateInput) return "";
  const raw = String(dateInput).trim();

  // If already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  // If in DD-MM-YYYY format
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("-");
    return `${year}-${month}-${day}`;
  }

  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date in ISO YYYY-MM-DD.
 */
export function getTodayIso() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Validates that Customer Date of Birth is not in the future.
 */
export function validateDobNotFuture(dobInput, fieldLabel = "Date of Birth", required = true) {
  const iso = parseToIsoDate(dobInput);
  if (!iso) {
    if (required) return { isValid: false, error: `${fieldLabel} is required.` };
    return { isValid: true, error: null };
  }

  const today = getTodayIso();
  if (iso > today) {
    return { isValid: false, error: `${fieldLabel} cannot be in the future.` };
  }

  return { isValid: true, error: null, iso };
}

/**
 * Validates date ordering (e.g. End Date >= Start Date, Renewal Date >= Tieup Date).
 */
export function validateDateOrder(startInput, endInput, startLabel = "Start Date", endLabel = "End Date") {
  const startIso = parseToIsoDate(startInput);
  const endIso = parseToIsoDate(endInput);

  if (!startIso || !endIso) {
    return { isValid: true, error: null };
  }

  if (endIso < startIso) {
    return {
      isValid: false,
      error: `${endLabel} (${formatDisplayDate(endIso)}) cannot precede ${startLabel} (${formatDisplayDate(startIso)}).`,
    };
  }

  return { isValid: true, error: null };
}
