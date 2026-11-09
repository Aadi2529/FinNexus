import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  Filter,
  Plus,
  RefreshCw,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ShieldCheck,
  Download,
  Upload,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  X,
  Eye,
  EyeOff,
  Building2,
  FileSpreadsheet,
  AlertTriangle,
  Lock,
  Unlock,
  Archive,
  RotateCcw,
  Tag,
  Briefcase,
  DollarSign,
  Heart,
  Globe,
  UserCheck,
  Check,
  Edit2,
} from "lucide-react";
import { insuranceAPI } from "../services/api";
import { useNotification } from "../context/NotificationContext";
import { DatePicker, FormInput } from "../components/common";
import {
  validateIndianMobile,
  validateEmail,
  validateName,
  validatePinCode,
  validatePan,
  validateAadhaar,
  validateGstin,
  validateDobNotFuture,
  getTodayIso,
} from "../utils/validation";

const OCCUPATIONS = [
  "Salaried",
  "Self-Employed",
  "Business Owner",
  "Doctor / Healthcare",
  "IT / Software Professional",
  "CA / Legal Consultant",
  "Civil Servant / Govt",
  "Student",
  "Homemaker",
  "Retired",
  "Other",
];

const INCOME_SOURCES = [
  "Salary",
  "Business Profits",
  "Professional Fees",
  "Investments & Dividends",
  "Rental Income",
  "Agriculture",
  "Inheritance",
  "Other",
];

export default function CustomersPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("directory"); // 'directory' | 'bulk_import'
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showSuccess, showError } = useNotification();
  const [actionSuccess, setActionSuccessState] = useState("");
  const setActionSuccess = (msg) => { setActionSuccessState(msg); if (msg) showSuccess(msg); };

  // Pagination & Filters
  const [search, setSearch] = useState("");
  const [customerType, setCustomerType] = useState("ALL");
  const [gender, setGender] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal State
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // 360 Drawer State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [drawerTab, setDrawerTab] = useState("overview"); // 'overview' | 'policies' | 'family' | 'documents'
  const [customerPolicies, setCustomerPolicies] = useState([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [customerFamilyGroup, setCustomerFamilyGroup] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [unmaskedKyc, setUnmaskedKyc] = useState(null);
  const [unmasking, setUnmasking] = useState(false);

  // Document Upload in Drawer
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState(null);
  const [docUploadSuccess, setDocUploadSuccess] = useState(false);

  // Form State
  const [formClientType, setFormClientType] = useState("INDIVIDUAL"); // 'INDIVIDUAL' | 'CORPORATE'
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    gender: "Male",
    enableBirthDate: false,
    birthDate: "",
    enableAnniversaryDate: false,
    anniversaryDate: "",
    maritalStatus: "Single",
    nationality: "Indian",
    occupation: "Salaried",
    sourceOfIncome: "Salary",
    state: "",
    city: "",
    address: "",
    pincode: "",
    panNumber: "",
    aadhaarNumber: "",
    // Corporate fields
    companyName: "",
    corporateCode: "",
    gstin: "",
    contactPersonName: "",
    contactPersonPhone: "",
    contactPersonEmail: "",
  });
  const [kycDoc1, setKycDoc1] = useState({ type: "AADHAAR", file: null });
  const [kycDoc2, setKycDoc2] = useState({ type: "PAN", file: null });

  // Bulk Import State
  const [importType, setImportType] = useState("INDIVIDUAL");
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);

  const searchTimeoutRef = useRef(null);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await insuranceAPI.getCustomers({
        search: search.trim() || undefined,
        customer_type: customerType,
        gender,
        page,
        page_size: pageSize,
      });
      if (res.ok && res.data) {
        setCustomers(res.data.items || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.total_pages || 1);
      } else {
        setError(res.error || "Failed to load customers.");
      }
    } catch (err) {
      setError("Network error fetching customers.");
    } finally {
      setLoading(false);
    }
  }, [search, customerType, gender, page, pageSize]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchCustomers();
    }, 300);
  };

  const openCreateModal = () => {
    setModalMode("create");
    setEditingCustomer(null);
    setFormClientType("INDIVIDUAL");
    resetForm();
  };

  const openEditModal = (cust) => {
    setModalMode("edit");
    setEditingCustomer(cust);
    const isCorp = cust.customer_type === "CORPORATE";
    setFormClientType(isCorp ? "CORPORATE" : "INDIVIDUAL");
    setFormData({
      firstName: cust.first_name || "",
      lastName: cust.last_name || "",
      phone: cust.phone || "",
      email: cust.email || "",
      gender: cust.gender || "Male",
      enableBirthDate: Boolean(cust.date_of_birth),
      birthDate: cust.date_of_birth ? cust.date_of_birth.slice(0, 10) : "",
      enableAnniversaryDate: Boolean(cust.anniversary_date),
      anniversaryDate: cust.anniversary_date ? cust.anniversary_date.slice(0, 10) : "",
      maritalStatus: cust.marital_status || "Single",
      nationality: cust.nationality || "Indian",
      occupation: cust.occupation || "Salaried",
      sourceOfIncome: cust.source_of_income || "Salary",
      state: cust.state || "",
      city: cust.city || "",
      address: cust.address || "",
      pincode: cust.pincode || "",
      panNumber: cust.pan_number || "",
      aadhaarNumber: cust.aadhaar_number || "",
      companyName: cust.company_name || "",
      corporateCode: cust.corporate_code || "",
      gstin: cust.gstin || "",
      contactPersonName: cust.contact_person_name || "",
      contactPersonPhone: cust.contact_person_phone || "",
      contactPersonEmail: cust.contact_person_email || "",
    });
    setKycDoc1({ type: isCorp ? "INCORPORATION_CERT" : "AADHAAR", file: null });
    setKycDoc2({ type: isCorp ? "GSTIN" : "PAN", file: null });
    setFormError(null);
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      gender: "Male",
      enableBirthDate: false,
      birthDate: "",
      enableAnniversaryDate: false,
      anniversaryDate: "",
      maritalStatus: "Single",
      nationality: "Indian",
      occupation: "Salaried",
      sourceOfIncome: "Salary",
      state: "",
      city: "",
      address: "",
      pincode: "",
      panNumber: "",
      aadhaarNumber: "",
      companyName: "",
      corporateCode: "",
      gstin: "",
      contactPersonName: "",
      contactPersonPhone: "",
      contactPersonEmail: "",
    });
    setKycDoc1({ type: formClientType === "CORPORATE" ? "INCORPORATION_CERT" : "AADHAAR", file: null });
    setKycDoc2({ type: formClientType === "CORPORATE" ? "GSTIN" : "PAN", file: null });
    setFormError(null);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setFormError(null);

    const isCorp = formClientType === "CORPORATE";

    // Strict Form validation
    if (isCorp) {
      const nameCheck = validateName(formData.companyName, "Corporate / Organization name", true);
      if (!nameCheck.isValid) {
        setFormError(nameCheck.error);
        return;
      }
      const phoneCheck = validateIndianMobile(formData.phone, "Corporate Contact Mobile", true);
      if (!phoneCheck.isValid) {
        setFormError(phoneCheck.error);
        return;
      }
      if (formData.gstin) {
        const gCheck = validateGstin(formData.gstin, "GSTIN", false);
        if (!gCheck.isValid) {
          setFormError(gCheck.error);
          return;
        }
      }
      if (formData.panNumber) {
        const panCheck = validatePan(formData.panNumber, "Entity PAN", false);
        if (!panCheck.isValid) {
          setFormError(panCheck.error);
          return;
        }
      }
      if (formData.contactPersonPhone) {
        const cpPhoneCheck = validateIndianMobile(formData.contactPersonPhone, "Contact Person Mobile", false);
        if (!cpPhoneCheck.isValid) {
          setFormError(cpPhoneCheck.error);
          return;
        }
      }
      if (formData.contactPersonEmail) {
        const cpEmailCheck = validateEmail(formData.contactPersonEmail, "Contact Person Email", false);
        if (!cpEmailCheck.isValid) {
          setFormError(cpEmailCheck.error);
          return;
        }
      }
    } else {
      const fnCheck = validateName(formData.firstName, "First Name", true);
      if (!fnCheck.isValid) {
        setFormError(fnCheck.error);
        return;
      }
      const lnCheck = validateName(formData.lastName, "Last Name", true);
      if (!lnCheck.isValid) {
        setFormError(lnCheck.error);
        return;
      }
      const phoneCheck = validateIndianMobile(formData.phone, "Mobile Number", true);
      if (!phoneCheck.isValid) {
        setFormError(phoneCheck.error);
        return;
      }
      if (formData.enableBirthDate && formData.birthDate) {
        const dobCheck = validateDobNotFuture(formData.birthDate, "Date of Birth", true);
        if (!dobCheck.isValid) {
          setFormError(dobCheck.error);
          return;
        }
      }
      if (formData.panNumber) {
        const panCheck = validatePan(formData.panNumber, "PAN", false);
        if (!panCheck.isValid) {
          setFormError(panCheck.error);
          return;
        }
      }
      if (formData.aadhaarNumber) {
        const aadhCheck = validateAadhaar(formData.aadhaarNumber, "Aadhaar Number", false);
        if (!aadhCheck.isValid) {
          setFormError(aadhCheck.error);
          return;
        }
      }
    }

    if (formData.email) {
      const emailCheck = validateEmail(formData.email, "Email Address", false);
      if (!emailCheck.isValid) {
        setFormError(emailCheck.error);
        return;
      }
    }

    if (formData.pincode) {
      const pinCheck = validatePinCode(formData.pincode, "PIN Code", false);
      if (!pinCheck.isValid) {
        setFormError(pinCheck.error);
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        customer_type: formClientType,
        first_name: isCorp ? (formData.companyName.trim()) : formData.firstName.trim(),
        last_name: isCorp ? "Entity" : formData.lastName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        gender: isCorp ? "CORPORATE" : formData.gender,
        date_of_birth: formData.enableBirthDate && formData.birthDate ? formData.birthDate : null,
        anniversary_date: formData.enableAnniversaryDate && formData.anniversaryDate ? formData.anniversaryDate : null,
        marital_status: isCorp ? null : formData.maritalStatus,
        nationality: formData.nationality.trim() || "Indian",
        state: formData.state.trim() || null,
        city: formData.city.trim() || null,
        address: formData.address.trim() || null,
        pincode: formData.pincode.trim() || null,
        occupation: isCorp ? null : formData.occupation,
        source_of_income: isCorp ? null : formData.sourceOfIncome,
        pan_number: formData.panNumber.trim() ? formData.panNumber.trim().toUpperCase() : null,
        aadhaar_number: isCorp ? null : (formData.aadhaarNumber.trim() || null),
        company_name: isCorp ? formData.companyName.trim() : null,
        corporate_code: isCorp && formData.corporateCode.trim() ? formData.corporateCode.trim().toUpperCase() : null,
        gstin: isCorp && formData.gstin.trim() ? formData.gstin.trim().toUpperCase() : null,
        contact_person_name: isCorp ? formData.contactPersonName.trim() || null : null,
        contact_person_phone: isCorp ? formData.contactPersonPhone.trim() || null : null,
        contact_person_email: isCorp ? formData.contactPersonEmail.trim().toLowerCase() || null : null,
      };

      let res;
      if (modalMode === "create") {
        res = await insuranceAPI.createCustomer(payload);
      } else {
        res = await insuranceAPI.updateCustomer(editingCustomer.id, payload);
      }

      if (!res.ok) {
        setFormError(res.error || "Failed to save customer record.");
        setSubmitting(false);
        return;
      }

      const savedCust = res.data;

      // Upload attached documents on creation
      if (modalMode === "create") {
        if (kycDoc1.file && savedCust.id) {
          await insuranceAPI.uploadCustomerKyc(savedCust.id, kycDoc1.type, kycDoc1.file);
        }
        if (kycDoc2.file && savedCust.id) {
          await insuranceAPI.uploadCustomerKyc(savedCust.id, kycDoc2.type, kycDoc2.file);
        }
      }

      setModalMode(null);
      resetForm();
      fetchCustomers();
      setActionSuccess(
        modalMode === "create"
          ? `Customer '${savedCust.full_name}' registered successfully.`
          : `Customer '${savedCust.full_name}' updated successfully.`
      );
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err) {
      setFormError(err.message || "Failed to complete customer registration.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleArchive = async (cust) => {
    const nextArchived = !cust.is_archived;
    const confirmMsg = nextArchived
      ? `Deactivate customer '${cust.full_name}'? Existing policies and history will remain safely preserved.`
      : `Reactivate customer '${cust.full_name}'?`;
    if (!window.confirm(confirmMsg)) return;

    const res = await insuranceAPI.toggleCustomerStatus(cust.id, nextArchived);
    if (res.ok) {
      setActionSuccess(`Customer '${cust.full_name}' is now ${nextArchived ? "Deactivated" : "Active"}.`);
      fetchCustomers();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      alert(res.error || "Failed to update customer status.");
    }
  };

  const openDrawer = async (cust) => {
    setSelectedCustomer(cust);
    setDrawerTab("overview");
    setUnmaskedKyc(null);
    setDocUploadError(null);
    setDocUploadSuccess(false);

    // Fetch policies
    setPoliciesLoading(true);
    try {
      const polRes = await insuranceAPI.getPolicies({ customer_id: cust.id, page_size: 50 });
      if (polRes.ok) {
        setCustomerPolicies(polRes.data.items || []);
      } else {
        setCustomerPolicies([]);
      }
    } catch {
      setCustomerPolicies([]);
    } finally {
      setPoliciesLoading(false);
    }

    // Fetch family groups
    setFamilyLoading(true);
    try {
      const fgRes = await insuranceAPI.getFamilyGroups();
      if (fgRes.ok && Array.isArray(fgRes.data)) {
        // Find if this customer is in any group
        const matched = fgRes.data.find(
          (g) =>
            g.primary_head_id === cust.id ||
            (g.members && g.members.some((m) => m.customer_id === cust.id))
        );
        setCustomerFamilyGroup(matched || null);
      } else {
        setCustomerFamilyGroup(null);
      }
    } catch {
      setCustomerFamilyGroup(null);
    } finally {
      setFamilyLoading(false);
    }
  };

  const handleUnmaskKyc = async () => {
    if (!selectedCustomer) return;
    if (unmaskedKyc) {
      setUnmaskedKyc(null); // Toggle off
      return;
    }
    setUnmasking(true);
    const res = await insuranceAPI.unmaskCustomerKyc(selectedCustomer.id);
    setUnmasking(false);
    if (res.ok) {
      setUnmaskedKyc(res.data);
    } else {
      alert(res.error || "Access denied. Manager or Admin authority required to unmask full KYC.");
    }
  };

  const handleUploadSingleDoc = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const form = e.target;
    const docType = form.doc_type.value;
    const file = form.file.files[0];
    if (!file) {
      setDocUploadError("Please select a file to upload.");
      return;
    }

    try {
      setUploadingDoc(true);
      setDocUploadError(null);
      const res = await insuranceAPI.uploadCustomerKyc(selectedCustomer.id, docType, file);
      if (res.ok) {
        setDocUploadSuccess(true);
        const updated = await insuranceAPI.getCustomer(selectedCustomer.id);
        if (updated.ok) setSelectedCustomer(updated.data);
        fetchCustomers();
        form.reset();
        setTimeout(() => setDocUploadSuccess(false), 3000);
      } else {
        setDocUploadError(res.error || "Upload failed.");
      }
    } catch {
      setDocUploadError("Upload network error.");
    } finally {
      setUploadingDoc(false);
    }
  };

  // ==========================================
  // BULK IMPORT WORKFLOW HANDLERS
  // ==========================================

  const handleDownloadTemplate = async (format) => {
    await insuranceAPI.downloadCustomerTemplate(importType, format);
  };

  const handlePreviewImport = async (e) => {
    e.preventDefault();
    if (!importFile) {
      setImportError("Please select a CSV or XLSX file to upload.");
      return;
    }

    setPreviewLoading(true);
    setImportError(null);
    setImportPreview(null);
    setImportResult(null);

    const res = await insuranceAPI.previewCustomerImport(importFile, importType);
    setPreviewLoading(false);

    if (res.ok && res.data) {
      setImportPreview(res.data);
    } else {
      setImportError(res.error || "Failed to parse and validate import spreadsheet.");
    }
  };

  const handleExecuteImport = async () => {
    if (!importPreview || !importPreview.rows) return;
    const validRows = importPreview.rows.filter((r) => r.is_valid).map((r) => r.data);
    if (validRows.length === 0) {
      alert("No valid rows available to import. Please resolve the errors in your spreadsheet.");
      return;
    }

    if (
      !window.confirm(
        `Confirm bulk import of ${validRows.length} valid ${importType.toLowerCase()} customer(s)?`
      )
    )
      return;

    setImportLoading(true);
    setImportError(null);

    const res = await insuranceAPI.confirmCustomerImport(validRows, importType);
    setImportLoading(false);

    if (res.ok && res.data) {
      setImportResult(res.data);
      fetchCustomers();
    } else {
      setImportError(res.error || "Import execution encountered a failure.");
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setImportPreview(null);
    setImportResult(null);
    setImportError(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-white via-indigo-50/25 to-white p-6 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500" />
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 mb-1">
            <div className="p-1 rounded-lg bg-indigo-100/80 text-indigo-700">
              <Users className="w-3.5 h-3.5" />
            </div>
            <span>Customer &amp; Proposal Portfolio</span>
            <span>&bull;</span>
            <span className="text-slate-500 font-medium">CRM Master Records</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <span>Customers &amp; Corporate Clients</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage individual insureds, corporate clients, AES encrypted KYC, and bulk spreadsheet onboarding.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tab Switcher */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => {
                setActiveTab("directory");
                resetImport();
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "directory" ? "bg-white text-indigo-700 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Customer Directory</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("bulk_import");
                resetImport();
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "bulk_import" ? "bg-white text-indigo-700 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Bulk Spreadsheet Import</span>
            </button>
          </div>

          {activeTab === "directory" && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-500/25 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Success Alert */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW A: CUSTOMER DIRECTORY                                                */}
      {/* ========================================================================= */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative md:col-span-2">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={handleSearchChange}
                  placeholder="Search by customer name, corporate entity, mobile, PAN, GSTIN..."
                  className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl border border-slate-200/90 bg-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 transition-colors font-medium"
                />
              </div>

              <div>
                <select
                  value={customerType}
                  onChange={(e) => {
                    setCustomerType(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200/90 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="ALL">Client Type: All Types</option>
                  <option value="INDIVIDUAL">Individual Customers</option>
                  <option value="CORPORATE">Corporate Clients</option>
                </select>
              </div>

              <div>
                <select
                  value={gender}
                  onChange={(e) => {
                    setGender(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200/90 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="ALL">Gender: All Genders</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Customers Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            {error && (
              <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-black text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Customer / Entity Name</th>
                    <th className="py-3 px-4">Client Type</th>
                    <th className="py-3 px-4">Contact Information</th>
                    <th className="py-3 px-4">KYC Credentials (Masked)</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Portfolio</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                        <span>Loading customer records...</span>
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700">No customers found</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {search ? "Try adjusting your search criteria" : "Register your first individual or corporate customer"}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => {
                      const isCorp = c.customer_type === "CORPORATE";
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Name & Corporate Code */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {isCorp ? (
                                <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              )}
                              <span>{c.full_name}</span>
                            </div>
                            {isCorp && c.corporate_code && (
                              <div className="font-mono text-[10px] text-purple-700 font-semibold mt-0.5">
                                Code: {c.corporate_code}
                              </div>
                            )}
                            {!isCorp && c.occupation && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {c.occupation}
                              </div>
                            )}
                          </td>

                          {/* Client Type Badge */}
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isCorp
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              }`}
                            >
                              {c.customer_type || "INDIVIDUAL"}
                            </span>
                          </td>

                          {/* Contact */}
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900">{c.phone}</div>
                            {c.email && <div className="text-[11px] text-slate-400 truncate max-w-xs">{c.email}</div>}
                          </td>

                          {/* Masked KYC */}
                          <td className="py-3 px-4 font-mono text-[11px]">
                            {c.pan_number && (
                              <div className="flex items-center gap-1 text-slate-700" title="Masked PAN">
                                <span className="text-[10px] text-slate-400 font-sans font-bold">PAN:</span>
                                <span>{c.pan_number}</span>
                              </div>
                            )}
                            {c.aadhaar_number && (
                              <div className="flex items-center gap-1 text-slate-500 mt-0.5" title="Masked Aadhaar">
                                <span className="text-[10px] text-slate-400 font-sans font-bold">AADH:</span>
                                <span>{c.aadhaar_number}</span>
                              </div>
                            )}
                            {isCorp && c.gstin && (
                              <div className="flex items-center gap-1 text-purple-700 mt-0.5" title="GSTIN">
                                <span className="text-[10px] text-slate-400 font-sans font-bold">GST:</span>
                                <span>{c.gstin}</span>
                              </div>
                            )}
                            {!c.pan_number && !c.aadhaar_number && !c.gstin && (
                              <span className="text-slate-400 italic">No KYC on file</span>
                            )}
                          </td>

                          {/* Location */}
                          <td className="py-3 px-4">
                            <span className="text-slate-700 font-medium">
                              {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                            </span>
                          </td>

                          {/* Policies & Docs */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-800" title="Active Policies">
                                {c.policies_count} policies
                              </span>
                              {c.documents?.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                  {c.documents.length} docs
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => handleToggleArchive(c)}
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                !c.is_archived
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                              }`}
                              title="Click to toggle status"
                            >
                              {!c.is_archived ? "ACTIVE" : "INACTIVE"}
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => navigate(`/customers/${c.id}`)}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                title="View Customer 360 Profile"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(c)}
                                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                title="Edit Customer Details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
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
                Page {page} of {totalPages} ({total} customers)
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW B: BULK CUSTOMER SPREADSHEET IMPORT                                   */}
      {/* ========================================================================= */}
      {activeTab === "bulk_import" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                  <span>Bulk Customer Import Suite</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Download standard spreadsheet templates, upload CSV or XLSX batches, preview validation checks, and import.
                </p>
              </div>

              {/* Individual / Corporate Target Switch */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setImportType("INDIVIDUAL");
                    resetImport();
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    importType === "INDIVIDUAL" ? "bg-white text-indigo-600 shadow-2xs font-bold" : "text-slate-600"
                  }`}
                >
                  Individual Template
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportType("CORPORATE");
                    resetImport();
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    importType === "CORPORATE" ? "bg-white text-purple-700 shadow-2xs font-bold" : "text-slate-600"
                  }`}
                >
                  Corporate Template
                </button>
              </div>
            </div>

            {/* Step 1: Template Download */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block">
                  1. Download Standard {importType} Template
                </span>
                <p className="text-slate-500 leading-relaxed text-[11px]">
                  Use the official format with pre-configured header columns, data validation formats, and formula-injection guards.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate("csv")}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download CSV Template</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate("xlsx")}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 font-semibold text-emerald-800 flex items-center gap-1.5 shadow-2xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Download XLSX Template</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Upload File */}
              <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100 space-y-2">
                <span className="font-bold text-indigo-900 text-xs uppercase tracking-wider block">
                  2. Upload Spreadsheet for Pre-Validation
                </span>
                <p className="text-slate-500 leading-relaxed text-[11px]">
                  Upload your completed CSV or XLSX spreadsheet. File will be checked for missing columns and duplicates.
                </p>
                <form onSubmit={handlePreviewImport} className="space-y-2 pt-1">
                  <input
                    type="file"
                    required
                    accept=".csv,.xlsx"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                  />
                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={previewLoading || !importFile}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Validate & Preview Rows</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Error Message */}
            {importError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{importError}</span>
              </div>
            )}

            {/* Step 3 & 4: Preview Breakdown & Table */}
            {importPreview && (
              <div className="pt-4 border-t border-slate-200 space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Rows</span>
                    <span className="text-lg font-bold text-slate-900">{importPreview.total_rows}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] text-emerald-700 font-bold uppercase block">Valid & Ready</span>
                    <span className="text-lg font-bold text-emerald-700">{importPreview.valid_rows}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-[10px] text-amber-700 font-bold uppercase block">Duplicates</span>
                    <span className="text-lg font-bold text-amber-700">{importPreview.duplicate_rows}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                    <span className="text-[10px] text-rose-700 font-bold uppercase block">Invalid Format</span>
                    <span className="text-lg font-bold text-rose-700">{importPreview.invalid_rows}</span>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Row Preview & Diagnostics ({importPreview.rows.length} rows)
                    </span>
                    <button
                      type="button"
                      onClick={handleExecuteImport}
                      disabled={importLoading || importPreview.valid_rows === 0}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-40"
                    >
                      {importLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Confirm & Import ({importPreview.valid_rows} Valid Rows)</span>
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Row</th>
                          <th className="py-2 px-3">Name / Entity</th>
                          <th className="py-2 px-3">Mobile</th>
                          <th className="py-2 px-3">Email</th>
                          <th className="py-2 px-3">PAN</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Validation Diagnostics</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        {importPreview.rows.map((r, i) => (
                          <tr key={i} className={r.is_valid ? "hover:bg-slate-50" : "bg-rose-50/30"}>
                            <td className="py-2 px-3 font-mono font-bold text-slate-500">{r.row_number}</td>
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {r.data.company_name || `${r.data.first_name || ""} ${r.data.last_name || ""}`.trim() || "—"}
                            </td>
                            <td className="py-2 px-3 font-mono">{r.data.phone || "—"}</td>
                            <td className="py-2 px-3 truncate max-w-xs">{r.data.email || "—"}</td>
                            <td className="py-2 px-3 font-mono">{r.data.pan_number || "—"}</td>
                            <td className="py-2 px-3">
                              {r.is_valid ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  VALID
                                </span>
                              ) : r.is_duplicate ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  DUPLICATE
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                  INVALID
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {r.errors && r.errors.length > 0 ? (
                                <div className="space-y-0.5 text-[11px] text-rose-700 font-medium">
                                  {r.errors.map((err, errIdx) => (
                                    <div key={errIdx}>• {err.field}: {err.message}</div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-emerald-600 text-[11px] font-semibold">Ready to import</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Final Import Execution Summary */}
            {importResult && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Bulk Import Execution Completed</span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="p-2.5 rounded-lg bg-white border border-emerald-200">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Successfully Created</span>
                    <span className="text-base font-bold text-emerald-700">{importResult.successful_count}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Skipped</span>
                    <span className="text-base font-bold text-slate-700">{importResult.skipped_count}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-rose-200">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Failed</span>
                    <span className="text-base font-bold text-rose-700">{importResult.failed_count}</span>
                  </div>
                </div>
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="mt-2 p-2 bg-rose-50 rounded text-rose-700 text-[11px]">
                    <div className="font-bold">Errors Report:</div>
                    {importResult.errors.slice(0, 5).map((e, idx) => (
                      <div key={idx}>• {e.reason}</div>
                    ))}
                  </div>
                )}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      resetImport();
                      setActiveTab("directory");
                    }}
                    className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-semibold text-xs"
                  >
                    Return to Directory
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT CUSTOMER (INDIVIDUAL & CORPORATE)                       */}
      {/* ========================================================================= */}
      {(modalMode === "create" || modalMode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {modalMode === "create" ? "Register New Customer" : `Edit Customer: ${editingCustomer?.full_name}`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete customer profile, encrypted KYC records, and residential/business address.
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

            {/* Client Type Toggle */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFormClientType("INDIVIDUAL")}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  formClientType === "INDIVIDUAL" ? "bg-white text-indigo-600 shadow-2xs font-bold" : "text-slate-600"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Individual Customer</span>
              </button>
              <button
                type="button"
                onClick={() => setFormClientType("CORPORATE")}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  formClientType === "CORPORATE" ? "bg-white text-purple-700 shadow-2xs font-bold" : "text-slate-600"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Corporate Client</span>
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
              {/* SECTION A: INDIVIDUAL DETAILS */}
              {formClientType === "INDIVIDUAL" && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-1">
                    1. Personal Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder="e.g. Rajesh"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Last Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder="e.g. Sharma"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <FormInput
                        label="Mobile Number"
                        type="mobile"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="9876543210"
                      />
                    </div>
                    <div>
                      <FormInput
                        label="Email Address"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="rajesh@example.com"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Gender</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 bg-white"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-semibold text-slate-700 text-xs">Date of Birth</label>
                        <label className="flex items-center gap-1 text-[11px] text-slate-400 select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.enableBirthDate}
                            onChange={(e) => setFormData({ ...formData, enableBirthDate: e.target.checked })}
                            className="rounded text-indigo-600"
                          />
                          <span>Enable</span>
                        </label>
                      </div>
                      <DatePicker
                        disabled={!formData.enableBirthDate}
                        value={formData.birthDate}
                        maxDate={getTodayIso()}
                        onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                        placeholder="DD-MM-YYYY"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-semibold text-slate-700 text-xs">Anniversary</label>
                        <label className="flex items-center gap-1 text-[11px] text-slate-400 select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.enableAnniversaryDate}
                            onChange={(e) => setFormData({ ...formData, enableAnniversaryDate: e.target.checked })}
                            className="rounded text-indigo-600"
                          />
                          <span>Enable</span>
                        </label>
                      </div>
                      <DatePicker
                        disabled={!formData.enableAnniversaryDate}
                        value={formData.anniversaryDate}
                        onChange={(e) => setFormData({ ...formData, anniversaryDate: e.target.value })}
                        placeholder="DD-MM-YYYY"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1 text-xs">Marital Status</label>
                      <select
                        value={formData.maritalStatus}
                        onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 bg-white"
                      >
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Occupation</label>
                      <select
                        value={formData.occupation}
                        onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                      >
                        {OCCUPATIONS.map((occ) => (
                          <option key={occ} value={occ}>{occ}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Source of Income</label>
                      <select
                        value={formData.sourceOfIncome}
                        onChange={(e) => setFormData({ ...formData, sourceOfIncome: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                      >
                        {INCOME_SOURCES.map((src) => (
                          <option key={src} value={src}>{src}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Nationality</label>
                      <input
                        type="text"
                        value={formData.nationality}
                        onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                        placeholder="Indian"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION B: CORPORATE DETAILS */}
              {formClientType === "CORPORATE" && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-700 border-b border-slate-100 pb-1">
                    1. Corporate Entity Credentials
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Corporate / Organization Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        placeholder="e.g. Acme Global Technologies Pvt Ltd"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Corporate Code (Unique)
                      </label>
                      <input
                        type="text"
                        value={formData.corporateCode}
                        onChange={(e) => setFormData({ ...formData, corporateCode: e.target.value })}
                        placeholder="e.g. CORP-ACME-01"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FormInput
                        label="GSTIN (15 characters)"
                        type="gstin"
                        value={formData.gstin}
                        onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                        placeholder="e.g. 27ABCDE1234F1Z5"
                      />
                    </div>
                    <div>
                      <FormInput
                        label="Entity PAN"
                        type="pan"
                        value={formData.panNumber}
                        onChange={(e) => setFormData({ ...formData, panNumber: e.target.value })}
                        placeholder="e.g. ABCDE1234F"
                      />
                    </div>
                  </div>

                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-700 border-b border-slate-100 pb-1 pt-2">
                    2. Primary Corporate Contact Person
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Contact Name</label>
                      <input
                        type="text"
                        value={formData.contactPersonName}
                        onChange={(e) => setFormData({ ...formData, contactPersonName: e.target.value })}
                        placeholder="e.g. Ananya Deshmukh"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                      />
                    </div>
                    <div>
                      <FormInput
                        label="Contact Mobile"
                        type="mobile"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="9876543210"
                      />
                    </div>
                    <div>
                      <FormInput
                        label="Contact Email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="contact@acmeglobal.com"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION C: ADDRESS & KYC */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-1">
                  {formClientType === "CORPORATE" ? "3. Registered Business Address" : "2. Residential Address"}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="Maharashtra"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Mumbai / Pune"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                    />
                  </div>
                  <div>
                    <FormInput
                      label="PIN Code"
                      type="pin"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      placeholder="400001"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Full Address</label>
                  <textarea
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Premises name, street, locality..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              {/* SECTION D: KYC CREDENTIALS (INDIVIDUAL ONLY) */}
              {formClientType === "INDIVIDUAL" && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-1">
                    3. KYC Credentials (AES Encrypted at Rest)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FormInput
                        label="PAN Number (10 Alphanumeric)"
                        type="pan"
                        value={formData.panNumber}
                        onChange={(e) => setFormData({ ...formData, panNumber: e.target.value })}
                        placeholder="ABCDE1234F"
                      />
                    </div>
                    <div>
                      <FormInput
                        label="Aadhaar Number (12 Numeric Digits)"
                        type="aadhaar"
                        value={formData.aadhaarNumber}
                        onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value })}
                        placeholder="123456789012"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Attach KYC Documents (Creation Only) */}
              {modalMode === "create" && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-1">
                    {formClientType === "CORPORATE" ? "4. Corporate Documents" : "4. Attach KYC Proofs"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        {formClientType === "CORPORATE" ? "Incorporation Certificate / Registration" : "Aadhaar Card (PDF/Image)"}
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setKycDoc1({ ...kycDoc1, file: e.target.files?.[0] || null })}
                        className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-slate-200 file:text-slate-800"
                      />
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        {formClientType === "CORPORATE" ? "GST Certificate / Tax ID" : "PAN Card (PDF/Image)"}
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setKycDoc2({ ...kycDoc2, file: e.target.files?.[0] || null })}
                        className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-slate-200 file:text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{modalMode === "create" ? "Save Customer" : "Update Customer"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER: CUSTOMER 360 PROFILE                                             */}
      {/* ========================================================================= */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedCustomer.customer_type === "CORPORATE"
                          ? "bg-purple-100 text-purple-800 border border-purple-200"
                          : "bg-indigo-100 text-indigo-800 border border-indigo-200"
                      }`}
                    >
                      {selectedCustomer.customer_type || "INDIVIDUAL"}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        !selectedCustomer.is_archived
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {!selectedCustomer.is_archived ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    {selectedCustomer.full_name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {selectedCustomer.phone}
                    </span>
                    {selectedCustomer.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {selectedCustomer.email}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* KYC Security Box */}
              <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-indigo-700">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>KYC & Privacy Protection</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleUnmaskKyc}
                    disabled={unmasking}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] flex items-center gap-1 transition-colors border border-indigo-200"
                  >
                    {unmasking ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : unmaskedKyc ? (
                      <EyeOff className="w-3 h-3" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                    <span>{unmaskedKyc ? "Hide Full KYC" : "Reveal Full KYC"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-sans block font-semibold">PAN Number</span>
                    <span className="font-bold text-slate-800">
                      {unmaskedKyc ? (unmaskedKyc.pan_number || "—") : (selectedCustomer.pan_number || "—")}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-sans block font-semibold">Aadhaar Number</span>
                    <span className="font-bold text-slate-800">
                      {unmaskedKyc ? (unmaskedKyc.aadhaar_number || "—") : (selectedCustomer.aadhaar_number || "—")}
                    </span>
                  </div>
                </div>

                {unmaskedKyc && (
                  <p className="text-[10px] text-amber-700 font-medium italic">
                    ⚠️ KYC values unmasked under managerial audit log.
                  </p>
                )}
              </div>

              {/* 360 Tabs */}
              <div className="flex items-center gap-2 mt-4 text-xs font-semibold border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setDrawerTab("overview")}
                  className={`pb-2 border-b-2 transition-colors ${
                    drawerTab === "overview" ? "border-indigo-600 text-indigo-600 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Overview & Details
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab("policies")}
                  className={`pb-2 border-b-2 transition-colors flex items-center gap-1 ${
                    drawerTab === "policies" ? "border-indigo-600 text-indigo-600 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span>Policies</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                    {customerPolicies.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab("family")}
                  className={`pb-2 border-b-2 transition-colors ${
                    drawerTab === "family" ? "border-indigo-600 text-indigo-600 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Family Group
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab("documents")}
                  className={`pb-2 border-b-2 transition-colors flex items-center gap-1 ${
                    drawerTab === "documents" ? "border-indigo-600 text-indigo-600 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span>Documents</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                    {selectedCustomer.documents?.length || 0}
                  </span>
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              {/* TAB 1: OVERVIEW & DEMOGRAPHICS */}
              {drawerTab === "overview" && (
                <div className="space-y-4">
                  {selectedCustomer.customer_type === "CORPORATE" ? (
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <span className="font-bold text-purple-800 text-xs uppercase tracking-wider block">
                        Corporate Entity Specifications
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Corporate Code:</span>
                          <span className="font-mono font-bold text-slate-800">{selectedCustomer.corporate_code || "—"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">GSTIN:</span>
                          <span className="font-mono font-bold text-purple-700">{selectedCustomer.gstin || "—"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Contact Person:</span>
                          <span className="font-semibold text-slate-800">{selectedCustomer.contact_person_name || "—"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Contact Mobile:</span>
                          <span className="font-mono text-slate-800">{selectedCustomer.contact_person_phone || selectedCustomer.phone}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Occupation</span>
                        <span className="font-semibold text-slate-800 mt-0.5 block">{selectedCustomer.occupation || "—"}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Source of Income</span>
                        <span className="font-semibold text-slate-800 mt-0.5 block">{selectedCustomer.source_of_income || "—"}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Date of Birth</span>
                        <span className="font-semibold text-slate-800 mt-0.5 block">{selectedCustomer.date_of_birth || "—"}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Marital Status</span>
                        <span className="font-semibold text-slate-800 mt-0.5 block">{selectedCustomer.marital_status || "—"}</span>
                      </div>
                    </div>
                  )}

                  {/* Address */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      {selectedCustomer.customer_type === "CORPORATE" ? "Registered Corporate Address" : "Residential Address"}
                    </span>
                    <p className="text-slate-800 font-medium leading-relaxed">{selectedCustomer.address || "No address on file."}</p>
                    <p className="text-slate-500 text-[11px]">
                      {[selectedCustomer.city, selectedCustomer.state, selectedCustomer.pincode].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: POLICIES */}
              {drawerTab === "policies" && (
                <div className="space-y-3">
                  {policiesLoading ? (
                    <div className="py-8 text-center text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-1" />
                      <span>Loading client policies...</span>
                    </div>
                  ) : customerPolicies.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-400">
                      No active policies registered for this customer yet.
                    </div>
                  ) : (
                    customerPolicies.map((pol) => (
                      <div key={pol.id} className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-indigo-700">{pol.policy_number}</span>
                          <span
                            className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                              pol.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {pol.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {pol.company_name} — {pol.plan_name}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <span>Sum Assured: ₹{Number(pol.sum_assured || 0).toLocaleString()}</span>
                          <span className="font-semibold text-slate-800">Premium: ₹{Number(pol.final_premium || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: FAMILY GROUP */}
              {drawerTab === "family" && (
                <div className="space-y-3">
                  {familyLoading ? (
                    <div className="py-8 text-center text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-1" />
                      <span>Checking family group memberships...</span>
                    </div>
                  ) : !customerFamilyGroup ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-400">
                      This customer is not currently mapped to an active Family Group portfolio.
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">{customerFamilyGroup.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                          {customerFamilyGroup.members?.length || 1} Members
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Primary Family Head: <span className="font-semibold text-slate-800">{customerFamilyGroup.primary_head_name}</span>
                      </p>
                      <div className="divide-y divide-slate-200/60 border-t border-slate-200 pt-2">
                        {customerFamilyGroup.members?.map((m) => (
                          <div key={m.id} className="py-1.5 flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-800">{m.customer_name}</span>
                            <span className="font-mono text-[10px] text-indigo-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {m.relationship}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: KYC DOCUMENTS REPOSITORY */}
              {drawerTab === "documents" && (
                <div className="space-y-4">
                  {/* Upload Form */}
                  <form onSubmit={handleUploadSingleDoc} className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2">
                    <span className="font-bold text-indigo-900 text-xs block">Upload Additional KYC Document</span>
                    {docUploadError && (
                      <div className="p-2 rounded bg-rose-50 text-rose-700 text-[11px] font-medium">{docUploadError}</div>
                    )}
                    {docUploadSuccess && (
                      <div className="p-2 rounded bg-emerald-50 text-emerald-700 text-[11px] font-medium">Document uploaded and verified!</div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <select name="doc_type" className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs">
                        <option value="AADHAAR">Aadhaar Card</option>
                        <option value="PAN">PAN Card</option>
                        <option value="ADDRESS_PROOF">Address Proof</option>
                        <option value="GSTIN">GST Certificate</option>
                        <option value="INCORPORATION_CERT">Certificate of Incorporation</option>
                      </select>
                      <input
                        type="file"
                        name="file"
                        required
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-indigo-600 file:text-white"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={uploadingDoc}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1"
                      >
                        {uploadingDoc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Upload Document</span>
                      </button>
                    </div>
                  </form>

                  {/* Document List */}
                  <div className="space-y-2">
                    {(!selectedCustomer.documents || selectedCustomer.documents.length === 0) ? (
                      <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-400">
                        No verified documents attached yet.
                      </div>
                    ) : (
                      selectedCustomer.documents.map((doc) => (
                        <div key={doc.id} className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                            <div className="truncate">
                              <p className="text-xs font-semibold text-slate-900 truncate">{doc.document_type}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {doc.original_filename} ({(doc.file_size_bytes / 1024).toFixed(1)} KB)
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              insuranceAPI.downloadCustomerKyc(
                                selectedCustomer.id,
                                doc.id,
                                doc.original_filename
                              )
                            }
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-indigo-50 text-slate-600"
                            title="Download verified document"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleToggleArchive(selectedCustomer)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                {!selectedCustomer.is_archived ? "Deactivate Customer" : "Reactivate Customer"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                Close 360 View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
