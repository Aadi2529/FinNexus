import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatDobInput,
  validateDob,
  isLeapYear,
  getDaysInMonth,
} from "../src/utils/dateFormatter.js";

describe("DOB Auto-Formatting (formatDobInput)", () => {
  it("formats progressive single digit", () => {
    assert.equal(formatDobInput("2", ""), "2");
  });

  it("appends slash when 2nd digit of day is entered forward", () => {
    assert.equal(formatDobInput("29", "2"), "29/");
  });

  it("formats day plus partial month", () => {
    assert.equal(formatDobInput("29/0", "29/"), "29/0");
  });

  it("appends slash when 2nd digit of month is completed", () => {
    assert.equal(formatDobInput("29/05", "29/0"), "29/05/");
  });

  it("formats partial year digits", () => {
    assert.equal(formatDobInput("29/05/2", "29/05/"), "29/05/2");
    assert.equal(formatDobInput("29/05/20", "29/05/2"), "29/05/20");
    assert.equal(formatDobInput("29/05/200", "29/05/20"), "29/05/200");
  });

  it("completes full 8-digit date", () => {
    assert.equal(formatDobInput("29/05/2004", "29/05/200"), "29/05/2004");
  });

  it("caps maximum input length to 10 characters (8 digits + 2 slashes)", () => {
    assert.equal(formatDobInput("29/05/2004999", "29/05/2004"), "29/05/2004");
  });

  it("handles backspacing without getting stuck at slash", () => {
    // When previous was '29/' and user backspaces slash, it becomes '29', so we pop to '2'
    assert.equal(formatDobInput("29", "29/"), "2");
    // When previous was '29/05/' and user backspaces slash, it becomes '29/05', so we pop to '29/0'
    assert.equal(formatDobInput("29/05", "29/05/"), "29/0");
  });

  it("handles pasting plain 8 digits", () => {
    assert.equal(formatDobInput("29052004", ""), "29/05/2004");
  });

  it("handles pasting already formatted DD/MM/YYYY", () => {
    assert.equal(formatDobInput("29/05/2004", ""), "29/05/2004");
  });

  it("handles pasting ISO formatted YYYY-MM-DD", () => {
    assert.equal(formatDobInput("2004-05-26", ""), "26/05/2004");
  });

  it("strips illegal characters on input", () => {
    assert.equal(formatDobInput("29a/05b/2004c", ""), "29/05/2004");
  });
});

describe("Leap Year and Calendar Calculations", () => {
  it("identifies leap years correctly", () => {
    assert.equal(isLeapYear(2024), true);
    assert.equal(isLeapYear(2020), true);
    assert.equal(isLeapYear(2000), true); // 400 year rule
    assert.equal(isLeapYear(2023), false);
    assert.equal(isLeapYear(1900), false); // 100 year rule
  });

  it("returns correct days in month", () => {
    assert.equal(getDaysInMonth(1, 2024), 31); // Jan
    assert.equal(getDaysInMonth(2, 2024), 29); // Feb in leap year
    assert.equal(getDaysInMonth(2, 2023), 28); // Feb in non-leap year
    assert.equal(getDaysInMonth(4, 2024), 30); // Apr
    assert.equal(getDaysInMonth(6, 2024), 30); // Jun
  });
});

describe("Calendar Date Validation (validateDob)", () => {
  it("validates legitimate calendar dates", () => {
    assert.deepEqual(validateDob("29/05/2004"), { isValid: true, error: null });
    assert.deepEqual(validateDob("15/08/1947"), { isValid: true, error: null });
    assert.deepEqual(validateDob("31/12/1999"), { isValid: true, error: null });
  });

  it("accepts valid leap day 29/02 in leap year", () => {
    assert.deepEqual(validateDob("29/02/2024"), { isValid: true, error: null });
    assert.deepEqual(validateDob("29/02/2000"), { isValid: true, error: null });
  });

  it("rejects 29/02 in non-leap year with clear message", () => {
    const res = validateDob("29/02/2023");
    assert.equal(res.isValid, false);
    assert.match(res.error, /not a leap year/i);
  });

  it("rejects 29/02 in century non-leap year 1900", () => {
    const res = validateDob("29/02/1900");
    assert.equal(res.isValid, false);
    assert.match(res.error, /not a leap year/i);
  });

  it("rejects 30/02 or 31/02 in any year", () => {
    const res = validateDob("30/02/2024");
    assert.equal(res.isValid, false);
    assert.match(res.error, /at most 29 days/i);
  });

  it("rejects 31st on a 30-day month", () => {
    const res = validateDob("31/04/2024");
    assert.equal(res.isValid, false);
    assert.match(res.error, /April only has 30 days/i);
  });

  it("rejects invalid month numbers", () => {
    const res = validateDob("12/13/2000");
    assert.equal(res.isValid, false);
    assert.match(res.error, /Month must be between 01 and 12/i);
  });

  it("rejects empty or incomplete dates", () => {
    assert.equal(validateDob("").isValid, false);
    assert.equal(validateDob("29/05/").isValid, false);
  });

  it("supports ISO formatted date input", () => {
    assert.deepEqual(validateDob("2004-05-29"), { isValid: true, error: null });
  });
});
