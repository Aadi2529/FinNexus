import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import {
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Clock,
  User,
  Users,
  Briefcase,
  Layers,
  Flame,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  Search,
  X,
  Phone,
  Mail,
  RefreshCw,
  Bell,
  Check,
} from "lucide-react";
import { crmAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PriorityChip from "../components/PriorityChip";
import WorkOrderModal from "../components/WorkOrderModal";

export default function WorkOrderFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClientId = searchParams.get("client_id");
  const { user, isAdmin } = useAuth();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  // Catalogs
  const [clients, setClients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [team, setTeam] = useState([]);

  // Client Selection & Autocomplete State
  const [clientId, setClientId] = useState("");
  const [selectedClientObj, setSelectedClientObj] = useState(null);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [isSearchingClients, setIsSearchingClients] = useState(false);

  // New Client Inline Toggle & State
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClient, setNewClient] = useState({
    first_name: "",
    last_name: "",
    country_code: "+91",
    mobile_number: "",
    email: "",
    pan_number: "",
    reference_source: "Direct",
  });
  const [newClientErrors, setNewClientErrors] = useState({});

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("18:00");
  const [workPriority, setWorkPriority] = useState("Do it in 2 to 3 days");
  const [customPriorityText, setCustomPriorityText] = useState("");
  const [reminderRecipients, setReminderRecipients] = useState(new Set());
  const [priorityNotes, setPriorityNotes] = useState("");
  const [checklistItems, setChecklistItems] = useState([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");

  const toggleReminderRecipient = (userId) => {
    setReminderRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
    setIsDirty(true);
  };

  // Warn on navigation if dirty
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Load catalogs and order data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [clientsData, catsData, teamData] = await Promise.all([
          crmAPI.getClients().catch(() => []),
          crmAPI.getCategories().catch(() => []),
          crmAPI.getEligibleAssignees().catch(async () => {
            return await crmAPI.getTeam().catch(() => []);
          }),
        ]);

        const resolvedClients = Array.isArray(clientsData) ? clientsData : clientsData?.items || [];
        setClients(resolvedClients);
        setCategories(Array.isArray(catsData) ? catsData : []);
        setTeam(Array.isArray(teamData) ? teamData : []);

        if (isEdit) {
          const wo = await crmAPI.getWorkOrder(id);
          setTitle(wo.title || "");
          setDescription(wo.description || "");
          setClientId(wo.client_id || "");
          setCategoryId(wo.category_id || "");
          setAssignedToId(wo.assigned_to_id || "");
          setPriority(wo.priority || "NORMAL");
          setWorkPriority(wo.work_priority || "Do it in 2 to 3 days");
          setCustomPriorityText(wo.custom_priority || "");
          if (Array.isArray(wo.reminder_recipient_ids)) {
            setReminderRecipients(new Set(wo.reminder_recipient_ids));
          }
          setPriorityNotes(wo.priority_notes || "");
          if (wo.due_date) {
            const dt = new Date(wo.due_date);
            setDueDate(dt.toISOString().slice(0, 10));
            setDueTime(dt.toTimeString().slice(0, 5));
          }
          if (Array.isArray(wo.checklist_items)) {
            setChecklistItems(
              wo.checklist_items.map((it) => ({
                id: it.id,
                title: it.title,
                description: it.description || "",
                position: it.position || 0,
              }))
            );
          }

          // Resolve attached client
          if (wo.client_id) {
            const found = resolvedClients.find((c) => String(c.id) === String(wo.client_id));
            if (found) {
              setSelectedClientObj(found);
            } else if (wo.client) {
              setSelectedClientObj(wo.client);
            }
          }
        } else {
          // Defaults for new order
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 3);
          setDueDate(tomorrow.toISOString().slice(0, 10));

          // Pre-select client if passed via query param
          if (queryClientId) {
            setClientId(queryClientId);
            const found = resolvedClients.find((c) => String(c.id) === String(queryClientId));
            if (found) {
              setSelectedClientObj(found);
            }
          }
        }
      } catch (err) {
        setError(err?.message || "Failed to load form catalogs.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, isEdit, queryClientId]);

  // Client Autocomplete Debounce Effect
  useEffect(() => {
    if (!clientSearchQuery || clientSearchQuery.trim().length < 2) {
      setClientSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingClients(true);
      try {
        const results = await crmAPI.searchClients(clientSearchQuery.trim());
        setClientSearchResults(Array.isArray(results) ? results : []);
      } catch {
        setClientSearchResults([]);
      } finally {
        setIsSearchingClients(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearchQuery]);

  // Client Selection Handler
  const handleSelectClient = (c) => {
    setClientId(c.id);
    setSelectedClientObj(c);
    setClientSearchQuery("");
    setClientSearchResults([]);
    setShowNewClientForm(false);
    setIsDirty(true);
  };

  // Clear Selected Client
  const handleClearSelectedClient = () => {
    setClientId("");
    setSelectedClientObj(null);
    setClientSearchQuery("");
    setClientSearchResults([]);
    setIsDirty(true);
  };

  // When a category is selected, optionally load its default template
  const handleCategoryChange = (newCatId) => {
    setCategoryId(newCatId);
    setIsDirty(true);
    const cat = categories.find((c) => c.id === newCatId);
    if (cat) {
      if (cat.default_priority && !isEdit) {
        setPriority(cat.default_priority);
      }
      if (Array.isArray(cat.checklist_template) && cat.checklist_template.length > 0 && checklistItems.length === 0) {
        setChecklistItems(
          cat.checklist_template.map((t, idx) => ({
            title: t.title,
            description: "",
            position: t.position !== undefined ? t.position : idx,
          }))
        );
      }
    }
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistTitle.trim()) return;
    setChecklistItems([
      ...checklistItems,
      {
        title: newChecklistTitle.trim(),
        description: "",
        position: checklistItems.length,
      },
    ]);
    setNewChecklistTitle("");
    setIsDirty(true);
  };

  const handleRemoveChecklistItem = (idx) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  // Validate Inline New Client
  const validateInlineClient = () => {
    const errs = {};
    if (!newClient.first_name.trim()) errs.first_name = "First name is required.";
    if (!newClient.mobile_number.trim()) {
      errs.mobile_number = "Mobile number is required.";
    } else if (/[a-zA-Z]/.test(newClient.mobile_number)) {
      errs.mobile_number = "Mobile number must not contain letters.";
    } else {
      const cleanDigits = newClient.mobile_number.replace(/\D/g, "");
      if (newClient.country_code === "+91" && cleanDigits.length !== 10) {
        errs.mobile_number = "Indian mobile number must be exactly 10 digits.";
      }
    }
    if (!newClient.email.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClient.email.trim())) {
      errs.email = "Valid email address required.";
    }
    if (!newClient.pan_number.trim()) {
      errs.pan_number = "PAN number is required.";
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(newClient.pan_number.trim())) {
      errs.pan_number = "PAN format must be 10 characters (e.g. ABCDE1234F).";
    }
    setNewClientErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please provide a descriptive Work Order title.");
      return;
    }
    if (!categoryId) {
      setError("Please select a Work Category.");
      return;
    }
    if (!dueDate) {
      setError("Please specify a completion deadline.");
      return;
    }

    if (!isEdit && showNewClientForm) {
      if (!validateInlineClient()) {
        setError("Please correct the new client registration errors.");
        return;
      }
    } else if (!clientId) {
      setError("Please select or register a Client for this work order.");
      return;
    }

    if (workPriority === "Other" && !customPriorityText.trim()) {
      setError("Please specify custom priority description.");
      return;
    }

    const isoDue = new Date(`${dueDate}T${dueTime || "18:00"}:00Z`).toISOString();
    const priorityMapping = {
      "Do it urgent": "URGENT",
      "Do it today": "HIGH",
      "Do it next day": "NORMAL",
      "Do it in 2 to 3 days": "LOW",
      "Other": "NORMAL",
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await crmAPI.updateWorkOrder(id, {
          title: title.trim(),
          description: description.trim() || null,
          category_id: categoryId,
          assigned_to_id: assignedToId || null,
          priority: priorityMapping[workPriority] || priority,
          work_priority: workPriority,
          custom_priority: workPriority === "Other" ? customPriorityText.trim() : null,
          due_date: isoDue,
          priority_notes: priorityNotes.trim() || null,
          reminder_recipient_ids: Array.from(reminderRecipients),
        });
        setIsDirty(false);
        navigate(`/work-orders/${id}`);
      } else {
        const payload = {
          title: title.trim(),
          description: description.trim() || null,
          category_id: categoryId,
          assigned_to_id: assignedToId || null,
          priority,
          due_date: isoDue,
          priority_notes: priorityNotes.trim() || null,
          checklist_items: checklistItems.map((item, idx) => ({
            title: item.title,
            description: item.description || null,
            position: idx,
          })),
        };

        if (showNewClientForm) {
          payload.client_id = null;
          payload.new_client = {
            first_name: newClient.first_name.trim(),
            last_name: newClient.last_name.trim(),
            email: newClient.email.trim().toLowerCase(),
            phone: `${newClient.country_code} ${newClient.mobile_number.trim()}`,
            pan_number: newClient.pan_number.trim().toUpperCase(),
            reference_source: newClient.reference_source || "Direct",
          };
        } else {
          payload.client_id = clientId;
        }

        const created = await crmAPI.createWorkOrder(payload);
        setIsDirty(false);
        navigate(`/work-orders/${created.id}`);
      }
    } catch (err) {
      setError(err?.message || "Failed to persist work order. Check inputs.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isEdit) {
    return (
      <WorkOrderModal
        isOpen={true}
        onClose={() => {
          if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
          } else {
            navigate("/work-orders");
          }
        }}
        onSuccess={(created) => navigate(`/work-orders/${created.id}`)}
        prefillClientId={queryClientId}
      />
    );
  }

  if (isEdit && !isAdmin) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-8 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Edit Permission Restricted</h2>
          <p className="text-xs text-slate-500 mt-2 mb-6 leading-relaxed">
            Employees cannot edit, reassign, or alter work orders after creation. You can update checklist milestones and transition task status directly on the work order page.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to={`/work-orders/${id}`}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-xs"
            >
              View Work Order
            </Link>
            <Link
              to="/work-orders"
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Back to Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={isEdit ? `/work-orders/${id}` : "/work-orders"}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-white border border-slate-200 shadow-2xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {isEdit ? "Edit Work Order" : "Create New Work Order"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Sectioned enterprise task delegation form inspired by operational workflows.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/work-orders"
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{submitting ? "Saving Order..." : isEdit ? "Update Order" : "Create Order"}</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION A: Client and Assignment */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
                A
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Client Reference & Team Delegation</h2>
                <p className="text-[11px] text-slate-500">Attach borrower profile and designate responsible operations officer.</p>
              </div>
            </div>

            {!isEdit && (
              <button
                type="button"
                onClick={() => {
                  setShowNewClientForm(!showNewClientForm);
                  if (!showNewClientForm) {
                    handleClearSelectedClient();
                  }
                }}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showNewClientForm ? "Search Existing Clients" : "Register New Client"}</span>
              </button>
            )}
          </div>

          {/* Selected Client Card */}
          {selectedClientObj && !showNewClientForm ? (
            <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">
                    {selectedClientObj.first_name} {selectedClientObj.last_name}
                  </span>
                  <span className="font-mono text-xs font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded border border-teal-300">
                    PAN: {selectedClientObj.pan_number}
                  </span>
                  {selectedClientObj.reference_source && (
                    <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {selectedClientObj.reference_source}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-slate-600">
                  <div className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{selectedClientObj.email}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span className="font-mono">{selectedClientObj.phone}</span>
                  </div>
                </div>
              </div>

              {!isEdit && (
                <button
                  type="button"
                  onClick={handleClearSelectedClient}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors self-start sm:self-auto"
                >
                  Change Client
                </button>
              )}
            </div>
          ) : showNewClientForm && !isEdit ? (
            /* Inline Client Registration Form */
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Register New Borrower Profile</span>
                  <p className="text-[11px] text-slate-500">
                    Client and Work Order will be transactionally created in PostgreSQL. Existing profiles with matching PAN will be automatically reused.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewClientForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul"
                    value={newClient.first_name}
                    onChange={(e) => {
                      setNewClient({ ...newClient, first_name: e.target.value });
                      setIsDirty(true);
                    }}
                    className={`w-full px-3 py-2 text-xs rounded-lg border ${
                      newClientErrors.first_name ? "border-rose-400 bg-rose-50/40" : "border-slate-300"
                    } bg-white`}
                  />
                  {newClientErrors.first_name && <p className="text-[10px] text-rose-600 mt-0.5">{newClientErrors.first_name}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Verma"
                    value={newClient.last_name}
                    onChange={(e) => {
                      setNewClient({ ...newClient, last_name: e.target.value });
                      setIsDirty(true);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Mobile Phone * (10 Digits)</label>
                  <div className="flex gap-1.5">
                    <span className="px-2 py-2 text-xs rounded-lg border border-slate-300 bg-slate-100 font-mono text-slate-700">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="9876543210"
                      value={newClient.mobile_number}
                      onChange={(e) => {
                        setNewClient({ ...newClient, mobile_number: e.target.value });
                        setIsDirty(true);
                      }}
                      className={`flex-1 px-3 py-2 text-xs rounded-lg border ${
                        newClientErrors.mobile_number ? "border-rose-400 bg-rose-50/40" : "border-slate-300"
                      } bg-white font-mono`}
                    />
                  </div>
                  {newClientErrors.mobile_number && <p className="text-[10px] text-rose-600 mt-0.5">{newClientErrors.mobile_number}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    placeholder="rahul.verma@example.com"
                    value={newClient.email}
                    onChange={(e) => {
                      setNewClient({ ...newClient, email: e.target.value });
                      setIsDirty(true);
                    }}
                    className={`w-full px-3 py-2 text-xs rounded-lg border ${
                      newClientErrors.email ? "border-rose-400 bg-rose-50/40" : "border-slate-300"
                    } bg-white`}
                  />
                  {newClientErrors.email && <p className="text-[10px] text-rose-600 mt-0.5">{newClientErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">PAN Number * (10 Alphanumeric)</label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="ABCDE1234F"
                    value={newClient.pan_number}
                    onChange={(e) => {
                      setNewClient({ ...newClient, pan_number: e.target.value.toUpperCase() });
                      setIsDirty(true);
                    }}
                    className={`w-full px-3 py-2 text-xs rounded-lg border ${
                      newClientErrors.pan_number ? "border-rose-400 bg-rose-50/40" : "border-slate-300"
                    } bg-white font-mono`}
                  />
                  {newClientErrors.pan_number && <p className="text-[10px] text-rose-600 mt-0.5">{newClientErrors.pan_number}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Reference / Lead Source</label>
                  <input
                    type="text"
                    placeholder="Direct, Partner, Referral..."
                    value={newClient.reference_source}
                    onChange={(e) => {
                      setNewClient({ ...newClient, reference_source: e.target.value });
                      setIsDirty(true);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Client Autocomplete Search & Selection */
            <div className="space-y-3">
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Search & Attach Client <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Type client name, mobile (+91), email, or PAN to search..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                  {isSearchingClients ? (
                    <RefreshCw className="w-3.5 h-3.5 text-teal-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  ) : clientSearchQuery ? (
                    <button
                      type="button"
                      onClick={() => setClientSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>

                {/* Autocomplete Suggestions Dropdown */}
                {clientSearchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-100">
                    {clientSearchResults.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => handleSelectClient(c)}
                        className="w-full px-4 py-2.5 text-left hover:bg-teal-50/60 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{c.name || `${c.first_name} ${c.last_name}`}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{c.email}</span>
                            <span>&bull;</span>
                            <span className="font-mono">{c.phone}</span>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 shrink-0">
                          {c.pan_number}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* No results prompt */}
                {clientSearchQuery.trim().length >= 2 && !isSearchingClients && clientSearchResults.length === 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-md border border-slate-200 z-50 p-3 text-xs text-center text-slate-500">
                    <span>No clients matched "{clientSearchQuery}". </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewClientForm(true);
                        setNewClient({ ...newClient, first_name: clientSearchQuery.trim() });
                      }}
                      className="font-bold text-teal-600 hover:underline ml-1"
                    >
                      + Register as New Client
                    </button>
                  </div>
                )}
              </div>

              {/* Alternative Quick Select from directory */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Or select from recent directory:</span>
                <select
                  value={clientId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setClientId(selId);
                    const found = clients.find((c) => String(c.id) === String(selId));
                    if (found) setSelectedClientObj(found);
                    setIsDirty(true);
                  }}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none"
                >
                  <option value="">— Browse Directory —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} ({c.pan_number})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Assignee & Work Order Author */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Assignee (Staff Specialist)
              </label>
              <select
                value={assignedToId}
                onChange={(e) => {
                  setAssignedToId(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="">— Unassigned (Queue) —</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.role}) &bull; {m.active_workload_count || 0} active
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Work Order Author
              </label>
              <div className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium truncate">{user?.full_name || "Enterprise Administrator"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION B: Work Scope and Categories */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              B
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Work Scope & Category Milestones</h2>
              <p className="text-[11px] text-slate-500">Define operational requirements and configure checklist pipeline.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Work Order Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Commercial Title Search & Non-Encumbrance Verification"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="">— Select Category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Work Description & Scope Narrative
            </label>
            <textarea
              rows={3}
              placeholder="Provide context, required documents, or instructions for the assigned officer..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setIsDirty(true);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800 leading-relaxed"
            />
          </div>

          {/* Checklist Milestones Builder (For new order or template inspection) */}
          {!isEdit && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Checklist Milestones ({checklistItems.length} items)
                </span>
                <span className="text-[11px] text-slate-400">
                  Pre-populated from category template or added manually.
                </span>
              </div>

              <div className="space-y-2">
                {checklistItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-medium text-slate-800 truncate">{item.title}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveChecklistItem(idx)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Remove Milestone"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add Milestone Input */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add custom milestone step..."
                    value={newChecklistTitle}
                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddChecklistItem();
                      }
                    }}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Step</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION C: Schedule, Priority & Notifications */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                C
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Schedule, Priority & Notifications</h2>
                <p className="text-[11px] text-slate-500">Configure delivery deadline, priority timeline, and reminder recipients.</p>
              </div>
            </div>

            {/* Auto WhatsApp Alerts indicator badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>Auto WhatsApp Alerts</span>
            </div>
          </div>

          {/* A. Deadline Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Deadline Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Deadline Time <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="time"
                  required
                  value={dueTime}
                  onChange={(e) => {
                    setDueTime(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>
            </div>
          </div>

          {/* B. Work Priority in Days */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Work Priority in Days <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: "Do it in 2 to 3 days", code: "Do it in 2 to 3 days" },
                { label: "Do it urgent", code: "Do it urgent" },
                { label: "Do it next day", code: "Do it next day" },
                { label: "Do it today", code: "Do it today" },
                { label: "Other", code: "Other" },
              ].map((opt) => {
                const isSelected = workPriority === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => {
                      setWorkPriority(opt.code);
                      setIsDirty(true);
                    }}
                    className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all text-center flex items-center justify-center ${
                      isSelected
                        ? opt.code === "Do it urgent"
                          ? "bg-rose-50 border-rose-300 text-rose-800 font-bold shadow-2xs"
                          : "bg-teal-50 border-teal-300 text-teal-900 font-bold shadow-2xs"
                        : "bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Priority Text Input when 'Other' is selected */}
            {workPriority === "Other" && (
              <div className="mt-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Specify Custom Priority <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {customPriorityText.length}/150
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={150}
                  value={customPriorityText}
                  onChange={(e) => {
                    setCustomPriorityText(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="e.g. Expedited processing approved by manager"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>
            )}
          </div>

          {/* C. Reminder to Whom */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-teal-600" />
                <span>Reminder to Whom</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {reminderRecipients.size} recipient{reminderRecipients.size === 1 ? "" : "s"} selected
              </span>
            </div>

            {team.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No team members available for reminders.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                {team.map((member) => {
                  const isSelected = reminderRecipients.has(member.id);
                  return (
                    <div
                      key={member.id}
                      onClick={() => toggleReminderRecipient(member.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer select-none transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? "bg-teal-50/80 border-teal-300 text-teal-950 font-medium shadow-2xs"
                          : "bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {member.full_name?.charAt(0) || "U"}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold block truncate leading-tight">
                            {member.full_name}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate leading-none mt-0.5">
                            {member.role || "Team"}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-teal-600 border-teal-600 text-white" : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-2">
              Selected recipients will receive scheduled notifications and operational updates before the deadline.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Priority Notes & Escalation Instructions
            </label>
            <input
              type="text"
              placeholder="e.g. Expedited processing approved by senior underwriter. Critical closing on Friday."
              value={priorityNotes}
              onChange={(e) => {
                setPriorityNotes(e.target.value);
                setIsDirty(true);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800"
            />
          </div>
        </div>

        {/* SECTION D: Save and Confirmation */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Changes are persisted transactionally with audit history logging.</span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Link
              to="/work-orders"
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl"
            >
              Discard Changes
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl shadow-xs flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{submitting ? "Persisting Order..." : isEdit ? "Update Work Order" : "Submit Work Order"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
