import React, { useState, useEffect, useMemo } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import {
  DollarSign,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Percent,
  UserCheck,
  FileText,
  Clock,
  ArrowRight,
  Download,
  Eye,
  Check,
  RotateCcw,
  Receipt,
  Plus,
  X,
  Building2,
  Shield,
  ArrowUpRight,
  Calendar,
  CreditCard,
  FileSpreadsheet,
  PauseCircle,
  AlertCircle,
  Landmark,
  BadgeIndianRupee,
  Layers,
  FileCheck,
  Edit,
  Edit3,
  Pencil,
  Sparkles,
  PieChart,
  Wallet,
  LayoutGrid,
  List,
  Upload,
  Paperclip,
} from "lucide-react";
import { INSURANCE_CATEGORIES, getCategoryLabel } from "../utils/insuranceCategories";
import DatePicker from "../components/common/DatePicker";
import {
  validatePercentage,
  validatePositiveDecimal,
  validateDateOrder,
} from "../utils/validation";

/** Shared Indian Currency Formatter returning ₹#,##,##0.00 */
export function formatINR(val) {
  if (val === null || val === undefined || isNaN(Number(val))) return "₹0.00";
  const num = Number(val);
  const isNeg = num < 0;
  const absVal = Math.abs(num);
  const formatted = absVal.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNeg ? "-" : ""}₹${formatted}`;
}

export default function CommissionsPage() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const canMutate = isAdmin || isSuperAdmin;

  // Active Tab:
  // 'insurer_receivables' | 'subagent_payouts' | 'financial_dashboard' | 'reports_exports' | 'agreements'
  const [activeTab, setActiveTab] = useState("insurer_receivables");

  // Notifications
  const { showSuccess, showError } = useNotification();
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

  // Metadata dropdowns
  const [subAgents, setSubAgents] = useState([]);
  const [companies, setCompanies] = useState([]);

  // ==========================================
  // TAB 1: INSURER RECEIVABLE LEDGER STATE
  // ==========================================
  const [commissions, setCommissions] = useState([]);
  const [totalCommissions, setTotalCommissions] = useState(0);
  const [totalPagesCommissions, setTotalPagesCommissions] = useState(1);
  const [commPage, setCommPage] = useState(1);
  const [commPageSize] = useState(15);
  const [commLoading, setCommLoading] = useState(true);
  const [commViewMode, setCommViewMode] = useState("table"); // 'table' | 'cards'
  const [payoutViewMode, setPayoutViewMode] = useState("table"); // 'table' | 'cards'

  // Filters for Insurer Ledger
  const [commSearch, setCommSearch] = useState("");
  const [commStatusFilter, setCommStatusFilter] = useState("ALL");
  const [commCompanyFilter, setCommCompanyFilter] = useState("ALL");
  const [commCategoryFilter, setCommCategoryFilter] = useState("ALL");
  const [commTypeFilter, setCommTypeFilter] = useState("ALL");
  const [commFromDate, setCommFromDate] = useState("");
  const [commToDate, setCommToDate] = useState("");

  // Modals for Insurer Ledger
  const [selectedCommission, setSelectedCommission] = useState(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [reverseModalOpen, setReverseModalOpen] = useState(false);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Bank Receipt Form (Phase 3 & 4)
  const [receiptForm, setReceiptForm] = useState({
    actual_commission_rate: "",
    actual_gross_commission: "",
    actual_tds_rate: "10.0",
    actual_tds_amount: "",
    net_amount: "",
    actual_bank_received: "",
    receipt_date: new Date().toISOString().split("T")[0],
    bank_name: "HDFC Bank Ltd",
    bank_account: "",
    payment_mode: "NEFT",
    transaction_reference: "",
    document_url: "",
    notes: "",
  });
  const [receiptModalError, setReceiptModalError] = useState("");
  const [uploadingReceiptDoc, setUploadingReceiptDoc] = useState(false);

  // Reversal Form
  const [reversalForm, setReversalForm] = useState({
    reversal_reason: "",
    reversal_amount: "",
    notes: "",
  });

  // Dispute Form
  const [disputeForm, setDisputeForm] = useState({
    dispute_reason: "",
    disputed_amount: "",
    notes: "",
  });

  // 8 Exact KPI Cards Data (Phase 3)
  const [kpiData, setKpiData] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  // Configure / Edit Commission Modal (Stage 1 Manual Override)
  const [editCommModalOpen, setEditCommModalOpen] = useState(false);
  const [editCommForm, setEditCommForm] = useState({
    id: null,
    policy_number: "",
    customer_name: "",
    company_name: "",
    plan_name: "",
    commission_type: "FIRST_YEAR",
    net_premium_applied: 0,
    gross_commission_rate: 15.0,
    gross_commission_amount: 0,
    tds_rate: 10.0,
    tds_amount: 0,
    net_commission_payable: 0,
    override_reason: "",
    bank_reference: "",
    notes: "",
  });

  // ==========================================
  // TAB 2: SUB-AGENT PAYOUTS STATE
  // ==========================================
  const [payouts, setPayouts] = useState([]);
  const [totalPayouts, setTotalPayouts] = useState(0);
  const [totalPagesPayouts, setTotalPagesPayouts] = useState(1);
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutPageSize] = useState(15);
  const [payoutLoading, setPayoutLoading] = useState(false);

  // Filters for Payouts
  const [payoutSearch, setPayoutSearch] = useState("");
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("ALL");
  const [payoutAgentFilter, setPayoutAgentFilter] = useState("ALL");
  const [payoutCompanyFilter, setPayoutCompanyFilter] = useState("ALL");
  const [payoutFromDate, setPayoutFromDate] = useState("");
  const [payoutToDate, setPayoutToDate] = useState("");

  // Payout Modals
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [payoutDetailModalOpen, setPayoutDetailModalOpen] = useState(false);
  const [payoutPaymentModalOpen, setPayoutPaymentModalOpen] = useState(false);
  const [payoutReverseModalOpen, setPayoutReverseModalOpen] = useState(false);

  // Configure / Edit Sub-Agent Payout Allocation Modal (Stage 2)
  const [editPayoutModalOpen, setEditPayoutModalOpen] = useState(false);
  const [editPayoutForm, setEditPayoutForm] = useState({
    id: null,
    policy_number: "",
    sub_agent_name: "",
    sub_agent_code: "",
    insurer_gross_commission: 0,
    allocation_type: "PERCENTAGE",
    allocation_rate: 20.0,
    fixed_amount: 0,
    payable_amount: 0,
    tds_rate: 5.0,
    tds_amount: 0,
    net_payable_amount: 0,
    override_reason: "",
    notes: "",
  });

  const [payoutPaymentForm, setPayoutPaymentForm] = useState({
    payment_amount: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "BANK_TRANSFER",
    transaction_reference: "",
    bank_name: "HDFC Bank Ltd",
    bank_account_number: "",
    payment_proof_url: "",
    notes: "",
  });

  const [payoutReverseForm, setPayoutReverseForm] = useState({
    reversal_reason: "",
    notes: "",
  });

  // ==========================================
  // TAB 3: AGENT PERFORMANCE STATE
  // ==========================================
  const [agentPerformanceData, setAgentPerformanceData] = useState([]);
  const [agentPerfLoading, setAgentPerfLoading] = useState(false);

  // ==========================================
  // TAB 4: FINANCIAL DASHBOARD STATE
  // ==========================================
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // ==========================================
  // TAB 5: REPORTS & EXPORTS STATE
  // ==========================================
  const [exportFilters, setExportFilters] = useState({
    from_date: "",
    to_date: "",
    company_id: "ALL",
    agent_id: "ALL",
    status: "ALL",
    search: "",
  });
  const [downloadingReport, setDownloadingReport] = useState("");

  // ==========================================
  // TAB 6: INSURER AGREEMENTS STATE
  // ==========================================
  const [agreements, setAgreements] = useState([]);
  const [agreementsLoading, setAgreementsLoading] = useState(false);
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
  const [agreementForm, setAgreementForm] = useState({
    company_id: "",
    policy_category: "HEALTH",
    plan_id: null,
    first_year_commission_rate: "15.00",
    renewal_commission_rate: "7.50",
    special_commission_rate: "",
    commissionable_basis: "NET_PREMIUM",
    tds_rate: "10.00",
    effective_from: new Date().toISOString().split("T")[0],
    effective_to: "",
    notes: "",
  });

  // ==========================================
  // INITIAL DATA LOADING & URL PARAMETER SYNC
  // ==========================================
  useEffect(() => {
    loadMetadata();
    fetchKPIs();

    // Sync from URL deep-links e.g. /commissions?tab=subagent_payouts&search=POL-1234
    try {
      const q = new URLSearchParams(window.location.search);
      const tabParam = q.get("tab");
      const searchParam = q.get("search");
      if (tabParam) {
        if (["insurer_receivables", "subagent_payouts", "agent_performance", "financial_dashboard", "reports_exports", "agreements"].includes(tabParam)) {
          setActiveTab(tabParam);
        }
      }
      if (searchParam) {
        setCommSearch(searchParam);
        setPayoutSearch(searchParam);
      }
    } catch (e) {
      console.warn("Failed reading query params:", e);
    }
  }, []);

  const fetchKPIs = async () => {
    setKpiLoading(true);
    const res = await api.insurance.getCommissionKPIs();
    setKpiLoading(false);
    if (res.ok) {
      setKpiData(res.data);
    }
  };

  useEffect(() => {
    if (activeTab === "insurer_receivables") {
      fetchCommissions();
    } else if (activeTab === "subagent_payouts") {
      fetchPayouts();
    } else if (activeTab === "agent_performance") {
      fetchAgentPerformance();
    } else if (activeTab === "financial_dashboard") {
      fetchDashboard();
    } else if (activeTab === "agreements") {
      fetchAgreements();
    }
  }, [
    activeTab,
    commPage,
    commStatusFilter,
    commCompanyFilter,
    commCategoryFilter,
    commTypeFilter,
    commFromDate,
    commToDate,
    payoutPage,
    payoutStatusFilter,
    payoutAgentFilter,
    payoutCompanyFilter,
    payoutFromDate,
    payoutToDate,
  ]);

  const loadMetadata = async () => {
    try {
      const [agentsRes, compRes] = await Promise.all([
        api.insurance.getSubAgents({ is_active: true }),
        api.insurance.getCompanies({ is_active: true }),
      ]);
      if (agentsRes.ok) setSubAgents(agentsRes.data?.items || agentsRes.data || []);
      if (compRes.ok) setCompanies(compRes.data?.items || compRes.data || []);
    } catch (e) {
      console.error("Failed to load metadata dropdowns:", e);
    }
  };

  // Fetch Insurer Receivables
  const fetchCommissions = async () => {
    setCommLoading(true);
    const params = {
      page: commPage,
      page_size: commPageSize,
      status: commStatusFilter !== "ALL" ? commStatusFilter : undefined,
      company_id: commCompanyFilter !== "ALL" ? commCompanyFilter : undefined,
      policy_category: commCategoryFilter !== "ALL" ? commCategoryFilter : undefined,
      commission_type: commTypeFilter !== "ALL" ? commTypeFilter : undefined,
      from_date: commFromDate || undefined,
      to_date: commToDate || undefined,
      search: commSearch.trim() || undefined,
    };
    const res = await api.insurance.getCommissions(params);
    setCommLoading(false);
    if (res.ok) {
      const data = res.data;
      setCommissions(data.items || []);
      setTotalCommissions(data.total || 0);
      setTotalPagesCommissions(data.total_pages || 1);
    } else {
      setActionError(res.error || "Failed to load insurer commission records.");
    }
  };

  // Fetch Sub-Agent Payouts
  const fetchPayouts = async () => {
    setPayoutLoading(true);
    const params = {
      page: payoutPage,
      page_size: payoutPageSize,
      status: payoutStatusFilter !== "ALL" ? payoutStatusFilter : undefined,
      sub_agent_id: payoutAgentFilter !== "ALL" ? payoutAgentFilter : undefined,
      company_id: payoutCompanyFilter !== "ALL" ? payoutCompanyFilter : undefined,
      from_date: payoutFromDate || undefined,
      to_date: payoutToDate || undefined,
      search: payoutSearch.trim() || undefined,
    };
    const res = await api.insurance.getSubAgentPayouts(params);
    setPayoutLoading(false);
    if (res.ok) {
      const data = res.data;
      setPayouts(data.items || []);
      setTotalPayouts(data.total || 0);
      setTotalPagesPayouts(data.total_pages || 1);
    } else {
      setActionError(res.error || "Failed to load sub-agent payouts.");
    }
  };

  // Fetch Financial Dashboard
  const fetchDashboard = async () => {
    setDashboardLoading(true);
    const res = await api.insurance.getComprehensiveCommissionDashboard();
    setDashboardLoading(false);
    if (res.ok) {
      setDashboardData(res.data);
    } else {
      setActionError(res.error || "Failed to load commission financial dashboard.");
    }
  };

  // Fetch Agreements
  const fetchAgreements = async () => {
    setAgreementsLoading(true);
    const res = await api.insurance.getCommissionAgreements();
    setAgreementsLoading(false);
    if (res.ok) {
      setAgreements(res.data || []);
    } else {
      setActionError(res.error || "Failed to load insurer commission agreements.");
    }
  };

  // Fetch Agent Performance
  const fetchAgentPerformance = async () => {
    setAgentPerfLoading(true);
    const res = await api.insurance.getAgentPerformanceReports();
    setAgentPerfLoading(false);
    if (res.ok) {
      setAgentPerformanceData(res.data || []);
    } else {
      setActionError(res.error || "Failed to load agent performance report.");
    }
  };

  // Export Helpers
  const handleExportCsv = async () => {
    const params = {
      search: commSearch.trim() || undefined,
      status: commStatusFilter !== "ALL" ? commStatusFilter : undefined,
      company_id: commCompanyFilter !== "ALL" ? commCompanyFilter : undefined,
      policy_category: commCategoryFilter !== "ALL" ? commCategoryFilter : undefined,
      commission_type: commTypeFilter !== "ALL" ? commTypeFilter : undefined,
      from_date: commFromDate || undefined,
      to_date: commToDate || undefined,
    };
    const res = await api.insurance.exportCommissionLedgerCsv(params);
    if (res.ok) {
      setActionSuccess("Insurer Commission Ledger exported to CSV.");
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setActionError(res.error || "Failed to export CSV.");
    }
  };

  const handleExportExcel = async () => {
    const params = {
      search: commSearch.trim() || undefined,
      status: commStatusFilter !== "ALL" ? commStatusFilter : undefined,
      company_id: commCompanyFilter !== "ALL" ? commCompanyFilter : undefined,
      policy_category: commCategoryFilter !== "ALL" ? commCategoryFilter : undefined,
      commission_type: commTypeFilter !== "ALL" ? commTypeFilter : undefined,
      from_date: commFromDate || undefined,
      to_date: commToDate || undefined,
    };
    const res = await api.insurance.exportCommissionLedgerExcel(params);
    if (res.ok) {
      setActionSuccess("Insurer Commission Ledger exported to Excel (.xlsx).");
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setActionError(res.error || "Failed to export Excel.");
    }
  };

  // ==========================================
  // STAGE 1: INSURER RECEIVABLE HANDLERS
  // ==========================================
  const handleOpenEditComm = (comm) => {
    const netPrem = Number(comm.net_premium_applied || 0);
    const rate = Number(comm.gross_commission_rate || 15.0);
    const gross = comm.gross_commission_amount ? Number(comm.gross_commission_amount) : Number((netPrem * (rate / 100)).toFixed(2));
    const tdsR = comm.tds_rate ? Number(comm.tds_rate) : 10.0;
    const tdsA = comm.tds_amount ? Number(comm.tds_amount) : Number((gross * (tdsR / 100)).toFixed(2));
    const net = comm.net_commission_payable ? Number(comm.net_commission_payable) : Number((gross - tdsA).toFixed(2));

    setEditCommForm({
      id: comm.id,
      policy_number: comm.policy_number,
      customer_name: comm.customer_name || "Direct Client",
      company_name: comm.company_name,
      plan_name: comm.plan_name || "Standard Plan",
      commission_type: comm.commission_type || "FIRST_YEAR",
      net_premium_applied: netPrem,
      gross_commission_rate: rate,
      gross_commission_amount: gross,
      tds_rate: tdsR,
      tds_amount: tdsA,
      net_commission_payable: net,
      override_reason: comm.override_reason || "",
      bank_reference: comm.bank_reference || "",
      notes: comm.notes || "",
    });
    setEditCommModalOpen(true);
  };

  const handleEditCommRateChange = (newRate) => {
    const r = parseFloat(newRate) || 0;
    const netPrem = Number(editCommForm.net_premium_applied || 0);
    const gross = Number((netPrem * (r / 100)).toFixed(2));
    const tdsR = parseFloat(editCommForm.tds_rate) || 10.0;
    const tds = Number((gross * (tdsR / 100)).toFixed(2));
    const net = Number((gross - tds).toFixed(2));
    setEditCommForm((prev) => ({
      ...prev,
      gross_commission_rate: newRate,
      gross_commission_amount: gross,
      tds_amount: tds,
      net_commission_payable: net,
    }));
  };

  const handleEditCommGrossChange = (newGross) => {
    const g = parseFloat(newGross) || 0;
    const netPrem = Number(editCommForm.net_premium_applied || 0);
    const r = netPrem > 0 ? Number(((g / netPrem) * 100).toFixed(2)) : editCommForm.gross_commission_rate;
    const tdsR = parseFloat(editCommForm.tds_rate) || 10.0;
    const tds = Number((g * (tdsR / 100)).toFixed(2));
    const net = Number((g - tds).toFixed(2));
    setEditCommForm((prev) => ({
      ...prev,
      gross_commission_amount: newGross,
      gross_commission_rate: r,
      tds_amount: tds,
      net_commission_payable: net,
    }));
  };

  const handleEditCommTdsRateChange = (newTdsRate) => {
    const tdsR = parseFloat(newTdsRate) || 0;
    const g = parseFloat(editCommForm.gross_commission_amount) || 0;
    const tds = Number((g * (tdsR / 100)).toFixed(2));
    const net = Number((g - tds).toFixed(2));
    setEditCommForm((prev) => ({
      ...prev,
      tds_rate: newTdsRate,
      tds_amount: tds,
      net_commission_payable: net,
    }));
  };

  const handleSaveEditComm = async (e) => {
    e.preventDefault();
    if (!editCommForm.id) return;
    setSubmitting(true);
    const payload = {
      net_premium_applied: Number(editCommForm.net_premium_applied),
      commission_type: editCommForm.commission_type,
      gross_commission_rate: Number(editCommForm.gross_commission_rate),
      gross_commission_amount: Number(editCommForm.gross_commission_amount),
      tds_rate: Number(editCommForm.tds_rate),
      tds_amount: Number(editCommForm.tds_amount),
      net_commission_payable: Number(editCommForm.net_commission_payable),
      override_reason: editCommForm.override_reason?.trim() || undefined,
      bank_reference: editCommForm.bank_reference?.trim() || undefined,
      notes: editCommForm.notes?.trim() || undefined,
    };
    const res = await api.insurance.updateCommission(editCommForm.id, payload);
    setSubmitting(false);
    if (res.ok) {
      setActionSuccess(`Commission configuration for policy ${editCommForm.policy_number} updated.`);
      setEditCommModalOpen(false);
      fetchCommissions();
      fetchKPIs();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setActionError(res.error || "Failed to update commission configuration.");
    }
  };

  const handleApproveCommission = async (comm) => {
    if (!window.confirm(`Approve insurer receivable of ${formatINR(comm.gross_commission_amount)} for policy ${comm.policy_number}?`)) return;
    setSubmitting(true);
    const res = await api.insurance.approveCommission(comm.id, { approval_notes: "Administrative Approval confirmed." });
    setSubmitting(false);
    if (res.ok) {
      setActionSuccess(`Insurer receivable for policy ${comm.policy_number} approved successfully.`);
      fetchCommissions();
      fetchKPIs();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setActionError(res.error || "Failed to approve insurer receivable.");
    }
  };

  // Sub-Agent Payout Edit Handlers
  const handleOpenEditPayout = (payout) => {
    const gross = Number(payout.insurer_gross_commission || 0);
    const rate = Number(payout.agreed_sub_agent_percentage || 20.0);
    const payable = Number(payout.sub_agent_payable_amount || (gross * (rate / 100)).toFixed(2));
    const tdsR = Number(payout.tds_rate || 5.0);
    const tdsA = Number((payable * (tdsR / 100)).toFixed(2));
    const net = Number((payable - tdsA).toFixed(2));

    setEditPayoutForm({
      id: payout.id,
      policy_number: payout.policy_number,
      sub_agent_name: payout.sub_agent_name,
      sub_agent_code: payout.sub_agent_code || "",
      insurer_gross_commission: gross,
      allocation_type: "PERCENTAGE",
      allocation_rate: rate,
      fixed_amount: payable,
      payable_amount: payable,
      tds_rate: tdsR,
      tds_amount: tdsA,
      net_payable_amount: net,
      override_reason: "",
      notes: "",
    });
    setEditPayoutModalOpen(true);
  };

  const handleEditPayoutRateChange = (newRate) => {
    const r = parseFloat(newRate) || 0;
    const gross = Number(editPayoutForm.insurer_gross_commission || 0);
    const payable = Number((gross * (r / 100)).toFixed(2));
    const tdsR = parseFloat(editPayoutForm.tds_rate) || 5.0;
    const tds = Number((payable * (tdsR / 100)).toFixed(2));
    const net = Number((payable - tds).toFixed(2));
    setEditPayoutForm((prev) => ({
      ...prev,
      allocation_rate: newRate,
      payable_amount: payable,
      tds_amount: tds,
      net_payable_amount: net,
    }));
  };

  const handleEditPayoutFixedChange = (newFixed) => {
    const fixed = parseFloat(newFixed) || 0;
    const tdsR = parseFloat(editPayoutForm.tds_rate) || 5.0;
    const tds = Number((fixed * (tdsR / 100)).toFixed(2));
    const net = Number((fixed - tds).toFixed(2));
    setEditPayoutForm((prev) => ({
      ...prev,
      fixed_amount: newFixed,
      payable_amount: fixed,
      tds_amount: tds,
      net_payable_amount: net,
    }));
  };

  const handleEditPayoutTdsRateChange = (newTds) => {
    const tdsR = parseFloat(newTds) || 0;
    const payable = Number(editPayoutForm.payable_amount || 0);
    const tds = Number((payable * (tdsR / 100)).toFixed(2));
    const net = Number((payable - tds).toFixed(2));
    setEditPayoutForm((prev) => ({
      ...prev,
      tds_rate: newTds,
      tds_amount: tds,
      net_payable_amount: net,
    }));
  };

  const handleSaveEditPayout = async (e) => {
    e.preventDefault();
    if (!editPayoutForm.id) return;
    setSubmitting(true);
    const payload = {
      allocation_type: editPayoutForm.allocation_type,
      allocation_rate: editPayoutForm.allocation_type === "PERCENTAGE" ? Number(editPayoutForm.allocation_rate) : undefined,
      fixed_amount: editPayoutForm.allocation_type === "FIXED" ? Number(editPayoutForm.fixed_amount) : undefined,
      payable_amount: Number(editPayoutForm.payable_amount),
      tds_rate: Number(editPayoutForm.tds_rate),
      override_reason: editPayoutForm.override_reason?.trim() || undefined,
      notes: editPayoutForm.notes?.trim() || undefined,
    };
    const res = await api.insurance.updateSubAgentPayout(editPayoutForm.id, payload);
    setSubmitting(false);
    if (res.ok) {
      setActionSuccess(`Sub-agent payout allocation for ${editPayoutForm.sub_agent_name} updated.`);
      setEditPayoutModalOpen(false);
      fetchPayouts();
      fetchKPIs();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setActionError(res.error || "Failed to update sub-agent payout allocation.");
    }
  };

  const handleOpenReceiptModal = (comm) => {
    setSelectedCommission(comm);
    setReceiptModalError("");
    const netPrem = Number(comm.net_premium_applied || 0);
    const expRate = Number(comm.gross_commission_rate || 0);
    const expGross = Number(comm.gross_commission_amount || 0);
    const expTdsRate = Number(comm.tds_rate || 10);
    const expTdsAmt = Number(comm.tds_amount || 0);
    const balance = comm.balance_receivable !== null && comm.balance_receivable !== undefined
      ? Number(comm.balance_receivable)
      : Math.max(0, Number(comm.net_commission_payable || 0) - Number(comm.actual_net_received || 0));

    const expectedNet = expGross - expTdsAmt;
    const defaultBankRec = balance > 0 ? balance : (expectedNet > 0 ? expectedNet : expGross);

    setReceiptForm({
      actual_commission_rate: expRate > 0 ? expRate.toFixed(2) : "",
      actual_gross_commission: expGross > 0 ? expGross.toFixed(2) : "",
      actual_tds_rate: expTdsRate.toFixed(2),
      actual_tds_amount: expTdsAmt > 0 ? expTdsAmt.toFixed(2) : "",
      net_amount: expectedNet.toFixed(2),
      actual_bank_received: defaultBankRec.toFixed(2),
      receipt_date: new Date().toISOString().split("T")[0],
      bank_name: "HDFC Bank Ltd",
      bank_account: "",
      payment_mode: "NEFT",
      transaction_reference: "",
      document_url: "",
      notes: `Receipt from ${comm.company_name || "Insurer"} for policy ${comm.policy_number || ""}`,
    });
    setReceiptModalOpen(true);
  };

  const handleActualRateChange = (newRate) => {
    const netPrem = Number(selectedCommission?.net_premium_applied || 0);
    const r = parseFloat(newRate) || 0;
    const gross = (netPrem * (r / 100)).toFixed(2);
    const tdsR = parseFloat(receiptForm.actual_tds_rate) || 10;
    const tds = (parseFloat(gross) * (tdsR / 100)).toFixed(2);
    const net = (parseFloat(gross) - parseFloat(tds)).toFixed(2);

    setReceiptForm((prev) => ({
      ...prev,
      actual_commission_rate: newRate,
      actual_gross_commission: gross,
      actual_tds_amount: tds,
      net_amount: net,
      actual_bank_received: prev.actual_bank_received === prev.net_amount || !prev.actual_bank_received ? net : prev.actual_bank_received,
    }));
  };

  const handleActualGrossChange = (newGross) => {
    const netPrem = Number(selectedCommission?.net_premium_applied || 0);
    const grossVal = parseFloat(newGross) || 0;
    const calcRate = netPrem > 0 ? ((grossVal / netPrem) * 100).toFixed(2) : receiptForm.actual_commission_rate;
    const tdsR = parseFloat(receiptForm.actual_tds_rate) || 10;
    const tds = (grossVal * (tdsR / 100)).toFixed(2);
    const net = (grossVal - parseFloat(tds)).toFixed(2);

    setReceiptForm((prev) => ({
      ...prev,
      actual_commission_rate: calcRate,
      actual_gross_commission: newGross,
      actual_tds_amount: tds,
      net_amount: net,
      actual_bank_received: prev.actual_bank_received === prev.net_amount || !prev.actual_bank_received ? net : prev.actual_bank_received,
    }));
  };

  const handleActualTdsRateChange = (newTdsRate) => {
    const gross = parseFloat(receiptForm.actual_gross_commission) || 0;
    const tdsR = parseFloat(newTdsRate) || 0;
    const tds = (gross * (tdsR / 100)).toFixed(2);
    const net = (gross - parseFloat(tds)).toFixed(2);

    setReceiptForm((prev) => ({
      ...prev,
      actual_tds_rate: newTdsRate,
      actual_tds_amount: tds,
      net_amount: net,
      actual_bank_received: prev.actual_bank_received === prev.net_amount || !prev.actual_bank_received ? net : prev.actual_bank_received,
    }));
  };

  const handleActualTdsAmountChange = (newTds) => {
    const gross = parseFloat(receiptForm.actual_gross_commission) || 0;
    const tdsVal = parseFloat(newTds) || 0;
    const calcTdsRate = gross > 0 ? ((tdsVal / gross) * 100).toFixed(2) : receiptForm.actual_tds_rate;
    const net = (gross - tdsVal).toFixed(2);

    setReceiptForm((prev) => ({
      ...prev,
      actual_tds_rate: calcTdsRate,
      actual_tds_amount: newTds,
      net_amount: net,
      actual_bank_received: prev.actual_bank_received === prev.net_amount || !prev.actual_bank_received ? net : prev.actual_bank_received,
    }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceiptDoc(true);
    setReceiptModalError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.insurance.uploadReceiptDoc(formData);
      if (res.ok && res.data?.url) {
        setReceiptForm((prev) => ({
          ...prev,
          document_url: res.data.url,
        }));
      } else {
        setReceiptModalError(res.error || "Statement upload failed. Please try again or provide a URL.");
      }
    } catch (err) {
      setReceiptModalError(err.message || "Network error while uploading statement.");
    } finally {
      setUploadingReceiptDoc(false);
    }
  };

  const handleReceiptSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCommission) return;

    const bankRecNum = Number(receiptForm.actual_bank_received);
    if (!receiptForm.actual_bank_received || isNaN(bankRecNum) || bankRecNum <= 0) {
      setReceiptModalError("Please enter a valid positive Actual Bank Received amount.");
      return;
    }
    if (!receiptForm.transaction_reference.trim()) {
      setReceiptModalError("Bank UTR / Transaction Reference is mandatory for audit reconciliation.");
      return;
    }
    if (!receiptForm.receipt_date) {
      setReceiptModalError("Bank Credit Date is mandatory.");
      return;
    }

    setSubmitting(true);
    setReceiptModalError("");

    const grossVal = receiptForm.actual_gross_commission ? Number(receiptForm.actual_gross_commission) : undefined;
    const tdsVal = receiptForm.actual_tds_amount ? Number(receiptForm.actual_tds_amount) : 0;
    const netRecVal = receiptForm.net_amount ? Number(receiptForm.net_amount) : (grossVal ? grossVal - tdsVal : bankRecNum);

    const payload = {
      net_amount: netRecVal,
      actual_bank_received: bankRecNum,
      actual_commission_rate: receiptForm.actual_commission_rate ? Number(receiptForm.actual_commission_rate) : undefined,
      actual_gross_commission: grossVal,
      gross_amount: grossVal,
      actual_tds_rate: receiptForm.actual_tds_rate ? Number(receiptForm.actual_tds_rate) : undefined,
      actual_tds_amount: tdsVal,
      tds_deducted: tdsVal,
      receipt_date: receiptForm.receipt_date,
      bank_account: receiptForm.bank_account.trim() || undefined,
      payment_mode: receiptForm.payment_mode,
      bank_name: receiptForm.bank_name.trim() || undefined,
      transaction_reference: receiptForm.transaction_reference.trim(),
      document_url: receiptForm.document_url.trim() || undefined,
      supporting_document_url: receiptForm.document_url.trim() || undefined,
      notes: receiptForm.notes.trim() || undefined,
    };

    const res = await api.insurance.recordCommissionReceipt(selectedCommission.id, payload);
    setSubmitting(false);
    if (res.ok) {
      setActionSuccess(`Bank credit of ${formatINR(payload.actual_bank_received)} recorded & reconciled successfully.`);
      setReceiptModalOpen(false);
      fetchCommissions();
      fetchKPIs();
      setTimeout(() => setActionSuccess(""), 5000);
    } else {
      setReceiptModalError(res.error || "Failed to record bank receipt. Please check details and try again.");
    }
  };

  const handleOpenDispute = (comm) => {
    setSelectedCommission(comm);
    setDisputeForm({
      dispute_reason: "",
      disputed_amount: comm.balance_receivable ? Number(comm.balance_receivable).toFixed(2) : "",
      notes: "",
    });
    setDisputeModalOpen(true);
  };

  const handleDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCommission) return;
    if (!disputeForm.dispute_reason.trim()) {
      alert("Please specify reason for raising commission discrepancy/dispute.");
      return;
    }

    setSubmitting(true);
    const res = await api.insurance.disputeCommission(selectedCommission.id, {
      dispute_reason: disputeForm.dispute_reason.trim(),
      disputed_amount: disputeForm.disputed_amount ? Number(disputeForm.disputed_amount) : undefined,
      notes: disputeForm.notes.trim() || undefined,
    });
    setSubmitting(false);
    if (res.ok) {
      setActionSuccess(`Commission discrepancy logged for policy ${selectedCommission.policy_number}.`);
      setDisputeModalOpen(false);
      fetchCommissions();
      fetchKPIs();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setActionError(res.error || "Failed to flag commission dispute.");
    }
  };

  const handleOpenReverse = (comm) => {
    setSelectedCommission(comm);
    setReversalForm({
      reversal_reason: "",
      reversal_amount: Number(comm.gross_commission_amount || 0).toFixed(2),
      notes: "",
    });
    setReverseModalOpen(true);
  };

  const handleReverseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCommission) return;
    if (!reversalForm.reversal_reason || reversalForm.reversal_reason.trim().length < 5) {
      alert("Please provide a detailed reversal reason (at least 5 characters).");
      return;
    }

    setSubmitting(true);
    const res = await api.insurance.reverseCommission(selectedCommission.id, {
      reversal_reason: reversalForm.reversal_reason.trim(),
      reversal_amount: reversalForm.reversal_amount ? Number(reversalForm.reversal_amount) : undefined,
      notes: reversalForm.notes.trim() || undefined,
    });
    setSubmitting(false);
    if (res.ok) {
      setActionSuccess(`Commission ${selectedCommission.policy_number} successfully reversed.`);
      setReverseModalOpen(false);
      fetchCommissions();
      fetchKPIs();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setActionError(res.error || "Failed to reverse commission.");
    }
  };

  // ==========================================
  // SUB-AGENT PAYOUT HANDLERS
  // ==========================================
  const handleApprovePayout = async (payout) => {
    if (!window.confirm(`Approve sub-agent payout of ${formatINR(payout.sub_agent_payable_amount)} for ${payout.sub_agent_name}?`)) {
      return;
    }
    const res = await api.insurance.approveSubAgentPayout(payout.id, {
      approval_notes: "Approved for outgoing disbursement.",
    });
    if (res.ok) {
      setActionSuccess(`Payout for policy ${payout.policy_number} approved successfully.`);
      fetchPayouts();
      fetchKPIs();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setActionError(res.error || "Failed to approve payout.");
    }
  };

  const handleHoldPayout = async (payout) => {
    const reason = window.prompt("Enter reason for placing this payout on hold:");
    if (!reason) return;
    const res = await api.insurance.holdSubAgentPayout(payout.id, { hold_reason: reason });
    if (res.ok) {
      setActionSuccess(`Payout for ${payout.sub_agent_name} placed on hold.`);
      fetchPayouts();
      fetchKPIs();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setActionError(res.error || "Failed to place payout on hold.");
    }
  };

  const handleOpenPayoutPayment = (payout) => {
    setSelectedPayout(payout);
    const remaining = Number(payout.remaining_payable || 0);
    setPayoutPaymentForm({
      payment_amount: remaining > 0 ? remaining.toFixed(2) : Number(payout.sub_agent_payable_amount).toFixed(2),
      payment_date: new Date().toISOString().split("T")[0],
      payment_method: "BANK_TRANSFER",
      transaction_reference: "",
      bank_name: "HDFC Bank Ltd",
      bank_account_number: "",
      payment_proof_url: "",
      notes: `Payout to ${payout.sub_agent_name} for policy ${payout.policy_number}`,
    });
    setPayoutPaymentModalOpen(true);
  };

  const handlePayoutPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPayout) return;
    if (!payoutPaymentForm.payment_amount || Number(payoutPaymentForm.payment_amount) <= 0) {
      alert("Please enter a valid disbursement amount.");
      return;
    }
    if (!payoutPaymentForm.transaction_reference.trim()) {
      alert("Transaction Reference / UTR # is mandatory for payment disbursement proof.");
      return;
    }

    setSubmitting(true);
    const payload = {
      payment_amount: Number(payoutPaymentForm.payment_amount),
      payment_date: payoutPaymentForm.payment_date,
      payment_method: payoutPaymentForm.payment_method,
      transaction_reference: payoutPaymentForm.transaction_reference.trim(),
      bank_name: payoutPaymentForm.bank_name.trim() || undefined,
      bank_account_number: payoutPaymentForm.bank_account_number.trim() || undefined,
      payment_proof_url: payoutPaymentForm.payment_proof_url.trim() || undefined,
      notes: payoutPaymentForm.notes.trim() || undefined,
    };

    const res = await api.insurance.recordSubAgentPayoutPayment(selectedPayout.id, payload);
    setSubmitting(false);
    if (res.ok) {
      setActionSuccess(`Disbursement of ${formatINR(payload.payment_amount)} paid to ${selectedPayout.sub_agent_name}.`);
      setPayoutPaymentModalOpen(false);
      fetchPayouts();
      fetchKPIs();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setActionError(res.error || "Failed to record payout disbursement.");
    }
  };

  const handleOpenPayoutReverse = (payout) => {
    setSelectedPayout(payout);
    setPayoutReverseForm({ reversal_reason: "", notes: "" });
    setPayoutReverseModalOpen(true);
  };

  const handlePayoutReverseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPayout) return;
    if (!payoutReverseForm.reversal_reason || payoutReverseForm.reversal_reason.trim().length < 5) {
      alert("Please enter a detailed reversal reason (at least 5 characters).");
      return;
    }

    setSubmitting(true);
    const res = await api.insurance.reverseSubAgentPayout(selectedPayout.id, {
      reversal_reason: payoutReverseForm.reversal_reason.trim(),
      notes: payoutReverseForm.notes.trim() || undefined,
    });
    setSubmitting(false);
    if (res.ok) {
      setActionSuccess(`Sub-agent payout reversed for policy ${selectedPayout.policy_number}.`);
      setPayoutReverseModalOpen(false);
      fetchPayouts();
      fetchKPIs();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setActionError(res.error || "Failed to reverse sub-agent payout.");
    }
  };

  // ==========================================
  // REPORTS & EXPORT HANDLER
  // ==========================================
  const handleDownloadReport = async (reportKey, format) => {
    setDownloadingReport(`${reportKey}_${format}`);
    const params = {
      from_date: exportFilters.from_date || undefined,
      to_date: exportFilters.to_date || undefined,
      company_id: exportFilters.company_id !== "ALL" ? exportFilters.company_id : undefined,
      agent_id: exportFilters.agent_id !== "ALL" ? exportFilters.agent_id : undefined,
      status: exportFilters.status !== "ALL" ? exportFilters.status : undefined,
      search: exportFilters.search.trim() || undefined,
    };
    const res = await api.insurance.downloadCommissionReport(reportKey, format, params);
    setDownloadingReport("");
    if (!res.ok) {
      setActionError(res.error || `Failed to download ${reportKey}.`);
    } else {
      setActionSuccess(`${reportKey.replace(/_/g, " ").toUpperCase()} (${format.toUpperCase()}) downloaded successfully.`);
      setTimeout(() => setActionSuccess(""), 4000);
    }
  };

  // ==========================================
  // AGREEMENT SUBMIT HANDLER
  // ==========================================
  const handleSaveAgreement = async (e) => {
    e.preventDefault();
    if (!agreementForm.company_id) {
      setActionError("Please select an insurance company.");
      return;
    }
    const fyCheck = validatePercentage(agreementForm.first_year_commission_rate, "First Year Commission Rate", true);
    if (!fyCheck.isValid) {
      setActionError(fyCheck.error);
      return;
    }
    const rnCheck = validatePercentage(agreementForm.renewal_commission_rate, "Renewal Commission Rate", true);
    if (!rnCheck.isValid) {
      setActionError(rnCheck.error);
      return;
    }
    const tdsCheck = validatePercentage(agreementForm.tds_rate, "TDS Rate", true);
    if (!tdsCheck.isValid) {
      setActionError(tdsCheck.error);
      return;
    }
    if (agreementForm.effective_to) {
      const dateOrderCheck = validateDateOrder(agreementForm.effective_from, agreementForm.effective_to, "Effective From", "Effective To");
      if (!dateOrderCheck.isValid) {
        setActionError(dateOrderCheck.error);
        return;
      }
    }
    setSubmitting(true);
    const payload = {
      ...agreementForm,
      first_year_commission_rate: Number(agreementForm.first_year_commission_rate),
      renewal_commission_rate: Number(agreementForm.renewal_commission_rate),
      special_commission_rate: agreementForm.special_commission_rate ? Number(agreementForm.special_commission_rate) : undefined,
      tds_rate: Number(agreementForm.tds_rate),
      effective_to: agreementForm.effective_to || undefined,
    };
    const res = await api.insurance.createCommissionAgreement(payload);
    setSubmitting(false);
    if (res.ok) {
      setActionSuccess("Commission agreement configured successfully.");
      setAgreementModalOpen(false);
      fetchAgreements();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setActionError(res.error || "Failed to save agreement.");
    }
  };

  // ==========================================
  // STATUS BADGE RENDERERS
  // ==========================================
  const renderInsurerStatusBadge = (status) => {
    switch (status) {
      case "PENDING":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">PENDING</span>;
      case "PARTIALLY_RECEIVED":
      case "PARTIALLY_PAID":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">PARTIAL</span>;
      case "RECEIVED":
      case "PAID":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">RECEIVED</span>;
      case "SHORT_RECEIVED":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">SHORT RCVD</span>;
      case "EXCESS_RECEIVED":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">EXCESS RCVD</span>;
      case "DISPUTED":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">DISPUTED</span>;
      case "REVERSED":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">REVERSED</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const renderPayoutStatusBadge = (status) => {
    switch (status) {
      case "PENDING":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">PENDING</span>;
      case "APPROVED":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">APPROVED</span>;
      case "PARTIALLY_PAID":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">PARTIAL PAID</span>;
      case "PAID":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">PAID</span>;
      case "ON_HOLD":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">ON HOLD</span>;
      case "REVERSED":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">REVERSED</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Executive Header Banner */}
      <div className="bg-gradient-to-br from-white via-slate-50/70 to-indigo-50/40 p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-500" />
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25 shrink-0 ring-4 ring-indigo-50">
              <DollarSign className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100/70 border border-indigo-200/60 px-2.5 py-0.5 rounded-full shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                  Two-Stage Financial Engine
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">•</span>
                <span className="text-xs text-slate-500 font-semibold hidden sm:inline">Carrier Receivables & Sub-Agent Liabilities</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                Commission & Sub-Agent Payout Workflows
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Strict separation of accounts: Stage 1 incoming commissions receivable from insurance carriers and Stage 2 outgoing broker payout obligations.
              </p>
            </div>
          </div>

          {/* Tab Navigation Segmented Bar */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/60 backdrop-blur-md rounded-2xl border border-slate-300/60 shadow-inner overflow-x-auto max-w-full scrollbar-none self-start lg:self-auto">
            <button
              onClick={() => setActiveTab("insurer_receivables")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "insurer_receivables"
                  ? "bg-white text-indigo-900 shadow-md border border-slate-200/90 font-black scale-[1.02]"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
              <span>Insurer Receivables</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-extrabold">
                {totalCommissions}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("subagent_payouts")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "subagent_payouts"
                  ? "bg-white text-teal-900 shadow-md border border-slate-200/90 font-black scale-[1.02]"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Sub-Agent Payouts</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-teal-100 text-teal-800 font-extrabold">
                {totalPayouts}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("agent_performance")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "agent_performance"
                  ? "bg-white text-emerald-900 shadow-md border border-slate-200/90 font-black scale-[1.02]"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <PieChart className="w-3.5 h-3.5 text-emerald-600" />
              <span>Agent Performance</span>
            </button>

            <button
              onClick={() => setActiveTab("financial_dashboard")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "financial_dashboard"
                  ? "bg-white text-purple-900 shadow-md border border-slate-200/90 font-black scale-[1.02]"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <BadgeIndianRupee className="w-3.5 h-3.5 text-purple-600" />
              <span>Financial Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab("reports_exports")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "reports_exports"
                  ? "bg-white text-blue-900 shadow-md border border-slate-200/90 font-black scale-[1.02]"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
              <span>Reports</span>
            </button>

            <button
              onClick={() => setActiveTab("agreements")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "agreements"
                  ? "bg-white text-slate-900 shadow-md border border-slate-200/90 font-black scale-[1.02]"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-slate-700" />
              <span>Agreements</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess("")} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError("")} className="text-rose-700 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: INSURER COMMISSION RECEIVABLE LEDGER (PHASE 3) */}
      {/* ========================================================================= */}
      {activeTab === "insurer_receivables" && (
        <div className="space-y-4">
          {/* Top 8 Polished KPI Cards for Stage 1 Insurer Commission */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 sm:gap-3.5">
            {/* 1. Total Gross Commission */}
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-indigo-600 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Gross Comm</span>
                <div className="w-7 h-7 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-mono truncate">
                {formatINR(kpiData?.total_gross_commission)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Carrier contracted</span>
              </div>
            </div>

            {/* 2. Pending Approval */}
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-amber-500 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-amber-700 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pending Appr</span>
                <div className="w-7 h-7 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-amber-900 tracking-tight font-mono truncate">
                {formatINR(kpiData?.pending_approval || kpiData?.pending_commission)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Awaiting sign-off</span>
              </div>
            </div>

            {/* 3. Approved Commission */}
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-blue-600 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-blue-700 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Approved</span>
                <div className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-blue-900 tracking-tight font-mono truncate">
                {formatINR(kpiData?.approved_commission)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>Verified receivable</span>
              </div>
            </div>

            {/* 4. Total TDS Deducted */}
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-rose-500 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-rose-700 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">TDS (10%)</span>
                <div className="w-7 h-7 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                  <Percent className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-rose-900 tracking-tight font-mono truncate">
                {formatINR(kpiData?.tds_deducted)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Section 194D</span>
              </div>
            </div>

            {/* 5. Net Receivable */}
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-purple-600 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-purple-700 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Net Receivable</span>
                <div className="w-7 h-7 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                  <Landmark className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-purple-900 tracking-tight font-mono truncate">
                {formatINR(kpiData?.net_receivable)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-purple-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span>Gross − TDS</span>
              </div>
            </div>

            {/* 6. Actual Bank Received */}
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-emerald-600 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-emerald-700 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Bank Received</span>
                <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-900 tracking-tight font-mono truncate">
                {formatINR(kpiData?.actual_net_received)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Cleared in bank</span>
              </div>
            </div>

            {/* 7. Outstanding Commission */}
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-orange-500 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-orange-700 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Outstanding</span>
                <div className="w-7 h-7 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-orange-900 tracking-tight font-mono truncate">
                {formatINR(kpiData?.outstanding_commission)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-orange-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <span>Carrier uncollected</span>
              </div>
            </div>

            {/* 8. Reversed Commission */}
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-slate-400 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-600 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Reversed</span>
                <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                  <RotateCcw className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-slate-800 tracking-tight font-mono truncate">
                {formatINR(kpiData?.reversed_commission)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Clawed back</span>
              </div>
            </div>
          </div>

          {/* Sleek Action & Control Toolbar (Stage 1) */}
          <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">Stage 1 • Insurer Receivable Ledger</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-2xs">
                    Carrier Earnings
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Displays gross carrier earnings, Section 194D TDS withholding (10%), verified bank credits, and balance receivables.
                </p>
              </div>
            </div>

            {/* View Mode Switcher & Export Actions */}
            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
              {/* Segmented Table / Cards Toggle */}
              <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 shadow-inner">
                <button
                  type="button"
                  onClick={() => setCommViewMode("table")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    commViewMode === "table"
                      ? "bg-white text-indigo-900 shadow-xs font-black scale-[1.02]"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Detailed Financial Table View"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCommViewMode("cards")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    commViewMode === "cards"
                      ? "bg-white text-indigo-900 shadow-xs font-black scale-[1.02]"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Responsive Card View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
              </div>

              {/* Export Buttons */}
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl font-bold text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-2xs flex items-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>XLSX</span>
              </button>
            </div>
          </div>

          {/* Unified Filter Toolbar */}
          <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <div className="flex-1 max-w-md relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search policy #, policyholder name, phone..."
                  value={commSearch}
                  onChange={(e) => setCommSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (setCommPage(1), fetchCommissions())}
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
                />
                {commSearch && (
                  <button
                    onClick={() => { setCommSearch(""); setCommPage(1); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={commStatusFilter}
                  onChange={(e) => {
                    setCommStatusFilter(e.target.value);
                    setCommPage(1);
                  }}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                >
                  <option value="ALL">All Insurer Statuses</option>
                  <option value="PENDING">Pending Approval</option>
                  <option value="PARTIALLY_RECEIVED">Partially Received</option>
                  <option value="RECEIVED">Received (Full)</option>
                  <option value="SHORT_RECEIVED">Short Received</option>
                  <option value="EXCESS_RECEIVED">Excess Received</option>
                  <option value="DISPUTED">Disputed</option>
                  <option value="REVERSED">Reversed</option>
                </select>

                <select
                  value={commCompanyFilter}
                  onChange={(e) => {
                    setCommCompanyFilter(e.target.value);
                    setCommPage(1);
                  }}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                >
                  <option value="ALL">All Insurance Companies</option>
                  {companies.map((co) => (
                    <option key={co.id} value={co.id}>{co.name}</option>
                  ))}
                </select>

                <select
                  value={commCategoryFilter}
                  onChange={(e) => {
                    setCommCategoryFilter(e.target.value);
                    setCommPage(1);
                  }}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  {INSURANCE_CATEGORIES.map((cat) => (
                    <option key={cat.code} value={cat.code}>{cat.label}</option>
                  ))}
                </select>

                <select
                  value={commTypeFilter}
                  onChange={(e) => {
                    setCommTypeFilter(e.target.value);
                    setCommPage(1);
                  }}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                >
                  <option value="ALL">All Tiers (1st Year / Renewal)</option>
                  <option value="FIRST_YEAR">First Year</option>
                  <option value="RENEWAL">Renewal</option>
                  <option value="SPECIAL">Special</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Date Range:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">From:</span>
                <DatePicker
                  value={commFromDate}
                  onChange={(e) => {
                    setCommFromDate(e.target.value);
                    setCommPage(1);
                  }}
                  placeholder="DD-MM-YYYY"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">To:</span>
                <DatePicker
                  value={commToDate}
                  onChange={(e) => {
                    setCommToDate(e.target.value);
                    setCommPage(1);
                  }}
                  placeholder="DD-MM-YYYY"
                />
              </div>
              {(commFromDate || commToDate || commSearch || commStatusFilter !== "ALL" || commCompanyFilter !== "ALL" || commCategoryFilter !== "ALL" || commTypeFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setCommSearch("");
                    setCommStatusFilter("ALL");
                    setCommCompanyFilter("ALL");
                    setCommCategoryFilter("ALL");
                    setCommTypeFilter("ALL");
                    setCommFromDate("");
                    setCommToDate("");
                    setCommPage(1);
                  }}
                  className="text-indigo-600 hover:text-indigo-800 font-extrabold ml-auto text-xs flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* VIEW MODE 1: MODERN TABLE VIEW */}
          {commViewMode === "table" && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-3 sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">Policy</th>
                      <th className="py-3 px-3">Policyholder</th>
                      <th className="py-3 px-3">Carrier & Plan</th>
                      <th className="py-3 px-2.5 text-center">Tier</th>
                      <th className="py-3 px-3 text-right">Net Prem</th>
                      <th className="py-3 px-2 text-center">Rate</th>
                      <th className="py-3 px-3 text-right">Exp Gross</th>
                      <th className="py-3 px-3 text-right">Act Gross</th>
                      <th className="py-3 px-2 text-center">TDS</th>
                      <th className="py-3 px-3 text-right">TDS (10%)</th>
                      <th className="py-3 px-3 text-right">Net Receivable</th>
                      <th className="py-3 px-3 text-right">Bank Rcvd</th>
                      <th className="py-3 px-3 text-right">Balance Due</th>
                      <th className="py-3 px-2.5 text-center">Rcv Date</th>
                      <th className="py-3 px-2.5 text-center">Status</th>
                      <th className="py-3 px-3 text-right sticky right-0 bg-slate-50 z-20 shadow-[-2px_0_5px_rgba(0,0,0,0.03)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {commLoading ? (
                      <tr>
                        <td colSpan={16} className="py-14 text-center text-slate-400">
                          <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-indigo-600" />
                          <span className="font-semibold text-slate-600">Loading Insurer Commission Receivables...</span>
                        </td>
                      </tr>
                    ) : commissions.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="py-14 text-center text-slate-400">
                          <Landmark className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <div className="font-bold text-slate-600">No insurer commission records found</div>
                          <div className="text-xs text-slate-400 mt-0.5">Try adjusting your filters or search terms.</div>
                        </td>
                      </tr>
                    ) : (
                      commissions.map((c) => {
                        const netPrem = Number(c.net_premium_applied || 0);
                        const expRate = Number(c.gross_commission_rate || 0);
                        const expGross = Number(c.gross_commission_amount || 0);
                        const actGross = c.actual_gross_commission !== null && c.actual_gross_commission !== undefined ? Number(c.actual_gross_commission) : expGross;
                        const tdsRate = Number(c.tds_rate || 10);
                        const tdsDed = Number(c.tds_amount || 0);
                        const expNet = Number(c.net_commission_payable || 0);
                        const actRcvd = Number(c.actual_net_received || 0);
                        const balance = c.balance_receivable !== null && c.balance_receivable !== undefined
                          ? Number(c.balance_receivable)
                          : (expNet - actRcvd);
                        const rcvDate = c.actual_received_date || (c.receipts && c.receipts[0]?.receipt_date) || "-";

                        return (
                          <tr key={c.id} className="hover:bg-indigo-50/20 transition-colors group">
                            {/* Policy Number - Sticky Left */}
                            <td className="py-3 px-3 font-mono font-bold whitespace-nowrap sticky left-0 bg-white group-hover:bg-indigo-50/20 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                              <button
                                onClick={() => { setSelectedCommission(c); setDetailDrawerOpen(true); }}
                                className="text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1 font-black"
                              >
                                <span>{c.policy_number || "POL-PENDING"}</span>
                                <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                              </button>
                            </td>

                            {/* Policyholder */}
                            <td className="py-3 px-3 max-w-[130px] truncate">
                              <div className="font-bold text-slate-900 truncate">{c.customer_name || "Direct Client"}</div>
                              {c.customer_phone && <div className="text-[10px] text-slate-400 font-mono">{c.customer_phone}</div>}
                            </td>

                            {/* Carrier & Plan */}
                            <td className="py-3 px-3 max-w-[150px] truncate">
                              <div className="font-bold text-slate-800 truncate">{c.company_name || "-"}</div>
                              <div className="text-[10px] text-slate-500 truncate">{c.plan_name || c.policy_category || "Standard"}</div>
                            </td>

                            {/* Commission Tier */}
                            <td className="py-3 px-2.5 text-center whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide uppercase ${
                                c.commission_type === "RENEWAL"
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : "bg-blue-100 text-blue-800 border border-blue-200"
                              }`}>
                                {c.commission_type || "FIRST_YEAR"}
                              </span>
                            </td>

                            {/* Net Premium */}
                            <td className="py-3 px-3 text-right font-semibold text-slate-700 font-mono whitespace-nowrap">
                              {formatINR(netPrem)}
                            </td>

                            {/* Commission Rate (%) */}
                            <td className="py-3 px-2 text-center font-bold text-slate-600 whitespace-nowrap">
                              {expRate.toFixed(1)}%
                            </td>

                            {/* Expected Gross Commission */}
                            <td className="py-3 px-3 text-right font-medium text-slate-700 font-mono whitespace-nowrap">
                              {formatINR(expGross)}
                            </td>

                            {/* Actual Gross Commission */}
                            <td className="py-3 px-3 text-right font-bold text-indigo-700 font-mono whitespace-nowrap">
                              {formatINR(actGross)}
                            </td>

                            {/* TDS Rate (%) */}
                            <td className="py-3 px-2 text-center text-slate-500 font-medium whitespace-nowrap">
                              {tdsRate.toFixed(0)}%
                            </td>

                            {/* TDS Deducted (₹) */}
                            <td className="py-3 px-3 text-right font-medium text-rose-600 font-mono whitespace-nowrap">
                              {formatINR(tdsDed)}
                            </td>

                            {/* Expected Net Receivable */}
                            <td className="py-3 px-3 text-right font-black text-slate-900 font-mono whitespace-nowrap">
                              {formatINR(expNet)}
                            </td>

                            {/* Actual Bank Received (₹) */}
                            <td className="py-3 px-3 text-right font-black text-emerald-700 font-mono whitespace-nowrap">
                              {formatINR(actRcvd)}
                            </td>

                            {/* Balance Receivable (₹) */}
                            <td className={`py-3 px-3 text-right font-black font-mono whitespace-nowrap ${
                              balance > 0 ? "text-amber-700" : balance < 0 ? "text-purple-700" : "text-slate-400"
                            }`}>
                              {formatINR(balance)}
                            </td>

                            {/* Receipt Date */}
                            <td className="py-3 px-2.5 text-center text-slate-600 whitespace-nowrap text-[11px]">
                              {rcvDate}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-2.5 text-center whitespace-nowrap">
                              {renderInsurerStatusBadge(c.status)}
                            </td>

                            {/* Actions - Sticky Right */}
                            <td className="py-3 px-3 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-indigo-50/20 z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.03)]">
                              <div className="flex items-center justify-end gap-1">
                                {/* Detail Drawer */}
                                <button
                                  onClick={() => { setSelectedCommission(c); setDetailDrawerOpen(true); }}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                  title="View Comprehensive 14-Section Breakdown"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {/* Configure / Edit Commission Modal */}
                                {canMutate && c.status !== "REVERSED" && (
                                  <button
                                    onClick={() => handleOpenEditComm(c)}
                                    className="p-1.5 rounded-lg text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 transition-colors"
                                    title="Configure / Edit Commission & Manual Override"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Direct Approve Button for PENDING */}
                                {canMutate && c.status === "PENDING" && (
                                  <button
                                    onClick={() => handleApproveCommission(c)}
                                    className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-900 hover:bg-emerald-50 transition-colors"
                                    title="Approve Insurer Receivable"
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  </button>
                                )}

                                {/* Record Bank Receipt Modal */}
                                {canMutate && c.status !== "REVERSED" && (
                                  <button
                                    onClick={() => handleOpenReceiptModal(c)}
                                    className="p-1.5 rounded-lg text-teal-600 hover:text-teal-900 hover:bg-teal-50 transition-colors"
                                    title="Enter Actual Bank Credit & Reconcile"
                                  >
                                    <Receipt className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Dispute / Discrepancy Modal */}
                                {canMutate && c.status !== "REVERSED" && c.status !== "DISPUTED" && (
                                  <button
                                    onClick={() => handleOpenDispute(c)}
                                    className="p-1.5 rounded-lg text-purple-600 hover:text-purple-900 hover:bg-purple-50 transition-colors"
                                    title="Flag Discrepancy / Statement Dispute"
                                  >
                                    <AlertCircle className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Reverse Modal */}
                                {canMutate && c.status !== "REVERSED" && (
                                  <button
                                    onClick={() => handleOpenReverse(c)}
                                    className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                                    title="Reverse Commission with Audit Reason"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
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

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-500">
                <div>
                  Showing <span className="font-extrabold text-slate-800">{commissions.length}</span> of{" "}
                  <span className="font-extrabold text-slate-800">{totalCommissions}</span> insurer receivable records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={commPage <= 1}
                    onClick={() => setCommPage(commPage - 1)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 shadow-2xs transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <span className="px-2 font-black text-slate-800">{commPage} / {totalPagesCommissions}</span>
                  <button
                    disabled={commPage >= totalPagesCommissions}
                    onClick={() => setCommPage(commPage + 1)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 shadow-2xs transition-colors"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: RESPONSIVE CARDS VIEW (FOR MOBILE / TABLET / GRID ENTHUSIASTS) */}
          {commViewMode === "cards" && (
            <div className="space-y-4">
              {commLoading ? (
                <div className="p-14 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
                  <span className="font-semibold text-slate-600">Loading Insurer Commission Cards...</span>
                </div>
              ) : commissions.length === 0 ? (
                <div className="p-14 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
                  <Landmark className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <div className="font-bold text-slate-700 text-sm">No insurer commission records found</div>
                  <div className="text-xs text-slate-400 mt-1">Try adjusting your filters or search keywords.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {commissions.map((c) => {
                    const netPrem = Number(c.net_premium_applied || 0);
                    const expRate = Number(c.gross_commission_rate || 0);
                    const expGross = Number(c.gross_commission_amount || 0);
                    const actGross = c.actual_gross_commission !== null && c.actual_gross_commission !== undefined ? Number(c.actual_gross_commission) : expGross;
                    const tdsRate = Number(c.tds_rate || 10);
                    const tdsDed = Number(c.tds_amount || 0);
                    const expNet = Number(c.net_commission_payable || 0);
                    const actRcvd = Number(c.actual_net_received || 0);
                    const balance = c.balance_receivable !== null && c.balance_receivable !== undefined
                      ? Number(c.balance_receivable)
                      : (expNet - actRcvd);
                    const pctRcvd = expNet > 0 ? Math.min(100, Math.max(0, Math.round((actRcvd / expNet) * 100))) : 0;

                    return (
                      <div
                        key={c.id}
                        className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setSelectedCommission(c); setDetailDrawerOpen(true); }}
                                className="font-mono font-black text-sm text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1"
                              >
                                <span>{c.policy_number || "POL-PENDING"}</span>
                                <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
                              </button>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${
                                c.commission_type === "RENEWAL"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}>
                                {c.commission_type || "FIRST_YEAR"}
                              </span>
                            </div>
                            <div className="text-xs font-extrabold text-slate-800 mt-1">
                              {c.customer_name || "Direct Client"}
                              {c.customer_phone && <span className="font-normal font-mono text-slate-400 ml-1.5">({c.customer_phone})</span>}
                            </div>
                          </div>
                          <div>{renderInsurerStatusBadge(c.status)}</div>
                        </div>

                        {/* Carrier & Plan Details */}
                        <div className="flex items-center justify-between text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Insurance Carrier</span>
                            <span className="font-bold text-slate-800">{c.company_name || "-"}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Plan Variant</span>
                            <span className="font-semibold text-slate-700">{c.plan_name || c.policy_category || "Standard"}</span>
                          </div>
                        </div>

                        {/* Financial Metrics Grid */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 font-semibold block">Net Premium</span>
                            <span className="font-bold text-slate-800 font-mono mt-0.5 block">{formatINR(netPrem)}</span>
                            <span className="text-[9px] text-slate-400">{expRate.toFixed(1)}% rate</span>
                          </div>

                          <div className="p-2.5 bg-indigo-50/40 rounded-xl border border-indigo-100">
                            <span className="text-[10px] text-indigo-700 font-semibold block">Gross Comm</span>
                            <span className="font-black text-indigo-900 font-mono mt-0.5 block">{formatINR(actGross)}</span>
                            <span className="text-[9px] text-rose-600 font-medium font-mono">-{formatINR(tdsDed)} TDS</span>
                          </div>

                          <div className="p-2.5 bg-purple-50/40 rounded-xl border border-purple-100">
                            <span className="text-[10px] text-purple-700 font-semibold block">Net Receivable</span>
                            <span className="font-black text-purple-900 font-mono mt-0.5 block">{formatINR(expNet)}</span>
                            <span className="text-[9px] text-purple-600">after 10% TDS</span>
                          </div>
                        </div>

                        {/* Reconciliation Status Bar */}
                        <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Bank Credit Progress</span>
                            </span>
                            <span className="font-mono font-black text-emerald-700">{pctRcvd}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                              style={{ width: `${pctRcvd}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-0.5">
                            <span>Rcvd: <strong className="text-emerald-700">{formatINR(actRcvd)}</strong></span>
                            <span>Due: <strong className={balance > 0 ? "text-amber-700" : "text-slate-500"}>{formatINR(balance)}</strong></span>
                          </div>
                        </div>

                        {/* Card Actions Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <button
                            onClick={() => { setSelectedCommission(c); setDetailDrawerOpen(true); }}
                            className="text-xs font-extrabold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Breakdown</span>
                          </button>

                          <div className="flex items-center gap-1">
                            {canMutate && c.status !== "REVERSED" && (
                              <button
                                onClick={() => handleOpenEditComm(c)}
                                className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Edit Commission / Override"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {canMutate && c.status === "PENDING" && (
                              <button
                                onClick={() => handleApproveCommission(c)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 flex items-center gap-1 shadow-2xs transition-colors"
                                title="Approve Commission"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Approve</span>
                              </button>
                            )}

                            {canMutate && c.status !== "REVERSED" && (
                              <button
                                onClick={() => handleOpenReceiptModal(c)}
                                className="px-2.5 py-1 rounded-lg bg-teal-600 text-white text-[11px] font-bold hover:bg-teal-700 flex items-center gap-1 shadow-2xs transition-colors"
                                title="Record Bank Receipt"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>Receipt</span>
                              </button>
                            )}

                            {canMutate && c.status !== "REVERSED" && c.status !== "DISPUTED" && (
                              <button
                                onClick={() => handleOpenDispute(c)}
                                className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition-colors"
                                title="Flag Discrepancy"
                              >
                                <AlertCircle className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {canMutate && c.status !== "REVERSED" && (
                              <button
                                onClick={() => handleOpenReverse(c)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                                title="Reverse"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cards View Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-xs text-slate-500">
                <div>
                  Showing <span className="font-extrabold text-slate-800">{commissions.length}</span> of{" "}
                  <span className="font-extrabold text-slate-800">{totalCommissions}</span> insurer receivable records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={commPage <= 1}
                    onClick={() => setCommPage(commPage - 1)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 shadow-2xs transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <span className="px-2 font-black text-slate-800">{commPage} / {totalPagesCommissions}</span>
                  <button
                    disabled={commPage >= totalPagesCommissions}
                    onClick={() => setCommPage(commPage + 1)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 shadow-2xs transition-colors"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SUB-AGENT PAYOUT WORKFLOW (PHASE 4) */}
      {/* ========================================================================= */}
      {activeTab === "subagent_payouts" && (
        <div className="space-y-4">
          {/* Top 7 Summary Metrics for Stage 2 Sub-Agent Payouts */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-3.5">
            {/* 1. Insurer Gross */}
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-slate-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Insurer Gross</span>
                <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                  <Landmark className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-mono truncate">
                {formatINR(dashboardData?.firm_financial_position?.gross_insurer_commission || kpiData?.total_gross_commission)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                <span>Total carrier base</span>
              </div>
            </div>

            {/* 2. Insurer TDS */}
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-purple-600 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-purple-700 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Carrier TDS (10%)</span>
                <div className="w-7 h-7 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                  <Percent className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-purple-900 tracking-tight font-mono truncate">
                -{formatINR(dashboardData?.firm_financial_position?.insurer_tds_deducted || kpiData?.tds_deducted)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-purple-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span>Section 194D</span>
              </div>
            </div>

            {/* 3. Net Insurer Rcv */}
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-blue-600 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-blue-700 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Net Insurer Rcv</span>
                <div className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-blue-900 tracking-tight font-mono truncate">
                {formatINR(dashboardData?.firm_financial_position?.net_firm_revenue || kpiData?.net_receivable)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>Firm net revenue</span>
              </div>
            </div>

            {/* 4. Agent Payable */}
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-amber-500 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-amber-700 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Agent Payable</span>
                <div className="w-7 h-7 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-amber-900 tracking-tight font-mono truncate">
                {formatINR(dashboardData?.sub_agent_payables?.total_sub_agent_commission || kpiData?.sub_agent_payable)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Total obligations</span>
              </div>
            </div>

            {/* 5. Agent Paid */}
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-emerald-600 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-emerald-700 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Agent Paid</span>
                <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-900 tracking-tight font-mono truncate">
                {formatINR(dashboardData?.sub_agent_payables?.total_paid_to_agents)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Disbursed to agents</span>
              </div>
            </div>

            {/* 6. Agent Outstanding */}
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-rose-500 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-rose-700 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Outstanding</span>
                <div className="w-7 h-7 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-rose-900 tracking-tight font-mono truncate">
                {formatINR(dashboardData?.sub_agent_payables?.outstanding_agent_payables)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Unsettled liabilities</span>
              </div>
            </div>

            {/* 7. Firm Retained Net */}
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-teal-600 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-teal-700 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Firm Retained</span>
                <div className="w-7 h-7 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-teal-900 tracking-tight font-mono truncate">
                {formatINR(dashboardData?.firm_financial_position?.firm_retained_net || kpiData?.firm_retained_revenue)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-teal-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                <span>Firm net margin</span>
              </div>
            </div>
          </div>

          {/* Sleek Action & Control Toolbar (Stage 2) */}
          <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-teal-500/20 shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">Stage 2 • Sub-Agent Payout Obligations</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200/60 shadow-2xs">
                    Broker Split Liabilities
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Displays broker split obligations, Section 194H TDS withholding, authorized disbursements, and outstanding liabilities.
                </p>
              </div>
            </div>

            {/* View Mode Switcher & Export Actions */}
            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
              {/* Segmented Table / Cards Toggle */}
              <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 shadow-inner">
                <button
                  type="button"
                  onClick={() => setPayoutViewMode("table")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    payoutViewMode === "table"
                      ? "bg-white text-teal-900 shadow-xs font-black scale-[1.02]"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Detailed Financial Table View"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutViewMode("cards")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    payoutViewMode === "cards"
                      ? "bg-white text-teal-900 shadow-xs font-black scale-[1.02]"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Responsive Card View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
              </div>

              {/* Export Button */}
              <button
                type="button"
                onClick={() => handleDownloadReport("report_4_sub_agent_payables", "csv")}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl font-bold text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-2xs flex items-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Unified Filter Toolbar for Sub-Agent Payouts */}
          <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <div className="flex-1 max-w-md relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search policy #, agent name, phone..."
                  value={payoutSearch}
                  onChange={(e) => setPayoutSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (setPayoutPage(1), fetchPayouts())}
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium text-slate-800"
                />
                {payoutSearch && (
                  <button
                    onClick={() => { setPayoutSearch(""); setPayoutPage(1); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={payoutStatusFilter}
                  onChange={(e) => {
                    setPayoutStatusFilter(e.target.value);
                    setPayoutPage(1);
                  }}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all cursor-pointer"
                >
                  <option value="ALL">All Payout Statuses</option>
                  <option value="PENDING">Pending Approval</option>
                  <option value="APPROVED">Approved (Ready for Payment)</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="PAID">Fully Paid</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="REVERSED">Reversed</option>
                </select>

                <select
                  value={payoutAgentFilter}
                  onChange={(e) => {
                    setPayoutAgentFilter(e.target.value);
                    setPayoutPage(1);
                  }}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all cursor-pointer"
                >
                  <option value="ALL">All Sub-Agents</option>
                  {subAgents.map((sa) => (
                    <option key={sa.id} value={sa.id}>{sa.full_name} ({sa.agent_code})</option>
                  ))}
                </select>

                <select
                  value={payoutCompanyFilter}
                  onChange={(e) => {
                    setPayoutCompanyFilter(e.target.value);
                    setPayoutPage(1);
                  }}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all cursor-pointer"
                >
                  <option value="ALL">All Insurance Carriers</option>
                  {companies.map((co) => (
                    <option key={co.id} value={co.id}>{co.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Date Range:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">From:</span>
                <DatePicker
                  value={payoutFromDate}
                  onChange={(e) => {
                    setPayoutFromDate(e.target.value);
                    setPayoutPage(1);
                  }}
                  placeholder="DD-MM-YYYY"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">To:</span>
                <DatePicker
                  value={payoutToDate}
                  onChange={(e) => {
                    setPayoutToDate(e.target.value);
                    setPayoutPage(1);
                  }}
                  placeholder="DD-MM-YYYY"
                />
              </div>
              {(payoutFromDate || payoutToDate || payoutSearch || payoutStatusFilter !== "ALL" || payoutAgentFilter !== "ALL" || payoutCompanyFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setPayoutSearch("");
                    setPayoutStatusFilter("ALL");
                    setPayoutAgentFilter("ALL");
                    setPayoutCompanyFilter("ALL");
                    setPayoutFromDate("");
                    setPayoutToDate("");
                    setPayoutPage(1);
                  }}
                  className="text-teal-600 hover:text-teal-800 font-extrabold ml-auto text-xs flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-teal-50 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* VIEW MODE 1: MODERN SUB-AGENT PAYOUT TABLE */}
          {payoutViewMode === "table" && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-3 sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">Policy</th>
                      <th className="py-3 px-3">Policyholder</th>
                      <th className="py-3 px-3">Carrier</th>
                      <th className="py-3 px-3">Sub-Agent</th>
                      <th className="py-3 px-2.5 text-center">Tier</th>
                      <th className="py-3 px-3 text-right">Insurer Gross</th>
                      <th className="py-3 px-2 text-center">Split %</th>
                      <th className="py-3 px-3 text-right">Agent Payable</th>
                      <th className="py-3 px-3 text-right">Already Paid</th>
                      <th className="py-3 px-3 text-right">Remaining</th>
                      <th className="py-3 px-2.5 text-center">Payout Date</th>
                      <th className="py-3 px-2.5 text-center">Status</th>
                      <th className="py-3 px-3 text-right sticky right-0 bg-slate-50 z-20 shadow-[-2px_0_5px_rgba(0,0,0,0.03)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payoutLoading ? (
                      <tr>
                        <td colSpan={13} className="py-14 text-center text-slate-400">
                          <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-teal-600" />
                          <span className="font-semibold text-slate-600">Loading Sub-Agent Payout records...</span>
                        </td>
                      </tr>
                    ) : payouts.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="py-14 text-center text-slate-400">
                          <UserCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <div className="font-bold text-slate-600">No sub-agent payout obligations found</div>
                          <div className="text-xs text-slate-400 mt-0.5">Try adjusting your filters or search terms.</div>
                        </td>
                      </tr>
                    ) : (
                      payouts.map((p) => {
                        const pDate = p.payout_date || (p.payments && p.payments[0]?.payment_date) || "-";
                        return (
                          <tr key={p.id} className="hover:bg-teal-50/20 transition-colors group">
                            {/* Policy Number - Sticky Left */}
                            <td className="py-3 px-3 font-mono font-bold whitespace-nowrap sticky left-0 bg-white group-hover:bg-teal-50/20 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.03)] text-slate-900">
                              <span className="font-black text-slate-900">{p.policy_number}</span>
                            </td>

                            {/* Policyholder */}
                            <td className="py-3 px-3 max-w-[130px] truncate">
                              <span className="font-semibold text-slate-800">{p.customer_name || "Direct Client"}</span>
                            </td>

                            {/* Insurance Carrier */}
                            <td className="py-3 px-3 font-medium text-slate-700 max-w-[130px] truncate">
                              {p.company_name || "-"}
                            </td>

                            {/* Sub-Agent Name */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="font-bold text-slate-900">{p.sub_agent_name}</div>
                              {p.sub_agent_code && <div className="text-[10px] text-slate-400 font-mono">{p.sub_agent_code}</div>}
                            </td>

                            {/* Commission Type */}
                            <td className="py-3 px-2.5 text-center whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${
                                p.commission_type === "RENEWAL"
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : "bg-blue-100 text-blue-800 border border-blue-200"
                              }`}>
                                {p.commission_type || "FIRST_YEAR"}
                              </span>
                            </td>

                            {/* Insurer Gross Commission */}
                            <td className="py-3 px-3 text-right font-medium text-slate-700 font-mono whitespace-nowrap">
                              {formatINR(p.insurer_gross_commission)}
                            </td>

                            {/* Agreed Sub-Agent Percentage (%) */}
                            <td className="py-3 px-2 text-center font-bold text-teal-700 whitespace-nowrap">
                              {Number(p.agreed_sub_agent_percentage || 0).toFixed(1)}%
                            </td>

                            {/* Sub-Agent Payable Amount (₹) */}
                            <td className="py-3 px-3 text-right font-black text-slate-900 font-mono whitespace-nowrap">
                              {formatINR(p.sub_agent_payable_amount)}
                            </td>

                            {/* Amount Already Paid (₹) */}
                            <td className="py-3 px-3 text-right font-bold text-emerald-700 font-mono whitespace-nowrap">
                              {formatINR(p.amount_already_paid)}
                            </td>

                            {/* Remaining Payable (₹) */}
                            <td className={`py-3 px-3 text-right font-black font-mono whitespace-nowrap ${
                              Number(p.remaining_payable) > 0 ? "text-amber-700" : "text-slate-400"
                            }`}>
                              {formatINR(p.remaining_payable)}
                            </td>

                            {/* Payout Date */}
                            <td className="py-3 px-2.5 text-center text-slate-600 whitespace-nowrap text-[11px]">
                              {pDate}
                            </td>

                            {/* Payout Status */}
                            <td className="py-3 px-2.5 text-center whitespace-nowrap">
                              {renderPayoutStatusBadge(p.payout_status)}
                            </td>

                            {/* Actions - Sticky Right */}
                            <td className="py-3 px-3 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-teal-50/20 z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.03)]">
                              <div className="flex items-center justify-end gap-1">
                                {/* Detail Modal */}
                                <button
                                  onClick={() => { setSelectedPayout(p); setPayoutDetailModalOpen(true); }}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                  title="View Payout Breakdown & Payment History"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {/* Configure / Edit Sub-Agent Allocation */}
                                {canMutate && p.payout_status !== "REVERSED" && p.payout_status !== "PAID" && (
                                  <button
                                    onClick={() => handleOpenEditPayout(p)}
                                    className="p-1.5 rounded-lg text-teal-600 hover:text-teal-900 hover:bg-teal-50 transition-colors"
                                    title="Configure / Override Sub-Agent Commission Split"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Approve Button */}
                                {canMutate && p.payout_status === "PENDING" && (
                                  <button
                                    onClick={() => handleApprovePayout(p)}
                                    className="p-1.5 rounded-lg text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-colors"
                                    title="Approve Sub-Agent Payout"
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  </button>
                                )}

                                {/* Record Payment Button */}
                                {canMutate && ["APPROVED", "PARTIALLY_PAID"].includes(p.payout_status) && (
                                  <button
                                    onClick={() => handleOpenPayoutPayment(p)}
                                    className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-900 hover:bg-emerald-50 transition-colors"
                                    title="Disburse / Record Sub-Agent Payment"
                                  >
                                    <CreditCard className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Put On Hold */}
                                {canMutate && ["PENDING", "APPROVED", "PARTIALLY_PAID"].includes(p.payout_status) && (
                                  <button
                                    onClick={() => handleHoldPayout(p)}
                                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                    title="Place Payout On Hold"
                                  >
                                    <PauseCircle className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Reverse Payout */}
                                {canMutate && p.payout_status !== "REVERSED" && (
                                  <button
                                    onClick={() => handleOpenPayoutReverse(p)}
                                    className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                                    title="Reverse Payout with Reason"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
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

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-500">
                <div>
                  Showing <span className="font-extrabold text-slate-800">{payouts.length}</span> of{" "}
                  <span className="font-extrabold text-slate-800">{totalPayouts}</span> sub-agent payout obligations
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={payoutPage <= 1}
                    onClick={() => setPayoutPage(payoutPage - 1)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 shadow-2xs transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <span className="px-2 font-black text-slate-800">{payoutPage} / {totalPagesPayouts}</span>
                  <button
                    disabled={payoutPage >= totalPagesPayouts}
                    onClick={() => setPayoutPage(payoutPage + 1)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 shadow-2xs transition-colors"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: RESPONSIVE CARDS VIEW FOR SUB-AGENT PAYOUTS */}
          {payoutViewMode === "cards" && (
            <div className="space-y-4">
              {payoutLoading ? (
                <div className="p-14 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-teal-600" />
                  <span className="font-semibold text-slate-600">Loading Sub-Agent Payout Cards...</span>
                </div>
              ) : payouts.length === 0 ? (
                <div className="p-14 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
                  <UserCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <div className="font-bold text-slate-700 text-sm">No sub-agent payout obligations found</div>
                  <div className="text-xs text-slate-400 mt-1">Try adjusting your filters or search keywords.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {payouts.map((p) => {
                    const payable = Number(p.sub_agent_payable_amount || 0);
                    const paid = Number(p.amount_already_paid || 0);
                    const remaining = Number(p.remaining_payable || 0);
                    const pctPaid = payable > 0 ? Math.min(100, Math.max(0, Math.round((paid / payable) * 100))) : 0;

                    return (
                      <div
                        key={p.id}
                        className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-slate-900">{p.policy_number}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${
                                p.commission_type === "RENEWAL"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}>
                                {p.commission_type || "FIRST_YEAR"}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-slate-600 mt-1">
                              Client: <strong className="text-slate-800">{p.customer_name || "Direct"}</strong> • Carrier: <strong className="text-slate-800">{p.company_name || "-"}</strong>
                            </div>
                          </div>
                          <div>{renderPayoutStatusBadge(p.payout_status)}</div>
                        </div>

                        {/* Sub-Agent Details Badge */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-teal-50/50 border border-teal-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                              {p.sub_agent_name ? p.sub_agent_name.charAt(0) : "A"}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 text-xs block">{p.sub_agent_name}</span>
                              <span className="text-[10px] text-teal-700 font-mono font-semibold">{p.sub_agent_code}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Split Rate</span>
                            <span className="font-black text-teal-800 text-sm font-mono">{Number(p.agreed_sub_agent_percentage || 0).toFixed(1)}%</span>
                          </div>
                        </div>

                        {/* Financial Figures */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 font-semibold block">Insurer Gross</span>
                            <span className="font-bold text-slate-800 font-mono mt-0.5 block">{formatINR(p.insurer_gross_commission)}</span>
                          </div>

                          <div className="p-2.5 bg-amber-50/40 rounded-xl border border-amber-100">
                            <span className="text-[10px] text-amber-700 font-semibold block">Total Payable</span>
                            <span className="font-black text-amber-900 font-mono mt-0.5 block">{formatINR(p.sub_agent_payable_amount)}</span>
                          </div>

                          <div className="p-2.5 bg-emerald-50/40 rounded-xl border border-emerald-100">
                            <span className="text-[10px] text-emerald-700 font-semibold block">Already Paid</span>
                            <span className="font-black text-emerald-900 font-mono mt-0.5 block">{formatINR(p.amount_already_paid)}</span>
                          </div>
                        </div>

                        {/* Disbursement Progress Bar */}
                        <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                              <Wallet className="w-3.5 h-3.5 text-teal-600" />
                              <span>Disbursement Progress</span>
                            </span>
                            <span className="font-mono font-black text-teal-700">{pctPaid}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300"
                              style={{ width: `${pctPaid}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-0.5">
                            <span>Paid: <strong className="text-emerald-700">{formatINR(paid)}</strong></span>
                            <span>Remaining: <strong className={remaining > 0 ? "text-amber-700" : "text-slate-500"}>{formatINR(remaining)}</strong></span>
                          </div>
                        </div>

                        {/* Card Actions Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <button
                            onClick={() => { setSelectedPayout(p); setPayoutDetailModalOpen(true); }}
                            className="text-xs font-extrabold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>

                          <div className="flex items-center gap-1">
                            {canMutate && p.payout_status !== "REVERSED" && p.payout_status !== "PAID" && (
                              <button
                                onClick={() => handleOpenEditPayout(p)}
                                className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors"
                                title="Edit Split"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {canMutate && p.payout_status === "PENDING" && (
                              <button
                                onClick={() => handleApprovePayout(p)}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 flex items-center gap-1 shadow-2xs transition-colors"
                                title="Approve Payout"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Approve</span>
                              </button>
                            )}

                            {canMutate && ["APPROVED", "PARTIALLY_PAID"].includes(p.payout_status) && (
                              <button
                                onClick={() => handleOpenPayoutPayment(p)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 flex items-center gap-1 shadow-2xs transition-colors"
                                title="Disburse Payment"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Pay</span>
                              </button>
                            )}

                            {canMutate && ["PENDING", "APPROVED", "PARTIALLY_PAID"].includes(p.payout_status) && (
                              <button
                                onClick={() => handleHoldPayout(p)}
                                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                                title="Hold"
                              >
                                <PauseCircle className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {canMutate && p.payout_status !== "REVERSED" && (
                              <button
                                onClick={() => handleOpenPayoutReverse(p)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                                title="Reverse"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cards View Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-xs text-slate-500">
                <div>
                  Showing <span className="font-extrabold text-slate-800">{payouts.length}</span> of{" "}
                  <span className="font-extrabold text-slate-800">{totalPayouts}</span> sub-agent payout obligations
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={payoutPage <= 1}
                    onClick={() => setPayoutPage(payoutPage - 1)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 shadow-2xs transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <span className="px-2 font-black text-slate-800">{payoutPage} / {totalPagesPayouts}</span>
                  <button
                    disabled={payoutPage >= totalPagesPayouts}
                    onClick={() => setPayoutPage(payoutPage + 1)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 shadow-2xs transition-colors"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AGENT PERFORMANCE TAB */}
      {/* ========================================================================= */}
      {activeTab === "agent_performance" && (
        <div className="space-y-4">
          {/* Top 4 Production Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-emerald-600 shadow-xs hover:shadow-md transition-all duration-200">
              <span className="text-[10px] font-black uppercase text-slate-500 block">Active Channels</span>
              <p className="text-lg sm:text-xl font-black text-slate-900 mt-1 font-mono">{agentPerformanceData.length}</p>
              <span className="text-[10px] text-slate-400">Direct & Sub-Agents</span>
            </div>

            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-blue-600 shadow-xs hover:shadow-md transition-all duration-200">
              <span className="text-[10px] font-black uppercase text-slate-500 block">Total Policies</span>
              <p className="text-lg sm:text-xl font-black text-blue-900 mt-1 font-mono">
                {agentPerformanceData.reduce((acc, curr) => acc + (Number(curr.total_policies) || 0), 0)}
              </p>
              <span className="text-[10px] text-blue-600">Issued volume</span>
            </div>

            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-indigo-600 shadow-xs hover:shadow-md transition-all duration-200">
              <span className="text-[10px] font-black uppercase text-slate-500 block">Gross Production</span>
              <p className="text-lg sm:text-xl font-black text-indigo-900 mt-1 font-mono truncate">
                {formatINR(agentPerformanceData.reduce((acc, curr) => acc + (Number(curr.gross_commission) || 0), 0))}
              </p>
              <span className="text-[10px] text-indigo-600">Carrier gross</span>
            </div>

            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-amber-500 shadow-xs hover:shadow-md transition-all duration-200">
              <span className="text-[10px] font-black uppercase text-slate-500 block">Pending Payouts</span>
              <p className="text-lg sm:text-xl font-black text-amber-900 mt-1 font-mono truncate">
                {formatINR(agentPerformanceData.reduce((acc, curr) => acc + (Number(curr.pending_payout) || 0), 0))}
              </p>
              <span className="text-[10px] text-amber-600">Pending disbursement</span>
            </div>
          </div>

          {/* Control Banner */}
          <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
                <PieChart className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">Sub-Agent Portfolio Performance</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
                    Production Metrics
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Aggregated production volume, gross earned commissions, Section 194H TDS withholding, cleared payments, and outstanding broker balances.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDownloadReport("report_7_agent_wise", "csv")}
              className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl font-bold text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-2xs flex items-center gap-1.5 shrink-0 transition-all self-start md:self-auto"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export Agent Summary</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-3 sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">Sub-Agent / Channel</th>
                    <th className="py-3 px-2.5 text-center">Policies</th>
                    <th className="py-3 px-3 text-right">Gross Commission</th>
                    <th className="py-3 px-2 text-center">Avg Rate</th>
                    <th className="py-3 px-3 text-right">Agent Gross Share</th>
                    <th className="py-3 px-3 text-right">TDS Withheld (5%)</th>
                    <th className="py-3 px-3 text-right">Net Payable</th>
                    <th className="py-3 px-3 text-right">Already Paid</th>
                    <th className="py-3 px-3 text-right">Pending Payout</th>
                    <th className="py-3 px-3 text-right sticky right-0 bg-slate-50 z-20 shadow-[-2px_0_5px_rgba(0,0,0,0.03)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agentPerfLoading ? (
                    <tr>
                      <td colSpan={10} className="py-14 text-center text-slate-400">
                        <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-emerald-600" />
                        <span className="font-semibold text-slate-600">Aggregating agent production performance...</span>
                      </td>
                    </tr>
                  ) : agentPerformanceData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-14 text-center text-slate-400">
                        <PieChart className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <div className="font-bold text-slate-600">No agent performance data recorded yet</div>
                        <div className="text-xs text-slate-400 mt-0.5">Policy issuance with assigned sub-agents will populate this report.</div>
                      </td>
                    </tr>
                  ) : (
                    agentPerformanceData.map((ag, idx) => (
                      <tr key={ag.agent_id || idx} className="hover:bg-emerald-50/20 transition-colors group">
                        <td className="py-3 px-3 whitespace-nowrap sticky left-0 bg-white group-hover:bg-emerald-50/20 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900">{ag.agent_name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{ag.agent_code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2.5 text-center font-bold text-slate-700 font-mono">
                          {ag.total_policies}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-slate-800 font-mono">
                          {formatINR(ag.gross_commission)}
                        </td>
                        <td className="py-3 px-2 text-center font-semibold text-slate-600">
                          {Number(ag.average_commission_rate || 0).toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 text-right font-black text-teal-800 font-mono">
                          {formatINR(ag.sub_agent_share)}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-rose-600 font-mono">
                          {formatINR(ag.sub_agent_tds)}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-slate-900 font-mono">
                          {formatINR(ag.net_payable)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-700 font-mono">
                          {formatINR(ag.actual_paid)}
                        </td>
                        <td className={`py-3 px-3 text-right font-black font-mono ${
                          Number(ag.pending_payout) > 0 ? "text-amber-700" : "text-slate-400"
                        }`}>
                          {formatINR(ag.pending_payout)}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-emerald-50/20 z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.03)]">
                          <button
                            onClick={() => {
                              if (ag.agent_name && ag.agent_name !== "Main Firm Direct (Internal)") {
                                setPayoutSearch(ag.agent_name);
                              }
                              setActiveTab("subagent_payouts");
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200/80 rounded-lg hover:bg-teal-100 transition-colors shadow-2xs"
                          >
                            View Payouts →
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: FINANCIAL DASHBOARD (PHASE 5) */}
      {/* ========================================================================= */}
      {activeTab === "financial_dashboard" && (
        <div className="space-y-6">
          {dashboardLoading ? (
            <div className="p-12 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
              Aggregating Firm Financial Metrics & Reconciliations...
            </div>
          ) : !dashboardData ? (
            <div className="p-12 text-center text-slate-400">
              No financial metrics available.
            </div>
          ) : (
            <>
              {/* SECTION A: INSURER COMMISSION RECEIVABLE */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-extrabold text-slate-900">
                    A. Insurer Commission Receivable (Incoming Money from Insurers)
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Exp Gross</span>
                    <p className="text-base font-black text-slate-900 mt-1">{formatINR(dashboardData.insurer_receivables?.total_expected_gross)}</p>
                    <span className="text-[9px] text-slate-400">Policy Contracts</span>
                  </div>

                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-purple-700 uppercase block">Total Exp TDS</span>
                    <p className="text-base font-black text-purple-900 mt-1">{formatINR(dashboardData.insurer_receivables?.total_expected_tds)}</p>
                    <span className="text-[9px] text-purple-600">Section 194D</span>
                  </div>

                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-blue-700 uppercase block">Exp Net Receivable</span>
                    <p className="text-base font-black text-blue-900 mt-1">{formatINR(dashboardData.insurer_receivables?.expected_net_receivable)}</p>
                    <span className="text-[9px] text-blue-600">Gross - TDS</span>
                  </div>

                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Actual Bank Received</span>
                    <p className="text-base font-black text-emerald-900 mt-1">{formatINR(dashboardData.insurer_receivables?.actual_bank_received)}</p>
                    <span className="text-[9px] text-emerald-600">Credited to Bank</span>
                  </div>

                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-amber-700 uppercase block">Outstanding Receivable</span>
                    <p className="text-base font-black text-amber-900 mt-1">{formatINR(dashboardData.insurer_receivables?.outstanding_receivable)}</p>
                    <span className="text-[9px] text-amber-600">Balance Uncollected</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Pending Insurer Comm</span>
                    <p className="text-base font-black text-slate-800 mt-1">{formatINR(dashboardData.insurer_receivables?.pending_insurer_commission)}</p>
                    <span className="text-[9px] text-slate-400">Awaiting Remittance</span>
                  </div>

                  <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-teal-700 uppercase block">Partially Received</span>
                    <p className="text-base font-black text-teal-900 mt-1">{formatINR(dashboardData.insurer_receivables?.partially_received)}</p>
                    <span className="text-[9px] text-teal-600">Partial Receipts</span>
                  </div>

                  <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-rose-700 uppercase block">Discrepancies</span>
                    <p className="text-base font-black text-rose-900 mt-1">{formatINR(dashboardData.insurer_receivables?.reconciliation_discrepancies)}</p>
                    <span className="text-[9px] text-rose-600">Short / Excess Variances</span>
                  </div>
                </div>
              </div>

              {/* SECTION B: SUB-AGENT PAYABLES */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-teal-600" />
                  <h3 className="text-base font-extrabold text-slate-900">
                    B. Sub-Agent Payables (Outgoing Liabilities Payable to Agents)
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Agent Comm</span>
                    <p className="text-base font-black text-slate-900 mt-1">{formatINR(dashboardData.sub_agent_payables?.total_sub_agent_commission)}</p>
                    <span className="text-[9px] text-slate-400">Total Obligations</span>
                  </div>

                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-amber-700 uppercase block">Pending Approval</span>
                    <p className="text-base font-black text-amber-900 mt-1">{formatINR(dashboardData.sub_agent_payables?.pending_approval)}</p>
                    <span className="text-[9px] text-amber-600">Awaiting Manager Review</span>
                  </div>

                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-blue-700 uppercase block">Approved Payables</span>
                    <p className="text-base font-black text-blue-900 mt-1">{formatINR(dashboardData.sub_agent_payables?.approved_payables)}</p>
                    <span className="text-[9px] text-blue-600">Authorized for Payment</span>
                  </div>

                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Total Paid to Agents</span>
                    <p className="text-base font-black text-emerald-900 mt-1">{formatINR(dashboardData.sub_agent_payables?.total_paid_to_agents)}</p>
                    <span className="text-[9px] text-emerald-600">Disbursed via Bank/UPI</span>
                  </div>

                  <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-rose-700 uppercase block">Outstanding Payables</span>
                    <p className="text-base font-black text-rose-900 mt-1">{formatINR(dashboardData.sub_agent_payables?.outstanding_agent_payables)}</p>
                    <span className="text-[9px] text-rose-600">Unsettled Liabilities</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Reversed Payouts</span>
                    <p className="text-base font-black text-slate-700 mt-1">{formatINR(dashboardData.sub_agent_payables?.reversed_payouts)}</p>
                    <span className="text-[9px] text-slate-400">Clawed Back / Void</span>
                  </div>
                </div>
              </div>

              {/* SECTION C: FIRM FINANCIAL POSITION */}
              <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-2xl text-white shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="font-extrabold text-sm sm:text-base tracking-tight">
                        C. Firm Financial Position & Comprehensive Reconciliation
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Consolidated net agency position reconciling insurer receivables and sub-agent liabilities without double-counting TDS or splits.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Audited Position
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">1. Gross Insurer Comm</span>
                    <p className="text-base font-black text-white mt-1">{formatINR(dashboardData.firm_financial_position?.gross_insurer_commission)}</p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">2. Insurer TDS Deducted</span>
                    <p className="text-base font-black text-rose-400 mt-1">-{formatINR(dashboardData.firm_financial_position?.insurer_tds_deducted)}</p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">3. Actual Bank Credit</span>
                    <p className="text-base font-black text-emerald-400 mt-1">{formatINR(dashboardData.firm_financial_position?.actual_bank_credit)}</p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">4. Sub-Agent Payable</span>
                    <p className="text-base font-black text-amber-300 mt-1">{formatINR(dashboardData.firm_financial_position?.sub_agent_payable)}</p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">5. Sub-Agent Paid</span>
                    <p className="text-base font-black text-teal-300 mt-1">{formatINR(dashboardData.firm_financial_position?.sub_agent_amount_paid)}</p>
                  </div>

                  <div className="p-3 bg-white/10 rounded-xl border border-emerald-500/30">
                    <span className="text-emerald-300 text-[10px] uppercase font-bold block">6. Remaining Liability</span>
                    <p className="text-base font-black text-amber-400 mt-1">{formatINR(dashboardData.firm_financial_position?.remaining_sub_agent_liability)}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-300 gap-2">
                  <div>
                    <span className="text-slate-400">Firm Net Retained Earnings (Gross minus Sub-Agent Share): </span>
                    <strong className="text-emerald-300 font-mono text-sm ml-1">
                      {formatINR(dashboardData.firm_financial_position?.firm_net_retained_revenue)}
                    </strong>
                  </div>
                  <div className="text-[11px] text-slate-400 italic">
                    All calculations grounded in Decimal precision from PostgreSQL.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: REPORTS & EXPORTS (PHASE 8) */}
      {/* ========================================================================= */}
      {activeTab === "reports_exports" && (
        <div className="space-y-6">
          {/* Filter Bar for Reports */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-purple-600" />
                <span>Global Report Filter Criteria (Applied to all CSV and XLSX downloads)</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">From Date</label>
                <DatePicker
                  value={exportFilters.from_date}
                  onChange={(e) => setExportFilters({ ...exportFilters, from_date: e.target.value })}
                  placeholder="DD-MM-YYYY"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold">To Date</label>
                <DatePicker
                  value={exportFilters.to_date}
                  onChange={(e) => setExportFilters({ ...exportFilters, to_date: e.target.value })}
                  placeholder="DD-MM-YYYY"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Insurance Carrier</label>
                <select
                  value={exportFilters.company_id}
                  onChange={(e) => setExportFilters({ ...exportFilters, company_id: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="ALL">All Companies</option>
                  {companies.map((co) => (
                    <option key={co.id} value={co.id}>{co.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Sub-Agent</label>
                <select
                  value={exportFilters.agent_id}
                  onChange={(e) => setExportFilters({ ...exportFilters, agent_id: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="ALL">All Sub-Agents</option>
                  {subAgents.map((sa) => (
                    <option key={sa.id} value={sa.id}>{sa.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Search / Policy #</label>
                <input
                  type="text"
                  placeholder="Filter by keyword..."
                  value={exportFilters.search}
                  onChange={(e) => setExportFilters({ ...exportFilters, search: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>
            </div>
          </div>

          {/* 8 Dedicated Report Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                key: "report_1_insurer_receivables",
                num: "Report 1",
                title: "Insurer Commission Receivable Report",
                desc: "Complete ledger of money receivable from insurance carriers per issued policy with expected & actual rates, TDS, and balance.",
                icon: Landmark,
                color: "blue",
              },
              {
                key: "report_2_insurer_bank_receipts",
                num: "Report 2",
                title: "Insurer Bank Receipt Report",
                desc: "Audit log of all bank credit transactions from carriers with UTR numbers, account numbers, and credit dates.",
                icon: Receipt,
                color: "emerald",
              },
              {
                key: "report_3_insurer_tds_194d",
                num: "Report 3",
                title: "Insurer TDS Report (Section 194D)",
                desc: "Withholding tax deductions by insurance companies under Section 194D for quarterly 26AS/TDS reconciliation.",
                icon: Shield,
                color: "purple",
              },
              {
                key: "report_4_sub_agent_payables",
                num: "Report 4",
                title: "Sub-Agent Payable Report",
                desc: "Outstanding and settled commission obligations payable by FinNexus to its sub-agent network.",
                icon: UserCheck,
                color: "teal",
              },
              {
                key: "report_5_sub_agent_payment_history",
                num: "Report 5",
                title: "Sub-Agent Payment History",
                desc: "Itemized disbursement history of all outgoing payments made to sub-agents with payment mode, UTR, and proof refs.",
                icon: CreditCard,
                color: "indigo",
              },
              {
                key: "report_6_policy_wise_commission",
                num: "Report 6",
                title: "Policy-wise Commission Report",
                desc: "Policy-level comparison of net premium, insurer gross commission, TDS, agent share, and net firm margin.",
                icon: FileCheck,
                color: "amber",
              },
              {
                key: "report_7_agent_wise_commission",
                num: "Report 7",
                title: "Agent-wise Commission Report",
                desc: "Sub-agent aggregation showing policy counts, total premium sourced, gross share earned, amount paid, and balance due.",
                icon: Layers,
                color: "sky",
              },
              {
                key: "report_8_financial_reconciliation",
                num: "Report 8",
                title: "Financial Reconciliation Report",
                desc: "Discrepancy and balance analysis reconciling carrier receivables against sub-agent payables and bank credits.",
                icon: BadgeIndianRupee,
                color: "rose",
              },
            ].map((rep) => {
              const Icon = rep.icon;
              const isCsvDownloading = downloadingReport === `${rep.key}_csv`;
              const isXlsxDownloading = downloadingReport === `${rep.key}_xlsx`;

              return (
                <div key={rep.key} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                        {rep.num}
                      </span>
                      <Icon className="w-4 h-4 text-slate-400" />
                    </div>
                    <h4 className="font-extrabold text-xs text-slate-900 leading-tight">
                      {rep.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {rep.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadReport(rep.key, "csv")}
                      disabled={Boolean(downloadingReport)}
                      className="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-50 flex items-center justify-center gap-1 transition-all"
                    >
                      {isCsvDownloading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <span>CSV</span>
                    </button>

                    <button
                      onClick={() => handleDownloadReport(rep.key, "xlsx")}
                      disabled={Boolean(downloadingReport)}
                      className="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50/80 border border-emerald-200 hover:bg-emerald-100/80 disabled:opacity-50 flex items-center justify-center gap-1 transition-all"
                    >
                      {isXlsxDownloading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>XLSX</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: INSURER AGREEMENTS */}
      {/* ========================================================================= */}
      {activeTab === "agreements" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Carrier Commission Agreements & Rate Matrix
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Define first-year & renewal commission rates, premium basis, and TDS withholding rates per insurance company.
              </p>
            </div>
            {canMutate && (
              <button
                onClick={() => setAgreementModalOpen(true)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm shadow-emerald-500/25 flex items-center gap-2 shrink-0 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>New Agreement</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Insurance Company</th>
                    <th className="py-3 px-3">Policy Category</th>
                    <th className="py-3 px-3">Plan Variant</th>
                    <th className="py-3 px-3 text-center">1st Year Rate</th>
                    <th className="py-3 px-3 text-center">Renewal Rate</th>
                    <th className="py-3 px-3 text-center">Commission Basis</th>
                    <th className="py-3 px-3 text-center">TDS Rate</th>
                    <th className="py-3 px-3">Effective From</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agreementsLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                        Loading agreements...
                      </td>
                    </tr>
                  ) : agreements.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No commission agreements configured.
                      </td>
                    </tr>
                  ) : (
                    agreements.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{a.company_name}</td>
                        <td className="py-3 px-3 font-semibold text-slate-700">{a.policy_category || "All Categories"}</td>
                        <td className="py-3 px-3 text-slate-500">{a.plan_name || "All Plans (Company Wide)"}</td>
                        <td className="py-3 px-3 text-center font-bold text-blue-700">{Number(a.first_year_commission_rate).toFixed(2)}%</td>
                        <td className="py-3 px-3 text-center font-bold text-purple-700">{Number(a.renewal_commission_rate).toFixed(2)}%</td>
                        <td className="py-3 px-3 text-center font-mono text-[10px] text-slate-600">{a.commissionable_basis}</td>
                        <td className="py-3 px-3 text-center font-semibold text-purple-800">{Number(a.tds_rate).toFixed(2)}%</td>
                        <td className="py-3 px-3 text-slate-600">{a.effective_from}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}>
                            {a.is_active ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 0A: CONFIGURE / EDIT COMMISSION (STAGE 1 MANUAL OVERRIDE) */}
      {/* ========================================================================= */}
      {editCommModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-900">
                  Configure Insurer Commission & Override
                </h3>
              </div>
              <button onClick={() => setEditCommModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditComm} className="p-6 space-y-4 overflow-y-auto">
              {/* Policy Header Information */}
              <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Policy Number:</span>
                  <span className="font-mono font-bold text-slate-900">{editCommForm.policy_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Policyholder:</span>
                  <span className="font-bold text-slate-800">{editCommForm.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Insurance Carrier:</span>
                  <span className="font-bold text-indigo-900">{editCommForm.company_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Policy Plan:</span>
                  <span className="text-slate-700 font-medium">{editCommForm.plan_name}</span>
                </div>
              </div>

              {/* Commission Tier & Net Premium Base */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Commission Tier *
                  </label>
                  <select
                    value={editCommForm.commission_type}
                    onChange={(e) => setEditCommForm({ ...editCommForm, commission_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                  >
                    <option value="FIRST_YEAR">First Year</option>
                    <option value="RENEWAL">Renewal</option>
                    <option value="SPECIAL">Special</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Net Premium Applied (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editCommForm.net_premium_applied}
                    onChange={(e) => {
                      const netP = parseFloat(e.target.value) || 0;
                      const r = parseFloat(editCommForm.gross_commission_rate) || 0;
                      const g = Number((netP * (r / 100)).toFixed(2));
                      const tdsR = parseFloat(editCommForm.tds_rate) || 10;
                      const tds = Number((g * (tdsR / 100)).toFixed(2));
                      setEditCommForm({
                        ...editCommForm,
                        net_premium_applied: e.target.value,
                        gross_commission_amount: g,
                        tds_amount: tds,
                        net_commission_payable: Number((g - tds).toFixed(2)),
                      });
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>

              {/* Rate & Gross Commission */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Commission Rate (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editCommForm.gross_commission_rate}
                    onChange={(e) => handleEditCommRateChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-indigo-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Formula: Net Prem × Rate %</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Gross Commission (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editCommForm.gross_commission_amount}
                    onChange={(e) => handleEditCommGrossChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-black text-slate-900 bg-slate-50"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Can be manually overridden</span>
                </div>
              </div>

              {/* TDS Rate & TDS Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    TDS Rate (%) (Sec 194D) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editCommForm.tds_rate}
                    onChange={(e) => handleEditCommTdsRateChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    TDS Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editCommForm.tds_amount}
                    onChange={(e) => {
                      const t = parseFloat(e.target.value) || 0;
                      const g = parseFloat(editCommForm.gross_commission_amount) || 0;
                      setEditCommForm({
                        ...editCommForm,
                        tds_amount: e.target.value,
                        net_commission_payable: Number((g - t).toFixed(2)),
                      });
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-rose-700"
                  />
                </div>
              </div>

              {/* Net Receivable Amount */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-700 block">Expected Net Receivable</span>
                  <span className="text-[11px] text-slate-500">Gross Commission − Section 194D TDS</span>
                </div>
                <div className="text-base font-black text-emerald-900 font-mono">
                  {formatINR(editCommForm.net_commission_payable)}
                </div>
              </div>

              {/* Manual Override Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Override Reason (Mandatory if altering calculated figures)
                </label>
                <textarea
                  rows={2}
                  value={editCommForm.override_reason}
                  onChange={(e) => setEditCommForm({ ...editCommForm, override_reason: e.target.value })}
                  placeholder="Explain why rate or gross amount was changed (e.g. Special insurer endorsement)..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bank Reference / UTR
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-202611-09"
                    value={editCommForm.bank_reference}
                    onChange={(e) => setEditCommForm({ ...editCommForm, bank_reference: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    placeholder="Internal accounting remarks"
                    value={editCommForm.notes}
                    onChange={(e) => setEditCommForm({ ...editCommForm, notes: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditCommModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 0B: CONFIGURE / EDIT SUB-AGENT PAYOUT ALLOCATION (STAGE 2) */}
      {/* ========================================================================= */}
      {editPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-teal-50 border-b border-teal-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-teal-700" />
                <h3 className="font-extrabold text-slate-900">
                  Configure Sub-Agent Commission Split
                </h3>
              </div>
              <button onClick={() => setEditPayoutModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPayout} className="p-6 space-y-4 overflow-y-auto">
              <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Sub-Agent:</span>
                  <span className="font-bold text-slate-900">{editPayoutForm.sub_agent_name} ({editPayoutForm.sub_agent_code})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Policy Number:</span>
                  <span className="font-mono font-bold text-slate-800">{editPayoutForm.policy_number}</span>
                </div>
                <div className="flex justify-between border-t border-teal-200 pt-1">
                  <span className="text-slate-600">Insurer Gross Commission Base:</span>
                  <span className="font-black text-teal-900">{formatINR(editPayoutForm.insurer_gross_commission)}</span>
                </div>
              </div>

              {/* Allocation Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Allocation Basis *
                  </label>
                  <select
                    value={editPayoutForm.allocation_type}
                    onChange={(e) => setEditPayoutForm({ ...editPayoutForm, allocation_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                  >
                    <option value="PERCENTAGE">Percentage of Insurer Gross</option>
                    <option value="FIXED">Fixed Amount (₹)</option>
                  </select>
                </div>

                {editPayoutForm.allocation_type === "PERCENTAGE" ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Agreed Split Rate (%) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editPayoutForm.allocation_rate}
                      onChange={(e) => handleEditPayoutRateChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-teal-700"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Fixed Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editPayoutForm.fixed_amount}
                      onChange={(e) => handleEditPayoutFixedChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-teal-700"
                    />
                  </div>
                )}
              </div>

              {/* Sub-Agent Payable & TDS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sub-Agent Gross Payable (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPayoutForm.payable_amount}
                    onChange={(e) => {
                      const pay = parseFloat(e.target.value) || 0;
                      const tdsR = parseFloat(editPayoutForm.tds_rate) || 5.0;
                      const tds = Number((pay * (tdsR / 100)).toFixed(2));
                      setEditPayoutForm({
                        ...editPayoutForm,
                        payable_amount: e.target.value,
                        tds_amount: tds,
                        net_payable_amount: Number((pay - tds).toFixed(2)),
                      });
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-black text-slate-900 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Agent TDS Rate (%) (Sec 194H) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPayoutForm.tds_rate}
                    onChange={(e) => handleEditPayoutTdsRateChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>

              {/* Net Payout Summary Card */}
              <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-teal-800 block">Net Payout Due to Sub-Agent</span>
                  <span className="text-[11px] text-slate-500">Gross Payable − Section 194H TDS ({editPayoutForm.tds_rate}%)</span>
                </div>
                <div className="text-base font-black text-teal-950 font-mono">
                  {formatINR(editPayoutForm.net_payable_amount)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Override Reason (Mandatory if customizing split)
                </label>
                <textarea
                  rows={2}
                  value={editPayoutForm.override_reason}
                  onChange={(e) => setEditPayoutForm({ ...editPayoutForm, override_reason: e.target.value })}
                  placeholder="Reason for modifying sub-agent payout allocation..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Internal Notes
                </label>
                <input
                  type="text"
                  placeholder="Notes for finance team"
                  value={editPayoutForm.notes}
                  onChange={(e) => setEditPayoutForm({ ...editPayoutForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditPayoutModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Allocation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD INSURER BANK RECEIPT (PHASE 3) */}
      {/* ========================================================================= */}
      {receiptModalOpen && selectedCommission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900">
                  Record Insurer Commission Bank Receipt
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReceiptSubmit} className="p-6 space-y-4 overflow-y-auto">
              {/* Modal Error Banner */}
              {receiptModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Validation / Submission Notice</p>
                    <p className="text-[11px] mt-0.5">{receiptModalError}</p>
                  </div>
                </div>
              )}

              {/* Policy & Expected Figures Card */}
              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Policy / Insurer:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedCommission.policy_number} ({selectedCommission.company_name || "Insurer"})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Net Premium Base:</span>
                  <span className="font-bold text-slate-800">{formatINR(selectedCommission.net_premium_applied)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Expected Gross Commission:</span>
                  <span className="font-bold text-slate-800">{formatINR(selectedCommission.gross_commission_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Expected Net Receivable:</span>
                  <span className="font-black text-blue-900">{formatINR(selectedCommission.net_commission_payable)}</span>
                </div>
                <div className="flex justify-between border-t border-blue-200/60 pt-1">
                  <span className="text-slate-600">Already Received:</span>
                  <span className="font-bold text-emerald-700">{formatINR(selectedCommission.actual_net_received)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Balance Receivable:</span>
                  <span className="font-black text-amber-800">
                    {formatINR(selectedCommission.balance_receivable || (Number(selectedCommission.net_commission_payable || 0) - Number(selectedCommission.actual_net_received || 0)))}
                  </span>
                </div>
              </div>

              {/* Section 1: Carrier Statement Values */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                  1. Insurer Statement Values
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Statement Commission Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={receiptForm.actual_commission_rate}
                      onChange={(e) => handleActualRateChange(e.target.value)}
                      placeholder="e.g. 15.0"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Insurer agreed rate</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Statement Gross Commission (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={receiptForm.actual_gross_commission}
                      onChange={(e) => handleActualGrossChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Net Premium × Rate</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Statement TDS Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={receiptForm.actual_tds_rate}
                      onChange={(e) => handleActualTdsRateChange(e.target.value)}
                      placeholder="10.0"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Sec 194D withholding %</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Statement TDS Deducted (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={receiptForm.actual_tds_amount}
                      onChange={(e) => handleActualTdsAmountChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-rose-700"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Gross × TDS %</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Expected Net vs Actual Bank Received & Variance */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                  2. Bank Settlement & Reconciliation
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Expected Net Receivable (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      readOnly
                      value={receiptForm.net_amount}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-slate-700 bg-slate-50"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Gross minus TDS deduction</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-emerald-800 mb-1">
                      Actual Bank Received (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={receiptForm.actual_bank_received}
                      onChange={(e) => setReceiptForm({ ...receiptForm, actual_bank_received: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-xs rounded-xl border-2 border-emerald-400 font-black text-emerald-900 bg-emerald-50/40 focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-emerald-700 mt-0.5 block">Actual amount credited to bank</span>
                  </div>
                </div>

                {/* Dynamic Variance Badge */}
                {(() => {
                  const expected = Number(receiptForm.net_amount || 0);
                  const bank = Number(receiptForm.actual_bank_received || 0);
                  const diff = Math.round((bank - expected) * 100) / 100;
                  if (bank <= 0) return null;
                  if (Math.abs(diff) < 0.01) {
                    return (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                        <span className="text-emerald-800 font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Exact Match: Bank credit matches statement net receivable.</span>
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-200/60 text-emerald-900 font-bold rounded-lg text-[11px]">
                          Variance: ₹0.00
                        </span>
                      </div>
                    );
                  } else if (diff < 0) {
                    return (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                        <span className="text-amber-800 font-medium flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>Short Payment: Insurer credited {formatINR(Math.abs(diff))} less than statement.</span>
                        </span>
                        <span className="px-2 py-0.5 bg-amber-200/70 text-amber-900 font-bold rounded-lg text-[11px]">
                          Deficit: -{formatINR(Math.abs(diff))}
                        </span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
                        <span className="text-blue-800 font-medium flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-blue-600" />
                          <span>Excess Payment: Bank credit is {formatINR(diff)} higher than statement.</span>
                        </span>
                        <span className="px-2 py-0.5 bg-blue-200/70 text-blue-900 font-bold rounded-lg text-[11px]">
                          Surplus: +{formatINR(diff)}
                        </span>
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Section 3: Bank Details & Metadata */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                  3. Transaction & Payment Metadata
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Bank Credit Date *
                    </label>
                    <DatePicker
                      value={receiptForm.receipt_date}
                      onChange={(e) => setReceiptForm({ ...receiptForm, receipt_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Payment Mode *
                    </label>
                    <select
                      value={receiptForm.payment_mode}
                      onChange={(e) => setReceiptForm({ ...receiptForm, payment_mode: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                    >
                      <option value="NEFT">NEFT Transfer</option>
                      <option value="RTGS">RTGS Transfer</option>
                      <option value="IMPS">IMPS</option>
                      <option value="UPI">UPI Payment</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="DIRECT_CREDIT">Direct Account Credit</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Agency Bank Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC Bank Ltd"
                      value={receiptForm.bank_name}
                      onChange={(e) => setReceiptForm({ ...receiptForm, bank_name: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Agency Bank Account
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Current A/C #50200..."
                      value={receiptForm.bank_account}
                      onChange={(e) => setReceiptForm({ ...receiptForm, bank_account: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    UTR / Cheque / Transaction Ref # *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UTR-HDFC-20261106-98124"
                    value={receiptForm.transaction_reference}
                    onChange={(e) => setReceiptForm({ ...receiptForm, transaction_reference: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Unique bank reference for audit</span>
                </div>
              </div>

              {/* Section 4: Supporting Document / Statement */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                  4. Supporting Document / Statement (Optional)
                </span>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-2 rounded-xl border border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/50 cursor-pointer flex items-center gap-2 text-xs font-semibold text-slate-700 transition-colors">
                      {uploadingReceiptDoc ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-emerald-600" />
                          <span>Upload Statement / Advice (PDF/Image)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv"
                        className="hidden"
                        disabled={uploadingReceiptDoc}
                        onChange={handleFileUpload}
                      />
                    </label>
                    {receiptForm.document_url && (
                      <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Document attached
                      </span>
                    )}
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Or enter Document URL / Reference path..."
                      value={receiptForm.document_url}
                      onChange={(e) => setReceiptForm({ ...receiptForm, document_url: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Remarks / Notes */}
              <div className="space-y-1 pt-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Receipt Remarks / Statement Notes
                </label>
                <textarea
                  rows={2}
                  value={receiptForm.notes}
                  onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                  placeholder="Additional notes from carrier statement..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReceiptModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingReceiptDoc}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Recording Receipt...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Record Bank Receipt</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DISPUTE COMMISSION */}
      {/* ========================================================================= */}
      {disputeModalOpen && selectedCommission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-purple-50 border-b border-purple-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-purple-600" />
                <h3 className="font-extrabold text-slate-900">Flag Commission Dispute / Variance</h3>
              </div>
              <button onClick={() => setDisputeModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDisputeSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 text-xs text-purple-900">
                Flagging this transaction will mark status as <strong>DISPUTED</strong> for accounting review with the carrier.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dispute Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  value={disputeForm.dispute_reason}
                  onChange={(e) => setDisputeForm({ ...disputeForm, dispute_reason: e.target.value })}
                  placeholder="e.g. Carrier statement shows 10% rate instead of agreed 15% distributor tie-up rate..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Disputed Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={disputeForm.disputed_amount}
                  onChange={(e) => setDisputeForm({ ...disputeForm, disputed_amount: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDisputeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
                  <span>Confirm Dispute</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: REVERSE INSURER COMMISSION */}
      {/* ========================================================================= */}
      {reverseModalOpen && selectedCommission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                <h3 className="font-extrabold text-slate-900">Reverse Insurer Commission</h3>
              </div>
              <button onClick={() => setReverseModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReverseSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200 text-xs text-rose-800">
                <strong>Audit Requirement:</strong> Reversing this commission marks it as clawed back or cancelled. A mandatory reason of at least 5 characters is required.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reversal Reason * (min 5 chars)
                </label>
                <textarea
                  rows={3}
                  required
                  value={reversalForm.reversal_reason}
                  onChange={(e) => setReversalForm({ ...reversalForm, reversal_reason: e.target.value })}
                  placeholder="e.g. Policy cancelled by policyholder during free-look period; carrier clawed back commission."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reversal Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={reversalForm.reversal_amount}
                  onChange={(e) => setReversalForm({ ...reversalForm, reversal_amount: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReverseModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  <span>Confirm Reversal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: RECORD SUB-AGENT PAYOUT PAYMENT (PHASE 4) */}
      {/* ========================================================================= */}
      {payoutPaymentModalOpen && selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-teal-50 border-b border-teal-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-teal-600" />
                <h3 className="font-extrabold text-slate-900">
                  Record Sub-Agent Commission Disbursement
                </h3>
              </div>
              <button onClick={() => setPayoutPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePayoutPaymentSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Sub-Agent:</span>
                  <span className="font-bold text-slate-900">{selectedPayout.sub_agent_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Policy Number:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedPayout.policy_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Agreed Payable:</span>
                  <span className="font-bold text-teal-900">{formatINR(selectedPayout.sub_agent_payable_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Already Paid:</span>
                  <span className="font-bold text-emerald-700">{formatINR(selectedPayout.amount_already_paid)}</span>
                </div>
                <div className="flex justify-between border-t border-teal-200 pt-1">
                  <span className="text-slate-700 font-bold">Remaining Payable:</span>
                  <span className="font-black text-amber-800">{formatINR(selectedPayout.remaining_payable)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payoutPaymentForm.payment_amount}
                    onChange={(e) => setPayoutPaymentForm({ ...payoutPaymentForm, payment_amount: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-black text-emerald-800 bg-emerald-50/30"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Supports full or partial payments</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Disbursement Date *
                  </label>
                  <DatePicker
                    value={payoutPaymentForm.payment_date}
                    onChange={(e) => setPayoutPaymentForm({ ...payoutPaymentForm, payment_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={payoutPaymentForm.payment_method}
                    onChange={(e) => setPayoutPaymentForm({ ...payoutPaymentForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-semibold"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    UTR / Cheque # *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UTR-AXIS-20261105-02"
                    value={payoutPaymentForm.transaction_reference}
                    onChange={(e) => setPayoutPaymentForm({ ...payoutPaymentForm, transaction_reference: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Agent Bank / Account
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SBI A/C #308192..."
                    value={payoutPaymentForm.bank_account_number}
                    onChange={(e) => setPayoutPaymentForm({ ...payoutPaymentForm, bank_account_number: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Proof URL (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="https://storage.../receipt.jpg"
                    value={payoutPaymentForm.payment_proof_url}
                    onChange={(e) => setPayoutPaymentForm({ ...payoutPaymentForm, payment_proof_url: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Internal Remarks
                </label>
                <textarea
                  rows={2}
                  value={payoutPaymentForm.notes}
                  onChange={(e) => setPayoutPaymentForm({ ...payoutPaymentForm, notes: e.target.value })}
                  placeholder="Disbursement details or transaction confirmation remarks..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayoutPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Record Disbursement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: REVERSE SUB-AGENT PAYOUT */}
      {/* ========================================================================= */}
      {payoutReverseModalOpen && selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                <h3 className="font-extrabold text-slate-900">Reverse Sub-Agent Payout</h3>
              </div>
              <button onClick={() => setPayoutReverseModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePayoutReverseSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200 text-xs text-rose-800">
                Reversing this payout obligation requires a mandatory explanation (at least 5 characters).
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Reversal Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  value={payoutReverseForm.reversal_reason}
                  onChange={(e) => setPayoutReverseForm({ ...payoutReverseForm, reversal_reason: e.target.value })}
                  placeholder="e.g. Underlying policy cancelled by carrier; agent commission clawback applied."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayoutReverseModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  <span>Confirm Payout Reversal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: ADD COMMISSION AGREEMENT */}
      {/* ========================================================================= */}
      {agreementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900">
                  Configure Insurer Commission Agreement
                </h3>
              </div>
              <button onClick={() => setAgreementModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAgreement} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Insurance Company *
                </label>
                <select
                  required
                  value={agreementForm.company_id}
                  onChange={(e) => setAgreementForm({ ...agreementForm, company_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                >
                  <option value="">Select Insurance Company</option>
                  {companies.map((co) => (
                    <option key={co.id} value={co.id}>{co.name} ({co.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Policy Category</label>
                  <select
                    value={agreementForm.policy_category}
                    onChange={(e) => setAgreementForm({ ...agreementForm, policy_category: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  >
                    <option value="">All Categories (Company Wide)</option>
                    {INSURANCE_CATEGORIES.map((cat) => (
                      <option key={cat.code} value={cat.code}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Commissionable Basis</label>
                  <select
                    value={agreementForm.commissionable_basis}
                    onChange={(e) => setAgreementForm({ ...agreementForm, commissionable_basis: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  >
                    <option value="NET_PREMIUM">Net Premium (Excl GST)</option>
                    <option value="BASE_PREMIUM">Base Premium</option>
                    <option value="GROSS_PREMIUM">Gross Premium (Incl GST)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">1st Year Rate (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={agreementForm.first_year_commission_rate}
                    onChange={(e) => setAgreementForm({ ...agreementForm, first_year_commission_rate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Renewal Rate (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={agreementForm.renewal_commission_rate}
                    onChange={(e) => setAgreementForm({ ...agreementForm, renewal_commission_rate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">TDS Rate (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={agreementForm.tds_rate}
                    onChange={(e) => setAgreementForm({ ...agreementForm, tds_rate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Effective From *</label>
                  <DatePicker
                    value={agreementForm.effective_from}
                    onChange={(e) => setAgreementForm({ ...agreementForm, effective_from: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Effective To (Optional)</label>
                  <DatePicker
                    value={agreementForm.effective_to}
                    onChange={(e) => setAgreementForm({ ...agreementForm, effective_to: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Agreement Notes</label>
                <textarea
                  rows={2}
                  value={agreementForm.notes}
                  onChange={(e) => setAgreementForm({ ...agreementForm, notes: e.target.value })}
                  placeholder="Terms agreed as per agency tie-up contract..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAgreementModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Agreement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: SUB-AGENT PAYOUT DETAIL & PAYMENT HISTORY */}
      {/* ========================================================================= */}
      {payoutDetailModalOpen && selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-teal-50 border-b border-teal-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-black text-slate-900">
                    {selectedPayout.policy_number}
                  </span>
                  {renderPayoutStatusBadge(selectedPayout.payout_status)}
                </div>
                <p className="text-xs text-teal-800 mt-0.5">
                  Sub-Agent Payout Obligation & Disbursement Ledger
                </p>
              </div>
              <button onClick={() => setPayoutDetailModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 block">Sub-Agent Name</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedPayout.sub_agent_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Agent Code</span>
                  <span className="font-mono font-medium text-slate-800">{selectedPayout.sub_agent_code || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Insurance Carrier</span>
                  <span className="font-bold text-slate-800">{selectedPayout.company_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Commission Tier</span>
                  <span className="font-bold text-blue-700">{selectedPayout.commission_type}</span>
                </div>
              </div>

              <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200 font-mono space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-600">Insurer Gross Commission:</span>
                  <span className="font-bold text-slate-900">{formatINR(selectedPayout.insurer_gross_commission)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Agreed Sub-Agent Percentage:</span>
                  <span className="font-bold text-teal-700">{Number(selectedPayout.agreed_sub_agent_percentage || 0).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between border-t border-teal-200 pt-1 text-slate-900 font-bold">
                  <span>Sub-Agent Payable Amount:</span>
                  <span className="font-black text-slate-950">{formatINR(selectedPayout.sub_agent_payable_amount)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Amount Already Disbursed:</span>
                  <span>{formatINR(selectedPayout.amount_already_paid)}</span>
                </div>
                <div className="flex justify-between text-amber-800 font-black border-t border-teal-200 pt-1">
                  <span>Remaining Payable Liability:</span>
                  <span>{formatINR(selectedPayout.remaining_payable)}</span>
                </div>
              </div>

              {/* Payment Disbursements List */}
              <div className="space-y-2">
                <span className="font-bold text-slate-800 block">Outgoing Disbursement Transactions</span>
                {selectedPayout.payments && selectedPayout.payments.length > 0 ? (
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                        <tr>
                          <th className="py-2 px-2.5">Date</th>
                          <th className="py-2 px-2.5">Mode</th>
                          <th className="py-2 px-2.5">UTR / Ref</th>
                          <th className="py-2 px-2.5 text-right">Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {selectedPayout.payments.map((pm, idx) => (
                          <tr key={pm.id || idx}>
                            <td className="py-2 px-2.5">{pm.payment_date}</td>
                            <td className="py-2 px-2.5 text-slate-700">{pm.payment_method}</td>
                            <td className="py-2 px-2.5 text-slate-900 font-bold">{pm.transaction_reference}</td>
                            <td className="py-2 px-2.5 text-right font-black text-emerald-700">{formatINR(pm.payment_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400">
                    No payment disbursements recorded yet.
                  </div>
                )}
              </div>

              {selectedPayout.reversal_reason && (
                <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-rose-800">
                  <span className="font-bold block">Reversal Audit Notice:</span>
                  {selectedPayout.reversal_reason}
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                onClick={() => setPayoutDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER: 14-SECTION INSURER COMMISSION RECEIVABLE DETAIL */}
      {/* ========================================================================= */}
      {detailDrawerOpen && selectedCommission && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-black text-slate-900">
                    {selectedCommission.policy_number || "POL-PENDING"}
                  </span>
                  {renderInsurerStatusBadge(selectedCommission.status)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Insurer Commission Receivable Breakdown & Reconciliation Audit
                </p>
              </div>
              <button
                onClick={() => setDetailDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
              {/* Section 1: Policy & Customer Information */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>1. Policy & Customer Information</span>
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Policyholder Name</span>
                    <span className="font-bold text-slate-900 text-sm">{selectedCommission.customer_name || "Direct Client"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Customer Phone</span>
                    <span className="font-mono font-medium text-slate-800">{selectedCommission.customer_phone || "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Policy Category</span>
                    <span className="font-semibold text-slate-800">{selectedCommission.policy_category || "HEALTH"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Commission Tier</span>
                    <span className="font-bold text-blue-700">{selectedCommission.commission_type || "FIRST_YEAR"}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Insurance Company & Plan */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>2. Insurance Company & Plan</span>
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Insurance Carrier</span>
                    <span className="font-bold text-slate-900">{selectedCommission.company_name || "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Plan Variant</span>
                    <span className="font-semibold text-slate-800">{selectedCommission.plan_name || "Standard Policy"}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Expected vs Actual Commission Formula */}
              <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-200/80 space-y-3">
                <h4 className="text-[11px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-blue-600" />
                  <span>3. Commission Formulation & Reconciliation</span>
                </h4>
                <div className="p-3 bg-white rounded-lg border border-blue-100 font-mono space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Net Premium Base (Excl GST):</span>
                    <span className="font-bold text-slate-900">{formatINR(selectedCommission.net_premium_applied)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expected Commission Rate:</span>
                    <span className="font-bold text-blue-700">{Number(selectedCommission.gross_commission_rate || 0).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expected Gross Commission:</span>
                    <span className="font-bold text-slate-900">{formatINR(selectedCommission.gross_commission_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expected TDS (Section 194D):</span>
                    <span className="font-bold text-rose-600">-{formatINR(selectedCommission.tds_amount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-slate-900">
                    <span>Expected Net Receivable:</span>
                    <span>{formatINR(selectedCommission.net_commission_payable)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1 text-emerald-700 font-bold">
                    <span>Actual Bank Credit:</span>
                    <span>{formatINR(selectedCommission.actual_net_received)}</span>
                  </div>
                  <div className="flex justify-between text-amber-800 font-black">
                    <span>Balance Receivable:</span>
                    <span>{formatINR(selectedCommission.balance_receivable !== null && selectedCommission.balance_receivable !== undefined ? selectedCommission.balance_receivable : (Number(selectedCommission.net_commission_payable || 0) - Number(selectedCommission.actual_net_received || 0)))}</span>
                  </div>
                </div>
              </div>

              {/* Section 4: Bank Receipts & Reconciliation History */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>4. Carrier Bank Receipts Log</span>
                </h4>
                {selectedCommission.receipts && selectedCommission.receipts.length > 0 ? (
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                        <tr>
                          <th className="py-2 px-2.5">Date</th>
                          <th className="py-2 px-2.5">UTR / Ref</th>
                          <th className="py-2 px-2.5">Bank</th>
                          <th className="py-2 px-2.5 text-right">Net Credited</th>
                          <th className="py-2 px-2.5 text-right">TDS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {selectedCommission.receipts.map((rc, idx) => (
                          <tr key={rc.id || idx}>
                            <td className="py-2 px-2.5">{rc.receipt_date}</td>
                            <td className="py-2 px-2.5 text-slate-800 font-bold">{rc.transaction_reference}</td>
                            <td className="py-2 px-2.5 text-slate-600">{rc.bank_name || "-"}</td>
                            <td className="py-2 px-2.5 text-right font-bold text-emerald-700">{formatINR(rc.net_amount)}</td>
                            <td className="py-2 px-2.5 text-right text-purple-700">{formatINR(rc.tds_deducted)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 text-center bg-white rounded-lg border border-dashed border-slate-200 text-slate-400">
                    No carrier bank receipts recorded yet.
                  </div>
                )}
              </div>

              {/* Section 5: Audit Trail & Discrepancies */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>5. Audit Trail & Remarks</span>
                </h4>
                <div className="space-y-1.5 text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-800">Created: </span>
                    {selectedCommission.created_at ? new Date(selectedCommission.created_at).toLocaleString("en-IN") : "-"}
                  </div>
                  {selectedCommission.dispute_reason && (
                    <div className="text-purple-800 font-bold">
                      Dispute Flagged: "{selectedCommission.dispute_reason}"
                    </div>
                  )}
                  {selectedCommission.reversed_at && (
                    <div className="text-rose-700 font-bold">
                      Reversed on {new Date(selectedCommission.reversed_at).toLocaleString("en-IN")}: "{selectedCommission.reversal_reason}"
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                onClick={() => setDetailDrawerOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
