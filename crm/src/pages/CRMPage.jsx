import React, { useState, useEffect } from "react";
import api, { crmAPI } from "../services/api";
import {
  Users,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  X,
  CreditCard,
  Briefcase,
  TrendingUp,
  MessageSquare,
  CheckSquare,
  Square,
  Loader2,
  ChevronRight,
  ShieldAlert,
  Trash2,
} from "lucide-react";

const PIPELINE_STATUSES = [
  "ALL",
  "NEW_LEAD",
  "CONTACTED",
  "DOCUMENTATION",
  "UNDERWRITING",
  "APPROVED",
  "REJECTED",
];

export default function CRMPage() {
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Drawer / Modal states
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Forms
  const [newNoteContent, setNewNoteContent] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("MEDIUM");
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  // Create Customer Form State
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    pan_number: "",
    pipeline_status: "NEW_LEAD",
    employment_type: "SALARIED",
    monthly_income: "85000",
    monthly_obligations: "20000",
    cibil_score: "750",
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, custData] = await Promise.all([
        crmAPI.getStats(),
        crmAPI.getCustomers({
          q: searchQuery,
          pipeline_status: selectedStatus === "ALL" ? undefined : selectedStatus,
        }),
      ]);
      setStats(statsData);
      setCustomers(Array.isArray(custData) ? custData : (custData?.items || []));
    } catch (err) {
      console.error("Failed to load CRM data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const openCustomerDrawer = async (customerId) => {
    setDrawerLoading(true);
    setSelectedCustomer(null);
    try {
      const data = await crmAPI.getCustomer(customerId);
      setSelectedCustomer(data);
    } catch (err) {
      console.error("Failed to fetch customer detail:", err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !selectedCustomer) return;

    setNoteSubmitting(true);
    try {
      await crmAPI.addNote(selectedCustomer.id, newNoteContent.trim());
      setNewNoteContent("");
      const refreshed = await crmAPI.getCustomer(selectedCustomer.id);
      setSelectedCustomer(refreshed);
    } catch (err) {
      alert(err.message || "Failed to add note.");
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskDue || !selectedCustomer) return;

    setTaskSubmitting(true);
    try {
      await crmAPI.addTask(selectedCustomer.id, {
        title: newTaskTitle.trim(),
        due_date: newTaskDue,
        priority: newTaskPriority,
      });
      setNewTaskTitle("");
      setNewTaskDue("");
      const refreshed = await crmAPI.getCustomer(selectedCustomer.id);
      setSelectedCustomer(refreshed);
    } catch (err) {
      alert(err.message || "Failed to add task.");
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleToggleTaskStatus = async (taskId, currentStatus) => {
    const newStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED";
    try {
      await crmAPI.updateTaskStatus(taskId, newStatus);
      if (selectedCustomer) {
        const refreshed = await crmAPI.getCustomer(selectedCustomer.id);
        setSelectedCustomer(refreshed);
      }
    } catch (err) {
      alert(err.message || "Failed to toggle task status.");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this follow-up task?")) return;
    try {
      await crmAPI.deleteTask(taskId);
      if (selectedCustomer) {
        const refreshed = await crmAPI.getCustomer(selectedCustomer.id);
        setSelectedCustomer(refreshed);
      }
    } catch (err) {
      alert(err.message || "Failed to delete task.");
    }
  };

  const handleCreateCustomerSubmit = async (e) => {
    e.preventDefault();
    setCreateError("");
    setCreateSubmitting(true);

    const payload = {
      ...formData,
      monthly_income: parseFloat(formData.monthly_income),
      monthly_obligations: parseFloat(formData.monthly_obligations),
      cibil_score: parseInt(formData.cibil_score, 10),
    };

    try {
      await crmAPI.createCustomer(payload);
      setCreateModalOpen(false);
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        pan_number: "",
        pipeline_status: "NEW_LEAD",
        employment_type: "SALARIED",
        monthly_income: "85000",
        monthly_obligations: "20000",
        cibil_score: "750",
      });
      loadData();
    } catch (err) {
      setCreateError(err.message || "Failed to create customer.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "APPROVED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "UNDERWRITING":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "DOCUMENTATION":
        return "bg-teal-50 text-teal-700 border-teal-200";
      case "CONTACTED":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "NEW_LEAD":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Module 01 • Operations
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            FinNexus CRM
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Customer 360 profiles, bureau credit scoring, pipeline lead statuses, and SLA tasks.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Customer Profile</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Total Customers
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {stats?.total_customers ?? "—"}
          </span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Active Leads
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {stats?.active_leads ?? "—"}
          </span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Average CIBIL Score
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {stats?.average_cibil ?? "—"}
          </span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Follow-up Tasks
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {stats?.pending_tasks ?? "—"}
          </span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="w-full md:w-80 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or PAN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs text-slate-900"
          />
        </form>

        <div className="w-full md:w-auto flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-500 font-medium shrink-0">Status:</span>
          {PIPELINE_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                selectedStatus === status
                  ? "bg-slate-900 text-white font-semibold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Data Table */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
            <span className="text-xs font-medium">Loading customer directory...</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No Customers Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting your search criteria or create a new customer record.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Client Name</th>
                  <th className="py-3 px-4">Contact & PAN</th>
                  <th className="py-3 px-4">Pipeline Status</th>
                  <th className="py-3 px-4">Monthly Income</th>
                  <th className="py-3 px-4">CIBIL Bureau</th>
                  <th className="py-3 px-4">Risk Tier</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openCustomerDrawer(c.id)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {c.first_name} {c.last_name}
                      </div>
                      <div className="text-[11px] text-slate-500">{c.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      <div>{c.phone}</div>
                      <div className="text-[11px] text-slate-400">PAN: {c.pan_number}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadge(
                          c.pipeline_status
                        )}`}
                      >
                        {c.pipeline_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      ₹{parseFloat(c.financial_profile?.monthly_income || 0).toLocaleString("en-IN")}/mo
                    </td>
                    <td className="py-3.5 px-4">
                      {c.financial_profile?.cibil_score ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold ${
                              c.financial_profile.cibil_score >= 750
                                ? "text-emerald-600"
                                : c.financial_profile.cibil_score >= 650
                                ? "text-amber-600"
                                : "text-rose-600"
                            }`}
                          >
                            {c.financial_profile.cibil_score}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.financial_profile?.risk_tier === "LOW"
                            ? "bg-emerald-100 text-emerald-800"
                            : c.financial_profile?.risk_tier === "MEDIUM"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {c.financial_profile?.risk_tier || "UNKNOWN"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-emerald-600 font-medium inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        <span>Profile</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer 360 Detail Drawer / Modal */}
      {(selectedCustomer || drawerLoading) && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            {drawerLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
                <span className="text-sm font-medium text-slate-500">
                  Fetching client 360 portfolio...
                </span>
              </div>
            ) : selectedCustomer ? (
              <>
                {/* Drawer Header */}
                <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono font-semibold text-emerald-700">
                      CUSTOMER 360 PROFILE
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                      {selectedCustomer.first_name} {selectedCustomer.last_name}
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>{selectedCustomer.email}</span>
                      <span>•</span>
                      <span>{selectedCustomer.phone}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Financial & Bureau Health Card */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      Financial & Bureau Assessment
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block">Monthly Income</span>
                        <span className="font-bold text-slate-900 text-sm">
                          ₹{parseFloat(selectedCustomer.financial_profile?.monthly_income || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Monthly Obligations</span>
                        <span className="font-bold text-slate-900 text-sm">
                          ₹{parseFloat(selectedCustomer.financial_profile?.monthly_obligations || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">CIBIL Bureau Score</span>
                        <span className="font-bold text-emerald-700 text-sm">
                          {selectedCustomer.financial_profile?.cibil_score || "—"} / 900
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Risk Tier Classification</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {selectedCustomer.financial_profile?.risk_tier || "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Follow-up Tasks */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-teal-600" />
                        Follow-up Tasks ({selectedCustomer.tasks?.length || 0})
                      </span>
                    </h3>

                    {/* Task List */}
                    <div className="space-y-2 mb-3">
                      {selectedCustomer.tasks?.length === 0 ? (
                        <div className="text-xs text-slate-400 italic">No tasks scheduled.</div>
                      ) : (
                        selectedCustomer.tasks.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 rounded-lg border border-slate-200 bg-white flex items-start gap-3 text-xs"
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleTaskStatus(t.id, t.status)}
                              className="mt-0.5 text-slate-400 hover:text-emerald-600"
                            >
                              {t.status === "COMPLETED" ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                            <div className="flex-1">
                              <span
                                className={`font-semibold block ${
                                  t.status === "COMPLETED"
                                    ? "line-through text-slate-400"
                                    : "text-slate-800"
                                }`}
                              >
                                {t.title}
                              </span>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                                <span>Due: {t.due_date}</span>
                                <span>•</span>
                                <span className="font-medium text-amber-600">
                                  {t.priority}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(t.id)}
                              className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete Task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Task Form */}
                    <form onSubmit={handleAddTask} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                      <input
                        type="text"
                        placeholder="Task title (e.g. Call client for tax returns)..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 bg-white"
                        required
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={newTaskDue}
                          onChange={(e) => setNewTaskDue(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 bg-white flex-1"
                          required
                        />
                        <select
                          value={newTaskPriority}
                          onChange={(e) => setNewTaskPriority(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 bg-white"
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                        </select>
                        <button
                          type="submit"
                          disabled={taskSubmitting}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                        >
                          {taskSubmitting ? "Adding..." : "Add"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Case Notes Timeline */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-indigo-600" />
                      Interaction Timeline Notes ({selectedCustomer.notes?.length || 0})
                    </h3>

                    {/* Notes List */}
                    <div className="space-y-2.5 mb-3">
                      {selectedCustomer.notes?.length === 0 ? (
                        <div className="text-xs text-slate-400 italic">No notes added yet.</div>
                      ) : (
                        selectedCustomer.notes.map((n) => (
                          <div
                            key={n.id}
                            className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                          >
                            <p className="text-slate-800 leading-relaxed">{n.content}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                              {new Date(n.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Note Form */}
                    <form onSubmit={handleAddNote} className="space-y-2">
                      <textarea
                        rows={2}
                        placeholder="Log meeting notes, borrower queries, or status updates..."
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        required
                      />
                      <button
                        type="submit"
                        disabled={noteSubmitting}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                      >
                        {noteSubmitting ? "Logging Note..." : "Add Timeline Note"}
                      </button>
                    </form>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Customer Profile</h3>
                <p className="text-xs text-slate-500">
                  Onboard a new borrower client into the FinNexus CRM database.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateCustomerSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">PAN Card Number</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="ABCDE1234F"
                    value={formData.pan_number}
                    onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Pipeline Status</label>
                  <select
                    value={formData.pipeline_status}
                    onChange={(e) => setFormData({ ...formData, pipeline_status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="NEW_LEAD">New Lead</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="DOCUMENTATION">Documentation</option>
                    <option value="UNDERWRITING">Underwriting</option>
                    <option value="APPROVED">Approved</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-800 block mb-2">Financial Profile Data</span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-600 block mb-1">Monthly Income (₹)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.monthly_income}
                      onChange={(e) => setFormData({ ...formData, monthly_income: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1">Obligations (₹)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.monthly_obligations}
                      onChange={(e) => setFormData({ ...formData, monthly_obligations: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1">CIBIL Score</label>
                    <input
                      type="number"
                      min={300}
                      max={900}
                      value={formData.cibil_score}
                      onChange={(e) => setFormData({ ...formData, cibil_score: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2"
                >
                  {createSubmitting ? "Creating..." : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
