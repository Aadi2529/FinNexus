import React from "react";
import { Flame, AlertCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";

const PRIORITY_CONFIG = {
  URGENT: {
    label: "Urgent",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    icon: Flame,
    iconColor: "text-rose-600",
  },
  HIGH: {
    label: "High",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    icon: AlertCircle,
    iconColor: "text-orange-600",
  },
  NORMAL: {
    label: "Normal",
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    icon: ArrowUpRight,
    iconColor: "text-sky-600",
  },
  LOW: {
    label: "Low",
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    icon: ArrowDownRight,
    iconColor: "text-slate-400",
  },
};

export default function PriorityChip({ priority, label, size = "md" }) {
  const normalized = (priority || "NORMAL").toUpperCase();
  const config = PRIORITY_CONFIG[normalized] || PRIORITY_CONFIG.NORMAL;
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-0.5 text-xs",
    lg: "px-2.5 py-1 text-xs font-semibold",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium border ${config.bg} ${config.text} ${config.border} ${sizeClasses[size] || sizeClasses.md}`}
    >
      <Icon className={`${size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} ${config.iconColor}`} />
      <span>{label || config.label}</span>
    </span>
  );
}
