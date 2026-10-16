import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  History,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  User,
  Clock,
  ArrowRight,
  CheckCircle,
  ShieldAlert,
} from "lucide-react";
import { crmAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

const ACTIONS = [
  { id: "ALL", label: "All Actions" },
  { id: "CREATED", label: "Created" },
  { id: "STATUS_CHANGED", label: "Status Transitions" },
  { id: "CHECKLIST_ADDED", label: "Checklist Added" },
  { id: "CHECKLIST_UPDATED", label: "Checklist Completed" },
  { id: "UPDATED", label: "Metadata Updated" },
  { id: "ARCHIVED", label: "Archived" },
];

export default function TaskHistoryPage() {
  const { isAdmin } = useAuth();
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = {};
      if (actionFilter !== "ALL") params.action = actionFilter;
      const data = await crmAPI.getGlobalHistory(params);
      setHistoryEntries(Array.isArray(data) ? data : []);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [actionFilter]);

  const filtered = historyEntries.filter((h) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchActor = h.actor_name?.toLowerCase().includes(q);
      const matchDetails = h.details?.toLowerCase().includes(q);
      const matchAction = h.action?.toLowerCase().includes(q);
      return matchActor || matchDetails || matchAction;
    }
    return true;
  });

  if (!isAdmin) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center max-w-lg mx-auto bg-white rounded-2xl border border-slate-200/90 p-8 shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Compliance Audit Access Restricted</h2>
        <p className="text-xs text-slate-500 mt-2 mb-6 leading-relaxed">
          The global enterprise audit history contains immutable compliance events across all organization operations and is restricted to Administrators. You can view the event history of your permitted work orders directly on each task page.
        </p>
        <Link
          to="/my-tasks"
          className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-xs"
        >
          Go to My Tasks
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Enterprise Task Audit History</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable, append-only operational event logs tracking work orders and task completions.
          </p>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
          <span>Refresh History</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {ACTIONS.map((act) => {
            const isActive = actionFilter === act.id;
            return (
              <button
                key={act.id}
                onClick={() => setActionFilter(act.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                }`}
              >
                {act.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search details, actor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">Event Action</th>
                <th className="py-3.5 px-4">Change Details</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4 text-right">Work Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-xs text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-xs text-slate-400">
                    No historical events recorded matching this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((entry, idx) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400 text-[11px]">
                      {idx + 1}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md font-bold text-[10px] tracking-wide border uppercase bg-slate-100 text-slate-700 border-slate-200 font-mono">
                        {entry.action}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 max-w-md">
                      <p className="text-slate-800 text-xs font-medium leading-relaxed">
                        {entry.details || "Action recorded"}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {entry.actor_name || "Platform Operator"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      <div className="flex flex-col">
                        <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {entry.work_order_id ? (
                        <Link
                          to={`/work-orders/${entry.work_order_id}`}
                          className="text-teal-600 hover:text-teal-700 font-semibold text-xs inline-flex items-center gap-1 hover:underline"
                        >
                          <span>View Order</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            Append-only compliance audit trail
          </span>
          <span className="font-mono text-[11px]">{filtered.length} total event(s)</span>
        </div>
      </div>
    </div>
  );
}
