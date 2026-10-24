/**
 * Utility functions for Date of Birth (DOB) progressive input formatting and calendar validation.
 *
 * Implements:
 * - Progressive slash formatting:
 *   '2' -> '2'
 *   '29' -> '29/'
 *   '29/05' -> '29/05/'
 *   '29/05/2004' -> '29/05/2004'
 * - Clean backspace handling without getting stuck at separators.
 * - Paste support for plain digits, formatted dates (DD/MM/YYYY, DD-MM-YYYY), and ISO dates (YYYY-MM-DD).
 * - Full calendar validation including leap year rules (century and non-century) and month day limits.
 */

/**
 * Form\]mat DOB input value with progressive slashes.
 *
 * @param {string} rawInput - Current input value from onChange event
 * @param {string} prevValue - Previous input value before change
 * @returns {string} Formatted date string (max 10 characters: DD/MM/YYYY)
 */ 

export function formatDobInput(rawInput = "", prevValue = "") {
  if (!rawInput) return "";

  const trimmed = rawInput.trim();

  // Support ISO date format conversion on paste (YYYY-MM-DD)
  const isoMatch = trimmed.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }

  // Handle backspace when previous value ended with a slash:
  // e.g. prev was '29/' and input is '29' (user backspaced the slash).
  // Automatically pop the preceding digit so user doesn't get stuck in a slash loop.
  if (
    prevValue &&
    prevValue.endsWith("/") &&
    trimmed === prevValue.slice(0, -1)
  ) {
    return trimmed.slice(0, -1);
  }

  // Extract only digits
  const digits = trimmed.replace(/\D/g, "").slice(0, 8);
  if (!digits) return "";

  if (digits.length <= 2) {
    // If exactly 2 digits and user is typing forward, append slash
    if (digits.length === 2 && trimmed.length >= prevValue.length) {
      return `${digits}/`;
    }
    return digits;
  }

  if (digits.length <= 4) {
    const day = digits.slice(0, 2);
    const month = digits.slice(2);
    if (digits.length === 4 && trimmed.length >= prevValue.length) {
      return `${day}/${month}/`;
    }
    return `${day}/${month}`;
  }

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return `${day}/${month}/${year}`;
}

/**
 * Determine if a year is a leap year according to the Gregorian calendar.
 *
 * @param {number} year
 * @returns {boolean}
 */
export function isLeapYear(year) {
  if (typeof year !== "number" || isNaN(year)) return false;
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Get maximum number of days in a given month and year.
 *
 * @param {number} month - 1 to 12
 * @param {number} year - 4 digit year
 * @returns {number} Days in month (28-31)
 */
export function getDaysInMonth(month, year) {
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return 31;
}

/**
 * Validate Date of Birth string.
 *
 * @param {string} dobString - Formatted date string (e.g. DD/MM/YYYY)
 * @returns {{ isValid: boolean, error: string | null }}
 */
export function validateDob(dobString = "") {
  if (!dobString || !dobString.trim()) {
    return { isValid: false, error: "Date of Birth is required." };
  }

  const cleaned = dobString.trim();

  // Check structure: DD/MM/YYYY or YYYY-MM-DD
  let day, month, year;
  const dmyMatch = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  const ymdMatch = cleaned.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);

  if (dmyMatch) {
    day = parseInt(dmyMatch[1], 10);
    month = parseInt(dmyMatch[2], 10);
    year = parseInt(dmyMatch[3], 10);
  } else if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10);
    month = parseInt(ymdMatch[2], 10);
    day = parseInt(ymdMatch[3], 10);
  } else {
    // Incomplete or malformed
    const digitsCount = cleaned.replace(/\D/g, "").length;
    if (digitsCount < 8) {
      return {
        isValid: false,
        error: "Please enter complete 8-digit date in DD/MM/YYYY format.",
      };
    }
    return {
      isValid: false,
      error: "Invalid format. Expected DD/MM/YYYY (e.g. 29/05/2004).",
    };
  }

  // Validate year range
  const currentYear = new Date().getFullYear();
  if (year < 1900) {
    return { isValid: false, error: "Year of birth must be 1900 or later." };
  }
  if (year > currentYear + 1) {
    return { isValid: false, error: "Date of birth cannot be in the future." };
  }

  // Validate month
  if (month < 1 || month > 12) {
    return {
      isValid: false,
      error: "Invalid month. Month must be between 01 and 12.",
    };
  }

  // Validate day according to calendar rules and leap years
  const maxDays = getDaysInMonth(month, year);
  if (day < 1 || day > maxDays) {
    if (month === 2) {
      if (day === 29 && !isLeapYear(year)) {
        return {
          isValid: false,
          error: `February ${year} only has 28 days (not a leap year).`,
        };
      }
      return {
        isValid: false,
        error: `February ${year} has at most ${maxDays} days.`,
      };
    }
    const monthNames = [
      "",
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return {
      isValid: false,
      error: `${monthNames[month]} only has ${maxDays} days.`,
    };
  }

  // Verify against JavaScript Date constructor
  const testDate = new Date(year, month - 1, day);
  if (
    testDate.getFullYear() !== year ||
    testDate.getMonth() !== month - 1 ||
    testDate.getDate() !== day
  ) {
    return { isValid: false, error: "Invalid calendar date." };
  }

  return { isValid: true, error: null };
}
