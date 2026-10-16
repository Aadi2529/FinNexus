import React from "react";
import { Clock, PlayCircle, Eye, CheckCircle2, XCircle, Archive, AlertTriangle } from "lucide-react";

const STATUS_CONFIG = {
  PENDING: {
    label: "Pending",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    icon: Clock,
  },
  IN_PROGRESS: {
    label: "In Progress",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
    icon: PlayCircle,
  },
  REVIEW: {
    label: "In Review",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    dot: "bg-purple-500",
    icon: Eye,
  },
  COMPLETED: {
    label: "Completed",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: "Cancelled",
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    dot: "bg-slate-400",
    icon: XCircle,
  },
  ARCHIVED: {
    label: "Archived",
    bg: "bg-zinc-100",
    text: "text-zinc-600",
    border: "border-zinc-200",
    dot: "bg-zinc-400",
    icon: Archive,
  },
  BLOCKED: {
    label: "Blocked",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
    icon: AlertTriangle,
  },
};

export default function StatusBadge({ status, size = "md", showIcon = true }) {
  const normalized = (status || "PENDING").toUpperCase();
  const config = STATUS_CONFIG[normalized] || STATUS_CONFIG.PENDING;
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-xs font-semibold",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${config.bg} ${config.text} ${config.border} ${sizeClasses[size] || sizeClasses.md}`}
    >
      {showIcon && <Icon className={size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} />}
      {!showIcon && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
      <span>{config.label}</span>
    </span>
  );
}
