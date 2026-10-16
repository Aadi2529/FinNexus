import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Briefcase,
  AlertOctagon,
  Clock,
  CheckCircle,
  Users,
  UserCheck,
  Search,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Filter,
  AlertCircle,
  Eye,
} from "lucide-react";
import { crmAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import KpiCard from "../components/KpiCard";
import StatusBadge from "../components/StatusBadge";
import PriorityChip from "../components/PriorityChip";
import ProgressBar from "../components/ProgressBar";
import OverrideModal from "../components/OverrideModal";
import WorkOrderModal from "../components/WorkOrderModal";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Reusable Work Order Modal State
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);

  // Filter & Search states for Dashboard Table
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [expandedRow, setExpandedRow] = useState(null);

  // Override Modal state
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [pendingOverrideWo, setPendingOverrideWo] = useState(null);

  const loadDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [metricsData, ordersData, catsData] = await Promise.all([
        crmAPI.getDashboard(),
        crmAPI.getWorkOrders({ limit: 10 }),
        crmAPI.getCategories(),
      ]);
      setMetrics(metricsData);
      setWorkOrders(Array.isArray(ordersData) ? ordersData : []);
      setCategories(Array.isArray(catsData) ? catsData : []);
    } catch (err) {
      setError(err?.message || "Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleStatusChange = async (wo, targetStatus) => {
    if (targetStatus === "COMPLETED") {
      const incomplete = (wo.checklist_count || 0) - (wo.checklist_completed || 0);
      if (incomplete > 0) {
        if (!isAdmin) {
          alert(
            "Permission Denied: Only authorized supervisors may use the checklist completion override to complete work orders with pending milestones."
          );
          return;
        }
        setPendingOverrideWo({ wo, targetStatus, incompleteCount: incomplete });
        setOverrideModalOpen(true);
        return;
      }
    }

    try {
      await crmAPI.updateWorkOrderStatus(wo.id, { status: targetStatus });
      loadDashboardData(true);
    } catch (err) {
      alert(err?.message || "Failed to update status.");
    }
  };

  const handleConfirmOverride = async (overrideReason) => {
    if (!pendingOverrideWo) return;
    await crmAPI.updateWorkOrderStatus(pendingOverrideWo.wo.id, {
      status: "COMPLETED",
      override_reason: overrideReason,
    });
    setOverrideModalOpen(false);
    setPendingOverrideWo(null);
    loadDashboardData(true);
  };

  // Filter local rows
  const filteredOrders = workOrders.filter((wo) => {
    if (statusFilter !== "ALL" && wo.status !== statusFilter) return false;
    if (priorityFilter !== "ALL" && wo.priority !== priorityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchOrder = wo.order_number?.toLowerCase().includes(q);
      const matchTitle = wo.title?.toLowerCase().includes(q);
      const matchClient = wo.client_name?.toLowerCase().includes(q);
      if (!matchOrder && !matchTitle && !matchClient) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Work Order & Task Operations
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time executive oversight, active client service queues, and SLA compliance metrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-teal-600" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>

          <button
            onClick={() => setWorkOrderModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Work Order</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadDashboardData(false)}
            className="text-xs font-bold underline hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* 6 Executive KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <KpiCard
          title="Active Workload"
          value={metrics?.active_workload}
          subtitle="Orders in pipeline"
          icon={Briefcase}
          color="teal"
          onClick={() => navigate("/work-orders?status=ACTIVE")}
        />
        <KpiCard
          title="Priority Actions"
          value={metrics?.priority_actions}
          subtitle="Urgent / High SLA"
          icon={AlertOctagon}
          color="amber"
          onClick={() => navigate("/work-orders?priority=URGENT")}
        />
        <KpiCard
          title="Critical Delays"
          value={metrics?.critical_delays}
          subtitle="Overdue deadlines"
          icon={Clock}
          color="rose"
          onClick={() => navigate("/work-orders?status=OVERDUE")}
        />
        <KpiCard
          title="Resolved Today"
          value={metrics?.resolved_today}
          subtitle="Completed milestones"
          icon={CheckCircle}
          color="emerald"
          onClick={() => navigate("/work-orders?status=COMPLETED")}
        />
        <KpiCard
          title="Total Clients"
          value={metrics?.total_clients}
          subtitle="Active KYC profiles"
          icon={Users}
          color="blue"
          onClick={() => navigate("/clients")}
        />
        <KpiCard
          title="Active Team"
          value={metrics?.team_members_active}
          subtitle="Staff available"
          icon={UserCheck}
          color="indigo"
          onClick={() => navigate("/team")}
        />
      </div>

      {/* Middle Section: Category Distribution & Workflow Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Categories Breakdown */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-900 tracking-wide uppercase">
                Work Categories Catalog
              </h2>
              <Link to="/categories" className="text-xs text-teal-600 font-semibold hover:underline">
                Manage
              </Link>
            </div>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Preset workflow categories with attached checklist templates.
            </p>

            <div className="mt-4 space-y-2.5">
              {categories.slice(0, 4).map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => navigate(`/work-orders?category_id=${cat.id}`)}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-teal-50/40 hover:border-teal-200 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-teal-700 truncate">
                      {cat.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {cat.code} &bull; {cat.checklist_template?.length || 0} template steps
                    </span>
                  </div>
                  <PriorityChip priority={cat.default_priority} size="sm" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <Link
              to="/categories"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
            >
              <span>View all operational categories</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Urgent Action Queue Preview */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <h2 className="text-xs font-bold text-slate-900 tracking-wide uppercase">
                  Priority Action Queue
                </h2>
              </div>
              <Link to="/work-orders?priority=URGENT" className="text-xs text-teal-600 font-semibold hover:underline">
                View All
              </Link>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              High-priority orders requiring immediate operational intervention.
            </p>

            <div className="mt-4 divide-y divide-slate-100">
              {workOrders
                .filter((wo) => wo.priority === "URGENT" || wo.priority === "HIGH")
                .slice(0, 3)
                .map((wo) => (
                  <div
                    key={wo.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="pt-0.5">
                        <PriorityChip priority={wo.priority} size="sm" />
                      </div>
                      <div className="min-w-0">
                        <Link
                          to={`/work-orders/${wo.id}`}
                          className="text-xs font-bold text-slate-900 hover:text-teal-600 truncate block"
                        >
                          {wo.order_number}: {wo.title}
                        </Link>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Client: <span className="font-medium text-slate-700">{wo.client_name || "—"}</span> &bull; Assignee:{" "}
                          <span className="font-medium text-slate-700">{wo.assigned_to_name || "Unassigned"}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="w-24">
                        <ProgressBar percent={wo.progress_percent} size="sm" />
                      </div>
                      <StatusBadge status={wo.status} size="sm" />
                      <Link
                        to={`/work-orders/${wo.id}`}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100"
                        title="View Order Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}

              {workOrders.filter((wo) => wo.priority === "URGENT" || wo.priority === "HIGH").length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">
                  Zero high-priority escalations currently pending.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>SLA compliance tracked automatically</span>
            <Link to="/work-orders" className="text-teal-600 font-semibold hover:underline">
              Browse Work Orders Table &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Main Work Orders Overview Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Table Header & Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Recent Work Orders</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live operational tasks with client references and checklist milestones.
            </p>
          </div>

          {/* Table Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter table..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800 w-44"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="REVIEW">In Review</option>
              <option value="COMPLETED">Completed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>

            <Link
              to="/work-orders"
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Full Queue &rarr;
            </Link>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-4 w-10"></th>
                <th className="py-3 px-4">Order / Client</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Assignee</th>
                <th className="py-3 px-4 w-36">Progress</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-600 mb-2" />
                    Loading work orders queue...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                    No work orders found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((wo) => {
                  const isExpanded = expandedRow === wo.id;
                  const isOverdue = wo.is_overdue;

                  return (
                    <React.Fragment key={wo.id}>
                      <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? "bg-slate-50/60" : ""}`}>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setExpandedRow(isExpanded ? null : wo.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700"
                            title={isExpanded ? "Collapse" : "Expand Details"}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <Link
                              to={`/work-orders/${wo.id}`}
                              className="font-bold text-slate-900 hover:text-teal-600 transition-colors text-xs"
                            >
                              {wo.order_number}
                            </Link>
                            <span className="text-slate-600 truncate max-w-xs">{wo.title}</span>
                            <span className="text-[11px] text-slate-400 mt-0.5">
                              Client: <span className="text-slate-700 font-medium">{wo.client_name || "—"}</span>
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] border border-slate-200/60 font-mono">
                            {wo.category_name || "General"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className={`font-mono text-xs ${isOverdue ? "text-rose-600 font-bold" : "text-slate-700"}`}>
                              {new Date(wo.due_date).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(wo.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isOverdue && (
                              <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">
                                OVERDUE
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <PriorityChip priority={wo.priority} size="sm" />
                        </td>

                        <td className="py-3.5 px-4 text-slate-700">
                          {wo.assigned_to_name ? (
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold text-[10px] flex items-center justify-center">
                                {wo.assigned_to_name.charAt(0)}
                              </span>
                              <span>{wo.assigned_to_name}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <ProgressBar percent={wo.progress_percent} size="sm" />
                            <div className="text-[10px] text-slate-400">
                              {wo.checklist_completed} of {wo.checklist_count} milestones
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <select
                            value={wo.status}
                            onChange={(e) => handleStatusChange(wo, e.target.value)}
                            className="text-xs py-1 px-2 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          >
                            <option value="PENDING">Pending</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="REVIEW">In Review</option>
                            <option value="COMPLETED">Completed</option>
                            {isAdmin && <option value="CANCELLED">Cancelled</option>}
                          </select>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              to={`/work-orders/${wo.id}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                              title="View Work Order"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Row Details */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={9} className="py-3 px-6 text-xs text-slate-600 border-b border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <span className="font-bold text-slate-800 block mb-1">Work Description:</span>
                                <p className="text-slate-600 text-xs leading-relaxed">
                                  {wo.description || "No specific narrative provided."}
                                </p>
                              </div>
                              <div>
                                <span className="font-bold text-slate-800 block mb-1">Client Contact:</span>
                                <p className="text-slate-600 text-xs">
                                  Email: <span className="font-medium text-slate-800">{wo.client_email || "—"}</span>
                                </p>
                                <p className="text-slate-600 text-xs">
                                  Phone: <span className="font-medium text-slate-800">{wo.client_phone || "—"}</span>
                                </p>
                              </div>
                              <div>
                                <span className="font-bold text-slate-800 block mb-1">Priority Notes:</span>
                                <p className="text-slate-600 text-xs italic">
                                  {wo.priority_notes || "None specified."}
                                </p>
                                <div className="mt-2">
                                  <Link
                                    to={`/work-orders/${wo.id}`}
                                    className="text-teal-600 font-semibold text-xs hover:underline flex items-center gap-1"
                                  >
                                    <span>Open complete 360 checklist & audit history</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Completion Override Modal */}
      <OverrideModal
        isOpen={overrideModalOpen}
        onClose={() => {
          setOverrideModalOpen(false);
          setPendingOverrideWo(null);
        }}
        onConfirm={handleConfirmOverride}
        workOrder={pendingOverrideWo?.wo}
        incompleteCount={pendingOverrideWo?.incompleteCount || 0}
      />

      {/* Unified Screenshot-Matched Work Order Form Modal */}
      <WorkOrderModal
        isOpen={workOrderModalOpen}
        onClose={() => setWorkOrderModalOpen(false)}
        onSuccess={(created) => {
          loadDashboardData(true);
        }}
      />
    </div>
  );
}
