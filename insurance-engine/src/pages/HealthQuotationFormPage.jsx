import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import HealthQuotationPreviewModal from "../components/HealthQuotationPreviewModal";
import DatePicker from "../components/common/DatePicker";
import FormInput from "../components/common/FormInput";
import {
  validateIndianMobile,
  validateEmail,
  validateName,
  validatePinCode,
  validateDobNotFuture,
  getTodayIso,
} from "../utils/validation";
import {
  calculateExactAge,
  formatDateYMD,
  formatDateDMY,
  SUM_INSURED_TIERS,
  SUM_INSURED_LABELS,
  DEFAULT_COMPANY_PLANS,
  STANDARD_DISCLAIMER,
  formatINR,
} from "../utils/ageCalculator";
import {
  Umbrella,
  ArrowLeft,
  Save,
  Send,
  Eye,
  Plus,
  Trash2,
  Calendar,
  MapPin,
  User,
  Users,
  Shield,
  Phone,
  Mail,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle,
  HelpCircle,
  Sparkles,
  TrendingDown,
  Info,
} from "lucide-react";

export default function HealthQuotationFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Page loading & feedback
  const [pageLoading, setPageLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Customer options from master database
  const [customerOptions, setCustomerOptions] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  // Master carrier & plan options
  const [masterCompanies, setMasterCompanies] = useState([]);
  const [masterPlans, setMasterPlans] = useState([]);

  // Form Header State
  const defaultTitle = user?.full_name
    ? `${user.full_name} Premium Health Quotation`
    : "Advisor Premium Health Quotation";

  const [title, setTitle] = useState(defaultTitle);
  const [clientName, setClientName] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [quotationDate, setQuotationDate] = useState(formatDateYMD(new Date()));
  const [advisorName, setAdvisorName] = useState(user?.full_name || "");
  const [contactNumber, setContactNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [premiumBasis, setPremiumBasis] = useState("GROSS");
  const [notes, setNotes] = useState("");
  const [quotationNumber, setQuotationNumber] = useState("");

  // Family Members State
  const [members, setMembers] = useState([
    {
      id: "mem-1",
      name: "",
      relationship: "SELF",
      gender: "MALE",
      dob: "",
      age_years: null,
      age_months: null,
      age_days: null,
      contact_number: "",
      is_primary: true,
    },
  ]);

  // Company Plans & Premiums Matrix State
  const [companyPlans, setCompanyPlans] = useState(
    DEFAULT_COMPANY_PLANS.map((cp, idx) => ({
      id: `cp-${idx + 1}`,
      display_name: cp.display_name,
      display_company_name: cp.display_company_name || "",
      display_plan_variant: cp.display_plan_variant || "",
      company_id: null,
      plan_id: null,
      notes: "",
      sort_order: idx + 1,
    }))
  );

  // premiums: { [companyPlanId]: { [sumInsured]: premiumValue } }
  const [premiums, setPremiums] = useState({});

  // Preview Modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Load masters & initial data
  useEffect(() => {
    async function loadMasters() {
      try {
        const [custRes, compRes, planRes] = await Promise.all([
          api.insurance.getCustomers({ page: 1, page_size: 100 }),
          api.insurance.getCompanies({ page: 1, page_size: 100 }),
          api.insurance.getPlans({ page: 1, page_size: 100 }),
        ]);

        if (custRes.ok) setCustomerOptions(custRes.data.items || []);
        if (compRes.ok) setMasterCompanies(compRes.data.items || []);
        if (planRes.ok) setMasterPlans(planRes.data.items || []);
      } catch (err) {
        console.error("Error loading master options:", err);
      }
    }
    loadMasters();
  }, []);

  // If editing, load quotation data
  useEffect(() => {
    if (!isEdit) return;

    async function loadQuotation() {
      setPageLoading(true);
      try {
        const res = await api.insurance.quotations.get(id);
        if (res.ok) {
          const q = res.data;
          setQuotationNumber(q.quotation_number);
          setTitle(q.quotation_title || q.title || defaultTitle);
          setClientName(q.client_name || "");
          setSelectedCustomerId(q.client_id || q.customer_id || "");
          setPinCode(q.pin_code || "");
          setQuotationDate(q.quotation_date || formatDateYMD(new Date()));
          setAdvisorName(q.advisor_name || "");
          setContactNumber(q.contact_number || "");
          setContactEmail(q.contact_email || "");
          setStatus(q.status || "DRAFT");
          setPremiumBasis(q.premium_basis || "GROSS");
          setNotes(q.notes || "");

          // Load Members
          if (q.members && q.members.length > 0) {
            setMembers(
              q.members.map((m, idx) => ({
                id: m.id || `mem-${idx}`,
                name: m.full_name || m.name || "",
                relationship: m.relationship || (idx === 0 ? "SELF" : "SPOUSE"),
                gender: m.gender || "MALE",
                dob: m.date_of_birth || m.dob || "",
                age_years: m.age_years,
                age_months: m.age_months,
                age_days: m.age_days,
                contact_number: m.contact_number || "",
                is_primary: Boolean(m.is_primary),
              }))
            );
          }

          // Load Company Plans & Premiums
          if (q.company_plans && q.company_plans.length > 0) {
            const planList = [];
            const premMap = {};

            q.company_plans.forEach((cp, idx) => {
              const cpKey = cp.id || `cp-${idx + 1}`;
              const dName = cp.display_company_name
                ? `${cp.display_company_name} ${cp.display_plan_variant || ""}`.trim()
                : cp.display_name || `Plan ${idx + 1}`;

              planList.push({
                id: cpKey,
                display_name: dName,
                display_company_name: cp.display_company_name || "",
                display_plan_variant: cp.display_plan_variant || "",
                company_id: cp.insurance_company_id || cp.company_id || null,
                plan_id: cp.insurance_plan_id || cp.plan_id || null,
                notes: cp.notes || "",
                sort_order: cp.display_order || cp.sort_order || idx + 1,
              });

              premMap[cpKey] = {};
              if (cp.premiums) {
                cp.premiums.forEach((p) => {
                  if (p.premium_amount && Number(p.premium_amount) > 0) {
                    premMap[cpKey][Number(p.sum_insured)] = Number(p.premium_amount);
                  }
                });
              }
            });

            setCompanyPlans(planList);
            setPremiums(premMap);
          }
        } else {
          setFormError(res.error || "Failed to load quotation for editing.");
        }
      } catch (err) {
        setFormError("Failed to load quotation.");
      } finally {
        setPageLoading(false);
      }
    }

    loadQuotation();
  }, [id, isEdit]);

  // Recalculate all members' exact calendar age when Quotation Reference Date changes
  const handleQuotationDateChange = (newDate) => {
    setQuotationDate(newDate);
    setMembers((prev) =>
      prev.map((m) => {
        if (!m.dob) return m;
        const calculated = calculateExactAge(m.dob, newDate);
        return {
          ...m,
          age_years: calculated.years,
          age_months: calculated.months,
          age_days: calculated.days,
        };
      })
    );
  };

  // Handle Member DOB Change -> Authoritatively calculates age in Years, Months, Days
  const handleMemberDobChange = (index, newDob) => {
    setMembers((prev) => {
      const updated = [...prev];
      const m = { ...updated[index], dob: newDob };
      if (newDob) {
        const calculated = calculateExactAge(newDob, quotationDate);
        m.age_years = calculated.years;
        m.age_months = calculated.months;
        m.age_days = calculated.days;
      } else {
        m.age_years = null;
        m.age_months = null;
        m.age_days = null;
      }
      updated[index] = m;
      return updated;
    });
  };

  // Add Family Member
  const handleAddMember = () => {
    const isFirst = members.length === 0;
    setMembers((prev) => [
      ...prev,
      {
        id: `mem-${Date.now()}`,
        name: "",
        relationship: isFirst ? "SELF" : "SPOUSE",
        gender: "MALE",
        dob: "",
        age_years: null,
        age_months: null,
        age_days: null,
        contact_number: "",
        is_primary: isFirst,
      },
    ]);
  };

  // Remove Family Member
  const handleRemoveMember = (index) => {
    if (members.length <= 1) {
      alert("A quotation proposal must have at least one insured member.");
      return;
    }
    setMembers((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update Member Field
  const handleMemberFieldChange = (index, field, value) => {
    setMembers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Select Customer from dropdown -> autofill
  const handleCustomerSelect = (customerId) => {
    setSelectedCustomerId(customerId);
    if (!customerId) return;

    const cust = customerOptions.find((c) => c.id === customerId);
    if (cust) {
      if (!clientName) setClientName(cust.name || `${cust.first_name || ""} ${cust.last_name || ""}`.trim());
      if (cust.phone && !contactNumber) setContactNumber(cust.phone);
      if (cust.email && !contactEmail) setContactEmail(cust.email);
      if (cust.pin_code && !pinCode) setPinCode(cust.pin_code);

      // Also set primary member name if blank
      if (members.length > 0 && !members[0].name) {
        const cName = cust.name || `${cust.first_name || ""} ${cust.last_name || ""}`.trim();
        handleMemberFieldChange(0, "name", cName);
        if (cust.dob) {
          handleMemberDobChange(0, cust.dob);
        }
        if (cust.gender) {
          handleMemberFieldChange(0, "gender", cust.gender.toUpperCase());
        }
      }
    }
  };

  // Add Company Plan Row
  const handleAddCompanyPlan = () => {
    const newId = `cp-${Date.now()}`;
    setCompanyPlans((prev) => [
      ...prev,
      {
        id: newId,
        display_name: `Custom Insurer (Plan Variant ${prev.length + 1})`,
        display_company_name: "Custom Insurer",
        display_plan_variant: `(Plan Variant ${prev.length + 1})`,
        company_id: null,
        plan_id: null,
        notes: "",
        sort_order: prev.length + 1,
      },
    ]);
  };

  // Remove Company Plan Row
  const handleRemoveCompanyPlan = (cpId) => {
    if (companyPlans.length <= 1) {
      alert("At least one company/plan row is required.");
      return;
    }
    setCompanyPlans((prev) => prev.filter((cp) => cp.id !== cpId));
    setPremiums((prev) => {
      const copy = { ...prev };
      delete copy[cpId];
      return copy;
    });
  };

  // Update Company Plan label
  const handleCompanyPlanNameChange = (cpId, newName) => {
    setCompanyPlans((prev) =>
      prev.map((cp) => (cp.id === cpId ? { ...cp, display_name: newName } : cp))
    );
  };

  // Update Premium Cell with validation
  const handlePremiumChange = (cpId, sumInsured, rawValue) => {
    const cleanVal = rawValue.replace(/[^0-9.]/g, "");
    const numVal = cleanVal === "" ? null : parseFloat(cleanVal);

    if (numVal !== null && (isNaN(numVal) || numVal < 0)) return;

    setPremiums((prev) => {
      const cpPrem = { ...(prev[cpId] || {}) };
      if (numVal === null || numVal === 0) {
        delete cpPrem[sumInsured];
      } else {
        cpPrem[sumInsured] = numVal;
      }
      return {
        ...prev,
        [cpId]: cpPrem,
      };
    });
  };

  // Calculate lowest premium per Sum Insured tier (for highlight)
  const lowestPremiumsByTier = useMemo(() => {
    const mins = {};
    SUM_INSURED_TIERS.forEach((tier) => {
      const values = [];
      companyPlans.forEach((cp) => {
        const val = premiums[cp.id]?.[tier];
        if (val !== undefined && val !== null && val > 0) {
          values.push(Number(val));
        }
      });
      // Only highlight if there are at least 2 comparable quotes
      if (values.length > 1) {
        mins[tier] = Math.min(...values);
      }
    });
    return mins;
  }, [companyPlans, premiums]);

  // Build Payload
  const buildPayload = (targetStatus) => {
    const clientCheck = validateName(clientName, "Client / Proposer Name", true);
    if (!clientCheck.isValid) throw new Error(clientCheck.error);

    const pinCheck = validatePinCode(pinCode, "Client PIN Code", true);
    if (!pinCheck.isValid) throw new Error(pinCheck.error);

    if (contactNumber) {
      const mobCheck = validateIndianMobile(contactNumber, "Client Contact Phone", false);
      if (!mobCheck.isValid) throw new Error(mobCheck.error);
    }

    if (contactEmail) {
      const emailCheck = validateEmail(contactEmail, "Client Email Address", false);
      if (!emailCheck.isValid) throw new Error(emailCheck.error);
    }

    if (!members || members.length === 0) {
      throw new Error("Please add at least one insured member to the quotation.");
    }

    // Validate members
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m.name.trim()) {
        throw new Error(`Member #${i + 1} is missing a full name.`);
      }
      if (!m.dob) {
        throw new Error(`Member "${m.name}" is missing Date of Birth.`);
      }
      const dobCheck = validateDobNotFuture(m.dob, `Member "${m.name}" Date of Birth`);
      if (!dobCheck.isValid) throw new Error(dobCheck.error);
    }

    const membersPayload = members.map((m, idx) => ({
      full_name: m.name.trim(),
      name: m.name.trim(),
      relationship: m.relationship || (idx === 0 ? "SELF" : "OTHER"),
      gender: m.gender || null,
      date_of_birth: m.dob,
      dob: m.dob,
      contact_number: m.contact_number ? m.contact_number.trim() : null,
      is_primary: Boolean(m.is_primary),
      display_order: idx + 1,
      sort_order: idx + 1,
    }));

    const companyPlansPayload = companyPlans.map((cp, idx) => {
      const rowPremiums = premiums[cp.id] || {};
      const premsArray = Object.entries(rowPremiums)
        .filter(([_, val]) => val !== null && val > 0)
        .map(([si, val]) => ({
          sum_insured_code: SUM_INSURED_LABELS[Number(si)] || String(si),
          sum_insured: Number(si),
          premium_amount: Number(val),
          premium_basis: premiumBasis,
        }));

      let compName = cp.display_company_name || cp.display_name;
      let planVariant = cp.display_plan_variant || "";
      if (!planVariant && compName.includes(" (")) {
        const parts = compName.split(" (");
        compName = parts[0];
        planVariant = `(${parts.slice(1).join(" (")}`;
      }

      return {
        display_company_name: compName.trim() || `Insurer ${idx + 1}`,
        display_plan_variant: planVariant.trim(),
        display_name: cp.display_name.trim() || `Plan ${idx + 1}`,
        insurance_company_id: cp.company_id || null,
        insurance_plan_id: cp.plan_id || null,
        company_id: cp.company_id || null,
        plan_id: cp.plan_id || null,
        notes: cp.notes ? cp.notes.trim() : null,
        display_order: idx + 1,
        sort_order: idx + 1,
        premiums: premsArray,
      };
    });

    return {
      quotation_title: title.trim() || defaultTitle,
      title: title.trim() || defaultTitle,
      client_name: clientName.trim(),
      client_id: selectedCustomerId || null,
      customer_id: selectedCustomerId || null,
      pin_code: cleanPin,
      quotation_date: quotationDate,
      advisor_name: advisorName.trim() || null,
      contact_number: contactNumber.trim() || null,
      contact_email: contactEmail.trim() || null,
      status: targetStatus || status,
      premium_basis: premiumBasis,
      notes: notes.trim() || null,
      members: membersPayload,
      company_plans: companyPlansPayload,
    };
  };

  // Submit Handler
  const handleSubmit = async (targetStatus) => {
    setFormError("");
    setFormSuccess("");

    let payload;
    try {
      payload = buildPayload(targetStatus);
    } catch (err) {
      setFormError(err.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    try {
      let res;
      if (isEdit) {
        res = await api.insurance.quotations.update(id, payload);
      } else {
        res = await api.insurance.quotations.create(payload);
      }

      if (res.ok) {
        setFormSuccess(
          `Quotation ${isEdit ? "updated" : "created"} successfully as ${res.data.quotation_number}!`
        );
        setTimeout(() => {
          navigate("/insurance/health-quotations");
        }, 750);
      } else {
        setFormError(res.error || "Failed to save quotation.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      setFormError(err.message || "An unexpected error occurred.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  };

  // Live Preview Modal
  const handleOpenPreview = () => {
    try {
      const payload = buildPayload(status);
      const calculatedMembers = members.map((m) => {
        const age = calculateExactAge(m.dob, quotationDate);
        return {
          ...m,
          age_years: age.years,
          age_months: age.months,
          age_days: age.days,
        };
      });

      setPreviewData({
        ...payload,
        id: id || null,
        quotation_number: quotationNumber || "DRAFT-PREVIEW",
        members: calculatedMembers,
      });
      setPreviewOpen(true);
    } catch (err) {
      setFormError(`Cannot preview: ${err.message}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (pageLoading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
        <p className="text-xs text-slate-500 font-semibold">Loading health quotation proposal...</p>
      </div>
    );
  }

  const isPinValid = /^\d{6}$/.test(pinCode.trim());

  return (
    <div className="space-y-6 pb-24">
      {/* 1. Statutory Notice Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500 p-3.5 rounded-r-2xl text-xs font-semibold text-amber-950 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="leading-snug">{STANDARD_DISCLAIMER}</span>
        </div>
        <span className="hidden sm:inline-flex text-[10px] uppercase font-black tracking-wider text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-md border border-amber-300/80 shrink-0">
          Statutory Banner
        </span>
      </div>

      {/* 2. Top Header & Action Controls */}
      <div className="bg-gradient-to-r from-white via-indigo-50/20 to-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="flex items-center gap-4">
            <Link
              to="/insurance/health-quotations"
              className="p-2.5 text-slate-500 hover:text-slate-900 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 transition-colors shadow-xs shrink-0"
              title="Back to Quotations List"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {isEdit ? `Edit Quotation: ${quotationNumber}` : "Create Health Quotation"}
                </h1>
                <span
                  className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-md border ${
                    status === "ISSUED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {status}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Exact calendar age calculator &amp; multi-carrier health proposal matrix
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleOpenPreview}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200/90 hover:bg-slate-50 rounded-xl shadow-xs transition-colors"
            >
              <Eye className="w-4 h-4 text-indigo-600" />
              <span>Preview</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit("DRAFT")}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-slate-600" />
              <span>Save Draft</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit("ISSUED")}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-sm shadow-indigo-500/25 active:scale-95 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Save &amp; Issue</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {formError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{formError}</span>
          </div>
          <button
            onClick={() => setFormError("")}
            className="text-rose-700 hover:text-rose-900 font-bold p-1"
          >
            &times;
          </button>
        </div>
      )}

      {formSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{formSuccess}</span>
          </div>
        </div>
      )}

      {/* SECTION 1: Quotation Information & Client Details */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Quotation Title &amp; Client Details</h2>
              <p className="text-[11px] text-slate-400">Advisor branding and insured proposer metadata</p>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl font-medium self-start sm:self-auto">
            Reference Date: <strong className="text-slate-800">{formatDateDMY(quotationDate)}</strong>
          </div>
        </div>

        {/* Title Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Customizable Quotation Proposal Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Aditya Thakre Premium Health Quotation"
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Displayed prominently at the top of the proposal header, vector PDF, Excel, and image exports.
          </p>
        </div>

        {/* Form Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Customer Autofill */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Existing Customer (Optional)
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => handleCustomerSelect(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">-- Manual Client Entry --</option>
              {customerOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || `${c.first_name || ""} ${c.last_name || ""}`.trim()} ({c.customer_code || "Client"})
                </option>
              ))}
            </select>
          </div>

          {/* Client Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Client / Proposer Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* PIN Code with strict visual validation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Client PIN Code (6 Digits) <span className="text-rose-500">*</span>
              </label>
              {pinCode && (
                <span className={`text-[10px] font-bold ${isPinValid ? "text-emerald-600" : "text-rose-500"}`}>
                  {isPinValid ? "✓ Valid 6-Digit PIN" : `${pinCode.length}/6 digits`}
                </span>
              )}
            </div>
            <div className="relative">
              <MapPin className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isPinValid ? "text-emerald-500" : "text-rose-500"}`} />
              <input
                type="text"
                maxLength={6}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="400001"
                className={`w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 ${
                  pinCode && !isPinValid
                    ? "border-rose-300 focus:ring-rose-500/20 focus:border-rose-500"
                    : isPinValid
                    ? "border-emerald-300 focus:ring-emerald-500/20 focus:border-emerald-500"
                    : "border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500"
                }`}
              />
              {isPinValid && (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 absolute right-3 top-2.5" />
              )}
            </div>
          </div>

          {/* Quotation Date (Age Reference Date) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Quotation Date (Age Reference Date) <span className="text-rose-500">*</span>
            </label>
            <DatePicker
              value={quotationDate}
              onChange={(e) => handleQuotationDateChange(e.target.value)}
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Authoritative anchor date: updates all members' calendar ages automatically.
            </p>
          </div>

          {/* Advisor Representative */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Advisor / Broker Representative
            </label>
            <input
              type="text"
              value={advisorName}
              onChange={(e) => setAdvisorName(e.target.value)}
              placeholder="e.g. Aditya Thakre"
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Premium Basis */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Comparison Premium Tax Basis
            </label>
            <select
              value={premiumBasis}
              onChange={(e) => setPremiumBasis(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="GROSS">Gross Premium (Including 18% GST / Tax)</option>
              <option value="NET">Net Premium (Excluding Tax)</option>
            </select>
          </div>

          {/* Contact Phone */}
          <FormInput
            type="mobile"
            label="Client Contact Phone (Optional)"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            placeholder="10-digit mobile"
          />

          {/* Contact Email */}
          <FormInput
            type="email"
            label="Client Email Address (Optional)"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="client@example.com"
          />

          {/* Proposal Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Proposal Lifecycle Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="DRAFT">Draft</option>
              <option value="ISSUED">Issued</option>
              <option value="EXPIRED">Expired</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        {/* Special Notes */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Quotation Special Notes &amp; Underwriting Remarks
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Includes Zone 1 hospital network coverage, OPD add-on evaluated, PED waiting period 2 years..."
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* SECTION 2: Insured Family Members & Exact Calendar Age Calculator */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Insured Family Members &amp; Exact Age Calculator
              </h2>
              <p className="text-[11px] text-slate-400">
                Calendar age computed authoritatively in Years, Months, and Days against reference date {formatDateDMY(quotationDate)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddMember}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Family Member</span>
          </button>
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[180px]">
                  Member Full Name <span className="text-rose-500">*</span>
                </th>
                <th className="py-2.5 px-3 min-w-[130px]">Relationship</th>
                <th className="py-2.5 px-3 min-w-[100px]">Gender</th>
                <th className="py-2.5 px-3 min-w-[140px]">
                  Date of Birth <span className="text-rose-500">*</span>
                </th>
                <th className="py-2.5 px-3 text-center bg-indigo-50/60 text-indigo-900 border-x border-indigo-100 font-black w-24">
                  AGE (Years)
                </th>
                <th className="py-2.5 px-3 text-center bg-indigo-50/60 text-indigo-900 border-r border-indigo-100 font-black w-20">
                  MON
                </th>
                <th className="py-2.5 px-3 text-center bg-indigo-50/60 text-indigo-900 border-r border-indigo-100 font-black w-20">
                  DAYS
                </th>
                <th className="py-2.5 px-3 text-center w-14">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m, idx) => (
                <tr key={m.id || idx} className="hover:bg-slate-50/50">
                  {/* Row # */}
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-xs">
                    {idx + 1}
                  </td>

                  {/* Name */}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={m.name}
                        onChange={(e) => handleMemberFieldChange(idx, "name", e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      {idx === 0 && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-md shrink-0 border border-indigo-200">
                          Primary
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Relationship */}
                  <td className="py-2 px-3">
                    <select
                      value={m.relationship}
                      onChange={(e) => handleMemberFieldChange(idx, "relationship", e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="SELF">Self (Proposer)</option>
                      <option value="SPOUSE">Spouse</option>
                      <option value="SON">Son</option>
                      <option value="DAUGHTER">Daughter</option>
                      <option value="FATHER">Father</option>
                      <option value="MOTHER">Mother</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </td>

                  {/* Gender */}
                  <td className="py-2 px-3">
                    <select
                      value={m.gender}
                      onChange={(e) => handleMemberFieldChange(idx, "gender", e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </td>

                  {/* Date of Birth */}
                  <td className="py-2 px-3">
                    <DatePicker
                      value={m.dob}
                      onChange={(e) => handleMemberDobChange(idx, e.target.value)}
                      maxDate={getTodayIso()}
                      placeholder="DD-MM-YYYY"
                    />
                  </td>

                  {/* Calculated AGE (Years) */}
                  <td className="py-2 px-3 text-center bg-indigo-50/30 border-x border-indigo-100/60 font-mono font-black text-slate-900 text-sm">
                    {m.age_years !== null ? m.age_years : "—"}
                  </td>

                  {/* Calculated MON (Months) */}
                  <td className="py-2 px-3 text-center bg-indigo-50/30 border-r border-indigo-100/60 font-mono font-bold text-slate-700">
                    {m.age_months !== null ? m.age_months : "—"}
                  </td>

                  {/* Calculated DAYS */}
                  <td className="py-2 px-3 text-center bg-indigo-50/30 border-r border-indigo-100/60 font-mono font-bold text-slate-700">
                    {m.age_days !== null ? m.age_days : "—"}
                  </td>

                  {/* Action */}
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(idx)}
                      disabled={members.length <= 1}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Remove Member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Member Cards */}
        <div className="block sm:hidden space-y-3">
          {members.map((m, idx) => (
            <div
              key={m.id || idx}
              className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <span>Member #{idx + 1}</span>
                  {idx === 0 && (
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-bold">
                      Primary
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(idx)}
                  disabled={members.length <= 1}
                  className="text-slate-400 hover:text-rose-600 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 font-semibold mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={m.name}
                  onChange={(e) => handleMemberFieldChange(idx, "name", e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">
                    Relationship
                  </label>
                  <select
                    value={m.relationship}
                    onChange={(e) => handleMemberFieldChange(idx, "relationship", e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-1.5"
                  >
                    <option value="SELF">Self</option>
                    <option value="SPOUSE">Spouse</option>
                    <option value="SON">Son</option>
                    <option value="DAUGHTER">Daughter</option>
                    <option value="FATHER">Father</option>
                    <option value="MOTHER">Mother</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">
                    Gender
                  </label>
                  <select
                    value={m.gender}
                    onChange={(e) => handleMemberFieldChange(idx, "gender", e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-1.5"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 font-semibold mb-1">
                  Date of Birth
                </label>
                <DatePicker
                  value={m.dob}
                  onChange={(e) => handleMemberDobChange(idx, e.target.value)}
                  maxDate={getTodayIso()}
                  placeholder="DD-MM-YYYY"
                />
              </div>

              {/* Exact Age Output Chips */}
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-2.5 flex items-center justify-around text-center text-xs">
                <div>
                  <span className="text-[10px] text-indigo-700 font-bold uppercase block">Years</span>
                  <span className="font-mono font-black text-slate-900 text-sm">
                    {m.age_years !== null ? m.age_years : "—"}
                  </span>
                </div>
                <div className="w-px h-6 bg-indigo-200/60" />
                <div>
                  <span className="text-[10px] text-indigo-700 font-bold uppercase block">Months</span>
                  <span className="font-mono font-bold text-slate-800">
                    {m.age_months !== null ? m.age_months : "—"}
                  </span>
                </div>
                <div className="w-px h-6 bg-indigo-200/60" />
                <div>
                  <span className="text-[10px] text-indigo-700 font-bold uppercase block">Days</span>
                  <span className="font-mono font-bold text-slate-800">
                    {m.age_days !== null ? m.age_days : "—"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: Premium Comparison Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
              3
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Multi-Insurer Premium Comparison Matrix
              </h2>
              <p className="text-[11px] text-slate-400">
                Enter premiums for each insurer and Sum Insured tier ({premiumBasis === "GROSS" ? "Gross with Tax" : "Net without Tax"})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddCompanyPlan}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Plan Variant</span>
          </button>
        </div>

        {/* Dynamic Filtering Callout Notice */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-slate-900">Dynamic Row &amp; Column Filtering:</strong> Only rows and Sum Insured tiers with entered premiums will appear in the customer quotation preview, PDF, Excel, and Image exports. Unpopulated columns are automatically hidden. Lowest premium in each tier is highlighted in green.
          </div>
        </div>

        {/* Matrix Grid with Horizontal Scroll */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-3.5 min-w-[230px] border-r border-slate-200">
                  Company / Plan Variant
                </th>
                {SUM_INSURED_TIERS.map((tier) => (
                  <th
                    key={tier}
                    className="py-3 px-2 text-center border-r border-slate-200 min-w-[100px] font-black text-slate-800"
                  >
                    <div className="text-xs">{SUM_INSURED_LABELS[tier] || tier}</div>
                    <div className="text-[9px] font-normal text-slate-400 font-mono normal-case">
                      {formatINR(tier)}
                    </div>
                  </th>
                ))}
                <th className="py-3 px-2 text-center w-12">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companyPlans.map((cp) => {
                const rowPremiums = premiums[cp.id] || {};
                const hasAnyPremium = Object.values(rowPremiums).some((v) => v !== null && v > 0);

                return (
                  <tr
                    key={cp.id}
                    className={`hover:bg-indigo-50/20 transition-colors ${
                      hasAnyPremium ? "bg-white" : "bg-slate-50/40 opacity-80"
                    }`}
                  >
                    {/* Plan Variant Name */}
                    <td className="py-2.5 px-3 border-r border-slate-200">
                      <input
                        type="text"
                        value={cp.display_name}
                        onChange={(e) => handleCompanyPlanNameChange(cp.id, e.target.value)}
                        placeholder="e.g. HDFC ERGO (with HC)"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>

                    {/* 9 Standardized Sum Insured Columns */}
                    {SUM_INSURED_TIERS.map((tier) => {
                      const val = rowPremiums[tier] || "";
                      const isFilled = Boolean(val);
                      const isLowest = isFilled && lowestPremiumsByTier[tier] && Number(val) === lowestPremiumsByTier[tier];

                      return (
                        <td
                          key={tier}
                          className={`py-2 px-1.5 border-r border-slate-200 text-center ${
                            isLowest
                              ? "bg-emerald-50/40"
                              : isFilled
                              ? "bg-indigo-50/20"
                              : ""
                          }`}
                        >
                          <div className="relative">
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => handlePremiumChange(cp.id, tier, e.target.value)}
                              placeholder="—"
                              className={`w-full text-center text-xs rounded-lg py-1.5 px-1 font-mono transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                isLowest
                                  ? "bg-emerald-50 border border-emerald-300 font-black text-emerald-900 shadow-2xs"
                                  : isFilled
                                  ? "bg-indigo-50 border border-indigo-200 font-bold text-indigo-900"
                                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                              }`}
                            />
                            {isLowest && (
                              <span
                                className="absolute -top-1.5 right-1 w-2 h-2 rounded-full bg-emerald-500"
                                title="Lowest available quote for this tier"
                              />
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Delete Plan Row */}
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveCompanyPlan(cp.id)}
                        disabled={companyPlans.length <= 1}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Remove Plan Variant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3.5 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              Members: <strong className="text-slate-800">{members.length}</strong> | Comparison Rows:{" "}
              <strong className="text-slate-800">{companyPlans.length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to="/insurance/health-quotations"
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Cancel
            </Link>

            <button
              type="button"
              onClick={handleOpenPreview}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <Eye className="w-4 h-4 text-indigo-600" />
              <span>Preview</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit("DRAFT")}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-slate-600" />
              <span>Save Draft</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit("ISSUED")}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-sm shadow-indigo-500/25 active:scale-95 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Save &amp; Issue</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Preview Modal */}
      {previewData && (
        <HealthQuotationPreviewModal
          quotationData={previewData}
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
