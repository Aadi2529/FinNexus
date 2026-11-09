import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import HealthQuotationPreviewModal from "../components/HealthQuotationPreviewModal";
import { formatDateDMY, STANDARD_DISCLAIMER } from "../utils/ageCalculator";
import {
  Umbrella,
  Search,
  Plus,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Copy,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Users,
  Calendar,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Shield,
  Download,
  X,
  Filter,
  CheckCircle,
  Clock,
  Sparkles,
  ArrowRight,
  UserCheck,
} from "lucide-react";

export default function HealthQuotationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Quotation list state
  const [quotations, setQuotations] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tableError, setTableError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Real database KPI stats
  const [dbStats, setDbStats] = useState({
    total: 0,
    issued: 0,
    draft: 0,
    members_evaluated: 0,
  });

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [quotationToDelete, setQuotationToDelete] = useState(null);

  // Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewQuotationId, setPreviewQuotationId] = useState(null);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch real database KPI stats
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await api.insurance.quotations.stats();
      if (res && res.ok && res.data) {
        setDbStats({
          total: res.data.total ?? 0,
          issued: res.data.issued ?? 0,
          draft: res.data.draft ?? 0,
          members_evaluated: res.data.members_evaluated ?? 0,
        });
      }
    } catch (err) {
      console.warn("Could not load real-time database stats:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch quotations list from backend
  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    setTableError("");
    try {
      const res = await api.insurance.quotations.list({
        page,
        page_size: pageSize,
        search: debouncedSearch.trim() || undefined,
        status: statusFilter || undefined,
      });

      if (res.ok) {
        setQuotations(res.data.items || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.total_pages || 1);
      } else {
        setTableError(res.error || "Failed to load quotations from database.");
      }
    } catch (err) {
      setTableError("An unexpected error occurred while loading quotations.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter]);

  // Initial load and on query/filter changes
  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefreshAll = () => {
    fetchQuotations();
    fetchStats();
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setStatusFilter("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(searchTerm || statusFilter);

  // Duplication Handler
  const handleDuplicate = async (quotation) => {
    setActionLoadingId(`dup-${quotation.id}`);
    setActionSuccess("");
    setTableError("");
    try {
      const res = await api.insurance.quotations.duplicate(quotation.id);
      if (res.ok) {
        setActionSuccess(
          `Successfully duplicated proposal "${quotation.quotation_number}" as new draft "${res.data.quotation_number}".`
        );
        fetchQuotations();
        fetchStats();
      } else {
        setTableError(res.error || "Failed to duplicate quotation.");
      }
    } catch (err) {
      setTableError("Error duplicating quotation.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete Handlers
  const confirmDelete = (quotation) => {
    setQuotationToDelete(quotation);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!quotationToDelete) return;
    setActionLoadingId(`del-${quotationToDelete.id}`);
    try {
      const res = await api.insurance.quotations.delete(quotationToDelete.id);
      if (res.ok) {
        setActionSuccess(`Quotation "${quotationToDelete.quotation_number}" deleted successfully.`);
        setDeleteModalOpen(false);
        setQuotationToDelete(null);
        fetchQuotations();
        fetchStats();
      } else {
        setTableError(res.error || "Failed to delete quotation.");
      }
    } catch (err) {
      setTableError("Error deleting quotation.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Document Export Handler (PDF, Excel, Image)
  const handleExport = async (type, quotation) => {
    setActionLoadingId(`${type}-${quotation.id}`);
    setTableError("");
    try {
      let res;
      if (type === "pdf") {
        res = await api.insurance.quotations.exportPdf(quotation.id, quotation.quotation_number);
      } else if (type === "excel") {
        res = await api.insurance.quotations.exportExcel(quotation.id, quotation.quotation_number);
      } else if (type === "image") {
        res = await api.insurance.quotations.exportImage(quotation.id, quotation.quotation_number);
      }
      if (res && !res.ok) {
        setTableError(res.error || `Failed to export ${type.toUpperCase()}`);
      } else if (res && res.ok) {
        setActionSuccess(`Downloaded ${type.toUpperCase()} proposal export for ${quotation.quotation_number}.`);
      }
    } catch (err) {
      setTableError(`Export failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const openPreview = (quotationId) => {
    setPreviewQuotationId(quotationId);
    setPreviewModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Standard Statutory Disclaimer Notice Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500 p-3.5 rounded-r-2xl text-xs font-semibold text-amber-950 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="leading-snug">{STANDARD_DISCLAIMER}</span>
        </div>
        <span className="hidden sm:inline-flex text-[10px] uppercase font-black tracking-wider text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-md border border-amber-300/80 shrink-0">
          Statutory Banner
        </span>
      </div>

      {/* 2. Executive Page Header */}
      <div className="bg-gradient-to-r from-white via-indigo-50/20 to-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Umbrella className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100/70 px-2.5 py-0.5 rounded-md border border-indigo-200/50">
                  Health Proposal Engine
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 hidden sm:inline-block" />
                <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
                  Multi-Carrier Exact Age Matrix &amp; Vector Exports
                </span>
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  {dbStats.total} Total Proposals
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1.5">
                Health Quotation Generator
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
                Enterprise comparison proposal manager, exact calendar age calculation engine &amp; client-facing document exporter.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            <button
              onClick={handleRefreshAll}
              disabled={loading || statsLoading}
              className="p-2.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
              title="Refresh Quotations &amp; KPI Metrics"
            >
              <RefreshCw className={`w-4 h-4 ${loading || statsLoading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
            <Link
              to="/insurance/health-quotations/create"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-indigo-500/25 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Quotation</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Action Notifications */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess("")}
            className="text-emerald-700 hover:text-emerald-900 font-bold p-1"
          >
            &times;
          </button>
        </div>
      )}

      {tableError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{tableError}</span>
          </div>
          <button
            onClick={() => setTableError("")}
            className="text-rose-700 hover:text-rose-900 font-bold p-1"
          >
            &times;
          </button>
        </div>
      )}

      {/* 3. Executive KPI Cards (Real Database Values) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Quotations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Quotations
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <Umbrella className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {statsLoading ? (
                <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                dbStats.total
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Database records stored</p>
          </div>
        </div>

        {/* Issued Quotations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
              Issued Proposals
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-700">
              {statsLoading ? (
                <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                dbStats.issued
              )}
            </div>
            <p className="text-[11px] text-emerald-600/70 mt-0.5">Client-ready issued quotes</p>
          </div>
        </div>

        {/* Draft Quotations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              Draft Quotations
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-700">
              {statsLoading ? (
                <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                dbStats.draft
              )}
            </div>
            <p className="text-[11px] text-amber-600/70 mt-0.5">In-progress calculation</p>
          </div>
        </div>

        {/* Members Evaluated */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-violet-600 uppercase tracking-wider">
              Members Evaluated
            </span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 border border-violet-100 text-violet-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-violet-700">
              {statsLoading ? (
                <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                dbStats.members_evaluated
              )}
            </div>
            <p className="text-[11px] text-violet-600/70 mt-0.5">With exact calendar age math</p>
          </div>
        </div>
      </div>

      {/* 4. Search and Filters Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row gap-3.5 items-center justify-between">
        {/* Search Input with Debounce */}
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by quote #, client, PIN, or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ISSUED">Issued</option>
              <option value="EXPIRED">Expired</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Show:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl font-semibold transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. Desktop Listing Table (Visible on md and larger) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-40">Quotation #</th>
                <th className="py-3.5 px-4 min-w-[200px]">Title &amp; Client</th>
                <th className="py-3.5 px-4 w-28">PIN Code</th>
                <th className="py-3.5 px-4 w-28">Members</th>
                <th className="py-3.5 px-4 w-32">Date</th>
                <th className="py-3.5 px-4 w-36">Advisor</th>
                <th className="py-3.5 px-4 w-24">Status</th>
                <th className="py-3.5 px-4 w-52 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    <span className="font-medium text-xs">Loading health proposals from database...</span>
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                      <Umbrella className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-slate-800 text-sm">No health quotations found</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      {hasActiveFilters
                        ? "No proposals match your current filters. Clear search or filters to see all records."
                        : "Create your first health insurance proposal comparison."}
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      {hasActiveFilters && (
                        <button
                          onClick={handleClearFilters}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                        >
                          Clear Filters
                        </button>
                      )}
                      <Link
                        to="/insurance/health-quotations/create"
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Quotation</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                quotations.map((q) => {
                  const isActionLoading = actionLoadingId === `dup-${q.id}` || actionLoadingId === `del-${q.id}`;
                  const isExportPdfLoading = actionLoadingId === `pdf-${q.id}`;
                  const isExportXlsLoading = actionLoadingId === `excel-${q.id}`;
                  const isExportImgLoading = actionLoadingId === `image-${q.id}`;

                  return (
                    <tr key={q.id} className="hover:bg-indigo-50/20 transition-colors">
                      {/* Quotation Number */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openPreview(q.id)}
                          className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 text-left"
                          title="Preview quotation details"
                        >
                          <span>{q.quotation_number}</span>
                        </button>
                        <span className="inline-block text-[10px] uppercase font-semibold text-slate-400 mt-0.5">
                          {q.premium_basis === "GROSS" ? "Gross (Incl. Tax)" : "Net (Excl. Tax)"}
                        </span>
                      </td>

                      {/* Title & Client */}
                      <td className="py-3 px-4">
                        <div
                          className="font-bold text-slate-900 truncate max-w-xs"
                          title={q.quotation_title || q.title}
                        >
                          {q.quotation_title || q.title}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-slate-700">{q.client_name}</span>
                          {q.contact_number && (
                            <span className="text-slate-400 text-[10px]">({q.contact_number})</span>
                          )}
                        </div>
                      </td>

                      {/* PIN Code */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 font-mono font-bold text-slate-800">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{q.pin_code}</span>
                        </div>
                      </td>

                      {/* Members Count */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          <Users className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>
                            {q.members_count !== undefined ? q.members_count : q.member_count || 0}{" "}
                            {(q.members_count !== undefined ? q.members_count : q.member_count || 0) === 1
                              ? "Member"
                              : "Members"}
                          </span>
                        </span>
                      </td>

                      {/* Quotation Date */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium">{formatDateDMY(q.quotation_date)}</span>
                        </div>
                      </td>

                      {/* Advisor */}
                      <td className="py-3 px-4">
                        <span className="text-slate-700 font-medium truncate block max-w-[130px]" title={q.advisor_name}>
                          {q.advisor_name || "Enterprise Advisor"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black tracking-wide uppercase border ${
                            q.status === "ISSUED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : q.status === "DRAFT"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : q.status === "EXPIRED"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {q.status}
                        </span>
                      </td>

                      {/* Actions Toolbar */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Preview */}
                          <button
                            onClick={() => openPreview(q.id)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Preview Quotation Proposal"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <Link
                            to={`/insurance/health-quotations/${q.id}/edit`}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Quotation"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Link>

                          {/* Duplicate */}
                          <button
                            onClick={() => handleDuplicate(q)}
                            disabled={isActionLoading}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-40"
                            title="Duplicate as Fresh Draft"
                          >
                            {actionLoadingId === `dup-${q.id}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* PDF Export */}
                          <button
                            onClick={() => handleExport("pdf", q)}
                            disabled={isExportPdfLoading}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40"
                            title="Download Vector PDF"
                          >
                            {isExportPdfLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-rose-600/80 hover:text-rose-600" />
                            )}
                          </button>

                          {/* Excel Export */}
                          <button
                            onClick={() => handleExport("excel", q)}
                            disabled={isExportXlsLoading}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40"
                            title="Download Formatted Excel (.xlsx)"
                          >
                            {isExportXlsLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                            ) : (
                              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600/80 hover:text-emerald-600" />
                            )}
                          </button>

                          {/* Image Export */}
                          <button
                            onClick={() => handleExport("image", q)}
                            disabled={isExportImgLoading}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40"
                            title="Download High-Res PNG Image"
                          >
                            {isExportImgLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                            ) : (
                              <ImageIcon className="w-3.5 h-3.5 text-blue-600/80 hover:text-blue-600" />
                            )}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => confirmDelete(q)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Quotation"
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

        {/* Desktop Pagination */}
        <div className="px-5 py-3.5 bg-slate-50/75 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-800">{quotations.length}</span> of{" "}
            <span className="font-bold text-slate-800">{total}</span> quotations
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-700 px-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 6. Mobile Card Layout (Visible on screens smaller than md) */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
            <span className="text-xs font-semibold">Loading quotations...</span>
          </div>
        ) : quotations.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
            <Umbrella className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
            <p className="font-bold text-slate-800 text-sm">No quotations found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting search or status filters.</p>
          </div>
        ) : (
          quotations.map((q) => {
            const isActionLoading = actionLoadingId === `dup-${q.id}` || actionLoadingId === `del-${q.id}`;
            const isExportPdfLoading = actionLoadingId === `pdf-${q.id}`;
            const isExportXlsLoading = actionLoadingId === `excel-${q.id}`;
            const isExportImgLoading = actionLoadingId === `image-${q.id}`;

            return (
              <div
                key={q.id}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3"
              >
                {/* Header: Quotation # and Status */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => openPreview(q.id)}
                    className="font-mono font-bold text-sm text-indigo-600 hover:underline"
                  >
                    {q.quotation_number}
                  </button>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      q.status === "ISSUED"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : q.status === "DRAFT"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {q.status}
                  </span>
                </div>

                {/* Proposal Title & Client Name */}
                <div>
                  <h3 className="font-bold text-slate-900 text-xs">
                    {q.quotation_title || q.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Client: <strong className="text-slate-700">{q.client_name}</strong>
                  </p>
                </div>

                {/* Key Metadata Badges */}
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span>PIN: {q.pin_code}</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-600">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      {q.members_count !== undefined ? q.members_count : q.member_count || 0} Members
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-600">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatDateDMY(q.quotation_date)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-600 truncate">
                    <span className="text-[10px] uppercase font-semibold text-slate-400">
                      {q.premium_basis === "GROSS" ? "Gross (Tax incl)" : "Net (Tax excl)"}
                    </span>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openPreview(q.id)}
                      className="p-1.5 text-slate-600 bg-slate-50 rounded-lg hover:bg-indigo-50 hover:text-indigo-600"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <Link
                      to={`/insurance/health-quotations/${q.id}/edit`}
                      className="p-1.5 text-slate-600 bg-slate-50 rounded-lg hover:bg-indigo-50 hover:text-indigo-600"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDuplicate(q)}
                      disabled={isActionLoading}
                      className="p-1.5 text-slate-600 bg-slate-50 rounded-lg hover:bg-indigo-50 hover:text-indigo-600"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleExport("pdf", q)}
                      disabled={isExportPdfLoading}
                      className="p-1.5 text-rose-700 bg-rose-50 rounded-lg"
                      title="Export PDF"
                    >
                      {isExportPdfLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleExport("excel", q)}
                      disabled={isExportXlsLoading}
                      className="p-1.5 text-emerald-700 bg-emerald-50 rounded-lg"
                      title="Export Excel"
                    >
                      {isExportXlsLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleExport("image", q)}
                      disabled={isExportImgLoading}
                      className="p-1.5 text-blue-700 bg-blue-50 rounded-lg"
                      title="Export Image"
                    >
                      {isExportImgLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ImageIcon className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => confirmDelete(q)}
                      className="p-1.5 text-rose-500 bg-slate-50 rounded-lg hover:bg-rose-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-200 text-xs">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-semibold text-slate-700">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* 7. Delete Confirmation Modal */}
      {deleteModalOpen && quotationToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3.5">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center">Delete Quotation?</h3>
            <p className="text-xs text-slate-500 text-center mt-2 leading-relaxed">
              Are you sure you want to delete proposal{" "}
              <span className="font-mono font-bold text-slate-800">{quotationToDelete.quotation_number}</span>{" "}
              for <span className="font-semibold text-slate-800">{quotationToDelete.client_name}</span>?
              All associated family member age records and configured premium matrices will be permanently removed.
            </p>

            <div className="flex items-center gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={actionLoadingId === `del-${quotationToDelete.id}`}
                className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5"
              >
                {actionLoadingId === `del-${quotationToDelete.id}` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Delete Record</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Preview Modal */}
      <HealthQuotationPreviewModal
        quotationId={previewQuotationId}
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        onEdit={(id) => navigate(`/insurance/health-quotations/${id}/edit`)}
        onDuplicate={(id) => {
          const q = quotations.find((item) => item.id === id);
          if (q) handleDuplicate(q);
        }}
      />
    </div>
  );
}
