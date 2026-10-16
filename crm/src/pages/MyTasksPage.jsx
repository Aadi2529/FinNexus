import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlayCircle,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { crmAPI } from "../services/api";
import StatusBadge from "../components/StatusBadge";
import PriorityChip from "../components/PriorityChip";
import ProgressBar from "../components/ProgressBar";

export default function MyTasksPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailedOrders, setDetailedOrders] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});

  const fetchMyOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await crmAPI.getWorkOrders({ my_tasks: true });
      const list = Array.isArray(data) ? data : [];
      setOrders(list);

      // Pre-fetch details for the top 3 active orders
      const topOrders = list.slice(0, 3);
      for (const o of topOrders) {
        fetchOrderDetail(o.id);
      }
    } catch (err) {
      setError(err?.message || "Failed to load assigned tasks.");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetail = async (woId) => {
    if (detailedOrders[woId]) return;
    setLoadingDetails((prev) => ({ ...prev, [woId]: true }));
    try {
      const detail = await crmAPI.getWorkOrder(woId);
      setDetailedOrders((prev) => ({ ...prev, [woId]: detail }));
    } catch {
      // Ignored
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [woId]: false }));
    }
  };

  useEffect(() => {
    fetchMyOrders();
  }, []);

  const handleToggleChecklist = async (woId, item) => {
    const newStatus = item.status === "COMPLETED" ? "PENDING" : "COMPLETED";
    try {
      await crmAPI.updateChecklistItem(woId, item.id, { status: newStatus });
      // Refresh this work order detail
      const updatedDetail = await crmAPI.getWorkOrder(woId);
      setDetailedOrders((prev) => ({ ...prev, [woId]: updatedDetail }));
      // Also update progress in summary list
      setOrders((prev) =>
        prev.map((o) => (o.id === woId ? { ...o, progress_percent: updatedDetail.progress_percent } : o))
      );
    } catch (err) {
      alert(err?.message || "Failed to toggle milestone.");
    }
  };

  // Metrics
  const activeCount = orders.filter((o) => o.status === "PENDING" || o.status === "IN_PROGRESS" || o.status === "REVIEW").length;
  const overdueCount = orders.filter((o) => o.is_overdue).length;
  const completedCount = orders.filter((o) => o.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">My Assigned Workload</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Your personal operations queue and milestone completion checklist.
          </p>
        </div>

        <button
          onClick={fetchMyOrders}
          disabled={loading}
          className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <PlayCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Active Orders</span>
            <div className="text-xl font-bold text-slate-900 font-mono">{activeCount}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Overdue Alerts</span>
            <div className="text-xl font-bold text-slate-900 font-mono">{overdueCount}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Resolved Orders</span>
            <div className="text-xl font-bold text-slate-900 font-mono">{completedCount}</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchMyOrders} className="underline font-bold">
            Retry
          </button>
        </div>
      )}

      {/* Work Orders with Checklist Expanders */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
            Loading assigned tasks...
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="font-bold text-slate-700 text-sm">All caught up!</p>
            <p className="text-slate-500 mt-1">You currently have no pending tasks assigned.</p>
          </div>
        ) : (
          orders.map((wo) => {
            const detail = detailedOrders[wo.id];
            const hasDetail = !!detail;
            const items = detail?.checklist_items || [];

            return (
              <div
                key={wo.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all duration-200 hover:border-slate-300"
              >
                {/* Order Summary Bar */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="pt-0.5">
                      <PriorityChip priority={wo.priority} size="sm" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          {wo.order_number}
                        </span>
                        <Link
                          to={`/work-orders/${wo.id}`}
                          className="font-bold text-sm text-slate-900 hover:text-teal-600 transition-colors"
                        >
                          {wo.title}
                        </Link>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Client: <span className="font-medium text-slate-800">{wo.client_name || "—"}</span> &bull; Category:{" "}
                        <span className="font-mono text-slate-700">{wo.category_name || "General"}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right Status & Actions */}
                  <div className="flex items-center gap-4 shrink-0 self-end md:self-center">
                    <div className="w-32">
                      <ProgressBar percent={wo.progress_percent} size="sm" />
                    </div>
                    <div className="flex flex-col items-end">
                      <StatusBadge status={wo.status} size="sm" />
                      <span className={`text-[10px] mt-1 font-mono flex items-center gap-1 ${wo.is_overdue ? "text-rose-600 font-bold" : "text-slate-400"}`}>
                        <Calendar className="w-3 h-3" />
                        {new Date(wo.due_date).toLocaleDateString()}
                      </span>
                    </div>

                    <button
                      onClick={() => fetchOrderDetail(wo.id)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200"
                    >
                      {hasDetail ? "Refresh Milestones" : "Show Milestones"}
                    </button>

                    <Link
                      to={`/work-orders/${wo.id}`}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                      title="Open 360 View"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Interactive Checklist Milestones Drawer */}
                {hasDetail && (
                  <div className="px-5 pb-5 pt-2 bg-slate-50/50 border-t border-slate-100">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                      Checklist Pipeline ({items.filter((i) => i.status === "COMPLETED").length} of {items.length} Completed)
                    </div>

                    <div className="space-y-2">
                      {items.map((item) => {
                        const isDone = item.status === "COMPLETED";
                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border transition-all duration-150 flex items-start justify-between gap-3 ${
                              isDone
                                ? "bg-emerald-50/40 border-emerald-200/80"
                                : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                            }`}
                          >
                            <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() => handleToggleChecklist(wo.id, item)}
                                className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                              />
                              <div className="flex-1 min-w-0">
                                <span className={`text-xs block ${isDone ? "line-through text-slate-400 font-normal" : "font-semibold text-slate-800"}`}>
                                  {item.title}
                                </span>
                                {item.description && (
                                  <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>
                                )}
                                {item.notes && (
                                  <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-600 italic bg-white/80 px-2 py-0.5 rounded border border-slate-200/60 inline-flex">
                                    <MessageSquare className="w-3 h-3 text-slate-400" />
                                    <span>{item.notes}</span>
                                  </div>
                                )}
                              </div>
                            </label>

                            <div className="flex items-center gap-2 shrink-0">
                              <StatusBadge status={item.status} size="sm" showIcon={false} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
