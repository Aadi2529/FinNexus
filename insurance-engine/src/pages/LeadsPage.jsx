import React, { useState, useEffect, useMemo, useRef } from "react";
import { api, insuranceAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  Plus,
  Filter,
  ArrowRight,
  Phone,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  Upload,
  Download,
  Building2,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Shield,
  MessageSquare,
  Sparkles,
  RefreshCw,
  X,
  ExternalLink,
  ChevronDown,
  Briefcase,
  MapPin,
  Tag,
  DollarSign,
  Layers,
  FileCheck,
  UserPlus,
  Send,
  Check,
  History,
  FileSpreadsheet,
  PieChart,
  BarChart3,
  CalendarClock,
  PhoneCall,
  Video,
  Eye,
  Edit,
  Trash2,
  FolderPlus,
  Lock,
} from "lucide-react";
import { INSURANCE_CATEGORIES } from "../utils/insuranceCategories";
import DatePicker from "../components/common/DatePicker";
import FormInput from "../components/common/FormInput";
import {
  validateIndianMobile,
  validateEmail,
  validateName,
  validatePinCode,
  validateGstin,
  validatePositiveDecimal,
  validateDobNotFuture,
  getTodayIso,
} from "../utils/validation";

// Canonical CRM Statuses & Styles
const LEAD_STATUSES = [
  { key: "NEW", label: "New", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "CONTACTED", label: "Contacted", color: "bg-sky-50 text-sky-700 border-sky-200" },
  { key: "INTERESTED", label: "Interested", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { key: "REQUIREMENT_COLLECTED", label: "Req Collected", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "QUOTATION_PREPARATION", label: "Quote Prep", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "QUOTATION_SENT", label: "Quote Sent", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { key: "NEGOTIATION", label: "Negotiation", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { key: "FOLLOW_UP", label: "Follow Up", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { key: "CONVERTED", label: "Converted", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "NOT_INTERESTED", label: "Not Interested", color: "bg-slate-100 text-slate-600 border-slate-300" },
  { key: "LOST", label: "Lost", color: "bg-rose-50 text-rose-700 border-rose-200" },
  { key: "DUPLICATE", label: "Duplicate", color: "bg-gray-100 text-gray-500 border-gray-300" },
];

const STATUS_MAP = Object.fromEntries(LEAD_STATUSES.map((s) => [s.key, s]));

const PRIORITIES = [
  { key: "LOW", label: "Low", color: "text-slate-600 bg-slate-100 border-slate-200" },
  { key: "MEDIUM", label: "Medium", color: "text-blue-700 bg-blue-50 border-blue-200" },
  { key: "HIGH", label: "High", color: "text-amber-700 bg-amber-50 border-amber-200" },
  { key: "URGENT", label: "Urgent", color: "text-rose-700 bg-rose-50 border-rose-200" },
];

const CATEGORIES = INSURANCE_CATEGORIES.map((c) => c.label);

const SOURCES = [
  "WEBSITE",
  "WHATSAPP",
  "PHONE_CALL",
  "WALK_IN",
  "REFERRAL",
  "SOCIAL_MEDIA",
  "ADVERTISEMENT",
  "EXISTING_CUSTOMER",
  "AGENT",
  "OTHER",
];

export const formatErrorMsg = (err) => {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err.error) return typeof err.error === "string" ? err.error : JSON.stringify(err.error);
  if (err.message) return typeof err.message === "string" ? err.message : JSON.stringify(err.message);
  if (err.detail) return typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
  return String(err);
};

export const KANBAN_5_STAGES = [
  {
    key: "PENDING",
    label: "Pending",
    subtitle: "New inquiries & uncontacted leads",
    headerBg: "bg-amber-50/90 text-amber-900 border-amber-200",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
    accentBorder: "border-t-4 border-t-amber-500",
    dropZoneColor: "bg-amber-100/50 border-amber-400 ring-2 ring-amber-300",
    dotColor: "bg-amber-500",
  },
  {
    key: "CALL_LATER",
    label: "Call Later",
    subtitle: "Contacted prospects & callbacks",
    headerBg: "bg-sky-50/90 text-sky-900 border-sky-200",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-300",
    accentBorder: "border-t-4 border-t-sky-500",
    dropZoneColor: "bg-sky-100/50 border-sky-400 ring-2 ring-sky-300",
    dotColor: "bg-sky-500",
  },
  {
    key: "SCHEDULE_MEETING",
    label: "Schedule Meeting",
    subtitle: "Consultations & proposal review",
    headerBg: "bg-purple-50/90 text-purple-900 border-purple-200",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
    accentBorder: "border-t-4 border-t-purple-500",
    dropZoneColor: "bg-purple-100/50 border-purple-400 ring-2 ring-purple-300",
    dotColor: "bg-purple-500",
  },
  {
    key: "HOLD",
    label: "Hold",
    subtitle: "Paused, pending docs, or on hold",
    headerBg: "bg-orange-50/90 text-orange-900 border-orange-200",
    badgeColor: "bg-orange-100 text-orange-800 border-orange-300",
    accentBorder: "border-t-4 border-t-orange-500",
    dropZoneColor: "bg-orange-100/50 border-orange-400 ring-2 ring-orange-300",
    dotColor: "bg-orange-500",
  },
  {
    key: "DONE",
    label: "Done",
    subtitle: "Successfully converted & won",
    headerBg: "bg-emerald-50/90 text-emerald-900 border-emerald-200",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
    accentBorder: "border-t-4 border-t-emerald-500",
    dropZoneColor: "bg-emerald-100/50 border-emerald-400 ring-2 ring-emerald-300",
    dotColor: "bg-emerald-500",
  },
];

export const mapStatusTo5Stage = (status) => {
  if (!status) return "PENDING";
  const s = String(status).toUpperCase().trim();
  switch (s) {
    case "PENDING":
    case "NEW":
    case "REQUIREMENT_COLLECTED":
      return "PENDING";
    case "CALL_LATER":
    case "CALL LATER":
    case "CONTACTED":
    case "INTERESTED":
    case "FOLLOW_UP":
      return "CALL_LATER";
    case "SCHEDULE_MEETING":
    case "SCHEDULE MEETING":
    case "MEETING_SCHEDULED":
    case "QUOTATION_PREPARATION":
    case "QUOTATION_SENT":
    case "NEGOTIATION":
      return "SCHEDULE_MEETING";
    case "HOLD":
    case "ON_HOLD":
    case "ON HOLD":
    case "NOT_INTERESTED":
    case "LOST":
    case "DUPLICATE":
      return "HOLD";
    case "DONE":
    case "CONVERTED":
    case "WON":
      return "DONE";
    default:
      return "PENDING";
  }
};

export default function LeadsPage() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const navigate = useNavigate();
  const canManage = isSuperAdmin || isAdmin || user?.role === "MANAGER";

  // Tab navigation
  const [activeTab, setActiveTab] = useState("DASHBOARD"); // DASHBOARD, PIPELINE, LIST, FOLLOW_UPS, REPORTS

  // Global states
  const [stats, setStats] = useState(null);
  const [staffUsers, setStaffUsers] = useState([]);
  const [subAgents, setSubAgents] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [leadToDelete, setLeadToDelete] = useState(null);

  // List & Filter states
  const [leads, setLeads] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterSource, setFilterSource] = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [filterAssigned, setFilterAssigned] = useState("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);

  // Kanban Pipeline states
  const [kanbanData, setKanbanData] = useState([]);
  const [loadingKanban, setLoadingKanban] = useState(false);

  // Follow-ups states
  const [followUps, setFollowUps] = useState([]);
  const [followUpFilter, setFollowUpFilter] = useState("TODAY"); // TODAY, OVERDUE, UPCOMING, ALL
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);

  // Reports states
  const [reportType, setReportType] = useState("SOURCE");
  const [reportRows, setReportRows] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Modals & Drawer states
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState(null);
  const [lead360Id, setLead360Id] = useState(null);
  const [convertLeadData, setConvertLeadData] = useState(null);
  const [scheduleFollowUpLead, setScheduleFollowUpLead] = useState(null);
  const [completeReminderItem, setCompleteReminderItem] = useState(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  // Initial Load
  useEffect(() => {
    fetchStats();
    fetchStaff();
  }, []);

  // Fetch when tab changes or filters change
  useEffect(() => {
    if (activeTab === "DASHBOARD") {
      fetchStats();
    } else if (activeTab === "PIPELINE") {
      fetchKanban();
    } else if (activeTab === "LIST") {
      fetchLeads();
    } else if (activeTab === "FOLLOW_UPS") {
      fetchFollowUps();
    } else if (activeTab === "REPORTS") {
      fetchReports();
    }
  }, [
    activeTab,
    page,
    filterStatus,
    filterCategory,
    filterSource,
    filterPriority,
    filterAssigned,
    filterDateFrom,
    filterDateTo,
    followUpFilter,
    reportType,
  ]);

  const showSuccess = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(""), 4500);
  };

  const showError = (msg) => {
    setActionError(msg);
    setTimeout(() => setActionError(""), 5500);
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await insuranceAPI.getLeadStats();
      if (res.ok) {
        setStats(res.data);
      }
    } catch (err) {
      console.error("Error fetching lead stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const uRes = await insuranceAPI.getStaffUsers();
      if (uRes.ok && Array.isArray(uRes.data)) {
        setStaffUsers(uRes.data);
      }
    } catch {
      // Ignored for employees
    }
    try {
      const sRes = await insuranceAPI.getSubAgents();
      if (sRes.ok && sRes.data && Array.isArray(sRes.data.items)) {
        setSubAgents(sRes.data.items);
      }
    } catch {
      // Ignored
    }
  };

  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      const res = await insuranceAPI.getLeads({
        page,
        page_size: 15,
        search: searchQuery || undefined,
        status: filterStatus,
        category: filterCategory,
        source: filterSource,
        priority: filterPriority,
        assigned_user_id: filterAssigned,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
      });
      if (res.ok) {
        setLeads(res.data.items || []);
        setTotalLeads(res.data.total || 0);
        setTotalPages(res.data.total_pages || 1);
      } else {
        showError(res.error || "Failed to load leads list.");
      }
    } catch (err) {
      showError("Error connecting to leads service.");
    } finally {
      setLoadingLeads(false);
    }
  };

  const fetchKanban = async () => {
    setLoadingKanban(true);
    try {
      const res = await insuranceAPI.getLeadKanban({
        search: searchQuery || undefined,
        category: filterCategory,
        source: filterSource,
        priority: filterPriority,
        assigned_user_id: filterAssigned,
        view: "5_stage",
      });
      if (res.ok) {
        setKanbanData(res.data.stages || []);
      } else {
        showError(res.error || "Failed to load kanban pipeline.");
      }
    } catch (err) {
      showError("Error fetching kanban data.");
    } finally {
      setLoadingKanban(false);
    }
  };

  const fetchFollowUps = async () => {
    setLoadingFollowUps(true);
    try {
      const res = await insuranceAPI.getLeadFollowUps({
        due: followUpFilter !== "ALL" ? followUpFilter : undefined,
      });
      if (res.ok) {
        setFollowUps(res.data || []);
      }
    } catch (err) {
      showError("Failed to fetch follow-ups.");
    } finally {
      setLoadingFollowUps(false);
    }
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await insuranceAPI.getLeadReports({
        report_type: reportType,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
      });
      if (res.ok) {
        setReportRows(res.data || []);
      }
    } catch (err) {
      showError("Failed to load CRM reports.");
    } finally {
      setLoadingReports(false);
    }
  };

  const handleStatusChangeQuick = async (leadId, nextStatus) => {
    try {
      const res = await insuranceAPI.updateLeadStatus(leadId, nextStatus);
      if (res.ok) {
        const stageLabel =
          KANBAN_5_STAGES.find((s) => s.key === nextStatus)?.label ||
          STATUS_MAP[nextStatus]?.label ||
          nextStatus;
        showSuccess(`Lead moved to ${stageLabel}.`);
        if (activeTab === "PIPELINE") fetchKanban();
        if (activeTab === "LIST") fetchLeads();
        if (activeTab === "DASHBOARD") fetchStats();
      } else {
        showError(res.error || "Failed to update lead status.");
      }
    } catch {
      showError("Failed to update status.");
    }
  };

  const handleExport = async (format = "xlsx") => {
    try {
      const blob = await insuranceAPI.downloadLeadExport({
        format,
        status: filterStatus,
        category: filterCategory,
        source: filterSource,
        priority: filterPriority,
        assigned_user_id: filterAssigned,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showSuccess(`Exported leads to ${format.toUpperCase()} successfully.`);
    } catch {
      showError("Export failed. Please check filters.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top CRM Executive Banner */}
      <div className="bg-gradient-to-r from-white via-indigo-50/30 to-white p-6 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-teal-500 to-emerald-500" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                  Sales CRM & Engine
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span className="text-xs text-slate-500 font-medium">Customer Acquisition Lifecycle</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                Lead Management & Sales CRM
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Full-cycle prospect tracking, dynamic Kanban pipeline, automated follow-ups, and safe customer conversion.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setLeadToEdit(null);
                setAddLeadOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Lead</span>
            </button>
            <button
              onClick={() => setBulkImportOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 shadow-2xs transition-colors"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Import</span>
            </button>
            <div className="relative group">
              <button className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 shadow-2xs transition-colors">
                <Download className="w-4 h-4 text-slate-500" />
                <span>Export</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 hidden group-hover:block z-30">
                <button
                  onClick={() => handleExport("xlsx")}
                  className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 rounded-lg flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={() => handleExport("csv")}
                  className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 rounded-lg flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-sky-600" />
                  CSV File
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                setScheduleFollowUpLead({ id: null, full_name: "General Task" });
              }}
              className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 shadow-2xs transition-colors"
            >
              <CalendarClock className="w-4 h-4 text-slate-500" />
              <span>Follow-up</span>
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {actionSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Module View Navigation Tabs */}
        <div className="flex items-center gap-1 mt-6 border-b border-slate-200/80 -mb-2 overflow-x-auto">
          {[
            { key: "DASHBOARD", label: "Executive Dashboard", icon: TrendingUp },
            { key: "PIPELINE", label: "Kanban Pipeline", icon: Layers },
            { key: "LIST", label: "All Leads Table", icon: Users },
            { key: "FOLLOW_UPS", label: "Follow-ups & Tasks", icon: CalendarClock },
            { key: "REPORTS", label: "Sales Analytics", icon: PieChart },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? "border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-xl"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-indigo-600" : "text-slate-400"}`} />
                <span>{tab.label}</span>
                {tab.key === "FOLLOW_UPS" && stats?.overdue_follow_ups > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                    {stats.overdue_follow_ups}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW 1: EXECUTIVE DASHBOARD */}
      {activeTab === "DASHBOARD" && (
        <DashboardView
          stats={stats}
          loading={loadingStats}
          onOpenAddLead={() => {
            setLeadToEdit(null);
            setAddLeadOpen(true);
          }}
          onOpenLead360={(id) => setLead360Id(id)}
          onCompleteReminder={(item) => setCompleteReminderItem(item)}
          onScheduleFollowUp={(lead) => setScheduleFollowUpLead(lead)}
          onNavigateToList={(status) => {
            setFilterStatus(status || "ALL");
            setActiveTab("LIST");
          }}
        />
      )}

      {/* VIEW 2: KANBAN PIPELINE */}
      {activeTab === "PIPELINE" && (
        <PipelineView
          kanbanData={kanbanData}
          loading={loadingKanban}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          filterSource={filterSource}
          setFilterSource={setFilterSource}
          filterPriority={filterPriority}
          setFilterPriority={setFilterPriority}
          filterAssigned={filterAssigned}
          setFilterAssigned={setFilterAssigned}
          staffUsers={staffUsers}
          onRefresh={fetchKanban}
          onOpenLead360={(id) => setLead360Id(id)}
          onEditLead={(lead) => {
            setLeadToEdit(lead);
            setAddLeadOpen(true);
          }}
          onDeleteLead={(lead) => setLeadToDelete(lead)}
          onStatusChange={handleStatusChangeQuick}
          onScheduleFollowUp={(lead) => setScheduleFollowUpLead(lead)}
        />
      )}

      {/* VIEW 3: ALL LEADS TABLE */}
      {activeTab === "LIST" && (
        <ListView
          leads={leads}
          total={totalLeads}
          totalPages={totalPages}
          page={page}
          setPage={setPage}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          filterSource={filterSource}
          setFilterSource={setFilterSource}
          filterPriority={filterPriority}
          setFilterPriority={setFilterPriority}
          filterAssigned={filterAssigned}
          setFilterAssigned={setFilterAssigned}
          filterDateFrom={filterDateFrom}
          setFilterDateFrom={setFilterDateFrom}
          filterDateTo={filterDateTo}
          setFilterDateTo={setFilterDateTo}
          staffUsers={staffUsers}
          loading={loadingLeads}
          selectedIds={selectedLeadIds}
          setSelectedIds={setSelectedLeadIds}
          onOpenAddLead={() => {
            setLeadToEdit(null);
            setAddLeadOpen(true);
          }}
          onEditLead={(lead) => {
            setLeadToEdit(lead);
            setAddLeadOpen(true);
          }}
          onOpenLead360={(id) => setLead360Id(id)}
          onConvertLead={(lead) => setConvertLeadData(lead)}
          onScheduleFollowUp={(lead) => setScheduleFollowUpLead(lead)}
          onBulkAssign={() => setBulkAssignOpen(true)}
          onDeleteLead={(lead) => setLeadToDelete(lead)}
          onRefresh={fetchLeads}
        />
      )}

      {/* VIEW 4: FOLLOW-UPS & TASKS */}
      {activeTab === "FOLLOW_UPS" && (
        <FollowUpsView
          followUps={followUps}
          loading={loadingFollowUps}
          filter={followUpFilter}
          setFilter={setFollowUpFilter}
          onComplete={(item) => setCompleteReminderItem(item)}
          onOpenLead360={(id) => setLead360Id(id)}
          onScheduleNew={() => setScheduleFollowUpLead({ id: null, full_name: "General Task" })}
          onRefresh={fetchFollowUps}
        />
      )}

      {/* VIEW 5: SALES CRM REPORTS */}
      {activeTab === "REPORTS" && (
        <ReportsView
          reportType={reportType}
          setReportType={setReportType}
          reportRows={reportRows}
          loading={loadingReports}
          filterDateFrom={filterDateFrom}
          setFilterDateFrom={setFilterDateFrom}
          filterDateTo={filterDateTo}
          setFilterDateTo={setFilterDateTo}
          onExport={handleExport}
          onRefresh={fetchReports}
        />
      )}

      {/* MODAL 1: ADD / EDIT LEAD */}
      {addLeadOpen && (
        <AddEditLeadModal
          isOpen={addLeadOpen}
          lead={leadToEdit}
          staffUsers={staffUsers}
          subAgents={subAgents}
          onClose={() => {
            setAddLeadOpen(false);
            setLeadToEdit(null);
          }}
          onSaved={() => {
            setAddLeadOpen(false);
            setLeadToEdit(null);
            showSuccess(leadToEdit ? "Lead updated successfully." : "New lead added successfully.");
            if (activeTab === "LIST") fetchLeads();
            if (activeTab === "PIPELINE") fetchKanban();
            if (activeTab === "DASHBOARD") fetchStats();
          }}
        />
      )}

      {/* MODAL 2: LEAD 360° DRAWER */}
      {lead360Id && (
        <Lead360Drawer
          leadId={lead360Id}
          staffUsers={staffUsers}
          onClose={() => setLead360Id(null)}
          onEdit={(lead) => {
            setLead360Id(null);
            setLeadToEdit(lead);
            setAddLeadOpen(true);
          }}
          onConvert={(lead) => {
            setConvertLeadData(lead);
          }}
          onDelete={(lead) => {
            setLeadToDelete(lead);
          }}
          onScheduleFollowUp={(lead) => setScheduleFollowUpLead(lead)}
          onRefreshParents={() => {
            if (activeTab === "LIST") fetchLeads();
            if (activeTab === "PIPELINE") fetchKanban();
            if (activeTab === "DASHBOARD") fetchStats();
          }}
        />
      )}

      {/* MODAL 3: CONVERT LEAD TO CUSTOMER */}
      {convertLeadData && (
        <ConvertLeadModal
          lead={convertLeadData}
          onClose={() => setConvertLeadData(null)}
          onConverted={(customerRes) => {
            setConvertLeadData(null);
            showSuccess(`Lead converted into Customer profile #${customerRes.customer_id}!`);
            if (activeTab === "LIST") fetchLeads();
            if (activeTab === "PIPELINE") fetchKanban();
            if (activeTab === "DASHBOARD") fetchStats();
          }}
        />
      )}

      {/* MODAL 4: SCHEDULE FOLLOW-UP */}
      {scheduleFollowUpLead && (
        <ScheduleFollowUpModal
          lead={scheduleFollowUpLead}
          staffUsers={staffUsers}
          onClose={() => setScheduleFollowUpLead(null)}
          onScheduled={() => {
            setScheduleFollowUpLead(null);
            showSuccess("Follow-up reminder scheduled successfully.");
            if (activeTab === "FOLLOW_UPS") fetchFollowUps();
            if (activeTab === "DASHBOARD") fetchStats();
          }}
        />
      )}

      {/* MODAL 5: COMPLETE FOLLOW-UP */}
      {completeReminderItem && (
        <CompleteFollowUpModal
          reminder={completeReminderItem}
          onClose={() => setCompleteReminderItem(null)}
          onCompleted={() => {
            setCompleteReminderItem(null);
            showSuccess("Follow-up marked completed.");
            if (activeTab === "FOLLOW_UPS") fetchFollowUps();
            if (activeTab === "DASHBOARD") fetchStats();
          }}
        />
      )}

      {/* MODAL 6: BULK IMPORT LEADS */}
      {bulkImportOpen && (
        <BulkImportModal
          isOpen={bulkImportOpen}
          onClose={() => setBulkImportOpen(false)}
          onImported={(summary) => {
            setBulkImportOpen(false);
            showSuccess(`Bulk imported ${summary.imported_count} leads successfully!`);
            fetchStats();
            if (activeTab === "LIST") fetchLeads();
            if (activeTab === "PIPELINE") fetchKanban();
          }}
        />
      )}

      {/* MODAL 7: BULK ASSIGN LEADS */}
      {bulkAssignOpen && (
        <BulkAssignModal
          isOpen={bulkAssignOpen}
          leadIds={selectedLeadIds}
          staffUsers={staffUsers}
          subAgents={subAgents}
          onClose={() => setBulkAssignOpen(false)}
          onAssigned={() => {
            setBulkAssignOpen(false);
            setSelectedLeadIds([]);
            showSuccess(`Successfully assigned ${selectedLeadIds.length} leads.`);
            fetchLeads();
          }}
        />
      )}

      {/* MODAL 8: DELETE LEAD CONFIRMATION */}
      {leadToDelete && (
        <DeleteLeadModal
          lead={leadToDelete}
          onClose={() => setLeadToDelete(null)}
          onDeleted={() => {
            const delName = leadToDelete.full_name || leadToDelete.lead_number || "Lead";
            setLeadToDelete(null);
            if (lead360Id === leadToDelete.id) setLead360Id(null);
            showSuccess(`Lead '${delName}' deleted successfully.`);
            if (activeTab === "LIST") fetchLeads();
            if (activeTab === "PIPELINE") fetchKanban();
            if (activeTab === "DASHBOARD") fetchStats();
          }}
        />
      )}
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENT: 1. DASHBOARD VIEW (10 Exact KPIs & Performance Widgets)
// ===========================================================================
function DashboardView({
  stats,
  loading,
  onOpenAddLead,
  onOpenLead360,
  onCompleteReminder,
  onScheduleFollowUp,
  onNavigateToList,
}) {
  const kpis = [
    { key: "total", label: "Total Leads", value: stats?.total_leads ?? 0, color: "text-slate-900 bg-slate-50 border-slate-200", icon: Users },
    { key: "new", label: "New Leads", value: stats?.new_leads ?? 0, color: "text-blue-700 bg-blue-50 border-blue-200", icon: Sparkles },
    { key: "contacted", label: "Contacted Leads", value: stats?.contacted_leads ?? 0, color: "text-sky-700 bg-sky-50 border-sky-200", icon: PhoneCall },
    { key: "interested", label: "Interested Leads", value: stats?.interested_leads ?? 0, color: "text-indigo-700 bg-indigo-50 border-indigo-200", icon: UserCheck },
    { key: "today", label: "Follow-ups Due Today", value: stats?.follow_ups_due_today ?? 0, color: "text-amber-700 bg-amber-50 border-amber-200", icon: CalendarClock },
    { key: "overdue", label: "Overdue Follow-ups", value: stats?.overdue_follow_ups ?? 0, color: "text-rose-700 bg-rose-50 border-rose-200", icon: AlertTriangle },
    { key: "quotes", label: "Quotations Sent", value: stats?.quotations_sent ?? 0, color: "text-orange-700 bg-orange-50 border-orange-200", icon: FileText },
    { key: "converted", label: "Converted Leads", value: stats?.converted_leads ?? 0, color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
    { key: "lost", label: "Lost Leads", value: stats?.lost_leads ?? 0, color: "text-slate-600 bg-slate-100 border-slate-300", icon: X },
    { key: "rate", label: "Conversion Rate", value: `${stats?.conversion_rate ?? 0}%`, color: "text-purple-700 bg-purple-50 border-purple-200", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      {/* 10 KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.key}
              onClick={() => {
                if (kpi.key === "new") onNavigateToList("NEW");
                else if (kpi.key === "contacted") onNavigateToList("CONTACTED");
                else if (kpi.key === "interested") onNavigateToList("INTERESTED");
                else if (kpi.key === "quotes") onNavigateToList("QUOTATION_SENT");
                else if (kpi.key === "converted") onNavigateToList("CONVERTED");
                else if (kpi.key === "lost") onNavigateToList("LOST");
              }}
              className={`p-4 rounded-xl border ${kpi.color} shadow-2xs hover:shadow-sm transition-all cursor-pointer`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{kpi.label}</span>
                <Icon className="w-4 h-4 opacity-75" />
              </div>
              <div className="text-2xl font-black">{loading ? "..." : kpi.value}</div>
            </div>
          );
        })}
      </div>

      {/* 2-Column Performance Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Widget 1: Follow-ups Due Today */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-amber-600" />
              <h2 className="font-bold text-slate-900 text-sm">Follow-ups Due Today</h2>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              {stats?.today_follow_up_items?.length || 0} Tasks
            </span>
          </div>

          <div className="space-y-2.5">
            {!stats?.today_follow_up_items?.length ? (
              <p className="text-xs text-slate-400 py-6 text-center">No pending follow-ups scheduled for today.</p>
            ) : (
              stats.today_follow_up_items.map((item) => (
                <div key={item.id} className="p-3 rounded-xl bg-amber-50/40 border border-amber-200/60 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-slate-900 truncate">{item.lead_name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span className="font-medium text-amber-800">{item.reminder_type}</span>
                      <span>•</span>
                      <span>{item.scheduled_time || "Today"}</span>
                      {item.assigned_to_name && (
                        <>
                          <span>•</span>
                          <span>Assigned: {item.assigned_to_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onCompleteReminder(item)}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => onOpenLead360(item.lead_id)}
                      className="p-1 rounded-lg hover:bg-slate-200 text-slate-600"
                      title="View Lead 360"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Widget 2: Overdue Follow-ups Alert */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <h2 className="font-bold text-slate-900 text-sm">Overdue Action Items</h2>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              {stats?.overdue_follow_up_items?.length || 0} Overdue
            </span>
          </div>

          <div className="space-y-2.5">
            {!stats?.overdue_follow_up_items?.length ? (
              <p className="text-xs text-slate-400 py-6 text-center">Great job! No overdue follow-ups.</p>
            ) : (
              stats.overdue_follow_up_items.map((item) => (
                <div key={item.id} className="p-3 rounded-xl bg-rose-50/40 border border-rose-200/60 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-slate-900 truncate">{item.lead_name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span className="font-bold text-rose-700">{item.reminder_type}</span>
                      <span>•</span>
                      <span className="text-rose-600 font-semibold">Due {item.scheduled_time}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onCompleteReminder(item)}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-2xs"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => onOpenLead360(item.lead_id)}
                      className="p-1 rounded-lg hover:bg-slate-200 text-slate-600"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Widget 3: Pipeline Stage Distribution Summary */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-slate-900 text-sm">Lead Pipeline Summary</h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">12 Sales Stages</span>
          </div>

          <div className="space-y-2">
            {LEAD_STATUSES.map((st) => {
              const count = stats?.pipeline_summary?.[st.key] || 0;
              const total = stats?.total_leads || 1;
              const pct = Math.min(100, Math.round((count / (total || 1)) * 100));
              return (
                <div key={st.key} className="flex items-center justify-between gap-3 text-xs">
                  <div className="w-36 font-semibold text-slate-700 truncate">{st.label}</div>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full ${st.key === "CONVERTED" ? "bg-emerald-500" : st.key === "LOST" ? "bg-rose-400" : "bg-indigo-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-12 text-right font-black text-slate-800">{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Widget 4: Recent Leads */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-600" />
              <h2 className="font-bold text-slate-900 text-sm">Recently Created Leads</h2>
            </div>
            <button
              onClick={() => onNavigateToList("ALL")}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {!stats?.recent_leads?.length ? (
              <p className="text-xs text-slate-400 py-6 text-center">No leads recorded yet.</p>
            ) : (
              stats.recent_leads.map((lead) => {
                const statMeta = STATUS_MAP[lead.status] || { label: lead.status, color: "bg-slate-100 text-slate-700" };
                return (
                  <div
                    key={lead.id}
                    onClick={() => onOpenLead360(lead.id)}
                    className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 truncate">{lead.full_name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{lead.lead_number}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span>{lead.policy_type || "General"}</span>
                        <span>•</span>
                        <span>₹{Number(lead.expected_premium || 0).toLocaleString("en-IN")}</span>
                        <span>•</span>
                        <span>{lead.mobile}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statMeta.color} shrink-0`}>
                      {statMeta.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENT: 2. KANBAN PIPELINE VIEW (5 Responsive Stages with Drag-and-Drop)
// ===========================================================================
function PipelineView({
  kanbanData,
  loading,
  searchQuery,
  setSearchQuery,
  filterCategory,
  setFilterCategory,
  filterSource,
  setFilterSource,
  filterPriority,
  setFilterPriority,
  filterAssigned,
  setFilterAssigned,
  staffUsers,
  onRefresh,
  onOpenLead360,
  onEditLead,
  onDeleteLead,
  onStatusChange,
  onScheduleFollowUp,
}) {
  const [draggedLeadId, setDraggedLeadId] = useState(null);
  const [dragOverStageKey, setDragOverStageKey] = useState(null);
  const [sortBy, setSortBy] = useState("RECENT");

  // Gather and group all leads from kanbanData into the 5 stages
  const groupedLeads = useMemo(() => {
    const allLeads = [];
    (kanbanData || []).forEach((st) => {
      (st.leads || []).forEach((l) => {
        if (!allLeads.some((existing) => existing.id === l.id)) {
          allLeads.push(l);
        }
      });
    });

    let filtered = allLeads;
    if (filterSource && filterSource !== "ALL") {
      filtered = filtered.filter((l) => l.lead_source === filterSource);
    }

    const groups = {
      PENDING: [],
      CALL_LATER: [],
      SCHEDULE_MEETING: [],
      HOLD: [],
      DONE: [],
    };

    filtered.forEach((lead) => {
      const targetStage = mapStatusTo5Stage(lead.status);
      if (groups[targetStage]) {
        groups[targetStage].push(lead);
      } else {
        groups.PENDING.push(lead);
      }
    });

    // Sort each stage
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        if (sortBy === "OLDEST") {
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        } else if (sortBy === "PREMIUM_DESC") {
          return Number(b.expected_premium || 0) - Number(a.expected_premium || 0);
        } else if (sortBy === "FOLLOW_UP") {
          if (!a.next_follow_up_date) return 1;
          if (!b.next_follow_up_date) return -1;
          return new Date(a.next_follow_up_date) - new Date(b.next_follow_up_date);
        }
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });
    });

    return groups;
  }, [kanbanData, filterSource, sortBy]);

  const handleDragStart = (e, lead) => {
    e.dataTransfer.setData("text/plain", lead.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedLeadId(lead.id);
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDragOverStageKey(null);
  };

  const handleDragOver = (e, stageKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStageKey !== stageKey) {
      setDragOverStageKey(stageKey);
    }
  };

  const handleDragLeave = (e, stageKey) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverStageKey === stageKey) {
      setDragOverStageKey(null);
    }
  };

  const handleDrop = (e, targetStageKey) => {
    e.preventDefault();
    setDragOverStageKey(null);
    const leadId = e.dataTransfer.getData("text/plain") || draggedLeadId;
    setDraggedLeadId(null);
    if (!leadId) return;
    onStatusChange(leadId, targetStageKey);
  };

  return (
    <div className="space-y-4">
      {/* Search, Filter & Sorting Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search leads by name, phone, or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>

          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Sources</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>

          <select
            value={filterAssigned}
            onChange={(e) => setFilterAssigned(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Assignees</option>
            {staffUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
          >
            <option value="RECENT">Sort: Newest First</option>
            <option value="OLDEST">Sort: Oldest First</option>
            <option value="PREMIUM_DESC">Sort: Highest Budget</option>
            <option value="FOLLOW_UP">Sort: Next Follow-up</option>
          </select>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Board"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* 5-Stage Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start min-h-[620px]">
        {KANBAN_5_STAGES.map((stage) => {
          const leadsInStage = groupedLeads[stage.key] || [];
          const stageTotalPremium = leadsInStage.reduce(
            (acc, l) => acc + Number(l.expected_premium || 0),
            0
          );
          const isDragTarget = dragOverStageKey === stage.key;

          return (
            <div
              key={stage.key}
              onDragOver={(e) => handleDragOver(e, stage.key)}
              onDragLeave={(e) => handleDragLeave(e, stage.key)}
              onDrop={(e) => handleDrop(e, stage.key)}
              className={`rounded-2xl border transition-all flex flex-col max-h-[820px] shadow-2xs ${
                stage.accentBorder
              } ${
                isDragTarget
                  ? stage.dropZoneColor
                  : "bg-slate-50/70 border-slate-200/90"
              }`}
            >
              {/* Column Header */}
              <div className={`p-3.5 border-b border-slate-200/80 rounded-t-xl ${stage.headerBg}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${stage.dotColor}`} />
                    <h3 className="font-black text-xs text-slate-900 tracking-tight">
                      {stage.label}
                    </h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${stage.badgeColor}`}
                  >
                    {leadsInStage.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mt-1">
                  <span className="truncate pr-1">{stage.subtitle}</span>
                  <span className="font-mono font-bold text-slate-700 shrink-0">
                    ₹{stageTotalPremium.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Drop Target Banner when Dragging Over */}
              {isDragTarget && (
                <div className="p-3 m-2 text-center rounded-xl border-2 border-dashed border-indigo-400 bg-white/80 text-indigo-700 text-xs font-bold animate-pulse flex items-center justify-center gap-1.5">
                  <ArrowRight className="w-4 h-4 text-indigo-600" />
                  <span>Drop to move to {stage.label}</span>
                </div>
              )}

              {/* Cards List */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1 min-h-[140px]">
                {leadsInStage.length === 0 ? (
                  <div className="py-12 text-center text-[11px] text-slate-400 font-medium">
                    <Layers className="w-6 h-6 mx-auto mb-1.5 opacity-30 text-slate-400" />
                    <span>No leads in {stage.label}</span>
                  </div>
                ) : (
                  leadsInStage.map((lead) => (
                    <KanbanCard
                      key={lead.id}
                      lead={lead}
                      currentStageKey={stage.key}
                      onDragStart={(e) => handleDragStart(e, lead)}
                      onDragEnd={handleDragEnd}
                      onOpen={() => onOpenLead360(lead.id)}
                      onEdit={() => onEditLead && onEditLead(lead)}
                      onDelete={() => onDeleteLead && onDeleteLead(lead)}
                      onStatusChange={(next) => onStatusChange(lead.id, next)}
                      onScheduleFollowUp={() => onScheduleFollowUp(lead)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Kanban Card Item
function KanbanCard({
  lead,
  currentStageKey,
  onDragStart,
  onDragEnd,
  onOpen,
  onEdit,
  onDelete,
  onStatusChange,
  onScheduleFollowUp,
}) {
  const priorityMeta = PRIORITIES.find((p) => p.key === lead.priority) || PRIORITIES[1];

  // Format follow up date
  const followUpDisplay = useMemo(() => {
    if (!lead.next_follow_up_date) return null;
    try {
      const dt = new Date(lead.next_follow_up_date);
      const isOverdue = dt < new Date() && currentStageKey !== "DONE";
      const formatted = dt.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      return { text: formatted, isOverdue };
    } catch {
      return null;
    }
  }, [lead.next_follow_up_date, currentStageKey]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing group relative select-none"
    >
      {/* Header: Lead Number & Priority */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-mono text-[10px] text-slate-400 font-semibold tracking-wider">
          {lead.lead_number || "LEAD"}
        </span>
        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black border ${priorityMeta.color}`}>
          {priorityMeta.label}
        </span>
      </div>

      {/* Prospect Name & Tags */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <h4 className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
          {lead.full_name}
        </h4>
        <div className="flex items-center gap-1 shrink-0">
          {lead.customer_id && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200"
              title="Registered Customer"
            >
              <UserCheck className="w-2.5 h-2.5" /> Client
            </span>
          )}
          {lead.lead_type === "CORPORATE" && (
            <span className="px-1 py-0.2 rounded text-[8px] font-black bg-purple-50 text-purple-700 border border-purple-200">
              CORP
            </span>
          )}
        </div>
      </div>

      {/* Contact Details & Direct Actions */}
      <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1.5">
        <div className="flex items-center gap-1 font-mono">
          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
          <span>{lead.mobile}</span>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <a
            href={`tel:${lead.mobile}`}
            className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-emerald-600"
            title="Call"
          >
            <Phone className="w-3 h-3" />
          </a>
          <a
            href={`https://wa.me/91${lead.mobile ? String(lead.mobile).replace(/\D/g, "") : ""}`}
            target="_blank"
            rel="noreferrer"
            className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-emerald-600"
            title="WhatsApp"
          >
            <MessageSquare className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Category, Source & Budget */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1 truncate">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 truncate">
            {lead.policy_type || "Health"}
          </span>
          {lead.lead_source && (
            <span className="text-[9px] font-medium text-slate-400 truncate capitalize">
              • {String(lead.lead_source).toLowerCase().replace(/_/g, " ")}
            </span>
          )}
        </div>
        <span className="font-black text-xs text-slate-900 shrink-0 font-mono">
          ₹{Number(lead.expected_premium || 0).toLocaleString("en-IN")}
        </span>
      </div>

      {/* Assigned Agent */}
      <div className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1.5 truncate">
        <UserCheck className="w-3 h-3 text-slate-400 shrink-0" />
        <span className="truncate">{lead.assigned_user_name || "Unassigned"}</span>
      </div>

      {/* Next Follow-up Reminder Badge */}
      {followUpDisplay && (
        <div
          className={`mt-2 p-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-bold ${
            followUpDisplay.isOverdue
              ? "bg-rose-50 text-rose-700 border border-rose-200"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          <CalendarClock className="w-3 h-3 shrink-0" />
          <span>
            {followUpDisplay.isOverdue ? "Overdue: " : "Follow-up: "}
            {followUpDisplay.text}
          </span>
        </div>
      )}

      {/* Card Footer: Quick Move Select & Actions */}
      <div
        className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <select
          value={currentStageKey}
          onChange={(e) => onStatusChange(e.target.value)}
          className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {KANBAN_5_STAGES.map((st) => (
            <option key={st.key} value={st.key}>
              Move: {st.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button
            onClick={onScheduleFollowUp}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-500 hover:text-indigo-600"
            title="Schedule Follow-up"
          >
            <CalendarClock className="w-3.5 h-3.5" />
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-500 hover:text-indigo-600"
              title="Edit Lead"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600"
              title="Delete Lead"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENT: 3. ALL LEADS TABLE (List View with Multi-Select & Batch Assign)
// ===========================================================================
function ListView({
  leads,
  total,
  totalPages,
  page,
  setPage,
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  filterCategory,
  setFilterCategory,
  filterSource,
  setFilterSource,
  filterPriority,
  setFilterPriority,
  filterAssigned,
  setFilterAssigned,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  staffUsers,
  loading,
  selectedIds,
  setSelectedIds,
  onOpenAddLead,
  onEditLead,
  onOpenLead360,
  onConvertLead,
  onScheduleFollowUp,
  onBulkAssign,
  onDeleteLead,
  onRefresh,
}) {
  const toggleSelectAll = () => {
    if (selectedIds.length === leads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(leads.map((l) => l.id));
    }
  };

  const toggleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Comprehensive Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by prospect name, mobile, email, or lead #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>

            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={filterPriority}
              onChange={(e) => {
                setFilterPriority(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value="ALL">All Priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>

            <select
              value={filterAssigned}
              onChange={(e) => {
                setFilterAssigned(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value="ALL">All Assignees</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>

            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bulk Action Strip */}
        {selectedIds.length > 0 && (
          <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between animate-in fade-in">
            <span className="text-xs font-bold text-indigo-900">
              {selectedIds.length} leads selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onBulkAssign}
                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs"
              >
                Assign Selected
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-white"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={leads.length > 0 && selectedIds.length === leads.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                </th>
                <th className="py-3 px-4">Lead ID & Date</th>
                <th className="py-3 px-4">Prospect Details</th>
                <th className="py-3 px-4">Requirement</th>
                <th className="py-3 px-4">Budget / Est.</th>
                <th className="py-3 px-4">Status & Priority</th>
                <th className="py-3 px-4">Assigned Agent</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading leads database...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    No leads found matching current filters.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const statMeta = STATUS_MAP[lead.status] || { label: lead.status, color: "bg-slate-100 text-slate-700" };
                  const priorityMeta = PRIORITIES.find((p) => p.key === lead.priority) || PRIORITIES[1];
                  const isChecked = selectedIds.includes(lead.id);
                  return (
                    <tr key={lead.id} className={`hover:bg-slate-50/70 transition-colors ${isChecked ? "bg-indigo-50/20" : ""}`}>
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(lead.id)}
                          className="rounded border-slate-300 text-indigo-600"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900">{lead.lead_number}</span>
                        <div className="text-[10px] text-slate-400">
                          {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : ""}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{lead.full_name}</span>
                          {lead.customer_id && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200"
                              title="Linked to Registered Customer"
                            >
                              <UserCheck className="w-2.5 h-2.5" /> Client
                            </span>
                          )}
                          {lead.lead_type === "CORPORATE" && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                              CORP
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-mono">{lead.mobile}</span>
                          {lead.city && (
                            <>
                              <span>•</span>
                              <span>{lead.city}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{lead.policy_type || "Health"}</span>
                        {lead.lead_source && (
                          <div className="text-[10px] text-slate-400 capitalize">
                            Source: {String(lead.lead_source).toLowerCase().replace(/_/g, " ")}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          ₹{Number(lead.expected_premium || 0).toLocaleString("en-IN")}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statMeta.color}`}>
                            {statMeta.label}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${priorityMeta.color}`}>
                            {priorityMeta.label}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 truncate max-w-[130px]">
                          {lead.assigned_user_name || "Unassigned"}
                        </div>
                        {lead.sub_agent_name && (
                          <div className="text-[10px] text-teal-700 truncate max-w-[130px]">
                            Agent: {lead.sub_agent_name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenLead360(lead.id)}
                            className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold"
                          >
                            360° View
                          </button>
                          <button
                            onClick={() => onEditLead(lead)}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                            title="Edit Lead"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {lead.status !== "CONVERTED" && (
                            <button
                              onClick={() => onConvertLead(lead)}
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold"
                              title="Convert to Customer"
                            >
                              Convert
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteLead && onDeleteLead(lead)}
                            className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-4 py-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold">{leads.length}</span> of{" "}
              <span className="font-semibold">{total}</span> records
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENT: 4. FOLLOW-UPS & TASKS VIEW
// ===========================================================================
function FollowUpsView({
  followUps,
  loading,
  filter,
  setFilter,
  onComplete,
  onOpenLead360,
  onScheduleNew,
  onRefresh,
}) {
  return (
    <div className="space-y-4">
      {/* Top Filter Tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {[
            { key: "TODAY", label: "Due Today" },
            { key: "OVERDUE", label: "Overdue" },
            { key: "UPCOMING", label: "Upcoming" },
            { key: "ALL", label: "All Reminders" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === tab.key
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onScheduleNew}
            className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Follow-up</span>
          </button>
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reminders List */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
            Loading follow-up tasks...
          </div>
        ) : followUps.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <CalendarClock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold">No follow-ups found for this filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {followUps.map((item) => {
              const isOverdue = item.is_overdue;
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                    item.status === "COMPLETED"
                      ? "bg-slate-50/60 border-slate-200 opacity-60"
                      : isOverdue
                      ? "bg-rose-50/40 border-rose-200"
                      : "bg-white border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{item.lead_name}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">
                        {item.reminder_type}
                      </span>
                      {isOverdue && item.status !== "COMPLETED" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                          OVERDUE
                        </span>
                      )}
                      {item.status === "COMPLETED" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          COMPLETED
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 font-medium">"{item.notes || "Follow up regarding policy requirements"}"</p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(item.scheduled_time).toLocaleString()}
                      </span>
                      {item.assigned_to_name && (
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                          Assigned: {item.assigned_to_name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status !== "COMPLETED" && (
                      <button
                        onClick={() => onComplete(item)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs"
                      >
                        Complete Task
                      </button>
                    )}
                    <button
                      onClick={() => onOpenLead360(item.lead_id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                    >
                      Lead 360°
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENT: 5. SALES CRM REPORTS & ANALYTICS
// ===========================================================================
function ReportsView({
  reportType,
  setReportType,
  reportRows,
  loading,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  onExport,
  onRefresh,
}) {
  return (
    <div className="space-y-4">
      {/* Report Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">Report Dimension:</span>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-bold text-indigo-700"
          >
            <option value="SOURCE">Lead Acquisition Source Performance</option>
            <option value="CATEGORY">Insurance Category Distribution</option>
            <option value="STATUS">Pipeline Status Progression</option>
            <option value="PRIORITY">Lead Priority Breakdown</option>
            <option value="AGENT">Agent & Employee Sales Leaderboard</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <DatePicker
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            placeholder="From Date"
          />
          <span className="text-xs text-slate-400">to</span>
          <DatePicker
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            placeholder="To Date"
          />
          <button
            onClick={() => onExport("xlsx")}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-4">Segment / Dimension</th>
              <th className="py-3 px-4 text-right">Total Leads</th>
              <th className="py-3 px-4 text-right">Converted</th>
              <th className="py-3 px-4 text-right">Lost</th>
              <th className="py-3 px-4 text-right">Expected Premium</th>
              <th className="py-3 px-4 text-right">Conversion Rate (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                  Generating CRM analytics...
                </td>
              </tr>
            ) : reportRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-slate-400">
                  No records found for current reporting timeframe.
                </td>
              </tr>
            ) : (
              reportRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{row.name}</td>
                  <td className="py-3 px-4 text-right font-black text-slate-800">{row.total_leads}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-700">{row.converted_count}</td>
                  <td className="py-3 px-4 text-right font-bold text-rose-600">{row.lost_count}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    ₹{Number(row.total_expected_premium || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {row.conversion_rate}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENT: 6. COMPLETE ADD / EDIT LEAD MODAL (5 Structured Sections)
// ===========================================================================
function AddEditLeadModal({ isOpen, lead, staffUsers, subAgents, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    customer_id: lead?.customer_id || null,
    lead_type: lead?.lead_type || "INDIVIDUAL",
    full_name: lead?.full_name || "",
    mobile: lead?.mobile || "",
    alternate_mobile: lead?.alternate_mobile || "",
    email: lead?.email || "",
    date_of_birth: lead?.date_of_birth ? lead.date_of_birth.slice(0, 10) : "",
    gender: lead?.gender || "MALE",
    occupation: lead?.occupation || "",
    company_name: lead?.company_name || "",
    gstin: lead?.gstin || "",
    address_line1: lead?.address_line1 || lead?.address || "",
    address_line2: lead?.address_line2 || lead?.address_line_2 || "",
    city: lead?.city || "",
    state: lead?.state || "",
    pincode: lead?.pincode || "",
    policy_type: lead?.policy_type || "Health",
    preferred_company_id: lead?.preferred_company_id || "",
    preferred_plan_id: lead?.preferred_plan_id || "",
    coverage_amount: lead?.coverage_amount || lead?.sum_insured || "",
    expected_premium: lead?.expected_premium || "",
    members_count: lead?.members_count || lead?.member_count || 1,
    is_floater: lead?.is_floater !== false,
    has_existing_insurance: lead?.has_existing_insurance || lead?.existing_insurance || false,
    existing_policy_number: lead?.existing_policy_number || "",
    existing_expiry_date: lead?.existing_expiry_date ? lead.existing_expiry_date.slice(0, 10) : "",
    lead_source: lead?.lead_source || "PHONE_CALL",
    campaign_name: lead?.campaign_name || "",
    referral_name: lead?.referral_name || "",
    priority: lead?.priority || "MEDIUM",
    assigned_user_id: lead?.assigned_user_id || "",
    sub_agent_id: lead?.sub_agent_id || "",
    notes: lead?.notes || lead?.requirement_description || "",
    internal_remarks: lead?.internal_remarks || "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [forceDuplicate, setForceDuplicate] = useState(false);

  // Customer suggestion & database linking states
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [linkedCustomerInfo, setLinkedCustomerInfo] = useState(
    lead?.customer_id
      ? {
          id: lead.customer_id,
          full_name: lead.customer_name || lead.full_name || "Existing Customer",
          phone: lead.mobile,
          email: lead.email,
          city: lead.city,
        }
      : null
  );
  const customerSearchRef = useRef(null);

  // Debounced search for customers in database
  useEffect(() => {
    if (!customerSearchTerm || customerSearchTerm.trim().length < 2) {
      setCustomerSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingCustomer(true);
      try {
        const res = await insuranceAPI.getCustomers({
          search: customerSearchTerm.trim(),
          page_size: 8,
        });
        if (res.ok && res.data) {
          const items = Array.isArray(res.data) ? res.data : (res.data.items || []);
          setCustomerSuggestions(items);
          setShowCustomerDropdown(true);
        }
      } catch (err) {
        console.error("Failed to query customers:", err);
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [customerSearchTerm]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // When selecting a customer from suggestions or duplicate match
  const handleSelectCustomer = (cust) => {
    const custFullName =
      `${cust.first_name || ""} ${cust.last_name || ""}`.trim() ||
      cust.full_name ||
      cust.company_name ||
      "";
    setFormData((prev) => ({
      ...prev,
      customer_id: cust.id,
      lead_type: cust.customer_type === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL",
      full_name: custFullName || prev.full_name,
      mobile: cust.phone || prev.mobile,
      alternate_mobile: cust.alternate_phone || prev.alternate_mobile,
      email: cust.email || prev.email,
      date_of_birth: cust.date_of_birth ? cust.date_of_birth.slice(0, 10) : prev.date_of_birth,
      gender: cust.gender || prev.gender,
      occupation: cust.occupation || prev.occupation,
      company_name: cust.company_name || prev.company_name,
      gstin: cust.gstin || prev.gstin,
      address_line1: cust.address || prev.address_line1,
      city: cust.city || prev.city,
      state: cust.state || prev.state,
      pincode: cust.pincode || prev.pincode,
      lead_source: prev.lead_source === "PHONE_CALL" ? "EXISTING_CUSTOMER" : prev.lead_source,
    }));
    setLinkedCustomerInfo({
      id: cust.id,
      full_name: custFullName,
      phone: cust.phone,
      email: cust.email,
      city: cust.city,
      customer_type: cust.customer_type || "INDIVIDUAL",
    });
    setCustomerSearchTerm("");
    setShowCustomerDropdown(false);
    setDuplicateWarning(null);
  };

  const handleUnlinkCustomer = () => {
    setFormData((prev) => ({
      ...prev,
      customer_id: null,
      lead_source: prev.lead_source === "EXISTING_CUSTOMER" ? "PHONE_CALL" : prev.lead_source,
    }));
    setLinkedCustomerInfo(null);
  };

  // Live duplicate check on mobile/email blur
  const checkDuplicates = async () => {
    if (!formData.mobile || formData.mobile.length < 10) return;
    try {
      const res = await insuranceAPI.checkLeadDuplicates({
        mobile: formData.mobile,
        email: formData.email || undefined,
        exclude_lead_id: lead?.id || undefined,
      });
      if (res.ok && res.data.has_duplicates) {
        setDuplicateWarning(res.data);
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      // Ignored
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const nameCheck = validateName(formData.full_name, "Prospect Full Name", true);
    if (!nameCheck.isValid) {
      setError(nameCheck.error);
      return;
    }

    const mobileCheck = validateIndianMobile(formData.mobile, "Mobile Number", true);
    if (!mobileCheck.isValid) {
      setError(mobileCheck.error);
      return;
    }

    if (formData.alternate_mobile) {
      const altCheck = validateIndianMobile(formData.alternate_mobile, "Alternate Phone", false);
      if (!altCheck.isValid) {
        setError(altCheck.error);
        return;
      }
    }

    if (formData.email) {
      const emailCheck = validateEmail(formData.email, "Email Address", false);
      if (!emailCheck.isValid) {
        setError(emailCheck.error);
        return;
      }
    }

    if (formData.date_of_birth) {
      const dobCheck = validateDobNotFuture(formData.date_of_birth, "Date of Birth");
      if (!dobCheck.isValid) {
        setError(dobCheck.error);
        return;
      }
    }

    if (formData.pincode) {
      const pinCheck = validatePinCode(formData.pincode, "PIN Code", false);
      if (!pinCheck.isValid) {
        setError(pinCheck.error);
        return;
      }
    }

    if (formData.gstin) {
      const gstinCheck = validateGstin(formData.gstin, "GSTIN", false);
      if (!gstinCheck.isValid) {
        setError(gstinCheck.error);
        return;
      }
    }

    if (formData.coverage_amount) {
      const covCheck = validatePositiveDecimal(formData.coverage_amount, "Coverage Amount", false);
      if (!covCheck.isValid) {
        setError(covCheck.error);
        return;
      }
    }

    if (formData.expected_premium) {
      const premCheck = validatePositiveDecimal(formData.expected_premium, "Expected Premium", false);
      if (!premCheck.isValid) {
        setError(premCheck.error);
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        ...formData,
        customer_id: formData.customer_id || null,
        coverage_amount: formData.coverage_amount ? Number(formData.coverage_amount) : null,
        expected_premium: formData.expected_premium ? Number(formData.expected_premium) : null,
        preferred_company_id: formData.preferred_company_id || null,
        preferred_plan_id: formData.preferred_plan_id || null,
        assigned_user_id: formData.assigned_user_id || null,
        sub_agent_id: formData.sub_agent_id || null,
        date_of_birth: formData.date_of_birth || null,
        existing_expiry_date: formData.existing_expiry_date || null,
      };

      let res;
      if (lead) {
        res = await insuranceAPI.updateLead(lead.id, payload);
      } else {
        // If customer is already linked, forceDuplicate is safe and allowed
        res = await insuranceAPI.createLead(payload, forceDuplicate || !!payload.customer_id);
      }

      if (res.ok || res.status === 200 || res.status === 201) {
        onSaved();
      } else if (res.status === 409) {
        setError(res.error || "A lead or customer with this mobile or email already exists.");
        setDuplicateWarning({ message: "Duplicate detected. Check 'Proceed as duplicate' or link customer profile if intended." });
      } else {
        setError(res.error || "Failed to save lead.");
      }
    } catch (err) {
      setError("An unexpected error occurred while saving lead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {lead ? `Edit Lead: ${lead.lead_number}` : "Create New Insurance Lead"}
            </h2>
            <p className="text-xs text-slate-500">
              Enter comprehensive prospect requirement details for sales tracking.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer Linking & Autocomplete Suggestion Bar */}
          <div
            className="bg-gradient-to-r from-indigo-50/70 via-slate-50 to-indigo-50/40 p-4 rounded-xl border border-indigo-100 space-y-2.5 relative"
            ref={customerSearchRef}
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-indigo-950 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span>Link Existing Customer Profile (Auto-fill Details)</span>
              </label>
              {linkedCustomerInfo && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                  <Check className="w-3 h-3" /> Linked to Database
                </span>
              )}
            </div>

            {linkedCustomerInfo ? (
              <div className="p-3 bg-white rounded-lg border border-emerald-300 flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate flex items-center gap-2">
                      <span>{linkedCustomerInfo.full_name}</span>
                      {linkedCustomerInfo.customer_type && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          {linkedCustomerInfo.customer_type}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 truncate">
                      {linkedCustomerInfo.phone && <span className="font-mono">{linkedCustomerInfo.phone}</span>}
                      {linkedCustomerInfo.email && <span>• {linkedCustomerInfo.email}</span>}
                      {linkedCustomerInfo.city && <span>• {linkedCustomerInfo.city}</span>}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleUnlinkCustomer}
                  className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 shrink-0"
                >
                  Unlink
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={customerSearchTerm}
                    onChange={(e) => {
                      setCustomerSearchTerm(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => {
                      if (customerSuggestions.length > 0) setShowCustomerDropdown(true);
                    }}
                    placeholder="Search registered customers by name, phone, or email to auto-fill..."
                    className="w-full pl-9 pr-9 py-2 rounded-lg border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:outline-indigo-500"
                  />
                  {isSearchingCustomer && (
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin absolute right-3 top-2.5" />
                  )}
                </div>

                {showCustomerDropdown && customerSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
                    <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Matching Registered Customers ({customerSuggestions.length})
                    </div>
                    {customerSuggestions.map((cust) => {
                      const name =
                        `${cust.first_name || ""} ${cust.last_name || ""}`.trim() ||
                        cust.company_name ||
                        "Unnamed Customer";
                      return (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => handleSelectCustomer(cust)}
                          className="w-full text-left px-3 py-2.5 hover:bg-indigo-50/70 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                              <span>{name}</span>
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                {cust.customer_type || "INDIVIDUAL"}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 truncate mt-0.5">
                              <span className="font-mono">{cust.phone}</span>
                              {cust.email && <span>• {cust.email}</span>}
                              {(cust.city || cust.state) && (
                                <span className="text-slate-400">
                                  • {[cust.city, cust.state].filter(Boolean).join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-indigo-600 shrink-0 flex items-center gap-1">
                            Link & Auto-fill <ArrowRight className="w-3 h-3" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Duplicate Detection Alert & Suggestions */}
          {duplicateWarning && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 space-y-2.5">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Existing Record Detected</span>
              </div>
              <p className="text-[11px]">
                A prospect or customer with this mobile or email was found in the system.
              </p>

              {/* Show matching customers if any */}
              {duplicateWarning.matching_customers && duplicateWarning.matching_customers.length > 0 && (
                <div className="bg-white/90 p-3 rounded-lg border border-amber-300 space-y-2">
                  <span className="text-[11px] font-bold text-slate-900 block">
                    Found Registered Customer in Database:
                  </span>
                  {duplicateWarning.matching_customers.map((mc) => (
                    <div key={mc.id} className="flex items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-slate-900">{mc.name}</span>
                        <span className="text-[11px] text-slate-500 font-mono ml-2">{mc.mobile}</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const custRes = await insuranceAPI.getCustomer(mc.id);
                            if (custRes.ok && custRes.data) {
                              handleSelectCustomer(custRes.data);
                            } else {
                              setFormData((prev) => ({
                                ...prev,
                                customer_id: mc.id,
                                full_name: mc.name || prev.full_name,
                                mobile: mc.mobile || prev.mobile,
                                lead_source: "EXISTING_CUSTOMER",
                              }));
                              setLinkedCustomerInfo({ id: mc.id, full_name: mc.name, phone: mc.mobile });
                              setDuplicateWarning(null);
                            }
                          } catch {
                            setFormData((prev) => ({ ...prev, customer_id: mc.id, lead_source: "EXISTING_CUSTOMER" }));
                            setDuplicateWarning(null);
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-indigo-600 text-white font-bold text-[10px] hover:bg-indigo-700 flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>Link & Auto-fill Profile</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 pt-1 font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceDuplicate}
                  onChange={(e) => setForceDuplicate(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span>Force create as duplicate lead</span>
              </label>
            </div>
          )}

          {/* Section A: Personal Information */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700 flex items-center gap-2">
              <span>Section A: Personal & Identity Information</span>
            </h3>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, lead_type: "INDIVIDUAL" })}
                className={`px-3 py-1.5 rounded-lg font-bold ${
                  formData.lead_type === "INDIVIDUAL" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                Individual
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, lead_type: "CORPORATE" })}
                className={`px-3 py-1.5 rounded-lg font-bold ${
                  formData.lead_type === "CORPORATE" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                Corporate / Enterprise
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormInput
                label="Full Name"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="e.g. Aditya Verma"
              />

              <FormInput
                type="mobile"
                label="Mobile Number"
                required
                value={formData.mobile}
                onBlur={checkDuplicates}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="10-digit number"
              />

              <FormInput
                type="mobile"
                label="Alternate Phone"
                value={formData.alternate_mobile}
                onChange={(e) => setFormData({ ...formData, alternate_mobile: e.target.value })}
                placeholder="Optional"
              />

              <FormInput
                type="email"
                label="Email Address"
                value={formData.email}
                onBlur={checkDuplicates}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="name@example.com"
              />

              <div>
                <label className="block font-bold text-slate-700 mb-1">Date of Birth</label>
                <DatePicker
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  maxDate={getTodayIso()}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Occupation</label>
                <input
                  type="text"
                  value={formData.occupation}
                  onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                  placeholder="e.g. Software Consultant"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              {formData.lead_type === "CORPORATE" && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="e.g. Nexus Tech Ltd"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200"
                    />
                  </div>
                  <FormInput
                    type="gstin"
                    label="GSTIN"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    placeholder="15-digit GSTIN"
                  />
                </>
              )}
            </div>
          </div>

          {/* Section B: Address Details */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700">
              Section B: Address Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Address Line</label>
                <input
                  type="text"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                  placeholder="Street / Building"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g. Pune"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="e.g. Maharashtra"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <FormInput
                type="pin"
                label="PIN Code"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                placeholder="411001"
              />
            </div>
          </div>

          {/* Section C: Insurance Requirement */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700">
              Section C: Insurance Requirements
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.policy_type}
                  onChange={(e) => setFormData({ ...formData, policy_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-bold"
                >
                  {INSURANCE_CATEGORIES.map((cat) => (
                    <option key={cat.code} value={cat.label}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Sum Insured (₹)</label>
                <input
                  type="number"
                  value={formData.coverage_amount}
                  onChange={(e) => setFormData({ ...formData, coverage_amount: e.target.value })}
                  placeholder="e.g. 1000000"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Expected Premium Budget (₹)</label>
                <input
                  type="number"
                  value={formData.expected_premium}
                  onChange={(e) => setFormData({ ...formData, expected_premium: e.target.value })}
                  placeholder="e.g. 25000"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Insured Members</label>
                <input
                  type="number"
                  min={1}
                  value={formData.members_count}
                  onChange={(e) => setFormData({ ...formData, members_count: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.is_floater}
                    onChange={(e) => setFormData({ ...formData, is_floater: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span>Family Floater Coverage</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section D: Acquisition & Assignment */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700">
              Section D: Acquisition & Lead Assignment
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Lead Source</label>
                <select
                  value={formData.lead_source}
                  onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-bold"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assign to Staff Member</label>
                <select
                  value={formData.assigned_user_id}
                  onChange={(e) => setFormData({ ...formData, assigned_user_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="">Unassigned</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Sub-Agent / POSP</label>
                <select
                  value={formData.sub_agent_id}
                  onChange={(e) => setFormData({ ...formData, sub_agent_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="">None / Direct</option>
                  {subAgents.map((sa) => (
                    <option key={sa.id} value={sa.id}>{sa.name} ({sa.agent_code})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section E: Notes & Remarks */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700">
              Section E: Requirement Notes & Remarks
            </h3>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Record prospect conversation details, carrier preferences, pre-existing conditions..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{lead ? "Save Changes" : "Create Lead"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENT: 7. COMPLETE LEAD 360° DRAWER (Timeline, Notes, Follow-ups, Quotations)
// ===========================================================================
function Lead360Drawer({ leadId, staffUsers = [], onClose, onEdit, onConvert, onDelete, onScheduleFollowUp, onRefreshParents }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("OVERVIEW"); // OVERVIEW, TIMELINE, FOLLOW_UPS, NOTES, QUOTATIONS
  const [newNote, setNewNote] = useState("");
  const [noteImportant, setNoteImportant] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await insuranceAPI.getLead360(leadId);
      if (res.ok) {
        setProfile(res.data);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leadId) fetchProfile();
  }, [leadId]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await insuranceAPI.addLeadNote(leadId, newNote.trim(), noteImportant);
      if (res.ok) {
        setNewNote("");
        setNoteImportant(false);
        fetchProfile();
      }
    } finally {
      setSubmittingNote(false);
    }
  };

  if (!profile && loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-end z-50">
        <div className="w-full max-w-2xl bg-white h-full p-8 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const lead = profile.lead;
  const statMeta = STATUS_MAP[lead.status] || { label: lead.status, color: "bg-slate-100 text-slate-700" };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-end z-50 animate-in fade-in">
      <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Drawer Header Banner */}
        <div className="p-6 border-b border-slate-200 bg-slate-50/70 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
              {lead.full_name?.charAt(0) || "L"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-slate-500">{lead.lead_number}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statMeta.color}`}>
                  {statMeta.label}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700">
                  {lead.policy_type}
                </span>
                {lead.customer_id && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <UserCheck className="w-3 h-3" />
                    <span>Registered Client</span>
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-slate-900 truncate mt-1">{lead.full_name}</h2>
              <div className="flex flex-wrap items-center gap-3 text-slate-600 mt-1">
                <a href={`tel:${lead.mobile}`} className="flex items-center gap-1 hover:text-indigo-600 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{lead.mobile}</span>
                </a>
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-indigo-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{lead.email}</span>
                  </a>
                )}
                {lead.city && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{lead.city}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Communication & Action Bar */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-200/80">
            <a
              href={`tel:${lead.mobile || ""}`}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Call</span>
            </a>
            <a
              href={`https://wa.me/91${lead.mobile ? String(lead.mobile).replace(/\D/g, "") : ""}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp</span>
            </a>
            <button
              onClick={() => onScheduleFollowUp(lead)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs"
            >
              <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Schedule Follow-up</span>
            </button>
            <button
              onClick={() => onEdit(lead)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs"
            >
              <Edit className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit Lead</span>
            </button>
            <button
              onClick={() => onDelete && onDelete(lead)}
              className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 font-bold text-rose-700 flex items-center gap-1.5 shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete</span>
            </button>
            {lead.status !== "CONVERTED" && (
              <button
                onClick={() => onConvert(lead)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-xs ml-auto"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Convert to Customer</span>
              </button>
            )}
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center gap-1 mt-4 -mb-6 border-b border-slate-200">
            {[
              { key: "OVERVIEW", label: "Overview" },
              { key: "TIMELINE", label: `Timeline (${profile.activities?.length || 0})` },
              { key: "FOLLOW_UPS", label: `Tasks (${profile.reminders?.length || 0})` },
              { key: "NOTES", label: `Notes (${profile.notes?.length || 0})` },
              { key: "QUOTATIONS", label: `Quotes (${profile.quotations?.length || 0})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all ${
                  activeTab === tab.key
                    ? "border-indigo-600 text-indigo-700 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Drawer Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "OVERVIEW" && (
            <div className="space-y-4">
              {lead.customer_id && (
                <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                        Linked Customer Profile
                      </span>
                      <h4 className="font-bold text-slate-900 text-xs mt-0.5 truncate">
                        {lead.customer_name || lead.full_name}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate">
                        Database Customer ID: <span className="font-mono">{lead.customer_id}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/customers?search=${encodeURIComponent(lead.mobile || lead.full_name)}`)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-bold hover:bg-emerald-50 flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
                  >
                    <span>Customer 360°</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Insurance Requirement</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Category</span>
                    <span className="font-bold text-slate-800">{lead.policy_type}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Sum Insured</span>
                    <span className="font-mono font-bold text-slate-800">
                      ₹{Number(lead.coverage_amount || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Expected Premium</span>
                    <span className="font-mono font-bold text-indigo-700">
                      ₹{Number(lead.expected_premium || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Coverage Type</span>
                    <span className="font-bold text-slate-800">
                      {lead.is_floater ? "Family Floater" : "Individual"} ({lead.members_count || 1} members)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Existing Insurance</span>
                    <span className="font-bold text-slate-800">
                      {lead.has_existing_insurance ? `Yes (#${lead.existing_policy_number || "N/A"})` : "None"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Acquisition Source</span>
                    <span className="font-bold text-slate-800 capitalize">
                      {lead.lead_source?.toLowerCase().replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Address & Location</h4>
                <p className="text-slate-700">
                  {[lead.address_line1, lead.address_line2, lead.city, lead.state, lead.pincode]
                    .filter(Boolean)
                    .join(", ") || "No address details on file."}
                </p>
              </div>

              {lead.notes && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Initial Requirements & Notes</h4>
                  <p className="text-slate-700 whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TIMELINE */}
          {activeTab === "TIMELINE" && (
            <div className="space-y-4">
              {!profile.activities?.length ? (
                <p className="text-center py-10 text-slate-400">No activity logged yet.</p>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {profile.activities.map((act) => {
                    const activityTitle =
                      act.title ||
                      (act.activity_type ? String(act.activity_type).replace(/_/g, " ") : "") ||
                      (act.action_type ? String(act.action_type).replace(/_/g, " ") : "") ||
                      "Activity Logged";
                    const activityBadge = act.activity_type || act.action_type || null;
                    const actorName = act.user_name || act.actor_name || null;
                    const dateStr = act.created_at
                      ? new Date(act.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                      : "Recent";

                    return (
                      <div key={act.id || Math.random()} className="relative">
                        <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white shadow-2xs" />
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">{activityTitle}</span>
                              {activityBadge && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">
                                  {String(activityBadge).replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {dateStr}
                            </span>
                          </div>
                          {act.description && (
                            <p className="text-slate-600 text-xs leading-relaxed">{act.description}</p>
                          )}
                          {(act.old_value || act.new_value) && (
                            <div className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-2 font-mono">
                              {act.old_value && <span className="line-through text-rose-500">{act.old_value}</span>}
                              {act.old_value && act.new_value && <span>→</span>}
                              {act.new_value && <span className="text-emerald-600 font-bold">{act.new_value}</span>}
                            </div>
                          )}
                          {actorName && (
                            <span className="text-[10px] text-slate-400 block pt-0.5">By: {actorName}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FOLLOW-UPS */}
          {activeTab === "FOLLOW_UPS" && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  onClick={() => onScheduleFollowUp(lead)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Follow-up</span>
                </button>
              </div>

              {!profile.reminders?.length ? (
                <p className="text-center py-10 text-slate-400">No follow-ups recorded.</p>
              ) : (
                profile.reminders.map((rem) => {
                  const scheduledDisplay = rem.reminder_date
                    ? `${rem.reminder_date} ${rem.reminder_time ? `at ${rem.reminder_time}` : ""}`
                    : rem.scheduled_time
                    ? new Date(rem.scheduled_time).toLocaleString()
                    : "Not specified";
                  return (
                    <div key={rem.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{rem.title || rem.reminder_type || "Follow-up"}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rem.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          {rem.status}
                        </span>
                      </div>
                      <p className="text-slate-700">{rem.description || rem.notes || "No details provided"}</p>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>Scheduled: {scheduledDisplay}</span>
                        {rem.assigned_to_name && <span>Assigned to: {rem.assigned_to_name}</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 4: INTERNAL NOTES */}
          {activeTab === "NOTES" && (
            <div className="space-y-4">
              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add an internal note or discussion summary..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none text-xs"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-[11px]">
                    <input
                      type="checkbox"
                      checked={noteImportant}
                      onChange={(e) => setNoteImportant(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span>Mark as Important</span>
                  </label>
                  <button
                    type="submit"
                    disabled={submittingNote || !newNote.trim()}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold"
                  >
                    Add Note
                  </button>
                </div>
              </form>

              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                {!profile.notes?.length ? (
                  <p className="text-center py-6 text-slate-400">No internal notes yet.</p>
                ) : (
                  profile.notes.map((n) => {
                    const isImportant = n.is_important || n.note_type === "IMPORTANT";
                    const noteText = n.description || n.note || n.title || "";
                    const author = n.author_name || "Agent";
                    const dateStr = n.created_at ? new Date(n.created_at).toLocaleString() : "";
                    return (
                      <div key={n.id} className={`p-3 rounded-xl border ${isImportant ? "bg-amber-50/50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                        <p className="text-slate-800 whitespace-pre-wrap">{noteText}</p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 mt-1 border-t border-slate-200/50">
                          <span>By {author}</span>
                          <span>{dateStr}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 5: LINKED QUOTATIONS */}
          {activeTab === "QUOTATIONS" && (
            <div className="space-y-3">
              {!profile.quotations?.length ? (
                <div className="py-10 text-center text-slate-400 space-y-2">
                  <FileText className="w-8 h-8 mx-auto text-slate-300" />
                  <p>No insurance quotations linked yet.</p>
                </div>
              ) : (
                profile.quotations.map((q) => (
                  <div key={q.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-indigo-700">{q.quotation_number}</span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">{q.quotation_title || (q.policy_type ? `${q.policy_type} Quotation` : "Quotation")}</p>
                      <span className="text-[10px] text-slate-400">Created: {q.created_at ? new Date(q.created_at).toLocaleDateString() : (q.quotation_date || "N/A")}</span>
                    </div>
                    <div className="text-right">
                      {q.total_plans != null && (
                        <span className="text-xs font-bold text-slate-700 block">
                          {q.total_plans} {q.total_plans === 1 ? "Plan Option" : "Plan Options"}
                        </span>
                      )}
                      {q.final_premium ? (
                        <span className="text-sm font-black text-slate-900 font-mono">
                          ₹{Number(q.final_premium).toLocaleString("en-IN")}
                        </span>
                      ) : null}
                      <span className="block text-[10px] font-bold text-emerald-700">{q.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENT: 8. CONVERT LEAD TO CUSTOMER MODAL
// ===========================================================================
function ConvertLeadModal({ lead, onClose, onConverted }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [convertedResult, setConvertedResult] = useState(null);

  const handleConvert = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await insuranceAPI.convertLeadToCustomer(lead.id, {
        notes: `Converted from lead ${lead.lead_number}`,
      });
      if (res.ok) {
        setConvertedResult(res.data);
      } else {
        setError(res.error || "Failed to convert lead to customer.");
      }
    } catch {
      setError("Error executing customer conversion.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 text-xs space-y-4">
        {convertedResult ? (
          <div className="text-center space-y-4 py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Lead Converted Successfully!</h3>
              <p className="text-slate-500 mt-1">
                Customer record #{convertedResult.customer_id.slice(0, 8)} created for {lead.full_name}.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-left text-[11px] text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">Important Operational Note:</p>
              <p>
                In compliance with strict insurance underwriting guidelines, converting a lead DOES NOT automatically issue a policy.
                You can now prepare a quotation or bind a policy via Policy Management.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => {
                  onConverted(convertedResult);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Convert Lead to Customer Profile</h3>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
                {error}
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-1.5">
              <div className="font-bold text-slate-900">{lead.full_name}</div>
              <div className="text-slate-600">Mobile: {lead.mobile}</div>
              {lead.email && <div className="text-slate-600">Email: {lead.email}</div>}
              <div className="text-slate-600">Requirement: {lead.policy_type} (₹{lead.expected_premium || 0})</div>
            </div>

            <p className="text-slate-500 text-[11px] leading-relaxed">
              Converting will create a verified Customer profile with all contact and address information. The lead status will be updated to CONVERTED.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConvert}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs flex items-center gap-2"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                <span>Confirm Conversion</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENT: 9. SCHEDULE FOLLOW-UP MODAL
// ===========================================================================
function ScheduleFollowUpModal({ lead, staffUsers, onClose, onScheduled }) {
  const [formData, setFormData] = useState({
    title: "",
    reminder_type: "PHONE_CALL",
    scheduled_time: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    notes: "",
    assigned_to_id: lead?.assigned_user_id || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!lead?.id) {
      alert("General follow-up scheduling requires selecting a specific lead.");
      onClose();
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const dt = new Date(formData.scheduled_time);
      const reminder_date = !isNaN(dt.getTime())
        ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
        : new Date().toISOString().slice(0, 10);
      const reminder_time = !isNaN(dt.getTime())
        ? `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`
        : "10:00";

      const typeLabels = {
        PHONE_CALL: "Phone Call",
        WHATSAPP: "WhatsApp Consultation",
        EMAIL: "Email Follow-up",
        MEETING: "Meeting",
      };
      const typeLabel = typeLabels[formData.reminder_type] || formData.reminder_type.replace(/_/g, " ");
      const title =
        formData.title.trim() ||
        `${typeLabel}: ${lead.full_name || "Lead"}`;

      const res = await insuranceAPI.scheduleLeadFollowUp(lead.id, {
        title,
        reminder_date,
        reminder_time,
        reminder_type: formData.reminder_type,
        priority: "NORMAL",
        assigned_to_id: formData.assigned_to_id || null,
        description: formData.notes.trim() || null,
        scheduled_time: formData.scheduled_time,
        notes: formData.notes.trim() || null,
      });

      if (res.ok) {
        onScheduled();
      } else {
        let errText = "Failed to schedule reminder.";
        if (typeof res.error === "string") {
          try {
            const parsed = JSON.parse(res.error);
            if (Array.isArray(parsed)) {
              errText = parsed.map((p) => p.msg || p.message || JSON.stringify(p)).join(", ");
            } else if (parsed && typeof parsed === "object" && parsed.detail) {
              errText = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
            } else {
              errText = res.error;
            }
          } catch {
            errText = res.error;
          }
        }
        setError(errText);
      }
    } catch (err) {
      setError(err?.message || "Error creating follow-up task.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 text-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-sm text-slate-900">Schedule Follow-up: {lead.full_name}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Task Title / Subject (Optional)</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={`e.g. WhatsApp Consultation: ${lead.full_name || "Lead"}`}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Follow-up Activity Type</label>
            <select
              value={formData.reminder_type}
              onChange={(e) => setFormData({ ...formData, reminder_type: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-bold"
            >
              <option value="PHONE_CALL">Phone Call</option>
              <option value="WHATSAPP">WhatsApp Consultation</option>
              <option value="EMAIL">Email Follow-up</option>
              <option value="MEETING">In-Person / Video Meeting</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Scheduled Date & Time</label>
            <input
              type="datetime-local"
              required
              value={formData.scheduled_time}
              onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Assign Task To</label>
            <select
              value={formData.assigned_to_id}
              onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
            >
              <option value="">Default (Self / Current Assignee)</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Agenda / Follow-up Notes</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Discuss revised quote with maternity cover..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50"
            >
              {submitting ? "Scheduling..." : "Save Follow-up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENT: 10. COMPLETE FOLLOW-UP MODAL
// ===========================================================================
function CompleteFollowUpModal({ reminder, onClose, onCompleted }) {
  const [outcome, setOutcome] = useState("INTERESTED");
  const [remarks, setRemarks] = useState("");
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextTime, setNextTime] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleComplete = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      let next_reminder_date = undefined;
      let next_reminder_time = undefined;
      if (scheduleNext && nextTime) {
        const dt = new Date(nextTime);
        if (!isNaN(dt.getTime())) {
          next_reminder_date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
          next_reminder_time = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
        }
      }

      const res = await insuranceAPI.completeLeadFollowUp(reminder.id, {
        outcome,
        completion_remarks: remarks.trim() || "Follow-up completed",
        remarks: remarks.trim() || undefined,
        schedule_next: scheduleNext,
        next_reminder_date,
        next_reminder_time,
        next_scheduled_time: scheduleNext ? new Date(nextTime).toISOString() : undefined,
      }, reminder.lead_id);

      if (res.ok) {
        onCompleted();
      } else {
        let errText = "Failed to complete task.";
        if (typeof res.error === "string") {
          try {
            const parsed = JSON.parse(res.error);
            if (Array.isArray(parsed)) {
              errText = parsed.map((p) => p.msg || p.message || JSON.stringify(p)).join(", ");
            } else if (parsed && typeof parsed === "object" && parsed.detail) {
              errText = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
            } else {
              errText = res.error;
            }
          } catch {
            errText = res.error;
          }
        }
        setError(errText);
      }
    } catch (err) {
      setError(err?.message || "Error resolving follow-up task.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 text-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-sm text-slate-900">Mark Follow-up Complete</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>}

        <form onSubmit={handleComplete} className="space-y-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Discussion Outcome</label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-bold"
            >
              <option value="INTERESTED">Interested — Proceeding</option>
              <option value="QUOTATION_REQUESTED">Quotation Requested</option>
              <option value="CALL_BACK_LATER">Call Back Later / Busy</option>
              <option value="NOT_INTERESTED">Not Interested</option>
              <option value="LOST">Lost to Competitor</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Completion Remarks</label>
            <textarea
              rows={2}
              required
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="What was discussed during the follow-up..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 resize-none"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 pt-1">
            <input
              type="checkbox"
              checked={scheduleNext}
              onChange={(e) => setScheduleNext(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600"
            />
            <span>Schedule another follow-up now</span>
          </label>

          {scheduleNext && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Next Follow-up Time</label>
              <input
                type="datetime-local"
                value={nextTime}
                onChange={(e) => setNextTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
            >
              {submitting ? "Resolving..." : "Complete Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENT: 11. BULK IMPORT MODAL (CSV & Genuine XLSX)
// ===========================================================================
function BulkImportModal({ isOpen, onClose, onImported }) {
  const [step, setStep] = useState(1); // 1: Upload, 2: Preview
  const [file, setFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDownloadTemplate = async (format = "xlsx") => {
    try {
      const blob = await insuranceAPI.downloadLeadTemplate(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads_import_template.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download template.");
    }
  };

  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await insuranceAPI.previewLeadsImport(formData);
      if (res.ok && Array.isArray(res.data)) {
        setPreviewRows(res.data);
        setStep(2);
      } else {
        setError(res.error || "Failed to parse file. Ensure format matches the template.");
      }
    } catch {
      setError("Error parsing uploaded file.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    try {
      const validRows = previewRows.filter((r) => r.is_valid).map((r) => r.data);
      const res = await insuranceAPI.confirmLeadsImport(validRows);
      if (res.ok) {
        onImported(res.data);
      } else {
        setError(res.error || "Failed to import leads.");
      }
    } catch {
      setError("Import execution error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full p-6 text-xs space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Bulk Import Leads</h3>
            <p className="text-[11px] text-slate-500">Upload CSV or genuine Excel (.xlsx) file with prospect data.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700">{error}</div>}

        {step === 1 ? (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900">Step 1: Download Import Template</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Includes required headers and sample data rows.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate("xlsx")}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold text-slate-700 flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate("csv")}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold text-slate-700 flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-sky-600" />
                  CSV
                </button>
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2 hover:border-indigo-400 transition-colors">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-bold text-slate-800">Select File for Validation</p>
              <input
                type="file"
                accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
                className="block mx-auto text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">
                Validation Preview: {previewRows.filter((r) => r.is_valid).length} valid of {previewRows.length} rows
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-indigo-600 font-semibold hover:underline"
              >
                Upload Different File
              </button>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Full Name</th>
                    <th className="py-2 px-3">Mobile</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.map((row) => (
                    <tr key={row.row_number} className={row.is_valid ? "" : "bg-rose-50/50"}>
                      <td className="py-2 px-3 font-mono">{row.row_number}</td>
                      <td className="py-2 px-3 font-semibold">{row.data?.full_name || "—"}</td>
                      <td className="py-2 px-3 font-mono">{row.data?.mobile || "—"}</td>
                      <td className="py-2 px-3">{row.data?.policy_type || "—"}</td>
                      <td className="py-2 px-3">
                        {row.is_valid ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Valid
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold">
                            {row.errors?.join(", ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={loading || previewRows.filter((r) => r.is_valid).length === 0}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold"
              >
                {loading ? "Importing..." : `Confirm Import (${previewRows.filter((r) => r.is_valid).length})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENT: 12. BULK ASSIGN MODAL
// ===========================================================================
function BulkAssignModal({ isOpen, leadIds, staffUsers, subAgents, onClose, onAssigned }) {
  const [assignedUserId, setAssignedUserId] = useState("");
  const [subAgentId, setSubAgentId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignedUserId && !subAgentId) {
      alert("Please select an employee or sub-agent to assign.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await insuranceAPI.bulkAssignLeads(
        leadIds,
        assignedUserId || null,
        subAgentId || null,
        notes || null
      );
      if (res.ok) {
        onAssigned();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 text-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-sm text-slate-900">Bulk Assign {leadIds.length} Leads</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleAssign} className="space-y-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Assign to Staff Member</label>
            <select
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
            >
              <option value="">Do Not Change / None</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Sub-Agent / POSP</label>
            <select
              value={subAgentId}
              onChange={(e) => setSubAgentId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
            >
              <option value="">None</option>
              {subAgents.map((sa) => (
                <option key={sa.id} value={sa.id}>{sa.name} ({sa.agent_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Assignment Remarks</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Distributed as part of Q4 health insurance campaign..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {submitting ? "Assigning..." : "Assign Leads"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
