import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FolderTree,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  ListOrdered,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { crmAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PriorityChip from "../components/PriorityChip";

export default function CategoriesPage() {
  const { isAdmin } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPriority, setFormPriority] = useState("NORMAL");
  const [formActive, setFormActive] = useState(true);
  const [templateItems, setTemplateItems] = useState([]);
  const [newStepText, setNewStepText] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await crmAPI.getCategories(false);
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormName("");
    setFormCode("");
    setFormDesc("");
    setFormPriority("NORMAL");
    setFormActive(true);
    setTemplateItems([
      { title: "Initial document collection & verification" },
      { title: "Credit committee review & risk assessment" },
      { title: "Final execution and compliance sign-off" },
    ]);
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormCode(cat.code);
    setFormDesc(cat.description || "");
    setFormPriority(cat.default_priority || "NORMAL");
    setFormActive(cat.is_active !== false);
    setTemplateItems(Array.isArray(cat.checklist_template) ? [...cat.checklist_template] : []);
    setFormError("");
    setModalOpen(true);
  };

  const handleAddTemplateStep = () => {
    if (!newStepText.trim()) return;
    setTemplateItems([...templateItems, { title: newStepText.trim() }]);
    setNewStepText("");
  };

  const handleRemoveTemplateStep = (idx) => {
    setTemplateItems(templateItems.filter((_, i) => i !== idx));
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!formName.trim() || !formCode.trim()) {
      setFormError("Category Name and Code are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        description: formDesc.trim() || null,
        default_priority: formPriority,
        is_active: formActive,
        checklist_template: templateItems.map((item, idx) => ({
          title: item.title,
          position: idx,
        })),
      };

      if (editingCategory) {
        await crmAPI.updateCategory(editingCategory.id, payload);
      } else {
        await crmAPI.createCategory(payload);
      }
      setModalOpen(false);
      fetchCategories();
    } catch (err) {
      setFormError(err?.message || "Failed to persist work category.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Are you sure you want to delete category '${cat.name}'?`)) return;
    try {
      await crmAPI.deleteCategory(cat.id);
      fetchCategories();
    } catch (err) {
      alert(err?.message || "Cannot delete category referenced by existing work orders.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Work Categories & Templates</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational workflow catalog with pre-configured checklist milestones.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Category</span>
          </button>
        )}
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
            Loading categories...
          </div>
        ) : categories.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            No work categories registered.
          </div>
        ) : (
          categories.map((cat) => {
            const templates = cat.checklist_template || [];
            return (
              <div
                key={cat.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between hover:border-slate-300 transition-all duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          {cat.code}
                        </span>
                        <h2 className="text-sm font-bold text-slate-900">{cat.name}</h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {cat.description || "No narrative description."}
                      </p>
                    </div>

                    <PriorityChip priority={cat.default_priority} size="sm" />
                  </div>

                  {/* Checklist Templates Drawer */}
                  <div className="mt-4 space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                      Default Checklist Pipeline ({templates.length} milestones)
                    </span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {templates.map((step, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/70 text-xs text-slate-700 flex items-center gap-2.5"
                        >
                          <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate flex-1">{step.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    to={`/work-orders?category_id=${cat.id}`}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-700 hover:underline flex items-center gap-1"
                  >
                    <span>View Orders in Category</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(cat)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                        title="Edit Category Template"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingCategory ? `Edit Category: ${editingCategory.name}` : "Create Work Category"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Loan Origination & KYC"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LOAN_KYC"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Default Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formActive ? "ACTIVE" : "INACTIVE"}
                    onChange={(e) => setFormActive(e.target.value === "ACTIVE")}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="ACTIVE">Active (Available)</option>
                    <option value="INACTIVE">Inactive (Hidden)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Operational scope of this work category..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                />
              </div>

              {/* Template Milestones */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Preset Checklist Template ({templateItems.length} steps)
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto mb-2">
                  {templateItems.map((step, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-2"
                    >
                      <span className="truncate flex-1">{step.title}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTemplateStep(idx)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add step to checklist template..."
                    value={newStepText}
                    onChange={(e) => setNewStepText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTemplateStep();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300"
                  />
                  <button
                    type="button"
                    onClick={handleAddTemplateStep}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
                >
                  {saving ? "Saving..." : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
