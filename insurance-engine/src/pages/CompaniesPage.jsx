import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import {
  Building2,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  FileText,
  Download,
  Upload,
  FileSpreadsheet,
  Calendar,
  UserCheck,
  Shield,
  FileCheck,
} from "lucide-react";
import {
  COMPANY_TYPES,
  SUPPORTED_CATEGORY_OPTIONS,
  COMPANY_TYPE_ALLOWED_CATEGORIES,
  INSURANCE_CATEGORIES,
  getCategoryLabel,
  getCategoryCode,
  categoriesMatch,
  getAllowedCategoriesForCompanyType,
  validateCompanyTypeCategories,
} from "../utils/insuranceCategories";
import { DatePicker, FormInput } from "../components/common";
import {
  validateIndianMobile,
  validateEmail,
  validateName,
  validateDateOrder,
  formatDisplayDate,
} from "../utils/validation";

const COMPANY_CATEGORY_OPTIONS = [
  ...INSURANCE_CATEGORIES.map((c) => c.label),
  "Composite",
];

const CATEGORIES = ["ALL", ...COMPANY_CATEGORY_OPTIONS];

const DOC_TYPES = [
  "Tie-up Agreement",
  "IRDAI License",
  "Commission Schedule",
  "SLA Document",
  "Contact Escalation Matrix",
  "Compliance Certificate",
  "Other",
];

export default function CompaniesPage() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const canMutate = isAdmin || isSuperAdmin;

  // Table State
  const [companies, setCompanies] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [companyTypeFilter, setCompanyTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState("");
  const { showSuccess, showError } = useNotification();
  const [actionSuccess, setActionSuccessState] = useState("");
  const setActionSuccess = (msg) => { setActionSuccessState(msg); if (msg) showSuccess(msg); };
  const [exportLoading, setExportLoading] = useState(false);

  // Modal State
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | 'view' | 'delete' | 'seed'
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [viewCompanyDetails, setViewCompanyDetails] = useState(null);
  const navigate = useNavigate();
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  // Documents state for View Modal
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDocType, setUploadDocType] = useState("Tie-up Agreement");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Form Fields - Core
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formAutoCode, setFormAutoCode] = useState(true);
  const [formCompanyType, setFormCompanyType] = useState("General Insurance");
  const [formSupportedCategories, setFormSupportedCategories] = useState([
    "Health Insurance",
    "Motor Insurance",
    "Travel Insurance",
  ]);
  const [formOverrideCompatibility, setFormOverrideCompatibility] = useState(false);
  const [formCategory, setFormCategory] = useState("Life Insurance");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formContact, setFormContact] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Form Fields - Enterprise Extensions
  const [formAgentName, setFormAgentName] = useState("");
  const [formAgentContactNumber, setFormAgentContactNumber] = useState("");
  const [formAgentCode, setFormAgentCode] = useState("");
  const [formAgentEmail, setFormAgentEmail] = useState("");
  const [formTieupDate, setFormTieupDate] = useState("");
  const [formTieupRenewalDate, setFormTieupRenewalDate] = useState("");
  const [formRenewalTeamContact, setFormRenewalTeamContact] = useState("");
  const [formRenewalContactPerson, setFormRenewalContactPerson] = useState("");
  const [formRenewalContactMobile, setFormRenewalContactMobile] = useState("");
  const [formRenewalContactEmail, setFormRenewalContactEmail] = useState("");
  const [formClaimsTeamContact, setFormClaimsTeamContact] = useState("");
  const [formClaimsContactPerson, setFormClaimsContactPerson] = useState("");
  const [formClaimsContactMobile, setFormClaimsContactMobile] = useState("");
  const [formClaimsContactEmail, setFormClaimsContactEmail] = useState("");
  const [formKamName, setFormKamName] = useState("");
  const [formKamMobile, setFormKamMobile] = useState("");
  const [formKamEmail, setFormKamEmail] = useState("");
  const [formWebsite, setFormWebsite] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Search debounce ref
  const searchTimeoutRef = useRef(null);

  const fetchCompanies = async () => {
    setLoading(true);
    setTableError("");
    const res = await api.insurance.getCompanies({
      search: searchTerm.trim() || undefined,
      category: categoryFilter,
      company_type: companyTypeFilter !== "ALL" ? companyTypeFilter : undefined,
      status: statusFilter,
      page,
      page_size: pageSize,
      sort_by: sortBy,
      sort_order: sortOrder,
    });

    if (res.ok) {
      setCompanies(res.data.items || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
    } else {
      setTableError(res.error || "Failed to load company records.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCompanies();
  }, [page, pageSize, categoryFilter, companyTypeFilter, statusFilter, sortBy, sortOrder]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchCompanies();
    }, 300);
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


  const handleCompanyTypeChange = (newType) => {
    setFormCompanyType(newType);
    if (!formOverrideCompatibility) {
      const allowed = getAllowedCategoriesForCompanyType(newType);
      const validSelected = formSupportedCategories.filter((cat) =>
        allowed.some((a) => getCategoryCode(a) === getCategoryCode(cat))
      );
      setFormSupportedCategories(validSelected.length > 0 ? validSelected : [...allowed]);
    }
  };

  const handleToggleCategory = (cat) => {
    setFormSupportedCategories((prev) => {
      if (prev.includes(cat)) {
        return prev.filter((c) => c !== cat);
      } else {
        return [...prev, cat];
      }
    });
  };

  const handleAddPolicyPlan = (comp) => {
    const supported =
      comp.supported_categories && comp.supported_categories.length > 0
        ? comp.supported_categories
        : [comp.category || "General Insurance"];
    navigate(
      `/plans?action=new&company_id=${comp.id}&company_name=${encodeURIComponent(
        comp.name
      )}&category=${encodeURIComponent(supported[0] || "")}`
    );
  };

  const buildPayloadAndValidate = () => {
    const errors = {};
    if (!formName.trim()) {
      errors.name = "Company name is required.";
    } else {
      const nameCheck = validateName(formName, "Company Name");
      if (!nameCheck.isValid) errors.name = nameCheck.error;
    }

    if (!formCompanyType) {
      errors.company_type = "Company classification type is required.";
    }

    if (!formSupportedCategories || formSupportedCategories.length === 0) {
      errors.supported_categories = "At least one supported insurance category is required.";
    } else {
      const compatResult = validateCompanyTypeCategories(
        formCompanyType,
        formSupportedCategories,
        formOverrideCompatibility
      );
      if (!compatResult.valid) {
        errors.supported_categories = compatResult.error + " (Check 'Super Admin Override' if authorized).";
      }
    }

    if (formAgentContactNumber) {
      const v = validateIndianMobile(formAgentContactNumber, "Agent Direct Mobile", false);
      if (!v.isValid) errors.agent_contact_number = v.error;
    }
    if (formAgentEmail) {
      const v = validateEmail(formAgentEmail, "Agent Email", false);
      if (!v.isValid) errors.agent_email = v.error;
    }

    if (formRenewalContactMobile) {
      const v = validateIndianMobile(formRenewalContactMobile, "Renewal Team Mobile", false);
      if (!v.isValid) errors.renewal_contact_mobile = v.error;
    }
    if (formRenewalContactEmail) {
      const v = validateEmail(formRenewalContactEmail, "Renewal Team Email", false);
      if (!v.isValid) errors.renewal_contact_email = v.error;
    }

    if (formClaimsContactMobile) {
      const v = validateIndianMobile(formClaimsContactMobile, "Claims Team Mobile", false);
      if (!v.isValid) errors.claims_contact_mobile = v.error;
    }
    if (formClaimsContactEmail) {
      const v = validateEmail(formClaimsContactEmail, "Claims Team Email", false);
      if (!v.isValid) errors.claims_contact_email = v.error;
    }

    if (formKamMobile) {
      const v = validateIndianMobile(formKamMobile, "KAM Mobile", false);
      if (!v.isValid) errors.kam_mobile = v.error;
    }
    if (formKamEmail) {
      const v = validateEmail(formKamEmail, "KAM Email", false);
      if (!v.isValid) errors.kam_email = v.error;
    }

    if (formEmail) {
      const v = validateEmail(formEmail, "Official Company Email", false);
      if (!v.isValid) errors.email = v.error;
    }
    if (formPhone) {
      const v = validateIndianMobile(formPhone, "Helpline Mobile", false);
      if (!v.isValid) errors.phone = v.error;
    }

    if (formTieupDate && formTieupRenewalDate) {
      const v = validateDateOrder(formTieupDate, formTieupRenewalDate, "Tie-up Date", "Tie-up Renewal Date");
      if (!v.isValid) errors.tieup_renewal_date = v.error;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setModalError(Object.values(errors)[0] || "Please resolve highlighted validation errors.");
      return null;
    }

    setFieldErrors({});
    return {
      name: formName.trim(),
      code: formAutoCode ? undefined : formCode.trim().toUpperCase(),
      company_type: formCompanyType,
      supported_categories: formSupportedCategories,
      override_compatibility: formOverrideCompatibility,
      category: formSupportedCategories[0] || formCompanyType,
      is_active: formIsActive,
      contact_person: formKamName.trim() || formContact.trim() || null,
      email: formEmail.trim() || null,
      phone: formPhone.trim() || null,
      website: formWebsite.trim() || null,
      address: formAddress.trim() || null,
      notes: formNotes.trim() || null,
      // Enterprise extensions
      agent_name: formAgentName.trim() || null,
      agent_contact_number: formAgentContactNumber.trim() || null,
      agent_code: formAgentCode.trim() || null,
      agent_email: formAgentEmail.trim() || null,
      tieup_date: formTieupDate || null,
      tieup_renewal_date: formTieupRenewalDate || null,
      renewal_team_contact: formRenewalContactEmail.trim() || formRenewalTeamContact.trim() || null,
      renewal_contact_person: formRenewalContactPerson.trim() || null,
      renewal_contact_mobile: formRenewalContactMobile.trim() || null,
      renewal_contact_email: formRenewalContactEmail.trim() || null,
      claims_team_contact: formClaimsContactEmail.trim() || formClaimsTeamContact.trim() || null,
      claims_contact_person: formClaimsContactPerson.trim() || null,
      claims_contact_mobile: formClaimsContactMobile.trim() || null,
      claims_contact_email: formClaimsContactEmail.trim() || null,
      kam_name: formKamName.trim() || null,
      kam_mobile: formKamMobile.trim() || null,
      kam_email: formKamEmail.trim() || null,
    };
  };

  const handleSaveCompanyAndAddPlan = async (e) => {
    e?.preventDefault?.();
    const payload = buildPayloadAndValidate();
    if (!payload) return;

    setModalLoading(true);
    setModalError("");

    const res = await api.insurance.createCompany(payload);
    setModalLoading(false);

    if (res.ok) {
      const createdCompany = res.data;
      setModalMode(null);
      fetchCompanies();
      navigate(
        `/plans?action=new&company_id=${createdCompany.id}&company_name=${encodeURIComponent(
          createdCompany.name
        )}&category=${encodeURIComponent(createdCompany.supported_categories?.[0] || createdCompany.category || "")}&from_company_create=1`
      );
    } else {
      setModalError(res.error || "Failed to create company. Please fix errors and try again.");
    }
  };

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedCompany(null);
    setFormName("");
    setFormCode("");
    setFormAutoCode(true);
    setFormCompanyType("General Insurance");
    setFormSupportedCategories([
      "Health Insurance",
      "Motor Insurance",
      "Travel Insurance",
      "Property & Home Insurance",
      "Commercial / Business Insurance",
    ]);
    setFormOverrideCompatibility(false);
    setFormCategory("General Insurance");
    setFormIsActive(true);
    setFormContact("");
    setFormEmail("");
    setFormPhone("");
    setFormAddress("");
    setFormNotes("");
    // Enterprise extensions
    setFormAgentName("");
    setFormAgentContactNumber("");
    setFormAgentCode("");
    setFormAgentEmail("");
    setFormTieupDate("");
    setFormTieupRenewalDate("");
    setFormRenewalTeamContact("");
    setFormRenewalContactPerson("");
    setFormRenewalContactMobile("");
    setFormRenewalContactEmail("");
    setFormClaimsTeamContact("");
    setFormClaimsContactPerson("");
    setFormClaimsContactMobile("");
    setFormClaimsContactEmail("");
    setFormKamName("");
    setFormKamMobile("");
    setFormKamEmail("");
    setFormWebsite("");
    setFieldErrors({});
    setModalError("");
  };

  const openEditModal = (comp) => {
    setModalMode("edit");
    setSelectedCompany(comp);
    setFormName(comp.name);
    setFormCode(comp.code);
    setFormAutoCode(false);
    setFormCompanyType(comp.company_type || "General Insurance");
    const existingCats =
      comp.supported_categories && comp.supported_categories.length > 0
        ? comp.supported_categories
        : [comp.category || "General Insurance"];
    setFormSupportedCategories(existingCats);
    setFormOverrideCompatibility(false);
    setFormCategory(comp.category);
    setFormIsActive(comp.is_active);
    setFormContact(comp.contact_person || "");
    setFormEmail(comp.email || "");
    setFormPhone(comp.phone || "");
    setFormAddress(comp.address || "");
    setFormNotes(comp.notes || "");
    // Enterprise extensions
    setFormAgentName(comp.agent_name || "");
    setFormAgentContactNumber(comp.agent_contact_number || "");
    setFormAgentCode(comp.agent_code || "");
    setFormAgentEmail(comp.agent_email || "");
    setFormTieupDate(comp.tieup_date ? comp.tieup_date.slice(0, 10) : "");
    setFormTieupRenewalDate(comp.tieup_renewal_date ? comp.tieup_renewal_date.slice(0, 10) : "");
    setFormRenewalTeamContact(comp.renewal_team_contact || "");
    setFormRenewalContactPerson(comp.renewal_contact_person || "");
    setFormRenewalContactMobile(comp.renewal_contact_mobile || "");
    setFormRenewalContactEmail(comp.renewal_contact_email || "");
    setFormClaimsTeamContact(comp.claims_team_contact || "");
    setFormClaimsContactPerson(comp.claims_contact_person || "");
    setFormClaimsContactMobile(comp.claims_contact_mobile || "");
    setFormClaimsContactEmail(comp.claims_contact_email || "");
    setFormKamName(comp.kam_name || comp.contact_person || "");
    setFormKamMobile(comp.kam_mobile || "");
    setFormKamEmail(comp.kam_email || "");
    setFormWebsite(comp.website || "");
    setFieldErrors({});
    setModalError("");
  };

  const loadDocuments = async (companyId) => {
    setDocsLoading(true);
    const res = await api.insurance.getCompanyDocuments(companyId);
    if (res.ok) {
      setDocuments(Array.isArray(res.data) ? res.data : []);
    } else {
      setDocuments([]);
    }
    setDocsLoading(false);
  };

  const openViewModal = async (comp) => {
    setModalMode("view");
    setSelectedCompany(comp);
    setViewCompanyDetails(comp);
    setModalError("");
    setUploadFile(null);
    setUploadTitle("");
    setUploadNotes("");
    loadDocuments(comp.id);
    const res = await api.insurance.getCompany(comp.id);
    if (res.ok) {
      setViewCompanyDetails(res.data);
    }
  };

  const openDeleteModal = (comp) => {
    setModalMode("delete");
    setSelectedCompany(comp);
    setModalError("");
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    const payload = buildPayloadAndValidate();
    if (!payload) return;

    setModalLoading(true);
    setModalError("");

    let res;
    if (modalMode === "create") {
      res = await api.insurance.createCompany(payload);
    } else {
      res = await api.insurance.updateCompany(selectedCompany.id, payload);
    }

    setModalLoading(false);
    if (res.ok) {
      setActionSuccess(
        modalMode === "create"
          ? `Company '${res.data.name}' (${res.data.code}) created successfully.`
          : `Company '${res.data.name}' updated successfully.`
      );
      setModalMode(null);
      fetchCompanies();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setModalError(res.error || "Operation failed.");
    }
  };

  const handleToggleStatus = async (comp) => {
    const nextStatus = !comp.is_active;
    const confirmMsg = nextStatus
      ? `Reactivate carrier '${comp.name}'?`
      : `Deactivate carrier '${comp.name}'? Existing plans will remain preserved.`;
    if (!window.confirm(confirmMsg)) return;

    const res = await api.insurance.toggleCompanyStatus(comp.id, nextStatus);
    if (res.ok) {
      setActionSuccess(
        `Company '${comp.name}' is now ${nextStatus ? "Active" : "Inactive"}.`
      );
      fetchCompanies();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      alert(res.error || "Failed to update status.");
    }
  };

  const handleDeleteCompany = async () => {
    if (!selectedCompany) return;
    setModalLoading(true);
    setModalError("");

    const res = await api.insurance.deleteCompany(selectedCompany.id);
    setModalLoading(false);

    if (res.ok) {
      setActionSuccess(`Company '${selectedCompany.name}' was permanently deleted.`);
      setModalMode(null);
      fetchCompanies();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setModalError(res.error || "Cannot delete company. Dependency conflict.");
    }
  };

  const handleSeedProviders = async () => {
    setModalLoading(true);
    setModalError("");
    const res = await api.insurance.seedMasterData();
    setModalLoading(false);
    if (res.ok) {
      setActionSuccess("Reference insurance carriers seeded successfully.");
      setModalMode(null);
      fetchCompanies();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setModalError(res.error || "Failed to seed reference carriers.");
    }
  };

  const handleExport = async (format) => {
    setExportLoading(true);
    const res = await api.insurance.downloadCompaniesExport(format, {
      search: searchTerm.trim() || undefined,
      category: categoryFilter,
      status: statusFilter,
    });
    setExportLoading(false);
    if (!res.ok) {
      alert(res.error || `Failed to export companies to ${format.toUpperCase()}`);
    }
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert("Please select a document file to upload.");
      return;
    }
    setUploadingDoc(true);
    const res = await api.insurance.uploadCompanyDocument(
      selectedCompany.id,
      uploadFile,
      uploadDocType,
      uploadTitle || uploadFile.name,
      uploadNotes
    );
    setUploadingDoc(false);
    if (res.ok) {
      setUploadFile(null);
      setUploadTitle("");
      setUploadNotes("");
      loadDocuments(selectedCompany.id);
    } else {
      alert(res.error || "Failed to upload document.");
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    const res = await api.insurance.deleteCompanyDocument(selectedCompany.id, docId);
    if (res.ok) {
      loadDocuments(selectedCompany.id);
    } else {
      alert(res.error || "Failed to delete document.");
    }
  };

  const handleDownloadDoc = (doc) => {
    api.insurance.downloadCompanyDocument(selectedCompany.id, doc.id, doc.file_name);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-white via-indigo-50/25 to-white p-6 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500" />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Basic Setup & Master Data
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span className="text-xs text-slate-500 font-medium">Underwriting Insurance Companies</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-indigo-600" />
            <span>Insurance Companies</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Maintain carrier profiles, IRDAI credentials, agency codes, tie-up lifecycles, and compliance documents.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* CSV Export */}
          <button
            onClick={() => handleExport("csv")}
            disabled={exportLoading}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Export filtered companies as CSV"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>

          {/* Excel Export */}
          <button
            onClick={() => handleExport("excel")}
            disabled={exportLoading}
            className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 border border-emerald-200"
            title="Export filtered companies as Excel-ready CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          {canMutate && (
            <button
              onClick={() => {
                setModalMode("seed");
                setModalError("");
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Seed common providers (LIC, Birla, Care, Star, Digit, Bajaj, Shriram)"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Seed Carriers</span>
            </button>
          )}

          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-500/25 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Company</span>
          </button>
        </div>
      </div>

      {/* Global Success Alert */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by company name, corporate code, agent name..."
              className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl border border-slate-200/90 bg-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 transition-colors font-medium"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200/90 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  Category: {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Company Type Filter */}
          <div>
            <select
              value={companyTypeFilter}
              onChange={(e) => {
                setCompanyTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200/90 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="ALL">All Company Types</option>
              {COMPANY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
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
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200/90 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="ALL">Status: All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Companies Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {tableError && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{tableError}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-black text-[11px]">
              <tr>
                <th
                  onClick={() => handleSort("name")}
                  className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition-colors"
                >
                  Company Name &amp; Code {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("category")}
                  className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition-colors"
                >
                  Classification &amp; Supported Categories {sortBy === "category" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="py-3.5 px-4">Agent / Broker Channel</th>
                <th className="py-3.5 px-4">Tie-up Renewal</th>
                <th className="py-3.5 px-4">Plans / Docs</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    <span>Loading company records...</span>
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No insurance companies found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {searchTerm ? "Try adjusting your search filters" : "Seed standard carriers or add your first provider"}
                    </p>
                  </td>
                </tr>
              ) : (
                companies.map((comp) => (
                  <tr key={comp.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Name & Code */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{comp.name}</div>
                      <div className="font-mono text-[11px] text-indigo-600 font-medium">
                        {comp.code}
                      </div>
                    </td>

                    {/* Classification & Supported Categories */}
                    <td className="py-3 px-4">
                      <div className="space-y-1.5">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                          {comp.company_type || "General Insurance"}
                        </span>
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {(comp.supported_categories && comp.supported_categories.length > 0
                            ? comp.supported_categories
                            : [comp.category]
                          ).map((cat) => (
                            <span
                              key={cat}
                              className="px-1.5 py-0.5 rounded text-[9.5px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {getCategoryLabel(cat)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>

                    {/* Agent / Broker Channel */}
                    <td className="py-3 px-4">
                      {comp.agent_name ? (
                        <div>
                          <div className="font-medium text-slate-900 flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span>{comp.agent_name}</span>
                          </div>
                          {comp.agent_code && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Code: {comp.agent_code}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Direct Carrier</span>
                      )}
                    </td>

                    {/* Tie-up Renewal */}
                    <td className="py-3 px-4">
                      {comp.tieup_renewal_date ? (
                        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{comp.tieup_renewal_date.slice(0, 10)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Plans / Docs Count */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-800" title="Active Plans">
                          {comp.plans_count} plans
                        </span>
                        {comp.documents_count > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {comp.documents_count} docs
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(comp)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                          comp.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                        title="Click to toggle carrier status"
                      >
                        {comp.is_active ? (
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

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAddPolicyPlan(comp)}
                          className="px-2 py-1 rounded text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 inline-flex items-center gap-1 transition-colors"
                          title="Add Policy Plan for this carrier"
                        >
                          <Plus className="w-3 h-3 text-emerald-600" />
                          <span>+ Add Plan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openViewModal(comp)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          title="View 360 Profile & Documents"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(comp)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          title="Edit Company Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {canMutate && (
                          <button
                            type="button"
                            onClick={() => openDeleteModal(comp)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete Company"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            Page {page} of {totalPages} ({total} companies)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold text-slate-700 shadow-2xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold text-slate-700 shadow-2xs"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {(modalMode === "create" || modalMode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {modalMode === "create" ? "Add Insurance Carrier Company" : `Edit Carrier: ${selectedCompany?.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveCompany} className="space-y-4 text-xs">
              {/* SECTION 1: Master Details */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-1">
                  1. Corporate Identity
                </h4>
                <div>
                  <label htmlFor="company-form-name" className="font-semibold text-slate-700 block mb-1">
                    Company Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="company-form-name"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. LIC India, Care Health, Go Digit"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="company-form-code" className="font-semibold text-slate-700">
                        Company Code <span className="text-rose-500">*</span>
                      </label>
                      {modalMode === "create" && (
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={formAutoCode}
                            onChange={(e) => setFormAutoCode(e.target.checked)}
                            className="rounded text-indigo-600 border-slate-300"
                          />
                          <span>Auto-Generate</span>
                        </label>
                      )}
                    </div>
                    <input
                      type="text"
                      id="company-form-code"
                      disabled={modalMode === "create" && formAutoCode}
                      value={modalMode === "create" && formAutoCode ? "Auto-generated on creation" : formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="e.g. LIC-IND, CARE-HLT"
                      className={`w-full px-3 py-2 rounded-lg border text-slate-900 font-mono ${
                        modalMode === "create" && formAutoCode
                          ? "bg-slate-100 text-slate-500 border-slate-200"
                          : "border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      }`}
                    />
                  </div>

                  <div>
                    <label htmlFor="company-form-type" className="font-semibold text-slate-700 block mb-1">
                      Company Type / Legal Classification <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="company-form-type"
                      value={formCompanyType}
                      onChange={(e) => handleCompanyTypeChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    >
                      {COMPANY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Multi-Select Supported Categories */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 block">
                      Supported Insurance Categories <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-indigo-600 font-bold">
                      {formSupportedCategories.length} selected
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Select all lines of business this company is authorized to underwrite. You can create multiple policy plans across any selected category under this single company.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-slate-50/80 rounded-xl border border-slate-200">
                    {SUPPORTED_CATEGORY_OPTIONS.map((cat) => {
                      const allowed = getAllowedCategoriesForCompanyType(formCompanyType);
                      const isAllowed = allowed.some((a) => getCategoryCode(a) === getCategoryCode(cat));
                      const isChecked = formSupportedCategories.includes(cat);
                      return (
                        <label
                          key={cat}
                          className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                            isChecked
                              ? "bg-indigo-50/80 border-indigo-300 text-indigo-950 font-medium shadow-2xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleCategory(cat)}
                            className="mt-0.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-semibold text-slate-900">{cat}</div>
                            {!isAllowed && (
                              <span className="inline-block text-[9.5px] text-amber-700 bg-amber-50 px-1 rounded border border-amber-200 font-normal mt-0.5">
                                Compatibility Exception
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Super Admin Override Exception Toggle */}
                  {canMutate && (
                    <div className="mt-2.5 flex items-center justify-between p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formOverrideCompatibility}
                          onChange={(e) => setFormOverrideCompatibility(e.target.checked)}
                          className="rounded text-amber-600 border-amber-300 focus:ring-amber-500"
                        />
                        <span className="font-bold">Super Admin Compatibility Override</span>
                        <span className="text-amber-800">
                          (Allows exceptions where IRDAI special authorization or composite license permits cross-category underwriting)
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: Agency & Broker Channel Credentials */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-1">
                  2. Agency & Broker Channel Credentials
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Agent / Executive Name</label>
                    <input
                      type="text"
                      value={formAgentName}
                      onChange={(e) => setFormAgentName(e.target.value)}
                      placeholder="e.g. Rajesh Sharma"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <FormInput
                      label="Agent Direct Mobile Number"
                      type="mobile"
                      value={formAgentContactNumber}
                      onChange={(e) => setFormAgentContactNumber(e.target.value)}
                      placeholder="10-digit mobile"
                      error={fieldErrors.agent_contact_number}
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Broker / Agency Code</label>
                    <input
                      type="text"
                      value={formAgentCode}
                      onChange={(e) => setFormAgentCode(e.target.value)}
                      placeholder="e.g. AGY-7782"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <FormInput
                      label="Agent Email Address"
                      type="email"
                      value={formAgentEmail}
                      onChange={(e) => setFormAgentEmail(e.target.value)}
                      placeholder="agent@carrier.com"
                      error={fieldErrors.agent_email}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: Tie-up Agreement Dates */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-1">
                  3. Tie-up Agreement & Renewal Dates
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <DatePicker
                      label="Tie-up Date"
                      value={formTieupDate}
                      onChange={(e) => setFormTieupDate(e.target.value)}
                      placeholder="DD-MM-YYYY"
                    />
                  </div>
                  <div>
                    <DatePicker
                      label="Tie-up Renewal Date"
                      value={formTieupRenewalDate}
                      minDate={formTieupDate}
                      onChange={(e) => setFormTieupRenewalDate(e.target.value)}
                      placeholder="DD-MM-YYYY"
                      error={fieldErrors.tieup_renewal_date}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: Renewal Team Contact */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-1">
                  4. Renewal Team Contact
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Contact Person Name</label>
                    <input
                      type="text"
                      value={formRenewalContactPerson}
                      onChange={(e) => setFormRenewalContactPerson(e.target.value)}
                      placeholder="e.g. Priya Deshmukh"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <FormInput
                      label="Mobile Number"
                      type="mobile"
                      value={formRenewalContactMobile}
                      onChange={(e) => setFormRenewalContactMobile(e.target.value)}
                      placeholder="10-digit mobile"
                      error={fieldErrors.renewal_contact_mobile}
                    />
                  </div>
                  <div>
                    <FormInput
                      label="Email Address"
                      type="email"
                      value={formRenewalContactEmail}
                      onChange={(e) => setFormRenewalContactEmail(e.target.value)}
                      placeholder="renewals@carrier.com"
                      error={fieldErrors.renewal_contact_email}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: Claims Team Contact */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-1">
                  5. Claims Team Contact
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Contact Person Name</label>
                    <input
                      type="text"
                      value={formClaimsContactPerson}
                      onChange={(e) => setFormClaimsContactPerson(e.target.value)}
                      placeholder="e.g. Amit Verma"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <FormInput
                      label="Mobile Number"
                      type="mobile"
                      value={formClaimsContactMobile}
                      onChange={(e) => setFormClaimsContactMobile(e.target.value)}
                      placeholder="10-digit mobile"
                      error={fieldErrors.claims_contact_mobile}
                    />
                  </div>
                  <div>
                    <FormInput
                      label="Email Address"
                      type="email"
                      value={formClaimsContactEmail}
                      onChange={(e) => setFormClaimsContactEmail(e.target.value)}
                      placeholder="claims@carrier.com"
                      error={fieldErrors.claims_contact_email}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 6: Key Account Manager */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-1">
                  6. Key Account Manager (KAM)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Key Account Manager Name</label>
                    <input
                      type="text"
                      value={formKamName}
                      onChange={(e) => setFormKamName(e.target.value)}
                      placeholder="e.g. Vikram Malhotra"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <FormInput
                      label="KAM Mobile Number"
                      type="mobile"
                      value={formKamMobile}
                      onChange={(e) => setFormKamMobile(e.target.value)}
                      placeholder="10-digit mobile"
                      error={fieldErrors.kam_mobile}
                    />
                  </div>
                  <div>
                    <FormInput
                      label="KAM Email Address"
                      type="email"
                      value={formKamEmail}
                      onChange={(e) => setFormKamEmail(e.target.value)}
                      placeholder="kam@carrier.com"
                      error={fieldErrors.kam_email}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 7: Official Company Contact & Location */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-1">
                  7. Official Company Contact & Location
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <FormInput
                      label="Official Company Email"
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="support@carrier.com"
                      error={fieldErrors.email}
                    />
                  </div>
                  <div>
                    <FormInput
                      label="Company Helpline / Mobile"
                      type="mobile"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="10-digit helpline"
                      error={fieldErrors.phone}
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Official Website</label>
                    <input
                      type="text"
                      value={formWebsite}
                      onChange={(e) => setFormWebsite(e.target.value)}
                      placeholder="https://www.carrier.com"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Registered Address</label>
                  <textarea
                    rows={2}
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Head office location..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Internal Notes</label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Underwriting remarks..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              {/* Status Switch */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-800">Carrier is active for underwriting and policy issuance</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                {modalMode === "create" && (
                  <button
                    type="button"
                    onClick={handleSaveCompanyAndAddPlan}
                    disabled={modalLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                    title="Save carrier and immediately open plan creation"
                  >
                    {modalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Save Company & Add Policy Plan</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm"
                >
                  {modalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{modalMode === "create" ? "Save Company" : "Update Company"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MODAL & DOCUMENT MANAGEMENT DRAWER */}
      {modalMode === "view" && selectedCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {selectedCompany.code}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    Type: {viewCompanyDetails?.company_type || selectedCompany.company_type || "General Insurance"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedCompany.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {selectedCompany.is_active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedCompany.name}</h3>

                {/* Supported Categories Pills */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10.5px] font-semibold text-slate-500">Authorized Offerings:</span>
                  {(
                    viewCompanyDetails?.supported_categories ||
                    selectedCompany.supported_categories || [selectedCompany.category]
                  ).map((sc) => (
                    <span
                      key={sc}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
                    >
                      {getCategoryLabel(sc)}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Category-wise Offerings & Plan Count Breakdown */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-indigo-600">
                  Category-wise Offerings &amp; Plan Breakdown
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Total Active Plans: {viewCompanyDetails?.active_plans_count ?? (selectedCompany.is_active ? selectedCompany.plans_count : 0)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {(
                  viewCompanyDetails?.supported_categories ||
                  selectedCompany.supported_categories || [selectedCompany.category]
                ).map((sc) => {
                  const breakdown =
                    viewCompanyDetails?.category_plans_count ||
                    selectedCompany.category_plans_count ||
                    {};
                  const planCnt = breakdown[sc] ?? 0;
                  return (
                    <div
                      key={sc}
                      className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs hover:border-indigo-200 transition-colors"
                    >
                      <div className="text-[10px] text-slate-500 font-semibold truncate">
                        {getCategoryLabel(sc)}
                      </div>
                      <div className="text-base font-extrabold text-slate-900 mt-0.5">
                        {planCnt}{" "}
                        <span className="text-[10px] font-normal text-slate-400">
                          plan{planCnt === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grid Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {/* Box 1: Agency Channel */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                <span className="font-bold text-slate-800 text-[11px] block uppercase tracking-wider text-indigo-600">
                  Agency & Broker Details
                </span>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Agent Name:</span>
                  <span className="font-medium text-slate-800">{selectedCompany.agent_name || "—"}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Agent Mobile:</span>
                  <span className="font-medium text-slate-800">{selectedCompany.agent_contact_number || "—"}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Broker Code:</span>
                  <span className="font-mono font-bold text-indigo-700">{selectedCompany.agent_code || "—"}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Agent Email:</span>
                  <span className="font-medium text-slate-800 truncate max-w-[150px]">{selectedCompany.agent_email || "—"}</span>
                </div>
              </div>

              {/* Box 2: Tie-up Agreement Dates */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                <span className="font-bold text-slate-800 text-[11px] block uppercase tracking-wider text-indigo-600">
                  Tie-up Agreement Dates
                </span>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Tie-up Agreement:</span>
                  <span className="font-medium text-slate-800">
                    {selectedCompany.tieup_date ? formatDisplayDate(selectedCompany.tieup_date) : "—"}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Renewal Date:</span>
                  <span className="font-medium text-indigo-700 font-semibold">
                    {selectedCompany.tieup_renewal_date ? formatDisplayDate(selectedCompany.tieup_renewal_date) : "—"}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Website:</span>
                  <span className="font-medium text-slate-800 truncate max-w-[150px]">{selectedCompany.website || "—"}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Official Helpline:</span>
                  <span className="font-medium text-slate-800">{selectedCompany.phone || "—"}</span>
                </div>
              </div>

              {/* Box 3: Renewal Team Contact */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                <span className="font-bold text-slate-800 text-[11px] block uppercase tracking-wider text-indigo-600">
                  Renewal Team Contact
                </span>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Contact Person:</span>
                  <span className="font-medium text-slate-800">{selectedCompany.renewal_contact_person || "—"}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Mobile:</span>
                  <span className="font-medium text-slate-800">{selectedCompany.renewal_contact_mobile || "—"}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-medium text-slate-800 truncate max-w-[150px]">{selectedCompany.renewal_contact_email || selectedCompany.renewal_team_contact || "—"}</span>
                </div>
              </div>

              {/* Box 4: Claims Team Contact */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                <span className="font-bold text-slate-800 text-[11px] block uppercase tracking-wider text-indigo-600">
                  Claims Team Contact
                </span>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Contact Person:</span>
                  <span className="font-medium text-slate-800">{selectedCompany.claims_contact_person || "—"}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Mobile:</span>
                  <span className="font-medium text-slate-800">{selectedCompany.claims_contact_mobile || "—"}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-medium text-slate-800 truncate max-w-[150px]">{selectedCompany.claims_contact_email || selectedCompany.claims_team_contact || "—"}</span>
                </div>
              </div>

              {/* Box 5: Key Account Manager */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                <span className="font-bold text-slate-800 text-[11px] block uppercase tracking-wider text-indigo-600">
                  Key Account Manager (KAM)
                </span>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Name:</span>
                  <span className="font-medium text-slate-800">{selectedCompany.kam_name || selectedCompany.contact_person || "—"}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Mobile:</span>
                  <span className="font-medium text-slate-800">{selectedCompany.kam_mobile || "—"}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-medium text-slate-800 truncate max-w-[150px]">{selectedCompany.kam_email || "—"}</span>
                </div>
              </div>

              {/* Box 6: Official Company Contact */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                <span className="font-bold text-slate-800 text-[11px] block uppercase tracking-wider text-indigo-600">
                  Official Underwriting Contact
                </span>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-medium text-slate-800 truncate max-w-[150px]">{selectedCompany.email || "—"}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                  <span className="text-slate-400">Helpline:</span>
                  <span className="font-medium text-slate-800">{selectedCompany.phone || "—"}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Address:</span>
                  <span className="font-medium text-slate-800 truncate max-w-[150px]">{selectedCompany.address || "—"}</span>
                </div>
              </div>
            </div>


            {/* ASSOCIATED POLICY PLANS SECTION */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>Associated Policy Plans ({viewCompanyDetails?.plans?.length ?? selectedCompany.plans_count ?? 0})</span>
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active Plans: {viewCompanyDetails?.active_plans_count ?? (selectedCompany.is_active ? selectedCompany.plans_count : 0)}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                      Total Plans: {viewCompanyDetails?.plans?.length ?? selectedCompany.plans_count ?? 0}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalMode(null);
                    handleAddPolicyPlan(selectedCompany);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Policy Plan</span>
                </button>
              </div>

              {viewCompanyDetails?.plans && viewCompanyDetails.plans.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                      <tr>
                        <th className="py-2 px-3">Plan Code</th>
                        <th className="py-2 px-3">Plan Name</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Docs</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewCompanyDetails.plans.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 font-mono font-bold text-indigo-700">{p.code}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{p.name}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">
                              {p.line_of_business}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                p.status === "ACTIVE"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 font-semibold">
                              {p.documents_count || 0} doc{(p.documents_count || 0) === 1 ? "" : "s"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setModalMode(null);
                                navigate(`/plans?search=${encodeURIComponent(p.code)}`);
                              }}
                              className="px-2 py-0.5 rounded text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500 bg-slate-50/50">
                  <p>No policy plans registered under this insurance carrier yet.</p>
                </div>
              )}
            </div>
            {/* DOCUMENT MANAGEMENT SECTION */}
            <div className="pt-2 border-t border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-indigo-600" />
                  <span>Company Documents & Compliance Repository ({documents.length})</span>
                </h4>
              </div>

              {/* Upload Form */}
              <form
                onSubmit={handleUploadDocument}
                className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-3 text-xs"
              >
                <div className="font-semibold text-indigo-900">Upload New Tie-up Document / SLA / Matrix:</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Document Type</label>
                    <select
                      value={uploadDocType}
                      onChange={(e) => setUploadDocType(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
                    >
                      {DOC_TYPES.map((dt) => (
                        <option key={dt} value={dt}>
                          {dt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Title / Label (optional)</label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="e.g. FY 2026-27 Agreement"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Choose File (PDF, PNG, JPG, DOCX)</label>
                    <input
                      type="file"
                      required
                      accept=".pdf,.png,.jpg,.jpeg,.docx"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={uploadingDoc || !uploadFile}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                  >
                    {uploadingDoc ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>Upload Document</span>
                  </button>
                </div>
              </form>

              {/* Documents List */}
              <div className="space-y-2">
                {docsLoading ? (
                  <div className="py-6 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-1" />
                    <span className="text-xs">Loading documents...</span>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                    No documents uploaded yet for this company. Upload tie-up contracts and compliance files above.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 text-xs transition-colors"
                      >
                        <div className="flex items-start gap-2.5">
                          <FileText className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-slate-900">{doc.title || doc.file_name}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-indigo-700 font-medium">{doc.document_type}</span>
                              <span>•</span>
                              <span>{formatFileSize(doc.file_size)}</span>
                              <span>•</span>
                              <span>Uploaded: {doc.created_at ? doc.created_at.slice(0, 10) : "—"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleDownloadDoc(doc)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                            title="Download Document"
                          >
                            <Download className="w-3 h-3 text-slate-600" />
                            <span>Download</span>
                          </button>
                          {canMutate && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDoc(doc.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Delete Document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {modalMode === "delete" && selectedCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Delete Carrier Company?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-slate-900">{selectedCompany.name}</span> ({selectedCompany.code})?
              </p>
              {selectedCompany.plans_count > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs text-left">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    Dependency Warning
                  </p>
                  <p className="mt-1 text-[11px]">
                    This carrier is referenced by {selectedCompany.plans_count} plan(s). Deletion will be rejected by the server to prevent orphaned records.
                    Consider deactivating instead.
                  </p>
                </div>
              )}
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {modalError}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCompany}
                disabled={modalLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1.5"
              >
                {modalLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEED CONFIRMATION MODAL */}
      {modalMode === "seed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Seed Standard Reference Carriers?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                This will idempotently check and insert standard provider examples including:
              </p>
              <div className="mt-3 p-3 bg-slate-50 rounded-xl text-left text-xs text-slate-700 space-y-1 font-medium">
                <div>• LIC India (Life)</div>
                <div>• Birla Sun Life (Life)</div>
                <div>• Care Health (Health)</div>
                <div>• Star Health India (Health)</div>
                <div>• Go Digit (General/Motor)</div>
                <div>• Bajaj Allianz (General/Motor)</div>
                <div>• Shriram General (General/Motor)</div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed italic">
                DISCLAIMER: Provider names are supplied for demonstration and evaluation reference only. No official affiliation or integration is implied.
              </p>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {modalError}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSeedProviders}
                disabled={modalLoading}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5"
              >
                {modalLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Execute Seed</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
