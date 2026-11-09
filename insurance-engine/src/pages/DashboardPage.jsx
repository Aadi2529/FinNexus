import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  Users,
  Shield,
  Clock,
  AlertTriangle,
  Calendar,
  Building2,
  FileText,
  Briefcase,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Plus,
  Umbrella,
  Info,
  CheckCircle2,
  DollarSign,
  HeartHandshake,
  CreditCard,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  Upload,
} from "lucide-react";

export default function DashboardPage() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    const res = await api.insurance.getLiveDashboardMetrics();
    if (res.ok) {
      setData(res.data);
    } else {
      setError(res.error || "Failed to load live database metrics.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const pf = data?.portfolio || {};
  const ub = data?.utility_bar || {};

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Utility Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500" />
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">Subscription:</span>
            <span className="font-extrabold text-white">
              {ub.subscription_status || "ENTERPRISE ACTIVE"}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-300">SMS / WhatsApp Engine:</span>
            <span className="font-semibold text-amber-300">
              {ub.sms_whatsapp_status || "Gateway Unconfigured — Alerts Queued"}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-slate-300">Actionable Alerts:</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-black font-mono border border-rose-500/30">
              {ub.active_alerts_count || 0}
            </span>
          </div>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="flex items-center gap-2">
          <Link
            to="/policies"
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Policy</span>
          </Link>
          <Link
            to="/customers"
            className="px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700 hover:border-slate-600 active:scale-95"
          >
            <Users className="w-3.5 h-3.5 text-teal-400" />
            <span>+ Onboard Customer</span>
          </Link>
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700 active:scale-95"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Portfolio Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Customers */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all space-y-3 group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Customers
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black font-mono text-slate-900 tracking-tight">{pf.total_customers || 0}</p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
              <span className="font-semibold text-teal-700">
                {pf.individual_customers || 0} Individual
              </span>
              <span>•</span>
              <span className="font-semibold text-indigo-700">
                {pf.corporate_customers || 0} Corporate
              </span>
            </div>
          </div>
          <Link
            to="/customers"
            className="pt-2 border-t border-slate-100 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
          >
            <span>Customer Directory</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Card 2: Active Policies */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all space-y-3 group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Active Policies
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black font-mono text-slate-900 tracking-tight">{pf.total_active_policies || 0}</p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
              <span className="font-semibold text-amber-700">
                {pf.expiring_policies_30_days || 0} Expiring in 30 Days
              </span>
            </div>
          </div>
          <Link
            to="/policies"
            className="pt-2 border-t border-slate-100 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
          >
            <span>View All Contracts</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Card 3: Pending Premiums */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:border-amber-200 transition-all space-y-3 group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Pending Premiums
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black font-mono text-slate-900 tracking-tight">
              ₹{Number(pf.pending_premiums_amount || 0).toLocaleString("en-IN")}
            </p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">
                {pf.pending_premiums_count || 0} Schedules Outstanding
              </span>
            </div>
          </div>
          <Link
            to="/policies"
            className="pt-2 border-t border-slate-100 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
          >
            <span>Schedule Portal</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Card 4: Net Commission Earnings */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all space-y-3 group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Net Commission
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black font-mono text-emerald-700 tracking-tight">
              ₹{Number(pf.net_commission_earnings || 0).toLocaleString("en-IN")}
            </p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
              <span>Gross: ₹{Number(pf.gross_commission || 0).toLocaleString("en-IN")}</span>
            </div>
          </div>
          <Link
            to="/commissions"
            className="pt-2 border-t border-slate-100 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
          >
            <span>Commission Ledger</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Second Row: Claims Notice & Distribution Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Claims Module Notice Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Claims
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                Pending Module
              </span>
            </div>
            <p className="text-3xl font-black text-slate-400">0</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              {pf.claims_notice ||
                "Claims settlement and adjudication workflow is scheduled for Phase 3."}
            </p>
          </div>
          <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-400">
            Audit status: Non-destructive placeholder
          </div>
        </div>

        {/* Sub-Agent Network Stats */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Partner Network
              </span>
              <Briefcase className="w-4 h-4 text-teal-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black text-slate-900">{pf.total_sub_agents || 0}</p>
              <span className="text-xs text-slate-500">Sub-Agents / POSP</span>
            </div>
            <p className="text-xs text-slate-600">
              Active brokers & POSP partners sourcing business with automated split agreements.
            </p>
          </div>
          <Link
            to="/partners"
            className="pt-3 border-t border-slate-100 text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
          >
            <span>Manage POSP Partners</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Family Group Households */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Family Groupings
              </span>
              <HeartHandshake className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black text-slate-900">{pf.total_family_groups || 0}</p>
              <span className="text-xs text-slate-500">Household Units</span>
            </div>
            <p className="text-xs text-slate-600">
              Aggregated household insurance coverage with primary head designations.
            </p>
          </div>
          <Link
            to="/family-groups"
            className="pt-3 border-t border-slate-100 text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1"
          >
            <span>Household Portfolios</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Tables Row: Upcoming & Overdue Premiums */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Premiums */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Upcoming Premium Dues (30-Day Window)
              </h3>
            </div>
            <Link to="/policies" className="text-[11px] font-semibold text-indigo-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {data?.upcoming_premiums?.length === 0 ? (
              <p className="p-6 text-center text-slate-400">No premiums due in the next 30 days.</p>
            ) : (
              data?.upcoming_premiums?.slice(0, 5).map((up) => (
                <div key={up.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <span className="font-mono font-bold text-slate-900">{up.policy_number}</span>
                    <p className="text-slate-600 font-medium">{up.customer_name}</p>
                    <span className="text-[10px] text-slate-400">Due: {up.due_date}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-700">
                      ₹{Number(up.installment_amount || 0).toLocaleString("en-IN")}
                    </p>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                      {up.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Overdue Premiums */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Overdue Premium Alerts
              </h3>
            </div>
            <Link to="/policies" className="text-[11px] font-semibold text-rose-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {data?.overdue_premiums?.length === 0 ? (
              <p className="p-6 text-center text-slate-400">No overdue premiums. Clean ledger!</p>
            ) : (
              data?.overdue_premiums?.slice(0, 5).map((op) => (
                <div key={op.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <span className="font-mono font-bold text-slate-900">{op.policy_number}</span>
                    <p className="text-slate-600 font-medium">{op.customer_name}</p>
                    <span className="text-[10px] text-rose-600 font-semibold">
                      Overdue since: {op.due_date}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-rose-700">
                      ₹{Number(op.installment_amount || 0).toLocaleString("en-IN")}
                    </p>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      OVERDUE
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Sourcing Sub-Agents Performance */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Top Sourcing POSP Agents
            </h3>
          </div>
          <Link to="/partners" className="text-[11px] font-semibold text-teal-700 hover:underline">
            Partner Network Directory
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {data?.top_agents?.length === 0 ? (
            <p className="col-span-3 text-xs text-slate-400 py-6 text-center">
              No agent sourcing history recorded yet.
            </p>
          ) : (
            data?.top_agents?.slice(0, 3).map((ag) => (
              <div
                key={ag.id}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{ag.full_name}</span>
                  <span className="font-mono text-[10px] text-teal-700 font-semibold">
                    {ag.agent_code}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Policies Sourced:</span>
                  <span className="font-bold text-slate-900">{ag.policies_count || 0}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Commission Earned:</span>
                  <span className="font-bold text-emerald-700">
                    ₹{Number(ag.total_commission_earned || 0).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
