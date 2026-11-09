import React, { useId } from "react";
import { AlertCircle } from "lucide-react";
import {
  sanitizeIndianMobile,
  sanitizeDigitsOnly,
} from "../../utils/validation";

/**
 * Standardized FinNexus FormInput Component
 * Supports types:
 * - 'mobile' (10 digits numeric, inputmode='numeric', sanitized on change)
 * - 'pin' (6 digits numeric)
 * - 'aadhaar' (12 digits numeric)
 * - 'pan' (10 chars uppercase alphanumeric)
 * - 'gstin' (15 chars uppercase alphanumeric)
 * - 'text', 'email', 'number', 'currency', 'percentage'
 */
export default function FormInput({
  id,
  name,
  label,
  type = "text",
  value = "",
  onChange,
  onBlur,
  required = false,
  disabled = false,
  placeholder,
  error,
  helperText,
  className = "",
  containerClassName = "",
  min,
  max,
  step,
  maxLength,
  icon: Icon,
  prefix,
  suffix,
  autoComplete,
}) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const handleChange = (e) => {
    if (!onChange) return;
    let rawVal = e.target.value;

    if (type === "mobile") {
      rawVal = sanitizeIndianMobile(rawVal);
    } else if (type === "pin") {
      rawVal = sanitizeDigitsOnly(rawVal, 6);
    } else if (type === "aadhaar") {
      rawVal = sanitizeDigitsOnly(rawVal, 12);
    } else if (type === "pan") {
      rawVal = rawVal.toUpperCase().slice(0, 10);
    } else if (type === "gstin") {
      rawVal = rawVal.toUpperCase().slice(0, 15);
    }

    const syntheticEvent = {
      ...e,
      target: { ...e.target, value: rawVal, name: name || inputId },
    };
    onChange(syntheticEvent);
  };

  // Determine actual HTML input type and inputmode
  let htmlType = "text";
  let inputMode = undefined;
  let computedMaxLength = maxLength;

  if (type === "mobile") {
    htmlType = "text";
    inputMode = "numeric";
    computedMaxLength = 10;
  } else if (type === "pin") {
    htmlType = "text";
    inputMode = "numeric";
    computedMaxLength = 6;
  } else if (type === "aadhaar") {
    htmlType = "text";
    inputMode = "numeric";
    computedMaxLength = 12;
  } else if (type === "pan") {
    htmlType = "text";
    computedMaxLength = 10;
  } else if (type === "gstin") {
    htmlType = "text";
    computedMaxLength = 15;
  } else if (type === "email") {
    htmlType = "email";
  } else if (type === "number" || type === "currency" || type === "percentage") {
    htmlType = "number";
    inputMode = "decimal";
  }

  const errorMessage =
    typeof error === "string"
      ? error
      : typeof error === "object" && error !== null
      ? error.error || error.message || ""
      : "";

  return (
    <div className={`relative ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 mb-1"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
        {prefix && !Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-semibold text-xs">
            {prefix}
          </div>
        )}

        <input
          id={inputId}
          name={name}
          type={htmlType}
          inputMode={inputMode}
          value={value ?? ""}
          onChange={handleChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          maxLength={computedMaxLength}
          autoComplete={autoComplete}
          className={`w-full py-2 text-xs rounded-xl border bg-white transition-all font-medium ${
            Icon ? "pl-9" : prefix ? "pl-7" : "px-3"
          } ${suffix ? "pr-8" : "pr-3"} ${
            disabled
              ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
              : errorMessage
              ? "border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-rose-900"
              : "border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 hover:border-slate-300"
          } ${className}`}
        />

        {suffix && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs font-medium">
            {suffix}
          </div>
        )}
      </div>

      {errorMessage ? (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-rose-600 font-medium animate-in fade-in duration-150">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : helperText ? (
        <p className="mt-1 text-[11px] text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
}
