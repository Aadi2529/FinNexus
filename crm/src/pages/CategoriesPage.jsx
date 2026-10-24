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
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { crmAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PriorityChip from "../components/PriorityChip";

function generateStepId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `step-${crypto.randomUUID()}`;
  }
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function SortableChecklistStep({ step, index, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all ${
        isDragging
          ? "opacity-30 bg-teal-50 border-dashed border-teal-400 shadow-inner"
          : "bg-slate-50 hover:bg-slate-100/80 border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag step ${index + 1}: ${step.title}`}
          className="text-slate-400 hover:text-slate-700 active:text-teal-600 cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-slate-200/60 touch-none flex-shrink-0 transition-colors focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>

        <span className="truncate flex-1 text-slate-800 select-text" title={step.title}>
          {step.title}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onRemove(step.id)}
        className="text-slate-400 hover:text-rose-600 p-1 -mr-1 rounded hover:bg-rose-50 transition-colors flex-shrink-0"
        title="Remove step"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

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
  const [activeId, setActiveId] = useState(null);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      { id: generateStepId(), title: "Initial document collection & verification", position: 0 },
      { id: generateStepId(), title: "Credit committee review & risk assessment", position: 1 },
      { id: generateStepId(), title: "Final execution and compliance sign-off", position: 2 },
    ]);
    setNewStepText("");
    setFormError("");
    setActiveId(null);
    setModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormCode(cat.code);
    setFormDesc(cat.description || "");
    setFormPriority(cat.default_priority || "NORMAL");
    setFormActive(cat.is_active !== false);
    const rawTemplates = Array.isArray(cat.checklist_template) ? cat.checklist_template : [];
    const sorted = [...rawTemplates].sort((a, b) => {
      const posA = typeof a.position === "number" ? a.position : Infinity;
      const posB = typeof b.position === "number" ? b.position : Infinity;
      return posA - posB;
    });
    setTemplateItems(
      sorted.map((item, idx) => ({
        id: item.id || generateStepId(),
        title: item.title || "",
        position: typeof item.position === "number" ? item.position : idx,
      }))
    );
    setNewStepText("");
    setFormError("");
    setActiveId(null);
    setModalOpen(true);
  };

  const handleAddTemplateStep = () => {
    if (!newStepText.trim()) return;
    setTemplateItems((prev) => [
      ...prev,
      { id: generateStepId(), title: newStepText.trim(), position: prev.length },
    ]);
    setNewStepText("");
  };

  const handleRemoveTemplateStep = (idToRemove) => {
    setTemplateItems((prev) => prev.filter((item) => item.id !== idToRemove));
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    setTemplateItems((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleDragCancel = () => {
    setActiveId(null);
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
          id: item.id,
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

  const activeStepIndex = templateItems.findIndex((s) => s.id === activeId);
  const activeStep = activeStepIndex !== -1 ? templateItems[activeStepIndex] : null;

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
            const templates = (cat.checklist_template ? [...cat.checklist_template] : []).sort((a, b) => {
              const posA = typeof a.position === "number" ? a.position : Infinity;
              const posB = typeof b.position === "number" ? b.position : Infinity;
              return posA - posB;
            });
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
                          key={step.id || idx}
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
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Default Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
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
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
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
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Template Milestones */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Preset Checklist Template ({templateItems.length} steps)
                  </label>
                  {templateItems.length > 1 && (
                    <span className="text-[10px] text-slate-400 font-normal">
                      Drag handle to reorder
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto mb-2 pr-1">
                  {templateItems.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                      No checklist steps configured yet.
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDragCancel={handleDragCancel}
                    >
                      <SortableContext
                        items={templateItems.map((item) => item.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {templateItems.map((step, idx) => (
                          <SortableChecklistStep
                            key={step.id}
                            step={step}
                            index={idx}
                            onRemove={handleRemoveTemplateStep}
                          />
                        ))}
                      </SortableContext>

                      <DragOverlay>
                        {activeStep ? (
                          <div className="px-2.5 py-1.5 rounded-lg bg-white border border-teal-500 shadow-lg text-xs flex items-center justify-between gap-2 ring-2 ring-teal-500/20 cursor-grabbing">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="text-teal-600 p-1 -ml-1 flex-shrink-0">
                                <GripVertical className="w-3.5 h-3.5" />
                              </div>
                              <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {activeStepIndex + 1}
                              </span>
                              <span className="truncate flex-1 font-medium text-slate-900">
                                {activeStep.title}
                              </span>
                            </div>
                            <div className="p-1 -mr-1 text-slate-300 flex-shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                  )}
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
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddTemplateStep}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50"
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
