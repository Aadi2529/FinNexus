import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { usePolicyDraft } from "../context/PolicyDraftContext";
import CustomerAutocomplete from "../components/CustomerAutocomplete";
import InlineCustomerModal from "../components/InlineCustomerModal";
import NumberedPagination from "../components/NumberedPagination";
import MobilePolicyCard from "../components/MobilePolicyCard";
import { useNotification } from "../context/NotificationContext";
import DatePicker from "../components/common/DatePicker";
import {
  validateIndianMobile,
  validatePinCode,
  validateVehicleRegistration,
  validatePositiveDecimal,
  validateDobNotFuture,
  validateDateOrder,
  validateEmail,
  getTodayIso,
} from "../utils/validation";
import {
  INSURANCE_CATEGORIES,
  getCategoryLabel,
  getCategoryCode,
  categoriesMatch,
  lobMatches,
} from "../utils/insuranceCategories";
import {
  Shield,
  Minus,
  History,
  GitBranch,
  Link2,
  Unlink,
  Maximize2,
  Search,
  Plus,
  Eye,
  Trash2,
  Calendar,
  DollarSign,
  FileText,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowUpRight,
  CreditCard,
  UserCheck,
  Building,
  Briefcase,
  HelpCircle,
  X,
  FileSpreadsheet,
  Layers,
  Edit3,
  RotateCcw,
  Users,
  RefreshCw,
  Printer,
  Sliders,
  Check,
  Filter,
  Sparkles,
  TrendingUp,
  Phone,
  Car,
  Plane,
  HeartPulse,
  MapPin,
  Mail,
  Tag,
} from "lucide-react";

const formatErrorMsg = (err) => {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    if (err.error && typeof err.error === "string") return err.error;
    if (err.message && typeof err.message === "string") return err.message;
    if (err.detail) {
      if (typeof err.detail === "string") return err.detail;
      if (Array.isArray(err.detail)) {
        return err.detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
      }
      return JSON.stringify(err.detail);
    }
    return JSON.stringify(err);
  }
  return String(err);
};

const POLICY_DOCUMENT_TYPES = [
  "Official Policy Certificate",
  "Proposal Form",
  "Premium Receipt",
  "Customer KYC",
  "Medical Report",
  "Endorsement",
  "Renewal Document",
  "Claim-related Document",
  "Other Policy Attachments",
];

const getPolicyDocBadgeClass = (type) => {
  switch (type) {
    case "Official Policy Certificate":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "Proposal Form":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "Premium Receipt":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Customer KYC":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "Medical Report":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "Endorsement":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Renewal Document":
      return "bg-teal-50 text-teal-700 border-teal-200";
    case "Claim-related Document":
      return "bg-orange-50 text-orange-700 border-orange-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
};

const formatDocBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const SUM_INSURED_OPTIONS = [
  { val: "500000", label: "₹5,00,000 — 5 Lakh" },
  { val: "750000", label: "₹7,50,000 — 7.5 Lakh" },
  { val: "1000000", label: "₹10,00,000 — 10 Lakh" },
  { val: "1500000", label: "₹15,00,000 — 15 Lakh" },
  { val: "2000000", label: "₹20,00,000 — 20 Lakh" },
  { val: "2500000", label: "₹25,00,000 — 25 Lakh" },
  { val: "3000000", label: "₹30,00,000 — 30 Lakh" },
  { val: "5000000", label: "₹50,00,000 — 50 Lakh" },
  { val: "7500000", label: "₹75,00,000 — 75 Lakh" },
  { val: "10000000", label: "₹1,00,00,000 — 1 Crore" },
  { val: "20000000", label: "₹2,00,00,000 — 2 Crore" },
  { val: "CUSTOM", label: "Custom Amount" },
];

export default function PoliciesPage() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const canMutate = isAdmin || isSuperAdmin;

  const [searchParams, setSearchParams] = useSearchParams();
  const { draft, hasDraft, isMinimized, saveDraft, minimizeDraft, restoreDraft, clearDraft, discardDraft } = usePolicyDraft();
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftDismissed, setDraftDismissed] = useState(false);

  // Active Tab: 'policies' | 'new_policy' | 'schedules' | 'renewals' | 'import'
  const [activeTab, setActiveTab] = useState("policies");

  // Sync active tab with URL query parameter
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["policies", "new_policy", "schedules", "renewals", "import"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const { showSuccess, showError, showWarning, showInfo, showLoading, dismiss } = useNotification();

  // Global feedback alerts with toast notification bridge
  const [actionSuccess, setActionSuccessState] = useState("");
  const [actionError, setActionErrorState] = useState("");
  const setActionSuccess = (msg) => {
    setActionSuccessState(msg);
    if (msg) showSuccess(msg);
  };
  const setActionError = (msg) => {
    setActionErrorState(msg);
    if (msg) showError(msg);
  };

  // Policy Issue Year Grouping Controls (authoritative calendar-year issue date)
  const [selectedIssueYear, setSelectedIssueYear] = useState("ALL"); // 'ALL' | 2026 | 2025 | etc.
  const [availableIssueYears, setAvailableIssueYears] = useState([]);
  const [totalSumInsured, setTotalSumInsured] = useState(0);
  const [totalGrossPremium, setTotalGrossPremium] = useState(0);

  // Policy Lifecycle Timeline (Drawer)
  const [policyLifecycleTimeline, setPolicyLifecycleTimeline] = useState([]);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);

  // Helper Formatters & Date Math
  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString("en-IN")}`;
  const formatDateDDMMYYYY = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const parts = String(dateStr).split("T")[0].split("-");
      if (parts.length === 3) {
        const [yyyy, mm, dd] = parts;
        return `${dd.padStart(2, "0")}-${mm.padStart(2, "0")}-${yyyy}`;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateStr;
    }
  };
  const formatDate = (dateStr) => formatDateDDMMYYYY(dateStr);
  const calculateDaysRemaining = (expiryStr) => {
    if (!expiryStr) return null;
    const now = new Date();
    const exp = new Date(expiryStr);
    const diffTime = exp.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  const getNextStartDate = (expiryDateStr) => {
    if (!expiryDateStr) return new Date().toISOString().split("T")[0];
    try {
      const parts = expiryDateStr.split("-").map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        const dt = new Date(parts[0], parts[1] - 1, parts[2] + 1);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const d = String(dt.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
      return new Date().toISOString().split("T")[0];
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  };
  const calculateRenewalEndDate = (startDateStr, termYears = 1) => {
    if (!startDateStr) return "";
    try {
      const parts = startDateStr.split("-").map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        const endDate = new Date(parts[0] + Number(termYears), parts[1] - 1, parts[2] - 1);
        const y = endDate.getFullYear();
        const m = String(endDate.getMonth() + 1).padStart(2, "0");
        const d = String(endDate.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
      return "";
    } catch {
      return "";
    }
  };

  // ==========================================
  // TAB 1: ALL POLICIES LIST & FILTERS
  // ==========================================
  const [policies, setPolicies] = useState([]);
  const [totalPolicies, setTotalPolicies] = useState(0);
  const [policyPages, setPolicyPages] = useState(1);
  const [policyPage, setPolicyPage] = useState(1);
  const [policySearch, setPolicySearch] = useState("");
  const [policyTypeFilter, setPolicyTypeFilter] = useState("ALL");
  const [policyStatusFilter, setPolicyStatusFilter] = useState("ALL");
  const [filterCompanyId, setFilterCompanyId] = useState("");
  const [filterSubAgentId, setFilterSubAgentId] = useState("");
  const [filterStartDateFrom, setFilterStartDateFrom] = useState("");
  const [filterStartDateTo, setFilterStartDateTo] = useState("");
  const [filterExpiryDateFrom, setFilterExpiryDateFrom] = useState("");
  const [filterExpiryDateTo, setFilterExpiryDateTo] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [policiesLoading, setPoliciesLoading] = useState(true);

  // Policy Detail Drawer
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [drawerActiveTab, setDrawerActiveTab] = useState("overview"); // 'overview' | 'nominees' | 'schedules' | 'payments' | 'commissions'
  const [policyDetailLoading, setPolicyDetailLoading] = useState(false);
  const [policyAuditLogs, setPolicyAuditLogs] = useState([]);
  const [policyAuditLoading, setPolicyAuditLoading] = useState(false);

  // Edit Policy Modal State
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [editPolicyNumber, setEditPolicyNumber] = useState("");
  const [editPolicyType, setEditPolicyType] = useState("LIFE");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editSumAssured, setEditSumAssured] = useState("");
  const [editFinalPremium, setEditFinalPremium] = useState("");
  const [editPremiumMode, setEditPremiumMode] = useState("YEARLY");
  const [editTermYears, setEditTermYears] = useState("10");
  const [editStartDate, setEditStartDate] = useState("");
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  // Renewal Modal State (Phase 2 Enhanced Start/End Control)
  const [renewingPolicy, setRenewingPolicy] = useState(null);
  const [renewPolicyNumber, setRenewPolicyNumber] = useState("");
  const [renewStartDate, setRenewStartDate] = useState("");
  const [renewEndDate, setRenewEndDate] = useState("");
  const [renewTermYears, setRenewTermYears] = useState(1);
  const [renewPremium, setRenewPremium] = useState("");
  const [renewNotes, setRenewNotes] = useState("");
  const [isManualEndDateOverride, setIsManualEndDateOverride] = useState(false);
  const [showRenewalConfirmation, setShowRenewalConfirmation] = useState(false);
  const [renewLoading, setRenewLoading] = useState(false);
  const [renewError, setRenewError] = useState("");

  // Change Status Modal State
  const [statusModalPolicy, setStatusModalPolicy] = useState(null);
  const [newStatusValue, setNewStatusValue] = useState("ACTIVE");
  const [statusChangeNotes, setStatusChangeNotes] = useState("");
  const [statusChangeLoading, setStatusChangeLoading] = useState(false);
  const [statusChangeError, setStatusChangeError] = useState("");

  // Manage Nominees Modal State
  const [managingNomineesPolicy, setManagingNomineesPolicy] = useState(null);
  const [manageNomineesList, setManageNomineesList] = useState([]);
  const [manageNomineesLoading, setManageNomineesLoading] = useState(false);
  const [manageNomineesError, setManageNomineesError] = useState("");

  // ==========================================
  // TAB 2: NEW POLICY FORM STATE
  // ==========================================
  const [customers, setCustomers] = useState([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [companies, setCompanies] = useState([]);
  const [plans, setPlans] = useState([]);
  const [purchaseParties, setPurchaseParties] = useState([]);
  const [subAgents, setSubAgents] = useState([]);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceError, setReferenceError] = useState("");

  // Excel Customization & Identification
  const [formProposalNumber, setFormProposalNumber] = useState("");
  const [formBusinessType, setFormBusinessType] = useState("NEW"); // 'NEW' | 'PORT' | 'RENEW'
  const [formPrevPolicyNumber, setFormPrevPolicyNumber] = useState("");
  const [formPrevInsurer, setFormPrevInsurer] = useState("");
  const [formPortabilityContinuity, setFormPortabilityContinuity] = useState("");
  const [formProductVariant, setFormProductVariant] = useState("");

  // Policy History Chain for Portability & Renewal (Sequence 1 = Last Year, Sequence 2 = Last-to-Last Year, etc.)
  const createDefaultPolicyHistoryEntry = (seq = 1, type = "PORT") => ({
    history_sequence: seq,
    insurance_company_name: "",
    previous_policy_number: "",
    policy_business_type: type,
    previous_policy_id: null,
    is_external_policy: true,
    policy_start_date: "",
    policy_expiry_date: "",
    sum_insured: "",
    net_premium: "",
    gross_premium: "",
    product_variant: "",
    policy_status: "ACTIVE",
    claim_history: "NO_CLAIM",
    insurer_contact: "",
    cumulative_bonus: "",
    continuity_details: "",
    waiting_period_waiver_details: "",
    remarks: "",
  });

  const [formPolicyHistory, setFormPolicyHistory] = useState([
    createDefaultPolicyHistoryEntry(1, "PORT"),
  ]);

  const [showDraftResumePrompt, setShowDraftResumePrompt] = useState(false);

  // Category Specific Fields
  const [formHospitalCashBenefit, setFormHospitalCashBenefit] = useState("NOT_APPLICABLE"); // 'INCLUDED' | 'NOT_INCLUDED' | 'NOT_APPLICABLE'
  const [formVehicleRegNo, setFormVehicleRegNo] = useState("");
  const [formVehicleManufacturer, setFormVehicleManufacturer] = useState("");
  const [formVehicleModel, setFormVehicleModel] = useState("");
  const [formVehicleType, setFormVehicleType] = useState("Private Car");
  const [formTravelDestination, setFormTravelDestination] = useState("");
  const [formTravelType, setFormTravelType] = useState("International Travel");
  const [formLifeVariant, setFormLifeVariant] = useState("Term Insurance");
  const [formLifePPT, setFormLifePPT] = useState("10");

  // Contact Snapshot / Policy Specific Details
  const [formContactMobile, setFormContactMobile] = useState("");
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formContactCity, setFormContactCity] = useState("");
  const [formContactPincode, setFormContactPincode] = useState("");

  // Intermediary Details
  const [formIntermediaryName, setFormIntermediaryName] = useState("");

  // Commission Realization & Accounting
  const [formCommissionReceivedStatus, setFormCommissionReceivedStatus] = useState("PENDING"); // 'PENDING' | 'RECEIVED' | 'NOT_RECEIVED'
  const [formActualCommissionReceived, setFormActualCommissionReceived] = useState("");
  const [formCommissionReceivedDate, setFormCommissionReceivedDate] = useState("");
  const [formCommissionBankRef, setFormCommissionBankRef] = useState("");

  // Business Type List Filter
  const [filterBusinessType, setFilterBusinessType] = useState("ALL");

  // Form Fields & Enhancements
  const [formPolicyType, setFormPolicyType] = useState("HEALTH");
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formCompanyId, setFormCompanyId] = useState("");
  const [formPlanId, setFormPlanId] = useState("");
  const [formSelectedRiderIds, setFormSelectedRiderIds] = useState([]);
  const [availablePlanRiders, setAvailablePlanRiders] = useState([]);
  const [availablePlanBenefits, setAvailablePlanBenefits] = useState([]);
  const [planRidersLoading, setPlanRidersLoading] = useState(false);
  const [editSelectedRiderIds, setEditSelectedRiderIds] = useState([]);
  const [editAvailablePlanRiders, setEditAvailablePlanRiders] = useState([]);
  const [formPurchasePartyId, setFormPurchasePartyId] = useState("");
  const [formSubAgentId, setFormSubAgentId] = useState("");

  const [formPolicyNumber, setFormPolicyNumber] = useState("");
  const [formPolicyTermYears, setFormPolicyTermYears] = useState("1"); // Phase 2: Default 1 Year
  const [sumAssuredPreset, setSumAssuredPreset] = useState("1000000"); // Phase 3: Standard Sum Assured preset
  const [formSumAssured, setFormSumAssured] = useState("1000000");
  const [formNetPremium, setFormNetPremium] = useState(""); // Phase 4: Net Premium (Without GST)
  const [formGrossPremium, setFormGrossPremium] = useState(""); // Phase 4: Gross Premium (Including GST)
  const [formFinalPremium, setFormFinalPremium] = useState("");
  const [isGstEnabled, setIsGstEnabled] = useState(false);
  const [isGrossManualOverride, setIsGrossManualOverride] = useState(false);
  const [customerSnapshot, setCustomerSnapshot] = useState(null);
  const [inlineCustomerModalOpen, setInlineCustomerModalOpen] = useState(false);
  const [formPolicyYears, setFormPolicyYears] = useState([]);
  const [formIsSinglePremium, setFormIsSinglePremium] = useState(false);
  const [formPremiumMode, setFormPremiumMode] = useState("YEARLY");

  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [formFirstReceiptDate, setFormFirstReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [formExpiryDate, setFormExpiryDate] = useState("");
  const [formPolicyNotes, setFormPolicyNotes] = useState("");

  // Phase 5 & 6: Commission & 10% TDS Configuration State
  const [formCommissionRate, setFormCommissionRate] = useState("15.0"); // Default 15%
  const [formCommissionAmount, setFormCommissionAmount] = useState("");
  const [formTdsRate, setFormTdsRate] = useState("10.0"); // Standard 10% TDS
  const [formTdsAmount, setFormTdsAmount] = useState("");
  const [formNetCommissionPayable, setFormNetCommissionPayable] = useState("");
  const [isCommissionManualOverride, setIsCommissionManualOverride] = useState(false);
  const [formCommissionOverrideReason, setFormCommissionOverrideReason] = useState("");
  const [formSubAgentSplitRate, setFormSubAgentSplitRate] = useState("50.0"); // 50% split default

  // Phase 4: Coverage Type & Insured Members
  const [formCoverageType, setFormCoverageType] = useState("INDIVIDUAL"); // 'INDIVIDUAL' | 'FAMILY_FLOATER'
  const [formInsuredMembers, setFormInsuredMembers] = useState([
    {
      customer_id: "",
      full_name: "",
      relationship: "Self",
      date_of_birth: "",
      gender: "MALE",
      mobile_number: "",
      email: "",
      address: "",
      member_code: "",
      individual_sum_insured: "1000000",
      notes: "",
    },
  ]);
  const [detectedFamilyGroup, setDetectedFamilyGroup] = useState(null);
  const [familyGroupModalOpen, setFamilyGroupModalOpen] = useState(false);
  const [selectedFamilyMemberIds, setSelectedFamilyMemberIds] = useState([]);

  // Policy 360 Drawer Member Management
  const [drawerAddMemberOpen, setDrawerAddMemberOpen] = useState(false);
  const [drawerNewMember, setDrawerNewMember] = useState({
    full_name: "",
    relationship: "Spouse",
    date_of_birth: "",
    gender: "FEMALE",
    mobile_number: "",
    email: "",
    member_code: "",
    individual_sum_insured: "",
    notes: "",
  });
  const [drawerMemberSubmitting, setDrawerMemberSubmitting] = useState(false);
  const [drawerMemberError, setDrawerMemberError] = useState("");

  // Nominees State
  const [formNominees, setFormNominees] = useState([
    {
      full_name: "",
      relationship: "Spouse",
      date_of_birth: "",
      mobile_number: "",
      address: "",
      share_percentage: "100",
    },
  ]);

  // Initial Payment (Optional)
  const [formRecordInitialPayment, setFormRecordInitialPayment] = useState(true);
  const [formPaymentMode, setFormPaymentMode] = useState("ONLINE");
  const [formBankName, setFormBankName] = useState("");
  const [formTransactionRef, setFormTransactionRef] = useState("");
  const [formPaymentAmount, setFormPaymentAmount] = useState("");
  const [isPaymentAmountManual, setIsPaymentAmountManual] = useState(false);
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [formPaymentDate, setFormPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [formPaymentNotes, setFormPaymentNotes] = useState("");

  // Legacy & Sub-Agent Share State
  const [formFirstYearCommission, setFormFirstYearCommission] = useState("");
  const [formSubAgentShare, setFormSubAgentShare] = useState("");

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Shortcuts: Inline Modals
  const [shortcutCustomerOpen, setShortcutCustomerOpen] = useState(false);
  const [scCustomerName, setScCustomerName] = useState("");
  const [scCustomerPhone, setScCustomerPhone] = useState("");
  const [scCustomerEmail, setScCustomerEmail] = useState("");
  const [scCustomerGender, setScCustomerGender] = useState("MALE");
  const [scCustomerLoading, setScCustomerLoading] = useState(false);

  const [shortcutCompanyOpen, setShortcutCompanyOpen] = useState(false);
  const [scCompanyName, setScCompanyName] = useState("");
  const [scCompanyCategory, setScCompanyCategory] = useState("LIFE");
  const [scCompanyLoading, setScCompanyLoading] = useState(false);

  const [shortcutPlanOpen, setShortcutPlanOpen] = useState(false);
  const [scPlanName, setScPlanName] = useState("");
  const [scPlanType, setScPlanType] = useState("LIFE");
  const [scPlanCompanyId, setScPlanCompanyId] = useState("");
  const [scPlanLoading, setScPlanLoading] = useState(false);

  // ==========================================
  // TAB 3: PREMIUM SCHEDULES
  // ==========================================
  const [schedules, setSchedules] = useState([]);
  const [scheduleTotal, setScheduleTotal] = useState(0);
  const [schedulePages, setSchedulePages] = useState(1);
  const [schedulePage, setSchedulePage] = useState(1);
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState("ALL");
  const [schedulesLoading, setSchedulesLoading] = useState(false);

  // Record Payment Modal
  const [payModalSchedule, setPayModalSchedule] = useState(null);
  const [payModalPolicyId, setPayModalPolicyId] = useState(null);
  const [payMode, setPayMode] = useState("ONLINE");
  const [payBank, setPayBank] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payNotes, setPayNotes] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");

  // ==========================================
  // TAB 4: RENEWALS & EXPIRIES
  // ==========================================
  const [upcomingRenewals, setUpcomingRenewals] = useState([]);
  const [renewalWindowDays, setRenewalWindowDays] = useState(30);
  const [renewalsLoading, setRenewalsLoading] = useState(false);

  // ==========================================
  // TAB 5: BULK IMPORT STATE
  // ==========================================
  const [importFile, setImportFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  // ==========================================
  // POLICY DOCUMENTS & ATTACHMENTS STATE
  // ==========================================
  // Staged Documents during New Policy Creation
  const [formStagedDocs, setFormStagedDocs] = useState([]);
  const [stagedDocFile, setStagedDocFile] = useState(null);
  const [stagedDocType, setStagedDocType] = useState("Official Policy Certificate");
  const [stagedDocTitle, setStagedDocTitle] = useState("");
  const [stagedDocDesc, setStagedDocDesc] = useState("");
  const [stagedDocError, setStagedDocError] = useState("");
  const stagedFileInputRef = useRef(null);

  // Policy Details Drawer Documents
  const [drawerPolicyDocs, setDrawerPolicyDocs] = useState([]);
  const [drawerPlanDocs, setDrawerPlanDocs] = useState([]);
  const [drawerDocsLoading, setDrawerDocsLoading] = useState(false);
  const [drawerDocsError, setDrawerDocsError] = useState("");

  // Drawer Document Upload Form State
  const [drawerUploadOpen, setDrawerUploadOpen] = useState(false);
  const [drawerUploadFile, setDrawerUploadFile] = useState(null);
  const [drawerUploadType, setDrawerUploadType] = useState("Official Policy Certificate");
  const [drawerUploadTitle, setDrawerUploadTitle] = useState("");
  const [drawerUploadDesc, setDrawerUploadDesc] = useState("");
  const [drawerUploadLoading, setDrawerUploadLoading] = useState(false);
  const [drawerUploadError, setDrawerUploadError] = useState("");
  const drawerUploadFileRef = useRef(null);

  // Replace Document State
  const [replaceTargetDoc, setReplaceTargetDoc] = useState(null);
  const [replaceFile, setReplaceFile] = useState(null);
  const [replaceLoading, setReplaceLoading] = useState(false);
  const [replaceError, setReplaceError] = useState("");
  const replaceFileInputRef = useRef(null);

  // Staged Document handlers
  const handleAddStagedDoc = () => {
    setStagedDocError("");
    if (!stagedDocFile) {
      setStagedDocError("Please select a file to stage.");
      return;
    }
    if (!stagedDocTitle.trim()) {
      setStagedDocError("Please provide a title for the document.");
      return;
    }
    const newDoc = {
      id: `staged_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      file: stagedDocFile,
      title: stagedDocTitle.trim(),
      document_type: stagedDocType,
      description: stagedDocDesc.trim(),
      filename: stagedDocFile.name,
      sizeFormatted: formatDocBytes(stagedDocFile.size),
    };
    setFormStagedDocs((prev) => [...prev, newDoc]);
    setStagedDocFile(null);
    setStagedDocTitle("");
    setStagedDocDesc("");
    if (stagedFileInputRef.current) stagedFileInputRef.current.value = "";
  };

  const handleRemoveStagedDoc = (docId) => {
    setFormStagedDocs((prev) => prev.filter((d) => d.id !== docId));
  };

  // Drawer Document Operations
  const fetchDrawerDocuments = async (policyId) => {
    if (!policyId) return;
    setDrawerDocsLoading(true);
    setDrawerDocsError("");
    try {
      const res = await api.insurance.getPolicyDocuments(policyId);
      if (res.ok && res.data) {
        setDrawerPolicyDocs(res.data.policy_documents || []);
        setDrawerPlanDocs(res.data.plan_documents || []);
      } else {
        setDrawerDocsError(res.error || "Failed to load policy documents.");
      }
    } catch (err) {
      setDrawerDocsError(err.message || "Failed to load policy documents.");
    } finally {
      setDrawerDocsLoading(false);
    }
  };

  const handleDrawerUploadDoc = async (e) => {
    if (e) e.preventDefault();
    if (!selectedPolicy?.id) return;
    if (!drawerUploadFile) {
      setDrawerUploadError("Please select a file to upload.");
      return;
    }
    if (!drawerUploadTitle.trim()) {
      setDrawerUploadError("Please provide a title for the document.");
      return;
    }
    setDrawerUploadLoading(true);
    setDrawerUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", drawerUploadFile);
      fd.append("document_type", drawerUploadType);
      fd.append("title", drawerUploadTitle.trim());
      if (drawerUploadDesc.trim()) {
        fd.append("description", drawerUploadDesc.trim());
      }
      const res = await api.insurance.uploadPolicyDocument(selectedPolicy.id, fd);
      if (res.ok) {
        setDrawerUploadFile(null);
        setDrawerUploadTitle("");
        setDrawerUploadDesc("");
        setDrawerUploadOpen(false);
        if (drawerUploadFileRef.current) drawerUploadFileRef.current.value = "";
        await fetchDrawerDocuments(selectedPolicy.id);
        fetchPolicies();
      } else {
        setDrawerUploadError(res.error || "Failed to upload document.");
      }
    } catch (err) {
      setDrawerUploadError(err.message || "Network error uploading document.");
    } finally {
      setDrawerUploadLoading(false);
    }
  };

  const handleDeleteDrawerDoc = async (docId) => {
    if (!selectedPolicy?.id || !docId) return;
    if (!window.confirm("Are you sure you want to permanently delete this policy document?")) return;
    const res = await api.insurance.deletePolicyDocument(selectedPolicy.id, docId);
    if (res.ok) {
      await fetchDrawerDocuments(selectedPolicy.id);
      fetchPolicies();
    } else {
      alert(res.error || "Failed to delete document.");
    }
  };

  const handleReplaceDrawerDoc = async (docId, file) => {
    if (!selectedPolicy?.id || !docId || !file) return;
    setReplaceLoading(true);
    setReplaceError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.insurance.updatePolicyDocument(selectedPolicy.id, docId, fd);
      if (res.ok) {
        setReplaceTargetDoc(null);
        setReplaceFile(null);
        if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
        await fetchDrawerDocuments(selectedPolicy.id);
      } else {
        setReplaceError(res.error || "Failed to replace document file.");
      }
    } catch (err) {
      setReplaceError(err.message || "Failed to replace document file.");
    } finally {
      setReplaceLoading(false);
    }
  };

  const handleViewPolicyDocBlob = async (doc) => {
    const res = await api.insurance.viewPolicyDocumentBlob(selectedPolicy.id, doc.id);
    if (res.ok && res.url) {
      window.open(res.url, "_blank");
    } else {
      alert(res.error || "Failed to open document preview.");
    }
  };

  const handleViewPlanDocBlob = async (doc) => {
    const res = await api.insurance.viewPolicyPlanDocumentBlob(selectedPolicy.id, doc.id);
    if (res.ok && res.url) {
      window.open(res.url, "_blank");
    } else {
      alert(res.error || "Failed to open plan document preview.");
    }
  };

  const handleDownloadPolicyDoc = (doc) => {
    api.insurance.downloadPolicyDocument(selectedPolicy.id, doc.id, doc.original_filename);
  };

  const handleDownloadPlanDoc = (doc) => {
    api.insurance.downloadPolicyPlanDocument(selectedPolicy.id, doc.id, doc.original_filename);
  };

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const fetchIssueYears = async () => {
    try {
      const res = await api.insurance.getPolicyIssueYears();
      if (res.ok && Array.isArray(res.data?.years)) {
        setAvailableIssueYears(res.data.years);
      }
    } catch (e) {
      console.warn("Failed to load issue years:", e);
    }
  };

  const fetchPolicies = async () => {
    setPoliciesLoading(true);
    const res = await api.insurance.getPolicies({
      page: policyPage,
      page_size: 10,
      search: policySearch.trim() || undefined,
      policy_type: policyTypeFilter !== "ALL" ? policyTypeFilter : undefined,
      business_type: filterBusinessType !== "ALL" ? filterBusinessType : undefined,
      status: policyStatusFilter !== "ALL" ? policyStatusFilter : undefined,
      issue_year: selectedIssueYear !== "ALL" ? selectedIssueYear : undefined,
      company_id: filterCompanyId || undefined,
      sub_agent_id: filterSubAgentId || undefined,
      start_date_from: filterStartDateFrom || undefined,
      start_date_to: filterStartDateTo || undefined,
      expiry_date_from: filterExpiryDateFrom || undefined,
      expiry_date_to: filterExpiryDateTo || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    });
    if (res.ok) {
      setPolicies(res.data.items || []);
      setTotalPolicies(res.data.total || 0);
      setPolicyPages(res.data.total_pages || 1);
      setTotalSumInsured(res.data.total_sum_insured || 0);
      setTotalGrossPremium(res.data.total_gross_premium || 0);
    } else {
      setActionError(res.error || "Failed to load policies.");
    }
    setPoliciesLoading(false);
  };

  const loadReferenceData = async (cat = null) => {
    setReferenceLoading(true);
    setReferenceError("");
    try {
      const lkRes = await api.insurance.getPolicyLookupData({ category: cat || undefined });
      if (lkRes.ok && lkRes.data) {
        if (Array.isArray(lkRes.data.customers)) setCustomers(lkRes.data.customers);
        if (Array.isArray(lkRes.data.companies)) setCompanies(lkRes.data.companies);
        if (Array.isArray(lkRes.data.plans)) setPlans(lkRes.data.plans);
        if (Array.isArray(lkRes.data.purchase_parties)) setPurchaseParties(lkRes.data.purchase_parties);
        if (Array.isArray(lkRes.data.sub_agents)) setSubAgents(lkRes.data.sub_agents);
        if (Array.isArray(lkRes.data.issue_years)) setAvailableIssueYears(lkRes.data.issue_years);
        setReferenceLoading(false);
        return;
      }
    } catch (e) {
      console.warn("Lookup endpoint fallback:", e);
    }

    try {
      const [cRes, coRes, pRes, ppRes, saRes] = await Promise.allSettled([
        api.insurance.getCustomers({ page_size: 200 }),
        api.insurance.getCompanies({ page_size: 100, status: "ACTIVE" }),
        api.insurance.getPlans({ page_size: 100, status: "ACTIVE" }),
        api.insurance.getPurchaseParties({ page_size: 100, status: "ACTIVE" }),
        api.insurance.getSubAgents({ page_size: 100, status: "ACTIVE" }),
      ]);
      if (cRes.status === "fulfilled" && cRes.value.ok && cRes.value.data) {
        setCustomers(cRes.value.data.items || cRes.value.data || []);
      }
      if (coRes.status === "fulfilled" && coRes.value.ok && coRes.value.data) {
        setCompanies(coRes.value.data.items || coRes.value.data || []);
      }
      if (pRes.status === "fulfilled" && pRes.value.ok && pRes.value.data) {
        setPlans(pRes.value.data.items || pRes.value.data || []);
      }
      if (ppRes.status === "fulfilled" && ppRes.value.ok && ppRes.value.data) {
        setPurchaseParties(ppRes.value.data.items || ppRes.value.data || []);
      }
      if (saRes.status === "fulfilled" && saRes.value.ok && saRes.value.data) {
        setSubAgents(saRes.value.data.items || saRes.value.data || []);
      }
    } catch (err) {
      console.error("Reference data loading error:", err);
      setReferenceError("Failed to load master dropdown data. Please check connection.");
    } finally {
      setReferenceLoading(false);
    }
  };

  const fetchSchedules = async () => {
    setSchedulesLoading(true);
    const res = await api.insurance.getPremiumSchedules({
      page: schedulePage,
      page_size: 10,
      status: scheduleStatusFilter !== "ALL" ? scheduleStatusFilter : undefined,
    });
    if (res.ok) {
      setSchedules(res.data.items || []);
      setScheduleTotal(res.data.total || 0);
      setSchedulePages(res.data.total_pages || 1);
    }
    setSchedulesLoading(false);
  };

  const fetchRenewals = async () => {
    setRenewalsLoading(true);
    const res = await api.insurance.getUpcomingRenewals(renewalWindowDays);
    if (res.ok) {
      setUpcomingRenewals(res.data.items || []);
    }
    setRenewalsLoading(false);
  };

  useEffect(() => {
    loadReferenceData();
    fetchIssueYears();
  }, []);

  useEffect(() => {
    if (activeTab === "new_policy" && (companies.length === 0 || plans.length === 0)) {
      loadReferenceData();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "policies") fetchPolicies();
    if (activeTab === "schedules") fetchSchedules();
    if (activeTab === "renewals") fetchRenewals();
  }, [
    activeTab,
    policyPage,
    policySearch,
    policyTypeFilter,
    filterBusinessType,
    policyStatusFilter,
    filterCompanyId,
    filterSubAgentId,
    filterStartDateFrom,
    filterStartDateTo,
    filterExpiryDateFrom,
    filterExpiryDateTo,
    sortBy,
    sortOrder,
    schedulePage,
    scheduleStatusFilter,
    renewalWindowDays,
    selectedIssueYear,
  ]);

  // Standard Sum Assured preset catalog (Phase 3)
  const STANDARD_SUM_ASSURED_OPTIONS = [
    { label: "₹5 Lakhs (₹5,00,000)", value: "500000" },
    { label: "₹7.5 Lakhs (₹7,50,000)", value: "750000" },
    { label: "₹10 Lakhs (₹10,00,000)", value: "1000000" },
    { label: "₹15 Lakhs (₹15,00,000)", value: "1500000" },
    { label: "₹20 Lakhs (₹20,00,000)", value: "2000000" },
    { label: "₹25 Lakhs (₹25,00,000)", value: "2500000" },
    { label: "₹30 Lakhs (₹30,00,000)", value: "3000000" },
    { label: "₹50 Lakhs (₹50,00,000)", value: "5000000" },
    { label: "₹75 Lakhs (₹75,00,000)", value: "7500000" },
    { label: "₹1 Crore (₹1,00,00,000)", value: "10000000" },
    { label: "₹2 Crores (₹2,00,00,000)", value: "20000000" },
  ];

  // Auto-calculate expiry date when Start Date or Term Years change (Phase 2)
  useEffect(() => {
    if (!formStartDate) return;
    try {
      const parts = formStartDate.split("-");
      if (parts.length === 3) {
        const startYear = parseInt(parts[0], 10);
        const term = parseInt(formPolicyTermYears, 10) || 1;
        const expiryYear = startYear + term;
        setFormExpiryDate(`${expiryYear}-${parts[1]}-${parts[2]}`);
      }
    } catch {
      // ignore
    }
  }, [formStartDate, formPolicyTermYears]);

  // Keep formFinalPremium synced with formGrossPremium
  useEffect(() => {
    if (formGrossPremium && formGrossPremium !== formFinalPremium) {
      setFormFinalPremium(formGrossPremium);
    }
  }, [formGrossPremium]);

  // Default payment amount to gross premium if empty
  useEffect(() => {
    const gross = formGrossPremium || formFinalPremium;
    if (!formPaymentAmount && gross) {
      setFormPaymentAmount(gross);
    }
  }, [formGrossPremium, formFinalPremium]);

  // Phase 5 & 6: Live Commission & TDS Calculation
  useEffect(() => {
    if (isCommissionManualOverride) return;
    const net = parseFloat(formNetPremium) || 0;
    const rate = parseFloat(formCommissionRate) || 0;
    const grossComm = (net * (rate / 100)).toFixed(2);
    setFormCommissionAmount(grossComm);

    const tdsR = parseFloat(formTdsRate) || 10;
    const tdsAmt = (parseFloat(grossComm) * (tdsR / 100)).toFixed(2);
    setFormTdsAmount(tdsAmt);

    const netPayable = (parseFloat(grossComm) - parseFloat(tdsAmt)).toFixed(2);
    setFormNetCommissionPayable(netPayable);

    // If sub-agent assigned, calculate split
    if (formSubAgentId) {
      const splitPct = parseFloat(formSubAgentSplitRate) || 50;
      const saGross = (parseFloat(grossComm) * (splitPct / 100)).toFixed(2);
      setFormSubAgentShare(saGross);
    } else {
      setFormSubAgentShare("");
    }
  }, [formNetPremium, formCommissionRate, formTdsRate, formSubAgentId, formSubAgentSplitRate, isCommissionManualOverride]);

  // Category Change Handler (Phase 1)
  const handleCategoryChange = async (newCat) => {
    setFormPolicyType(newCat);
    if (newCat === "LIFE") {
      setFormCoverageType("INDIVIDUAL");
    }
    setFormCompanyId("");
    setFormPlanId("");
    setFormSelectedRiderIds([]);
    setAvailablePlanRiders([]);
    setAvailablePlanBenefits([]);
    await loadReferenceData(newCat);
  };

  // Company Change Handler
  const handleCompanyChange = (newCoId) => {
    setFormCompanyId(newCoId);
    setFormPlanId("");
    setFormSelectedRiderIds([]);
    setAvailablePlanRiders([]);
    setAvailablePlanBenefits([]);
  };

  // Helper to extract riders array from any object, JSON string, or list
  const extractRidersFromPlanData = (planData) => {
    if (!planData) return [];
    if (Array.isArray(planData.plan_riders) && planData.plan_riders.length > 0) {
      return planData.plan_riders;
    }
    let raw = planData.riders;
    if (typeof raw === "string" && raw.trim().startsWith("[") && raw.trim().endsWith("]")) {
      try {
        raw = JSON.parse(raw);
      } catch (_) {}
    }
    if (Array.isArray(raw)) {
      return raw
        .map((r, i) =>
          typeof r === "object" && r !== null
            ? { id: r.id || `rider-${i}`, name: r.name || "", description: r.description || "" }
            : { id: `rider-${i}`, name: String(r), description: "" }
        )
        .filter((r) => r.name && r.name !== "[]" && r.name !== "{}");
    }
    if (typeof raw === "string" && raw.trim()) {
      return raw
        .split(/[\r\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((n) => n !== "[]" && n !== "{}")
        .map((name, i) => ({ id: `rider-${i}`, name, description: "" }));
    }
    return [];
  };

  // Helper to extract benefits array from any object, JSON string, or list
  const extractBenefitsFromPlanData = (planData) => {
    if (!planData) return [];
    if (Array.isArray(planData.plan_benefits) && planData.plan_benefits.length > 0) {
      return planData.plan_benefits;
    }
    let raw = planData.benefits;
    if (typeof raw === "string" && raw.trim().startsWith("[") && raw.trim().endsWith("]")) {
      try {
        raw = JSON.parse(raw);
      } catch (_) {}
    }
    if (Array.isArray(raw)) {
      return raw
        .map((b, i) =>
          typeof b === "object" && b !== null
            ? { id: b.id || `benefit-${i}`, name: b.name || "", description: b.description || "" }
            : { id: `benefit-${i}`, name: String(b), description: "" }
        )
        .filter((b) => b.name && b.name !== "[]" && b.name !== "{}");
    }
    if (typeof raw === "string" && raw.trim()) {
      return raw
        .split(/[\r\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((n) => n !== "[]" && n !== "{}")
        .map((name, i) => ({ id: `benefit-${i}`, name, description: "" }));
    }
    return [];
  };

  // Automatically fetch riders & coverage benefits when selected plan changes
  useEffect(() => {
    if (!formPlanId) {
      setAvailablePlanRiders([]);
      setAvailablePlanBenefits([]);
      setFormSelectedRiderIds([]);
      return;
    }

    let isMounted = true;
    const fetchPlanRidersAndBenefits = async () => {
      setPlanRidersLoading(true);
      try {
        // 1. Immediately check if the plan in local reference cache has riders/benefits
        const cachedPlan = (plans || []).find((p) => String(p.id) === String(formPlanId));
        if (cachedPlan && isMounted) {
          const cachedRiders = extractRidersFromPlanData(cachedPlan);
          const cachedBenefits = extractBenefitsFromPlanData(cachedPlan);
          if (cachedRiders.length > 0) setAvailablePlanRiders(cachedRiders);
          if (cachedBenefits.length > 0) setAvailablePlanBenefits(cachedBenefits);
        }

        // 2. Fetch fresh details from API in parallel
        const [planRes, ridersRes, benefitsRes] = await Promise.allSettled([
          api.insurance.getPlan(formPlanId),
          api.insurance.getPlanRiders(formPlanId),
          api.insurance.getPlanBenefits(formPlanId),
        ]);

        if (!isMounted) return;

        let finalRiders = [];
        let finalBenefits = [];

        // Check direct sub-endpoints first
        if (
          ridersRes.status === "fulfilled" &&
          ridersRes.value.ok &&
          Array.isArray(ridersRes.value.data) &&
          ridersRes.value.data.length > 0
        ) {
          finalRiders = ridersRes.value.data;
        }

        if (
          benefitsRes.status === "fulfilled" &&
          benefitsRes.value.ok &&
          Array.isArray(benefitsRes.value.data) &&
          benefitsRes.value.data.length > 0
        ) {
          finalBenefits = benefitsRes.value.data;
        }

        // If sub-endpoints were empty or didn't return, check planRes
        if (planRes.status === "fulfilled" && planRes.value.ok && planRes.value.data) {
          const pData = planRes.value.data;
          if (finalRiders.length === 0) {
            finalRiders = extractRidersFromPlanData(pData);
          }
          if (finalBenefits.length === 0) {
            finalBenefits = extractBenefitsFromPlanData(pData);
          }
        }

        // Fallback to cachedPlan if still empty
        if (finalRiders.length === 0 && cachedPlan) {
          finalRiders = extractRidersFromPlanData(cachedPlan);
        }
        if (finalBenefits.length === 0 && cachedPlan) {
          finalBenefits = extractBenefitsFromPlanData(cachedPlan);
        }

        setAvailablePlanRiders(finalRiders);
        setAvailablePlanBenefits(finalBenefits);

        // Retain only selected rider IDs that are valid for the active plan
        setFormSelectedRiderIds((prev) => {
          if (prev.length === 0) return prev;
          const validIds = new Set(finalRiders.map((r) => String(r.id)));
          return prev.filter((id) => validIds.has(String(id)));
        });
      } catch (err) {
        console.error("Failed to fetch plan riders & benefits:", err);
      } finally {
        if (isMounted) setPlanRidersLoading(false);
      }
    };

    fetchPlanRidersAndBenefits();

    return () => {
      isMounted = false;
    };
  }, [formPlanId, plans]);

  const handleToggleRider = (riderId) => {
    setFormSelectedRiderIds((prev) => {
      const sId = String(riderId);
      if (prev.some((id) => String(id) === sId)) {
        return prev.filter((id) => String(id) !== sId);
      } else {
        return [...prev, riderId];
      }
    });
  };

  const handleToggleEditRider = (riderId) => {
    setEditSelectedRiderIds((prev) => {
      const sId = String(riderId);
      if (prev.some((id) => String(id) === sId)) {
        return prev.filter((id) => String(id) !== sId);
      } else {
        return [...prev, riderId];
      }
    });
  };

  // Sum Assured Preset Handler (Phase 3)
  const handleSumAssuredPresetSelect = (val) => {
    setSumAssuredPreset(val);
    if (val !== "CUSTOM") {
      setFormSumAssured(val);
    }
  };

  // Phase 4: GST Toggle & Premium Automation
  const handleToggleGst = () => {
    const nextGst = !isGstEnabled;
    setIsGstEnabled(nextGst);
    setIsGrossManualOverride(false);
    const net = parseFloat(formNetPremium) || 0;
    const gross = nextGst ? (net * 1.18).toFixed(2) : (net > 0 ? net.toFixed(2) : "");
    setFormGrossPremium(gross);
    setFormFinalPremium(gross);
    if (!isPaymentAmountManual) {
      setFormPaymentAmount(gross);
    }
  };

  const handleNetPremiumChange = (val) => {
    setFormNetPremium(val);
    if (!isGrossManualOverride) {
      const net = parseFloat(val) || 0;
      const gross = isGstEnabled ? (net * 1.18).toFixed(2) : (net > 0 ? net.toFixed(2) : "");
      setFormGrossPremium(gross);
      setFormFinalPremium(gross);
      if (!isPaymentAmountManual) {
        setFormPaymentAmount(gross);
      }
    }
  };

  const handleGrossPremiumChange = (val) => {
    setFormGrossPremium(val);
    setFormFinalPremium(val);
    setIsGrossManualOverride(true);
    if (!isPaymentAmountManual) {
      setFormPaymentAmount(val);
    }
  };

  const handleResetGrossPremium = () => {
    setIsGrossManualOverride(false);
    const net = parseFloat(formNetPremium) || 0;
    const gross = isGstEnabled ? (net * 1.18).toFixed(2) : (net > 0 ? net.toFixed(2) : "");
    setFormGrossPremium(gross);
    setFormFinalPremium(gross);
    if (!isPaymentAmountManual) {
      setFormPaymentAmount(gross);
    }
  };

  // Phase 5: Payment Amount Auto-sync & Reset
  const handlePaymentAmountChange = (val) => {
    setFormPaymentAmount(val);
    setIsPaymentAmountManual(true);
  };

  const handleResetPaymentAmount = () => {
    const target = formGrossPremium || formFinalPremium || "";
    setFormPaymentAmount(target);
    setIsPaymentAmountManual(false);
  };

  // Policy History Handlers (PORT & RENEW)
  const handleAddEarlierPolicyHistory = () => {
    const nextSeq = formPolicyHistory.length + 1;
    setFormPolicyHistory((prev) => [
      ...prev,
      createDefaultPolicyHistoryEntry(nextSeq, formBusinessType || "PORT"),
    ]);
  };

  const handleUpdatePolicyHistory = (index, field, value) => {
    setFormPolicyHistory((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
    // If sequence 1, sync backward compatibility fields
    if (index === 0) {
      if (field === "previous_policy_number") setFormPrevPolicyNumber(value);
      if (field === "insurance_company_name") setFormPrevInsurer(value);
      if (field === "continuity_details") setFormPortabilityContinuity(value);
    }
  };

  const handleRemovePolicyHistory = (index) => {
    if (index === 0) return; // Sequence 1 is mandatory
    setFormPolicyHistory((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((item, idx) => ({
        ...item,
        history_sequence: idx + 1,
      }));
    });
  };

  const handleSelectExistingPolicyForHistory = (index, pol) => {
    if (!pol) return;
    setFormPolicyHistory((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        previous_policy_id: pol.id,
        insurance_company_name: pol.company_name || copy[index].insurance_company_name,
        previous_policy_number: pol.policy_number,
        policy_start_date: pol.policy_start_date || copy[index].policy_start_date,
        policy_expiry_date: pol.expiry_date || copy[index].policy_expiry_date,
        sum_insured: pol.sum_assured || copy[index].sum_insured,
        net_premium: pol.net_premium || copy[index].net_premium,
        gross_premium: pol.final_premium || copy[index].gross_premium,
        product_variant: pol.product_variant || pol.plan_name || copy[index].product_variant,
        is_external_policy: false,
      };
      return copy;
    });
    if (index === 0) {
      setFormPrevPolicyNumber(pol.policy_number);
      if (pol.company_name) setFormPrevInsurer(pol.company_name);
    }
  };

  // Phase 2: Autocomplete selection
  const handleSelectCustomerFromAutocomplete = (cust) => {
    if (!cust) return;
    setFormCustomerId(cust.id);
    const fullName =
      cust.company_name ||
      cust.full_name ||
      `${cust.first_name || ""} ${cust.last_name || ""}`.trim() ||
      "Customer";
    const mobile = cust.phone || cust.mobile || "";
    const email = cust.email || "";
    const city = cust.city || "";
    const pincode = cust.pincode || cust.pin_code || "";
    const state = cust.state || "";
    const address = cust.address || "";
    const customerType = cust.customer_type || "INDIVIDUAL";

    setFormContactMobile(mobile);
    setFormContactEmail(email);
    setFormContactCity(city);
    setFormContactPincode(pincode);

    setCustomerSnapshot({
      id: cust.id,
      fullName,
      mobile,
      email,
      city,
      pincode,
      state,
      address,
      customerType,
    });

    // Update Insured Member #1 (Self)
    setFormInsuredMembers((prev) => {
      const copy = [...prev];
      if (copy.length === 0) {
        copy.push({
          customer_id: cust.id,
          full_name: fullName,
          relationship: "Self",
          date_of_birth: cust.date_of_birth || "",
          gender: cust.gender || "MALE",
          mobile_number: mobile,
          email: email,
          address: address,
          member_code: "",
          individual_sum_insured: formSumAssured || "1000000",
          notes: "",
        });
      } else {
        copy[0] = {
          ...copy[0],
          customer_id: cust.id,
          full_name: fullName,
          relationship: "Self",
          date_of_birth: copy[0].date_of_birth || cust.date_of_birth || "",
          gender: copy[0].gender || cust.gender || "MALE",
          mobile_number: copy[0].mobile_number || mobile,
          email: copy[0].email || email,
          address: copy[0].address || address,
        };
      }
      return copy;
    });

    checkCustomerFamilyGroup(cust.id);
  };

  const handleClearCustomer = () => {
    setFormCustomerId("");
    setCustomerSnapshot(null);
    setFormContactMobile("");
    setFormContactEmail("");
    setFormContactCity("");
    setFormContactPincode("");
    setDetectedFamilyGroup(null);
  };

  // Phase 1: Draft persistence helpers
  const getCurrentFormData = () => ({
    policyType: formPolicyType,
    coverageType: formCoverageType,
    customerId: formCustomerId,
    companyId: formCompanyId,
    planId: formPlanId,
    selectedRiderIds: formSelectedRiderIds,
    purchasePartyId: formPurchasePartyId,
    subAgentId: formSubAgentId,
    policyNumber: formPolicyNumber,
    proposalNumber: formProposalNumber,
    businessType: formBusinessType,
    prevPolicyNumber: formPrevPolicyNumber,
    prevInsurer: formPrevInsurer,
    portabilityContinuity: formPortabilityContinuity,
    productVariant: formProductVariant,
    hospitalCashBenefit: formHospitalCashBenefit,
    vehicleRegNo: formVehicleRegNo,
    vehicleManufacturer: formVehicleManufacturer,
    vehicleModel: formVehicleModel,
    vehicleType: formVehicleType,
    travelDestination: formTravelDestination,
    travelType: formTravelType,
    intermediaryName: formIntermediaryName,
    contactCity: formContactCity,
    contactPincode: formContactPincode,
    contactMobile: formContactMobile,
    contactEmail: formContactEmail,
    policyTermYears: formPolicyTermYears,
    sumAssured: formSumAssured,
    netPremium: formNetPremium,
    grossPremium: formGrossPremium,
    finalPremium: formFinalPremium,
    isGstEnabled,
    isGrossManualOverride,
    isSinglePremium: formIsSinglePremium,
    premiumMode: formPremiumMode,
    startDate: formStartDate,
    firstReceiptDate: formFirstReceiptDate,
    expiryDate: formExpiryDate,
    policyNotes: formPolicyNotes,
    insuredMembers: formInsuredMembers,
    nominees: formNominees,
    policyYears: [],
    policyHistory: formPolicyHistory,
    commissionRate: formCommissionRate,
    commissionAmount: formCommissionAmount,
    tdsRate: formTdsRate,
    tdsAmount: formTdsAmount,
    netCommissionPayable: formNetCommissionPayable,
    isCommissionManualOverride,
    commissionOverrideReason: formCommissionOverrideReason,
    subAgentSplitRate: formSubAgentSplitRate,
    subAgentShare: formSubAgentShare,
    recordInitialPayment: formRecordInitialPayment,
    paymentMode: formPaymentMode,
    bankName: formBankName,
    transactionRef: formTransactionRef,
    paymentAmount: formPaymentAmount,
    isPaymentAmountManual,
    paymentDate: formPaymentDate,
    paymentNotes: formPaymentNotes,
  });

  const handleMinimizeForm = () => {
    minimizeDraft(getCurrentFormData(), customerSnapshot);
    setActiveTab("policies");
  };

  const handleResumeDraft = () => {
    if (!draft || !draft.formData) return;
    const d = draft.formData;
    if (d.policyType) setFormPolicyType(d.policyType);
    if (d.coverageType) setFormCoverageType(d.coverageType);
    if (d.customerId) setFormCustomerId(d.customerId);
    if (d.companyId) setFormCompanyId(d.companyId);
    if (d.planId) setFormPlanId(d.planId);
    if (Array.isArray(d.selectedRiderIds)) setFormSelectedRiderIds(d.selectedRiderIds);
    if (d.purchasePartyId) setFormPurchasePartyId(d.purchasePartyId);
    if (d.subAgentId) setFormSubAgentId(d.subAgentId);
    if (d.policyNumber) setFormPolicyNumber(d.policyNumber);
    if (d.proposalNumber) setFormProposalNumber(d.proposalNumber);
    if (d.businessType) setFormBusinessType(d.businessType);
    if (d.prevPolicyNumber) setFormPrevPolicyNumber(d.prevPolicyNumber);
    if (d.prevInsurer) setFormPrevInsurer(d.prevInsurer);
    if (d.portabilityContinuity) setFormPortabilityContinuity(d.portabilityContinuity);
    if (d.productVariant) setFormProductVariant(d.productVariant);
    if (d.hospitalCashBenefit) setFormHospitalCashBenefit(d.hospitalCashBenefit);
    if (d.vehicleRegNo) setFormVehicleRegNo(d.vehicleRegNo);
    if (d.vehicleManufacturer) setFormVehicleManufacturer(d.vehicleManufacturer);
    if (d.vehicleModel) setFormVehicleModel(d.vehicleModel);
    if (d.vehicleType) setFormVehicleType(d.vehicleType);
    if (d.travelDestination) setFormTravelDestination(d.travelDestination);
    if (d.travelType) setFormTravelType(d.travelType);
    if (d.intermediaryName) setFormIntermediaryName(d.intermediaryName);
    if (d.contactCity) setFormContactCity(d.contactCity);
    if (d.contactPincode) setFormContactPincode(d.contactPincode);
    if (d.contactMobile) setFormContactMobile(d.contactMobile);
    if (d.contactEmail) setFormContactEmail(d.contactEmail);
    if (d.policyTermYears) setFormPolicyTermYears(d.policyTermYears);
    if (d.sumAssured) setFormSumAssured(d.sumAssured);
    if (d.netPremium) setFormNetPremium(d.netPremium);
    if (d.grossPremium) setFormGrossPremium(d.grossPremium);
    if (d.finalPremium) setFormFinalPremium(d.finalPremium);
    if (d.isGstEnabled !== undefined) setIsGstEnabled(d.isGstEnabled);
    if (d.isGrossManualOverride !== undefined) setIsGrossManualOverride(d.isGrossManualOverride);
    if (d.isSinglePremium !== undefined) setFormIsSinglePremium(d.isSinglePremium);
    if (d.premiumMode) setFormPremiumMode(d.premiumMode);
    if (d.startDate) setFormStartDate(d.startDate);
    if (d.firstReceiptDate) setFormFirstReceiptDate(d.firstReceiptDate);
    if (d.expiryDate) setFormExpiryDate(d.expiryDate);
    if (d.policyNotes) setFormPolicyNotes(d.policyNotes);
    if (d.insuredMembers && d.insuredMembers.length > 0) setFormInsuredMembers(d.insuredMembers);
    if (d.nominees && d.nominees.length > 0) setFormNominees(d.nominees);
    if (d.policyHistory && d.policyHistory.length > 0) {
      setFormPolicyHistory(d.policyHistory);
      if (d.policyHistory[0]?.previous_policy_number) setFormPrevPolicyNumber(d.policyHistory[0].previous_policy_number);
      if (d.policyHistory[0]?.insurance_company_name) setFormPrevInsurer(d.policyHistory[0].insurance_company_name);
      if (d.policyHistory[0]?.continuity_details) setFormPortabilityContinuity(d.policyHistory[0].continuity_details);
    }
    if (d.commissionRate) setFormCommissionRate(d.commissionRate);
    if (d.commissionAmount) setFormCommissionAmount(d.commissionAmount);
    if (d.tdsRate) setFormTdsRate(d.tdsRate);
    if (d.tdsAmount) setFormTdsAmount(d.tdsAmount);
    if (d.netCommissionPayable) setFormNetCommissionPayable(d.netCommissionPayable);
    if (d.isCommissionManualOverride !== undefined) setIsCommissionManualOverride(d.isCommissionManualOverride);
    if (d.commissionOverrideReason) setFormCommissionOverrideReason(d.commissionOverrideReason);
    if (d.subAgentSplitRate) setFormSubAgentSplitRate(d.subAgentSplitRate);
    if (d.subAgentShare) setFormSubAgentShare(d.subAgentShare);
    if (d.recordInitialPayment !== undefined) setFormRecordInitialPayment(d.recordInitialPayment);
    if (d.paymentMode) setFormPaymentMode(d.paymentMode);
    if (d.bankName) setFormBankName(d.bankName);
    if (d.transactionRef) setFormTransactionRef(d.transactionRef);
    if (d.paymentAmount) setFormPaymentAmount(d.paymentAmount);
    if (d.isPaymentAmountManual !== undefined) setIsPaymentAmountManual(d.isPaymentAmountManual);
    if (d.paymentDate) setFormPaymentDate(d.paymentDate);
    if (d.paymentNotes) setFormPaymentNotes(d.paymentNotes);

    if (draft.customerSnapshot) {
      setCustomerSnapshot(draft.customerSnapshot);
    }
    setDraftLoaded(true);
  };

  // Auto-restore draft when navigating to new_policy with active unminimized draft (e.g. from Resume Policy bar)
  useEffect(() => {
    if (activeTab === "new_policy" && draft && draft.formData && !draftLoaded && !isMinimized) {
      handleResumeDraft();
    }
  }, [activeTab, draft, draftLoaded, isMinimized]);

  const handleStartNewDraft = () => {
    if (window.confirm("Start a fresh policy draft? This will discard your previously saved draft.")) {
      discardDraft();
      handleResetForm();
      setDraftLoaded(true);
      setDraftDismissed(true);
    }
  };

  const handleOpenNewPolicyTab = () => {
    if (hasDraft && isMinimized) {
      setShowDraftResumePrompt(true);
    } else {
      setActiveTab("new_policy");
    }
  };

  // Refs to capture current form state for automatic minimization on route navigation / unmount
  const currentFormDataRef = useRef(null);
  const customerSnapshotRef = useRef(null);
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    currentFormDataRef.current = getCurrentFormData();
    customerSnapshotRef.current = customerSnapshot;
    activeTabRef.current = activeTab;
  });

  // Automatic minimization when switching tabs away from 'new_policy'
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (prevTabRef.current === "new_policy" && activeTab !== "new_policy") {
      const d = currentFormDataRef.current;
      const hasContent = !!(d?.customerId || d?.policyNumber || d?.netPremium || d?.grossPremium || (d?.businessType && d.businessType !== "NEW"));
      if (hasContent) {
        minimizeDraft(d, customerSnapshotRef.current);
      }
    }
    prevTabRef.current = activeTab;
  }, [activeTab, minimizeDraft]);

  // Automatic minimization on route unmount (e.g. navigating to Commission, Dashboard, etc.)
  useEffect(() => {
    return () => {
      if (activeTabRef.current === "new_policy") {
        const d = currentFormDataRef.current;
        const hasContent = !!(d?.customerId || d?.policyNumber || d?.netPremium || d?.grossPremium || (d?.businessType && d.businessType !== "NEW"));
        if (hasContent) {
          minimizeDraft(d, customerSnapshotRef.current);
        }
      }
    };
  }, [minimizeDraft]);

  // Auto-save draft whenever form fields change while activeTab === 'new_policy'
  useEffect(() => {
    if (activeTab === "new_policy") {
      const hasContent = !!(formCustomerId || formPolicyNumber || formNetPremium || formGrossPremium || (formBusinessType && formBusinessType !== "NEW"));
      if (hasContent) {
        saveDraft(getCurrentFormData(), customerSnapshot);
      }
    }
  }, [
    activeTab,
    formCustomerId,
    formCompanyId,
    formPlanId,
    formSelectedRiderIds,
    formPolicyNumber,
    formBusinessType,
    formPolicyHistory,
    formNetPremium,
    formGrossPremium,
    formSumAssured,
    isGstEnabled,
    isGrossManualOverride,
    formStartDate,
    formExpiryDate,
    formInsuredMembers,
    formNominees,
    formPolicyYears,
    formPaymentAmount,
    isPaymentAmountManual,
    customerSnapshot,
  ]);

  // Member & Family Group Helper Functions
  const calculateAge = (dobString) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  };

  const RELATIONSHIP_OPTIONS = [
    "Self",
    "Spouse",
    "Son",
    "Daughter",
    "Father",
    "Mother",
    "Father-in-Law",
    "Mother-in-Law",
    "Brother",
    "Sister",
    "Grandfather",
    "Grandmother",
    "Grandson",
    "Granddaughter",
    "Other",
  ];

  const handleAddMember = () => {
    setFormInsuredMembers([
      ...formInsuredMembers,
      {
        customer_id: "",
        full_name: "",
        relationship: "Spouse",
        date_of_birth: "",
        gender: "FEMALE",
        mobile_number: "",
        email: "",
        address: "",
        member_code: "",
        individual_sum_insured: formSumAssured || "1000000",
        notes: "",
      },
    ]);
  };

  const handleRemoveMember = (index) => {
    if (formInsuredMembers.length <= 1) {
      setFormInsuredMembers([
        {
          customer_id: formCustomerId || "",
          full_name: "",
          relationship: "Self",
          date_of_birth: "",
          gender: "MALE",
          mobile_number: "",
          email: "",
          address: "",
          member_code: "",
          individual_sum_insured: formSumAssured || "1000000",
          notes: "",
        },
      ]);
      return;
    }
    setFormInsuredMembers(formInsuredMembers.filter((_, i) => i !== index));
  };

  const handleMemberChange = (index, field, value) => {
    const updated = [...formInsuredMembers];
    updated[index][field] = value;
    setFormInsuredMembers(updated);
  };

  const totalMemberAllocatedSI = formInsuredMembers.reduce(
    (acc, curr) => acc + (parseFloat(curr.individual_sum_insured) || 0),
    0
  );

  const handleCustomerChange = async (customerId) => {
    setFormCustomerId(customerId);
    if (!customerId) {
      setDetectedFamilyGroup(null);
      return;
    }
    const cust = (customers || []).find((c) => String(c.id) === String(customerId));
    if (cust) {
      // Auto-populate contact snapshot
      setFormContactMobile(cust.phone || cust.mobile || "");
      setFormContactEmail(cust.email || "");
      setFormContactCity(cust.city || "");
      setFormContactPincode(cust.pin_code || cust.pincode || "");
      const custName =
        cust.company_name ||
        cust.full_name ||
        (cust.first_name ? `${cust.first_name} ${cust.last_name || ""}`.trim() : cust.name || "Customer");
      setFormInsuredMembers((prev) => {
        const copy = [...prev];
        if (copy.length === 0) {
          copy.push({
            customer_id: cust.id,
            full_name: custName,
            relationship: "Self",
            date_of_birth: cust.date_of_birth || "",
            gender: cust.gender || "MALE",
            mobile_number: cust.phone || "",
            email: cust.email || "",
            address: cust.address || "",
            member_code: "",
            individual_sum_insured: formSumAssured || "1000000",
            notes: "",
          });
        } else {
          copy[0] = {
            ...copy[0],
            customer_id: cust.id,
            full_name: custName,
            relationship: "Self",
            date_of_birth: copy[0].date_of_birth || cust.date_of_birth || "",
            gender: cust.gender || copy[0].gender || "MALE",
            mobile_number: copy[0].mobile_number || cust.phone || "",
            email: copy[0].email || cust.email || "",
            address: copy[0].address || cust.address || "",
            individual_sum_insured: copy[0].individual_sum_insured || formSumAssured || "1000000",
          };
        }
        return copy;
      });

      // Query family group
      try {
        const fgRes = await api.insurance.getCustomerFamilyGroupMembers(customerId);
        if (fgRes.ok && fgRes.data && fgRes.data.has_family_group) {
          setDetectedFamilyGroup(fgRes.data);
          const nonSelfIds = (fgRes.data.members || [])
            .filter((m) => m.relationship?.toUpperCase() !== "SELF")
            .map((m) => m.customer_id || m.full_name);
          setSelectedFamilyMemberIds(nonSelfIds);
        } else {
          setDetectedFamilyGroup(null);
        }
      } catch (err) {
        console.error("Failed to fetch family group for customer:", err);
        setDetectedFamilyGroup(null);
      }
    }
  };

  const handleImportFamilyMembers = () => {
    if (!detectedFamilyGroup || !detectedFamilyGroup.members) return;
    const toImport = detectedFamilyGroup.members.filter((m) =>
      selectedFamilyMemberIds.includes(m.customer_id || m.full_name)
    );

    const existingNames = new Set(formInsuredMembers.map((m) => m.full_name.trim().toLowerCase()));
    const newMembers = [...formInsuredMembers];

    for (const fam of toImport) {
      if (fam.relationship?.toUpperCase() === "SELF") continue;
      if (existingNames.has(fam.full_name.trim().toLowerCase())) continue;

      newMembers.push({
        customer_id: fam.customer_id || "",
        full_name: fam.full_name,
        relationship: fam.relationship || "Spouse",
        date_of_birth: fam.date_of_birth || "",
        gender: fam.gender || "MALE",
        mobile_number: fam.mobile_number || "",
        email: fam.email || "",
        address: fam.address || "",
        member_code: "",
        individual_sum_insured: formSumAssured || "1000000",
        notes: "",
      });
      existingNames.add(fam.full_name.trim().toLowerCase());
    }

    setFormInsuredMembers(newMembers);
    setFamilyGroupModalOpen(false);
  };

  const handleDrawerAddMemberSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPolicy) return;
    if (!drawerNewMember.full_name.trim()) {
      setDrawerMemberError("Member full name is required.");
      return;
    }
    setDrawerMemberSubmitting(true);
    setDrawerMemberError("");

    const isFloater = selectedPolicy.coverage_type === "FAMILY_FLOATER";
    const payload = {
      full_name: drawerNewMember.full_name.trim(),
      relationship: drawerNewMember.relationship,
      date_of_birth: drawerNewMember.date_of_birth || null,
      gender: drawerNewMember.gender || null,
      mobile_number: drawerNewMember.mobile_number?.trim() || null,
      email: drawerNewMember.email?.trim() || null,
      member_code: drawerNewMember.member_code?.trim() || null,
      individual_sum_insured: isFloater
        ? null
        : parseFloat(drawerNewMember.individual_sum_insured) ||
          parseFloat(selectedPolicy.sum_assured) ||
          500000,
      notes: drawerNewMember.notes?.trim() || null,
    };

    const res = await api.insurance.addPolicyMember(selectedPolicy.id, payload);
    setDrawerMemberSubmitting(false);

    if (res.ok) {
      const polRes = await api.insurance.getPolicy(selectedPolicy.id);
      if (polRes.ok) {
        setSelectedPolicy(polRes.data);
      }
      setDrawerAddMemberOpen(false);
      setDrawerNewMember({
        full_name: "",
        relationship: "Spouse",
        date_of_birth: "",
        gender: "FEMALE",
        mobile_number: "",
        email: "",
        member_code: "",
        individual_sum_insured: "",
        notes: "",
      });
      fetchPolicies();
    } else {
      setDrawerMemberError(res.error || "Failed to add member.");
    }
  };

  const handleRemoveMemberFromPolicy = async (policyId, memberId) => {
    if (!window.confirm("Remove this covered person from the policy?")) return;
    const res = await api.insurance.removePolicyMember(policyId, memberId);
    if (res.ok) {
      const polRes = await api.insurance.getPolicy(policyId);
      if (polRes.ok) {
        setSelectedPolicy(polRes.data);
      }
      fetchPolicies();
    } else {
      alert(res.error || "Failed to remove member.");
    }
  };

  // Nominee helper functions
  const handleAddNominee = () => {
    const currentTotal = formNominees.reduce((acc, curr) => acc + (parseFloat(curr.share_percentage) || 0), 0);
    const remaining = Math.max(0, 100 - currentTotal);
    setFormNominees([
      ...formNominees,
      {
        full_name: "",
        relationship: "Son",
        date_of_birth: "",
        mobile_number: "",
        address: "",
        share_percentage: remaining > 0 ? String(remaining) : "0",
      },
    ]);
  };

  const handleRemoveNominee = (index) => {
    if (formNominees.length === 1) {
      // Reset single row
      setFormNominees([
        {
          full_name: "",
          relationship: "Spouse",
          date_of_birth: "",
          mobile_number: "",
          address: "",
          share_percentage: "100",
        },
      ]);
      return;
    }
    const updated = formNominees.filter((_, i) => i !== index);
    setFormNominees(updated);
  };

  const handleNomineeChange = (index, field, value) => {
    const updated = [...formNominees];
    updated[index][field] = value;
    setFormNominees(updated);
  };

  const totalNomineeShare = formNominees.reduce(
    (acc, curr) => acc + (parseFloat(curr.share_percentage) || 0),
    0
  );

  // Generate Policy Number
  const handleGeneratePolicyNo = () => {
    const prefix =
      formPolicyType === "LIFE"
        ? "POL-LIFE"
        : formPolicyType === "HEALTH"
        ? "POL-HLTH"
        : formPolicyType === "MOTOR"
        ? "POL-MOTR"
        : formPolicyType === "TRAVEL"
        ? "POL-TRVL"
        : formPolicyType === "HOME"
        ? "POL-HOME"
        : formPolicyType === "FIRE"
        ? "POL-FIRE"
        : formPolicyType === "MARINE"
        ? "POL-MARN"
        : formPolicyType === "OTHER"
        ? "POL-OTHR"
        : "POL-CORP";
    const year = new Date().getFullYear();
    const rand = Math.floor(10000 + Math.random() * 90000);
    setFormPolicyNumber(`${prefix}-${year}-${rand}`);
  };

  // Filtered dropdown helpers
  const filteredCustomers = (customers || []).filter((c) => {
    if (!customerSearchTerm.trim()) return true;
    const q = customerSearchTerm.toLowerCase();
    const name = (c.full_name || (c.first_name ? `${c.first_name} ${c.last_name || ""}` : c.name || "")).toLowerCase();
    const phone = (c.phone || "").toLowerCase();
    const email = (c.email || "").toLowerCase();
    return name.includes(q) || phone.includes(q) || email.includes(q);
  });

  const getLobCategory = (planLobRaw) => {
    return getCategoryCode(planLobRaw);
  };

  // Filtered companies based on canonical category and supported categories
  const filteredCompanies = (companies || []).filter((co) => {
    if (co.is_active === false) return false;
    if (!formPolicyType || formPolicyType === "ALL" || formPolicyType === "OTHER") return true;
    const cats =
      Array.isArray(co.supported_categories) && co.supported_categories.length > 0
        ? co.supported_categories
        : Array.isArray(co.categories) && co.categories.length > 0
        ? co.categories
        : [co.category];
    return cats.some((cat) => categoriesMatch(cat, formPolicyType));
  });

  const companyPlans = (plans || []).filter((p) => {
    const matchCompany = !formCompanyId || String(p.company_id) === String(formCompanyId);
    const isActive = p.is_active !== false && p.status !== "INACTIVE";
    return matchCompany && isActive;
  });

  const matchingCategoryPlans = companyPlans.filter((p) => {
    const planLob = p.line_of_business || p.lob || p.policy_type || "";
    return categoriesMatch(planLob, formPolicyType);
  });

  const filteredPlans = matchingCategoryPlans;
  const availablePlans = filteredPlans;

  // Clear all filters
  const handleClearFilters = () => {
    setPolicySearch("");
    setSelectedIssueYear("ALL");
    setPolicyTypeFilter("ALL");
    setPolicyStatusFilter("ALL");
    setFilterCompanyId("");
    setFilterSubAgentId("");
    setFilterStartDateFrom("");
    setFilterStartDateTo("");
    setFilterExpiryDateFrom("");
    setFilterExpiryDateTo("");
    setSortBy("created_at");
    setSortOrder("desc");
    setPolicyPage(1);
  };

  // Submit New Policy Form
  const handleSavePolicy = async (e) => {
    e.preventDefault();
    if (!formCustomerId || !formCompanyId || !formPlanId || !formPolicyNumber.trim()) {
      setFormError("Customer, Company, Plan, and Policy Number are required.");
      return;
    }
    const saCheck = validatePositiveDecimal(formSumAssured, "Sum Assured", true);
    if (!saCheck.isValid) {
      setFormError(saCheck.error);
      return;
    }
    const finalPrem = parseFloat(formGrossPremium || formFinalPremium);
    const netPrem = parseFloat(formNetPremium || finalPrem);
    const gpCheck = validatePositiveDecimal(formGrossPremium || formFinalPremium, "Gross Premium", true);
    if (!gpCheck.isValid) {
      setFormError(gpCheck.error);
      return;
    }
    if (finalPrem < netPrem) {
      setFormError("Gross Premium (Including GST) cannot be less than Net Premium (Without GST).");
      return;
    }

    if (formStartDate && formExpiryDate) {
      const dateOrderCheck = validateDateOrder(formStartDate, formExpiryDate, "Policy Start Date", "Policy Expiry Date");
      if (!dateOrderCheck.isValid) {
        setFormError(dateOrderCheck.error);
        return;
      }
    }

    if (formPolicyType === "MOTOR" && formVehicleRegNo?.trim()) {
      const vehCheck = validateVehicleRegistration(formVehicleRegNo.trim(), false);
      if (!vehCheck.isValid) {
        setFormError(vehCheck.error);
        return;
      }
    }

    if (formContactMobile?.trim()) {
      const cmCheck = validateIndianMobile(formContactMobile.trim(), "Contact Mobile", false);
      if (!cmCheck.isValid) {
        setFormError(cmCheck.error);
        return;
      }
    }
    if (formContactEmail?.trim()) {
      const ceCheck = validateEmail(formContactEmail.trim(), "Contact Email", false);
      if (!ceCheck.isValid) {
        setFormError(ceCheck.error);
        return;
      }
    }
    if (formContactPincode?.trim()) {
      const cpCheck = validatePinCode(formContactPincode.trim(), "Contact PIN Code", false);
      if (!cpCheck.isValid) {
        setFormError(cpCheck.error);
        return;
      }
    }

    // Nominees validation (only validate entered nominee details)
    const activeNominees = formNominees.filter((n) => n.full_name && n.full_name.trim());
    for (const nom of activeNominees) {
      if (nom.mobile_number?.trim()) {
        const nomMobCheck = validateIndianMobile(nom.mobile_number.trim(), `Nominee '${nom.full_name.trim()}' Mobile`, false);
        if (!nomMobCheck.isValid) {
          setFormError(nomMobCheck.error);
          return;
        }
      }
      if (nom.date_of_birth) {
        const nomDobCheck = validateDobNotFuture(nom.date_of_birth, `Nominee '${nom.full_name.trim()}' Date of Birth`);
        if (!nomDobCheck.isValid) {
          setFormError(nomDobCheck.error);
          return;
        }
      }
    }

    // Member validation (Phases 1-4, Phase 6: Family Floater >= 2)
    if (formCoverageType === "FAMILY_FLOATER" && formPolicyType === "LIFE") {
      setFormError("Family Floater coverage is not supported for Life Insurance policies.");
      return;
    }
    const validMembers = formInsuredMembers.filter((m) => m.full_name && m.full_name.trim());
    if (validMembers.length === 0) {
      setFormError("At least one Insured Member / Covered Person must be provided.");
      return;
    }
    if (formCoverageType === "FAMILY_FLOATER" && validMembers.length < 2) {
      setFormError("Family Floater coverage requires at least 2 insured family members. Please add all covered family members before proceeding.");
      return;
    }
    const memberNames = new Set();
    for (const m of validMembers) {
      const lower = m.full_name.trim().toLowerCase();
      if (memberNames.has(lower)) {
        setFormError(`Duplicate insured member name '${m.full_name.trim()}' is not permitted.`);
        return;
      }
      memberNames.add(lower);
      if (formCoverageType === "INDIVIDUAL" && validMembers.length > 1) {
        const mSi = parseFloat(m.individual_sum_insured);
        if (!mSi || mSi <= 0) {
          setFormError(`Individual Sum Insured must be greater than zero for member '${m.full_name.trim()}'.`);
          return;
        }
      }
      if (m.mobile_number?.trim()) {
        const memMobCheck = validateIndianMobile(m.mobile_number.trim(), `Member '${m.full_name.trim()}' Mobile`, false);
        if (!memMobCheck.isValid) {
          setFormError(memMobCheck.error);
          return;
        }
      }
      if (m.email?.trim()) {
        const memEmailCheck = validateEmail(m.email.trim(), `Member '${m.full_name.trim()}' Email`, false);
        if (!memEmailCheck.isValid) {
          setFormError(memEmailCheck.error);
          return;
        }
      }
      if (m.date_of_birth) {
        const memDobCheck = validateDobNotFuture(m.date_of_birth, `Member '${m.full_name.trim()}' Date of Birth`);
        if (!memDobCheck.isValid) {
          setFormError(memDobCheck.error);
          return;
        }
      }
    }

    // Validate Policy History for Portability & Renewal
    if (formBusinessType === "PORT") {
      const seq1 = formPolicyHistory[0];
      if (!seq1?.insurance_company_name?.trim()) {
        setFormError("Previous Insurance Company Name is mandatory for Portability policy.");
        return;
      }
      if (!seq1?.previous_policy_number?.trim()) {
        setFormError("Previous Policy Number is mandatory for Portability policy.");
        return;
      }
    } else if (formBusinessType === "RENEW") {
      const seq1 = formPolicyHistory[0];
      if (!seq1?.previous_policy_number?.trim()) {
        setFormError("Expiring / Previous Policy Number is mandatory for Renewal policy.");
        return;
      }
    }

    // Validate nominees share total
    if (activeNominees.length > 0) {
      const sumShare = activeNominees.reduce((acc, curr) => acc + (parseFloat(curr.share_percentage) || 0), 0);
      if (Math.abs(sumShare - 100) > 0.01) {
        setFormError(`Nominee share percentages must total 100% (currently ${sumShare}%).`);
        return;
      }
    }

    setFormSubmitting(true);
    setFormError("");

    const calculatedTax = Math.max(0, finalPrem - netPrem);
    const commAmt = formCommissionAmount ? parseFloat(formCommissionAmount) : (netPrem * (parseFloat(formCommissionRate) || 15.0) / 100);
    const tdsAmt = formTdsAmount ? parseFloat(formTdsAmount) : (commAmt * ((parseFloat(formTdsRate) || 10.0) / 100));
    const netPayable = formNetCommissionPayable ? parseFloat(formNetCommissionPayable) : (commAmt - tdsAmt);

    const payload = {
      policy_type: formPolicyType,
      coverage_type: formCoverageType,
      members: validMembers.map((m) => ({
        customer_id: m.customer_id || null,
        full_name: m.full_name.trim(),
        relationship: m.relationship.trim(),
        date_of_birth: m.date_of_birth || null,
        gender: m.gender || null,
        mobile_number: m.mobile_number?.trim() || null,
        email: m.email?.trim() || null,
        address: m.address?.trim() || null,
        member_code: m.member_code?.trim() || null,
        individual_sum_insured:
          formCoverageType === "INDIVIDUAL"
            ? parseFloat(m.individual_sum_insured) || parseFloat(formSumAssured)
            : null,
        notes: m.notes?.trim() || null,
      })),
      customer_id: formCustomerId,
      company_id: formCompanyId,
      plan_id: formPlanId,
      selected_rider_ids: formSelectedRiderIds && formSelectedRiderIds.length > 0 ? formSelectedRiderIds : [],
      purchase_party_id: formPurchasePartyId || null,
      sub_agent_id: formSubAgentId || null,
      policy_number: formPolicyNumber.trim(),
      proposal_number: formProposalNumber.trim() || null,
      business_type: formBusinessType || "NEW",
      previous_policy_number: formBusinessType !== "NEW" ? (formPolicyHistory[0]?.previous_policy_number?.trim() || formPrevPolicyNumber.trim() || null) : null,
      previous_insurer: formBusinessType === "PORT" ? (formPolicyHistory[0]?.insurance_company_name?.trim() || formPrevInsurer.trim() || null) : null,
      portability_continuity_details: formBusinessType === "PORT" ? (formPolicyHistory[0]?.continuity_details?.trim() || formPortabilityContinuity.trim() || null) : null,
      product_variant: formProductVariant.trim() || (formPolicyType === "LIFE" ? formLifeVariant : null),
      hospital_cash_benefit: formPolicyType === "HEALTH" ? formHospitalCashBenefit : "NOT_APPLICABLE",
      vehicle_registration_number: formPolicyType === "MOTOR" ? (formVehicleRegNo.trim() || null) : null,
      vehicle_manufacturer: formPolicyType === "MOTOR" ? (formVehicleManufacturer.trim() || null) : null,
      vehicle_model: formPolicyType === "MOTOR" ? (formVehicleModel.trim() || null) : null,
      vehicle_type: formPolicyType === "MOTOR" ? formVehicleType : null,
      travel_destination: formPolicyType === "TRAVEL" ? (formTravelDestination.trim() || null) : null,
      travel_type: formPolicyType === "TRAVEL" ? formTravelType : null,
      intermediary_name: formIntermediaryName.trim() || null,
      contact_city: formContactCity.trim() || null,
      contact_pincode: formContactPincode.trim() || null,
      contact_mobile: formContactMobile.trim() || null,
      contact_email: formContactEmail.trim() || null,
      policy_term_years: parseInt(formPolicyTermYears, 10) || 1,
      sum_assured: parseFloat(formSumAssured),
      net_premium: netPrem,
      gross_premium: finalPrem,
      final_premium: finalPrem,
      tax_amount: calculatedTax,
      is_single_premium: formIsSinglePremium,
      premium_mode: formPremiumMode,
      start_date: formStartDate,
      first_receipt_date: formFirstReceiptDate || null,
      expiry_date: formExpiryDate || null,
      notes: formPolicyNotes.trim() || null,
      nominees: activeNominees.map((n) => ({
        full_name: n.full_name.trim(),
        relationship: n.relationship.trim(),
        date_of_birth: n.date_of_birth || null,
        mobile_number: n.mobile_number?.trim() || null,
        address: n.address?.trim() || null,
        share_percentage: parseFloat(n.share_percentage) || 100,
      })),
      policy_years: [],
      policy_history: formBusinessType === "NEW" ? [] : formPolicyHistory.filter(h => (h.insurance_company_name && h.insurance_company_name.trim()) || (h.previous_policy_number && h.previous_policy_number.trim())).map((h, idx) => ({
        history_sequence: h.history_sequence || (idx + 1),
        previous_policy_id: h.previous_policy_id || null,
        insurance_company_name: h.insurance_company_name?.trim() || null,
        previous_policy_number: h.previous_policy_number?.trim() || null,
        policy_business_type: formBusinessType,
        policy_start_date: h.policy_start_date || null,
        policy_expiry_date: h.policy_expiry_date || null,
        sum_insured: h.sum_insured ? parseFloat(h.sum_insured) : null,
        net_premium: h.net_premium ? parseFloat(h.net_premium) : null,
        gross_premium: h.gross_premium ? parseFloat(h.gross_premium) : null,
        product_variant: h.product_variant?.trim() || null,
        policy_status: h.policy_status || "ACTIVE",
        claim_history: h.claim_history || "NO_CLAIM",
        insurer_contact: h.insurer_contact?.trim() || null,
        cumulative_bonus: h.cumulative_bonus?.trim() || null,
        continuity_details: h.continuity_details?.trim() || null,
        waiting_period_waiver_details: h.waiting_period_waiver_details?.trim() || null,
        remarks: h.remarks?.trim() || null,
        is_external_policy: h.is_external_policy !== undefined ? h.is_external_policy : true,
      })),
      commission_rate: parseFloat(formCommissionRate) || 15.0,
      commission_amount: commAmt,
      tds_rate: parseFloat(formTdsRate) || 10.0,
      tds_amount: tdsAmt,
      net_commission_payable: netPayable,
      commission_override_reason: isCommissionManualOverride ? formCommissionOverrideReason : null,
      first_year_commission_amount: commAmt,
      sub_agent_commission_share: formSubAgentId && formSubAgentShare ? parseFloat(formSubAgentShare) : null,
      commission_received_status: "PENDING",
      actual_commission_received_amount: null,
      commission_received_date: null,
      commission_bank_reference: null,
      initial_payment: formRecordInitialPayment
        ? {
            payment_mode: formPaymentMode,
            bank_name: formBankName.trim() || null,
            transaction_reference: formTransactionRef.trim() || null,
            amount: parseFloat(formPaymentAmount || finalPrem),
            payment_date: formPaymentDate || formStartDate,
            notes: formPaymentNotes.trim() || null,
          }
        : null,
    };

    const res = await api.insurance.createPolicy(payload);

    if (res.ok) {
      const createdPolicy = res.data;
      let uploadedCount = 0;
      let failedDocs = [];

      // Phase 5: Upload initial payment proof if selected
      if (paymentProofFile) {
        try {
          const pFd = new FormData();
          pFd.append("file", paymentProofFile);
          pFd.append("document_type", "PREMIUM_RECEIPT");
          pFd.append("title", "First Installment Payment Proof");
          pFd.append("description", `Payment proof for transaction ref: ${formTransactionRef || "N/A"}`);
          const pUpRes = await api.insurance.uploadPolicyDocument(createdPolicy.id, pFd);
          if (pUpRes.ok) {
            uploadedCount++;
          } else {
            failedDocs.push(`Payment Proof (${pUpRes.error || "Upload failed"})`);
          }
        } catch (pErr) {
          failedDocs.push(`Payment Proof (${pErr.message || "Upload error"})`);
        }
      }

      // Phase 1: Clear policy draft upon successful creation
      clearDraft();

      if (formStagedDocs.length > 0) {
        for (const sDoc of formStagedDocs) {
          try {
            const fd = new FormData();
            fd.append("file", sDoc.file);
            fd.append("document_type", sDoc.document_type);
            fd.append("title", sDoc.title);
            if (sDoc.description) fd.append("description", sDoc.description);
            const uploadRes = await api.insurance.uploadPolicyDocument(createdPolicy.id, fd);
            if (uploadRes.ok) {
              uploadedCount++;
            } else {
              failedDocs.push(`${sDoc.title} (${uploadRes.error || "Upload failed"})`);
            }
          } catch (e) {
            failedDocs.push(`${sDoc.title} (${e.message || "Upload error"})`);
          }
        }
      }

      setFormSubmitting(false);

      if (failedDocs.length > 0) {
        setActionSuccess(`Policy '${createdPolicy.policy_number}' issued successfully. ${uploadedCount} document(s) attached. Warning: ${failedDocs.length} attachment(s) failed: ${failedDocs.join(", ")}`);
      } else if (uploadedCount > 0) {
        setActionSuccess(`Policy '${createdPolicy.policy_number}' issued successfully with ${uploadedCount} attached document(s).`);
      } else {
        setActionSuccess(`Policy '${createdPolicy.policy_number}' issued successfully with installment schedules.`);
      }

      // Reset form
      handleResetForm();
      setActiveTab("policies");
      fetchPolicies();
      setTimeout(() => setActionSuccess(""), 5000);
    } else {
      setFormSubmitting(false);
      setFormError(formatErrorMsg(res.error) || "Failed to register policy.");
    }
  };

  const handleResetForm = () => {
    if (typeof discardDraft === "function") discardDraft();
    setFormCustomerId("");
    setCustomerSearchTerm("");
    setCustomerSnapshot(null);
    setFormCompanyId("");
    setFormPlanId("");
    setFormSelectedRiderIds([]);
    setAvailablePlanRiders([]);
    setAvailablePlanBenefits([]);
    setFormPolicyNumber("");
    setFormProposalNumber("");
    setFormBusinessType("NEW");
    setFormPrevPolicyNumber("");
    setFormPrevInsurer("");
    setFormPortabilityContinuity("");
    setFormProductVariant("");
    setFormPolicyHistory([createDefaultPolicyHistoryEntry(1, "PORT")]);
    setFormHospitalCashBenefit("NOT_APPLICABLE");
    setFormVehicleRegNo("");
    setFormVehicleManufacturer("");
    setFormVehicleModel("");
    setFormVehicleType("Private Car");
    setFormTravelDestination("");
    setFormTravelType("International Travel");
    setFormLifeVariant("Term Insurance");
    setFormLifePPT("10");
    setFormContactMobile("");
    setFormContactEmail("");
    setFormContactCity("");
    setFormContactPincode("");
    setFormIntermediaryName("");
    setFormCommissionReceivedStatus("PENDING");
    setFormActualCommissionReceived("");
    setFormCommissionReceivedDate("");
    setFormCommissionBankRef("");
    setFormSumAssured("1000000");
    setSumAssuredPreset("1000000");
    setFormNetPremium("");
    setFormGrossPremium("");
    setFormFinalPremium("");
    setIsGstEnabled(false);
    setIsGrossManualOverride(false);
    setFormPolicyTermYears("1");
    setFormPaymentAmount("");
    setIsPaymentAmountManual(false);
    setPaymentProofFile(null);
    setFormPolicyYears([]);
    setCustomerSnapshot(null);
    setFormCommissionRate("15.0");
    setFormCommissionAmount("");
    setFormTdsRate("10.0");
    setFormTdsAmount("");
    setFormNetCommissionPayable("");
    setIsCommissionManualOverride(false);
    setFormCommissionOverrideReason("");
    setFormSubAgentShare("");
    setFormTransactionRef("");
    setFormBankName("");
    setFormPolicyNotes("");
    setFormPaymentNotes("");
    setFormCoverageType("INDIVIDUAL");
    setFormInsuredMembers([
      {
        customer_id: "",
        full_name: "",
        relationship: "Self",
        date_of_birth: "",
        gender: "MALE",
        mobile_number: "",
        email: "",
        address: "",
        member_code: "",
        individual_sum_insured: "1000000",
        notes: "",
      },
    ]);
    setDetectedFamilyGroup(null);
    setFamilyGroupModalOpen(false);
    setFormNominees([
      { full_name: "", relationship: "Spouse", date_of_birth: "", mobile_number: "", address: "", share_percentage: "100" },
    ]);
    setFormStagedDocs([]);
    setStagedDocFile(null);
    setStagedDocTitle("");
    setStagedDocDesc("");
    setStagedDocError("");
    if (stagedFileInputRef.current) stagedFileInputRef.current.value = "";
  };

  // Fetch Policy Audit History
  const fetchPolicyAuditLogs = async (policyId) => {
    if (!policyId) return;
    setPolicyAuditLoading(true);
    const res = await api.insurance.getPolicyAuditHistory(policyId);
    if (res.ok) {
      setPolicyAuditLogs(res.data || []);
    } else {
      setPolicyAuditLogs([]);
    }
    setPolicyAuditLoading(false);
  };

  // Multi-Year Policy Renewal Lifecycle fetcher
  const fetchPolicyRenewalLifecycle = async (policyId) => {
    setLifecycleLoading(true);
    try {
      const res = await api.insurance.getPolicyRenewalLifecycle(policyId);
      if (res.ok && Array.isArray(res.data)) {
        setPolicyLifecycleTimeline(res.data);
      } else {
        setPolicyLifecycleTimeline([]);
      }
    } catch (err) {
      console.error("Lifecycle fetch error:", err);
      setPolicyLifecycleTimeline([]);
    } finally {
      setLifecycleLoading(false);
    }
  };

  // Open Policy Detail Drawer
  const openPolicyDetail = async (pol, initialTab = "overview") => {
    setPolicyDetailLoading(true);
    setSelectedPolicy(pol);
    setDrawerActiveTab(initialTab);
    fetchPolicyAuditLogs(pol.id);
    fetchDrawerDocuments(pol.id);
    fetchPolicyRenewalLifecycle(pol.id);
    const res = await api.insurance.getPolicy(pol.id);
    if (res.ok) {
      setSelectedPolicy(res.data);
    }
    setPolicyDetailLoading(false);
  };

  // Open Edit Modal
  const openEditModal = (pol) => {
    setEditingPolicy(pol);
    setEditPolicyNumber(pol.policy_number || "");
    setEditPolicyType(pol.policy_type || "LIFE");
    setEditStatus(pol.status || "ACTIVE");
    setEditSumAssured(pol.sum_assured || "");
    setEditFinalPremium(pol.final_premium || "");
    setEditPremiumMode(pol.premium_mode || "YEARLY");
    setEditTermYears(pol.term_years || "10");
    setEditStartDate(pol.policy_start_date || pol.start_date || "");
    setEditExpiryDate(pol.expiry_date || "");
    setEditNotes(pol.notes || "");
    setEditError("");

    const initialRiderIds =
      pol.selected_rider_ids ||
      (Array.isArray(pol.selected_riders)
        ? pol.selected_riders.map((r) => r.rider_id).filter(Boolean)
        : []);
    setEditSelectedRiderIds(initialRiderIds);
    setEditAvailablePlanRiders([]);

    if (pol.plan_id) {
      api.insurance.getPlan(pol.plan_id).then((res) => {
        if (res.ok && res.data) {
          const pRiders =
            res.data.plan_riders ||
            (Array.isArray(res.data.riders) && typeof res.data.riders[0] === "object"
              ? res.data.riders
              : []);
          setEditAvailablePlanRiders(pRiders);
        }
      });
    }
  };

  const handleUpdatePolicy = async (e) => {
    e.preventDefault();
    if (!editingPolicy) return;
    setEditSubmitting(true);
    setEditError("");

    const payload = {
      policy_number: editPolicyNumber.trim(),
      policy_type: editPolicyType,
      status: editStatus,
      sum_assured: parseFloat(editSumAssured),
      final_premium: parseFloat(editFinalPremium),
      premium_mode: editPremiumMode,
      term_years: parseInt(editTermYears, 10),
      policy_start_date: editStartDate,
      expiry_date: editExpiryDate,
      notes: editNotes.trim(),
      selected_rider_ids: editSelectedRiderIds,
    };

    const res = await api.insurance.updatePolicy(editingPolicy.id, payload);
    setEditSubmitting(false);

    if (res.ok) {
      setActionSuccess(`Policy '${editPolicyNumber}' updated successfully.`);
      setEditingPolicy(null);
      fetchPolicies();
      if (selectedPolicy?.id === editingPolicy.id) {
        setSelectedPolicy(res.data);
      }
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setEditError(res.error || "Failed to update policy contract.");
    }
  };

  // Renewal Modal Handlers (Phase 2 Enhanced Start/End Control & Validation)
  const openRenewalModal = (pol) => {
    setRenewingPolicy(pol);
    const nextStart = getNextStartDate(pol.expiry_date);
    const initialTerm = 1;
    const calculatedEnd = calculateRenewalEndDate(nextStart, initialTerm);

    const baseNum = (pol.policy_number || "POL").replace(/-R\d+$/, "");
    const rCount = (pol.renewals_count || 0) + 1;
    setRenewPolicyNumber(`${baseNum}-R${rCount}`);
    setRenewStartDate(nextStart);
    setRenewEndDate(calculatedEnd);
    setRenewTermYears(initialTerm);
    setIsManualEndDateOverride(false);
    setShowRenewalConfirmation(false);
    setRenewPremium(pol.final_premium || pol.gross_premium || "");
    setRenewNotes("");
    setRenewError("");
  };

  const handleRenewTermChange = (newTerm) => {
    const termNum = parseInt(newTerm, 10) || 1;
    setRenewTermYears(termNum);
    if (!isManualEndDateOverride) {
      setRenewEndDate(calculateRenewalEndDate(renewStartDate, termNum));
    }
  };

  const handleRenewStartDateChange = (newStart) => {
    setRenewStartDate(newStart);
    if (!isManualEndDateOverride) {
      setRenewEndDate(calculateRenewalEndDate(newStart, renewTermYears));
    }
  };

  const handleRenewEndDateChange = (newEnd) => {
    setRenewEndDate(newEnd);
    setIsManualEndDateOverride(true);
  };

  const handleResetCalculatedEndDate = () => {
    setRenewEndDate(calculateRenewalEndDate(renewStartDate, renewTermYears));
    setIsManualEndDateOverride(false);
  };

  const handlePreExecuteRenewal = (e) => {
    e.preventDefault();
    setRenewError("");
    if (!renewStartDate) {
      setRenewError("Please specify a valid policy start date.");
      return;
    }
    if (!renewEndDate) {
      setRenewError("Please specify a valid policy end date.");
      return;
    }
    if (renewEndDate <= renewStartDate) {
      setRenewError("New Policy End Date must be strictly after the Start Date.");
      return;
    }
    setShowRenewalConfirmation(true);
  };

  const handleExecuteRenewal = async () => {
    if (!renewingPolicy) return;
    setRenewLoading(true);
    setRenewError("");

    const payload = {
      new_policy_number: renewPolicyNumber.trim() || undefined,
      new_start_date: renewStartDate,
      new_expiry_date: renewEndDate,
      renew_term_years: parseInt(renewTermYears, 10) || 1,
      new_premium: parseFloat(renewPremium) || parseFloat(renewingPolicy.final_premium),
      notes: renewNotes.trim() || null,
    };

    const res = await api.insurance.renewPolicy(renewingPolicy.id, payload);
    setRenewLoading(false);

    if (res.ok) {
      showSuccess(`Policy '${renewingPolicy.policy_number}' renewed successfully! New Contract: ${res.data.new_policy_number || renewPolicyNumber} active through ${res.data.new_expiry_date}.`);
      setRenewingPolicy(null);
      setShowRenewalConfirmation(false);
      fetchPolicies();
      fetchRenewals();
      fetchSchedules();
      if (selectedPolicy?.id === renewingPolicy.id) {
        openPolicyDetail(renewingPolicy);
      }
    } else {
      setRenewError(res.error || "Failed to renew policy contract.");
      setShowRenewalConfirmation(false);
    }
  };

  // Status Change Handlers
  const openStatusModal = (pol) => {
    setStatusModalPolicy(pol);
    setNewStatusValue(pol.status || "ACTIVE");
    setStatusChangeNotes("");
    setStatusChangeError("");
  };

  const handleExecuteStatusChange = async (e) => {
    e.preventDefault();
    if (!statusModalPolicy) return;
    setStatusChangeLoading(true);
    setStatusChangeError("");

    const res = await api.insurance.updatePolicyStatus(
      statusModalPolicy.id,
      newStatusValue,
      statusChangeNotes.trim()
    );
    setStatusChangeLoading(false);

    if (res.ok) {
      setActionSuccess(`Policy '${statusModalPolicy.policy_number}' status changed to ${newStatusValue}.`);
      setStatusModalPolicy(null);
      fetchPolicies();
      if (selectedPolicy?.id === statusModalPolicy.id) {
        setSelectedPolicy(res.data);
      }
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setStatusChangeError(res.error || "Failed to update policy status.");
    }
  };

  // Manage Members & Nominees Modal Handlers
  const openManageMembersModal = (pol) => {
    openPolicyDetail(pol, "members");
  };

  const openManageNomineesModal = (pol) => {
    setManagingNomineesPolicy(pol);
    const existing = pol.nominees || [];
    if (existing.length > 0) {
      setManageNomineesList(
        existing.map((n) => ({
          full_name: n.full_name || "",
          relationship: n.relationship || "Spouse",
          date_of_birth: n.date_of_birth || "",
          mobile_number: n.mobile_number || "",
          address: n.address || "",
          share_percentage: String(n.share_percentage || 100),
        }))
      );
    } else {
      setManageNomineesList([
        { full_name: "", relationship: "Spouse", date_of_birth: "", mobile_number: "", address: "", share_percentage: "100" },
      ]);
    }
    setManageNomineesError("");
  };

  const handleSaveManageNominees = async (e) => {
    e.preventDefault();
    if (!managingNomineesPolicy) return;

    const active = manageNomineesList.filter((n) => n.full_name && n.full_name.trim());
    if (active.length > 0) {
      const sumShare = active.reduce((acc, curr) => acc + (parseFloat(curr.share_percentage) || 0), 0);
      if (Math.abs(sumShare - 100) > 0.01) {
        setManageNomineesError(`Total share must equal 100% (currently ${sumShare}%).`);
        return;
      }
    }

    setManageNomineesLoading(true);
    setManageNomineesError("");

    const payload = active.map((n) => ({
      full_name: n.full_name.trim(),
      relationship: n.relationship.trim(),
      date_of_birth: n.date_of_birth || null,
      mobile_number: n.mobile_number?.trim() || null,
      address: n.address?.trim() || null,
      share_percentage: parseFloat(n.share_percentage) || 100,
    }));

    const res = await api.insurance.setPolicyNominees(managingNomineesPolicy.id, payload);
    setManageNomineesLoading(false);

    if (res.ok) {
      setActionSuccess("Nominees updated successfully.");
      setManagingNomineesPolicy(null);
      if (selectedPolicy?.id === managingNomineesPolicy.id) {
        openPolicyDetail(managingNomineesPolicy);
      }
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setManageNomineesError(res.error || "Failed to save nominees.");
    }
  };

  // Print Policy Certificate
  const handlePrintCertificate = (pol) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print certificate.");
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Insurance Policy Certificate - ${pol.policy_number}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; }
            .header { border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 24px; font-weight: bold; color: #1e1b4b; }
            .badge { display: inline-block; padding: 4px 12px; background: #e0e7ff; color: #3730a3; border-radius: 9999px; font-size: 12px; font-weight: bold; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
            .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px; }
            .value { font-size: 16px; font-weight: bold; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 13px; }
            th { background: #f1f5f9; font-weight: bold; color: #334155; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">FinNexus Insurance Certificate</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Policy Contract #${pol.policy_number}</div>
            </div>
            <div>
              <span class="badge">${pol.status}</span>
            </div>
          </div>
          <div class="grid">
            <div class="card">
              <div class="label">Policyholder</div>
              <div class="value">${pol.customer_name || "N/A"}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Contact: ${pol.customer_phone || "N/A"}</div>
            </div>
            <div class="card">
              <div class="label">Underwriting Carrier</div>
              <div class="value">${pol.company_name || "N/A"}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Plan: ${pol.plan_name || "N/A"}</div>
            </div>
            <div class="card">
              <div class="label">Sum Assured</div>
              <div class="value">₹${Number(pol.sum_assured || 0).toLocaleString("en-IN")}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Term: ${pol.term_years} Years</div>
            </div>
            <div class="card">
              <div class="label">Premium Installment</div>
              <div class="value">₹${Number(pol.final_premium || 0).toLocaleString("en-IN")}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Frequency: ${pol.premium_mode}</div>
            </div>
          </div>
          <div>
            <div class="label">Nominees Assigned (${pol.nominees?.length || 0})</div>
            <table>
              <thead>
                <tr>
                  <th>Nominee Name</th>
                  <th>Relationship</th>
                  <th>Date of Birth</th>
                  <th>Share %</th>
                </tr>
              </thead>
              <tbody>
                ${(pol.nominees || [])
                  .map(
                    (n) => `
                  <tr>
                    <td><strong>${n.full_name}</strong></td>
                    <td>${n.relationship}</td>
                    <td>${n.date_of_birth || "—"}</td>
                    <td><strong>${n.share_percentage}%</strong></td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
          <div class="footer">
            FinNexus Enterprise ERP &bull; Official Policy Certificate &bull; Issued on ${new Date().toLocaleDateString("en-IN")}
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Download Certificate JSON
  const handleDownloadCertificate = (pol) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pol, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `policy_certificate_${pol.policy_number}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Delete Policy
  const handleDeletePolicy = async (pol) => {
    if (!window.confirm(`Are you sure you want to delete or deactivate Policy '${pol.policy_number}'?`)) {
      return;
    }
    const res = await api.insurance.deletePolicy(pol.id);
    if (res.ok) {
      setActionSuccess(`Policy '${pol.policy_number}' deleted successfully.`);
      fetchPolicies();
      if (selectedPolicy?.id === pol.id) setSelectedPolicy(null);
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setActionError(res.error || "Cannot delete policy. Please cancel or deactivate instead.");
      setTimeout(() => setActionError(""), 5000);
    }
  };

  // Payment Modal
  const openPaymentModal = (schedule, policyId = null) => {
    setPayModalSchedule(schedule);
    setPayModalPolicyId(policyId || schedule?.policy_id || selectedPolicy?.id);
    setPayAmount(schedule ? String(schedule.amount) : "");
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayMode("ONLINE");
    setPayBank("");
    setPayRef("");
    setPayNotes("");
    setPayError("");
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const polId = payModalPolicyId || payModalSchedule?.policy_id;
    if (!polId) return;

    if (!payAmount || parseFloat(payAmount) <= 0) {
      setPayError("Valid payment amount is required.");
      return;
    }

    setPayLoading(true);
    setPayError("");

    const payload = {
      amount: parseFloat(payAmount),
      payment_mode: payMode,
      bank_name: payBank.trim() || null,
      transaction_reference: payRef.trim() || null,
      payment_date: payDate,
      premium_schedule_id: payModalSchedule?.id || null,
      notes: payNotes.trim() || null,
    };

    const res = await api.insurance.recordPayment(polId, payload);
    setPayLoading(false);

    if (res.ok) {
      setActionSuccess("Payment transaction recorded successfully.");
      setPayModalSchedule(null);
      setPayModalPolicyId(null);
      fetchSchedules();
      fetchPolicies();
      if (selectedPolicy?.id === polId) {
        openPolicyDetail(selectedPolicy);
      }
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setPayError(res.error || "Failed to record payment transaction.");
    }
  };

  // Shortcut Modals
  const handleCreateCustomerShortcut = async (e) => {
    e.preventDefault();
    if (!scCustomerName.trim() || !scCustomerPhone.trim()) return;
    setScCustomerLoading(true);
    const parts = scCustomerName.trim().split(" ");
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || "Customer";
    const res = await api.insurance.createCustomer({
      first_name: firstName,
      last_name: lastName,
      phone: scCustomerPhone.trim(),
      email: scCustomerEmail.trim() || null,
      gender: scCustomerGender,
    });
    setScCustomerLoading(false);
    if (res.ok) {
      setCustomers((prev) => [res.data, ...prev]);
      setFormCustomerId(res.data.id);
      setShortcutCustomerOpen(false);
      setScCustomerName("");
      setScCustomerPhone("");
      setScCustomerEmail("");
    } else {
      alert(res.error || "Failed to create customer shortcut.");
    }
  };

  const handleCreateCompanyShortcut = async (e) => {
    e.preventDefault();
    if (!scCompanyName.trim()) return;
    setScCompanyLoading(true);
    const code = scCompanyName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 10);
    const res = await api.insurance.createCompany({
      name: scCompanyName.trim(),
      code: `${code}-${Math.floor(100 + Math.random() * 900)}`,
      category: scCompanyCategory,
    });
    setScCompanyLoading(false);
    if (res.ok) {
      setCompanies((prev) => [res.data, ...prev]);
      setFormCompanyId(res.data.id);
      setShortcutCompanyOpen(false);
      setScCompanyName("");
    } else {
      alert(res.error || "Failed to create insurance company.");
    }
  };

  const handleCreatePlanShortcut = async (e) => {
    e.preventDefault();
    if (!scPlanName.trim() || !scPlanCompanyId) return;
    setScPlanLoading(true);
    const code = scPlanName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 10);
    const res = await api.insurance.createPlan({
      name: scPlanName.trim(),
      code: `${code}-${Math.floor(100 + Math.random() * 900)}`,
      company_id: scPlanCompanyId,
      line_of_business: scPlanType,
    });
    setScPlanLoading(false);
    if (res.ok) {
      setPlans((prev) => [res.data, ...prev]);
      setFormPlanId(res.data.id);
      setShortcutPlanOpen(false);
      setScPlanName("");
    } else {
      alert(res.error || "Failed to create plan.");
    }
  };

  // Bulk Import Handlers
  const handleDownloadTemplate = async (format = "csv") => {
    try {
      await api.insurance.downloadPolicyTemplate(format);
    } catch (e) {
      alert("Failed to download template: " + e.message);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImportFile(file);
      setPreviewData(null);
      setImportResult(null);
      handlePreviewFile(file);
    }
  };

  const handlePreviewFile = async (file) => {
    setImporting(true);
    const res = await api.insurance.previewPolicyImport(file);
    setImporting(false);
    if (res.ok) {
      setPreviewData(res.data);
    } else {
      setActionError(res.error || "Failed to preview spreadsheet.");
    }
  };

  const handleConfirmImport = async () => {
    if (!importFile) return;
    setImporting(true);
    const res = await api.insurance.confirmPolicyImport(importFile);
    setImporting(false);
    if (res.ok) {
      setImportResult(res.data);
      setActionSuccess(
        `Import completed! ${res.data.imported_count} imported, ${res.data.skipped_count} skipped, ${res.data.failed_count} failed.`
      );
      fetchPolicies();
    } else {
      setActionError(res.error || "Failed to execute bulk policy import.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-white via-indigo-50/25 to-white p-6 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500"></div>
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 mb-1">
            <div className="p-1 rounded-lg bg-indigo-100/80 text-indigo-700">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <span>Insurance Operations</span>
            <span>&bull;</span>
            <span className="text-slate-500 font-medium">Policy Registry &amp; Lifecycle Engine</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Policy Management ERP</h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative underwriting book, issue-year calendar tracking, premium schedules, and multi-tier nominee allocation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab !== "new_policy" && canMutate && (
            <button
              onClick={handleOpenNewPolicyTab}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-indigo-500/25 flex items-center gap-2 transition-all transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Issue New Policy</span>
            </button>
          )}
          <button
            onClick={() => {
              if (activeTab === "policies") fetchPolicies();
              if (activeTab === "schedules") fetchSchedules();
              if (activeTab === "renewals") fetchRenewals();
            }}
            className="p-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 transition-all shadow-2xs hover:shadow-xs active:scale-95"
            title="Refresh Table Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{formatErrorMsg(actionError)}</span>
        </div>
      )}

      {/* Navigation Tabs Bar */}
      <div className="p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 inline-flex flex-wrap items-center gap-1.5 shadow-2xs">
        <button
          onClick={() => setActiveTab("policies")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === "policies"
              ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <Layers className="w-4 h-4 text-indigo-600" />
          <span>All Policies</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === "policies"
                ? "bg-indigo-100 text-indigo-700"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {totalPolicies}
          </span>
        </button>

        {canMutate && (
          <button
            onClick={handleOpenNewPolicyTab}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "new_policy"
                ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>Issue Policy Contract</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("schedules")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === "schedules"
              ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <Calendar className="w-4 h-4 text-blue-600" />
          <span>Installment Schedules</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === "schedules"
                ? "bg-indigo-100 text-indigo-700"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {scheduleTotal}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("renewals")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === "renewals"
              ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <RotateCcw className="w-4 h-4 text-amber-600" />
          <span>Renewals &amp; Expiry</span>
        </button>

        {canMutate && (
          <button
            onClick={() => setActiveTab("import")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "import"
                ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Bulk Spreadsheet Import</span>
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ALL POLICIES LIST                                 */}
      {/* ======================================================== */}
      {activeTab === "policies" && (
        <div className="space-y-5">
          {/* Executive Financial KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* KPI Card 1: Total Policies */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Policies Issued
                </span>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
                  <Shield className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-slate-900 tracking-tight">
                  {totalPolicies}
                </span>
                <span className="text-xs font-semibold text-slate-400">contracts</span>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Active Book Portfolio</span>
                <span className="px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 text-[10px]">
                  {selectedIssueYear === "ALL" ? "All Calendar Years" : `Issued ${selectedIssueYear}`}
                </span>
              </div>
            </div>

            {/* KPI Card 2: Total Sum Insured */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden group hover:border-violet-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Sum Insured
                </span>
                <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-violet-950 tracking-tight">
                  {formatCurrency(totalSumInsured)}
                </span>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Total Risk Underwritten</span>
                <span className="px-2 py-0.5 rounded-full font-bold bg-violet-50 text-violet-700 text-[10px]">
                  Coverage Sum
                </span>
              </div>
            </div>

            {/* KPI Card 3: Total Gross Premium */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Gross Premium
                </span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-emerald-700 tracking-tight">
                  {formatCurrency(totalGrossPremium)}
                </span>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Annualized Premium Volume</span>
                <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 text-[10px]">
                  Gross Premium
                </span>
              </div>
            </div>
          </div>

          {/* Filter & Operations Hub */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            {/* Row 1: Issue-Year Segmented Control & Export Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mr-1">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  Policy Issue Year:
                </span>
                <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIssueYear("ALL");
                      setPolicyPage(1);
                    }}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      selectedIssueYear === "ALL"
                        ? "bg-indigo-600 text-white shadow-xs shadow-indigo-500/25"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white"
                    }`}
                  >
                    All Years
                  </button>
                  {availableIssueYears.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => {
                        setSelectedIssueYear(yr);
                        setPolicyPage(1);
                      }}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        selectedIssueYear === yr
                          ? "bg-indigo-600 text-white shadow-xs shadow-indigo-500/25"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white"
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await api.insurance.exportPoliciesExcel({
                        issue_year: selectedIssueYear !== "ALL" ? selectedIssueYear : undefined,
                        search: policySearch.trim() || undefined,
                        policy_type: policyTypeFilter !== "ALL" ? policyTypeFilter : undefined,
                        business_type: filterBusinessType !== "ALL" ? filterBusinessType : undefined,
                        status: policyStatusFilter !== "ALL" ? policyStatusFilter : undefined,
                      });
                      if (res.ok) {
                        showSuccess("Filtered policy register exported to Excel.");
                      } else {
                        showError(res.error || "Failed to export policies.");
                      }
                    } catch (err) {
                      showError("Failed to export policies.");
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 flex items-center gap-2 transition-all shadow-2xs hover:shadow-xs active:scale-95"
                  title="Export policies matching current view and filters to genuine XLSX"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Export View (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await api.insurance.exportPoliciesExcel({
                        issue_year: "ALL",
                      });
                      if (res.ok) {
                        showSuccess("Complete multi-year policy register exported.");
                      } else {
                        showError(res.error || "Failed to export policies.");
                      }
                    } catch (err) {
                      showError("Failed to export multi-year register.");
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all shadow-2xs hover:shadow-xs active:scale-95"
                  title="Export complete multi-year insurance register"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>Export All Years</span>
                </button>
              </div>
            </div>

            {/* Row 2: Search Input & Dropdown Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
              {/* Search */}
              <div className="lg:col-span-4 relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by policy #, customer, mobile, insurer..."
                  value={policySearch}
                  onChange={(e) => {
                    setPolicySearch(e.target.value);
                    setPolicyPage(1);
                  }}
                  className="w-full pl-10 pr-9 py-2.5 text-xs rounded-xl border border-slate-200/90 bg-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                />
                {policySearch && (
                  <button
                    onClick={() => {
                      setPolicySearch("");
                      setPolicyPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status */}
              <div className="lg:col-span-2">
                <select
                  value={policyStatusFilter}
                  onChange={(e) => {
                    setPolicyStatusFilter(e.target.value);
                    setPolicyPage(1);
                  }}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200/90 bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="LAPSED">Lapsed</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Category */}
              <div className="lg:col-span-2">
                <select
                  value={policyTypeFilter}
                  onChange={(e) => {
                    setPolicyTypeFilter(e.target.value);
                    setPolicyPage(1);
                  }}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200/90 bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="ALL">All Categories</option>
                  {INSURANCE_CATEGORIES.map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Business Type */}
              <div className="lg:col-span-2">
                <select
                  value={filterBusinessType}
                  onChange={(e) => {
                    setFilterBusinessType(e.target.value);
                    setPolicyPage(1);
                  }}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200/90 bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="ALL">All Business</option>
                  <option value="NEW">New Business</option>
                  <option value="PORT">Portability</option>
                  <option value="RENEW">Renewal</option>
                </select>
              </div>

              {/* Company & Filters Toggle */}
              <div className="lg:col-span-2 flex items-center gap-2">
                <select
                  value={filterCompanyId}
                  onChange={(e) => {
                    setFilterCompanyId(e.target.value);
                    setPolicyPage(1);
                  }}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200/90 bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">All Insurers</option>
                  {companies.map((co) => (
                    <option key={co.id} value={co.id}>
                      {co.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
                    showAdvancedFilters || filterSubAgentId || filterStartDateFrom || filterExpiryDateFrom
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-2xs"
                      : "border-slate-200 hover:bg-slate-50 text-slate-600"
                  }`}
                  title="Advanced Date and Agent Filters"
                >
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Clear Filters Bar if active */}
            {(policySearch ||
              policyTypeFilter !== "ALL" ||
              policyStatusFilter !== "ALL" ||
              filterBusinessType !== "ALL" ||
              filterCompanyId ||
              filterSubAgentId ||
              filterStartDateFrom ||
              filterExpiryDateFrom) && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium">Active filters applied to policy list</span>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All Filters</span>
                </button>
              </div>
            )}

            {/* Advanced Filters Expandable Drawer */}
            {showAdvancedFilters && (
              <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-xl">
                {/* Agent Filter */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Sourcing Sub-Agent
                  </label>
                  <select
                    value={filterSubAgentId}
                    onChange={(e) => {
                      setFilterSubAgentId(e.target.value);
                      setPolicyPage(1);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="">All Agents</option>
                    {subAgents.map((sa) => (
                      <option key={sa.id} value={sa.id}>
                        {sa.full_name || sa.name || "Agent"} ({sa.agent_code || sa.code || "POSP"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Date From */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Start Date (From)
                  </label>
                  <DatePicker
                    value={filterStartDateFrom}
                    onChange={(e) => {
                      setFilterStartDateFrom(e.target.value);
                      setPolicyPage(1);
                    }}
                    placeholder="DD-MM-YYYY"
                  />
                </div>

                {/* Expiry Date To */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Expiry Date (To)
                  </label>
                  <DatePicker
                    value={filterExpiryDateTo}
                    onChange={(e) => {
                      setFilterExpiryDateTo(e.target.value);
                      setPolicyPage(1);
                    }}
                    placeholder="DD-MM-YYYY"
                  />
                </div>

                {/* Sorting */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Sort Order
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                      <option value="created_at">Date Created</option>
                      <option value="policy_start_date">Policy Start</option>
                      <option value="expiry_date">Expiry Date</option>
                      <option value="final_premium">Premium Amount</option>
                      <option value="sum_assured">Sum Assured</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                      className="px-2 py-1.5 text-xs font-bold border border-slate-200 bg-white rounded-lg hover:bg-slate-50 uppercase"
                    >
                      {sortOrder}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section Heading & Active Context */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                {selectedIssueYear !== "ALL"
                  ? `Policies Issued in ${selectedIssueYear}`
                  : "All Policy Issues"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedIssueYear !== "ALL"
                  ? `Showing all policies originally issued between 01-01-${selectedIssueYear} and 31-12-${selectedIssueYear}.`
                  : "Showing all registered policies across all issue calendar years."}
              </p>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-900">{policies.length}</span> of{" "}
              <span className="font-bold text-slate-900">{totalPolicies}</span> policy contracts
            </div>
          </div>

          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50/90 text-[11px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Policy #</th>
                  <th className="py-3.5 px-4">Issue Date</th>
                  <th className="py-3.5 px-4">Policyholder</th>
                  <th className="py-3.5 px-4">Insurer &amp; Plan</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Sum Insured</th>
                  <th className="py-3.5 px-4">Premium &amp; Mode</th>
                  <th className="py-3.5 px-4">Policy Start Date</th>
                  <th className="py-3.5 px-4">Policy End Date</th>
                  <th className="py-3.5 px-4">Nominees</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {policiesLoading ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                        <span className="font-semibold text-xs text-slate-600">Loading policy contracts from database...</span>
                      </div>
                    </td>
                  </tr>
                ) : policies.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Shield className="w-8 h-8 text-slate-300" />
                        <span className="font-bold text-sm text-slate-700">No policies match the selected query criteria</span>
                        <span className="text-xs text-slate-400">Try adjusting your issue year or filters above.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const renderRow = (p) => (
                      <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <span className="font-bold text-slate-900 text-xs tracking-tight">{p.policy_number}</span>
                            {p.issue_year && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200/90 uppercase tracking-wider shadow-2xs">
                                ISSUED {p.issue_year}
                              </span>
                            )}
                            {p.proposal_number && (
                              <span className="text-[10px] text-slate-400 font-sans font-medium">
                                Prop: {p.proposal_number}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/70 font-mono text-xs font-semibold text-slate-800">
                            <Calendar className="w-3 h-3 text-indigo-500" />
                            <span>{formatDateDDMMYYYY(p.issue_date || p.first_receipt_date || p.created_at)}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-2xs uppercase">
                              {(p.customer_name || "C").split(" ").map((w) => w[0]).join("").slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs truncate max-w-[140px]">{p.customer_name || "Unknown"}</div>
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                <span>{p.customer_phone || "No phone"}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate max-w-[160px]">{p.company_name}</div>
                            <div className="text-[11px] font-medium text-indigo-600 truncate max-w-[160px] mt-0.5">{p.plan_name}</div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex items-center gap-1">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.policy_type === "HEALTH"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : p.policy_type === "LIFE"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : p.policy_type === "MOTOR"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}
                              >
                                {p.policy_type}
                              </span>
                              {p.business_type === "PORT" ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                                  PORT
                                </span>
                              ) : p.business_type === "RENEW" ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  RENEW
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                  NEW
                                </span>
                              )}
                            </div>
                            {p.coverage_type === "FAMILY_FLOATER" ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Floater ({p.members_count || p.members?.length || 1})
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                                Individual ({p.members_count || p.members?.length || 1})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-black text-slate-900 whitespace-nowrap font-mono text-xs">
                          ₹{Number(p.sum_assured || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-black text-emerald-700 font-mono text-xs">
                            ₹{Number(p.final_premium || 0).toLocaleString("en-IN")}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium mt-0.5">
                            <span>{p.premium_mode}</span>
                            {p.commission_received_status === "RECEIVED" ? (
                              <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Comm Recv
                              </span>
                            ) : p.commission_received_status === "NOT_RECEIVED" ? (
                              <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Comm Due
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700 font-medium whitespace-nowrap">
                          {formatDateDDMMYYYY(p.policy_start_date)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700 font-medium whitespace-nowrap">
                          {formatDateDDMMYYYY(p.expiry_date || p.policy_end_date)}
                        </td>
                        <td className="py-3.5 px-4">
                          {p.nominees && p.nominees.length > 0 ? (
                            <button
                              onClick={() => openPolicyDetail(p)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/90 hover:bg-indigo-100 transition-colors shadow-2xs"
                              title="View Nominee Allocations"
                            >
                              <Users className="w-3 h-3 text-indigo-600" />
                              <span>{p.nominees.length} {p.nominees.length === 1 ? "Nominee" : "Nominees"}</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 font-bold font-mono text-xs pl-2">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide shadow-2xs ${
                              p.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 ring-2 ring-emerald-500/10"
                                : p.status === "LAPSED"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : p.status === "CANCELLED"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                p.status === "ACTIVE"
                                  ? "bg-emerald-500 animate-pulse"
                                  : p.status === "LAPSED"
                                  ? "bg-amber-500"
                                  : p.status === "CANCELLED"
                                  ? "bg-rose-500"
                                  : "bg-slate-400"
                              }`}
                            ></span>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openPolicyDetail(p)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 text-slate-600 hover:text-indigo-600 transition-all shadow-2xs"
                              title="View Policy 360"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openPolicyDetail(p, "documents")}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-slate-600 hover:text-blue-600 transition-all shadow-2xs"
                              title="Policy Documents"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openPolicyDetail(p, "audit")}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-200 text-slate-600 hover:text-purple-600 transition-all shadow-2xs"
                              title="Audit History"
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                            {canMutate && (
                              <button
                                onClick={() => openRenewalModal(p)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-amber-50 hover:border-amber-200 text-slate-600 hover:text-amber-600 transition-all shadow-2xs"
                                title="Renew Policy Contract"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canMutate && (
                              <button
                                onClick={() => openEditModal(p)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-200 text-slate-600 hover:text-emerald-600 transition-all shadow-2xs"
                                title="Edit Policy"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canMutate && (
                              <button
                                onClick={() => handleDeletePolicy(p)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 transition-all shadow-2xs"
                                title="Delete Policy"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );

                    if (selectedIssueYear !== "ALL") {
                      return policies.map((p) => renderRow(p));
                    }

                    // Group by issue year for All Years view
                    const yearGroups = {};
                    policies.forEach((p) => {
                      const yr = p.issue_year || (p.issue_date ? new Date(p.issue_date).getFullYear() : null) || "Other";
                      if (!yearGroups[yr]) yearGroups[yr] = [];
                      yearGroups[yr].push(p);
                    });
                    const sortedGroupYears = Object.keys(yearGroups).sort((a, b) => Number(b) - Number(a));

                    return sortedGroupYears.map((yr) => (
                      <React.Fragment key={yr}>
                        <tr className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-y border-slate-800 text-white">
                          <td colSpan={12} className="py-2.5 px-5 font-bold text-xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-400" />
                                <span className="uppercase tracking-wider font-extrabold text-white text-xs">
                                  Policies Issued in {yr}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 backdrop-blur-xs">
                                  {yearGroups[yr].length} {yearGroups[yr].length === 1 ? "Record" : "Records"}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs font-mono text-indigo-200">
                                <span>
                                  Sum Insured: <strong className="text-white font-mono">₹{yearGroups[yr].reduce((acc, p) => acc + Number(p.sum_assured || 0), 0).toLocaleString("en-IN")}</strong>
                                </span>
                                <span>
                                  Gross Premium: <strong className="text-emerald-400 font-mono">₹{yearGroups[yr].reduce((acc, p) => acc + Number(p.final_premium || 0), 0).toLocaleString("en-IN")}</strong>
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {yearGroups[yr].map((p) => renderRow(p))}
                      </React.Fragment>
                    ));
                  })()
                )}
              </tbody>
            </table>
          </div>

          {/* Phase 4: Mobile-Responsive Policy Cards (< 768px) */}
          <div className="md:hidden space-y-3">
            {policiesLoading ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                <span className="text-xs font-semibold">Loading policy contracts...</span>
              </div>
            ) : policies.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
                <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No policy contracts found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your issue year or search criteria.</p>
              </div>
            ) : (
              policies.map((p) => (
                <MobilePolicyCard
                  key={p.id}
                  policy={p}
                  onViewDetails={openPolicyDetail}
                  onEdit={openEditModal}
                  onRenew={openRenewalModal}
                  onAddPayment={(pol) => openPaymentModal(null, pol.id)}
                  onOpenNominees={openManageNomineesModal}
                  onOpenMembers={openManageMembersModal}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  calculateDaysRemaining={calculateDaysRemaining}
                />
              ))
            )}
          </div>

          {/* Phase 3: Numbered Pagination */}
          <NumberedPagination
            currentPage={policyPage}
            totalPages={policyPages}
            totalItems={totalPolicies}
            pageSize={10}
            onPageChange={(newPage) => setPolicyPage(newPage)}
            isLoading={policiesLoading}
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: ISSUE POLICY CONTRACT FORM                        */}
      {/* ======================================================== */}
      {activeTab === "new_policy" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Issue New Insurance Policy Contract</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete policy underwriting, assign multiple beneficiaries/nominees, and record first receipt.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Clear out all fields in the Issue Policy form, including the selected plan, company, and draft?")) {
                    handleResetForm();
                    if (typeof showInfo === "function") showInfo("Issue policy form and plan cleared.");
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors"
                title="Clear all fields, selected plan, and active draft"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                <span>Clear Form & Plan</span>
              </button>
              <button
                type="button"
                onClick={handleMinimizeForm}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors"
                title="Minimize form into persistent draft panel"
              >
                <Minus className="w-3.5 h-3.5" />
                <span>Minimize Form</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("policies")}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Back to List
              </button>
            </div>
          </div>

          {/* Persistent Draft Resume Banner */}
          {hasDraft && !draftLoaded && !draftDismissed && (
            <div className="p-4 bg-indigo-50/90 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Unfinished Policy Draft Available
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    A draft for <strong className="text-indigo-900">{draft.customerSnapshot?.fullName || draft.formData?.customerName || "a client"}</strong> was saved on {new Date(draft.savedAt).toLocaleString()}. Would you like to resume your session?
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleStartNewDraft}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/80 rounded-xl transition-colors"
                >
                  Start Fresh
                </button>
                <button
                  type="button"
                  onClick={handleResumeDraft}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs"
                >
                  Resume Existing Draft
                </button>
              </div>
            </div>
          )}

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formatErrorMsg(formError)}</span>
            </div>
          )}

          <form onSubmit={handleSavePolicy} className="space-y-6">
            {/* Section 1: Entity Mapping */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                <span>1. Policy Mapping &amp; Stakeholders</span>
              </h3>

              {/* Policy Coverage Type Selector */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Policy Coverage Type</span>
                    <span className="text-rose-500">*</span>
                    {formPolicyType === "LIFE" && (
                      <span className="text-[10px] text-amber-700 bg-amber-100 font-bold px-1.5 py-0.2 rounded">
                        Individual Only (Life plans do not support Family Floater)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select Individual coverage (independent Sum Insured per member) or Family Floater (single shared pool across all covered persons).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormCoverageType("INDIVIDUAL")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      formCoverageType === "INDIVIDUAL"
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-2xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    disabled={formPolicyType === "LIFE"}
                    onClick={() => setFormCoverageType("FAMILY_FLOATER")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      formCoverageType === "FAMILY_FLOATER"
                        ? "bg-amber-600 border-amber-600 text-white shadow-2xs"
                        : formPolicyType === "LIFE"
                        ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                    title={formPolicyType === "LIFE" ? "Life Insurance plans do not support Family Floater" : ""}
                  >
                    Family Floater
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Policy Category */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Policy Category <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-indigo-600 font-semibold uppercase">Category Filter</span>
                  </div>
                  <select
                    value={formPolicyType}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  >
                    {INSURANCE_CATEGORIES.map((cat) => (
                      <option key={cat.code} value={cat.code}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Insurance Company with + Add shortcut */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Insurance Provider / Carrier <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setScCompanyCategory(getCategoryLabel(formPolicyType));
                        setShortcutCompanyOpen(true);
                      }}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Company</span>
                    </button>
                  </div>
                  <select
                    value={formCompanyId}
                    onChange={(e) => handleCompanyChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">
                      {referenceLoading ? "Loading providers from database..." : `Select ${getCategoryLabel(formPolicyType)} Provider`}
                    </option>
                    {filteredCompanies.length === 0 && !referenceLoading && (
                      <option value="" disabled>
                        No providers registered for {getCategoryLabel(formPolicyType)}. Click "+ Add Company" above.
                      </option>
                    )}
                    {filteredCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.code ? `(${c.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Policy Plan with + Add shortcut & Clear action */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Policy Plan <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {formPlanId && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormPlanId("");
                            if (typeof showInfo === "function") showInfo("Policy plan cleared.");
                          }}
                          className="text-[11px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-0.5 transition-colors"
                          title="Clear out selected policy plan"
                        >
                          <X className="w-3 h-3" />
                          <span>Clear Plan</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setScPlanCompanyId(formCompanyId);
                          setScPlanType(getCategoryLabel(formPolicyType));
                          setShortcutPlanOpen(true);
                        }}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Plan</span>
                      </button>
                    </div>
                  </div>
                  <select
                    value={formPlanId}
                    onChange={(e) => setFormPlanId(e.target.value)}
                    disabled={!formCompanyId}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">
                      {!formCompanyId
                        ? "Select Insurance Company first"
                        : filteredPlans.length === 0
                        ? `No ${getCategoryLabel(formPolicyType)} plans found for this carrier. Click "+ Add Plan"`
                        : "-- Select Policy Plan (Clear / None) --"}
                    </option>
                    {filteredPlans.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name} {pl.policy_type ? `[${pl.policy_type}]` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Plan Options: Riders & Base Coverage Benefits */}
              {formPlanId && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-amber-600" />
                      <span className="font-bold text-xs text-slate-800">
                        Configured Plan Options: Select Riders &amp; Review Benefits
                      </span>
                      {planRidersLoading && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      {formSelectedRiderIds.length} Rider{formSelectedRiderIds.length === 1 ? "" : "s"} Attached
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Available Riders Checkbox List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <span>Available Riders &amp; Add-on Covers</span>
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            {availablePlanRiders.length}
                          </span>
                        </label>
                        {availablePlanRiders.length > 0 && (
                          <span className="text-[10px] text-slate-400">
                            Select multiple riders
                          </span>
                        )}
                      </div>

                      {availablePlanRiders.length > 0 ? (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {availablePlanRiders.map((rider) => {
                            const isChecked = formSelectedRiderIds.some(
                              (id) => String(id) === String(rider.id)
                            );
                            return (
                              <label
                                key={rider.id}
                                className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer select-none transition-all ${
                                  isChecked
                                    ? "bg-amber-50/80 border-amber-300 ring-1 ring-amber-400/40 shadow-2xs"
                                    : "bg-white border-slate-200 hover:border-amber-200"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleRider(rider.id)}
                                  className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 shrink-0 cursor-pointer"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span
                                      className={`text-xs ${
                                        isChecked ? "text-amber-950 font-bold" : "text-slate-800 font-medium"
                                      }`}
                                    >
                                      {rider.name}
                                    </span>
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800 shrink-0">
                                      Add-on
                                    </span>
                                  </div>
                                  {rider.description && (
                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                      {rider.description}
                                    </p>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-3 px-3 rounded-lg border border-dashed border-slate-200 bg-white text-center text-slate-400 text-xs">
                          No optional riders configured for this plan.
                        </div>
                      )}
                    </div>

                    {/* Included Base Benefits List */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Plan Coverage Benefits</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                          {availablePlanBenefits.length}
                        </span>
                      </label>

                      {availablePlanBenefits.length > 0 ? (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {availablePlanBenefits.map((benefit, bIdx) => (
                            <div
                              key={benefit.id || bIdx}
                              className="flex items-start gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold text-slate-800 block">
                                  {benefit.name}
                                </span>
                                {benefit.description && (
                                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                    {benefit.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-3 px-3 rounded-lg border border-dashed border-slate-200 bg-white text-center text-slate-400 text-xs">
                          Standard base coverage provided under policy terms.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Purchase Party (Sourcing Agency Master) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Party (Sourcing Agency Master)
                  </label>
                  <select
                    value={formPurchasePartyId}
                    onChange={(e) => {
                      setFormPurchasePartyId(e.target.value);
                      const pp = purchaseParties.find((p) => String(p.id) === String(e.target.value));
                      if (pp && !formIntermediaryName) {
                        setFormIntermediaryName(pp.name);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="">Direct / None</option>
                    {purchaseParties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Intermediary Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Intermediary / Broker Name
                  </label>
                  <input
                    type="text"
                    value={formIntermediaryName}
                    onChange={(e) => setFormIntermediaryName(e.target.value)}
                    placeholder="e.g. FinNexus Direct / Prime Brokerage"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                {/* Sub-Agent */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assigned Sub-Agent (Optional)
                  </label>
                  <select
                    value={formSubAgentId}
                    onChange={(e) => setFormSubAgentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="">None (Direct In-house)</option>
                    {subAgents.map((sa) => (
                      <option key={sa.id} value={sa.id}>
                        {sa.full_name} ({sa.agent_code}) - {sa.commission_rate}%
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Customer & Contact Details */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4" />
                    <span>2. Customer &amp; Contact Details</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select customer profile. Contact details snapshot below is stored with this policy contract.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInlineCustomerModalOpen(true)}
                  className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Create New Customer</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Autocomplete Search */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer / Policyholder <span className="text-rose-500">*</span>
                  </label>
                  <CustomerAutocomplete
                    selectedCustomerId={formCustomerId}
                    selectedCustomerSnapshot={customerSnapshot}
                    onSelectCustomer={handleSelectCustomerFromAutocomplete}
                    onClearCustomer={handleClearCustomer}
                    onOpenCreateCustomerModal={() => setInlineCustomerModalOpen(true)}
                  />
                </div>

                {/* Contact Snapshot Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Mobile Number</label>
                    <input
                      type="text"
                      value={formContactMobile}
                      onChange={(e) => setFormContactMobile(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Email Address</label>
                    <input
                      type="email"
                      value={formContactEmail}
                      onChange={(e) => setFormContactEmail(e.target.value)}
                      placeholder="e.g. user@domain.com"
                      className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white truncate"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">City</label>
                    <input
                      type="text"
                      value={formContactCity}
                      onChange={(e) => setFormContactCity(e.target.value)}
                      placeholder="e.g. Mumbai"
                      className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">PIN Code</label>
                    <input
                      type="text"
                      value={formContactPincode}
                      onChange={(e) => setFormContactPincode(e.target.value)}
                      placeholder="e.g. 400001"
                      className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Policy Identification & Business Type */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>3. Policy Identification &amp; Business Type</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Contract number, proposal identifier, business type (New / Portability / Renewal), and product variant.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Proposal Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Proposal Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={formProposalNumber}
                    onChange={(e) => setFormProposalNumber(e.target.value)}
                    placeholder="e.g. PROP-2024-8971"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono"
                  />
                </div>

                {/* Policy Number */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Policy Contract Number <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePolicyNo}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold"
                    >
                      Generate Auto #
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formPolicyNumber}
                    onChange={(e) => setFormPolicyNumber(e.target.value)}
                    placeholder="e.g. POL-H-2024-0012"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono font-bold"
                  />
                </div>

                {/* Business Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Policy Business Type <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                    {[
                      { val: "NEW", label: "New" },
                      { val: "PORT", label: "Port" },
                      { val: "RENEW", label: "Renew" },
                    ].map((b) => (
                      <button
                        key={b.val}
                        type="button"
                        onClick={() => setFormBusinessType(b.val)}
                        className={`py-1 text-xs font-bold rounded-lg transition-all ${
                          formBusinessType === b.val
                            ? b.val === "PORT"
                              ? "bg-indigo-600 text-white shadow-2xs"
                              : b.val === "RENEW"
                              ? "bg-amber-600 text-white shadow-2xs"
                              : "bg-emerald-600 text-white shadow-2xs"
                            : "text-slate-600 hover:bg-white"
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product Variant */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Variant / Sub-type
                  </label>
                  <input
                    type="text"
                    value={formProductVariant}
                    onChange={(e) => setFormProductVariant(e.target.value)}
                    placeholder="e.g. Comprehensive / Optima Restore"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              </div>

              {/* ======================================================== */}
              {/* CONDITIONAL POLICY HISTORY (PORTABILITY & RENEWAL)       */}
              {/* ======================================================== */}
              {formBusinessType === "PORT" && (
                <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/60 pb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                        <History className="w-4 h-4 text-indigo-600" />
                        <span>PREVIOUS INSURANCE POLICY HISTORY &amp; PORTABILITY DETAILS</span>
                      </h4>
                      <p className="text-[11px] text-indigo-800 mt-0.5">
                        IRDAI Portability Continuity: Record prior insurer history, waiting period credits, and accrued cumulative bonus.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300 shrink-0">
                      Portability Chain ({formPolicyHistory.length} Year{formPolicyHistory.length > 1 ? "s" : ""} Recorded)
                    </span>
                  </div>

                  {/* Visual Policy Continuity Timeline */}
                  <div className="bg-white/90 p-3 rounded-xl border border-indigo-100 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">Continuity Timeline:</span>
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-300">
                      Current Policy (Year 0)
                    </span>
                    <span className="text-slate-400 font-bold">&larr;</span>
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-800 font-bold rounded-lg border border-indigo-300">
                      Last Year's Policy (Seq 1 - Mandatory)
                    </span>
                    {formPolicyHistory.length > 1 && (
                      <>
                        <span className="text-slate-400 font-bold">&larr;</span>
                        <span className="px-2 py-1 bg-blue-50 text-blue-800 font-semibold rounded-lg border border-blue-200">
                          Last-to-Last Year (Seq 2)
                        </span>
                      </>
                    )}
                    {formPolicyHistory.length > 2 && (
                      <>
                        <span className="text-slate-400 font-bold">&larr;</span>
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200">
                          Earlier History ({formPolicyHistory.length - 2} More)
                        </span>
                      </>
                    )}
                  </div>

                  {/* Customer Existing Policies Quick Lookup */}
                  {formCustomerId && policies.filter(p => p.customer_id === formCustomerId).length > 0 && (
                    <div className="p-2.5 bg-indigo-100/60 rounded-xl border border-indigo-200 text-xs flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-indigo-900">
                        Found {policies.filter(p => p.customer_id === formCustomerId).length} existing policy record(s) for this customer in FinNexus:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {policies.filter(p => p.customer_id === formCustomerId).slice(0, 3).map(ep => (
                          <button
                            key={ep.id}
                            type="button"
                            onClick={() => handleSelectExistingPolicyForHistory(0, ep)}
                            className="px-2 py-1 text-[10px] font-bold bg-white text-indigo-700 border border-indigo-300 rounded-lg hover:bg-indigo-50 shadow-2xs"
                          >
                            Prefill Seq 1 from #{ep.policy_number}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Historical Policy Cards */}
                  <div className="space-y-4">
                    {formPolicyHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border transition-all ${
                          idx === 0
                            ? "bg-white border-indigo-300 shadow-2xs"
                            : "bg-white/80 border-slate-200 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                              idx === 0 ? "bg-indigo-600" : "bg-slate-600"
                            }`}>
                              {item.history_sequence}
                            </span>
                            <h5 className="text-xs font-bold text-slate-900">
                              {idx === 0
                                ? "LAST YEAR'S POLICY (SEQUENCE 1 — MANDATORY)"
                                : idx === 1
                                ? "LAST-TO-LAST YEAR'S POLICY (SEQUENCE 2 — OPTIONAL)"
                                : `EARLIER POLICY HISTORY (SEQUENCE ${item.history_sequence} — OPTIONAL)`}
                            </h5>
                          </div>
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePolicyHistory(idx)}
                              className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove Entry</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Insurance Company Name */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Previous Insurer Name {idx === 0 && <span className="text-rose-500">*</span>}
                            </label>
                            <input
                              type="text"
                              required={idx === 0}
                              value={item.insurance_company_name || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "insurance_company_name", e.target.value)}
                              placeholder="e.g. Star Health / ICICI Lombard / Care"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                            />
                          </div>

                          {/* Previous Policy Number */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Previous Policy Number {idx === 0 && <span className="text-rose-500">*</span>}
                            </label>
                            <input
                              type="text"
                              required={idx === 0}
                              value={item.previous_policy_number || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "previous_policy_number", e.target.value)}
                              placeholder="e.g. STAR-2024-987654"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono font-bold"
                            />
                          </div>

                          {/* Product Variant */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Policy Type / Product Variant
                            </label>
                            <input
                              type="text"
                              value={item.product_variant || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "product_variant", e.target.value)}
                              placeholder="e.g. Comprehensive Optima / Silver"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                            />
                          </div>

                          {/* Start Date */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Previous Policy Start Date
                            </label>
                            <DatePicker
                              value={item.policy_start_date || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "policy_start_date", e.target.value)}
                            />
                          </div>

                          {/* Expiry Date */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Previous Policy Expiry Date
                            </label>
                            <DatePicker
                              value={item.policy_expiry_date || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "policy_expiry_date", e.target.value)}
                            />
                          </div>

                          {/* Sum Insured */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Previous Sum Insured (₹)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.sum_insured || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "sum_insured", e.target.value)}
                              placeholder="e.g. 500000"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono"
                            />
                          </div>

                          {/* Premium Amount */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Previous Gross Premium (₹)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.gross_premium || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "gross_premium", e.target.value)}
                              placeholder="0.00"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono"
                            />
                          </div>

                          {/* Policy Status */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Previous Policy Status
                            </label>
                            <select
                              value={item.policy_status || "ACTIVE"}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "policy_status", e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                            >
                              <option value="ACTIVE">Active (Continuous)</option>
                              <option value="EXPIRED">Expired</option>
                              <option value="LAPSED">Lapsed</option>
                            </select>
                          </div>

                          {/* Claim History */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Claim History
                            </label>
                            <select
                              value={item.claim_history || "NO_CLAIM"}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "claim_history", e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                            >
                              <option value="NO_CLAIM">No Claims Made (Clean)</option>
                              <option value="CLAIM_PAID">Claim Paid in Previous Year</option>
                              <option value="MULTIPLE_CLAIMS">Multiple Claims Reported</option>
                            </select>
                          </div>

                          {/* Cumulative Bonus / NCB */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Cumulative Bonus / NCB
                            </label>
                            <input
                              type="text"
                              value={item.cumulative_bonus || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "cumulative_bonus", e.target.value)}
                              placeholder="e.g. 20% NCB Accrued (₹1,00,000)"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                            />
                          </div>

                          {/* Insurer Contact */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Previous Insurer Contact / Branch (Optional)
                            </label>
                            <input
                              type="text"
                              value={item.insurer_contact || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "insurer_contact", e.target.value)}
                              placeholder="e.g. contact@insurer.com / Tollfree"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                            />
                          </div>

                          {/* Remarks */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Remarks
                            </label>
                            <input
                              type="text"
                              value={item.remarks || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "remarks", e.target.value)}
                              placeholder="Optional underwriting notes..."
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                            />
                          </div>

                          {/* Portability Continuity Details (Only for sequence 1) */}
                          {idx === 0 && (
                            <>
                              <div className="md:col-span-2">
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  Portability Continuity Details
                                </label>
                                <textarea
                                  rows={2}
                                  value={item.continuity_details || ""}
                                  onChange={(e) => handleUpdatePolicyHistory(idx, "continuity_details", e.target.value)}
                                  placeholder="e.g. 48 months continuous coverage ported under IRDAI guidelines, time credit transferred"
                                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                                />
                              </div>

                              <div className="md:col-span-1">
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  Waiting Period Waiver Details
                                </label>
                                <textarea
                                  rows={2}
                                  value={item.waiting_period_waiver_details || ""}
                                  onChange={(e) => handleUpdatePolicyHistory(idx, "waiting_period_waiver_details", e.target.value)}
                                  placeholder="e.g. 3-year pre-existing disease waiting period fully waived"
                                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Earlier Policy History Button */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleAddEarlierPolicyHistory}
                      className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-100 border border-indigo-300 rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Earlier Policy History (Sequence {formPolicyHistory.length + 1})</span>
                    </button>
                    <span className="text-[11px] text-indigo-700 font-medium">
                      Multi-year historical continuity verified under IRDAI portability norms
                    </span>
                  </div>
                </div>
              )}

              {formBusinessType === "RENEW" && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                        <History className="w-4 h-4 text-amber-600" />
                        <span>RENEWAL POLICY HISTORY &amp; PREVIOUS CONTRACT DETAILS</span>
                      </h4>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Link to expiring policy contract in FinNexus or record external prior policy contract.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                      Contract Renewal
                    </span>
                  </div>

                  {/* Customer Existing Policies Quick Selector for Renewal */}
                  {formCustomerId && policies.filter(p => p.customer_id === formCustomerId).length > 0 && (
                    <div className="p-2.5 bg-amber-100/60 rounded-xl border border-amber-200 text-xs flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-amber-950">
                        Select an existing policy of this customer to link as the prior expiring policy:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {policies.filter(p => p.customer_id === formCustomerId).map(ep => (
                          <button
                            key={ep.id}
                            type="button"
                            onClick={() => handleSelectExistingPolicyForHistory(0, ep)}
                            className="px-2.5 py-1 text-[10px] font-bold bg-white text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-50 shadow-2xs"
                          >
                            Link #{ep.policy_number} ({ep.company_name})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Renewal Sequence 1 and optional older history */}
                  <div className="space-y-4">
                    {formPolicyHistory.map((item, idx) => (
                      <div key={idx} className="p-4 bg-white rounded-xl border border-amber-200 shadow-2xs">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-600 flex items-center justify-center text-[10px] font-bold text-white">
                              {item.history_sequence}
                            </span>
                            <h5 className="text-xs font-bold text-slate-900">
                              {idx === 0
                                ? "PRIOR EXPIRING POLICY (SEQUENCE 1 — MANDATORY)"
                                : `EARLIER POLICY HISTORY (SEQUENCE ${item.history_sequence})`}
                            </h5>
                          </div>
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePolicyHistory(idx)}
                              className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove Entry</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Previous Insurer Name
                            </label>
                            <input
                              type="text"
                              value={item.insurance_company_name || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "insurance_company_name", e.target.value)}
                              placeholder="e.g. Care Health / HDFC ERGO"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Expiring / Previous Policy # <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={item.previous_policy_number || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "previous_policy_number", e.target.value)}
                              placeholder="e.g. POL-H-2023-8812"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono font-bold"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Product Variant
                            </label>
                            <input
                              type="text"
                              value={item.product_variant || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "product_variant", e.target.value)}
                              placeholder="e.g. Super Health Shield"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Policy Start Date
                            </label>
                            <DatePicker
                              value={item.policy_start_date || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "policy_start_date", e.target.value)}
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Policy Expiry Date
                            </label>
                            <DatePicker
                              value={item.policy_expiry_date || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "policy_expiry_date", e.target.value)}
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Prior Sum Insured (₹)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.sum_insured || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "sum_insured", e.target.value)}
                              placeholder="e.g. 500000"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Prior Gross Premium (₹)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.gross_premium || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "gross_premium", e.target.value)}
                              placeholder="0.00"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Cumulative Bonus / NCB
                            </label>
                            <input
                              type="text"
                              value={item.cumulative_bonus || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "cumulative_bonus", e.target.value)}
                              placeholder="e.g. 10% NCB accrued"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Renewal Remarks
                            </label>
                            <input
                              type="text"
                              value={item.remarks || ""}
                              onChange={(e) => handleUpdatePolicyHistory(idx, "remarks", e.target.value)}
                              placeholder="e.g. On-time renewal, no break in cover"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleAddEarlierPolicyHistory}
                      className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Earlier Policy History (Sequence {formPolicyHistory.length + 1})</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Coverage & Sum Insured */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4" />
                    <span>4. Coverage &amp; Sum Insured</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Base Sum Insured selection, custom coverage limits, optional health benefits, and core premium economics.
                  </p>
                </div>
              </div>


              {/* Row 1: Net Premium, Gross Premium, Computed Tax */}
              <div className="p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  {/* Net Premium */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Net Premium (Without GST) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formNetPremium}
                      onChange={(e) => handleNetPremiumChange(e.target.value)}
                      placeholder="e.g. 10000.00"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Gross Premium with True 18% GST Toggle & Manual Override */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[11px] font-semibold text-slate-600">
                          Gross Premium (With GST) <span className="text-rose-500">*</span>
                        </label>
                        {isGrossManualOverride && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                            Manual Override
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {isGrossManualOverride && (
                          <button
                            type="button"
                            onClick={handleResetGrossPremium}
                            className="text-[10px] text-amber-700 hover:text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium"
                            title="Reset Gross Premium to calculated formula"
                          >
                            ↺ Reset
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleToggleGst}
                          className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all border ${
                            isGstEnabled
                              ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs"
                              : "bg-white text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                          }`}
                          title={isGstEnabled ? "Remove 18% GST (Sets Gross = Net)" : "Apply 18% GST (Gross = Net * 1.18)"}
                        >
                          {isGstEnabled ? "✓ Remove 18% GST" : "+ 18% GST"}
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={formGrossPremium}
                      onChange={(e) => handleGrossPremiumChange(e.target.value)}
                      placeholder="e.g. 11800.00"
                      className={`w-full px-3 py-2 text-xs rounded-xl border bg-white font-mono font-bold ${
                        isGrossManualOverride ? "border-amber-300 text-amber-800" : "border-slate-200 text-emerald-700"
                      }`}
                    />
                  </div>

                  {/* Computed Tax */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Computed Tax / GST (18%)
                    </label>
                    <div className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">₹</span>
                      <span>
                        {Math.max(0, (parseFloat(formGrossPremium) || 0) - (parseFloat(formNetPremium) || 0)).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>



            {/* Section 2: Insured Members / Covered Persons (Phases 2, 3, 4, 5, 6) */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>5. Insured Members / Covered Persons</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formCoverageType === "FAMILY_FLOATER"
                      ? "Family Floater: All covered members share the common policy Sum Insured."
                      : "Individual Coverage: Each covered person has an independent Sum Insured allocation."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {formCoverageType === "FAMILY_FLOATER" ? (
                    <span className="px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-lg flex items-center gap-1">
                      <span>Shared Floater Limit:</span>
                      <span className="font-mono">Rs.{Number(formSumAssured || 0).toLocaleString("en-IN")}</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg flex items-center gap-1">
                      <span>Total Individual Allocated:</span>
                      <span className="font-mono">Rs.{totalMemberAllocatedSI.toLocaleString("en-IN")}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleAddMember}
                    className="px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1 shadow-2xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Insured Member</span>
                  </button>
                </div>
              </div>

              {/* Phase 6: Family Floater 2-Member Requirement Warning & Counter */}
              {formCoverageType === "FAMILY_FLOATER" && (() => {
                const floaterMembers = formInsuredMembers.filter((m) => m.full_name && m.full_name.trim());
                const floaterCount = floaterMembers.length;
                const isMet = floaterCount >= 2;
                return (
                  <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isMet
                      ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                      : "bg-amber-50/90 border-amber-300 text-amber-900"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className={`w-4 h-4 shrink-0 ${isMet ? "text-emerald-600" : "text-amber-600"}`} />
                      <div>
                        <p className="text-xs font-bold">
                          {isMet
                            ? "Family Floater Member Requirement Satisfied"
                            : "Family Floater Requires Minimum 2 Insured Members"}
                        </p>
                        <p className="text-[11px] mt-0.5 opacity-90">
                          {isMet
                            ? `${floaterCount} covered members will share the common floater sum insured.`
                            : "Please add at least one more covered family member before issuing this contract."}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-bold font-mono rounded-lg shrink-0 ${
                      isMet ? "bg-emerald-200 text-emerald-900" : "bg-amber-200 text-amber-900 animate-pulse"
                    }`}>
                      {floaterCount} / 2 Members (Min 2 required)
                    </span>
                  </div>
                );
              })()}

              {/* Family Group Detected Banner */}
              {detectedFamilyGroup && detectedFamilyGroup.has_family_group && (
                <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                        <span>Family Group Detected: &ldquo;{detectedFamilyGroup.group_name}&rdquo;</span>
                        <span className="px-1.5 py-0.2 bg-blue-200 text-blue-800 rounded-full text-[10px]">
                          {detectedFamilyGroup.members?.length || 0} Members
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-700">
                        Household records exist for this customer. You can selectively import family members into this policy.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFamilyGroupModalOpen(true)}
                    className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs flex items-center gap-1 transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Load Family Members</span>
                  </button>
                </div>
              )}

              {/* Member Cards List */}
              <div className="space-y-3">
                {formInsuredMembers.map((member, idx) => {
                  const memberAge = calculateAge(member.date_of_birth);
                  return (
                    <div
                      key={idx}
                      className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 hover:border-slate-300 transition-colors space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-800">
                            Member #{idx + 1}
                          </span>
                          {idx === 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                              Primary Insured / Policyholder
                            </span>
                          )}
                          {memberAge !== null && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Age: {memberAge} yrs
                            </span>
                          )}
                        </div>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(idx)}
                            className="text-xs text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        {/* Full Name */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                            Full Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Rahul Sharma"
                            value={member.full_name}
                            onChange={(e) => handleMemberChange(idx, "full_name", e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        {/* Relationship */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                            Relationship <span className="text-rose-500">*</span>
                          </label>
                          <select
                            required
                            value={member.relationship}
                            onChange={(e) => handleMemberChange(idx, "relationship", e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
                          >
                            {RELATIONSHIP_OPTIONS.map((rel) => (
                              <option key={rel} value={rel}>
                                {rel}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Date of Birth */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                            Date of Birth
                          </label>
                          <DatePicker
                            value={member.date_of_birth || ""}
                            onChange={(e) => handleMemberChange(idx, "date_of_birth", e.target.value)}
                            maxDate={getTodayIso()}
                            placeholder="DD-MM-YYYY"
                          />
                        </div>

                        {/* Gender */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                            Gender
                          </label>
                          <select
                            value={member.gender || "MALE"}
                            onChange={(e) => handleMemberChange(idx, "gender", e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        {/* Mobile Number */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                            Mobile Number
                          </label>
                          <input
                            type="tel"
                            placeholder="10-digit mobile"
                            value={member.mobile_number || ""}
                            onChange={(e) => handleMemberChange(idx, "mobile_number", e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        {/* Email */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                            Email Address
                          </label>
                          <input
                            type="email"
                            placeholder="name@example.com"
                            value={member.email || ""}
                            onChange={(e) => handleMemberChange(idx, "email", e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        {/* Member Code / Card No */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                            Member ID / Card # (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. TPA-ID-1234"
                            value={member.member_code || ""}
                            onChange={(e) => handleMemberChange(idx, "member_code", e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        {/* Sum Insured Allocation */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                            Sum Insured Allocation (Rs.)
                          </label>
                          {formCoverageType === "FAMILY_FLOATER" ? (
                            <div className="w-full px-3 py-1.5 text-xs rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 font-medium">
                              Covered under Shared Floater Limit (Rs.{Number(formSumAssured || 0).toLocaleString("en-IN")})
                            </div>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="10000"
                              placeholder="e.g. 500000"
                              value={member.individual_sum_insured || ""}
                              onChange={(e) => handleMemberChange(idx, "individual_sum_insured", e.target.value)}
                              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-mono font-semibold focus:ring-2 focus:ring-indigo-500"
                            />
                          )}
                        </div>
                      </div>

                      {/* Special conditions / Notes */}
                      <div>
                        <input
                          type="text"
                          placeholder="Special conditions, pre-existing diseases, or medical notes (optional)..."
                          value={member.notes || ""}
                          onChange={(e) => handleMemberChange(idx, "notes", e.target.value)}
                          className="w-full px-3 py-1.5 text-[11px] rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            

            {/* Section 6: Product-Specific Details */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4" />
                    <span>6. Product-Specific Parameters</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Dynamic category-specific fields mapped from Excel source headings.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {formPolicyType} Parameters
                </span>
              </div>

              {/* MOTOR INSURANCE FIELDS */}
              {formPolicyType === "MOTOR" && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Car className="w-4 h-4 text-indigo-600" />
                    <span>Motor Vehicle Details (Compay Name &amp; Model Name)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Vehicle Registration # <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formVehicleRegNo}
                        onChange={(e) => setFormVehicleRegNo(e.target.value.toUpperCase())}
                        placeholder="e.g. MH12AB1234"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Vehicle Manufacturer <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formVehicleManufacturer}
                        onChange={(e) => setFormVehicleManufacturer(e.target.value)}
                        placeholder="e.g. Hyundai, Honda, Tata, Maruti"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Vehicle Model Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formVehicleModel}
                        onChange={(e) => setFormVehicleModel(e.target.value)}
                        placeholder="e.g. Creta, City, Nexon, Swift"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Vehicle Type
                      </label>
                      <select
                        value={formVehicleType}
                        onChange={(e) => setFormVehicleType(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                      >
                        <option value="Private Car">Private Car</option>
                        <option value="Two-Wheeler">Two-Wheeler</option>
                        <option value="Commercial Vehicle">Commercial Vehicle</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TRAVEL INSURANCE FIELDS */}
              {formPolicyType === "TRAVEL" && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Plane className="w-4 h-4 text-sky-600" />
                    <span>Travel Destination &amp; Journey Type</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Destination / Country <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formTravelDestination}
                        onChange={(e) => setFormTravelDestination(e.target.value)}
                        placeholder="e.g. USA &amp; Canada, Schengen Europe, Southeast Asia"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Travel Type
                      </label>
                      <select
                        value={formTravelType}
                        onChange={(e) => setFormTravelType(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                      >
                        <option value="International Travel">International Travel</option>
                        <option value="Student Travel">Student Travel</option>
                        <option value="Annual Multi-Trip">Annual Multi-Trip</option>
                        <option value="Domestic Travel">Domestic Travel</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* LIFE INSURANCE FIELDS */}
              {formPolicyType === "LIFE" && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <HeartPulse className="w-4 h-4 text-rose-600" />
                    <span>Life Policy Structure &amp; Premium Payment Term (PPT)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Life Product Variant
                      </label>
                      <select
                        value={formLifeVariant}
                        onChange={(e) => setFormLifeVariant(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                      >
                        <option value="Term Insurance">Term Insurance (Pure Protection)</option>
                        <option value="Whole Life">Whole Life Insurance</option>
                        <option value="Endowment">Endowment Plan</option>
                        <option value="ULIP">Unit Linked Insurance Plan (ULIP)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Premium Payment Term (Years)
                      </label>
                      <input
                        type="text"
                        value={formLifePPT}
                        onChange={(e) => setFormLifePPT(e.target.value)}
                        placeholder="e.g. 5, 10, 15, or Regular Pay"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* OTHER CATEGORIES */}
              {formPolicyType !== "MOTOR" && formPolicyType !== "TRAVEL" && formPolicyType !== "LIFE" && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                  Standard policy parameters apply to {formPolicyType} category.
                </div>
              )}
            </div>

            {/* Section 7: Policy Duration, Mode & Dates */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>7. Policy Duration, Mode &amp; Dates</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Policy duration, payment mode frequency, inception schedule, and automated expiry tracking.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                {/* Premium Mode */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Premium Payment Mode
                  </label>
                  <select
                    value={formPremiumMode}
                    onChange={(e) => {
                      setFormPremiumMode(e.target.value);
                      if (e.target.value === "SINGLE") setFormIsSinglePremium(true);
                      else setFormIsSinglePremium(false);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="YEARLY">Yearly</option>
                    <option value="HALF_YEARLY">Half Yearly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="SINGLE">Single Premium</option>
                  </select>
                </div>

                {/* Single Premium Checkbox */}
                <div className="flex items-center h-10 px-3 rounded-xl border border-slate-200 bg-slate-50">
                  <label className="flex items-center gap-2 cursor-pointer w-full">
                    <input
                      type="checkbox"
                      checked={formIsSinglePremium}
                      onChange={(e) => {
                        setFormIsSinglePremium(e.target.checked);
                        if (e.target.checked) setFormPremiumMode("SINGLE");
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500/20"
                    />
                    <span className="text-xs font-semibold text-slate-700">Single Premium Contract</span>
                  </label>
                </div>

                {/* Policy Term (Years) Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Policy Term (Years) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formPolicyTermYears}
                    onChange={(e) => setFormPolicyTermYears(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="1">1 Year</option>
                    <option value="2">2 Years</option>
                    <option value="3">3 Years</option>
                    <option value="4">4 Years</option>
                    {!["1", "2", "3", "4"].includes(String(formPolicyTermYears)) && formPolicyTermYears && (
                      <option value={formPolicyTermYears}>
                        {formPolicyTermYears} Years (Historical / Custom)
                      </option>
                    )}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Policy Start Date <span className="text-rose-500">*</span>
                  </label>
                  <DatePicker
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    First Receipt Date
                  </label>
                  <DatePicker
                    value={formFirstReceiptDate}
                    onChange={(e) => setFormFirstReceiptDate(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Policy Expiry Date <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-indigo-600 font-semibold">Auto-calculated</span>
                  </div>
                  <DatePicker
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Initial Payment Details */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" />
                  <span>8. First Installment Payment Receipt</span>
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRecordInitialPayment}
                    onChange={(e) => setFormRecordInitialPayment(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500/20"
                  />
                  <span className="text-xs text-slate-600">Record Initial Payment Now</span>
                </label>
              </div>

              {formRecordInitialPayment && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={formPaymentMode}
                      onChange={(e) => setFormPaymentMode(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="ONLINE">Online Net Banking / UPI</option>
                      <option value="CHEQUE">Cheque / Demand Draft</option>
                      <option value="CASH">Cash</option>
                      <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Payment Amount (₹)
                      </label>
                      {isPaymentAmountManual && (
                        <button
                          type="button"
                          onClick={handleResetPaymentAmount}
                          className="text-[10px] text-indigo-700 hover:text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 font-medium"
                          title="Match Payment Amount with Gross Premium"
                        >
                          ↺ Match Gross
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 25000"
                      value={formPaymentAmount}
                      onChange={(e) => handlePaymentAmountChange(e.target.value)}
                      className={`w-full px-3 py-2 text-xs rounded-xl border bg-white font-bold ${
                        isPaymentAmountManual ? "border-amber-300 text-amber-800" : "border-slate-200 text-emerald-700"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Date
                    </label>
                    <DatePicker
                      value={formPaymentDate}
                      onChange={(e) => setFormPaymentDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Issuing Bank
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., HDFC Bank / SBI"
                      value={formBankName}
                      onChange={(e) => setFormBankName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Transaction / Cheque Ref #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., UTR-829104 / CHQ-10492"
                      value={formTransactionRef}
                      onChange={(e) => setFormTransactionRef(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Receipt Remarks
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Initial policy deposit"
                      value={formPaymentNotes}
                      onChange={(e) => setFormPaymentNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                    />
                  </div>

                  {/* Phase 5: Payment Proof Document Upload */}
                  <div className="md:col-span-3 pt-2 border-t border-slate-200/80">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Upload Payment Proof (Optional — PDF, JPG, JPEG, PNG up to 10MB)
                    </label>
                    {paymentProofFile ? (
                      <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{paymentProofFile.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {(paymentProofFile.size / 1024).toFixed(1)} KB &bull; Ready for upload upon policy creation
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPaymentProofFile(null)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <label className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Attach Receipt / Challan Proof</span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                if (f.size > 10 * 1024 * 1024) {
                                  alert("File exceeds maximum allowed size of 10MB.");
                                  return;
                                }
                                setPaymentProofFile(f);
                              }
                            }}
                          />
                        </label>
                        <span className="text-[11px] text-slate-400">
                          File will be securely stored and linked to payment ledger.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            

{/* Section 5: Commission & 10% TDS Configuration (Phases 5, 6, 7) */}


{/* Section 2.5: Nominee Management (New Feature) */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>09. Policy Nominees &amp; Additional Underwriting Notes</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Assign one or more beneficiaries. Total share percentages must equal 100%.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      Math.abs(totalNomineeShare - 100) < 0.01
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    Total Share: {totalNomineeShare}%
                  </span>
                  <button
                    type="button"
                    onClick={handleAddNominee}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-200 hover:bg-indigo-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Nominee</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {formNominees.map((nom, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 uppercase">
                        Nominee #{idx + 1}
                      </span>
                      {formNominees.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveNominee(idx)}
                          className="text-rose-500 hover:text-rose-700 text-xs font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                          Full Legal Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., Sunita Sharma"
                          value={nom.full_name}
                          onChange={(e) => handleNomineeChange(idx, "full_name", e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                          Relationship <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={nom.relationship}
                          onChange={(e) => handleNomineeChange(idx, "relationship", e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                        >
                          <option value="Spouse">Spouse</option>
                          <option value="Son">Son</option>
                          <option value="Daughter">Daughter</option>
                          <option value="Father">Father</option>
                          <option value="Mother">Mother</option>
                          <option value="Brother">Brother</option>
                          <option value="Sister">Sister</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                          Date of Birth
                        </label>
                        <DatePicker
                          value={nom.date_of_birth}
                          onChange={(e) => handleNomineeChange(idx, "date_of_birth", e.target.value)}
                          maxDate={getTodayIso()}
                          placeholder="DD-MM-YYYY"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                          Mobile (Optional)
                        </label>
                        <input
                          type="tel"
                          placeholder="10-digit"
                          value={nom.mobile_number}
                          onChange={(e) => handleNomineeChange(idx, "mobile_number", e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                          Share % <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          max="100"
                          step="0.01"
                          value={nom.share_percentage}
                          onChange={(e) => handleNomineeChange(idx, "share_percentage", e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-bold text-indigo-700"
                        />
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="Nominee Residential Address (Optional)"
                        value={nom.address}
                        onChange={(e) => handleNomineeChange(idx, "address", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {/* Additional Policy Notes */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Policy Underwriting &amp; Additional Notes
                </label>
                <textarea
                  rows={3}
                  value={formPolicyNotes}
                  onChange={(e) => setFormPolicyNotes(e.target.value)}
                  placeholder="Record underwriting conditions, special endorsements, client instructions..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                />
              </div>
            </div>

            {/* Section: Policy Documents & Attachments (Optional, Staged for Upload Upon Policy Issuance) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Policy Documents &amp; Attachments
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Attach client KYC, proposal form, previous policy, medical reports, or payment receipts.
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                  OPTIONAL &bull; STAGED
                </span>
              </div>

              {stagedDocError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formatErrorMsg(stagedDocError)}</span>
                </div>
              )}

              {/* Add Staged Document Input Form */}
              <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Document Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={stagedDocType}
                      onChange={(e) => setStagedDocType(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                      {POLICY_DOCUMENT_TYPES.map((dt) => (
                        <option key={dt} value={dt}>
                          {dt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Document Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Aadhaar & PAN Card, Proposal Form"
                      value={stagedDocTitle}
                      onChange={(e) => setStagedDocTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Select File <span className="text-rose-500">*</span>
                    </label>
                    <input
                      ref={stagedFileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setStagedDocFile(e.target.files[0]);
                          if (!stagedDocTitle.trim()) {
                            const fname = e.target.files[0].name.replace(/\.[^/.]+$/, "");
                            setStagedDocTitle(fname);
                          }
                        }
                      }}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <input
                    type="text"
                    placeholder="Description / Notes (Optional)"
                    value={stagedDocDesc}
                    onChange={(e) => setStagedDocDesc(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddStagedDoc}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Staged Documents</span>
                  </button>
                </div>
              </div>

              {/* Staged Documents Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Staged Documents ({formStagedDocs.length})</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Documents will be uploaded automatically upon clicking 'Issue Policy Contract'.
                  </span>
                </div>

                {formStagedDocs.length > 0 ? (
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
                        {formStagedDocs.map((sDoc) => (
                          <tr key={sDoc.id} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 font-medium text-slate-800">
                              <div>{sDoc.title}</div>
                              {sDoc.description && (
                                <div className="text-[10px] text-slate-400">{sDoc.description}</div>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getPolicyDocBadgeClass(
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
                                onClick={() => handleRemoveStagedDoc(sDoc.id)}
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
                    No documents staged yet. Use the selector above to attach policy proposal, KYC, or certificate files.
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset Form</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("policies")}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formSubmitting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-2"
              >
                {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Issue Policy Contract</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: PREMIUM SCHEDULES                                 */}
      {/* ======================================================== */}
      {activeTab === "schedules" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select
                value={scheduleStatusFilter}
                onChange={(e) => {
                  setScheduleStatusFilter(e.target.value);
                  setSchedulePage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
              >
                <option value="ALL">All Installments</option>
                <option value="DUE_TODAY">Due Today</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="OVERDUE">Overdue</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
            <button
              onClick={fetchSchedules}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
              title="Refresh schedules"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Policy #</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Paid Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedulesLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                        <span>Loading installment schedules...</span>
                      </div>
                    </td>
                  </tr>
                ) : schedules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No installment schedules found.
                    </td>
                  </tr>
                ) : (
                  schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-slate-500">#{s.installment_number}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.policy_id}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{s.due_date}</td>
                      <td className="py-3 px-4 font-bold text-emerald-700">
                        ₹{Number(s.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.status === "PAID"
                              ? "bg-emerald-50 text-emerald-700"
                              : s.status === "OVERDUE"
                              ? "bg-rose-50 text-rose-700"
                              : s.status === "DUE_TODAY"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{s.paid_date || "—"}</td>
                      <td className="py-3 px-4 text-right">
                        {s.status !== "PAID" && canMutate && (
                          <button
                            onClick={() => openPaymentModal(s)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs"
                          >
                            Pay Now
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: RENEWALS & EXPIRIES                               */}
      {/* ======================================================== */}
      {activeTab === "renewals" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Expiring Policies &amp; Renewals</h3>
              <p className="text-xs text-slate-500">
                Policies due for renewal within the configured {renewalWindowDays}-day window.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={renewalWindowDays}
                onChange={(e) => setRenewalWindowDays(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
              >
                <option value={15}>Next 15 Days</option>
                <option value={30}>Next 30 Days</option>
                <option value={60}>Next 60 Days</option>
                <option value={90}>Next 90 Days</option>
              </select>
              <button
                onClick={fetchRenewals}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                title="Refresh renewals"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Policy #</th>
                  <th className="py-3 px-4">Policyholder</th>
                  <th className="py-3 px-4">Insurer &amp; Plan</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4">Days Left</th>
                  <th className="py-3 px-4">Renewal Premium</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {renewalsLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                        <span>Checking upcoming policy renewals...</span>
                      </div>
                    </td>
                  </tr>
                ) : upcomingRenewals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No policies expiring within the next {renewalWindowDays} days.
                    </td>
                  </tr>
                ) : (
                  upcomingRenewals.map((r) => {
                    const daysLeft = r.days_remaining !== undefined ? r.days_remaining : 0;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {r.policy_number}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{r.customer_name}</td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{r.company_name}</div>
                          <div className="text-[10px] text-slate-400">{r.plan_name}</div>
                        </td>
                        <td className="py-3 px-4 font-bold text-rose-700">{r.expiry_date}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              daysLeft <= 7
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {daysLeft} days
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          ₹{Number(r.final_premium || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {canMutate && (
                            <button
                              onClick={() => openRenewalModal(r)}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1 ml-auto"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Renew</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: BULK IMPORT                                       */}
      {/* ======================================================== */}
      {activeTab === "import" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Bulk Policy Import Workflow</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload CSV or Excel spreadsheets containing policy contracts. Installment schedules will auto-generate.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadTemplate("csv")}
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV Template</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTemplate("xlsx")}
                className="px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Excel (.XLSX) Template</span>
              </button>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 rounded-2xl p-8 text-center cursor-pointer transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              {importFile ? importFile.name : "Click to select CSV or Excel (.xlsx) file"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports UTF-8 CSV or OpenXML Spreadsheet up to 10 MB with sanitization.
            </p>
          </div>

          {/* Preview Results */}
          {previewData && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Total Rows</span>
                  <p className="text-lg font-bold text-slate-900">{previewData.total_rows}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 uppercase font-bold">Valid Rows</span>
                  <p className="text-lg font-bold text-emerald-800">{previewData.valid_rows}</p>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                  <span className="text-[10px] text-rose-700 uppercase font-bold">Invalid / Errors</span>
                  <p className="text-lg font-bold text-rose-800">{previewData.invalid_rows}</p>
                </div>
              </div>

              {/* Row Diagnostics Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 sticky top-0">
                    <tr>
                      <th className="p-2.5">Row</th>
                      <th className="p-2.5">Policy #</th>
                      <th className="p-2.5">Customer</th>
                      <th className="p-2.5">Carrier</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Diagnostics / Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.rows?.map((r) => (
                      <tr
                        key={r.row_number}
                        className={r.is_valid ? "hover:bg-slate-50" : "bg-rose-50/30"}
                      >
                        <td className="p-2.5 font-mono text-slate-500">#{r.row_number}</td>
                        <td className="p-2.5 font-mono font-bold text-slate-800">{r.data.policy_number}</td>
                        <td className="p-2.5">{r.data.customer_mobile || "—"}</td>
                        <td className="p-2.5">{r.data.company_code || "—"}</td>
                        <td className="p-2.5">
                          {r.is_valid ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              VALID
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              INVALID
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-rose-600 text-[11px]">
                          {r.errors && r.errors.length > 0 ? r.errors.join(", ") : "Ready for import"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setImportFile(null);
                    setPreviewData(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importing || previewData.valid_rows === 0}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-2"
                >
                  {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Confirm Import ({previewData.valid_rows} Policies)</span>
                </button>
              </div>
            </div>
          )}

          {importResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
              <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Bulk Import Report Summary</span>
              </h4>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-2 bg-white rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-slate-500 uppercase">Imported</span>
                  <p className="text-lg font-bold text-emerald-700">{importResult.imported_count}</p>
                </div>
                <div className="p-2 bg-white rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-slate-500 uppercase">Skipped</span>
                  <p className="text-lg font-bold text-slate-700">{importResult.skipped_count}</p>
                </div>
                <div className="p-2 bg-white rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-slate-500 uppercase">Errors</span>
                  <p className="text-lg font-bold text-rose-700">{importResult.failed_count}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Record Payment Transaction                        */}
      {/* ======================================================== */}
      {payModalSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Record Installment Payment</h3>
              </div>
              <button
                onClick={() => setPayModalSchedule(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {payError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formatErrorMsg(payError)}</span>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Mode
                </label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                >
                  <option value="ONLINE">Online Net Banking / UPI</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., SBI / Axis"
                    value={payBank}
                    onChange={(e) => setPayBank(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Receipt Date
                  </label>
                  <DatePicker
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transaction / Cheque Ref #
                </label>
                <input
                  type="text"
                  placeholder="e.g., UTR-104928"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional notes..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayModalSchedule(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {payLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Record Transaction</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Renew Policy Contract                             */}
      {/* ======================================================== */}
      {renewingPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Renew Policy: {renewingPolicy.policy_number}
                </h3>
              </div>
              <button
                onClick={() => setRenewingPolicy(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renewError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formatErrorMsg(renewError)}</span>
              </div>
            )}

            {!showRenewalConfirmation ? (
              <form onSubmit={handlePreExecuteRenewal} className="space-y-3.5">
                {/* Existing Contract Reference */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Policyholder:</span>
                    <span className="font-bold text-slate-900">{renewingPolicy.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expiring Contract:</span>
                    <span className="font-mono font-bold text-slate-800">{renewingPolicy.policy_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current Expiry Date:</span>
                    <span className="font-mono text-rose-700 font-bold">{renewingPolicy.expiry_date}</span>
                  </div>
                </div>

                {/* New Policy Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Policy Number
                  </label>
                  <input
                    type="text"
                    required
                    value={renewPolicyNumber}
                    onChange={(e) => setRenewPolicyNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono font-bold text-slate-900 bg-white"
                    placeholder="e.g. POL-2026-002-R1"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Linked as separate renewal record in database.</p>
                </div>

                {/* Dates & Term Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      New Policy Start Date
                    </label>
                    <DatePicker
                      value={renewStartDate}
                      onChange={(e) => handleRenewStartDateChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Renewal Term (Years)
                    </label>
                    <select
                      value={renewTermYears}
                      onChange={(e) => handleRenewTermChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold"
                    >
                      <option value="1">1 Year Contract</option>
                      <option value="2">2 Years Multi-Year</option>
                      <option value="3">3 Years Multi-Year</option>
                      <option value="4">4 Years Multi-Year</option>
                      <option value="5">5 Years Multi-Year</option>
                    </select>
                  </div>
                </div>

                {/* End Date Control with Override Detection */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      New Policy End Date
                    </label>
                    {isManualEndDateOverride && (
                      <button
                        type="button"
                        onClick={handleResetCalculatedEndDate}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline"
                      >
                        Reset to Calculated Date
                      </button>
                    )}
                  </div>
                  <DatePicker
                    value={renewEndDate}
                    onChange={(e) => handleRenewEndDateChange(e.target.value)}
                  />
                  {isManualEndDateOverride && (
                    <p className="text-[10px] text-amber-600 font-medium mt-0.5">Manual override active: Auto-calculation paused.</p>
                  )}
                </div>

                {/* Date Warning Chips */}
                {renewStartDate && renewingPolicy.expiry_date && renewStartDate > getNextStartDate(renewingPolicy.expiry_date) && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Coverage gap detected: New contract starts after expected continuity date.</span>
                  </div>
                )}
                {renewStartDate && renewingPolicy.expiry_date && renewStartDate <= renewingPolicy.expiry_date && (
                  <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-[11px] text-sky-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-sky-600" />
                    <span>Overlapping period: New contract starts on or before current expiry date.</span>
                  </div>
                )}

                {/* Premium */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Renewal Premium (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={renewPremium}
                    onChange={(e) => setRenewPremium(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-emerald-700 bg-white"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Renewal Endorsement Remarks
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Optional renewal endorsement notes..."
                    value={renewNotes}
                    onChange={(e) => setRenewNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setRenewingPolicy(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    <span>Review Renewal Summary &rarr;</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Confirmation Step */
              <div className="space-y-4">
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-2">
                  <p className="font-bold text-amber-950 uppercase tracking-wider text-[11px]">
                    Confirm Renewal Policy Contract Creation
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 pt-1">
                    <div><span className="text-slate-400">New Contract #:</span> <strong className="font-mono text-slate-900 block">{renewPolicyNumber}</strong></div>
                    <div><span className="text-slate-400">Previous Contract:</span> <span className="font-mono block text-slate-600">{renewingPolicy.policy_number}</span></div>
                    <div><span className="text-slate-400">New Coverage Start:</span> <strong className="font-mono text-emerald-800 block">{renewStartDate}</strong></div>
                    <div><span className="text-slate-400">New Coverage Expiry:</span> <strong className="font-mono text-emerald-800 block">{renewEndDate}</strong></div>
                    <div><span className="text-slate-400">Renewal Term:</span> <strong className="block text-slate-800">{renewTermYears} {renewTermYears === 1 ? 'Year' : 'Years'}</strong></div>
                    <div><span className="text-slate-400">Renewal Premium:</span> <strong className="font-bold text-emerald-700 block">₹{Number(renewPremium || 0).toLocaleString('en-IN')}</strong></div>
                  </div>
                  <p className="text-[11px] text-slate-500 pt-1 border-t border-amber-200/60">
                    Original contract will be marked EXPIRED. A new linked policy row will be created with continuity intact.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRenewalConfirmation(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    &larr; Back to Edit
                  </button>
                  <button
                    type="button"
                    disabled={renewLoading}
                    onClick={handleExecuteRenewal}
                    className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {renewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm &amp; Execute Renewal</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Change Policy Status                              */}
      {/* ======================================================== */}
      {statusModalPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Change Policy Status</h3>
              </div>
              <button
                onClick={() => setStatusModalPolicy(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {statusChangeError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {formatErrorMsg(statusChangeError)}
              </div>
            )}

            <form onSubmit={handleExecuteStatusChange} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select New Status
                </label>
                <select
                  value={newStatusValue}
                  onChange={(e) => setNewStatusValue(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-bold"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="LAPSED">LAPSED</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="EXPIRED">EXPIRED</option>
                </select>
              </div>

              {newStatusValue === "CANCELLED" && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>Warning: Cancelling a policy marks it non-renewable. Please confirm.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transition Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Reason for status change..."
                  value={statusChangeNotes}
                  onChange={(e) => setStatusChangeNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModalPolicy(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusChangeLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {statusChangeLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Status</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Manage Policy Nominees                            */}
      {/* ======================================================== */}
      {managingNomineesPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Manage Nominees: {managingNomineesPolicy.policy_number}
                </h3>
              </div>
              <button
                onClick={() => setManagingNomineesPolicy(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {manageNomineesError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {formatErrorMsg(manageNomineesError)}
              </div>
            )}

            <form onSubmit={handleSaveManageNominees} className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Total Share must equal 100%.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setManageNomineesList([
                      ...manageNomineesList,
                      { full_name: "", relationship: "Son", date_of_birth: "", mobile_number: "", address: "", share_percentage: "0" },
                    ]);
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Nominee</span>
                </button>
              </div>

              {manageNomineesList.map((nom, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Nominee #{idx + 1}
                    </span>
                    {manageNomineesList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setManageNomineesList(manageNomineesList.filter((_, i) => i !== idx));
                        }}
                        className="text-rose-500 hover:text-rose-700 text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Nominee Full Name *"
                        required
                        value={nom.full_name}
                        onChange={(e) => {
                          const updated = [...manageNomineesList];
                          updated[idx].full_name = e.target.value;
                          setManageNomineesList(updated);
                        }}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <select
                        value={nom.relationship}
                        onChange={(e) => {
                          const updated = [...manageNomineesList];
                          updated[idx].relationship = e.target.value;
                          setManageNomineesList(updated);
                        }}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="Spouse">Spouse</option>
                        <option value="Son">Son</option>
                        <option value="Daughter">Daughter</option>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Brother">Brother</option>
                        <option value="Sister">Sister</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <input
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        placeholder="Share %"
                        required
                        value={nom.share_percentage}
                        onChange={(e) => {
                          const updated = [...manageNomineesList];
                          updated[idx].share_percentage = e.target.value;
                          setManageNomineesList(updated);
                        }}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-bold text-indigo-700"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setManagingNomineesPolicy(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manageNomineesLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {manageNomineesLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Nominees</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Draft Resume / Fresh Start Prompt Modal */}
      {showDraftResumePrompt && draft && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Unfinished Policy Draft in Progress</h3>
                <p className="text-xs text-slate-500">
                  You have a saved draft contract in progress.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Policyholder:</span>
                <span className="font-bold text-slate-900">
                  {draft.customerSnapshot?.fullName || draft.customerSnapshot?.name || draft.formData?.customerName || (draft.formData?.customerId ? "Selected Customer" : "Pending Customer")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contract Number:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {draft.formData?.policyNumber ? `#${draft.formData.policyNumber}` : "Draft In Progress"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Saved:</span>
                <span className="text-slate-700">
                  {draft.savedAt ? new Date(draft.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Recently"}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDraftResumePrompt(false);
                  restoreDraft();
                  handleResumeDraft();
                  setActiveTab("new_policy");
                }}
                className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Resume Existing Draft</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Start fresh? Your existing draft will be permanently discarded.")) {
                    setShowDraftResumePrompt(false);
                    discardDraft();
                    handleResetForm();
                    setActiveTab("new_policy");
                  }
                }}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Start New Draft
              </button>
              <button
                type="button"
                onClick={() => setShowDraftResumePrompt(false)}
                className="py-2 px-2.5 text-slate-400 hover:text-slate-600 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* POLICY DETAIL DRAWER (360 VIEW)                          */}
      {/* ======================================================== */}
      {selectedPolicy && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Policy #{selectedPolicy.policy_number}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedPolicy.company_name} &bull; {selectedPolicy.plan_name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintCertificate(selectedPolicy)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                  title="Print Certificate"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDownloadCertificate(selectedPolicy)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                  title="Download Certificate"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedPolicy(null)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Action Bar in Drawer */}
            <div className="px-6 py-2.5 bg-slate-100/60 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
              {canMutate && (
                <button
                  onClick={() => openEditModal(selectedPolicy)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}
              {canMutate && (
                <button
                  onClick={() => openRenewalModal(selectedPolicy)}
                  className="px-3 py-1.5 text-xs font-semibold bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 text-amber-800 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Renew</span>
                </button>
              )}
              {canMutate && (
                <button
                  onClick={() => openStatusModal(selectedPolicy)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Status</span>
                </button>
              )}
              {canMutate && (
                <button
                  onClick={() => openPaymentModal(null, selectedPolicy.id)}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 text-emerald-800 flex items-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Add Payment</span>
                </button>
              )}
              {canMutate && (
                <button
                  onClick={() => openManageNomineesModal(selectedPolicy)}
                  className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 text-indigo-800 flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Nominees</span>
                </button>
              )}
              <button
                onClick={() => {
                  setDrawerActiveTab("documents");
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Documents</span>
              </button>
              <button
                onClick={() => {
                  setDrawerActiveTab("audit");
                  fetchPolicyAuditLogs(selectedPolicy.id);
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Audit History</span>
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-100 overflow-x-auto">
              <button
                onClick={() => setDrawerActiveTab("overview")}
                className={`pb-2 text-xs font-bold border-b-2 transition-colors ${
                  drawerActiveTab === "overview"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setDrawerActiveTab("members")}
                className={`pb-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1 ${
                  drawerActiveTab === "members"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Insured Members</span>
                <span className="px-1.5 py-0.2 bg-slate-100 rounded-full text-[10px]">
                  {selectedPolicy.members?.length || selectedPolicy.members_count || 0}
                </span>
              </button>
              <button
                onClick={() => setDrawerActiveTab("nominees")}
                className={`pb-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1 ${
                  drawerActiveTab === "nominees"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>Nominees</span>
                <span className="px-1.5 py-0.2 bg-slate-100 rounded-full text-[10px]">
                  {selectedPolicy.nominees?.length || 0}
                </span>
              </button>
              <button
                onClick={() => setDrawerActiveTab("schedules")}
                className={`pb-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1 ${
                  drawerActiveTab === "schedules"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>Schedules</span>
                <span className="px-1.5 py-0.2 bg-slate-100 rounded-full text-[10px]">
                  {selectedPolicy.schedules?.length || 0}
                </span>
              </button>
              <button
                onClick={() => setDrawerActiveTab("payments")}
                className={`pb-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1 ${
                  drawerActiveTab === "payments"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>Payments</span>
                <span className="px-1.5 py-0.2 bg-slate-100 rounded-full text-[10px]">
                  {selectedPolicy.payments?.length || 0}
                </span>
              </button>
              <button
                onClick={() => setDrawerActiveTab("commissions")}
                className={`pb-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1 ${
                  drawerActiveTab === "commissions"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>Commissions</span>
              </button>
              <button
                onClick={() => {
                  setDrawerActiveTab("documents");
                  fetchDrawerDocuments(selectedPolicy.id);
                }}
                className={`pb-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1 ${
                  drawerActiveTab === "documents"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Documents</span>
                {(drawerPolicyDocs.length > 0 || drawerPlanDocs.length > 0) && (
                  <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full text-[10px]">
                    {drawerPolicyDocs.length + drawerPlanDocs.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setDrawerActiveTab("audit");
                  fetchPolicyAuditLogs(selectedPolicy.id);
                }}
                className={`pb-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1 ${
                  drawerActiveTab === "audit"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Audit Trail</span>
                <span className="px-1.5 py-0.2 bg-slate-100 rounded-full text-[10px]">
                  {policyAuditLogs.length}
                </span>
              </button>
            </div>

            {/* Drawer Body Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {drawerActiveTab === "overview" && (
                <div className="space-y-6">
                  {/* Economics Cards (Phases 3, 4) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Sum Assured</span>
                      <p className="text-base font-bold text-slate-900 mt-0.5">
                        ₹{Number(selectedPolicy.sum_assured || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <span className="text-[10px] text-emerald-700 uppercase font-bold">Gross Premium (Total)</span>
                      <p className="text-base font-bold text-emerald-900 mt-0.5">
                        ₹{Number(selectedPolicy.gross_premium || selectedPolicy.final_premium || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl">
                      <span className="text-[10px] text-sky-700 uppercase font-bold">Net Base Premium</span>
                      <p className="text-base font-bold text-sky-900 mt-0.5">
                        ₹{Number(selectedPolicy.net_premium || selectedPolicy.final_premium || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                      <span className="text-[10px] text-purple-700 uppercase font-bold">GST / Tax Amount</span>
                      <p className="text-base font-bold text-purple-900 mt-0.5">
                        ₹{Number(selectedPolicy.tax_amount || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                      <span className="text-[10px] text-indigo-700 uppercase font-bold">Payment Mode</span>
                      <p className="text-base font-bold text-indigo-900 mt-0.5">
                        {selectedPolicy.premium_mode}
                      </p>
                    </div>
                    <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
                      <span className="text-[10px] text-teal-700 uppercase font-bold">Total Paid To Date</span>
                      <p className="text-base font-bold text-teal-900 mt-0.5">
                        ₹{Number(selectedPolicy.total_paid || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl">
                      <span className="text-[10px] text-violet-700 uppercase font-bold">Coverage Structure</span>
                      <p className="text-base font-bold text-violet-900 mt-0.5">
                        {selectedPolicy.coverage_type === "FAMILY_FLOATER" ? "Family Floater" : "Individual"}
                      </p>
                      <span className="text-[11px] text-violet-600 font-semibold">
                        {selectedPolicy.members?.length || selectedPolicy.members_count || 1} Covered {(selectedPolicy.members?.length || selectedPolicy.members_count || 1) === 1 ? "Person" : "Persons"}
                      </span>
                    </div>
                  </div>

                  {/* Excel Mapped Metadata: Business Type & Identification */}
                  <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-950 uppercase tracking-wider text-[11px]">Policy Identification &amp; Business Type</span>
                      <div className="flex items-center gap-2">
                        {selectedPolicy.business_type === "PORT" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            Portability Policy
                          </span>
                        ) : selectedPolicy.business_type === "RENEW" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Renewal Policy
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            New Business
                          </span>
                        )}
                        {selectedPolicy.proposal_number && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white text-slate-700 border border-slate-200">
                            Prop: {selectedPolicy.proposal_number}
                          </span>
                        )}
                      </div>
                    </div>

                    {selectedPolicy.business_type === "PORT" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-indigo-100 text-slate-700">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Previous Insurer</span>
                          <span className="font-semibold">{selectedPolicy.previous_insurer || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Previous Policy #</span>
                          <span className="font-mono font-semibold">{selectedPolicy.previous_policy_number || "N/A"}</span>
                        </div>
                        {selectedPolicy.portability_continuity_details && (
                          <div className="sm:col-span-2 text-[11px] bg-white/70 p-2 rounded-lg border border-indigo-100">
                            <span className="font-bold text-slate-700">Continuity: </span>
                            {selectedPolicy.portability_continuity_details}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedPolicy.business_type === "RENEW" && selectedPolicy.previous_policy_number && (
                      <div className="pt-2 border-t border-indigo-100 text-slate-700">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Renewed From Prior Policy #</span>
                        <span className="font-mono font-semibold">{selectedPolicy.previous_policy_number}</span>
                      </div>
                    )}
                  </div>

                  {/* Category-Specific Product Parameters */}
                  {(selectedPolicy.policy_type === "MOTOR" || selectedPolicy.vehicle_registration_number || selectedPolicy.policy_type === "TRAVEL" || selectedPolicy.travel_destination || selectedPolicy.hospital_cash_benefit !== "NOT_APPLICABLE" || selectedPolicy.product_variant) && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                      <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                        {selectedPolicy.policy_type} Specific Parameters
                      </span>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {selectedPolicy.product_variant && (
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Product Variant</span>
                            <span className="font-semibold text-slate-800">{selectedPolicy.product_variant}</span>
                          </div>
                        )}

                        {/* Motor Details */}
                        {selectedPolicy.vehicle_registration_number && (
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Vehicle Reg #</span>
                            <span className="font-mono font-bold text-indigo-700">{selectedPolicy.vehicle_registration_number}</span>
                          </div>
                        )}
                        {selectedPolicy.vehicle_manufacturer && (
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Manufacturer</span>
                            <span className="font-semibold text-slate-800">{selectedPolicy.vehicle_manufacturer}</span>
                          </div>
                        )}
                        {selectedPolicy.vehicle_model && (
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Model</span>
                            <span className="font-semibold text-slate-800">{selectedPolicy.vehicle_model}</span>
                          </div>
                        )}
                        {selectedPolicy.vehicle_type && (
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Vehicle Type</span>
                            <span className="font-semibold text-slate-800">{selectedPolicy.vehicle_type}</span>
                          </div>
                        )}

                        {/* Travel Details */}
                        {selectedPolicy.travel_destination && (
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Destination</span>
                            <span className="font-semibold text-slate-800">{selectedPolicy.travel_destination}</span>
                          </div>
                        )}
                        {selectedPolicy.travel_type && (
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Travel Type</span>
                            <span className="font-semibold text-slate-800">{selectedPolicy.travel_type}</span>
                          </div>
                        )}

                        {/* Health Hospital Cash */}
                        {selectedPolicy.hospital_cash_benefit && selectedPolicy.hospital_cash_benefit !== "NOT_APPLICABLE" && (
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Hospital Cash</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              selectedPolicy.hospital_cash_benefit === "INCLUDED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-700"
                            }`}>
                              {selectedPolicy.hospital_cash_benefit}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Contact Snapshot */}
                  {(selectedPolicy.contact_mobile || selectedPolicy.contact_email || selectedPolicy.contact_city || selectedPolicy.contact_pincode) && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block mb-2">Policy Contact Snapshot</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Mobile</span>
                          <span className="font-semibold">{selectedPolicy.contact_mobile || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Email</span>
                          <span className="font-semibold truncate block" title={selectedPolicy.contact_email}>{selectedPolicy.contact_email || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">City</span>
                          <span className="font-semibold">{selectedPolicy.contact_city || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">PIN Code</span>
                          <span className="font-mono font-semibold">{selectedPolicy.contact_pincode || "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Commission Realization Snapshot */}
                  <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-950 uppercase tracking-wider text-[11px]">Commission Realization</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedPolicy.commission_received_status === "RECEIVED"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : selectedPolicy.commission_received_status === "NOT_RECEIVED"
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      }`}>
                        {selectedPolicy.commission_received_status || "PENDING"}
                      </span>
                    </div>

                    {selectedPolicy.commission_received_status === "RECEIVED" && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-100 text-slate-700">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Actual Received</span>
                          <span className="font-bold text-emerald-700">
                            ₹{Number(selectedPolicy.actual_commission_received_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Received Date</span>
                          <span className="font-semibold">{selectedPolicy.commission_received_date || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Bank Reference / UTR</span>
                          <span className="font-mono font-semibold">{selectedPolicy.commission_bank_reference || "N/A"}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stakeholders Info */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Customer Name:</span>
                      <span className="font-bold text-slate-900">{selectedPolicy.customer_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Customer Phone:</span>
                      <span className="font-mono text-slate-800">{selectedPolicy.customer_phone || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Purchase Party:</span>
                      <span className="font-medium text-slate-800">
                        {selectedPolicy.purchase_party_name || "Direct / Main Firm"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Assigned Sub-Agent:</span>
                      <span className="font-medium text-slate-800">
                        {selectedPolicy.sub_agent_name || "Direct Firm Sourced"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Term (Years):</span>
                      <span className="font-medium text-slate-800">{selectedPolicy.term_years}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Start Date:</span>
                      <span className="font-mono text-slate-700">
                        {selectedPolicy.policy_start_date || selectedPolicy.start_date}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Expiry Date:</span>
                      <span className="font-mono text-slate-700">{selectedPolicy.expiry_date}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">First Receipt Date:</span>
                      <span className="font-mono text-slate-700">
                        {selectedPolicy.first_receipt_date || "—"}
                      </span>
                    </div>
                    {selectedPolicy.notes && (
                      <div className="pt-2 border-t border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Notes:</span>
                        <p className="text-slate-700 mt-0.5 whitespace-pre-wrap">{selectedPolicy.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Selected Riders & Add-on Covers */}
                  <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200/80 space-y-3 text-xs shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-amber-600" />
                        <span className="font-bold text-amber-950 uppercase tracking-wider text-[11px]">
                          Attached Riders &amp; Add-on Covers ({selectedPolicy.selected_riders?.length || (Array.isArray(selectedPolicy.riders) ? selectedPolicy.riders.length : 0)})
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-800 font-semibold bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                        Active Policy Add-ons
                      </span>
                    </div>

                    {((selectedPolicy.selected_riders && selectedPolicy.selected_riders.length > 0) ||
                      (Array.isArray(selectedPolicy.riders) && selectedPolicy.riders.length > 0)) ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {(selectedPolicy.selected_riders && selectedPolicy.selected_riders.length > 0
                          ? selectedPolicy.selected_riders
                          : selectedPolicy.riders
                        ).map((r, rIdx) => {
                          const rName = typeof r === "object" ? (r.rider_name || r.name) : String(r);
                          const rDesc = typeof r === "object" ? (r.rider_description || r.description) : null;
                          return (
                            <div
                              key={r.id || rIdx}
                              className="p-2.5 rounded-lg bg-white border border-amber-200 shadow-2xs"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-slate-900">{rName}</span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800 shrink-0">
                                  Covered
                                </span>
                              </div>
                              {rDesc && (
                                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                                  {rDesc}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic py-1">
                        No optional riders or add-on covers selected for this policy contract.
                      </p>
                    )}
                  </div>

                  {/* Plan Coverage Benefits Highlights */}
                  {Array.isArray(selectedPolicy.plan_benefits) && selectedPolicy.plan_benefits.length > 0 && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                            Base Plan Coverage Highlights ({selectedPolicy.plan_benefits.length})
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">Included in base plan</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {selectedPolicy.plan_benefits.map((b, bIdx) => (
                          <div
                            key={b.id || bIdx}
                            className="p-2 rounded-lg bg-white border border-slate-200 text-xs flex items-start gap-2"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-slate-900 block">{b.name}</span>
                              {b.description && (
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{b.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Phase 1: Interactive Multi-Year Policy Renewal Lifecycle Timeline */}
                  <div className="space-y-3 pt-3 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                        <span>Policy Renewal Lifecycle ({policyLifecycleTimeline.length} Connected Contracts)</span>
                      </h4>
                      {selectedPolicy.business_type === "RENEW" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Renewal Contract
                        </span>
                      )}
                    </div>

                    {lifecycleLoading ? (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                        <span>Tracing policy contract lifecycle...</span>
                      </div>
                    ) : policyLifecycleTimeline.length > 0 ? (
                      <div className="space-y-2">
                        {policyLifecycleTimeline.map((node, idx) => (
                          <div
                            key={node.policy_id || idx}
                            className={`p-3.5 rounded-xl border transition-all ${
                              node.is_current
                                ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20 shadow-xs"
                                : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${node.is_current ? "bg-amber-500 animate-pulse" : "bg-slate-400"}`} />
                                <span className="font-bold text-slate-900">{node.sequence_label}</span>
                                {node.is_current && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500 text-white rounded">
                                    Viewing Now
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-bold text-slate-800">{node.policy_number}</span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100">
                              <div>
                                <span className="text-slate-400 block text-[9px] uppercase font-bold">Issue Year</span>
                                <span className="font-semibold text-indigo-700 font-mono">
                                  {node.issue_year ? `ISSUED ${node.issue_year}` : (node.issue_date ? formatDateDDMMYYYY(node.issue_date) : "—")}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[9px] uppercase font-bold">Term Period</span>
                                <span className="font-medium text-slate-700">{node.start_date} to {node.expiry_date}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[9px] uppercase font-bold">Gross Premium</span>
                                <span className="font-bold text-emerald-700">₹{Number(node.gross_premium || 0).toLocaleString("en-IN")}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Status</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    node.status === 'ACTIVE'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : node.status === 'EXPIRED'
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-amber-50 text-amber-700'
                                  }`}>
                                    {node.status}
                                  </span>
                                </div>
                                {!node.is_current && node.policy_id && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const polRes = await api.insurance.getPolicy(node.policy_id);
                                      if (polRes.ok && polRes.data) {
                                        openPolicyDetail(polRes.data);
                                      }
                                    }}
                                    className="px-2 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                                  >
                                    Inspect &rarr;
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                        Single original policy contract. No prior or subsequent renewal contracts recorded.
                      </div>
                    )}
                  </div>

                  {/* Policy History Chain & Continuity Timeline */}
                  {((selectedPolicy.policy_history && selectedPolicy.policy_history.length > 0) || (selectedPolicy.business_type && selectedPolicy.business_type !== "NEW")) && (
                    <div className="space-y-3 pt-3 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Historical Policy Chain &amp; Continuity Timeline</span>
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {selectedPolicy.business_type === "PORT" ? "Portability Transfer" : "Contract Renewal"}
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {/* Current Policy Node */}
                        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              Current Policy (Year 0)
                            </span>
                            <span className="font-mono font-bold text-emerald-800">{selectedPolicy.policy_number}</span>
                          </div>
                          <p className="text-[11px] text-emerald-700 mt-1">
                            {selectedPolicy.company_name} &bull; ₹{Number(selectedPolicy.sum_assured || 0).toLocaleString("en-IN")} Sum Insured &bull; {selectedPolicy.policy_start_date} to {selectedPolicy.expiry_date}
                          </p>
                        </div>

                        {/* Historical Policy Nodes */}
                        {(selectedPolicy.policy_history && selectedPolicy.policy_history.length > 0) ? (
                          selectedPolicy.policy_history.map((hist) => (
                            <div key={hist.id || hist.history_sequence} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                  {hist.history_sequence === 1 ? "Last Year's Policy (Sequence 1)" : hist.history_sequence === 2 ? "Last-to-Last Year's Policy (Sequence 2)" : `Earlier History (Sequence ${hist.history_sequence})`}
                                </span>
                                <span className="font-mono font-bold text-indigo-700">{hist.previous_policy_number || "—"}</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 pt-1">
                                <div><span className="text-slate-400">Insurer:</span> <strong className="text-slate-700">{hist.insurance_company_name || "—"}</strong></div>
                                <div><span className="text-slate-400">Sum Insured:</span> <strong className="text-slate-700">₹{Number(hist.sum_insured || 0).toLocaleString("en-IN")}</strong></div>
                                <div><span className="text-slate-400">Gross Premium:</span> <strong className="text-slate-700">₹{Number(hist.gross_premium || 0).toLocaleString("en-IN")}</strong></div>
                                <div><span className="text-slate-400">Period:</span> {hist.policy_start_date || "—"} to {hist.policy_expiry_date || "—"}</div>
                                <div><span className="text-slate-400">Claims:</span> <strong className="text-slate-700">{hist.claim_history || "NO_CLAIM"}</strong></div>
                                <div><span className="text-slate-400">NCB / Bonus:</span> {hist.cumulative_bonus || "—"}</div>
                              </div>
                              {hist.continuity_details && (
                                <div className="text-[11px] bg-white p-2 rounded-lg border border-slate-200 mt-1">
                                  <span className="font-semibold text-indigo-900">Continuity:</span> <span className="text-slate-700">{hist.continuity_details}</span>
                                </div>
                              )}
                              {hist.waiting_period_waiver_details && (
                                <div className="text-[11px] bg-white p-2 rounded-lg border border-slate-200 mt-1">
                                  <span className="font-semibold text-emerald-900">Waiting Period Waiver:</span> <span className="text-slate-700">{hist.waiting_period_waiver_details}</span>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">Prior Contract (Sequence 1)</span>
                              <span className="font-mono font-bold text-indigo-700">{selectedPolicy.previous_policy_number || "—"}</span>
                            </div>
                            <p className="text-[11px] text-slate-600">Insurer: {selectedPolicy.previous_insurer || "—"}</p>
                            {selectedPolicy.portability_continuity_details && (
                              <p className="text-[11px] text-indigo-700">{selectedPolicy.portability_continuity_details}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {drawerActiveTab === "members" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Insured Persons &amp; Covered Lives
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        Coverage Type:{" "}
                        <strong className="text-slate-800">
                          {selectedPolicy.coverage_type === "FAMILY_FLOATER" ? "Family Floater" : "Individual"}
                        </strong>
                      </span>
                    </div>
                    {canMutate && (
                      <button
                        onClick={() => setDrawerAddMemberOpen(!drawerAddMemberOpen)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{drawerAddMemberOpen ? "Close Form" : "+ Add Member"}</span>
                      </button>
                    )}
                  </div>

                  {/* Floater / Individual Information Banner */}
                  {selectedPolicy.coverage_type === "FAMILY_FLOATER" ? (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                      <div className="font-bold flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-amber-600" />
                        <span>Shared Family Floater Coverage: Rs.{Number(selectedPolicy.sum_assured || 0).toLocaleString("en-IN")}</span>
                      </div>
                      <p className="text-[11px] text-amber-700 mt-1">
                        All covered family members share a single pool of Rs.{Number(selectedPolicy.sum_assured || 0).toLocaleString("en-IN")}. Claims by any member reduce the remaining floater sum insured available for the entire household.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-xs">
                      <div className="font-bold flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-indigo-600" />
                        <span>Individual Policy Coverage</span>
                      </div>
                      <p className="text-[11px] text-indigo-700 mt-1">
                        Each covered person has their own independent Sum Insured allocation.
                      </p>
                    </div>
                  )}

                  {/* Inline Add Member Form in Drawer */}
                  {drawerAddMemberOpen && (
                    <form onSubmit={handleDrawerAddMemberSubmit} className="p-4 bg-white rounded-xl border border-indigo-200 shadow-xs space-y-3">
                      <h5 className="text-xs font-bold text-indigo-900">Add Insured Member to this Policy</h5>
                      {drawerMemberError && (
                        <div className="p-2 text-xs bg-rose-50 text-rose-700 rounded-lg">{formatErrorMsg(drawerMemberError)}</div>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Full Name *</label>
                          <input
                            type="text"
                            required
                            value={drawerNewMember.full_name}
                            onChange={(e) => setDrawerNewMember({ ...drawerNewMember, full_name: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Relationship *</label>
                          <select
                            value={drawerNewMember.relationship}
                            onChange={(e) => setDrawerNewMember({ ...drawerNewMember, relationship: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                          >
                            {RELATIONSHIP_OPTIONS.map((rel) => (
                              <option key={rel} value={rel}>{rel}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Date of Birth</label>
                          <DatePicker
                            value={drawerNewMember.date_of_birth}
                            onChange={(e) => setDrawerNewMember({ ...drawerNewMember, date_of_birth: e.target.value })}
                            maxDate={getTodayIso()}
                            placeholder="DD-MM-YYYY"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Gender</label>
                          <select
                            value={drawerNewMember.gender}
                            onChange={(e) => setDrawerNewMember({ ...drawerNewMember, gender: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                          >
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        {selectedPolicy.coverage_type !== "FAMILY_FLOATER" && (
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Sum Insured (Rs.)</label>
                            <input
                              type="number"
                              value={drawerNewMember.individual_sum_insured}
                              onChange={(e) => setDrawerNewMember({ ...drawerNewMember, individual_sum_insured: e.target.value })}
                              placeholder={String(selectedPolicy.sum_assured || 500000)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                            />
                          </div>
                        )}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Mobile Number</label>
                          <input
                            type="tel"
                            value={drawerNewMember.mobile_number}
                            onChange={(e) => setDrawerNewMember({ ...drawerNewMember, mobile_number: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setDrawerAddMemberOpen(false)}
                          className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={drawerMemberSubmitting}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                        >
                          {drawerMemberSubmitting ? "Saving..." : "Add Member"}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Members List */}
                  {(!selectedPolicy.members || selectedPolicy.members.length === 0) ? (
                    <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-semibold">No member records attached to this contract.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedPolicy.members.map((mem, i) => {
                        const isFloater = selectedPolicy.coverage_type === "FAMILY_FLOATER";
                        const memAge = mem.age ?? calculateAge(mem.date_of_birth);
                        return (
                          <div
                            key={mem.id || i}
                            className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900">{mem.full_name}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                  {mem.relationship}
                                </span>
                                {memAge !== null && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    {memAge} yrs
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {isFloater ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Shared Floater Limit
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-800">
                                    Rs.{Number(mem.individual_sum_insured || selectedPolicy.sum_assured || 0).toLocaleString("en-IN")}
                                  </span>
                                )}
                                {canMutate && selectedPolicy.members.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMemberFromPolicy(selectedPolicy.id, mem.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                    title="Remove member from policy"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-600">
                              <div>
                                <span className="text-slate-400">Gender: </span>
                                <span className="font-semibold">{mem.gender || "-"}</span>
                              </div>
                              <div>
                                <span className="text-slate-400">DOB: </span>
                                <span className="font-mono">{mem.date_of_birth || "-"}</span>
                              </div>
                              <div>
                                <span className="text-slate-400">Member ID / Code: </span>
                                <span className="font-mono font-semibold">{mem.member_code || "-"}</span>
                              </div>
                              <div>
                                <span className="text-slate-400">Mobile: </span>
                                <span className="font-mono">{mem.mobile_number || "-"}</span>
                              </div>
                              <div>
                                <span className="text-slate-400">Email: </span>
                                <span>{mem.email || "-"}</span>
                              </div>
                              {mem.notes && (
                                <div className="col-span-2 sm:col-span-3 pt-1 border-t border-slate-200 text-[11px]">
                                  <span className="text-slate-400">Notes / Medical: </span>
                                  <span className="text-slate-700">{mem.notes}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {drawerActiveTab === "nominees" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Designated Policy Nominees
                    </h4>
                    {canMutate && (
                      <button
                        onClick={() => openManageNomineesModal(selectedPolicy)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Manage Nominees</span>
                      </button>
                    )}
                  </div>

                  {(!selectedPolicy.nominees || selectedPolicy.nominees.length === 0) ? (
                    <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-semibold">No nominees registered for this contract.</p>
                      {canMutate && (
                        <button
                          onClick={() => openManageNomineesModal(selectedPolicy)}
                          className="mt-2 px-3 py-1 text-xs font-bold text-indigo-600 hover:underline"
                        >
                          + Add Nominee
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedPolicy.nominees.map((nom, i) => (
                        <div
                          key={nom.id || i}
                          className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-900">{nom.full_name}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                              {nom.share_percentage}% Share
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-slate-600">
                            <div>
                              <span className="text-slate-400">Relationship: </span>
                              <span className="font-semibold">{nom.relationship}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">DOB: </span>
                              <span className="font-mono">{nom.date_of_birth || "—"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Mobile: </span>
                              <span className="font-mono">{nom.mobile_number || "—"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Address: </span>
                              <span>{nom.address || "—"}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {drawerActiveTab === "schedules" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Installment Premium Schedule
                    </h4>
                    <span className="text-xs text-slate-400">
                      {selectedPolicy.schedules?.length || 0} installments
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-600">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Due Date</th>
                          <th className="p-2.5">Amount</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedPolicy.schedules?.map((sch) => (
                          <tr key={sch.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono text-slate-500">#{sch.installment_number}</td>
                            <td className="p-2.5 font-semibold text-slate-800">{sch.due_date}</td>
                            <td className="p-2.5 font-bold text-emerald-700">
                              ₹{Number(sch.installment_amount || sch.amount || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  sch.status === "PAID"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : sch.status === "OVERDUE"
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {sch.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-right">
                              {sch.status !== "PAID" && canMutate && (
                                <button
                                  onClick={() => openPaymentModal(sch, selectedPolicy.id)}
                                  className="px-2 py-0.5 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                                >
                                  Pay
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {drawerActiveTab === "payments" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Recorded Payment Transactions
                    </h4>
                    {canMutate && (
                      <button
                        onClick={() => openPaymentModal(null, selectedPolicy.id)}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Record Payment</span>
                      </button>
                    )}
                  </div>

                  {(!selectedPolicy.payments || selectedPolicy.payments.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">No payments recorded yet.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-600">
                          <tr>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Mode</th>
                            <th className="p-2.5">Reference #</th>
                            <th className="p-2.5">Amount</th>
                            <th className="p-2.5">Payment Proof</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedPolicy.payments?.map((pmt) => (
                            <tr key={pmt.id} className="hover:bg-slate-50">
                              <td className="p-2.5 text-slate-700">{pmt.payment_date}</td>
                              <td className="p-2.5 font-semibold text-slate-800">{pmt.payment_mode}</td>
                              <td className="p-2.5 font-mono text-slate-500">
                                {pmt.transaction_reference || "—"}
                              </td>
                              <td className="p-2.5 font-bold text-emerald-700">
                                ₹{Number(pmt.payment_amount || pmt.amount || 0).toLocaleString("en-IN")}
                              </td>
                              <td className="p-2.5">
                                {pmt.document_id ? (
                                  <button
                                    type="button"
                                    onClick={() => api.insurance.downloadPolicyDocument(selectedPolicy.id, pmt.document_id, pmt.document_filename || "payment_proof.pdf")}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-[11px] font-medium transition-colors"
                                    title="Download Payment Proof"
                                  >
                                    <FileText className="w-3 h-3 text-indigo-600" />
                                    <span className="truncate max-w-[120px]">{pmt.document_filename || "Proof"}</span>
                                    <Download className="w-2.5 h-2.5 ml-0.5" />
                                  </button>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {drawerActiveTab === "commissions" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <BadgeIndianRupee className="w-4 h-4 text-emerald-600" />
                        <span>Two-Stage Commission Accounting</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Separation of Stage 1 Carrier Receivable and Stage 2 Sub-Agent Payable.
                      </p>
                    </div>
                  </div>

                  {(!selectedPolicy.commissions || selectedPolicy.commissions.length === 0) ? (
                    <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                      No commission records linked to this policy contract.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedPolicy.commissions?.map((c) => {
                        const netPrem = Number(c.net_premium_applied || selectedPolicy.net_premium || selectedPolicy.final_premium || 0);
                        const grossComm = Number(c.gross_commission_amount || 0);
                        const tdsAmt = Number(c.tds_amount || (grossComm * 0.10));
                        const netRec = Number(c.net_commission_payable || (grossComm - tdsAmt));
                        const actRcvd = Number(c.actual_net_received || 0);
                        const balRec = c.balance_receivable !== null && c.balance_receivable !== undefined
                          ? Number(c.balance_receivable)
                          : Math.max(0, netRec - actRcvd);

                        const hasAgent = Boolean(c.sub_agent_id || selectedPolicy.sub_agent_id);
                        const agentGross = Number(c.sub_agent_amount || 0);
                        const agentTds = Number(c.sub_agent_tds_amount || (agentGross * 0.05));
                        const agentNet = Number(c.sub_agent_net_payout || (agentGross - agentTds));

                        return (
                          <div key={c.id} className="space-y-3">
                            {/* STAGE 1: INSURER COMMISSION RECEIVABLE */}
                            <div className="p-4 bg-gradient-to-br from-blue-50/40 via-white to-blue-50/20 border border-blue-200 rounded-2xl shadow-2xs space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                                  <span className="text-xs font-black uppercase tracking-wider text-blue-950">
                                    Stage 1: Carrier Commission Receivable
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800">
                                    {c.commission_type || "FIRST_YEAR"}
                                  </span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  {c.status}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <div className="p-2 bg-white rounded-xl border border-slate-200">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Net Premium</span>
                                  <span className="font-bold text-slate-800 font-mono">₹{netPrem.toLocaleString("en-IN")}</span>
                                </div>
                                <div className="p-2 bg-white rounded-xl border border-slate-200">
                                  <span className="text-[10px] text-indigo-600 font-bold uppercase block">Gross Comm ({Number(c.gross_commission_rate || 0).toFixed(1)}%)</span>
                                  <span className="font-bold text-indigo-900 font-mono">₹{grossComm.toLocaleString("en-IN")}</span>
                                </div>
                                <div className="p-2 bg-white rounded-xl border border-slate-200">
                                  <span className="text-[10px] text-rose-600 font-bold uppercase block">TDS 194D (10%)</span>
                                  <span className="font-bold text-rose-700 font-mono">-₹{tdsAmt.toLocaleString("en-IN")}</span>
                                </div>
                                <div className="p-2 bg-blue-50 rounded-xl border border-blue-200">
                                  <span className="text-[10px] text-blue-700 font-bold uppercase block">Net Receivable</span>
                                  <span className="font-black text-blue-950 font-mono">₹{netRec.toLocaleString("en-IN")}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs pt-1 border-t border-blue-100">
                                <div className="flex items-center gap-4 text-[11px]">
                                  <span className="text-slate-600">Bank Received: <strong className="text-emerald-700 font-mono">₹{actRcvd.toLocaleString("en-IN")}</strong></span>
                                  <span className="text-slate-600">Balance Due: <strong className="text-amber-800 font-mono">₹{balRec.toLocaleString("en-IN")}</strong></span>
                                </div>
                                <a
                                  href={`/commissions?tab=insurer_receivables&search=${selectedPolicy.policy_number}`}
                                  className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 hover:underline"
                                >
                                  <span>View in Ledger</span>
                                  <ArrowRight className="w-3 h-3" />
                                </a>
                              </div>
                            </div>

                            {/* STAGE 2: SUB-AGENT COMMISSION PAYABLE */}
                            <div className="p-4 bg-gradient-to-br from-teal-50/40 via-white to-teal-50/20 border border-teal-200 rounded-2xl shadow-2xs space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-teal-600" />
                                  <span className="text-xs font-black uppercase tracking-wider text-teal-950">
                                    Stage 2: Sub-Agent Commission Payable
                                  </span>
                                </div>
                                {hasAgent && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                                    {c.status === "REVERSED" ? "REVERSED" : (c.sub_agent_net_payout && Number(c.sub_agent_net_payout) > 0 ? "ALLOCATED" : "PENDING")}
                                  </span>
                                )}
                              </div>

                              {hasAgent ? (
                                <>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Sub-Agent</span>
                                      <span className="font-bold text-slate-900 truncate block">{c.sub_agent_name || selectedPolicy.sub_agent_name || "Agent"}</span>
                                    </div>
                                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                                      <span className="text-[10px] text-teal-700 font-bold uppercase block">Agent Gross Share</span>
                                      <span className="font-bold text-teal-900 font-mono">₹{agentGross.toLocaleString("en-IN")}</span>
                                    </div>
                                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                                      <span className="text-[10px] text-rose-600 font-bold uppercase block">TDS 194H (5%)</span>
                                      <span className="font-bold text-rose-700 font-mono">-₹{agentTds.toLocaleString("en-IN")}</span>
                                    </div>
                                    <div className="p-2 bg-teal-50 rounded-xl border border-teal-200">
                                      <span className="text-[10px] text-teal-700 font-bold uppercase block">Net Payout Due</span>
                                      <span className="font-black text-teal-950 font-mono">₹{agentNet.toLocaleString("en-IN")}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between text-xs pt-1 border-t border-teal-100">
                                    <span className="text-[11px] text-slate-500">
                                      Split Rule: {c.split_rule_applied || "Signed Sub-Agent Split"}
                                    </span>
                                    <a
                                      href={`/commissions?tab=subagent_payouts&search=${selectedPolicy.policy_number}`}
                                      className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 hover:underline"
                                    >
                                      <span>Manage Payout →</span>
                                    </a>
                                  </div>
                                </>
                              ) : (
                                <div className="p-3 bg-slate-50/80 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                                  <span>Direct In-House Policy (No Sub-Agent Assigned). 100% of net commission retained by FinNexus.</span>
                                  <span className="font-mono font-bold text-emerald-700">Firm Net: ₹{netRec.toLocaleString("en-IN")}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                              <span>Source: {c.calculation_source || "AGREEMENT_RULE"}</span>
                              <span>Recorded: {c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN") : "—"}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Policy Documents Tab */}
              {drawerActiveTab === "documents" && (
                <div className="space-y-6">
                  {/* Header & Quick Actions */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Policy Documents &amp; Certificates
                      </h4>
                      <p className="text-xs text-slate-500">
                        Manage official certificates, customer attachments, and inherited policy plan documents.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fetchDrawerDocuments(selectedPolicy.id)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                        title="Refresh Documents"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${drawerDocsLoading ? "animate-spin text-indigo-600" : ""}`} />
                      </button>
                      {canMutate && (
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerUploadOpen(!drawerUploadOpen);
                            setDrawerUploadError("");
                          }}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>+ Upload Policy Document</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Section 0: FinNexus Official Certificate Generation */}
                  <div className="p-4 bg-gradient-to-r from-indigo-50/70 to-purple-50/50 rounded-xl border border-indigo-100 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>Official Policy Certificate</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700">
                            SYSTEM GENERATED
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Certificate # CERT-{selectedPolicy.policy_number} &bull; Verified &amp; Signed
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePrintCertificate(selectedPolicy)}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-xs"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>
                      <button
                        onClick={() => handleDownloadCertificate(selectedPolicy)}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Upload Form */}
                  {drawerUploadOpen && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-indigo-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Upload Policy Document</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDrawerUploadOpen(false)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {drawerUploadError && (
                        <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{formatErrorMsg(drawerUploadError)}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Document Category <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={drawerUploadType}
                            onChange={(e) => setDrawerUploadType(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                          >
                            {POLICY_DOCUMENT_TYPES.map((dt) => (
                              <option key={dt} value={dt}>
                                {dt}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Document Title <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Client KYC Pan Card, Signed Proposal"
                            value={drawerUploadTitle}
                            onChange={(e) => setDrawerUploadTitle(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Select File <span className="text-rose-500">*</span>
                          </label>
                          <input
                            ref={drawerUploadFileRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setDrawerUploadFile(e.target.files[0]);
                                if (!drawerUploadTitle.trim()) {
                                  const fname = e.target.files[0].name.replace(/\.[^/.]+$/, "");
                                  setDrawerUploadTitle(fname);
                                }
                              }
                            }}
                            className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                          />
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Max 25MB)
                          </p>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Description / Notes (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Verified on issuance"
                            value={drawerUploadDesc}
                            onChange={(e) => setDrawerUploadDesc(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => setDrawerUploadOpen(false)}
                          className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={drawerUploadLoading}
                          onClick={handleDrawerUploadDoc}
                          className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                        >
                          {drawerUploadLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          <span>Upload Document</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Section 1: Policy-Specific Documents */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Policy-Specific Documents
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          POLICY DOCUMENT
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          ({drawerPolicyDocs.length})
                        </span>
                      </div>
                    </div>

                    {drawerDocsLoading && drawerPolicyDocs.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        <span>Loading policy documents...</span>
                      </div>
                    ) : drawerPolicyDocs.length > 0 ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                            <tr>
                              <th className="py-2.5 px-3">Document Title</th>
                              <th className="py-2.5 px-3">Category</th>
                              <th className="py-2.5 px-3">File / Size</th>
                              <th className="py-2.5 px-3">Uploaded</th>
                              <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {drawerPolicyDocs.map((doc) => (
                              <tr key={doc.id} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-3 font-medium text-slate-900">
                                  <div>{doc.title}</div>
                                  {doc.description && (
                                    <div className="text-[11px] text-slate-400 font-normal">{doc.description}</div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getPolicyDocBadgeClass(
                                      doc.document_type
                                    )}`}
                                  >
                                    {doc.document_type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-mono text-[11px] text-slate-700 truncate max-w-xs">
                                    {doc.original_filename}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {formatDocBytes(doc.file_size_bytes)}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                  <div>{new Date(doc.created_at).toLocaleDateString("en-IN")}</div>
                                  {doc.uploaded_by?.full_name && (
                                    <div className="text-[10px] text-slate-400">By {doc.uploaded_by.full_name}</div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleViewPolicyDocBlob(doc)}
                                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-indigo-600"
                                      title="Preview Document"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadPolicyDoc(doc)}
                                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-indigo-600"
                                      title="Download Document"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                    {canMutate && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReplaceTargetDoc(doc);
                                          setReplaceError("");
                                        }}
                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-amber-50 text-slate-600 hover:text-amber-700"
                                        title="Replace Document File"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {canMutate && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDrawerDoc(doc.id)}
                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                                        title="Delete Document"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500 bg-slate-50/50">
                        <FileText className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-700">No policy-specific documents uploaded yet.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Upload official certificates, KYC IDs, proposal forms, or medical reports using the button above.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Section 2: Inherited Plan Documents (Read-Only) */}
                  <div className="space-y-3 pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Inherited Policy Plan Documents
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          FROM POLICY PLAN
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          ({drawerPlanDocs.length})
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Parent Plan: {selectedPolicy.plan_name || "Assigned Plan"} &bull; Read-only
                      </span>
                    </div>

                    {drawerDocsLoading && drawerPlanDocs.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                        <span>Loading plan documents...</span>
                      </div>
                    ) : drawerPlanDocs.length > 0 ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                            <tr>
                              <th className="py-2.5 px-3">Plan Document Title</th>
                              <th className="py-2.5 px-3">Document Category</th>
                              <th className="py-2.5 px-3">Filename / Size</th>
                              <th className="py-2.5 px-3">Upload Date</th>
                              <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {drawerPlanDocs.map((pDoc) => (
                              <tr key={pDoc.id} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-3 font-medium text-slate-900">
                                  <div>{pDoc.title}</div>
                                  {pDoc.description && (
                                    <div className="text-[11px] text-slate-400 font-normal">{pDoc.description}</div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                                    {pDoc.document_type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-mono text-[11px] text-slate-700 truncate max-w-xs">
                                    {pDoc.original_filename}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {formatDocBytes(pDoc.file_size_bytes)}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                  <div>{new Date(pDoc.created_at).toLocaleDateString("en-IN")}</div>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleViewPlanDocBlob(pDoc)}
                                      className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-1 shadow-xs"
                                      title="Preview inherited plan document"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>Preview</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadPlanDoc(pDoc)}
                                      className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-1 shadow-xs"
                                      title="Download inherited plan document"
                                    >
                                      <Download className="w-3.5 h-3.5 text-emerald-600" />
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
                      <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500 bg-slate-50/50">
                        <FileText className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-700">No plan documents attached to this policy's plan.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Brochures, claim forms, and policy wordings attached to {selectedPolicy.plan_name || "the policy plan"} will automatically appear here.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Replace Document Modal */}
                  {replaceTargetDoc && (
                    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <RotateCcw className="w-4 h-4 text-indigo-600" />
                            <span>Replace Document File</span>
                          </h4>
                          <button
                            onClick={() => {
                              setReplaceTargetDoc(null);
                              setReplaceFile(null);
                              setReplaceError("");
                            }}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                          <div className="font-bold text-slate-800">{replaceTargetDoc.title}</div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Current file: {replaceTargetDoc.original_filename} ({formatDocBytes(replaceTargetDoc.file_size_bytes)})
                          </div>
                        </div>

                        {replaceError && (
                          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{formatErrorMsg(replaceError)}</span>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Select Replacement File <span className="text-rose-500">*</span>
                          </label>
                          <input
                            ref={replaceFileInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setReplaceFile(e.target.files[0]);
                              }
                            }}
                            className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setReplaceTargetDoc(null);
                              setReplaceFile(null);
                              setReplaceError("");
                            }}
                            className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={replaceLoading || !replaceFile}
                            onClick={() => handleReplaceDrawerDoc(replaceTargetDoc.id, replaceFile)}
                            className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                          >
                            {replaceLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>Confirm Replacement</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Policy Audit History & Lifecycle Trail Tab */}
              {drawerActiveTab === "audit" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Contract Audit &amp; Status Transition History
                    </h4>
                    <button
                      onClick={() => fetchPolicyAuditLogs(selectedPolicy.id)}
                      className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                      title="Refresh Audit History"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {policyAuditLoading ? (
                    <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      <span>Loading immutable audit records from PostgreSQL...</span>
                    </div>
                  ) : policyAuditLogs.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No audit records recorded yet.</p>
                  ) : (
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {policyAuditLogs.map((log) => (
                        <div key={log.id} className="relative">
                          <div className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white" />
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 px-2 py-0.5 rounded-md text-[10px] bg-indigo-100 text-indigo-800">
                                {log.action}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {log.created_at ? new Date(log.created_at).toLocaleString("en-IN") : "—"}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600">
                              By <span className="font-semibold text-slate-800">{log.actor_name}</span>
                              {log.actor_email && <span className="text-slate-400"> ({log.actor_email})</span>}
                            </div>
                            {log.state_delta && (
                              <div className="p-2 bg-white rounded-lg border border-slate-200 text-[10px] font-mono text-slate-600 overflow-x-auto">
                                <pre className="whitespace-pre-wrap">{JSON.stringify(log.state_delta, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Family Group Selective Load Modal (Phase 5) */}
      {familyGroupModalOpen && detectedFamilyGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <span>Load Family Members</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Group: <span className="font-semibold text-slate-800">{detectedFamilyGroup.group_name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFamilyGroupModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Select which family members to include under this policy contract:
            </p>

            <div className="max-h-64 overflow-y-auto space-y-2 divide-y divide-slate-100">
              {(detectedFamilyGroup.members || []).map((m, i) => {
                const isSelf = m.relationship?.toUpperCase() === "SELF";
                const memKey = m.customer_id || m.full_name;
                const isSelected = selectedFamilyMemberIds.includes(memKey);
                return (
                  <label
                    key={memKey || i}
                    className={`pt-2 flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${
                      isSelf ? "bg-slate-50/70" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        disabled={isSelf}
                        checked={isSelf || isSelected}
                        onChange={(e) => {
                          if (isSelf) return;
                          if (e.target.checked) {
                            setSelectedFamilyMemberIds([...selectedFamilyMemberIds, memKey]);
                          } else {
                            setSelectedFamilyMemberIds(selectedFamilyMemberIds.filter((k) => k !== memKey));
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{m.full_name}</span>
                          {isSelf && (
                            <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 text-[10px] rounded">
                              Primary Policyholder
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Relationship: <span className="font-medium text-slate-700">{m.relationship}</span>
                          {m.date_of_birth && ` • DOB: ${m.date_of_birth}`}
                          {m.gender && ` • ${m.gender}`}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFamilyGroupModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportFamilyMembers}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-2xs"
              >
                Import Selected Members
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2: Dedicated Inline Customer Creation Modal */}
      <InlineCustomerModal
        isOpen={inlineCustomerModalOpen}
        onClose={() => setInlineCustomerModalOpen(false)}
        onCustomerCreated={(newCust) => {
          handleSelectCustomerFromAutocomplete(newCust);
          setCustomers((prev) => [newCust, ...prev]);
        }}
      />

      {/* ======================================================== */}
      {/* SHORTCUT 1: ADD CUSTOMER MODAL                           */}
      {/* ======================================================== */}
      {shortcutCustomerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">+ Quick Customer Registration</h3>
              <button
                onClick={() => setShortcutCustomerOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomerShortcut} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Ananya Verma"
                  value={scCustomerName}
                  onChange={(e) => setScCustomerName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="10-digit mobile"
                  value={scCustomerPhone}
                  onChange={(e) => setScCustomerPhone(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="customer@domain.com"
                  value={scCustomerEmail}
                  onChange={(e) => setScCustomerEmail(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gender</label>
                <select
                  value={scCustomerGender}
                  onChange={(e) => setScCustomerGender(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShortcutCustomerOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scCustomerLoading}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  {scCustomerLoading ? "Saving..." : "Save & Select"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SHORTCUT 2: ADD COMPANY MODAL                            */}
      {/* ======================================================== */}
      {shortcutCompanyOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">+ Quick Company Master</h3>
              <button
                onClick={() => setShortcutCompanyOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCompanyShortcut} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Insurer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Star Health Insurance"
                  value={scCompanyName}
                  onChange={(e) => setScCompanyName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={scCompanyCategory}
                  onChange={(e) => setScCompanyCategory(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                >
                  {INSURANCE_CATEGORIES.map((cat) => (
                    <option key={cat.code} value={cat.label}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShortcutCompanyOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scCompanyLoading}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  {scCompanyLoading ? "Saving..." : "Save & Select"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SHORTCUT 3: ADD PLAN MODAL                               */}
      {/* ======================================================== */}
      {shortcutPlanOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">+ Quick Plan Master</h3>
              <button
                onClick={() => setShortcutPlanOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlanShortcut} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Parent Company <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={scPlanCompanyId}
                  onChange={(e) => setScPlanCompanyId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                >
                  <option value="">Select Insurer...</option>
                  {companies.map((co) => (
                    <option key={co.id} value={co.id}>
                      {co.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Plan Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Optima Restore Premier"
                  value={scPlanName}
                  onChange={(e) => setScPlanName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Policy Type
                </label>
                <select
                  value={scPlanType}
                  onChange={(e) => setScPlanType(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                >
                  {INSURANCE_CATEGORIES.map((cat) => (
                    <option key={cat.code} value={cat.label}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShortcutPlanOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scPlanLoading}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  {scPlanLoading ? "Saving..." : "Save & Select"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Edit Policy Contract                              */}
      {/* ======================================================== */}
      {editingPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Edit Policy: {editingPolicy.policy_number}
                </h3>
              </div>
              <button
                onClick={() => setEditingPolicy(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePolicy} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formatErrorMsg(editError)}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Policy Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editPolicyNumber}
                    onChange={(e) => setEditPolicyNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-bold"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="LAPSED">LAPSED</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Line of Business
                  </label>
                  <select
                    value={editPolicyType}
                    onChange={(e) => setEditPolicyType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                  >
                    {INSURANCE_CATEGORIES.map((cat) => (
                      <option key={cat.code} value={cat.code}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sum Assured (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editSumAssured}
                    onChange={(e) => setEditSumAssured(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Final Premium (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFinalPremium}
                    onChange={(e) => setEditFinalPremium(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Premium Mode
                  </label>
                  <select
                    value={editPremiumMode}
                    onChange={(e) => setEditPremiumMode(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="YEARLY">Yearly</option>
                    <option value="HALF_YEARLY">Half-Yearly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="SINGLE">Single</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Policy Term (Years)
                  </label>
                  <select
                    value={editTermYears}
                    onChange={(e) => {
                      setEditTermYears(e.target.value);
                      if (editStartDate) {
                        try {
                          const s = new Date(editStartDate);
                          s.setFullYear(s.getFullYear() + (parseInt(e.target.value, 10) || 1));
                          setEditExpiryDate(s.toISOString().split("T")[0]);
                        } catch (_) {}
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    <option value="1">1 Year</option>
                    <option value="2">2 Years</option>
                    <option value="3">3 Years</option>
                    <option value="4">4 Years</option>
                    {!["1", "2", "3", "4"].includes(String(editTermYears)) && editTermYears && (
                      <option value={editTermYears}>{editTermYears} Years (Historical / Custom)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expiry Date
                  </label>
                  <DatePicker
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Edit Modal: Optional Plan Riders Selection */}
              {editAvailablePlanRiders.length > 0 && (
                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-600" />
                      <span>Attached Plan Riders &amp; Add-on Covers</span>
                    </label>
                    <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                      {editSelectedRiderIds.length} Selected
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {editAvailablePlanRiders.map((r) => {
                      const isChecked = editSelectedRiderIds.some(
                        (id) => String(id) === String(r.id)
                      );
                      return (
                        <label
                          key={r.id}
                          className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer select-none transition-all ${
                            isChecked
                              ? "bg-amber-50/80 border-amber-300 ring-1 ring-amber-400/40"
                              : "bg-white border-slate-200 hover:border-amber-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleEditRider(r.id)}
                            className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 shrink-0 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <span
                              className={`text-xs block ${
                                isChecked ? "text-amber-950 font-bold" : "text-slate-800 font-medium"
                              }`}
                            >
                              {r.name}
                            </span>
                            {r.description && (
                              <p className="text-[10px] text-slate-500 leading-snug">
                                {r.description}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Policy Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional underwriting or service remarks..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPolicy(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {editSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
