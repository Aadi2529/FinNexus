import React, { useState, useEffect, useRef, useId } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  formatDisplayDate,
  parseToIsoDate,
  getTodayIso,
} from "../../utils/validation";

const MONTH_NAMES = [
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

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function DatePicker({
  value = "",
  onChange,
  label,
  required = false,
  disabled = false,
  minDate,
  maxDate,
  placeholder = "DD-MM-YYYY",
  error,
  helperText,
  id,
  name,
  className = "",
  containerClassName = "",
  allowClear = true,
}) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Normalize initial value to ISO YYYY-MM-DD
  const currentIso = parseToIsoDate(value);
  const minIso = minDate ? parseToIsoDate(minDate) : null;
  const maxIso = maxDate ? parseToIsoDate(maxDate) : null;

  // View state for month and year inside calendar popup
  const today = new Date();
  const initialDate = currentIso ? new Date(currentIso) : today;
  const [viewYear, setViewYear] = useState(
    isNaN(initialDate.getTime()) ? today.getFullYear() : initialDate.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    isNaN(initialDate.getTime()) ? today.getMonth() : initialDate.getMonth()
  );
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);

  // Sync view state when value changes from outside
  useEffect(() => {
    if (currentIso) {
      const d = new Date(currentIso);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [currentIso]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setIsYearPickerOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation: Close on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (!isOpen) return;
      if (e.key === "Escape") {
        setIsOpen(false);
        setIsYearPickerOpen(false);
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const triggerChange = (isoDate) => {
    if (!onChange) return;
    const syntheticEvent = {
      target: { name: name || inputId, value: isoDate, id: inputId },
      currentTarget: { name: name || inputId, value: isoDate, id: inputId },
      preventDefault: () => {},
      stopPropagation: () => {},
    };
    onChange(syntheticEvent, isoDate);
  };

  const handleSelectDate = (year, month, day) => {
    const yStr = String(year);
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const iso = `${yStr}-${mStr}-${dStr}`;

    if (minIso && iso < minIso) return;
    if (maxIso && iso > maxIso) return;

    triggerChange(iso);
    setIsOpen(false);
    setIsYearPickerOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    triggerChange("");
    setIsOpen(false);
  };

  const handleTodayShortcut = () => {
    const todayIso = getTodayIso();
    if (minIso && todayIso < minIso) return;
    if (maxIso && todayIso > maxIso) return;

    const [y, m, d] = todayIso.split("-");
    setViewYear(parseInt(y, 10));
    setViewMonth(parseInt(m, 10) - 1);
    handleSelectDate(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  };

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Calendar calculations
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const isDateDisabled = (year, month, day) => {
    const yStr = String(year);
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const iso = `${yStr}-${mStr}-${dStr}`;

    if (minIso && iso < minIso) return true;
    if (maxIso && iso > maxIso) return true;
    return false;
  };

  const isDateSelected = (year, month, day) => {
    if (!currentIso) return false;
    const yStr = String(year);
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const iso = `${yStr}-${mStr}-${dStr}`;
    return iso === currentIso;
  };

  const isTodayDate = (year, month, day) => {
    const todayIso = getTodayIso();
    const yStr = String(year);
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const iso = `${yStr}-${mStr}-${dStr}`;
    return iso === todayIso;
  };

  // Year choices range: 1920 to 2045
  const yearOptions = [];
  const startYear = Math.max(1920, minIso ? parseInt(minIso.slice(0, 4), 10) : 1920);
  const endYear = Math.min(2045, maxIso ? parseInt(maxIso.slice(0, 4), 10) : 2045);
  for (let y = endYear; y >= startYear; y--) {
    yearOptions.push(y);
  }

  const displayString = currentIso ? formatDisplayDate(currentIso) : "";

  return (
    <div className={`relative ${containerClassName}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 mb-1"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Input Box */}
      <div
        className="relative cursor-pointer"
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
      >
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <CalendarIcon className="w-4 h-4 text-indigo-500" />
        </div>

        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          readOnly
          disabled={disabled}
          placeholder={placeholder}
          value={displayString}
          className={`w-full pl-9 pr-9 py-2 text-xs rounded-xl border bg-white transition-all cursor-pointer font-medium ${
            disabled
              ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
              : error
              ? "border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-rose-900"
              : "border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 hover:border-slate-300"
          } ${className}`}
        />

        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
          {allowClear && displayString && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Clear date"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Error or Helper */}
      {error ? (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-rose-600 font-medium animate-in fade-in duration-150">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </div>
      ) : helperText ? (
        <p className="mt-1 text-[11px] text-slate-400">{helperText}</p>
      ) : null}

      {/* Calendar Dropdown Popup */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-3.5 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Navigation */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1">
              {/* Month Selector */}
              <select
                value={viewMonth}
                onChange={(e) => {
                  setViewMonth(parseInt(e.target.value, 10));
                  setIsYearPickerOpen(false);
                }}
                className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>

              {/* Year Selector */}
              <select
                value={viewYear}
                onChange={(e) => {
                  setViewYear(parseInt(e.target.value, 10));
                  setIsYearPickerOpen(false);
                }}
                className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Prev / Next Arrows */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAY_LABELS.map((d) => (
              <span
                key={d}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-1"
              >
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Days from previous month */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => {
              const dayNum = daysInPrevMonth - firstDayOfWeek + i + 1;
              return (
                <div
                  key={`prev-${i}`}
                  className="w-8 h-8 flex items-center justify-center text-xs text-slate-300 pointer-events-none"
                >
                  {dayNum}
                </div>
              );
            })}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const disabled = isDateDisabled(viewYear, viewMonth, day);
              const selected = isDateSelected(viewYear, viewMonth, day);
              const isToday = isTodayDate(viewYear, viewMonth, day);

              return (
                <button
                  key={`curr-${day}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSelectDate(viewYear, viewMonth, day)}
                  className={`w-8 h-8 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
                    selected
                      ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30 scale-105"
                      : isToday
                      ? "border border-indigo-500 text-indigo-700 bg-indigo-50/50 font-bold hover:bg-indigo-100/50"
                      : disabled
                      ? "text-slate-300 cursor-not-allowed hover:bg-transparent"
                      : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer Shortcuts */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={handleTodayShortcut}
              className="text-indigo-600 font-bold hover:text-indigo-700 hover:underline px-1 py-0.5"
            >
              Today
            </button>
            {allowClear && displayString && (
              <button
                type="button"
                onClick={handleClear}
                className="text-slate-500 hover:text-slate-700 hover:underline px-1 py-0.5"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-600 font-semibold hover:text-slate-900 px-2 py-0.5 rounded-md hover:bg-slate-100"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
