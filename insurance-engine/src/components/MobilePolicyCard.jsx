import React from "react";
import {
  Calendar,
  Clock,
  ExternalLink,
  Edit2,
  RefreshCw,
  CreditCard,
  Users,
  Shield,
  Building2,
  FileText,
  Phone,
  User,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export default function MobilePolicyCard({
  policy,
  onViewDetails,
  onEdit,
  onRenew,
  onAddPayment,
  onOpenNominees,
  onOpenMembers,
  formatCurrency = (val) => `₹${Number(val || 0).toLocaleString("en-IN")}`,
  formatDate = (val) => val || "N/A",
  calculateDaysRemaining,
}) {
  if (!policy) return null;

  const daysLeft = calculateDaysRemaining
    ? calculateDaysRemaining(policy.expiry_date)
    : Math.ceil((new Date(policy.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));

  const isExpired = policy.status === "EXPIRED" || daysLeft < 0;
  const isExpiringSoon = daysLeft >= 0 && daysLeft <= 30;

  // Initials for avatar
  const customerName = policy.customer_name || "Customer";
  const initials = customerName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Category badge color
  const cat = (policy.policy_type || "OTHER").toUpperCase();
  let catBadge = "bg-sky-50 text-sky-700 border-sky-200";
  if (cat === "HEALTH") catBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
  else if (cat === "LIFE") catBadge = "bg-indigo-50 text-indigo-700 border-indigo-200";
  else if (cat === "MOTOR") catBadge = "bg-amber-50 text-amber-700 border-amber-200";

  // Business type badge
  const bType = (policy.business_type || "NEW").toUpperCase();
  let bBadge = "bg-teal-50 text-teal-700 border-teal-200";
  if (bType === "PORT") bBadge = "bg-purple-50 text-purple-700 border-purple-200";
  else if (bType === "RENEW") bBadge = "bg-cyan-50 text-cyan-700 border-cyan-200";

  // Status badge
  const st = (policy.status || "ACTIVE").toUpperCase();
  let stBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (st === "EXPIRED") stBadge = "bg-slate-100 text-slate-600 border-slate-200";
  else if (st === "LAPSED" || st === "CANCELLED") stBadge = "bg-rose-50 text-rose-700 border-rose-200";
  else if (st === "PENDING") stBadge = "bg-amber-50 text-amber-700 border-amber-200";

  const issueYear =
    policy.issue_year ||
    (policy.issue_date ? new Date(policy.issue_date).getFullYear() : null);

  const formatDateDDMMYYYY = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const parts = String(dateStr).split("T")[0].split("-");
      if (parts.length === 3) {
        const [yyyy, mm, dd] = parts;
        return `${dd.padStart(2, "0")}-${mm.padStart(2, "0")}-${yyyy}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col">
      {/* 1. Header Badges Row */}
      <div className="px-4 pt-3.5 pb-2.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded-md font-semibold border ${catBadge}`}>
            {policy.policy_type}
          </span>
          <span className={`px-2 py-0.5 rounded-md font-semibold border ${bBadge}`}>
            {bType}
          </span>
          {issueYear && (
            <span className="px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
              ISSUED {issueYear}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border flex items-center gap-1.5 shadow-2xs ${stBadge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st === "ACTIVE" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            {st}
          </span>
          {isExpiringSoon && (
            <span className="px-2 py-0.5 rounded-md font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {daysLeft === 0 ? "Expiring today" : `${daysLeft}d left`}
            </span>
          )}
        </div>
      </div>

      {/* 2. Main Content Card Body */}
      <div className="p-4 space-y-3.5 flex-1">
        {/* Customer & Policy Identifiers */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs uppercase">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">
              {customerName}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
              <span className="font-mono text-slate-700 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                {policy.policy_number}
              </span>
              {policy.contact_mobile && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {policy.contact_mobile}
                </span>
              )}
            </div>
            {policy.previous_policy_number && (
              <div className="text-[11px] text-slate-400 mt-1 truncate">
                Prev: <span className="font-mono text-slate-600">{policy.previous_policy_number}</span>
              </div>
            )}
          </div>
        </div>

        {/* Insurance Details: Company & Plan */}
        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              Company:
            </span>
            <span className="font-semibold text-slate-800 text-right truncate max-w-[190px]">
              {policy.company_name || "Underwriter Carrier"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              Plan / Variant:
            </span>
            <span className="font-semibold text-slate-800 text-right truncate max-w-[190px]">
              {policy.plan_name || policy.product_variant || "Standard Coverage"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Intermediary / Agent:
            </span>
            <span className="font-medium text-slate-700 text-right truncate max-w-[190px]">
              {policy.sub_agent_name || policy.intermediary_name || "Direct"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              Payment Frequency:
            </span>
            <span className="font-medium text-slate-700">
              {policy.premium_mode || "Yearly"}
            </span>
          </div>
        </div>

        {/* Financials & Coverage Section Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-emerald-50/60 rounded-xl p-2.5 border border-emerald-100">
            <div className="text-[10px] uppercase font-bold text-emerald-800 tracking-wide">
              Sum Insured
            </div>
            <div className="text-sm font-extrabold text-emerald-900 mt-0.5">
              {formatCurrency(policy.sum_assured)}
            </div>
          </div>

          <div className="bg-teal-50/60 rounded-xl p-2.5 border border-teal-100">
            <div className="text-[10px] uppercase font-bold text-teal-800 tracking-wide">
              Gross Premium
            </div>
            <div className="text-sm font-extrabold text-teal-900 mt-0.5">
              {formatCurrency(policy.final_premium)}
            </div>
          </div>
        </div>

        {/* Policy Dates Grid (DD-MM-YYYY) */}
        <div className="grid grid-cols-3 gap-1 px-1 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
          <div>
            <span className="text-slate-400 block text-[9px] uppercase font-bold">Issue Date</span>
            <strong className="text-slate-700 font-mono text-[10px]">{formatDateDDMMYYYY(policy.issue_date || policy.first_receipt_date || policy.created_at)}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px] uppercase font-bold">Start Date</span>
            <strong className="text-slate-700 font-mono text-[10px]">{formatDateDDMMYYYY(policy.policy_start_date)}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px] uppercase font-bold">End Date</span>
            <strong className="text-slate-700 font-mono text-[10px]">{formatDateDDMMYYYY(policy.expiry_date || policy.policy_end_date)}</strong>
          </div>
        </div>
      </div>

      {/* 3. Action Buttons Footer */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
        {/* Renew Policy Button */}
        <button
          onClick={() => onRenew && onRenew(policy)}
          className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          title="Renew Policy Contract"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Renew</span>
        </button>

        {/* Edit Button */}
        <button
          onClick={() => onEdit && onEdit(policy)}
          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          title="Edit Policy Details"
        >
          <Edit2 className="w-3.5 h-3.5 text-slate-500" />
          <span>Edit</span>
        </button>

        {/* View Details / Dossier */}
        <button
          onClick={() => onViewDetails && onViewDetails(policy)}
          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          title="View Complete Policy Dossier & Renewal History"
        >
          <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
          <span>Dossier</span>
        </button>
      </div>
    </div>
  );
}
