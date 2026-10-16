import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Eye,
  Edit2,
  Trash2,
  AlertCircle,
  Clock,
  ArrowUpDown,
  CheckCircle2,
  Layers,
  User,
  Bell,
  Calendar,
} from "lucide-react";
import { crmAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import PriorityChip from "../components/PriorityChip";
import ProgressBar from "../components/ProgressBar";
import OverrideModal from "../components/OverrideModal";
import WorkOrderModal from "../components/WorkOrderModal";

const TABS = [
  { id: "ALL", label: "All Orders" },
  { id: "ACTIVE", label: "Active Pipeline" },
  { id: "URGENT", label: "Urgent Actions" },
  { id: "REVIEW", label: "Pending Review" },
  { id: "COMPLETED", label: "Completed" },
  { id: "OVERDUE", label: "Overdue" },
];

export default function WorkOrdersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, isEmployee, isSuperAdmin } = useAuth();

  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reusable Work Order Modal State
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);

  // Filters
  const activeTab = searchParams.get("tab") || "ALL";
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category_id") || "ALL");
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get("priority") || "ALL");
  const [assigneeFilter, setAssigneeFilter] = useState(searchParams.get("assigned_to_id") || "ALL");
  const [sortBy, setSortBy] = useState("created_desc");

  // Expanded row tracking
  const [expandedRow, setExpandedRow] = useState(null);
  const [updatingItemIds, setUpdatingItemIds] = useState({});

  // Override Guard Modal
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [pendingOverride, setPendingOverride] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (categoryFilter !== "ALL") params.category_id = categoryFilter;
      if (priorityFilter !== "ALL") params.priority = priorityFilter;
      if (assigneeFilter !== "ALL") params.assigned_to_id = assigneeFilter;

      if (activeTab === "ACTIVE") params.status = "ACTIVE";
      else if (activeTab === "OVERDUE") params.status = "OVERDUE";
      else if (activeTab === "URGENT") params.priority = "URGENT";
      else if (activeTab === "REVIEW") params.status = "REVIEW";
      else if (activeTab === "COMPLETED") params.status = "COMPLETED";

      const [ordersData, catsData, teamData] = await Promise.all([
        crmAPI.getWorkOrders(params),
        crmAPI.getCategories(),
        crmAPI.getTeam(),
      ]);

      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setCategories(Array.isArray(catsData) ? catsData : []);
      setTeam(Array.isArray(teamData) ? teamData : []);
    } catch (err) {
      setError(err?.message || "Failed to load work orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeTab, categoryFilter, priorityFilter, assigneeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  const handleTabChange = (tabId) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tabId);
    setSearchParams(nextParams);
  };

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
        setPendingOverride({ wo, targetStatus, incompleteCount: incomplete });
        setOverrideModalOpen(true);
        return;
      }
    }

    try {
      await crmAPI.updateWorkOrderStatus(wo.id, { status: targetStatus });
      fetchOrders();
    } catch (err) {
      alert(err?.message || "Status transition failed.");
    }
  };

  const handleConfirmOverride = async (overrideReason) => {
    if (!pendingOverride) return;
    await crmAPI.updateWorkOrderStatus(pendingOverride.wo.id, {
      status: "COMPLETED",
      override_reason: overrideReason,
    });
    setOverrideModalOpen(false);
    setPendingOverride(null);
    fetchOrders();
  };

  const handleToggleExpand = async (woId) => {
    if (expandedRow === woId) {
      setExpandedRow(null);
      return;
    }
    setExpandedRow(woId);
    const target = orders.find((o) => o.id === woId);
    if (target && (!target.checklist_items || target.checklist_items.length === 0)) {
      try {
        const detail = await crmAPI.getWorkOrder(woId);
        if (detail && Array.isArray(detail.checklist_items) && detail.checklist_items.length > 0) {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === woId
                ? {
                    ...o,
                    checklist_items: detail.checklist_items,
                    checklist_count: detail.checklist_count,
                    checklist_completed: detail.checklist_completed,
                    progress_percent: detail.progress_percent,
                  }
                : o
            )
          );
        }
      } catch (_) {
        // Fallback to existing summary data
      }
    }
  };

  const handleToggleChecklistItem = async (workOrderId, item) => {
    if (updatingItemIds[item.id]) return;
    const nextCompleted = !(item.is_completed || item.status === "COMPLETED");
    const nextStatus = nextCompleted ? "COMPLETED" : "PENDING";

    setUpdatingItemIds((prev) => ({ ...prev, [item.id]: true }));

    try {
      const updatedItem = await crmAPI.updateChecklistItem(workOrderId, item.id, {
        is_completed: nextCompleted,
      });

      setOrders((prevOrders) =>
        prevOrders.map((wo) => {
          if (wo.id !== workOrderId) return wo;
          const updatedItems = (wo.checklist_items || []).map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  ...updatedItem,
                  is_completed: nextCompleted,
                  status: nextStatus,
                }
              : it
          );
          const completedCount = updatedItems.filter(
            (it) => it.status === "COMPLETED" || it.is_completed
          ).length;
          const totalCount = updatedItems.length;
          const progressPercent =
            totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          return {
            ...wo,
            checklist_items: updatedItems,
            checklist_completed: completedCount,
            checklist_count: totalCount,
            progress_percent: progressPercent,
          };
        })
      );
    } catch (err) {
      alert(err?.message || "Failed to update task completion state.");
    } finally {
      setUpdatingItemIds((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  const handleDelete = async (wo) => {
    const confirmMessage = isSuperAdmin
      ? `Permanently delete Work Order ${wo.order_number}?\n\nPress OK to delete permanently from the database, or Cancel to abort.`
      : `Are you sure you want to archive Work Order ${wo.order_number}?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }
    try {
      await crmAPI.deleteWorkOrder(wo.id, isSuperAdmin);
      fetchOrders();
    } catch (err) {
      alert(err?.message || "Failed to remove work order.");
    }
  };

  // Safe client-side CSV export
  const exportToCSV = () => {
    if (orders.length === 0) return;
    const headers = [
      "Order Number",
      "Title",
      "Client",
      "Client Email",
      "Category",
      "Priority",
      "Status",
      "Progress %",
      "Due Date",
      "Assignee",
    ];
    const rows = orders.map((o) => [
      `"${o.order_number}"`,
      `"${o.title.replace(/"/g, '""')}"`,
      `"${(o.client_name || "").replace(/"/g, '""')}"`,
      `"${o.client_email || ""}"`,
      `"${o.category_name || ""}"`,
      `"${o.priority}"`,
      `"${o.status}"`,
      `"${o.progress_percent}%"`,
      `"${new Date(o.due_date).toLocaleDateString()}"`,
      `"${o.assigned_to_name || "Unassigned"}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `FinNexus_WorkOrders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sort orders locally if needed
  const sortedOrders = [...orders].sort((a, b) => {
    if (sortBy === "due_asc") return new Date(a.due_date) - new Date(b.due_date);
    if (sortBy === "due_desc") return new Date(b.due_date) - new Date(a.due_date);
    if (sortBy === "priority") {
      const pOrder = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
      return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Work Orders Queue</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational service delivery requests, milestone tracking, and task delegation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportToCSV}
            disabled={orders.length === 0}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Export to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setWorkOrderModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Work Order</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200/90 overflow-x-auto scrollbar-none pb-px">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-px flex items-center gap-2 ${
                isActive
                  ? "border-teal-600 text-teal-700 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by order number, title, client name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Sort Dropdown */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="created_desc">Newest Created</option>
              <option value="due_asc">Earliest Due Date</option>
              <option value="due_desc">Latest Due Date</option>
              <option value="priority">Priority (Highest first)</option>
            </select>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchOrders} className="text-xs font-bold underline">
            Retry
          </button>
        </div>
      )}

      {/* Orders Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
              <tr>
                <th className="py-3.5 px-4 w-10"></th>
                <th className="py-3.5 px-4">Order / Reference</th>
                <th className="py-3.5 px-4">Client</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Deadline</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Assignee</th>
                <th className="py-3.5 px-4 w-36">Progress</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-xs text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
                    Loading work orders...
                  </td>
                </tr>
              ) : sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-xs text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No work orders found in this queue.
                  </td>
                </tr>
              ) : (
                sortedOrders.map((wo) => {
                  const isExpanded = expandedRow === wo.id;
                  const isOverdue = wo.is_overdue;

                  return (
                    <React.Fragment key={wo.id}>
                      <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? "bg-slate-50/60" : ""}`}>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleToggleExpand(wo.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700"
                            title={isExpanded ? "Collapse Pipeline" : "Expand Pipeline"}
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <Link
                              to={`/work-orders/${wo.id}`}
                              className="font-bold text-slate-900 hover:text-teal-600 transition-colors"
                            >
                              {wo.order_number}
                            </Link>
                            <span className="text-slate-600 truncate max-w-xs">{wo.title}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-800">
                          <div className="flex flex-col">
                            <span className="font-semibold">{wo.client_name || "—"}</span>
                            <span className="text-[10px] text-slate-400">{wo.client_email}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
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
                          <div className="flex flex-col gap-0.5">
                            <PriorityChip priority={wo.priority} size="sm" label={wo.work_priority || undefined} />
                            {wo.custom_priority && (
                              <span className="text-[10px] text-slate-500 italic truncate max-w-[130px]" title={wo.custom_priority}>
                                &ldquo;{wo.custom_priority}&rdquo;
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-700">
                          {wo.assigned_to_name ? (
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold text-[10px] flex items-center justify-center">
                                {wo.assigned_to_name.charAt(0)}
                              </span>
                              <span className="truncate max-w-[110px]">{wo.assigned_to_name}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <ProgressBar percent={wo.progress_percent} size="sm" />
                            <div className="text-[10px] text-slate-400">
                              {wo.checklist_completed} of {wo.checklist_count} completed
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
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/work-orders/${wo.id}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                              title="360 Detail View"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            {isAdmin && (
                              <>
                                <Link
                                  to={`/work-orders/${wo.id}/edit`}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                                  title="Edit Attributes"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Link>
                                <button
                                  onClick={() => handleDelete(wo)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                  title="Archive Work Order"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Task Pipeline Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={10} className="p-0">
                            <div className="p-4 sm:p-6 space-y-4">
                              {/* Work Order Top Info Strip */}
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs text-xs">
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                    Client & Contact
                                  </span>
                                  <div className="font-semibold text-slate-900">{wo.client_name || "—"}</div>
                                  <div className="text-slate-500 text-[11px] truncate">
                                    {wo.client_email || "No email"} • {wo.client_phone || "No phone"}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                    Schedule & Deadline
                                  </span>
                                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-teal-600" />
                                    <span>
                                      {new Date(wo.due_date).toLocaleDateString(undefined, {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })}
                                    </span>
                                  </div>
                                  <div className="text-slate-500 text-[11px] font-mono">
                                    {new Date(wo.due_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    {wo.is_overdue && (
                                      <span className="ml-1.5 text-rose-600 font-bold uppercase">Overdue</span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                    Work Priority
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <PriorityChip priority={wo.priority} size="sm" label={wo.work_priority || undefined} />
                                  </div>
                                  {wo.custom_priority && (
                                    <div className="text-slate-600 text-[11px] italic mt-0.5 truncate" title={wo.custom_priority}>
                                      &ldquo;{wo.custom_priority}&rdquo;
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                    Reminder Recipients
                                  </span>
                                  {Array.isArray(wo.reminder_recipients) && wo.reminder_recipients.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                      {wo.reminder_recipients.map((rec) => (
                                        <span
                                          key={rec.id}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200/80 text-[10px] font-medium"
                                        >
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                          <span>{rec.full_name}</span>
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-[11px] italic">No specific reminder recipients</span>
                                  )}
                                </div>
                              </div>

                              {/* Task Pipeline Card */}
                              <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                                {/* Category / Pipeline Group Header */}
                                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                                      <Layers className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-900">
                                          {wo.category_name || "General Service Pipeline"}
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                          Group: {wo.category_name || "Standard"}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-slate-500">
                                        Step-by-step checklist milestones and operational delivery tasks.
                                      </p>
                                    </div>
                                  </div>

                                  {/* Pipeline Completion Progress Bar & Metric */}
                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <span className="text-xs font-bold text-slate-900">
                                        {wo.checklist_completed || 0} / {wo.checklist_count || 0}
                                      </span>
                                      <span className="text-[10px] text-slate-500 ml-1">tasks completed</span>
                                    </div>
                                    <div className="w-28 sm:w-36">
                                      <ProgressBar percent={wo.progress_percent || 0} size="sm" />
                                    </div>
                                    <span className="text-xs font-bold text-teal-700 min-w-[36px] text-right font-mono">
                                      {wo.progress_percent || 0}%
                                    </span>
                                  </div>
                                </div>

                                {/* Individual Checklist Tasks Hierarchy */}
                                <div className="p-4">
                                  {(!wo.checklist_items || wo.checklist_items.length === 0) ? (
                                    <div className="text-center py-8 px-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 text-slate-500 text-xs">
                                      <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                                      <p className="font-medium text-slate-700">No pipeline tasks configured for this work order.</p>
                                      <p className="text-[11px] text-slate-400 mt-0.5">
                                        Tasks can be added or seeded from the category checklist template.
                                      </p>
                                      <Link
                                        to={`/work-orders/${wo.id}`}
                                        className="mt-2.5 inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 font-semibold text-xs"
                                      >
                                        Configure Tasks in Detail View &rarr;
                                      </Link>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      {wo.checklist_items.map((item, idx) => {
                                        const isCompleted = item.is_completed || item.status === "COMPLETED";
                                        const isUpdating = !!updatingItemIds[item.id];

                                        return (
                                          <div
                                            key={item.id}
                                            className={`flex items-start sm:items-center justify-between gap-3 p-3 rounded-lg border transition-all ${
                                              isCompleted
                                                ? "bg-emerald-50/40 border-emerald-200/70 text-slate-600"
                                                : "bg-white border-slate-200 hover:border-slate-300 text-slate-800 shadow-2xs"
                                            }`}
                                          >
                                            <div className="flex items-start sm:items-center gap-3 min-w-0">
                                              {/* Checkbox */}
                                              <button
                                                type="button"
                                                disabled={isUpdating}
                                                onClick={() => handleToggleChecklistItem(wo.id, item)}
                                                className={`mt-0.5 sm:mt-0 w-5 h-5 rounded flex items-center justify-center transition-all ${
                                                  isCompleted
                                                    ? "bg-emerald-600 text-white border border-emerald-600"
                                                    : "border-2 border-slate-300 hover:border-teal-500 bg-white"
                                                } ${isUpdating ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
                                                title={isCompleted ? "Mark Incomplete" : "Mark Completed"}
                                              >
                                                {isUpdating ? (
                                                  <RefreshCw className="w-3 h-3 animate-spin text-teal-600" />
                                                ) : isCompleted ? (
                                                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                                                ) : null}
                                              </button>

                                              <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <span className="text-[11px] font-mono text-slate-400">#{idx + 1}</span>
                                                  <span
                                                    className={`text-xs font-semibold ${
                                                      isCompleted
                                                        ? "line-through text-slate-500 font-normal"
                                                        : "text-slate-900"
                                                    }`}
                                                  >
                                                    {item.title}
                                                  </span>
                                                  {isCompleted && (
                                                    <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-medium font-mono">
                                                      Completed
                                                    </span>
                                                  )}
                                                </div>
                                                {item.description && (
                                                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                                    {item.description}
                                                  </p>
                                                )}
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                              {item.assigned_to_name && (
                                                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                                  <User className="w-3 h-3 text-slate-400" />
                                                  <span>{item.assigned_to_name}</span>
                                                </span>
                                              )}
                                              {item.due_date && (
                                                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                                                  <Clock className="w-3 h-3 text-slate-400" />
                                                  <span>{new Date(item.due_date).toLocaleDateString()}</span>
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* Footer with link to full 360 detail */}
                                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                                  <span className="text-[11px] text-slate-500">
                                    Interactive task checklist automatically recalculates progress and syncs with work order timeline.
                                  </span>
                                  <Link
                                    to={`/work-orders/${wo.id}`}
                                    className="text-teal-600 hover:text-teal-700 font-semibold text-xs hover:underline flex items-center gap-1 shrink-0"
                                  >
                                    <span>Full Work Order 360 &rarr;</span>
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

        {/* Table Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {sortedOrders.length} order(s)</span>
          <span className="font-mono text-[11px]">Updated live from PostgreSQL</span>
        </div>
      </div>

      {/* Completion Override Modal */}
      <OverrideModal
        isOpen={overrideModalOpen}
        onClose={() => {
          setOverrideModalOpen(false);
          setPendingOverride(null);
        }}
        onConfirm={handleConfirmOverride}
        workOrder={pendingOverride?.wo}
        incompleteCount={pendingOverride?.incompleteCount || 0}
      />

      {/* Unified Screenshot-Matched Work Order Form Modal */}
      <WorkOrderModal
        isOpen={workOrderModalOpen}
        onClose={() => setWorkOrderModalOpen(false)}
        onSuccess={(created) => {
          fetchOrders();
        }}
      />
    </div>
  );
}
