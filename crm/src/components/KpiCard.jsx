import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "teal",
  onClick,
  active = false,
}) {
  const colorMap = {
    teal: {
      iconBg: "bg-teal-50 text-teal-600 border-teal-200",
      accent: "border-teal-500",
      activeRing: "ring-2 ring-teal-500/20 border-teal-500",
    },
    rose: {
      iconBg: "bg-rose-50 text-rose-600 border-rose-200",
      accent: "border-rose-500",
      activeRing: "ring-2 ring-rose-500/20 border-rose-500",
    },
    amber: {
      iconBg: "bg-amber-50 text-amber-600 border-amber-200",
      accent: "border-amber-500",
      activeRing: "ring-2 ring-amber-500/20 border-amber-500",
    },
    emerald: {
      iconBg: "bg-emerald-50 text-emerald-600 border-emerald-200",
      accent: "border-emerald-500",
      activeRing: "ring-2 ring-emerald-500/20 border-emerald-500",
    },
    blue: {
      iconBg: "bg-blue-50 text-blue-600 border-blue-200",
      accent: "border-blue-500",
      activeRing: "ring-2 ring-blue-500/20 border-blue-500",
    },
    indigo: {
      iconBg: "bg-indigo-50 text-indigo-600 border-indigo-200",
      accent: "border-indigo-500",
      activeRing: "ring-2 ring-indigo-500/20 border-indigo-500",
    },
  };

  const scheme = colorMap[color] || colorMap.teal;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border p-5 shadow-xs transition-all duration-200 flex flex-col justify-between ${
        onClick ? "cursor-pointer hover:shadow-md hover:border-slate-300" : ""
      } ${active ? scheme.activeRing : "border-slate-200/90"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
            {title}
          </span>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono tracking-tight">
            {value !== undefined && value !== null ? value : "—"}
          </div>
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${scheme.iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {subtitle && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>{subtitle}</span>
          {onClick && <span className="text-teal-600 font-medium text-[11px] hover:underline">View &rarr;</span>}
        </div>
      )}
    </div>
  );
}
