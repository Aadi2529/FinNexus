import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { insuranceAPI, tokenStorage, APP_URLS } from "../services/api";
import { categoriesMatch } from "../utils/insuranceCategories";
import { DatePicker, FormInput } from "../components/common";
import {
  validateIndianMobile,
  validateEmail,
  validateName,
  validatePinCode,
} from "../utils/validation";
import {
  Shield,
  Heart,
  Car,
  Plane,
  Flame,
  Home,
  Anchor,
  Briefcase,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  ExternalLink,
  ArrowLeft,
  RefreshCw,
  Plus,
  Edit2,
  CreditCard,
  DollarSign,
  Users,
  Award,
  AlertTriangle,
  Loader2,
  Sparkles,
  Building2,
  UserCheck,
  ShieldAlert,
  ArrowUpRight,
  X,
  Search,
  Filter,
  Check,
  TrendingUp,
  Receipt,
  UserPlus,
  History,
  FileSpreadsheet,
  Trash2,
  Upload,
  MoreHorizontal,
  FileUp,
} from "lucide-react";

// Format currency as Indian Rupees (INR)
const formatINR = (value) => {
  if (value === null || value === undefined || isNaN(Number(value))) return "₹0";
  const num = Number(value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
};

// Category icon mapper
const getCategoryIcon = (category) => {
  const cat = (category || "").toUpperCase();
  if (cat.includes("HEALTH")) return <Heart className="w-4 h-4 text-rose-500" />;
  if (cat.includes("LIFE")) return <Shield className="w-4 h-4 text-emerald-500" />;
  if (cat.includes("MOTOR") || cat.includes("VEHICLE") || cat.includes("AUTO"))
    return <Car className="w-4 h-4 text-blue-500" />;
  if (cat.includes("TRAVEL")) return <Plane className="w-4 h-4 text-sky-500" />;
  if (cat.includes("FIRE")) return <Flame className="w-4 h-4 text-amber-500" />;
  if (cat.includes("HOME") || cat.includes("PROPERTY"))
    return <Home className="w-4 h-4 text-indigo-500" />;
  if (cat.includes("MARINE") || cat.includes("CARGO"))
    return <Anchor className="w-4 h-4 text-cyan-600" />;
  return <Briefcase className="w-4 h-4 text-purple-500" />;
};

// Status badge helper
const getStatusBadge = (status) => {
  const st = (status || "").toUpperCase();
  switch (st) {
    case "ACTIVE":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Active
        </span>
      );
    case "EXPIRED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Expired
        </span>
      );
    case "RENEWED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          Renewed
        </span>
      );
    case "GRACE_PERIOD":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Grace Period
        </span>
      );
    case "LAPSED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Lapsed
        </span>
      );
    case "CANCELLED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
          Cancelled
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
          {status || "Unknown"}
        </span>
      );
  }
};

export default function Customer360Page() {
  const { id: customerId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  // Sensitive KYC Reveal State
  const [unmaskedKyc, setUnmaskedKyc] = useState(null);
  const [unmasking, setUnmasking] = useState(false);

  // Policy History Filters
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [businessTypeFilter, setBusinessTypeFilter] = useState("ALL");
  const [issueYearFilter, setIssueYearFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedYears, setCollapsedYears] = useState({});

  // Modals: 'policy_detail' | 'upload_doc' | 'view_commission' | 'edit_customer' | 'add_note' | 'preview_doc'
  const [activeModal, setActiveModal] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [previewDocUrl, setPreviewDocUrl] = useState(null);
  const [previewDocTitle, setPreviewDocTitle] = useState("");
  const [uploadDocType, setUploadDocType] = useState("AADHAAR");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState("");

  // Edit Customer Form State
  const [editFormData, setEditFormData] = useState({});
  const [editFormError, setEditFormError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Action Menu Dropdown State
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionMenuRef = useRef(null);

  // Add Note State
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Document Management State
  const [deletingDocId, setDeletingDocId] = useState(null);
  const [verifyingDocId, setVerifyingDocId] = useState(null);

  // Timeline State
  const [expandedTimelineEvents, setExpandedTimelineEvents] = useState({});
  const [timelineFilter, setTimelineFilter] = useState("ALL");
  const [timelineShowAll, setTimelineShowAll] = useState(false);

  // User RBAC permissions
  const userRoles = Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [];
  const canViewCommissions =
    userRoles.includes("SUPER_ADMIN") ||
    userRoles.includes("ADMIN") ||
    userRoles.includes("MANAGER") ||
    user?.role === "SUPER_ADMIN" ||
    user?.role === "ADMIN";
  const canManageDocuments = canViewCommissions;

  // Initialize edit form from customer profile
  const initEditForm = useCallback((cust) => {
    if (!cust) return;
    let dobStr = "";
    if (cust.date_of_birth) {
      dobStr = typeof cust.date_of_birth === "string" ? cust.date_of_birth.substring(0, 10) : new Date(cust.date_of_birth).toISOString().substring(0, 10);
    }
    setEditFormData({
      first_name: cust.first_name || "",
      last_name: cust.last_name || "",
      phone: cust.phone || "",
      alternate_phone: cust.alternate_phone || cust.contact_person_phone || "",
      email: cust.email || "",
      gender: cust.gender || "MALE",
      date_of_birth: dobStr,
      occupation: cust.occupation || "",
      source_of_income: cust.source_of_income || "",
      marital_status: cust.marital_status || "",
      nationality: cust.nationality || "Indian",
      address: cust.address || "",
      city: cust.city || "",
      state: cust.state || "",
      pincode: cust.pincode || "",
      customer_type: cust.customer_type || "INDIVIDUAL",
      company_name: cust.company_name || "",
      corporate_code: cust.corporate_code || "",
      gstin: cust.gstin || "",
      contact_person_name: cust.contact_person_name || "",
      contact_person_phone: cust.contact_person_phone || "",
      contact_person_email: cust.contact_person_email || "",
    });
    setEditFormError("");
  }, []);

  // Close Action Menu on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(e) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setActionMenuOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setActionMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Load Profile Data
  const loadProfile = useCallback(
    async (isBackground = false) => {
      if (!customerId) return;
      if (!isBackground) setLoading(true);
      else setRefreshing(true);
      setFetchError(null);

      try {
        const res = await insuranceAPI.getCustomer360(customerId);
        if (res.ok && res.data) {
          setProfileData(res.data);
          if (res.data.customer) {
            initEditForm(res.data.customer);
          }
        } else {
          setFetchError(res.error || "Failed to load Customer 360 profile.");
        }
      } catch (err) {
        setFetchError(err.message || "Network error loading customer profile.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [customerId, initEditForm]
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Handle Unmask KYC
  const handleToggleUnmaskKyc = async () => {
    if (unmaskedKyc) {
      setUnmaskedKyc(null); // Re-mask
      showInfo("Sensitive KYC details re-masked.");
      return;
    }

    setUnmasking(true);
    try {
      const res = await insuranceAPI.unmaskCustomerKyc(customerId);
      if (res.ok && res.data) {
        setUnmaskedKyc(res.data);
        showSuccess("KYC credentials revealed. Sensitive access logged for auditing.");
      } else {
        showError(res.error || "Access Denied: Enterprise authority required to reveal unmasked KYC.");
      }
    } catch (err) {
      showError(err.message || "Failed to reveal KYC credentials.");
    } finally {
      setUnmasking(false);
    }
  };

  // Handle Document Preview
  const handlePreviewDoc = async (docId, fallbackName) => {
    try {
      showInfo(`Opening preview for ${fallbackName}...`);
      const res = await insuranceAPI.viewCustomerKycBlob(customerId, docId);
      if (res.ok && res.url) {
        setPreviewDocUrl(res.url);
        setPreviewDocTitle(fallbackName);
        setActiveModal("preview_doc");
      } else {
        showError(res.error || "Unable to open document preview. You can still download the file.");
      }
    } catch (err) {
      showError(err.message || "Failed to preview document.");
    }
  };

  // Handle Document Upload
  const handleUploadKycDoc = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setDocUploadError("Please choose a valid file to upload.");
      return;
    }

    setUploadingDoc(true);
    setDocUploadError("");
    try {
      const res = await insuranceAPI.uploadCustomerKyc(customerId, uploadDocType, uploadFile);
      if (res.ok) {
        showSuccess(`Document uploaded successfully: ${uploadFile.name}`);
        setUploadFile(null);
        setActiveModal(null);
        await loadProfile(true);
      } else {
        setDocUploadError(res.error || "Failed to upload document.");
      }
    } catch (err) {
      setDocUploadError(err.message || "Network error during upload.");
    } finally {
      setUploadingDoc(false);
    }
  };

  // Handle Document Verification Toggle
  const handleToggleVerifyDoc = async (docId, currentStatus) => {
    const newStatus = currentStatus === "VERIFIED" ? "UNVERIFIED" : "VERIFIED";
    setVerifyingDocId(docId);
    try {
      const res = await insuranceAPI.verifyCustomerKycDoc(customerId, docId, newStatus);
      if (res.ok) {
        showSuccess(`Document status updated to ${newStatus}.`);
        await loadProfile(true);
      } else {
        showError(res.error || "Failed to update document verification status.");
      }
    } catch (err) {
      showError(err.message || "Error updating document verification status.");
    } finally {
      setVerifyingDocId(null);
    }
  };

  // Handle Document Deletion
  const handleDeleteDoc = async (docId, filename) => {
    if (!window.confirm(`Are you sure you want to permanently delete '${filename}'? This audit event will be recorded.`)) {
      return;
    }
    setDeletingDocId(docId);
    try {
      const res = await insuranceAPI.deleteCustomerKycDoc(customerId, docId);
      if (res.ok) {
        showSuccess(`Document '${filename}' was deleted.`);
        await loadProfile(true);
      } else {
        showError(res.error || "Failed to delete document.");
      }
    } catch (err) {
      showError(err.message || "Error deleting document.");
    } finally {
      setDeletingDocId(null);
    }
  };

  // Open Edit Customer Modal
  const handleOpenEditModal = () => {
    initEditForm(profileData?.customer);
    setActiveModal("edit_customer");
    setActionMenuOpen(false);
  };

  // Handle Save Edit Customer
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setEditFormError("");

    const fnCheck = validateName(editFormData.first_name, "First name", true);
    if (!fnCheck.isValid) {
      setEditFormError(fnCheck.error);
      return;
    }
    if (editFormData.last_name?.trim()) {
      const lnCheck = validateName(editFormData.last_name, "Last name", false);
      if (!lnCheck.isValid) {
        setEditFormError(lnCheck.error);
        return;
      }
    }

    const phoneCheck = validateIndianMobile(editFormData.phone, "Phone number", true);
    if (!phoneCheck.isValid) {
      setEditFormError(phoneCheck.error);
      return;
    }

    if (editFormData.alternate_phone) {
      const altCheck = validateIndianMobile(editFormData.alternate_phone, "Alternate phone", false);
      if (!altCheck.isValid) {
        setEditFormError(altCheck.error);
        return;
      }
    }

    if (editFormData.email) {
      const emailCheck = validateEmail(editFormData.email, "Email address", false);
      if (!emailCheck.isValid) {
        setEditFormError(emailCheck.error);
        return;
      }
    }

    if (editFormData.pincode) {
      const pinCheck = validatePinCode(editFormData.pincode, "PIN code", false);
      if (!pinCheck.isValid) {
        setEditFormError(pinCheck.error);
        return;
      }
    }

    setSavingEdit(true);
    try {
      const res = await insuranceAPI.updateCustomer(customerId, editFormData);
      if (res.ok) {
        showSuccess("Customer details updated successfully.");
        setActiveModal(null);
        await loadProfile(true);
      } else {
        setEditFormError(res.error || "Failed to update customer details.");
        showError(res.error || "Failed to update customer details.");
      }
    } catch (err) {
      setEditFormError(err.message || "Network error updating customer.");
      showError(err.message || "Network error updating customer.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Add Customer Note
  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await insuranceAPI.addCustomerNote(customerId, noteText.trim());
      if (res.ok) {
        showSuccess("Customer note added successfully.");
        setNoteText("");
        setActiveModal(null);
        await loadProfile(true);
      } else {
        showError(res.error || "Failed to add note.");
      }
    } catch (err) {
      showError(err.message || "Error saving note.");
    } finally {
      setSavingNote(false);
    }
  };

  // Export Customer Profile
  const handleExportProfile = () => {
    if (!profileData || !profileData.customer) return;
    try {
      const cust = profileData.customer;
      const exportObj = {
        platform: "FinNexus Insurance Engine",
        export_timestamp: new Date().toISOString(),
        customer: {
          code: cust.customer_code,
          full_name: cust.full_name,
          first_name: cust.first_name,
          last_name: cust.last_name,
          phone: cust.phone,
          alternate_phone: cust.alternate_phone,
          email: cust.email,
          customer_type: cust.customer_type,
          gender: cust.gender,
          date_of_birth: cust.date_of_birth,
          exact_age: cust.exact_age,
          marital_status: cust.marital_status,
          occupation: cust.occupation,
          address: cust.address,
          city: cust.city,
          state: cust.state,
          pincode: cust.pincode,
          company_name: cust.company_name,
          corporate_code: cust.corporate_code,
          gstin: cust.gstin,
          pan: cust.pan_number,
          aadhaar: cust.aadhaar_number,
        },
        kpis: profileData.kpis,
        total_policies: (profileData.policies || []).length,
        policies: (profileData.policies || []).map((p) => ({
          policy_number: p.policy_number,
          insurer: p.company_name,
          plan: p.plan_name,
          category: p.category,
          status: p.status,
          sum_insured: p.sum_insured,
          gross_premium: p.gross_premium,
          issue_date: p.issue_date,
          expiry_date: p.expiry_date,
        })),
        documents: (profileData.documents || []).map((d) => ({
          document_type: d.document_type,
          original_filename: d.original_filename,
          verification_status: d.verification_status,
          uploaded_at: d.created_at,
        })),
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Customer_${cust.customer_code || cust.id}_Profile.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showSuccess("Customer profile exported successfully.");
    } catch (err) {
      showError("Failed to export customer profile.");
    }
  };

  // Toggle Timeline Event Expansion
  const toggleEventExpansion = (evtId) => {
    setExpandedTimelineEvents((prev) => ({
      ...prev,
      [evtId]: !prev[evtId],
    }));
  };

  // Expand / Collapse All Timeline Events
  const handleToggleExpandAllTimeline = () => {
    const currentEvents = profileData?.timeline || [];
    const allExpanded = currentEvents.every((e) => expandedTimelineEvents[e.id]);
    if (allExpanded) {
      setExpandedTimelineEvents({});
    } else {
      const nextState = {};
      currentEvents.forEach((e) => {
        nextState[e.id] = true;
      });
      setExpandedTimelineEvents(nextState);
    }
  };

  // Filtered Policies
  const filteredPolicies = useMemo(() => {
    if (!profileData || !profileData.policies) return [];
    return profileData.policies.filter((p) => {
      // Category filter
      if (categoryFilter !== "ALL") {
        if (!categoriesMatch(p.insurance_category, categoryFilter)) return false;
      }
      // Status filter
      if (statusFilter !== "ALL") {
        if (p.status?.toUpperCase() !== statusFilter) return false;
      }
      // Business Type filter
      if (businessTypeFilter !== "ALL") {
        if (p.business_type?.toUpperCase() !== businessTypeFilter) return false;
      }
      // Issue Year filter
      if (issueYearFilter !== "ALL") {
        if (String(p.issue_year) !== String(issueYearFilter)) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (p.policy_number || "").toLowerCase();
        const plan = (p.policy_plan_name || "").toLowerCase();
        const comp = (p.company_name || "").toLowerCase();
        if (!num.includes(q) && !plan.includes(q) && !comp.includes(q)) return false;
      }
      return true;
    });
  }, [profileData, categoryFilter, statusFilter, businessTypeFilter, issueYearFilter, searchQuery]);

  // Group filtered policies by year
  const filteredYearGroups = useMemo(() => {
    const groups = {};
    filteredPolicies.forEach((p) => {
      const yr = p.issue_year || new Date(p.policy_start_date || Date.now()).getFullYear();
      if (!groups[yr]) {
        groups[yr] = {
          year: yr,
          policies: [],
          total_sum_insured: 0,
          total_premium: 0,
        };
      }
      groups[yr].policies.push(p);
      groups[yr].total_sum_insured += Number(p.sum_insured || 0);
      groups[yr].total_premium += Number(p.gross_premium || p.net_premium || 0);
    });

    return Object.values(groups).sort((a, b) => b.year - a.year);
  }, [filteredPolicies]);

  // Available issue years
  const availableYears = useMemo(() => {
    if (!profileData?.policies) return [];
    const yrs = new Set();
    profileData.policies.forEach((p) => {
      if (p.issue_year) yrs.add(String(p.issue_year));
      else if (p.policy_start_date) yrs.add(String(new Date(p.policy_start_date).getFullYear()));
    });
    return Array.from(yrs).sort((a, b) => b.localeCompare(a));
  }, [profileData]);

  // Copy to clipboard helper
  const handleCopy = (text, label = "Text") => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showSuccess(`${label} copied to clipboard.`);
  };

  // Scroll helper
  const scrollToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Select Category from Portfolio Card
  const handleCategoryClick = (catName) => {
    if (categoryFilter === catName) {
      setCategoryFilter("ALL");
      showInfo(`Cleared filter for ${catName}.`);
    } else {
      setCategoryFilter(catName);
      showInfo(`Showing only ${catName} policies.`);
      scrollToSection("policy-history");
    }
  };

  // Loading Skeleton State
  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
        {/* Top bar skeleton */}
        <div className="h-6 w-48 bg-slate-200 rounded-lg" />

        {/* Header skeleton */}
        <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-200" />
            <div className="space-y-2">
              <div className="h-6 w-64 bg-slate-200 rounded" />
              <div className="h-4 w-40 bg-slate-200 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Content grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
            <div className="h-96 bg-white rounded-2xl border border-slate-200 p-6" />
            <div className="h-64 bg-white rounded-2xl border border-slate-200 p-6" />
          </div>
          <div className="lg:col-span-8 space-y-6">
            <div className="h-72 bg-white rounded-2xl border border-slate-200 p-6" />
            <div className="h-96 bg-white rounded-2xl border border-slate-200 p-6" />
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (fetchError || !profileData) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 text-center bg-white rounded-2xl border border-rose-200 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Customer 360 Unavailable</h2>
        <p className="text-sm text-slate-500 mt-2 mb-6 leading-relaxed">
          {fetchError || "The requested customer profile could not be located in the database."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => loadProfile()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Query
          </button>
          <Link
            to="/customers"
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            Return to Customers
          </Link>
        </div>
      </div>
    );
  }

  const { customer, kpis, categories, family, year_groups, premiums, claims, timeline = [], documents = [] } = profileData;
  const customerDocs = documents && documents.length > 0 ? documents : (customer?.documents || []);

  // Name initials
  const initials = `${customer.first_name?.[0] || ""}${customer.last_name?.[0] || ""}`.toUpperCase() || "CU";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Breadcrumb & Top Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Link
            to="/customers"
            className="flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 font-semibold transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Customer Management
          </Link>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="text-slate-900 font-semibold truncate max-w-[200px]">
            {customer.first_name} {customer.last_name}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-[11px] font-bold border border-indigo-200">
            {customer.customer_code || `CUST-${customer.id?.substring(0, 8)}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadProfile(true)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-xs"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            Print Report
          </button>
        </div>
      </div>

      {/* ── SECTION 1: CUSTOMER PROFILE HEADER CARD ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 relative overflow-hidden">
        {/* Soft Background Accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-50/60 via-purple-50/30 to-transparent rounded-full pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 space-y-6">
          {/* Identity & Main Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              {/* Profile Avatar / Initials */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white font-bold text-2xl sm:text-3xl flex items-center justify-center shadow-md shadow-indigo-100 shrink-0 border-2 border-white">
                {initials}
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {customer.first_name} {customer.last_name}
                  </h1>
                  {customer.customer_type === "CORPORATE" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      <Building2 className="w-3 h-3 text-amber-600" />
                      Corporate Client
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      <UserCheck className="w-3 h-3 text-indigo-600" />
                      Individual
                    </span>
                  )}
                  {customer.is_archived ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Inactive
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active Client
                    </span>
                  )}
                </div>

                {/* Sub details: Phone, Email, Registration */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-0.5">
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{customer.phone || "No phone"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{customer.email || "No email"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      Registered:{" "}
                      {customer.created_at
                        ? new Date(customer.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons & Operations Menu */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleOpenEditModal}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                Edit Customer
              </button>
              <button
                type="button"
                onClick={() => {
                  setDocUploadError("");
                  setUploadFile(null);
                  setActiveModal("upload_doc");
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                Upload Doc
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("policy-history")}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <History className="w-3.5 h-3.5 text-indigo-600" />
                Policy History
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("premium-history")}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                Premium Calendar
              </button>
              <button
                type="button"
                onClick={() => navigate(`/policies?tab=new_policy&customer_id=${customer.id}`)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-100 transition-all hover:shadow-indigo-200"
              >
                <Plus className="w-3.5 h-3.5" />
                Issue New Policy
              </button>

              {/* ── CUSTOMER ACTION MENU / COLLAPSIBLE OPTIONS (Phase 4) ── */}
              <div className="relative" ref={actionMenuRef}>
                <button
                  type="button"
                  onClick={() => setActionMenuOpen(!actionMenuOpen)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                    actionMenuOpen
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
                  }`}
                  aria-expanded={actionMenuOpen}
                  aria-haspopup="true"
                >
                  <MoreHorizontal className="w-4 h-4 text-indigo-600" />
                  <span>Actions</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${actionMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {actionMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-60 rounded-2xl bg-white border border-slate-200 shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 border-b border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Operations</p>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenEditModal}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Edit Customer</p>
                        <p className="text-[10px] text-slate-400">Update personal or corporate profile</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false);
                        setDocUploadError("");
                        setUploadFile(null);
                        setActiveModal("upload_doc");
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Upload className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Upload Documents</p>
                        <p className="text-[10px] text-slate-400">Aadhaar, PAN, GSTIN, proofs</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false);
                        setNoteText("");
                        setActiveModal("add_note");
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Add Note</p>
                        <p className="text-[10px] text-slate-400">Log customer interaction or call</p>
                      </div>
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false);
                        navigate("/family-groups");
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Users className="w-4 h-4 text-purple-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Create Family Group</p>
                        <p className="text-[10px] text-slate-400">Establish multi-member family unit</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false);
                        navigate("/family-groups");
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    >
                      <UserPlus className="w-4 h-4 text-teal-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Add Family Member</p>
                        <p className="text-[10px] text-slate-400">Link spouse, child, or dependent</p>
                      </div>
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false);
                        navigate(`/policies?tab=new_policy&customer_id=${customer.id}`);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Issue New Policy</p>
                        <p className="text-[10px] text-slate-400">Create policy proposal & binding</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false);
                        scrollToSection("policy-history");
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    >
                      <History className="w-4 h-4 text-slate-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">View Policy History</p>
                        <p className="text-[10px] text-slate-400">Browse contracts and renewals</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false);
                        scrollToSection("activity-timeline");
                        setTimelineShowAll(true);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Clock className="w-4 h-4 text-slate-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">View Activity History</p>
                        <p className="text-[10px] text-slate-400">Audit trail and state changes</p>
                      </div>
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false);
                        handleExportProfile();
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Download className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Export Customer Profile</p>
                        <p className="text-[10px] text-slate-400">Download JSON snapshot summary</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 6 Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* 1. Total Policies */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Policies
              </span>
              <p className="text-xl font-black text-slate-900 mt-1">{kpis.total_policies || 0}</p>
              <span className="text-[10px] text-slate-400 font-medium">Recorded Contracts</span>
            </div>

            {/* 2. Active Policies */}
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                Active Policies
              </span>
              <p className="text-xl font-black text-emerald-700 mt-1">{kpis.active_policies || 0}</p>
              <span className="text-[10px] text-emerald-600 font-medium">Currently in Force</span>
            </div>

            {/* 3. Expired Policies */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Expired Policies
              </span>
              <p className="text-xl font-black text-slate-700 mt-1">{kpis.expired_policies || 0}</p>
              <span className="text-[10px] text-slate-400 font-medium">Lapsed / Completed</span>
            </div>

            {/* 4. Total Family Members */}
            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80">
              <span className="text-[11px] font-semibold text-indigo-800 uppercase tracking-wider block">
                Family Members
              </span>
              <p className="text-xl font-black text-indigo-700 mt-1">{kpis.total_family_members || 0}</p>
              <span className="text-[10px] text-indigo-600 font-medium">Covered Dependents</span>
            </div>

            {/* 5. Total Sum Insured */}
            <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200/80 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-purple-800 uppercase tracking-wider block">
                Total Sum Insured
              </span>
              <p className="text-xl font-black text-purple-700 mt-1 truncate" title={formatINR(kpis.total_sum_insured)}>
                {formatINR(kpis.total_sum_insured)}
              </p>
              <span className="text-[10px] text-purple-600 font-medium">Total Risk Underwritten</span>
            </div>

            {/* 6. Upcoming Renewals */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">
                Upcoming Renewals
              </span>
              <p className="text-xl font-black text-amber-700 mt-1">{kpis.upcoming_renewals || 0}</p>
              <span className="text-[10px] text-amber-600 font-medium">Next 30–60 Days</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN WORKSPACE GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT COLUMN (Personal Info, KYC Documents, Family Details) ── */}
        <div className="lg:col-span-4 space-y-6">
          {/* ── SECTION 2: PERSONAL INFORMATION CARD ── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Personal Information
                </h2>
              </div>
              <button
                type="button"
                onClick={handleToggleUnmaskKyc}
                disabled={unmasking}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 transition-colors"
                title="Toggle reveal of sensitive PAN & Aadhaar (Restricted to Authorized Users)"
              >
                {unmasking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                ) : unmaskedKyc ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Mask KYC</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Reveal KYC</span>
                  </>
                )}
              </button>
            </div>

            {/* Information Key-Value Grid */}
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 shrink-0">Full Legal Name:</span>
                <span className="font-semibold text-slate-900 text-right">
                  {customer.first_name} {customer.last_name}
                </span>
              </div>

              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 shrink-0">Date of Birth:</span>
                <span className="font-medium text-slate-800 text-right">
                  {customer.date_of_birth
                    ? new Date(customer.date_of_birth).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "Not Specified"}
                </span>
              </div>

              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 shrink-0">Exact Age:</span>
                <span className="font-semibold text-indigo-700 text-right">
                  {customer.exact_age || (customer.age ? `${customer.age} Years` : "N/A")}
                </span>
              </div>

              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 shrink-0">Gender:</span>
                <span className="font-medium text-slate-800 text-right capitalize">
                  {customer.gender ? customer.gender.toLowerCase() : "N/A"}
                </span>
              </div>

              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 shrink-0">Marital Status:</span>
                <span className="font-medium text-slate-800 text-right capitalize">
                  {customer.marital_status ? customer.marital_status.toLowerCase() : "Single"}
                </span>
              </div>

              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 shrink-0">Nationality:</span>
                <span className="font-medium text-slate-800 text-right">
                  {customer.nationality || "Indian"}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-start gap-2">
                <span className="text-slate-500 shrink-0">Primary Mobile:</span>
                <div className="flex items-center gap-1.5 text-right font-medium text-slate-900">
                  <span>{customer.phone || "N/A"}</span>
                  {customer.phone && (
                    <button
                      type="button"
                      onClick={() => handleCopy(customer.phone, "Phone")}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 shrink-0">Alternate Mobile:</span>
                <span className="font-medium text-slate-700 text-right">
                  {customer.alternate_phone || "None"}
                </span>
              </div>

              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 shrink-0">Email Address:</span>
                <span className="font-medium text-slate-900 text-right truncate max-w-[180px]">
                  {customer.email || "N/A"}
                </span>
              </div>

              {/* PAN Number (Masked by default) */}
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center gap-2">
                <span className="text-slate-500 shrink-0">PAN Number:</span>
                <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
                  <span
                    className={
                      unmaskedKyc?.pan_number
                        ? "text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                        : "text-slate-700"
                    }
                  >
                    {unmaskedKyc?.pan_number || customer.pan_number || "Not Recorded"}
                  </span>
                  {(unmaskedKyc?.pan_number || customer.pan_number) && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          unmaskedKyc?.pan_number || customer.pan_number,
                          "PAN Number"
                        )
                      }
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Aadhaar Number (Masked by default) */}
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500 shrink-0">Aadhaar Number:</span>
                <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
                  <span
                    className={
                      unmaskedKyc?.aadhaar_number
                        ? "text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                        : "text-slate-700"
                    }
                  >
                    {unmaskedKyc?.aadhaar_number || customer.aadhaar_number || "Not Recorded"}
                  </span>
                  {(unmaskedKyc?.aadhaar_number || customer.aadhaar_number) && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          unmaskedKyc?.aadhaar_number || customer.aadhaar_number,
                          "Aadhaar Number"
                        )
                      }
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-start gap-2">
                <span className="text-slate-500 shrink-0">Occupation:</span>
                <span className="font-medium text-slate-800 text-right">
                  {customer.occupation || "Salaried / Professional"}
                </span>
              </div>

              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 shrink-0">Source of Income:</span>
                <span className="font-medium text-slate-800 text-right">
                  {customer.source_of_income || "Salary / Business"}
                </span>
              </div>

              {customer.customer_type === "CORPORATE" && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-slate-500 shrink-0">GSTIN:</span>
                  <span className="font-mono font-semibold text-amber-700 text-right">
                    {customer.gstin || "N/A"}
                  </span>
                </div>
              )}

              {/* Address */}
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <span className="text-slate-500 block">Residential Address:</span>
                <p className="text-slate-800 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {customer.address || "No primary street address on file."}
                  <span className="block text-[11px] text-slate-500 mt-1 font-normal">
                    {[customer.city, customer.state, customer.pincode].filter(Boolean).join(", ") ||
                      "City / State not specified"}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* ── SECTION 5: CUSTOMER DOCUMENTS CARD ── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Customer Documents
                  </h2>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Verified KYC & Proof Files
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDocUploadError("");
                  setUploadFile(null);
                  setActiveModal("upload_doc");
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors shadow-xs"
              >
                <Plus className="w-3 h-3" />
                Upload
              </button>
            </div>

            {/* Document Rows */}
            <div className="space-y-2">
              {!customer.documents || customer.documents.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">No verified documents attached yet.</p>
                  <button
                    type="button"
                    onClick={() => setActiveModal("upload_doc")}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Upload Aadhaar or PAN Card
                  </button>
                </div>
              ) : (
                customer.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {doc.document_type || "DOCUMENT"}
                          </p>
                          {doc.is_verified && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Verified" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate" title={doc.original_filename}>
                          {doc.original_filename || "document.pdf"}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {doc.created_at
                            ? new Date(doc.created_at).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePreviewDoc(doc.id, doc.original_filename || "Document")}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors"
                        title="Preview Document"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insuranceAPI.downloadCustomerKyc(
                            customer.id,
                            doc.id,
                            doc.original_filename || "document.pdf"
                          )
                        }
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 text-indigo-600 transition-colors"
                        title="Download Document"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── SECTION 4: FAMILY DETAILS CARD ── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Family Details
                  </h2>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {family?.group_name || "Family Unit"}
                  </span>
                </div>
              </div>

              {family?.group_id ? (
                <Link
                  to={`/family-groups`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900 transition-colors"
                >
                  View Family
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              ) : (
                <Link
                  to="/family-groups"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  Create Group
                </Link>
              )}
            </div>

            {/* Member List */}
            {!family || !family.members || family.members.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                <Users className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">
                  No registered family members linked to this client.
                </p>
                <Link
                  to="/family-groups"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add Family Member
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {family.members.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {m.full_name}
                        </span>
                        {m.is_primary && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-indigo-100 text-indigo-800">
                            HEAD
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="capitalize font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60">
                          {m.relationship || "Dependent"}
                        </span>
                        <span>•</span>
                        <span>{m.exact_age || (m.age ? `${m.age} Yrs` : "Age N/A")}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-bold text-slate-700 block">
                        {m.linked_policy_count || 0} Policies
                      </span>
                      <span className="text-[10px] text-slate-400">Insured Member</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN (Insurance Portfolio, Complete Policy History, Premium & Claims) ── */}
        <div className="lg:col-span-8 space-y-6">
          {/* ── SECTION 3: INSURANCE PORTFOLIO CARD ── */}
          <div
            id="insurance-portfolio"
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Insurance Portfolio
                  </h2>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Policies grouped across 8 canonical lines of insurance
                  </span>
                </div>
              </div>
              {categoryFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter("ALL")}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Clear Category Filter
                </button>
              )}
            </div>

            {/* 8 Category Rows Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories && categories.length > 0 ? (
                categories.map((cat) => {
                  const isSelected = categoryFilter === cat.category;
                  const hasPolicies = cat.policy_count > 0;
                  return (
                    <div
                      key={cat.category}
                      onClick={() => handleCategoryClick(cat.category)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs"
                          : hasPolicies
                          ? "bg-white hover:bg-slate-50 border-slate-200/90 hover:border-slate-300 shadow-2xs"
                          : "bg-slate-50/50 border-slate-200/60 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0">
                          {getCategoryIcon(cat.category)}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-900 truncate">{cat.category}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-semibold text-slate-700">
                              {cat.policy_count} {cat.policy_count === 1 ? "Policy" : "Policies"}
                            </span>
                            <span>•</span>
                            <span className="text-emerald-700 font-medium">
                              {cat.active_policy_count} Active
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-slate-900 block">
                          {formatINR(cat.total_sum_insured)}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 mt-0.5">
                          {isSelected ? "Filtering" : "View"}
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-2 text-center py-6 text-slate-400 text-xs">
                  No portfolio lines registered.
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION 6: COMPLETE POLICY HISTORY ── */}
          <div
            id="policy-history"
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6"
          >
            {/* Header and Filter Toolbar */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Complete Policy History
                    </h2>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Multi-year historical policy records with renewal lineage
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {filteredPolicies.length} of {profileData?.policies?.length || 0} Policies
                  </span>
                </div>
              </div>

              {/* Filter Controls Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search policy #, plan, insurer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 font-medium bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="RENEWED">Renewed</option>
                  <option value="GRACE_PERIOD">Grace Period</option>
                  <option value="LAPSED">Lapsed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                {/* Business Type Filter */}
                <select
                  value={businessTypeFilter}
                  onChange={(e) => setBusinessTypeFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 font-medium bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="ALL">All Business Types</option>
                  <option value="NEW">New Business</option>
                  <option value="RENEWAL">Renewal</option>
                  <option value="PORTABILITY">Portability</option>
                </select>

                {/* Issue Year Filter */}
                <select
                  value={issueYearFilter}
                  onChange={(e) => setIssueYearFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 font-medium bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="ALL">All Issue Years</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      Year {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Filter Chips */}
              {(categoryFilter !== "ALL" ||
                statusFilter !== "ALL" ||
                businessTypeFilter !== "ALL" ||
                issueYearFilter !== "ALL" ||
                searchQuery) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  <span className="text-slate-400 font-semibold text-[11px] mr-1">Active Filters:</span>
                  {categoryFilter !== "ALL" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium border border-indigo-200">
                      {categoryFilter}
                      <button type="button" onClick={() => setCategoryFilter("ALL")}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {statusFilter !== "ALL" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
                      Status: {statusFilter}
                      <button type="button" onClick={() => setStatusFilter("ALL")}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {businessTypeFilter !== "ALL" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
                      Type: {businessTypeFilter}
                      <button type="button" onClick={() => setBusinessTypeFilter("ALL")}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {issueYearFilter !== "ALL" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
                      Year: {issueYearFilter}
                      <button type="button" onClick={() => setIssueYearFilter("ALL")}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter("ALL");
                      setStatusFilter("ALL");
                      setBusinessTypeFilter("ALL");
                      setIssueYearFilter("ALL");
                      setSearchQuery("");
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold ml-2"
                  >
                    Reset All
                  </button>
                </div>
              )}
            </div>

            {/* Year-Wise Groups Accordion */}
            {filteredYearGroups.length === 0 ? (
              <div className="p-12 rounded-2xl border border-dashed border-slate-200 text-center space-y-3">
                <Shield className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900">No Policies Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No policy records match the currently selected filters. Adjust your filters or issue a new policy.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/policies?tab=new_policy&customer_id=${customer.id}`)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Issue New Policy
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredYearGroups.map((group) => {
                  const isCollapsed = collapsedYears[group.year];
                  return (
                    <div
                      key={group.year}
                      className="rounded-2xl border border-slate-200/90 overflow-hidden bg-slate-50/40"
                    >
                      {/* Year Header Banner */}
                      <div
                        onClick={() =>
                          setCollapsedYears((prev) => ({
                            ...prev,
                            [group.year]: !prev[group.year],
                          }))
                        }
                        className="p-4 bg-white hover:bg-slate-50 border-b border-slate-200/80 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-black text-sm flex items-center justify-center">
                            {group.year}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-extrabold text-slate-900">
                                {group.year} Policy Records
                              </h3>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                                {group.policies.length} {group.policies.length === 1 ? "Policy" : "Policies"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                              <span>Sum Insured: {formatINR(group.total_sum_insured)}</span>
                              <span>•</span>
                              <span>Total Premium: {formatINR(group.total_premium)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-400">
                            {isCollapsed ? "Expand" : "Collapse"}
                          </span>
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400 rotate-90 transition-transform" />
                          )}
                        </div>
                      </div>

                      {/* Policy Cards Grid for this Year */}
                      {!isCollapsed && (
                        <div className="p-4 space-y-4">
                          {group.policies.map((p) => (
                            <div
                              key={p.id}
                              className="bg-white rounded-xl border border-slate-200/90 hover:border-indigo-300 shadow-2xs hover:shadow-xs p-5 transition-all space-y-4"
                            >
                              {/* Policy Card Header */}
                              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                                    {getCategoryIcon(p.insurance_category)}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-sm font-black text-slate-900">
                                        {p.policy_number}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(p.policy_number, "Policy Number")}
                                        className="text-slate-400 hover:text-slate-600"
                                        title="Copy Policy Number"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                      {getStatusBadge(p.status)}
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">
                                      {p.company_name} • {p.policy_plan_name || "Custom Plan"}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Business Type Badge */}
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                                      p.business_type === "RENEWAL"
                                        ? "bg-purple-50 text-purple-700 border border-purple-200"
                                        : p.business_type === "PORTABILITY"
                                        ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    }`}
                                  >
                                    {p.business_type || "NEW"}
                                  </span>

                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                                    {p.insurance_category || "General"}
                                  </span>
                                </div>
                              </div>

                              {/* Renewal Lineage Link if available */}
                              {p.previous_policy_number && (
                                <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-200/80 flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2 text-indigo-900 font-medium">
                                    <History className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>
                                      Renewed from previous contract:{" "}
                                      <strong className="font-mono font-bold">
                                        {p.previous_policy_number}
                                      </strong>
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-200">
                                    Continuous Lineage
                                  </span>
                                </div>
                              )}

                              {/* Policy Metrics Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div>
                                  <span className="text-[11px] font-medium text-slate-400 block">
                                    Sum Insured
                                  </span>
                                  <span className="text-sm font-extrabold text-slate-900 block mt-0.5">
                                    {formatINR(p.sum_insured)}
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[11px] font-medium text-slate-400 block">
                                    Gross Premium
                                  </span>
                                  <span className="text-sm font-extrabold text-indigo-700 block mt-0.5">
                                    {formatINR(p.gross_premium || p.net_premium)}
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[11px] font-medium text-slate-400 block">
                                    Term / Coverage
                                  </span>
                                  <span className="text-xs font-semibold text-slate-800 block mt-0.5">
                                    {p.policy_start_date
                                      ? new Date(p.policy_start_date).toLocaleDateString("en-IN", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                        })
                                      : "N/A"}{" "}
                                    –{" "}
                                    {p.expiry_date
                                      ? new Date(p.expiry_date).toLocaleDateString("en-IN", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                        })
                                      : "N/A"}
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[11px] font-medium text-slate-400 block">
                                    Nominees & Members
                                  </span>
                                  <span className="text-xs font-semibold text-slate-800 block mt-0.5">
                                    {p.nominee_count || 0} Nominees • {p.insured_member_count || 1} Insured
                                  </span>
                                </div>
                              </div>

                              {/* Policy Card Action Buttons */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
                                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                                  <span>Payment Frequency:</span>
                                  <span className="font-semibold text-slate-700 capitalize">
                                    {p.payment_frequency ? p.payment_frequency.toLowerCase() : "Annual"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* View Commission (RBAC-gated) */}
                                  {canViewCommissions && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedPolicy(p);
                                        setActiveModal("view_commission");
                                      }}
                                      className="px-2.5 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                                      title="View Commission Details"
                                    >
                                      <DollarSign className="w-3.5 h-3.5" />
                                      Commission
                                    </button>
                                  )}

                                  {/* Download Policy Document if exists */}
                                  {p.documents && p.documents.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        insuranceAPI.downloadPolicyDocument(
                                          p.id,
                                          p.documents[0].id,
                                          p.documents[0].filename || `policy_${p.policy_number}.pdf`
                                        )
                                      }
                                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                                      title="Download Policy Document"
                                    >
                                      <Download className="w-3.5 h-3.5 text-slate-500" />
                                      Document
                                    </button>
                                  ) : null}

                                  {/* View Policy Full Details Modal */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedPolicy(p);
                                      setActiveModal("policy_detail");
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    View Details
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── SECTION 7: PREMIUM & PAYMENT HISTORY ── */}
          <div
            id="premium-history"
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Premium & Payment History
                  </h2>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Financial collection ledger and upcoming installment schedules
                  </span>
                </div>
              </div>
            </div>

            {/* Premium Summary Metrics Banner */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Total Premium
                </span>
                <p className="text-base font-black text-slate-900 mt-1">
                  {formatINR(premiums?.total_premium || 0)}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">Gross Invoiced</span>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                  Paid Premium
                </span>
                <p className="text-base font-black text-emerald-700 mt-1">
                  {formatINR(premiums?.paid_premium || 0)}
                </p>
                <span className="text-[10px] text-emerald-600 font-medium">Realized to Insurer</span>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80">
                <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">
                  Pending Premium
                </span>
                <p className="text-base font-black text-amber-700 mt-1">
                  {formatINR(premiums?.pending_premium || 0)}
                </p>
                <span className="text-[10px] text-amber-600 font-medium">Upcoming Invoices</span>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/80">
                <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider block">
                  Overdue Premium
                </span>
                <p className="text-base font-black text-rose-700 mt-1">
                  {formatINR(premiums?.overdue_premium || 0)}
                </p>
                <span className="text-[10px] text-rose-600 font-medium">Action Required</span>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 col-span-2 sm:col-span-1">
                <span className="text-[11px] font-semibold text-indigo-800 uppercase tracking-wider block">
                  Next Due Date
                </span>
                <p className="text-sm font-black text-indigo-700 mt-1 truncate">
                  {premiums?.next_due_date
                    ? new Date(premiums.next_due_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "None Scheduled"}
                </p>
                <span className="text-[10px] text-indigo-600 font-medium">Installment Calendar</span>
              </div>
            </div>

            {/* Granular Payments Transaction Table */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Historical Payment Transactions ({premiums?.payments?.length || 0})
              </h3>

              {!premiums?.payments || premiums.payments.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center space-y-1">
                  <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">
                    No payment transactions recorded for this customer yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Policy #</th>
                        <th className="py-2.5 px-3">Payment Date</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Payment Mode</th>
                        <th className="py-2.5 px-3">Reference / Cheque</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {premiums.payments.map((pmt) => (
                        <tr key={pmt.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            {pmt.policy_number}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {pmt.payment_date
                              ? new Date(pmt.payment_date).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "N/A"}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {formatINR(pmt.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 capitalize">
                            {pmt.payment_mode ? pmt.payment_mode.toLowerCase() : "Online"}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {pmt.transaction_reference || "N/A"}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                pmt.status === "COMPLETED" || pmt.status === "SUCCESS"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : pmt.status === "FAILED"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {pmt.status || "Completed"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {pmt.proof_document_url ? (
                              <a
                                href={pmt.proof_document_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline"
                              >
                                <Download className="w-3 h-3" />
                                Download
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION 8: CLAIM HISTORY ── */}
          <div
            id="claim-history"
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Claim History
                  </h2>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Insurance settlements, claims submitted and adjudication statuses
                  </span>
                </div>
              </div>
            </div>

            {/* Claims List */}
            {!claims || claims.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h3 className="text-xs font-bold text-slate-800">No Claims on Record</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No insurance claims or dispute work orders are on file for this customer. All active contracts are in good standing.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {claims.map((claim) => (
                  <div
                    key={claim.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {claim.claim_number}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            claim.status === "SETTLED" || claim.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : claim.status === "REJECTED"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {claim.status || "Submitted"}
                        </span>
                      </div>
                      <p className="text-slate-500">
                        Related Policy:{" "}
                        <span className="font-mono font-medium text-slate-800">
                          {claim.policy_number || "Direct"}
                        </span>{" "}
                        • Type: <span className="font-medium text-slate-700">{claim.claim_type || "Cashless"}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Claim Amount</span>
                        <span className="font-bold text-slate-900 block">{formatINR(claim.claim_amount)}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block">Approved Amount</span>
                        <span className="font-bold text-emerald-700 block">
                          {formatINR(claim.approved_amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── SECTION 9: CUSTOMER ACTIVITY TIMELINE ── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Customer Activity Timeline
                  </h2>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Chronological audit lifecycle events
                  </span>
                </div>
              </div>
            </div>

            {/* Timeline Stream */}
            {!timeline || timeline.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                No recent activity recorded for this client.
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {timeline.map((evt, idx) => (
                  <div key={idx} className="relative group">
                    {/* Bullet */}
                    <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white ring-2 ring-indigo-100 shadow-xs" />
                    <div className="bg-slate-50/70 hover:bg-slate-50 p-3 rounded-xl border border-slate-200/80 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">{evt.title}</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {evt.timestamp
                            ? new Date(evt.timestamp).toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                      {evt.description && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {evt.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}

      {/* 1. Policy Detail Modal */}
      {activeModal === "policy_detail" && selectedPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  {getCategoryIcon(selectedPolicy.insurance_category)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Policy {selectedPolicy.policy_number}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedPolicy.company_name} • {selectedPolicy.policy_plan_name || "Plan"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 block font-medium">Status</span>
                <span className="mt-1 block">{getStatusBadge(selectedPolicy.status)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Business Type</span>
                <span className="font-bold text-slate-800 mt-1 block">
                  {selectedPolicy.business_type || "NEW"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Sum Insured</span>
                <span className="font-extrabold text-slate-900 mt-1 block">
                  {formatINR(selectedPolicy.sum_insured)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Gross Premium</span>
                <span className="font-extrabold text-indigo-700 mt-1 block">
                  {formatINR(selectedPolicy.gross_premium || selectedPolicy.net_premium)}
                </span>
              </div>
            </div>

            {/* Nominees */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Policy Nominees ({selectedPolicy.nominees?.length || 0})
              </h4>
              {!selectedPolicy.nominees || selectedPolicy.nominees.length === 0 ? (
                <p className="text-xs text-slate-400">No designated nominees recorded.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedPolicy.nominees.map((nom, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-800">{nom.name}</span>
                      <span className="text-slate-500 capitalize">{nom.relationship}</span>
                      <span className="font-bold text-indigo-700">{nom.share_percentage}% Share</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Insured Members */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Insured Members ({selectedPolicy.members?.length || 0})
              </h4>
              {!selectedPolicy.members || selectedPolicy.members.length === 0 ? (
                <p className="text-xs text-slate-400">Individual coverage for primary client.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedPolicy.members.map((mem, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-800">{mem.full_name}</span>
                      <span className="text-slate-500 capitalize">{mem.relationship || "Insured"}</span>
                      <span className="text-slate-600 font-medium">Age: {mem.age || "N/A"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Upload Document Modal */}
      {activeModal === "upload_doc" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Upload Customer KYC Document</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadKycDoc} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Document Type</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium bg-white"
                >
                  <option value="AADHAAR">Aadhaar Card (Front/Back)</option>
                  <option value="PAN">PAN Card</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="VOTER_ID">Voter ID</option>
                  <option value="DRIVING_LICENSE">Driving License</option>
                  <option value="ADDRESS_PROOF">Address Proof (Utility Bill / Bank Statement)</option>
                  <option value="GST_CERTIFICATE">GST Certificate</option>
                  <option value="OTHER">Other Identification Proof</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Select File (PDF, PNG, JPG)</label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              {docUploadError && (
                <p className="text-xs text-rose-600 font-medium">{docUploadError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingDoc}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5"
                >
                  {uploadingDoc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{uploadingDoc ? "Uploading..." : "Upload Document"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Document Preview Modal */}
      {activeModal === "preview_doc" && previewDocUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full p-6 space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900 truncate">{previewDocTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  if (previewDocUrl) window.URL.revokeObjectURL(previewDocUrl);
                  setPreviewDocUrl(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 bg-slate-100 rounded-xl overflow-hidden min-h-[450px]">
              <iframe src={previewDocUrl} title="Document Preview" className="w-full h-full min-h-[450px] border-0" />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  if (previewDocUrl) window.URL.revokeObjectURL(previewDocUrl);
                  setPreviewDocUrl(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Commission Modal (RBAC-gated) */}
      {activeModal === "view_commission" && selectedPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold text-slate-900">Commission Accounting</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs bg-purple-50/50 p-4 rounded-xl border border-purple-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Policy Number:</span>
                <span className="font-mono font-bold text-slate-900">{selectedPolicy.policy_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gross Premium:</span>
                <span className="font-bold text-slate-900">
                  {formatINR(selectedPolicy.gross_premium || selectedPolicy.net_premium)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-purple-200/60">
                <span className="text-purple-800 font-semibold">Total Insurer Commission:</span>
                <span className="font-black text-purple-900 text-sm">
                  {formatINR(selectedPolicy.total_commission)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Commission Percentage:</span>
                <span className="font-bold text-indigo-700">
                  {selectedPolicy.commission_percentage || 0}%
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              Restricted enterprise accounting view. Logged for supervisor auditing.
            </p>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Quick Edit Customer Modal */}
      {activeModal === "edit_customer" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Customer Information</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={editFormData.first_name || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editFormData.last_name || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormInput
                    label="Phone"
                    type="mobile"
                    required
                    value={editFormData.phone || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <FormInput
                    label="Alternate Phone"
                    type="mobile"
                    value={editFormData.alternate_phone || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, alternate_phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormInput
                    label="Email"
                    type="email"
                    value={editFormData.email || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Occupation</label>
                  <input
                    type="text"
                    value={editFormData.occupation || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, occupation: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Address</label>
                <input
                  type="text"
                  value={editFormData.address || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">City</label>
                  <input
                    type="text"
                    value={editFormData.city || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">State</label>
                  <input
                    type="text"
                    value={editFormData.state || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900"
                  />
                </div>
                <div>
                  <FormInput
                    label="PIN Code"
                    type="pin"
                    value={editFormData.pincode || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5"
                >
                  {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
