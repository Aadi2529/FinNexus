/**
 * Exact Calendar Age Calculator for FinNexus Custom Health Quotation Generator.
 * Calculates exact age in (years, months, days) given a Date of Birth and a Reference Date.
 * Handles different month lengths, leap years, Feb 29 birthdays, and end-of-month dates.
 */

export function calculateExactAge(dobStr, refDateStr) {
  if (!dobStr) return { years: 0, months: 0, days: 0, error: "DOB required" };

  const dob = new Date(dobStr + "T00:00:00");
  const ref = refDateStr ? new Date(refDateStr + "T00:00:00") : new Date();

  if (isNaN(dob.getTime())) {
    return { years: 0, months: 0, days: 0, error: "Invalid DOB" };
  }
  if (isNaN(ref.getTime())) {
    return { years: 0, months: 0, days: 0, error: "Invalid Reference Date" };
  }

  if (dob > ref) {
    return { years: 0, months: 0, days: 0, error: "DOB cannot be in the future" };
  }

  const dobYear = dob.getFullYear();
  const dobMonth = dob.getMonth(); // 0-indexed (0 = Jan)
  const dobDate = dob.getDate();

  const refYear = ref.getFullYear();
  const refMonth = ref.getMonth();
  const refDate = ref.getDate();

  // Helper: days in month
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

  const getAnniversary = (year, month, day) => {
    const maxDays = getDaysInMonth(year, month);
    return new Date(year, month, Math.min(day, maxDays));
  };

  let years = refYear - dobYear;
  const thisYearAnniv = getAnniversary(refYear, dobMonth, dobDate);
  if (ref < thisYearAnniv) {
    years -= 1;
  }

  let curYear = dobYear + years;
  let curMonth = dobMonth;
  let months = 0;

  while (true) {
    let nextMonth = curMonth + 1;
    let nextYear = curYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }

    const nextDate = getAnniversary(nextYear, nextMonth, dobDate);
    if (nextDate <= ref) {
      months += 1;
      curYear = nextYear;
      curMonth = nextMonth;
    } else {
      break;
    }
  }

  const lastMilestone = getAnniversary(curYear, curMonth, dobDate);
  const diffTime = ref.getTime() - lastMilestone.getTime();
  const days = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return { years, months, days, error: null };
}

export function formatInr(amount) {
  if (amount === null || amount === undefined || amount === "") return "—";
  const num = Number(amount);
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

export const formatINR = formatInr;

export const STANDARD_DISCLAIMER =
  "THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE";

export const SUM_INSURED_TIERS = [
  500000,
  750000,
  1000000,
  1500000,
  2000000,
  2500000,
  5000000,
  10000000,
  20000000,
];

export const SUM_INSURED_LABELS = {
  500000: "5L",
  750000: "7.5L",
  1000000: "10L",
  1500000: "15L",
  2000000: "20L",
  2500000: "25L",
  5000000: "50L",
  10000000: "1CR",
  20000000: "2CR",
};

export const DEFAULT_COMPANY_PLANS = [
  {
    display_company_name: "HDFC ERGO",
    display_plan_variant: "(with HC)",
    display_name: "HDFC ERGO (with HC)",
  },
  {
    display_company_name: "NIVA BUPA",
    display_plan_variant: "(with HC)",
    display_name: "NIVA BUPA (with HC)",
  },
  {
    display_company_name: "TATA AIG",
    display_plan_variant: "Medicare Select",
    display_name: "TATA AIG (Medicare Select)",
  },
  {
    display_company_name: "TATA AIG",
    display_plan_variant: "Medicare Premier",
    display_name: "TATA AIG (Medicare Premier)",
  },
];

export function formatDateDMY(dateVal) {
  if (!dateVal) return "—";
  const str = String(dateVal).split("T")[0];
  const parts = str.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return str;
}

export function formatDateYMD(dateVal) {
  if (!dateVal) return "";
  if (dateVal instanceof Date) {
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, "0");
    const d = String(dateVal.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(dateVal).split("T")[0];
  return str;
}
