import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Check,
  Search,
  User,
  Phone,
  Mail,
  Building,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Save,
  HelpCircle,
  Calendar,
  Clock,
  Bell,
} from "lucide-react";
import { crmAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

// Canonical category definitions and task templates matching project specifications
export const CANONICAL_CATEGORIES = [
  {
    key: "WORK_MFU",
    title: "Work: MFU",
    code: "WORK_MFU",
    tasks: [
      "Do Physical KYC Client",
      "Payeezz Physical / Online",
      "ONLINE KYC & ONLINE PAYEEZZ",
      "E-Can Tracker",
      "Can Generation",
      "Start SIP",
      "MFU Order",
      "Bank Addition & Update Bank details",
      "Change Email Id & Mobile Number",
      "Check order Tracking",
      "Call to MFU (Ask query regarding)",
      "Check Payeezz Status",
      "Nominee, contact & KYC Detail verification",
      "Cen Com query",
      "Fill KYC / Pan Application / Payeezz",
    ],
  },
  {
    key: "WORK_INSURANCE",
    title: "Work: Insurance",
    code: "WORK_INSURANCE",
    tasks: [
      "Term Life Policy Origination",
      "Health Insurance Proposal",
      "Motor / Vehicle Insurance Cover",
      "Commercial Property Shield",
      "Policy Renewal Follow-up",
      "Medical Checkup Scheduling",
      "Premium Quotation Dispatch",
      "Endorsement & Address Change",
    ],
  },
  {
    key: "WORK_INSURANCE_CLAIM",
    title: "Work: Insurance Claim",
    code: "WORK_INSURANCE_CLAIM",
    tasks: [
      "Claim Intimation & Registration",
      "Hospital Cashless Coordination",
      "Discharge Summary Collection",
      "KYC & Bank Details for Settlement",
      "Surveyor Investigation Follow-up",
      "Query Resolution with TPA / Insurer",
      "Settlement Letter & Disbursement Verification",
    ],
  },
  {
    key: "WORK_ACCOUNTING",
    title: "Work: Accounting",
    code: "WORK_ACCOUNTING",
    tasks: [
      "Collect Bank Statements",
      "Prepare Profit & Loss & Balance Sheet",
      "Reconcile Bank Statements",
      "GST Return Filing & Turnover Cross-Check",
      "TDS Deduction & 26AS Verification",
      "Compute Debt-Service Coverage Ratio (DSCR)",
      "Final Statutory Audit Sign-off",
    ],
  },
  {
    key: "WORK_OFFICE_WORK",
    title: "Work: Office Work",
    code: "WORK_OFFICE_WORK",
    tasks: [
      "Physical Document Dispatch / Courier",
      "Stamp Duty & Franking",
      "Sub-Registrar Non-Encumbrance Filing",
      "Agreement Drafting & Legal Vetting",
      "Archival & Vault Safe Deposit",
      "Client Consultation Follow-up Call",
      "Vendor & Utility Processing",
    ],
  },
];

export default function WorkOrderModal({
  isOpen,
  onClose,
  onSuccess,
  prefillClientId = null,
  prefillClient = null,
}) {
  const { user } = useAuth();

  // Section 1: Client & Assignment State
  const [clientSearch, setClientSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  const [clientName, setClientName] = useState("");
  const [clientReference, setClientReference] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [clientMobile, setClientMobile] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [workOrderBy, setWorkOrderBy] = useState("");

  // Catalogs
  const [teamMembers, setTeamMembers] = useState([]);
  const [backendCategories, setBackendCategories] = useState([]);

  // Section 2: Work Scope & Categories State
  const [workDescription, setWorkDescription] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({
    WORK_MFU: true,
    WORK_INSURANCE: false,
    WORK_INSURANCE_CLAIM: false,
    WORK_ACCOUNTING: false,
    WORK_OFFICE_WORK: false,
  });

  // Selected tasks map: { [categoryKey]: Set of task strings }
  const [selectedTasks, setSelectedTasks] = useState({
    WORK_MFU: new Set(),
    WORK_INSURANCE: new Set(),
    WORK_INSURANCE_CLAIM: new Set(),
    WORK_ACCOUNTING: new Set(),
    WORK_OFFICE_WORK: new Set(),
  });

  // Other custom task text per category: { [categoryKey]: string }
  const [otherTasks, setOtherTasks] = useState({
    WORK_MFU: "",
    WORK_INSURANCE: "",
    WORK_INSURANCE_CLAIM: "",
    WORK_ACCOUNTING: "",
    WORK_OFFICE_WORK: "",
  });

  // Section 3: Schedule, Priority & Notifications State
  const defaultTargetDate = new Date();
  defaultTargetDate.setDate(defaultTargetDate.getDate() + 2);
  const [deadlineDate, setDeadlineDate] = useState(defaultTargetDate.toISOString().slice(0, 10));
  const [deadlineTime, setDeadlineTime] = useState("18:00");
  const [workPriority, setWorkPriority] = useState("Do it in 2 to 3 days");
  const [customPriorityText, setCustomPriorityText] = useState("");
  const [reminderRecipients, setReminderRecipients] = useState(new Set());

  const toggleReminderRecipient = (userId) => {
    setReminderRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
    setIsDirty(true);
  };

  // UI status
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  // Load Team & Categories
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const loadCatalogs = async () => {
      setLoadingCatalogs(true);
      try {
        const [teamRes, catsRes] = await Promise.all([
          crmAPI.getEligibleAssignees().catch(() => crmAPI.getTeam().catch(() => [])),
          crmAPI.getCategories().catch(() => []),
        ]);

        if (!mounted) return;
        setTeamMembers(Array.isArray(teamRes) ? teamRes : []);
        setBackendCategories(Array.isArray(catsRes) ? catsRes : []);

        // Default 'work order by' to current user name
        if (user?.full_name) {
          setWorkOrderBy(user.full_name);
        }
      } catch (err) {
        // Logged gracefully
      } finally {
        if (mounted) setLoadingCatalogs(false);
      }
    };

    loadCatalogs();
    return () => {
      mounted = false;
    };
  }, [isOpen, user]);

  // Handle prefilled client if supplied
  useEffect(() => {
    if (prefillClient) {
      applyClient(prefillClient);
    } else if (prefillClientId) {
      crmAPI.getClientDetail(prefillClientId).then((res) => {
        if (res) applyClient(res);
      }).catch(() => null);
    }
  }, [prefillClient, prefillClientId, isOpen]);

  // Debounced Client Autocomplete Search
  useEffect(() => {
    if (!clientSearch || clientSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingClient(true);
      try {
        const res = await crmAPI.searchClients(clientSearch.trim());
        setSearchResults(Array.isArray(res) ? res : []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearchingClient(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [clientSearch]);

  const applyClient = (client) => {
    setSelectedClient(client);
    const fullName = `${client.first_name || ""} ${client.last_name || ""}`.trim() || client.full_name || "";
    setClientName(fullName);
    setClientReference(client.reference_source || client.pan_number || "");
    setClientEmail(client.email || "");

    if (client.phone) {
      const parts = client.phone.trim().split(" ");
      if (parts.length > 1 && parts[0].startsWith("+")) {
        setCountryCode(parts[0]);
        setClientMobile(parts.slice(1).join("").replace(/\D/g, ""));
      } else {
        const digits = client.phone.replace(/\D/g, "");
        setClientMobile(digits.length > 10 ? digits.slice(-10) : digits);
      }
    }
    setClientSearch("");
    setSearchResults([]);
    setIsDirty(true);
  };

  const clearSelectedClient = () => {
    setSelectedClient(null);
    setClientName("");
    setClientReference("");
    setClientMobile("");
    setClientEmail("");
    setClientSearch("");
    setSearchResults([]);
    setIsDirty(true);
  };

  // Expand / Collapse controls
  const handleExpandAll = () => {
    setExpandedCategories({
      WORK_MFU: true,
      WORK_INSURANCE: true,
      WORK_INSURANCE_CLAIM: true,
      WORK_ACCOUNTING: true,
      WORK_OFFICE_WORK: true,
    });
  };

  const handleCollapseAll = () => {
    setExpandedCategories({
      WORK_MFU: false,
      WORK_INSURANCE: false,
      WORK_INSURANCE_CLAIM: false,
      WORK_ACCOUNTING: false,
      WORK_OFFICE_WORK: false,
    });
  };

  const toggleCategoryExpand = (catKey) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catKey]: !prev[catKey],
    }));
  };

  // Toggle Checkbox Task Selection
  const toggleTask = (catKey, taskName) => {
    setSelectedTasks((prev) => {
      const currentSet = new Set(prev[catKey]);
      if (currentSet.has(taskName)) {
        currentSet.delete(taskName);
      } else {
        currentSet.add(taskName);
      }
      return {
        ...prev,
        [catKey]: currentSet,
      };
    });
    setIsDirty(true);
  };

  // Update "Other" Task Text
  const handleOtherChange = (catKey, val) => {
    if (val.length > 100) return;
    setOtherTasks((prev) => ({
      ...prev,
      [catKey]: val,
    }));
    setIsDirty(true);
  };

  // Calculate selected counts per category
  const categoryCounts = useMemo(() => {
    const counts = {};
    CANONICAL_CATEGORIES.forEach((cat) => {
      const taskCount = selectedTasks[cat.key]?.size || 0;
      const hasOther = Boolean(otherTasks[cat.key]?.trim());
      counts[cat.key] = taskCount + (hasOther ? 1 : 0);
    });
    return counts;
  }, [selectedTasks, otherTasks]);

  // Total selected items across all categories
  const totalSelectedCount = useMemo(() => {
    return Object.values(categoryCounts).reduce((acc, c) => acc + c, 0);
  }, [categoryCounts]);

  const activeCategoriesCount = useMemo(() => {
    return Object.values(categoryCounts).filter((c) => c > 0).length;
  }, [categoryCounts]);

  // Validation
  const validateForm = () => {
    const errs = {};
    if (!clientName.trim()) {
      errs.clientName = "Client Name is required.";
    }

    const cleanMobile = clientMobile.replace(/\D/g, "");
    if (!cleanMobile) {
      errs.clientMobile = "Client Mobile No is required.";
    } else if (countryCode === "+91" && cleanMobile.length !== 10) {
      errs.clientMobile = "Indian mobile number must be exactly 10 digits.";
    }

    if (clientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
      errs.clientEmail = "Enter a valid email address.";
    }

    if (totalSelectedCount === 0 && !workDescription.trim()) {
      errs.workScope = "Please select at least one task or provide a work description.";
    }

    if (!deadlineDate) {
      errs.deadlineDate = "Deadline Date is required.";
    }
    if (!deadlineTime) {
      errs.deadlineTime = "Deadline Time is required.";
    }
    if (deadlineDate && deadlineTime) {
      const deadlineDt = new Date(`${deadlineDate}T${deadlineTime}:00`);
      if (isNaN(deadlineDt.getTime())) {
        errs.deadlineDate = "Invalid deadline date/time format.";
      }
    }

    if (!workPriority) {
      errs.workPriority = "Work priority selection is required.";
    } else if (workPriority === "Other" && !customPriorityText.trim()) {
      errs.customPriority = "Please specify custom priority.";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Save Work Order
  const handleSave = async (e) => {
    e?.preventDefault();
    setFormError(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      // 1. Resolve backend Category ID
      // Find matching category from backend categories (e.g. WORK_MFU)
      const primaryCatDef =
        CANONICAL_CATEGORIES.find((cat) => categoryCounts[cat.key] > 0) ||
        CANONICAL_CATEGORIES[0];

      let matchedBackendCat = backendCategories.find(
        (bc) =>
          bc.code === primaryCatDef.code ||
          bc.name?.toLowerCase().includes(primaryCatDef.title.toLowerCase().replace("work: ", ""))
      );

      // Fallback to first available category if needed
      if (!matchedBackendCat && backendCategories.length > 0) {
        matchedBackendCat = backendCategories[0];
      }

      if (!matchedBackendCat) {
        throw new Error("No active Work Order Category found in system. Please verify backend categories.");
      }

      // 2. Build checklist items from all selected tasks and "Other" fields
      const checklistItems = [];
      let position = 0;

      CANONICAL_CATEGORIES.forEach((cat) => {
        const tasks = selectedTasks[cat.key] || new Set();
        tasks.forEach((t) => {
          checklistItems.push({
            title: `[${cat.title.replace("Work: ", "")}] ${t}`,
            description: null,
            position: position++,
          });
        });

        const otherText = otherTasks[cat.key]?.trim();
        if (otherText) {
          checklistItems.push({
            title: `[${cat.title.replace("Work: ", "")}] Other: ${otherText}`,
            description: null,
            position: position++,
          });
        }
      });

      // 3. Due Date resolution
      const isoDueDate = new Date(`${deadlineDate}T${deadlineTime}:00Z`).toISOString();

      // 4. Client payload resolution
      const cleanPhone = `${countryCode} ${clientMobile.trim()}`;
      const priorityMapping = {
        "Do it urgent": "URGENT",
        "Do it today": "HIGH",
        "Do it next day": "NORMAL",
        "Do it in 2 to 3 days": "LOW",
        "Other": "NORMAL",
      };

      const payload = {
        title: `${primaryCatDef.title}: ${clientName.trim()}`,
        description: workDescription.trim() || null,
        category_id: matchedBackendCat.id,
        assigned_to_id: assignedToId || null,
        priority: priorityMapping[workPriority] || "NORMAL",
        work_priority: workPriority,
        custom_priority: workPriority === "Other" ? customPriorityText.trim() : null,
        due_date: isoDueDate,
        priority_notes: clientReference.trim()
          ? `Client Ref: ${clientReference.trim()} | Order by: ${workOrderBy || "Staff"}`
          : workOrderBy
          ? `Work order requested by: ${workOrderBy}`
          : null,
        reminder_recipient_ids: Array.from(reminderRecipients),
        checklist_items: checklistItems,
      };

      if (selectedClient && selectedClient.id) {
        payload.client_id = selectedClient.id;
      } else {
        // Register client inline transactionally
        const nameParts = clientName.trim().split(" ");
        const firstName = nameParts[0] || "Client";
        const lastName = nameParts.slice(1).join(" ") || "";

        payload.client_id = null;
        payload.new_client = {
          first_name: firstName,
          last_name: lastName,
          phone: cleanPhone,
          email: clientEmail.trim().toLowerCase() || null,
          reference_source: clientReference.trim() || "Work Order Form",
        };
      }

      const res = await crmAPI.createWorkOrder(payload);

      setIsDirty(false);
      if (onSuccess) {
        onSuccess(res);
      }
      onClose();
    } catch (err) {
      setFormError(
        err?.message ||
          (typeof err === "string" ? err : "Failed to save work order. Please check required fields.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      if (window.confirm("You have unsaved changes in this Work Order form. Discard changes?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wo-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Top Accent Gradient Bar matching screenshot */}
        <div className="h-1.5 w-full bg-gradient-to-r from-navy-900 via-teal-600 to-teal-400 shrink-0" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shrink-0 shadow-2xs">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 id="wo-modal-title" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Work Order Form
              </h2>
              <p className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider uppercase">
                ADD A NEW WORK ORDER TO ORGANIZATION QUEUE
              </p>
            </div>
          </div>

          <button
            onClick={handleCancel}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Close dialog"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800">
          {/* General Form Error Banner */}
          {formError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{formError}</div>
              <button onClick={() => setFormError(null)} className="text-rose-500 hover:text-rose-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* SECTION 1: CLIENT & ASSIGNMENT                               */}
          {/* ============================================================ */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
              <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                CLIENT & ASSIGNMENT
              </h3>
              {selectedClient && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Verified Client Linked
                </span>
              )}
            </div>

            {/* Quick Autocomplete Search Input */}
            <div className="relative">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Lookup Existing Client (Auto-fill)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Type name, phone, PAN, or email to search existing borrowers..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400"
                />
                {isSearchingClient && (
                  <Loader2 className="w-3.5 h-3.5 text-teal-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                )}
                {clientSearch && !isSearchingClient && (
                  <button
                    onClick={() => setClientSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => applyClient(c)}
                      className="w-full p-2.5 text-left hover:bg-teal-50/60 transition-colors flex items-center justify-between text-xs group"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 group-hover:text-teal-700">
                          {c.full_name || `${c.first_name} ${c.last_name}`}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {c.phone} • {c.email || "No email"} {c.pan_number ? `• PAN: ${c.pan_number}` : ""}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-teal-600">Select</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2-Column Desktop Form Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Field 1: Client Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Client Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      setIsDirty(true);
                      if (fieldErrors.clientName) setFieldErrors((p) => ({ ...p, clientName: null }));
                    }}
                    placeholder="e.g. Ramesh Patel"
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all ${
                      fieldErrors.clientName ? "border-rose-300 ring-rose-500/10" : "border-slate-200"
                    }`}
                  />
                  {selectedClient && (
                    <button
                      type="button"
                      onClick={clearSelectedClient}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      Unlink
                    </button>
                  )}
                </div>
                {fieldErrors.clientName && (
                  <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.clientName}</p>
                )}
              </div>

              {/* Field 2: Client Reference */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Client Reference
                </label>
                <input
                  type="text"
                  value={clientReference}
                  onChange={(e) => {
                    setClientReference(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="e.g. REF-2026-089 / Referral Source / PAN"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Field 3: Client Mobile No */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Client Mobile No <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => {
                      setCountryCode(e.target.value);
                      setIsDirty(true);
                    }}
                    className="w-24 px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 shrink-0"
                  >
                    <option value="+91">+91 (IN)</option>
                    <option value="+1">+1 (US)</option>
                    <option value="+44">+44 (UK)</option>
                    <option value="+971">+971 (UAE)</option>
                  </select>

                  <input
                    type="tel"
                    value={clientMobile}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d\s]/g, "");
                      setClientMobile(val);
                      setIsDirty(true);
                      if (fieldErrors.clientMobile) setFieldErrors((p) => ({ ...p, clientMobile: null }));
                    }}
                    placeholder="98765 43210"
                    maxLength={14}
                    className={`flex-1 px-3.5 py-2 text-xs rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all ${
                      fieldErrors.clientMobile ? "border-rose-300 ring-rose-500/10" : "border-slate-200"
                    }`}
                  />
                </div>
                {fieldErrors.clientMobile && (
                  <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.clientMobile}</p>
                )}
              </div>

              {/* Field 4: Client Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Client Email <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => {
                    setClientEmail(e.target.value);
                    setIsDirty(true);
                    if (fieldErrors.clientEmail) setFieldErrors((p) => ({ ...p, clientEmail: null }));
                  }}
                  placeholder="client@example.com"
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400 ${
                    fieldErrors.clientEmail ? "border-rose-300" : "border-slate-200"
                  }`}
                />
                {fieldErrors.clientEmail && (
                  <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.clientEmail}</p>
                )}
              </div>

              {/* Field 5: Assign To */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Assign To
                </label>
                <select
                  value={assignedToId}
                  onChange={(e) => {
                    setAssignedToId(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                >
                  <option value="">-- Unassigned (Assign Later) --</option>
                  {teamMembers.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.full_name || tm.email} ({tm.role || "Staff"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 6: Work order by */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Work order by
                </label>
                <input
                  type="text"
                  value={workOrderBy}
                  onChange={(e) => {
                    setWorkOrderBy(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Staff or Officer Name"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* SECTION 2: WORK SCOPE & CATEGORIES                           */}
          {/* ============================================================ */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
              <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                WORK SCOPE & CATEGORIES
              </h3>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1"
                >
                  <ChevronDown className="w-3 h-3" />
                  <span>Expand All</span>
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1"
                >
                  <ChevronUp className="w-3 h-3" />
                  <span>Collapse All</span>
                </button>
              </div>
            </div>

            {/* Work Description Multiline Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Work Description
              </label>
              <textarea
                rows={3}
                value={workDescription}
                onChange={(e) => {
                  setWorkDescription(e.target.value);
                  setIsDirty(true);
                  if (fieldErrors.workScope) setFieldErrors((p) => ({ ...p, workScope: null }));
                }}
                placeholder="Enter operational work instructions, special client considerations, priority notes, or execution scope..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400 resize-none leading-relaxed"
              />
              {fieldErrors.workScope && (
                <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.workScope}</p>
              )}
            </div>

            {/* 5 Collapsible Category Panels */}
            <div className="space-y-3">
              {CANONICAL_CATEGORIES.map((cat) => {
                const isExpanded = Boolean(expandedCategories[cat.key]);
                const count = categoryCounts[cat.key] || 0;
                const hasSelected = count > 0;
                const otherValue = otherTasks[cat.key] || "";

                return (
                  <div
                    key={cat.key}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      hasSelected
                        ? "border-teal-200 bg-teal-50/20"
                        : "border-slate-200/90 bg-white"
                    }`}
                  >
                    {/* Collapsible Category Header Bar */}
                    <div
                      onClick={() => toggleCategoryExpand(cat.key)}
                      className="px-4 py-3 flex items-center justify-between cursor-pointer select-none bg-slate-50/80 hover:bg-slate-100/90 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-transform duration-200 ${
                            isExpanded ? "rotate-180 bg-teal-100 text-teal-800" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                          {cat.title}
                        </span>
                      </div>

                      {/* Selected Item Count Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                          hasSelected
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-400 border-slate-200"
                        }`}
                      >
                        {count} Selected
                      </span>
                    </div>

                    {/* Collapsible Panel Content */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-1 duration-150">
                        {/* Tasks Checkbox Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {cat.tasks.map((taskName) => {
                            const isChecked = selectedTasks[cat.key]?.has(taskName);

                            return (
                              <label
                                key={taskName}
                                className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                                  isChecked
                                    ? "bg-teal-50/70 border-teal-300 text-teal-950 font-medium shadow-2xs"
                                    : "bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={Boolean(isChecked)}
                                  onChange={() => toggleTask(cat.key, taskName)}
                                  className="mt-0.5 w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 shrink-0"
                                />
                                <span className="leading-snug">{taskName}</span>
                              </label>
                            );
                          })}
                        </div>

                        {/* Category "Other" Input with Character Counter (0/100) */}
                        <div className="pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-semibold text-slate-600">
                              Other (Custom task for {cat.title.replace("Work: ", "")})
                            </label>
                            <span className="text-[10px] font-mono text-slate-400">
                              {otherValue.length}/100
                            </span>
                          </div>
                          <input
                            type="text"
                            value={otherValue}
                            onChange={(e) => handleOtherChange(cat.key, e.target.value)}
                            maxLength={100}
                            placeholder="Specify custom task instruction or note..."
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ============================================================ */}
          {/* SECTION 3: Schedule, Priority & Notifications                */}
          {/* ============================================================ */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Schedule, Priority & Notifications</h2>
                  <p className="text-[11px] text-slate-500">Configure delivery deadline, urgency timeline, and alert recipients.</p>
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
                    value={deadlineDate}
                    onChange={(e) => {
                      setDeadlineDate(e.target.value);
                      setIsDirty(true);
                      if (fieldErrors.deadlineDate) setFieldErrors((p) => ({ ...p, deadlineDate: null }));
                    }}
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border bg-white font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 ${
                      fieldErrors.deadlineDate ? "border-rose-300 bg-rose-50/30" : "border-slate-200"
                    }`}
                  />
                </div>
                {fieldErrors.deadlineDate && (
                  <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.deadlineDate}</p>
                )}
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
                    value={deadlineTime}
                    onChange={(e) => {
                      setDeadlineTime(e.target.value);
                      setIsDirty(true);
                      if (fieldErrors.deadlineTime) setFieldErrors((p) => ({ ...p, deadlineTime: null }));
                    }}
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border bg-white font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 ${
                      fieldErrors.deadlineTime ? "border-rose-300 bg-rose-50/30" : "border-slate-200"
                    }`}
                  />
                </div>
                {fieldErrors.deadlineTime && (
                  <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.deadlineTime}</p>
                )}
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
                        if (fieldErrors.workPriority) setFieldErrors((p) => ({ ...p, workPriority: null }));
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
              {fieldErrors.workPriority && (
                <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.workPriority}</p>
              )}

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
                      if (fieldErrors.customPriority) setFieldErrors((p) => ({ ...p, customPriority: null }));
                    }}
                    placeholder="e.g. Expedited filing before financial year close"
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 ${
                      fieldErrors.customPriority ? "border-rose-300 bg-rose-50/30" : "border-slate-200"
                    }`}
                  />
                  {fieldErrors.customPriority && (
                    <p className="text-[11px] text-rose-500 mt-1">{fieldErrors.customPriority}</p>
                  )}
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

              {teamMembers.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No team members available for reminders.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                  {teamMembers.map((member) => {
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
          </div>
        </div>

        {/* ============================================================ */}
        {/* FIXED MODAL FOOTER                                           */}
        {/* ============================================================ */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-900">{totalSelectedCount}</span> task
            {totalSelectedCount === 1 ? "" : "s"} selected across{" "}
            <span className="font-bold text-slate-900">{activeCategoriesCount}</span> categor
            {activeCategoriesCount === 1 ? "y" : "ies"}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-2xs disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Work Order...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Work Order</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
