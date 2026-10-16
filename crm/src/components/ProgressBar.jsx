import React from "react";

export default function ProgressBar({ percent = 0, size = "md", showLabel = true, color = "teal" }) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));

  const sizeHeights = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  const colorFills = {
    teal: "bg-teal-500",
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
  };

  const getDynamicColor = () => {
    if (clamped === 100) return "bg-emerald-500";
    if (clamped >= 50) return "bg-teal-500";
    if (clamped > 0) return "bg-blue-500";
    return "bg-slate-300";
  };

  const fillColor = color === "dynamic" ? getDynamicColor() : (colorFills[color] || colorFills.teal);

  return (
    <div className="w-full flex items-center gap-2.5">
      <div className={`flex-1 bg-slate-100 rounded-full overflow-hidden ${sizeHeights[size] || sizeHeights.md} border border-slate-200/60`}>
        <div
          className={`${fillColor} h-full rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-[11px] font-semibold text-slate-700 font-mono min-w-[32px] text-right">
          {clamped}%
        </span>
      )}
    </div>
  );
}
