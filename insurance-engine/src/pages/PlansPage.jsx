import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import {
  FileText,
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Building2,
  Tag,
  Download,
  Upload,
  FileCheck,
  ShieldAlert,
  Sparkles,
  Lock,
  Unlock,
  Paperclip,
  File,
  X,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  INSURANCE_CATEGORIES,
  COMPANY_TYPES,
  MOTOR_PLAN_TYPES,
  SUPPORTED_CATEGORY_OPTIONS,
  getCategoryLabel,
  getCategoryCode,
  categoriesMatch,
} from "../utils/insuranceCategories";
import {
  validatePositiveDecimal,
  validatePositiveInteger,
  validateName,
} from "../utils/validation";

const LOB_OPTIONS = SUPPORTED_CATEGORY_OPTIONS;

export const PLAN_DOCUMENT_CATEGORIES = [
  "Policy Brochure",
  "Policy Wording",
  "Prospectus",
  "Claim Form",
  "Coverage Details",
  "Terms & Conditions",
  "Rider / Add-on Document",
  "Premium Chart",
  "Proposal Form",
  "Other Documents",
];

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
];

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getDocTypeBadgeClass(docType) {
  switch (docType) {
    case "Policy Brochure":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "Policy Wording":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "Prospectus":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "Claim Form":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Coverage Details":
      return "bg-teal-50 text-teal-700 border-teal-200";
    case "Terms & Conditions":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "Rider / Add-on Document":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "Premium Chart":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Proposal Form":
      return "bg-violet-50 text-violet-700 border-violet-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export default function PlansPage() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const canMutate = isAdmin || isSuperAdmin;
  const [searchParams, setSearchParams] = useSearchParams();

  // Table State
  const [plans, setPlans] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [lobFilter, setLobFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState("");
  const { showSuccess, showError } = useNotification();
  const [actionSuccess, setActionSuccessState] = useState("");
  const setActionSuccess = (msg) => { setActionSuccessState(msg); if (msg) showSuccess(msg); };

  // Carriers for dropdown
  const [companies, setCompanies] = useState([]);

  // Modal State
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | 'view' | 'delete'
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  // Form Fields - Core
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formCompanyId, setFormCompanyId] = useState("");
  const [formLob, setFormLob] = useState("General Insurance");
  const [formMotorPlanType, setFormMotorPlanType] = useState("Comprehensive");
  const [formSumInsuredMin, setFormSumInsuredMin] = useState("");
  const [formSumInsuredMax, setFormSumInsuredMax] = useState("");
  const [formPolicyTermMinYears, setFormPolicyTermMinYears] = useState("");
  const [formPolicyTermMaxYears, setFormPolicyTermMaxYears] = useState("");
  const [formWaitingPeriodMonths, setFormWaitingPeriodMonths] = useState("");
  const [formEligibilityCriteria, setFormEligibilityCriteria] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [formDescription, setFormDescription] = useState("");

  // Selected parent company memo & available categories
  const selectedParentCompany = companies.find((c) => String(c.id) === String(formCompanyId));

  const availableCompanyCategories = React.useMemo(() => {
    if (!selectedParentCompany) return SUPPORTED_CATEGORY_OPTIONS;
    if (
      Array.isArray(selectedParentCompany.supported_categories) &&
      selectedParentCompany.supported_categories.length > 0
    ) {
      return selectedParentCompany.supported_categories;
    }
    if (selectedParentCompany.category) {
      return [getCategoryLabel(selectedParentCompany.category)];
    }
    return SUPPORTED_CATEGORY_OPTIONS;
  }, [selectedParentCompany]);

  // Dynamic Option-based Riders & Coverage Benefits Management
  const [formRiders, setFormRiders] = useState([]); // Array of { id?: string, name: string, description?: string }
  const [formBenefits, setFormBenefits] = useState([]); // Array of { id?: string, name: string, description?: string }

  // New Rider Input & Editing
  const [newRiderName, setNewRiderName] = useState("");
  const [newRiderDesc, setNewRiderDesc] = useState("");
  const [editingRiderIdx, setEditingRiderIdx] = useState(null);
  const [editRiderName, setEditRiderName] = useState("");
  const [editRiderDesc, setEditRiderDesc] = useState("");

  // New Benefit Input & Editing
  const [newBenefitName, setNewBenefitName] = useState("");
  const [newBenefitDesc, setNewBenefitDesc] = useState("");
  const [editingBenefitIdx, setEditingBenefitIdx] = useState(null);
  const [editBenefitName, setEditBenefitName] = useState("");
  const [editBenefitDesc, setEditBenefitDesc] = useState("");

  // Riders helper functions
  const handleAddRider = () => {
    const trimmed = newRiderName.trim();
    if (!trimmed) return;
    if (formRiders.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())) {
      if (typeof showError === "function") showError(`Rider "${trimmed}" is already added.`);
      return;
    }
    setFormRiders((prev) => [
      ...prev,
      { name: trimmed, description: newRiderDesc.trim() || "" },
    ]);
    setNewRiderName("");
    setNewRiderDesc("");
  };

  const handleRemoveRider = (idx) => {
    setFormRiders((prev) => prev.filter((_, i) => i !== idx));
    if (editingRiderIdx === idx) setEditingRiderIdx(null);
  };

  const startEditRider = (idx) => {
    setEditingRiderIdx(idx);
    setEditRiderName(formRiders[idx].name);
    setEditRiderDesc(formRiders[idx].description || "");
  };

  const saveEditRider = (idx) => {
    const trimmed = editRiderName.trim();
    if (!trimmed) return;
    if (
      formRiders.some(
        (r, i) => i !== idx && r.name.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      if (typeof showError === "function") showError(`Another rider with name "${trimmed}" already exists.`);
      return;
    }
    setFormRiders((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, name: trimmed, description: editRiderDesc.trim() || "" } : r
      )
    );
    setEditingRiderIdx(null);
  };

  // Benefits helper functions
  const handleAddBenefit = () => {
    const trimmed = newBenefitName.trim();
    if (!trimmed) return;
    if (formBenefits.some((b) => b.name.toLowerCase() === trimmed.toLowerCase())) {
      if (typeof showError === "function") showError(`Benefit "${trimmed}" is already added.`);
      return;
    }
    setFormBenefits((prev) => [
      ...prev,
      { name: trimmed, description: newBenefitDesc.trim() || "" },
    ]);
    setNewBenefitName("");
    setNewBenefitDesc("");
  };

  const handleRemoveBenefit = (idx) => {
    setFormBenefits((prev) => prev.filter((_, i) => i !== idx));
    if (editingBenefitIdx === idx) setEditingBenefitIdx(null);
  };

  const startEditBenefit = (idx) => {
    setEditingBenefitIdx(idx);
    setEditBenefitName(formBenefits[idx].name);
    setEditBenefitDesc(formBenefits[idx].description || "");
  };

  const saveEditBenefit = (idx) => {
    const trimmed = editBenefitName.trim();
    if (!trimmed) return;
    if (
      formBenefits.some(
        (b, i) => i !== idx && b.name.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      if (typeof showError === "function") showError(`Another benefit with name "${trimmed}" already exists.`);
      return;
    }
    setFormBenefits((prev) =>
      prev.map((b, i) =>
        i === idx ? { ...b, name: trimmed, description: editBenefitDesc.trim() || "" } : b
      )
    );
    setEditingBenefitIdx(null);
  };

  // Company Linking & Locking State (Workflow Phase 2)
  const [isCarrierLocked, setIsCarrierLocked] = useState(false);
  const [lockedCompanyName, setLockedCompanyName] = useState("");
  const [companyBannerMessage, setCompanyBannerMessage] = useState("");

  // Plan Documents Management State (Phase 4)
  const [stagedDocuments, setStagedDocuments] = useState([]); // Array of { id, file, title, document_type, description, size }
  const [existingDocuments, setExistingDocuments] = useState([]); // List of PlanDocumentResponse
  const [docsLoading, setDocsLoading] = useState(false);

  // New Document Input inside Add/Edit forms
  const [docFile, setDocFile] = useState(null);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("Policy Brochure");
  const [docDescription, setDocDescription] = useState("");
  const [docUploadLoading, setDocUploadLoading] = useState(false);
  const [docUploadError, setDocUploadError] = useState("");
  const [docReplaceId, setDocReplaceId] = useState(null);

  // Plan Documents in View Modal
  const [viewPlanDocs, setViewPlanDocs] = useState([]);
  const [viewDocsLoading, setViewDocsLoading] = useState(false);

  const searchTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const replaceFileInputRef = useRef(null);

  const loadCompaniesList = async () => {
    const res = await api.insurance.getCompanies({ page_size: 100, status: "active" });
    if (res.ok) {
      setCompanies(res.data.items || []);
    }
  };

  const fetchPlans = async () => {
    setLoading(true);
    setTableError("");
    const res = await api.insurance.getPlans({
      search: searchTerm.trim() || undefined,
      company_id: companyFilter !== "ALL" ? companyFilter : undefined,
      line_of_business: lobFilter !== "ALL" ? lobFilter : undefined,
      status: statusFilter !== "ALL" ? statusFilter : undefined,
      page,
      page_size: pageSize,
      sort_by: sortBy,
      sort_order: sortOrder,
    });

    if (res.ok) {
      setPlans(res.data.items || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
    } else {
      setTableError(res.error || "Failed to load insurance plans.");
    }
    setLoading(false);
  };

  // Initial load
  useEffect(() => {
    loadCompaniesList();
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [page, pageSize, companyFilter, lobFilter, statusFilter, sortBy, sortOrder]);

  // URL Query Parameters Handling (Workflow Phase 2 & 3)
  useEffect(() => {
    const action = searchParams.get("action");
    const targetCompId = searchParams.get("company_id");
    const targetCompName = searchParams.get("company_name");
    const targetCategory = searchParams.get("category");
    const fromCompanyCreate = searchParams.get("from_company_create");
    const searchParam = searchParams.get("search");

    if (searchParam) {
      setSearchTerm(searchParam);
    }

    if (action === "new" && targetCompId) {
      setModalMode("create");
      setSelectedPlan(null);
      setFormName("");
      setFormCode("");
      setFormCompanyId(targetCompId);
      setIsCarrierLocked(true);
      setLockedCompanyName(targetCompName ? decodeURIComponent(targetCompName) : "");

      // Prepopulate line of business if category matches
      let initialLob = "General Insurance";
      if (targetCategory) {
        initialLob = getCategoryLabel(decodeURIComponent(targetCategory));
      }
      setFormLob(initialLob);
      setFormMotorPlanType("Comprehensive");
      setFormSumInsuredMin("");
      setFormSumInsuredMax("");
      setFormPolicyTermMinYears("");
      setFormPolicyTermMaxYears("");
      setFormWaitingPeriodMonths("");
      setFormEligibilityCriteria("");
      setFormStatus("ACTIVE");
      setFormDescription("");
      setFormRiders([]);
      setFormBenefits([]);
      setNewRiderName("");
      setNewRiderDesc("");
      setEditingRiderIdx(null);
      setNewBenefitName("");
      setNewBenefitDesc("");
      setEditingBenefitIdx(null);
      setStagedDocuments([]);
      setModalError("");

      if (fromCompanyCreate === "1") {
        setCompanyBannerMessage("Company created successfully. Now add its insurance plan.");
      } else {
        setCompanyBannerMessage("");
      }
    }
  }, [searchParams]);

  const loadPlanDocuments = async (planId) => {
    setDocsLoading(true);
    const res = await api.insurance.getPlanDocuments(planId);
    if (res.ok) {
      setExistingDocuments(Array.isArray(res.data) ? res.data : []);
    } else {
      setExistingDocuments([]);
    }
    setDocsLoading(false);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchPlans();
    }, 350);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedPlan(null);
    setFormName("");
    setFormCode("");
    const defaultCoId = companies.length > 0 ? companies[0].id : "";
    setFormCompanyId(defaultCoId);
    setIsCarrierLocked(false);
    setLockedCompanyName("");
    setCompanyBannerMessage("");
    const defaultCo = companies.find((c) => String(c.id) === String(defaultCoId));
    const initialLob =
      defaultCo?.supported_categories?.[0] || defaultCo?.category || "General Insurance";
    const canonicalLob = getCategoryLabel(initialLob);
    setFormLob(canonicalLob);
    setFormMotorPlanType("Comprehensive");
    setFormSumInsuredMin("");
    setFormSumInsuredMax("");
    setFormPolicyTermMinYears("");
    setFormPolicyTermMaxYears("");
    setFormWaitingPeriodMonths("");
    setFormEligibilityCriteria("");
    setFormStatus("ACTIVE");
    setFormDescription("");
    setFormRiders([]);
    setFormBenefits([]);
    setNewRiderName("");
    setNewRiderDesc("");
    setEditingRiderIdx(null);
    setNewBenefitName("");
    setNewBenefitDesc("");
    setEditingBenefitIdx(null);
    setStagedDocuments([]);
    setModalError("");
    setDocFile(null);
    setDocTitle("");
    setDocDescription("");
    setDocUploadError("");
  };

  const openEditModal = async (p) => {
    setModalMode("edit");
    setSelectedPlan(p);
    setFormName(p.name);
    setFormCode(p.code);
    setFormCompanyId(p.company_id);
    setIsCarrierLocked(false);
    setLockedCompanyName(p.company_name || "");
    setCompanyBannerMessage("");
    const lobLabel = getCategoryLabel(p.line_of_business);
    setFormLob(lobLabel);
    setFormMotorPlanType(p.motor_plan_type || "Comprehensive");
    setFormSumInsuredMin(p.sum_insured_min ?? "");
    setFormSumInsuredMax(p.sum_insured_max ?? "");
    setFormPolicyTermMinYears(p.policy_term_min_years ?? "");
    setFormPolicyTermMaxYears(p.policy_term_max_years ?? "");
    setFormWaitingPeriodMonths(p.waiting_period_months ?? "");
    setFormEligibilityCriteria(p.eligibility_criteria || "");
    setFormStatus(p.status);
    setFormDescription(p.description || "");

    // Helper to safely parse riders from any format
    const parseRidersList = (plan) => {
      if (Array.isArray(plan.plan_riders) && plan.plan_riders.length > 0) {
        return plan.plan_riders.map((r) => ({ id: r.id, name: r.name, description: r.description || "" }));
      }
      let raw = plan.riders;
      if (typeof raw === "string" && raw.trim().startsWith("[") && raw.trim().endsWith("]")) {
        try { raw = JSON.parse(raw); } catch (_) {}
      }
      if (Array.isArray(raw)) {
        return raw
          .map((r) => typeof r === "object" && r !== null ? { id: r.id, name: r.name || "", description: r.description || "" } : { name: String(r), description: "" })
          .filter((r) => r.name && r.name !== "[]" && r.name !== "{}");
      }
      if (typeof raw === "string" && raw.trim()) {
        return raw.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean).filter((n) => n !== "[]" && n !== "{}").map((name) => ({ name, description: "" }));
      }
      return [];
    };

    const parseBenefitsList = (plan) => {
      if (Array.isArray(plan.plan_benefits) && plan.plan_benefits.length > 0) {
        return plan.plan_benefits.map((b) => ({ id: b.id, name: b.name, description: b.description || "" }));
      }
      let raw = plan.benefits;
      if (typeof raw === "string" && raw.trim().startsWith("[") && raw.trim().endsWith("]")) {
        try { raw = JSON.parse(raw); } catch (_) {}
      }
      if (Array.isArray(raw)) {
        return raw
          .map((b) => typeof b === "object" && b !== null ? { id: b.id, name: b.name || "", description: b.description || "" } : { name: String(b), description: "" })
          .filter((b) => b.name && b.name !== "[]" && b.name !== "{}");
      }
      if (typeof raw === "string" && raw.trim()) {
        return raw.split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean).filter((n) => n !== "[]" && n !== "{}").map((name) => ({ name, description: "" }));
      }
      return [];
    };

    setFormRiders(parseRidersList(p));
    setFormBenefits(parseBenefitsList(p));

    setNewRiderName("");
    setNewRiderDesc("");
    setEditingRiderIdx(null);
    setNewBenefitName("");
    setNewBenefitDesc("");
    setEditingBenefitIdx(null);
    setModalError("");
    setStagedDocuments([]);
    setDocFile(null);
    setDocTitle("");
    setDocDescription("");
    setDocUploadError("");
    await loadPlanDocuments(p.id);
  };

  const openViewModal = async (p) => {
    setModalMode("view");
    setSelectedPlan(p);
    setModalError("");
    setViewPlanDocs([]);
    setViewDocsLoading(true);
    const res = await api.insurance.getPlanDocuments(p.id);
    if (res.ok) {
      setViewPlanDocs(Array.isArray(res.data) ? res.data : []);
    }
    setViewDocsLoading(false);
  };

  const openDeleteModal = (p) => {
    setModalMode("delete");
    setSelectedPlan(p);
    setModalError("");
  };

  // Stage a document in Create Mode
  const handleStageDocument = (e) => {
    e?.preventDefault?.();
    setDocUploadError("");

    if (!docFile) {
      setDocUploadError("Please select a file to stage.");
      return;
    }

    const ext = "." + docFile.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setDocUploadError(
        `Unsupported file type '${ext}'. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG.`
      );
      return;
    }

    if (docFile.size > MAX_FILE_SIZE_BYTES) {
      setDocUploadError("File exceeds the 25MB maximum upload limit.");
      return;
    }

    const title = docTitle.trim() || docFile.name;
    const newDoc = {
      id: "staged_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
      file: docFile,
      filename: docFile.name,
      title,
      document_type: docType,
      description: docDescription.trim() || null,
      sizeFormatted: formatFileSize(docFile.size),
      sizeBytes: docFile.size,
    };

    setStagedDocuments((prev) => [...prev, newDoc]);
    setDocFile(null);
    setDocTitle("");
    setDocDescription("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveStagedDocument = (id) => {
    setStagedDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // Upload a document directly in Edit Mode
  const handleUploadDocumentInEditMode = async (e) => {
    e?.preventDefault?.();
    if (!selectedPlan) return;
    setDocUploadError("");

    if (!docFile) {
      setDocUploadError("Please select a file to upload.");
      return;
    }

    const ext = "." + docFile.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setDocUploadError(
        `Unsupported file type '${ext}'. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG.`
      );
      return;
    }

    if (docFile.size > MAX_FILE_SIZE_BYTES) {
      setDocUploadError("File exceeds the 25MB maximum upload limit.");
      return;
    }

    setDocUploadLoading(true);
    const formData = new FormData();
    formData.append("file", docFile);
    formData.append("document_type", docType);
    formData.append("title", (docTitle.trim() || docFile.name));
    if (docDescription.trim()) {
      formData.append("description", docDescription.trim());
    }

    const res = await api.insurance.uploadPlanDocument(selectedPlan.id, formData);
    setDocUploadLoading(false);

    if (res.ok) {
      setDocFile(null);
      setDocTitle("");
      setDocDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadPlanDocuments(selectedPlan.id);
      fetchPlans();
    } else {
      setDocUploadError(res.error || "Failed to upload plan document.");
    }
  };

  // Replace existing document file in Edit Mode
  const handleReplaceDocumentFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !docReplaceId || !selectedPlan) return;

    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      alert(`Unsupported file format '${ext}'. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert("File exceeds 25MB limit.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setDocsLoading(true);
    const res = await api.insurance.updatePlanDocument(selectedPlan.id, docReplaceId, formData);
    setDocsLoading(false);
    setDocReplaceId(null);
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";

    if (res.ok) {
      await loadPlanDocuments(selectedPlan.id);
      fetchPlans();
    } else {
      alert(res.error || "Failed to replace document file.");
    }
  };

  // Delete existing document
  const handleDeleteDocument = async (docId, docTitle) => {
    if (!selectedPlan) return;
    if (!window.confirm(`Are you sure you want to delete the document '${docTitle}'? This cannot be undone.`)) {
      return;
    }

    setDocsLoading(true);
    const res = await api.insurance.deletePlanDocument(selectedPlan.id, docId);
    setDocsLoading(false);

    if (res.ok) {
      await loadPlanDocuments(selectedPlan.id);
      fetchPlans();
    } else {
      alert(res.error || "Failed to delete plan document.");
    }
  };

  // View document inline in browser
  const handleViewDocument = async (planId, docId) => {
    const res = await api.insurance.viewPlanDocumentBlob(planId, docId);
    if (res.ok && res.url) {
      window.open(res.url, "_blank", "noopener,noreferrer");
    } else {
      alert(res.error || "Failed to preview document.");
    }
  };

  // Save Plan (Create or Update)
  const handleSavePlan = async (e) => {
    e.preventDefault();
    const nameCheck = validateName(formName, "Plan Name", true);
    if (!nameCheck.isValid) {
      setModalError(nameCheck.error);
      return;
    }
    if (!formCode.trim() || !formCompanyId) {
      setModalError("Plan code and underwriting company are required.");
      return;
    }

    if (formSumInsuredMin !== "") {
      const minSiCheck = validatePositiveDecimal(formSumInsuredMin, "Minimum Sum Insured", false);
      if (!minSiCheck.isValid) {
        setModalError(minSiCheck.error);
        return;
      }
    }
    if (formSumInsuredMax !== "") {
      const maxSiCheck = validatePositiveDecimal(formSumInsuredMax, "Maximum Sum Insured", false);
      if (!maxSiCheck.isValid) {
        setModalError(maxSiCheck.error);
        return;
      }
    }
    if (formSumInsuredMin !== "" && formSumInsuredMax !== "") {
      if (Number(formSumInsuredMin) > Number(formSumInsuredMax)) {
        setModalError("Minimum Sum Insured cannot exceed Maximum Sum Insured.");
        return;
      }
    }

    if (formPolicyTermMinYears !== "") {
      const minTermCheck = validatePositiveInteger(formPolicyTermMinYears, "Minimum Policy Term (Years)", false);
      if (!minTermCheck.isValid) {
        setModalError(minTermCheck.error);
        return;
      }
    }
    if (formPolicyTermMaxYears !== "") {
      const maxTermCheck = validatePositiveInteger(formPolicyTermMaxYears, "Maximum Policy Term (Years)", false);
      if (!maxTermCheck.isValid) {
        setModalError(maxTermCheck.error);
        return;
      }
    }
    if (formPolicyTermMinYears !== "" && formPolicyTermMaxYears !== "") {
      if (Number(formPolicyTermMinYears) > Number(formPolicyTermMaxYears)) {
        setModalError("Minimum Policy Term cannot exceed Maximum Policy Term.");
        return;
      }
    }

    if (formWaitingPeriodMonths !== "") {
      const wMonths = Number(formWaitingPeriodMonths);
      if (isNaN(wMonths) || wMonths < 0) {
        setModalError("Waiting period months must be a non-negative number.");
        return;
      }
    }

    setModalLoading(true);
    setModalError("");

    // Format dynamic riders and benefits payloads (including any pending typed input)
    const allRiders = [...formRiders];
    if (newRiderName.trim() && !allRiders.some((r) => r.name.toLowerCase() === newRiderName.trim().toLowerCase())) {
      allRiders.push({ name: newRiderName.trim(), description: newRiderDesc.trim() || null });
    }
    const allBenefits = [...formBenefits];
    if (newBenefitName.trim() && !allBenefits.some((b) => b.name.toLowerCase() === newBenefitName.trim().toLowerCase())) {
      allBenefits.push({ name: newBenefitName.trim(), description: newBenefitDesc.trim() || null });
    }

    const ridersPayload = allRiders
      .map((r) => ({
        id: r.id || undefined,
        name: (r.name || "").trim(),
        description: (r.description || "").trim() || null,
      }))
      .filter((r) => r.name.length > 0 && r.name !== "[]" && r.name !== "{}");

    const benefitsPayload = allBenefits
      .map((b) => ({
        id: b.id || undefined,
        name: (b.name || "").trim(),
        description: (b.description || "").trim() || null,
      }))
      .filter((b) => b.name.length > 0 && b.name !== "[]" && b.name !== "{}");

    const co = companies.find((c) => String(c.id) === String(formCompanyId));
    if (co) {
      const supported =
        co.supported_categories && co.supported_categories.length > 0
          ? co.supported_categories
          : [co.category || "General Insurance"];
      const isSupported = supported.some((sc) => categoriesMatch(sc, formLob));
      if (!isSupported) {
        setModalLoading(false);
        setModalError(
          `Cannot add a ${formLob} plan to carrier '${co.name}'. Carrier supports: ${supported
            .map(getCategoryLabel)
            .join(", ")}.`
        );
        return;
      }
    }

    const isMotor = getCategoryCode(formLob) === "MOTOR";
    const isHealth = getCategoryCode(formLob) === "HEALTH";

    const payload = {
      name: formName.trim(),
      code: formCode.trim().toUpperCase(),
      company_id: formCompanyId,
      line_of_business: formLob,
      plan_subcategory: null,
      motor_plan_type: isMotor ? formMotorPlanType || null : null,
      sum_insured_min:
        formSumInsuredMin !== "" && !isNaN(Number(formSumInsuredMin))
          ? Number(formSumInsuredMin)
          : null,
      sum_insured_max:
        formSumInsuredMax !== "" && !isNaN(Number(formSumInsuredMax))
          ? Number(formSumInsuredMax)
          : null,
      policy_term_min_years:
        formPolicyTermMinYears !== "" && !isNaN(Number(formPolicyTermMinYears))
          ? Number(formPolicyTermMinYears)
          : null,
      policy_term_max_years:
        formPolicyTermMaxYears !== "" && !isNaN(Number(formPolicyTermMaxYears))
          ? Number(formPolicyTermMaxYears)
          : null,
      waiting_period_months:
        isHealth && formWaitingPeriodMonths !== "" && !isNaN(Number(formWaitingPeriodMonths))
          ? Number(formWaitingPeriodMonths)
          : null,
      eligibility_criteria: formEligibilityCriteria.trim() || null,
      status: formStatus,
      description: formDescription.trim() || null,
      riders: ridersPayload.length > 0 ? ridersPayload : [],
      benefits: benefitsPayload.length > 0 ? benefitsPayload : [],
    };

    if (modalMode === "create") {
      // Step 1: Create Plan
      const res = await api.insurance.createPlan(payload);
      if (!res.ok) {
        setModalLoading(false);
        setModalError(res.error || "Failed to create insurance plan.");
        return;
      }

      const createdPlan = res.data;

      // Step 2: Upload staged documents if any
      let uploadedCount = 0;
      let failedDocs = [];

      if (stagedDocuments.length > 0) {
        for (const sDoc of stagedDocuments) {
          const formData = new FormData();
          formData.append("file", sDoc.file);
          formData.append("document_type", sDoc.document_type);
          formData.append("title", sDoc.title);
          if (sDoc.description) {
            formData.append("description", sDoc.description);
          }
          const uploadRes = await api.insurance.uploadPlanDocument(createdPlan.id, formData);
          if (uploadRes.ok) {
            uploadedCount++;
          } else {
            failedDocs.push(`${sDoc.title} (${uploadRes.error || "Failed"})`);
          }
        }
      }

      setModalLoading(false);

      if (failedDocs.length > 0) {
        setActionSuccess(
          `Plan '${createdPlan.name}' was created with ${uploadedCount} document(s). Warning: ${failedDocs.length} attachment(s) failed: ${failedDocs.join(", ")}`
        );
      } else {
        setActionSuccess(
          `Plan '${createdPlan.name}' (${createdPlan.code}) created successfully with ${uploadedCount} document(s).`
        );
      }

      setModalMode(null);
      setStagedDocuments([]);
      setCompanyBannerMessage("");
      // Clean search params
      setSearchParams({});
      fetchPlans();
      setTimeout(() => setActionSuccess(""), 5000);
    } else {
      // Edit Mode
      const res = await api.insurance.updatePlan(selectedPlan.id, payload);
      setModalLoading(false);
      if (res.ok) {
        setActionSuccess(`Plan '${res.data.name}' updated successfully.`);
        setModalMode(null);
        fetchPlans();
        setTimeout(() => setActionSuccess(""), 4000);
      } else {
        setModalError(res.error || "Failed to update plan.");
      }
    }
  };

  const handleToggleStatus = async (p) => {
    if (!canMutate) return;
    const nextStatus = p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await api.insurance.updatePlanStatus(p.id, nextStatus);
    if (res.ok) {
      setActionSuccess(`Plan '${p.name}' is now ${nextStatus}.`);
      fetchPlans();
      setTimeout(() => setActionSuccess(""), 3000);
    } else {
      setTableError(res.error || "Failed to update status.");
    }
  };

  const handleDeletePlan = async () => {
    if (!selectedPlan) return;
    setModalLoading(true);
    setModalError("");

    const res = await api.insurance.deletePlan(selectedPlan.id);
    setModalLoading(false);

    if (res.ok) {
      setActionSuccess(`Plan '${selectedPlan.name}' (${selectedPlan.code}) deleted successfully.`);
      setModalMode(null);
      fetchPlans();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setModalError(res.error || "Cannot delete plan.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input for Replace File action */}
      <input
        type="file"
        ref={replaceFileInputRef}
        onChange={handleReplaceDocumentFile}
        className="hidden"
        accept={ALLOWED_EXTENSIONS.join(",")}
      />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-white via-indigo-50/25 to-white p-6 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500" />
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
              Basic Setup
            </span>
            <span className="text-slate-400 font-medium">Master Data Configuration</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Policy Plans Master</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage insurance plan variants, lines of business, riders, and plan documents repository.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canMutate && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-indigo-500/25 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Policy Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-sm animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess("")}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {tableError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{typeof tableError === "string" ? tableError : tableError?.error || "An error occurred."}</span>
          </div>
          <button
            type="button"
            onClick={() => setTableError("")}
            className="text-rose-700 hover:text-rose-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search plan name or code..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          {/* Carrier Filter */}
          <div>
            <select
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Carriers</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Line of Business Filter */}
          <div>
            <select
              value={lobFilter}
              onChange={(e) => {
                setLobFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Categories</option>
              {LOB_OPTIONS.map((lob) => (
                <option key={lob} value={lob}>
                  {lob}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Plans Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-black uppercase tracking-wider text-[11px]">
              <tr>
                <th
                  onClick={() => handleSort("name")}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Plan Name</span>
                    {sortBy === "name" && (
                      <span className="text-indigo-600 font-bold">{sortOrder === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("code")}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Code</span>
                    {sortBy === "code" && (
                      <span className="text-indigo-600 font-bold">{sortOrder === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Insurance Carrier</th>
                <th
                  onClick={() => handleSort("line_of_business")}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Category</span>
                    {sortBy === "line_of_business" && (
                      <span className="text-indigo-600 font-bold">{sortOrder === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Documents & Riders</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    <span>Loading insurance plans...</span>
                  </td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">No policy plans found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm || companyFilter !== "ALL" || lobFilter !== "ALL" || statusFilter !== "ALL"
                        ? "Try resetting filters or search terms."
                        : "Click 'Add Policy Plan' to create your first plan."}
                    </p>
                  </td>
                </tr>
              ) : (
                plans.map((p) => {
                  const docCount = p.documents_count ?? (p.has_brochure ? 1 : 0) + (p.has_claim_form ? 1 : 0);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        {p.description && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-indigo-700">
                        {p.code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-800">{p.company_name || "—"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {getCategoryLabel(p.line_of_business)}
                        </span>
                      </td>
                      {/* Documents & Riders Badges */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {docCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                              <span>{docCount} doc{docCount === 1 ? "" : "s"}</span>
                            </span>
                          )}
                          {Array.isArray(p.riders) && p.riders.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {p.riders.length} riders
                            </span>
                          )}
                          {docCount === 0 && (!p.riders || p.riders.length === 0) && (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(p)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                            p.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                          }`}
                          title="Click to toggle status"
                        >
                          {p.status === "ACTIVE" ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-400" /> Inactive
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openViewModal(p)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title="View Plan Details & Documents"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Edit Plan & Manage Documents"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {canMutate && (
                            <button
                              type="button"
                              onClick={() => openDeleteModal(p)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Delete Plan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            Page {page} of {totalPages} ({total} plans)
          </span>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>

            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-700 px-2">{page}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CREATE & EDIT POLICY PLAN MODAL */}
      {(modalMode === "create" || modalMode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {modalMode === "create" ? "Add New Policy Plan" : `Edit Plan: ${selectedPlan?.name}`}
                </h3>
                <p className="text-xs text-slate-500">
                  {modalMode === "create"
                    ? "Register a product plan variant and attach official brochures/wording."
                    : "Update plan parameters and manage policy documents."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalMode(null);
                  setCompanyBannerMessage("");
                }}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Workflow Banner from Company Creation */}
            {companyBannerMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-2 text-xs font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{companyBannerMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCompanyBannerMessage("")}
                  className="text-emerald-700 hover:text-emerald-900 font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{typeof modalError === "string" ? modalError : modalError?.error || "Please resolve the highlighted validation errors."}</span>
              </div>
            )}

            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              {/* SECTION 1: CORE PLAN PARTICULARS */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-1">
                  1. Plan Core Specifications
                </h4>

                {/* Plan Name */}
                <div>
                  <label htmlFor="plan-form-name" className="font-semibold text-slate-700 block mb-1">
                    Plan / Product Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="plan-form-name"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Care Supreme, Optima Secure, Jeevan Labh"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                {/* Plan Code & Carrier */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="plan-form-code" className="font-semibold text-slate-700 block mb-1">
                      Unique Plan Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="plan-form-code"
                      required
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="e.g. CARE-SUPR, OPT-SEC, LIC-JEV-LABH"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 uppercase"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="plan-form-company" className="font-semibold text-slate-700">
                        Parent Insurance Carrier <span className="text-rose-500">*</span>
                      </label>
                      {isCarrierLocked && (
                        <button
                          type="button"
                          onClick={() => setIsCarrierLocked(false)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold underline flex items-center gap-0.5"
                        >
                          <Unlock className="w-2.5 h-2.5" />
                          <span>Change Carrier</span>
                        </button>
                      )}
                    </div>

                    {isCarrierLocked ? (
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50/70 text-indigo-950 font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span className="font-semibold">
                            {lockedCompanyName ||
                              companies.find((c) => String(c.id) === String(formCompanyId))?.name ||
                              "Selected Carrier"}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-200/80 text-indigo-800 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Pre-selected</span>
                        </span>
                      </div>
                    ) : (
                      <select
                        id="plan-form-company"
                        required
                        value={formCompanyId}
                        onChange={(e) => {
                          const newCoId = e.target.value;
                          setFormCompanyId(newCoId);
                          const co = companies.find((c) => String(c.id) === String(newCoId));
                          if (co) {
                            const cats =
                              Array.isArray(co.supported_categories) && co.supported_categories.length > 0
                                ? co.supported_categories
                                : [co.category || "General Insurance"];
                            const isStillValid = cats.some((cat) => categoriesMatch(cat, formLob));
                            if (!isStillValid) {
                              const nextLob = getCategoryLabel(cats[0]);
                              setFormLob(nextLob);
                            }
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="">Select active carrier...</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Line of Business & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="plan-form-lob" className="font-semibold text-slate-700 block mb-1">
                      Line of Business / Policy Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="plan-form-lob"
                      value={formLob}
                      onChange={(e) => {
                        const newLob = e.target.value;
                        setFormLob(newLob);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {availableCompanyCategories.map((lob) => {
                        const label = getCategoryLabel(lob);
                        return (
                          <option key={lob} value={label}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                    {selectedParentCompany && (
                      <p className="text-[10.5px] text-slate-400 mt-1">
                        Offering categories supported by {selectedParentCompany.name}.
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="plan-form-status" className="font-semibold text-slate-700 block mb-1">
                      Plan Status
                    </label>
                    <select
                      id="plan-form-status"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>
                </div>

                {/* Category-Specific Specifications & Eligibility */}
                {getCategoryCode(formLob) === "MOTOR" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label htmlFor="plan-form-motor-type" className="font-semibold text-slate-700 block mb-1">
                        Motor Coverage Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        id="plan-form-motor-type"
                        value={formMotorPlanType}
                        onChange={(e) => setFormMotorPlanType(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                      >
                        {MOTOR_PLAN_TYPES.map((mType) => (
                          <option key={mType} value={mType}>
                            {mType}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="plan-form-eligibility" className="font-semibold text-slate-700 block mb-1">
                        Eligibility Criteria
                      </label>
                      <input
                        type="text"
                        id="plan-form-eligibility"
                        value={formEligibilityCriteria}
                        onChange={(e) => setFormEligibilityCriteria(e.target.value)}
                        placeholder="e.g. Age 18-65 yrs, Resident Indian"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                      />
                    </div>
                  </div>
                ) : getCategoryCode(formLob) === "HEALTH" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label htmlFor="plan-form-waiting-period" className="font-semibold text-slate-700 block mb-1">
                        Initial Waiting Period (Months)
                      </label>
                      <input
                        type="number"
                        id="plan-form-waiting-period"
                        value={formWaitingPeriodMonths}
                        onChange={(e) => setFormWaitingPeriodMonths(e.target.value)}
                        placeholder="e.g. 1 / 12 / 24 / 36 months"
                        min="0"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="plan-form-eligibility" className="font-semibold text-slate-700 block mb-1">
                        Eligibility Criteria
                      </label>
                      <input
                        type="text"
                        id="plan-form-eligibility"
                        value={formEligibilityCriteria}
                        onChange={(e) => setFormEligibilityCriteria(e.target.value)}
                        placeholder="e.g. Age 18-65 yrs, Resident Indian"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="pt-1">
                    <label htmlFor="plan-form-eligibility" className="font-semibold text-slate-700 block mb-1">
                      Eligibility Criteria
                    </label>
                    <input
                      type="text"
                      id="plan-form-eligibility"
                      value={formEligibilityCriteria}
                      onChange={(e) => setFormEligibilityCriteria(e.target.value)}
                      placeholder="e.g. Age 18-65 yrs, Resident Indian"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                    />
                  </div>
                )}

                {/* Sum Insured Range & Policy Term Limits */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Min Sum Insured (₹)</label>
                    <input
                      type="number"
                      value={formSumInsuredMin}
                      onChange={(e) => setFormSumInsuredMin(e.target.value)}
                      placeholder="e.g. 100000"
                      min="0"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Max Sum Insured (₹)</label>
                    <input
                      type="number"
                      value={formSumInsuredMax}
                      onChange={(e) => setFormSumInsuredMax(e.target.value)}
                      placeholder="e.g. 10000000"
                      min="0"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Min Term (Yrs)</label>
                    <input
                      type="number"
                      value={formPolicyTermMinYears}
                      onChange={(e) => setFormPolicyTermMinYears(e.target.value)}
                      placeholder="1"
                      min="1"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Max Term (Yrs)</label>
                    <input
                      type="number"
                      value={formPolicyTermMaxYears}
                      onChange={(e) => setFormPolicyTermMaxYears(e.target.value)}
                      placeholder="3"
                      min="1"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: DYNAMIC RIDERS & COVERAGE OPTIONS */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-600" />
                    <span>2. Riders & Coverage Options</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Dynamic option-based plan covers
                  </span>
                </div>

                {/* Sub-section 2.1: Riders & Add-on Covers */}
                <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-600" />
                        <span>Riders & Add-on Covers</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          {formRiders.length}
                        </span>
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Define optional riders (e.g. Critical Illness, Hospital Daily Cash) available for policy selection.
                      </p>
                    </div>
                  </div>

                  {/* Add Rider Input Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        value={newRiderName}
                        onChange={(e) => setNewRiderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddRider();
                          }
                        }}
                        placeholder="Rider Name (e.g. Critical Illness Rider)"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        value={newRiderDesc}
                        onChange={(e) => setNewRiderDesc(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddRider();
                          }
                        }}
                        placeholder="Optional rider details or payout conditions"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddRider}
                        disabled={!newRiderName.trim()}
                        className="w-full h-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Rider</span>
                      </button>
                    </div>
                  </div>

                  {/* Configured Riders List */}
                  {formRiders.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {formRiders.map((rider, idx) => (
                        <div
                          key={rider.id || idx}
                          className="p-2.5 rounded-lg border border-amber-200/80 bg-amber-50/40 hover:bg-amber-50/70 transition-colors flex flex-col justify-between text-xs"
                        >
                          {editingRiderIdx === idx ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editRiderName}
                                onChange={(e) => setEditRiderName(e.target.value)}
                                className="w-full px-2 py-1 text-xs rounded border border-amber-300 bg-white font-medium text-slate-900"
                                placeholder="Rider Name"
                              />
                              <input
                                type="text"
                                value={editRiderDesc}
                                onChange={(e) => setEditRiderDesc(e.target.value)}
                                className="w-full px-2 py-1 text-xs rounded border border-amber-300 bg-white text-slate-900"
                                placeholder="Description"
                              />
                              <div className="flex justify-end gap-1 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingRiderIdx(null)}
                                  className="px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 hover:bg-slate-200"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEditRider(idx)}
                                  disabled={!editRiderName.trim()}
                                  className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-amber-600 text-white hover:bg-amber-700 flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Save</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-900 truncate">
                                    {rider.name}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-200/80 text-amber-900 shrink-0">
                                    Add-on
                                  </span>
                                </div>
                                {rider.description ? (
                                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                                    {rider.description}
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-slate-400 italic mt-0.5">
                                    No description provided
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => startEditRider(idx)}
                                  className="p-1 rounded text-slate-400 hover:text-amber-700 hover:bg-amber-100/60"
                                  title="Edit Rider"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRider(idx)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                  title="Remove Rider"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-3 px-3 rounded-lg border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                      No optional riders configured yet. Add riders above to offer them during policy issuance.
                    </div>
                  )}
                </div>

                {/* Sub-section 2.2: Coverage Benefits */}
                <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Coverage Benefits & Highlights</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                          {formBenefits.length}
                        </span>
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Key built-in features & coverages included in this base plan.
                      </p>
                    </div>
                  </div>

                  {/* Add Benefit Input Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        value={newBenefitName}
                        onChange={(e) => setNewBenefitName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddBenefit();
                          }
                        }}
                        placeholder="Benefit Name (e.g. 100% SI Restoration)"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        value={newBenefitDesc}
                        onChange={(e) => setNewBenefitDesc(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddBenefit();
                          }
                        }}
                        placeholder="Optional benefit terms or coverage clause"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddBenefit}
                        disabled={!newBenefitName.trim()}
                        className="w-full h-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Benefit</span>
                      </button>
                    </div>
                  </div>

                  {/* Configured Benefits List */}
                  {formBenefits.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {formBenefits.map((benefit, idx) => (
                        <div
                          key={benefit.id || idx}
                          className="p-2.5 rounded-lg border border-indigo-100 bg-white hover:border-indigo-200 transition-colors flex flex-col justify-between text-xs shadow-2xs"
                        >
                          {editingBenefitIdx === idx ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editBenefitName}
                                onChange={(e) => setEditBenefitName(e.target.value)}
                                className="w-full px-2 py-1 text-xs rounded border border-indigo-300 bg-white font-medium text-slate-900"
                                placeholder="Benefit Name"
                              />
                              <input
                                type="text"
                                value={editBenefitDesc}
                                onChange={(e) => setEditBenefitDesc(e.target.value)}
                                className="w-full px-2 py-1 text-xs rounded border border-indigo-300 bg-white text-slate-900"
                                placeholder="Description"
                              />
                              <div className="flex justify-end gap-1 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingBenefitIdx(null)}
                                  className="px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 hover:bg-slate-200"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEditBenefit(idx)}
                                  disabled={!editBenefitName.trim()}
                                  className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Save</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="font-semibold text-slate-900 truncate">
                                    {benefit.name}
                                  </span>
                                </div>
                                {benefit.description ? (
                                  <p className="text-[11px] text-slate-600 mt-1 pl-5 leading-snug">
                                    {benefit.description}
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-slate-400 italic mt-0.5 pl-5">
                                    Core coverage
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => startEditBenefit(idx)}
                                  className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                  title="Edit Benefit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBenefit(idx)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                  title="Remove Benefit"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-3 px-3 rounded-lg border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                      No coverage benefits added yet. Add key policy highlights above.
                    </div>
                  )}
                </div>

                {/* Sub-section 2.3: Remarks / Underwriting Notes */}
                <div>
                  <label htmlFor="plan-form-description" className="font-semibold text-slate-700 block mb-1">
                    Plan Description & Underwriting Remarks
                  </label>
                  <textarea
                    id="plan-form-description"
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Waiting period details, co-pay clauses, entry age criteria..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* SECTION 3: PLAN DOCUMENTS & ATTACHMENTS (PHASE 4) */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-indigo-600" />
                    <span>Plan Documents & Attachments</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Max 25MB)
                  </span>
                </div>

                {/* Upload Form Box */}
                <div className="p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-100 space-y-3">
                  <div className="font-semibold text-indigo-950 text-xs">
                    {modalMode === "create" ? "Stage New Document / Brochure:" : "Upload New Document to this Plan:"}
                  </div>

                  {docUploadError && (
                    <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[11px]">
                      {typeof docUploadError === "string" ? docUploadError : docUploadError?.error || "Upload error."}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Document Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 bg-white"
                      >
                        {PLAN_DOCUMENT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Document Title (Optional)
                      </label>
                      <input
                        type="text"
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                        placeholder="e.g. Official Brochure 2026"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Select File <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept={ALLOWED_EXTENSIONS.join(",")}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setDocFile(file);
                          if (file && !docTitle) {
                            setDocTitle(file.name.replace(/\.[^/.]+$/, ""));
                          }
                        }}
                        className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
                    <input
                      type="text"
                      value={docDescription}
                      onChange={(e) => setDocDescription(e.target.value)}
                      placeholder="Optional brief remarks or version tag..."
                      className="w-full sm:w-2/3 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 bg-white"
                    />

                    <button
                      type="button"
                      disabled={!docFile || docUploadLoading}
                      onClick={modalMode === "create" ? handleStageDocument : handleUploadDocumentInEditMode}
                      className="w-full sm:w-auto px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors shrink-0 disabled:opacity-40"
                    >
                      {docUploadLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>{modalMode === "create" ? "Add to Staged Documents" : "Upload Document"}</span>
                    </button>
                  </div>
                </div>

                {/* CREATE MODE: STAGED DOCUMENTS TABLE */}
                {modalMode === "create" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Staged Documents ({stagedDocuments.length})</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        Documents will upload automatically when you click 'Save Plan'.
                      </span>
                    </div>

                    {stagedDocuments.length > 0 ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                            <tr>
                              <th className="py-2 px-3">Title / Name</th>
                              <th className="py-2 px-3">Category</th>
                              <th className="py-2 px-3">Filename</th>
                              <th className="py-2 px-3">Size</th>
                              <th className="py-2 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {stagedDocuments.map((sDoc) => (
                              <tr key={sDoc.id} className="hover:bg-slate-50/70">
                                <td className="py-2 px-3 font-medium text-slate-800">{sDoc.title}</td>
                                <td className="py-2 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getDocTypeBadgeClass(
                                      sDoc.document_type
                                    )}`}
                                  >
                                    {sDoc.document_type}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-500 font-mono text-[11px] truncate max-w-xs">
                                  {sDoc.filename}
                                </td>
                                <td className="py-2 px-3 text-slate-500 font-mono">{sDoc.sizeFormatted}</td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStagedDocument(sDoc.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                    title="Remove staged document"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 bg-slate-50/50">
                        No documents staged yet. Use the selector above to add brochures, claim forms or wordings.
                      </div>
                    )}
                  </div>
                )}

                {/* EDIT MODE: EXISTING DOCUMENTS TABLE */}
                {modalMode === "edit" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Attached Plan Documents ({existingDocuments.length})</span>
                      {docsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />}
                    </div>

                    {existingDocuments.length > 0 ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                            <tr>
                              <th className="py-2 px-3">Title</th>
                              <th className="py-2 px-3">Category</th>
                              <th className="py-2 px-3">Filename & Size</th>
                              <th className="py-2 px-3">Uploaded</th>
                              <th className="py-2 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {existingDocuments.map((doc) => (
                              <tr key={doc.id} className="hover:bg-slate-50/70">
                                <td className="py-2 px-3 font-medium text-slate-800">{doc.title}</td>
                                <td className="py-2 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getDocTypeBadgeClass(
                                      doc.document_type
                                    )}`}
                                  >
                                    {doc.document_type}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  <span className="font-mono text-[11px] text-slate-700 block truncate max-w-xs">
                                    {doc.original_filename}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {formatFileSize(doc.file_size_bytes)}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-500">
                                  <div>{doc.created_at ? doc.created_at.slice(0, 10) : "—"}</div>
                                  <div className="text-[10px] text-slate-400">
                                    {doc.uploaded_by_name || "System"}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleViewDocument(selectedPlan.id, doc.id)}
                                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                      title="Preview document"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        api.insurance.downloadPlanDocument(
                                          selectedPlan.id,
                                          doc.id,
                                          doc.original_filename
                                        )
                                      }
                                      className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                      title="Download attachment"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                    {canMutate && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDocReplaceId(doc.id);
                                            if (replaceFileInputRef.current) {
                                              replaceFileInputRef.current.click();
                                            }
                                          }}
                                          className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                          title="Replace file"
                                        >
                                          <RefreshCw className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteDocument(doc.id, doc.title)}
                                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                          title="Delete document"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 bg-slate-50/50">
                        No documents currently attached to this plan. Upload one using the form above.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalMode(null);
                    setCompanyBannerMessage("");
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-2 shadow-sm"
                >
                  {modalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {modalMode === "create"
                      ? stagedDocuments.length > 0
                        ? `Save Plan & Upload (${stagedDocuments.length}) Docs`
                        : "Save Plan"
                      : "Update Plan"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MODAL & DOCUMENT REPOSITORY */}
      {modalMode === "view" && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {selectedPlan.code}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                    {getCategoryLabel(selectedPlan.line_of_business)}
                  </span>
                  {selectedPlan.motor_plan_type && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      {selectedPlan.motor_plan_type}
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedPlan.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {selectedPlan.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedPlan.name}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Carrier: {selectedPlan.company_name || "—"}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Specifications Box */}
            {(selectedPlan.sum_insured_min ||
              selectedPlan.sum_insured_max ||
              selectedPlan.policy_term_min_years ||
              selectedPlan.waiting_period_months != null ||
              selectedPlan.eligibility_criteria) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                {(selectedPlan.sum_insured_min || selectedPlan.sum_insured_max) && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Sum Insured Range</span>
                    <span className="font-semibold text-slate-800">
                      ₹{selectedPlan.sum_insured_min ? Number(selectedPlan.sum_insured_min).toLocaleString() : "0"} - ₹{selectedPlan.sum_insured_max ? Number(selectedPlan.sum_insured_max).toLocaleString() : "Open"}
                    </span>
                  </div>
                )}
                {(selectedPlan.policy_term_min_years || selectedPlan.policy_term_max_years) && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Policy Term</span>
                    <span className="font-semibold text-slate-800">
                      {selectedPlan.policy_term_min_years || 1} to {selectedPlan.policy_term_max_years || 1} Year(s)
                    </span>
                  </div>
                )}
                {selectedPlan.waiting_period_months != null && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Waiting Period</span>
                    <span className="font-semibold text-slate-800">{selectedPlan.waiting_period_months} Months</span>
                  </div>
                )}
                {selectedPlan.eligibility_criteria && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Eligibility</span>
                    <span className="font-semibold text-slate-800 truncate block">{selectedPlan.eligibility_criteria}</span>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {selectedPlan.description && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                <span className="font-semibold text-slate-900 block mb-1">Description:</span>
                <p className="leading-relaxed">{selectedPlan.description}</p>
              </div>
            )}

            {/* Riders Section */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  Riders & Add-on Covers ({
                    (selectedPlan.plan_riders?.length || selectedPlan.riders?.length) || 0
                  })
                </span>
              </h4>
              {((selectedPlan.plan_riders && selectedPlan.plan_riders.length > 0) ||
                (Array.isArray(selectedPlan.riders) && selectedPlan.riders.length > 0)) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(selectedPlan.plan_riders && selectedPlan.plan_riders.length > 0
                    ? selectedPlan.plan_riders
                    : selectedPlan.riders
                  ).map((r, i) => {
                    const rName = typeof r === "object" ? r.name : String(r);
                    const rDesc = typeof r === "object" ? r.description : null;
                    return (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg text-xs bg-amber-50/60 text-amber-950 border border-amber-200"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-slate-900">{rName}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-200/80 text-amber-900">
                            Add-on
                          </span>
                        </div>
                        {rDesc && <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{rDesc}</p>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No optional riders configured for this plan.</p>
              )}
            </div>

            {/* Key Benefits Section */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>
                  Key Coverage Highlights ({
                    (selectedPlan.plan_benefits?.length || selectedPlan.benefits?.length) || 0
                  })
                </span>
              </h4>
              {((selectedPlan.plan_benefits && selectedPlan.plan_benefits.length > 0) ||
                (Array.isArray(selectedPlan.benefits) && selectedPlan.benefits.length > 0)) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(selectedPlan.plan_benefits && selectedPlan.plan_benefits.length > 0
                    ? selectedPlan.plan_benefits
                    : selectedPlan.benefits
                  ).map((b, i) => {
                    const bName = typeof b === "object" ? b.name : String(b);
                    const bDesc = typeof b === "object" ? b.description : null;
                    return (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg text-xs bg-slate-50 border border-slate-200"
                      >
                        <div className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-slate-900">{bName}</span>
                            {bDesc && <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{bDesc}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No specific benefits listed.</p>
              )}
            </div>

            {/* Plan Documents Repository */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-indigo-600" />
                  <span>Plan Documents & Official Attachments ({viewPlanDocs.length})</span>
                </h4>
                {viewDocsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />}
              </div>

              {viewPlanDocs.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Title / Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">File</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">Uploaded</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewPlanDocs.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{doc.title}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getDocTypeBadgeClass(
                                doc.document_type
                              )}`}
                            >
                              {doc.document_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 truncate max-w-xs">
                            {doc.original_filename}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">
                            {formatFileSize(doc.file_size_bytes)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {doc.created_at ? doc.created_at.slice(0, 10) : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleViewDocument(selectedPlan.id, doc.id)}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3 text-indigo-600" />
                                <span>Preview</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  api.insurance.downloadPlanDocument(
                                    selectedPlan.id,
                                    doc.id,
                                    doc.original_filename
                                  )
                                }
                                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500 bg-slate-50/50">
                  <p>No documents uploaded for this plan yet.</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {modalMode === "delete" && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">Delete Insurance Plan</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently delete plan{" "}
                <span className="font-bold text-slate-800 font-mono">'{selectedPlan.code}'</span> ({selectedPlan.name})?
              </p>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {typeof modalError === "string" ? modalError : modalError?.error || "Error occurred."}
              </div>
            )}

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <p className="font-semibold mb-0.5">Integrity Guard:</p>
              <p>
                Plans referenced by existing policies cannot be deleted and will trigger a conflict error. To retain
                historical records, deactivate the plan instead.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalLoading}
                onClick={handleDeletePlan}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
              >
                {modalLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
