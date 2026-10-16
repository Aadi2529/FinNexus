import React, { useState } from "react";
import { AlertTriangle, X, CheckCircle } from "lucide-react";

export default function OverrideModal({
  isOpen,
  onClose,
  onConfirm,
  workOrder,
  incompleteCount = 0,
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide an explicit business reason or supervisor authorization for this override.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to complete work order with override.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-amber-50/60 border-b border-amber-200/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-amber-800">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Incomplete Checklist Guard</h3>
              <p className="text-[11px] text-amber-700">Authorized Supervisor Override Required</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            Work Order <span className="font-mono font-bold text-slate-900">{workOrder?.order_number}</span> has{" "}
            <span className="font-bold text-amber-600">{incompleteCount} checklist milestone(s) incomplete</span>.
            Under enterprise governance policy, resolving this order requires an explicit reason which will be logged in the permanent audit trail.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Override Justification <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Special waiver granted by Credit Underwriting Committee; document verified offline."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800"
            />
            {error && <p className="text-xs text-rose-600 mt-1 font-medium">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              {submitting ? "Applying..." : "Confirm & Mark Completed"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
