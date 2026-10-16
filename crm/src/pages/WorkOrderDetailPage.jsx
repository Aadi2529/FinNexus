import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  User,
  Building2,
  Mail,
  Phone,
  CheckCircle2,
  AlertTriangle,
  History,
  Plus,
  Send,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  FileText,
} from "lucide-react";
import { crmAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import PriorityChip from "../components/PriorityChip";
import ProgressBar from "../components/ProgressBar";
import OverrideModal from "../components/OverrideModal";

export default function WorkOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isEmployee, isSuperAdmin } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New checklist item form
  const [newItemTitle, setNewItemTitle] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // Editing notes on an existing item
  const [activeEditingItem, setActiveEditingItem] = useState(null);
  const [itemNoteText, setItemNoteText] = useState("");

  // Override Guard Modal
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);

  const fetchOrderDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await crmAPI.getWorkOrder(id);
      setOrder(data);
    } catch (err) {
      setError(err?.message || "Failed to load work order.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
  }, [id]);

  const handleStatusTransition = async (targetStatus) => {
    if (!order) return;
    if (targetStatus === "COMPLETED") {
      const items = order.checklist_items || [];
      const incomplete = items.filter((it) => it.status !== "COMPLETED").length;
      if (incomplete > 0) {
        if (!isAdmin) {
          alert(
            "Permission Denied: Only authorized supervisors may use the checklist completion override to complete work orders with pending milestones."
          );
          return;
        }
        setOverrideModalOpen(true);
        return;
      }
    }

    try {
      const updated = await crmAPI.updateWorkOrderStatus(order.id, {
        status: targetStatus,
      });
      setOrder(updated);
    } catch (err) {
      alert(err?.message || "Status update failed.");
    }
  };

  const handleConfirmOverride = async (overrideReason) => {
    if (!order) return;
    try {
      const updated = await crmAPI.updateWorkOrderStatus(order.id, {
        status: "COMPLETED",
        override_reason: overrideReason,
      });
      setOrder(updated);
      setOverrideModalOpen(false);
    } catch (err) {
      alert(err?.message || "Failed to complete work order.");
    }
  };

  const handleChecklistStatusChange = async (itemId, nextStatus) => {
    if (!order) return;
    try {
      const updatedItem = await crmAPI.updateChecklistItem(order.id, itemId, {
        status: nextStatus,
      });
      // Re-fetch detail to get recalculated progress and history
      const freshOrder = await crmAPI.getWorkOrder(order.id);
      setOrder(freshOrder);
    } catch (err) {
      alert(err?.message || "Failed to update milestone status.");
    }
  };

  const handleSaveItemNotes = async (itemId) => {
    if (!order) return;
    try {
      await crmAPI.updateChecklistItem(order.id, itemId, {
        notes: itemNoteText.trim() || null,
      });
      setActiveEditingItem(null);
      setItemNoteText("");
      const freshOrder = await crmAPI.getWorkOrder(order.id);
      setOrder(freshOrder);
    } catch (err) {
      alert(err?.message || "Failed to update notes.");
    }
  };

  const handleAddMilestone = async (e) => {
    e.preventDefault();
    if (!newItemTitle.trim() || !order) return;
    setAddingItem(true);
    try {
      await crmAPI.addChecklistItem(order.id, {
        title: newItemTitle.trim(),
        position: order.checklist_items?.length || 0,
      });
      setNewItemTitle("");
      const freshOrder = await crmAPI.getWorkOrder(order.id);
      setOrder(freshOrder);
    } catch (err) {
      alert(err?.message || "Failed to add milestone.");
    } finally {
      setAddingItem(false);
    }
  };

  const handleArchive = async () => {
    if (!order) return;
    const confirmMessage = isSuperAdmin
      ? `Permanently delete Work Order ${order.order_number}?\n\nPress OK to delete permanently from the database, or Cancel to abort.`
      : `Are you sure you want to archive Work Order ${order.order_number}?`;

    if (!window.confirm(confirmMessage)) return;
    try {
      await crmAPI.deleteWorkOrder(order.id, isSuperAdmin);
      navigate("/work-orders");
    } catch (err) {
      alert(err?.message || "Failed to remove order.");
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-3" />
        Loading work order 360 record...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="py-16 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200 p-8 max-w-lg mx-auto">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-sm font-bold text-slate-900">Work Order Not Found</h2>
        <p className="mt-1">{error || "The requested work order could not be retrieved."}</p>
        <Link
          to="/work-orders"
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold"
        >
          Return to Queue
        </Link>
      </div>
    );
  }

  const checklistItems = order.checklist_items || [];
  const incompleteCount = checklistItems.filter((it) => it.status !== "COMPLETED").length;
  const historyEntries = order.history || [];

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/work-orders"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-white border border-slate-200 shadow-2xs transition-colors"
            title="Back to Work Orders"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                {order.order_number}
              </span>
              <PriorityChip priority={order.priority} size="sm" />
              <StatusBadge status={order.status} size="sm" />
              {order.is_overdue && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wide">
                  Overdue
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
              {order.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Changer */}
          <select
            value={order.status}
            onChange={(e) => handleStatusTransition(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="PENDING">Status: Pending</option>
            <option value="IN_PROGRESS">Status: In Progress</option>
            <option value="REVIEW">Status: In Review</option>
            <option value="COMPLETED">Status: Completed</option>
            {isAdmin && <option value="CANCELLED">Status: Cancelled</option>}
          </select>

          {isAdmin && (
            <Link
              to={`/work-orders/${order.id}/edit`}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit</span>
            </Link>
          )}

          {isAdmin && (
            <button
              onClick={handleArchive}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-colors"
              title="Archive Order"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Grid: Details Cards + Checklist Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Metadata Cards & Scope */}
        <div className="space-y-6 lg:col-span-1">
          {/* Progress Overview */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block mb-2">
              Checklist Completion Progress
            </span>
            <ProgressBar percent={order.progress_percent} size="lg" />
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
              <span>{order.checklist_completed} of {order.checklist_count} milestones resolved</span>
              <span className="font-bold text-teal-700 font-mono">{order.progress_percent}%</span>
            </div>
          </div>

          {/* Client Reference Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-teal-600" /> Client Profile
              </span>
              <Link to="/clients" className="text-xs text-teal-600 font-semibold hover:underline">
                View 360
              </Link>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Client Name</span>
                <span className="font-bold text-slate-900 text-sm">{order.client_name || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Email Address</span>
                <a href={`mailto:${order.client_email}`} className="text-slate-700 hover:underline flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{order.client_email || "—"}</span>
                </a>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Primary Phone</span>
                <span className="text-slate-700 flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{order.client_phone || "—"}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Delegation & Timing Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3 text-xs">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block pb-2 border-b border-slate-100">
              Assignment & SLA
            </span>

            <div className="space-y-2.5">
              <div>
                <span className="text-slate-400 block text-[11px]">Assigned Specialist</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <User className="w-3.5 h-3.5 text-teal-600" />
                  {order.assigned_to_name || "Unassigned"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Created By</span>
                <span className="text-slate-700 font-medium">{order.created_by_name || "Platform Admin"}</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Target Deadline</span>
                <span className={`font-mono font-bold flex items-center gap-1.5 mt-0.5 ${order.is_overdue ? "text-rose-600" : "text-slate-800"}`}>
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(order.due_date).toLocaleDateString()} &bull; {new Date(order.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {order.completed_at && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Resolved Timestamp</span>
                  <span className="font-mono text-emerald-700 font-semibold flex items-center gap-1.5 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {new Date(order.completed_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Priority Notes Callout */}
          {order.priority_notes && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1">
              <span className="font-bold flex items-center gap-1.5 uppercase text-[11px] text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5" /> SLA / Priority Instructions
              </span>
              <p className="leading-relaxed">{order.priority_notes}</p>
            </div>
          )}
        </div>

        {/* Right Columns: Description, Interactive Checklist, and Audit Trail */}
        <div className="space-y-6 lg:col-span-2">
          {/* Work Description narrative */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block mb-2">
              Work Description & Scope
            </span>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
              {order.description || "No narrative description provided for this work order."}
            </p>
          </div>

          {/* Interactive Checklist Pipeline */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Checklist Milestones Pipeline</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Granular action items tracked live with timestamps and notes.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                {checklistItems.length} Milestones
              </span>
            </div>

            <div className="p-4 sm:p-5 space-y-3">
              {checklistItems.map((item, idx) => {
                const isCompleted = item.status === "COMPLETED";
                const isBlocked = item.status === "BLOCKED";
                const isEditingNotes = activeEditingItem === item.id;

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition-all duration-150 space-y-2 ${
                      isCompleted
                        ? "bg-emerald-50/30 border-emerald-200"
                        : isBlocked
                        ? "bg-rose-50/30 border-rose-200"
                        : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className={`text-xs font-semibold block ${isCompleted ? "line-through text-slate-400 font-normal" : "text-slate-900"}`}>
                            {item.title}
                          </span>
                          {item.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Milestone Status Toggle */}
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={item.status}
                          onChange={(e) => handleChecklistStatusChange(item.id, e.target.value)}
                          className={`text-xs font-semibold py-1 px-2 rounded-lg border focus:outline-none ${
                            isCompleted
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : isBlocked
                              ? "bg-rose-100 text-rose-800 border-rose-300"
                              : "bg-slate-100 text-slate-800 border-slate-300"
                          }`}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="BLOCKED">Blocked</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </div>
                    </div>

                    {/* Metadata: completed at & notes */}
                    <div className="pl-9 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-3">
                        {item.completed_at && (
                          <span className="text-emerald-700 font-mono flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Completed on {new Date(item.completed_at).toLocaleDateString()}
                          </span>
                        )}
                        {item.notes && !isEditingNotes && (
                          <span className="italic text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            "{item.notes}"
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setActiveEditingItem(isEditingNotes ? null : item.id);
                          setItemNoteText(item.notes || "");
                        }}
                        className="text-teal-600 hover:text-teal-700 font-medium hover:underline text-[11px]"
                      >
                        {isEditingNotes ? "Close" : item.notes ? "Edit Note" : "+ Add Note"}
                      </button>
                    </div>

                    {/* Inline note edit form */}
                    {isEditingNotes && (
                      <div className="pl-9 pt-2 flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Add milestone inspection note..."
                          value={itemNoteText}
                          onChange={(e) => setItemNoteText(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        />
                        <button
                          onClick={() => handleSaveItemNotes(item.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add New Milestone Form (Admins only) */}
              {isAdmin && (
                <form onSubmit={handleAddMilestone} className="pt-2 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add another milestone or checklist item..."
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                  <button
                    type="submit"
                    disabled={addingItem}
                    className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{addingItem ? "Adding..." : "Add Milestone"}</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Append-Only Audit History Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-bold text-slate-900">Task Audit History</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {historyEntries.length} recorded events
              </span>
            </div>

            <div className="space-y-3 divide-y divide-slate-100">
              {historyEntries.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  No historical entries recorded.
                </div>
              ) : (
                historyEntries.map((h) => (
                  <div key={h.id} className="pt-3 first:pt-0 flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800">{h.action}</span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">{h.details}</p>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
                        Actor: {h.actor_name || "System"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Completion Override Modal */}
      <OverrideModal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        onConfirm={handleConfirmOverride}
        workOrder={order}
        incompleteCount={incompleteCount}
      />
    </div>
  );
}
