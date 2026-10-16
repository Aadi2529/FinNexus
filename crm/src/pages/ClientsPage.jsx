import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Mail,
  Phone,
  Briefcase,
  X,
  Edit2,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileSpreadsheet,
  Archive,
  RotateCcw,
  History,
} from "lucide-react";
import { crmAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function ClientsPage() {
  const { isAdmin } = useAuth();

  // Data states
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successBanner, setSuccessBanner] = useState("");

  // Summary Cards Data
  const [summaryCards, setSummaryCards] = useState({
    total_clients: 0,
    clients_with_active_tasks: 0,
    new_clients_30d: 0,
    archived_clients: 0,
  });

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showArchived, setShowArchived] = useState(false);

  // Server-side Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientHistory, setClientHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    country_code: "+91",
    mobile_number: "",
    email: "",
    pan_number: "",
    reference_source: "Direct",
    pipeline_status: "NEW_LEAD",
    employment_type: "SALARIED",
    monthly_income: "80000.00",
    monthly_obligations: "20000.00",
    cibil_score: 750,
  });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [modalApiError, setModalApiError] = useState("");

  // Deletion state
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Dismiss success banner after 5 seconds
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  // Fetch executive directory summary metrics from real database
  const fetchSummaryCards = useCallback(async () => {
    try {
      const summary = await crmAPI.getClientSummary();
      if (summary) {
        setSummaryCards(summary);
      }
    } catch {
      // Graceful degradation
    }
  }, []);

  useEffect(() => {
    fetchSummaryCards();
  }, [fetchSummaryCards]);

  // Fetch clients from real backend PostgreSQL endpoint
  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        paginate: true,
        page,
        page_size: pageSize,
        is_archived: showArchived,
      };
      if (searchQuery.trim()) {
        params.q = searchQuery.trim();
      }
      if (statusFilter !== "ALL") {
        params.pipeline_status = statusFilter;
      }

      const res = await crmAPI.getClients(params);
      if (res && res.items) {
        setClients(res.items);
        setTotalItems(res.pagination.total_items);
        setTotalPages(res.pagination.total_pages);
      } else if (Array.isArray(res)) {
        setClients(res);
        setTotalItems(res.length);
        setTotalPages(1);
      } else {
        setClients([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (err) {
      setError(err?.message || "Failed to load clients from database. Please verify connection.");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, statusFilter, showArchived]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Client validation logic (strictly 10 digits for Indian mobile numbers)
  const validateForm = () => {
    const errors = {};
    if (!formData.first_name.trim()) {
      errors.first_name = "Client first name is required.";
    }
    if (!formData.mobile_number.trim()) {
      errors.mobile_number = "Mobile number is required.";
    } else {
      if (/[a-zA-Z]/.test(formData.mobile_number)) {
        errors.mobile_number = "Mobile number must not contain alphabetic characters.";
      } else {
        const cleanDigits = formData.mobile_number.replace(/\D/g, "");
        if (formData.country_code === "+91" && cleanDigits.length !== 10) {
          errors.mobile_number = "Indian mobile number must be exactly 10 digits.";
        } else if (cleanDigits.length < 10) {
          errors.mobile_number = "Mobile number must contain at least 10 digits.";
        }
      }
    }
    if (!formData.email.trim()) {
      errors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
    if (!formData.pan_number.trim()) {
      errors.pan_number = "PAN number is required.";
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(formData.pan_number.trim())) {
      errors.pan_number = "PAN must follow standard 10-character alphanumeric format (e.g. ABCDE1234F).";
    }
    if (formData.cibil_score && (formData.cibil_score < 300 || formData.cibil_score > 900)) {
      errors.cibil_score = "CIBIL Bureau score must be between 300 and 900.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open Create Modal
  const openCreateModal = () => {
    setModalApiError("");
    setFormErrors({});
    setFormData({
      first_name: "",
      last_name: "",
      country_code: "+91",
      mobile_number: "",
      email: "",
      pan_number: "",
      reference_source: "Direct",
      pipeline_status: "NEW_LEAD",
      employment_type: "SALARIED",
      monthly_income: "80000.00",
      monthly_obligations: "20000.00",
      cibil_score: 750,
    });
    setCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (client) => {
    setModalApiError("");
    setFormErrors({});
    setSelectedClient(client);

    // Extract country code & mobile if combined
    let code = "+91";
    let rawMobile = client.phone || "";
    if (rawMobile.startsWith("+91")) {
      code = "+91";
      rawMobile = rawMobile.slice(3).trim();
    } else if (rawMobile.startsWith("+")) {
      const match = rawMobile.match(/^(\+\d{1,3})\s*(.*)$/);
      if (match) {
        code = match[1];
        rawMobile = match[2];
      }
    }

    const fp = client.financial_profile;
    setFormData({
      first_name: client.first_name || "",
      last_name: client.last_name || "",
      country_code: code,
      mobile_number: rawMobile,
      email: client.email || "",
      pan_number: client.pan_number || "",
      reference_source: client.reference_source || "Direct",
      pipeline_status: client.pipeline_status || "NEW_LEAD",
      employment_type: fp?.employment_type || "SALARIED",
      monthly_income: fp?.monthly_income ? String(fp.monthly_income) : "80000.00",
      monthly_obligations: fp?.monthly_obligations ? String(fp.monthly_obligations) : "20000.00",
      cibil_score: fp?.cibil_score || 750,
    });
    setEditModalOpen(true);
  };

  // Open Delete Modal
  const openDeleteModal = (client) => {
    setSelectedClient(client);
    setDeleteError("");
    setDeleteModalOpen(true);
  };

  // Open History Modal
  const openHistoryModal = async (client) => {
    setSelectedClient(client);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const hist = await crmAPI.getClientHistory(client.id);
      setClientHistory(Array.isArray(hist) ? hist : []);
    } catch {
      setClientHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Archive Client (Soft-Delete)
  const handleArchiveClient = async (client) => {
    try {
      await crmAPI.archiveClient(client.id);
      setSuccessBanner(`Client '${client.first_name} ${client.last_name}' archived.`);
      fetchClients();
      fetchSummaryCards();
    } catch (err) {
      setError(err?.message || "Failed to archive client.");
    }
  };

  // Restore Client
  const handleRestoreClient = async (client) => {
    try {
      await crmAPI.restoreClient(client.id);
      setSuccessBanner(`Client '${client.first_name} ${client.last_name}' restored to active directory.`);
      fetchClients();
      fetchSummaryCards();
    } catch (err) {
      setError(err?.message || "Failed to restore client.");
    }
  };

  // Submit Add Client
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setModalApiError("");
    if (!validateForm()) return;

    setSaving(true);
    try {
      const fullPhone = `${formData.country_code} ${formData.mobile_number.trim()}`;
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: fullPhone,
        pan_number: formData.pan_number.trim().toUpperCase(),
        reference_source: formData.reference_source || "Direct",
        pipeline_status: formData.pipeline_status,
        employment_type: formData.employment_type,
        monthly_income: parseFloat(formData.monthly_income) || 0,
        monthly_obligations: parseFloat(formData.monthly_obligations) || 0,
        cibil_score: parseInt(formData.cibil_score, 10) || null,
      };

      const created = await crmAPI.createClient(payload);
      setCreateModalOpen(false);
      setSuccessBanner(`Client '${created.first_name} ${created.last_name}' registered successfully.`);
      fetchClients();
      fetchSummaryCards();
    } catch (err) {
      setModalApiError(err?.message || "Failed to create client. Please verify inputs.");
    } finally {
      setSaving(false);
    }
  };

  // Submit Edit Client
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;
    setModalApiError("");
    if (!validateForm()) return;

    setSaving(true);
    try {
      const fullPhone = `${formData.country_code} ${formData.mobile_number.trim()}`;
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: fullPhone,
        pan_number: formData.pan_number.trim().toUpperCase(),
        reference_source: formData.reference_source || "Direct",
        pipeline_status: formData.pipeline_status,
        employment_type: formData.employment_type,
        monthly_income: parseFloat(formData.monthly_income) || 0,
        monthly_obligations: parseFloat(formData.monthly_obligations) || 0,
        cibil_score: parseInt(formData.cibil_score, 10) || null,
      };

      const updated = await crmAPI.updateClient(selectedClient.id, payload);
      setEditModalOpen(false);
      setSuccessBanner(`Client profile for '${updated.first_name} ${updated.last_name}' updated successfully.`);
      fetchClients();
      fetchSummaryCards();
    } catch (err) {
      setModalApiError(err?.message || "Failed to update client profile.");
    } finally {
      setSaving(false);
    }
  };

  // Confirm Delete Client
  const handleConfirmDelete = async () => {
    if (!selectedClient) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await crmAPI.deleteClient(selectedClient.id);
      setDeleteModalOpen(false);
      setSuccessBanner(`Client '${selectedClient.first_name} ${selectedClient.last_name}' was safely deleted.`);
      setSelectedClient(null);
      fetchClients();
      fetchSummaryCards();
    } catch (err) {
      setDeleteError(err?.message || "Deletion failed. Client may have dependent work orders or open tasks.");
    } finally {
      setDeleting(false);
    }
  };

  // Export Filtered Clients to CSV
  const handleExportCSV = () => {
    if (clients.length === 0) return;

    const headers = [
      "Client ID",
      "Full Name",
      "Email Address",
      "Mobile Phone",
      "PAN Number",
      "Pipeline Status",
      "CIBIL Score",
      "Monthly Inflow (INR)",
      "Monthly Debt (INR)",
      "Active Work Orders",
      "Total Work Orders",
      "Registered Date",
    ];

    const rows = clients.map((c) => {
      const fp = c.financial_profile;
      return [
        c.id,
        `"${c.first_name} ${c.last_name}"`,
        `"${c.email}"`,
        `"${c.phone}"`,
        c.pan_number,
        c.pipeline_status,
        fp?.cibil_score || "N/A",
        fp?.monthly_income || "0",
        fp?.monthly_obligations || "0",
        c.active_work_orders_count || 0,
        c.total_work_orders_count || 0,
        c.created_at ? new Date(c.created_at).toISOString().split("T")[0] : "",
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `FinNexus_Clients_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Client Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified borrower accounts, bureau ratings, and attached active work orders.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportCSV}
            disabled={clients.length === 0}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Export filtered records to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={openCreateModal}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Client Profile</span>
          </button>
        </div>
      </div>

      {/* Dynamic Summary Cards from Database */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Clients</span>
            <span className="text-xl font-bold text-slate-900 font-mono">{summaryCards.total_clients}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Active Tasks</span>
            <span className="text-xl font-bold text-slate-900 font-mono">{summaryCards.clients_with_active_tasks}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">New (30 Days)</span>
            <span className="text-xl font-bold text-slate-900 font-mono">{summaryCards.new_clients_30d}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Archived</span>
            <span className="text-xl font-bold text-slate-900 font-mono">{summaryCards.archived_clients}</span>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2.5 text-xs text-emerald-800 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner("")} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Global Error Alert */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2.5 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchClients}
            className="px-2.5 py-1 text-xs font-semibold bg-rose-100 hover:bg-rose-200 rounded-lg text-rose-800 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by client name, mobile, email, PAN, reference..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <button
            onClick={() => {
              setShowArchived(!showArchived);
              setPage(1);
            }}
            className={`px-3 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-colors ${
              showArchived
                ? "bg-amber-100 border-amber-300 text-amber-900 font-bold"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
            title="Toggle between active and archived clients"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{showArchived ? "Viewing Archived" : "Active Only"}</span>
          </button>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium"
          >
            <option value="ALL">All Pipeline States</option>
            <option value="NEW_LEAD">New Lead</option>
            <option value="CONTACTED">Contacted</option>
            <option value="DOCUMENTATION">Documentation</option>
            <option value="UNDERWRITING">Underwriting</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            title="Rows per page"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
          </select>

          <button
            onClick={fetchClients}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-20 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2.5" />
            <span>Fetching verified client records from database...</span>
          </div>
        ) : clients.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200/90 p-8">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-700">No Clients Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "ALL"
                ? "No clients match the active filter criteria. Try adjusting your query or status."
                : showArchived
                ? "No archived client records found in the archive repository."
                : "No customer records currently exist in PostgreSQL. Click 'Add Client Profile' to register the first client."}
            </p>
            {!showArchived && (
              <button
                onClick={openCreateModal}
                className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-2xs"
              >
                Add New Client
              </button>
            )}
          </div>
        ) : (
          clients.map((client) => {
            const fp = client.financial_profile;
            const riskTier = fp?.risk_tier || "MEDIUM";
            const activeWoCount = client.active_work_orders_count || 0;

            return (
              <div
                key={client.id}
                className={`bg-white rounded-2xl border shadow-xs p-5 flex flex-col justify-between hover:border-slate-300 transition-all duration-200 ${
                  client.is_archived ? "border-amber-200 bg-amber-50/20" : "border-slate-200/90"
                }`}
              >
                <div>
                  {/* Card Header: Client Name, PAN, Risk Tier */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 leading-snug">
                        {client.first_name} {client.last_name}
                      </h2>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="font-mono text-[11px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200 inline-block">
                          PAN: {client.pan_number}
                        </span>
                        {client.reference_source && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                            {client.reference_source}
                          </span>
                        )}
                        {client.is_archived && (
                          <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                            Archived
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider border ${
                          riskTier === "LOW"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : riskTier === "HIGH"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {riskTier} Risk
                      </span>

                      {/* Active Work Order Count Pill */}
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          activeWoCount > 0
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-50 text-slate-500 border border-slate-200"
                        }`}
                      >
                        <Briefcase className="w-2.5 h-2.5" />
                        <span>{activeWoCount} Active {activeWoCount === 1 ? "Order" : "Orders"}</span>
                      </span>
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono text-[11px]">{client.phone}</span>
                    </div>
                  </div>

                  {/* Bureau & Financial Profile Box */}
                  {fp && (
                    <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Bureau CIBIL</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">{fp.cibil_score || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Monthly Inflow</span>
                        <span className="font-mono font-semibold text-slate-900 text-xs">
                          ₹{Number(fp.monthly_income).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions: Pipeline Status, Edit, History, Archive/Restore, Delete, Create Order */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(client)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Edit Client Profile"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => openHistoryModal(client)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                      title="View Audit History"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>

                    {client.is_archived ? (
                      <button
                        onClick={() => handleRestoreClient(client)}
                        className="p-1.5 rounded-lg text-amber-600 hover:text-amber-800 hover:bg-amber-50 transition-colors"
                        title="Restore Client to Active"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleArchiveClient(client)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                        title="Archive Client (Soft-Delete)"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => openDeleteModal(client)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete Client Record (Admin Only)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <span className="text-[11px] text-slate-400 font-medium ml-1">
                      <span className="text-slate-700 font-bold font-mono text-[10px]">{client.pipeline_status}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Link
                      to={`/work-orders?search=${encodeURIComponent(client.first_name)}`}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                      title="View all work orders for this client"
                    >
                      Orders
                    </Link>

                    {!client.is_archived && (
                      <Link
                        to={`/work-orders/new?client_id=${client.id}`}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3 stroke-[2.5]" />
                        <span>New Order</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Server Pagination Controls */}
      {totalItems > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 px-4 py-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing <span className="font-bold text-slate-900">{(page - 1) * pageSize + 1}</span> to{" "}
            <span className="font-bold text-slate-900">{Math.min(page * pageSize, totalItems)}</span> of{" "}
            <span className="font-bold text-slate-900">{totalItems}</span> verified client records
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-semibold text-slate-700 px-2">
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Register New Borrower Profile</h3>
                <p className="text-[11px] text-slate-500">Persists client KYC data directly into PostgreSQL.</p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {modalApiError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{modalApiError}</span>
                </div>
              )}

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${
                      formErrors.first_name ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                    } focus:outline-none focus:ring-2 focus:ring-teal-500/20`}
                  />
                  {formErrors.first_name && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.first_name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sharma"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              {/* Mobile Phone with Country Code */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone *</label>
                <div className="flex gap-2">
                  <select
                    value={formData.country_code}
                    onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                    className="w-24 px-2 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium text-slate-700"
                  >
                    <option value="+91">+91 (IN)</option>
                    <option value="+1">+1 (US)</option>
                    <option value="+44">+44 (UK)</option>
                    <option value="+971">+971 (AE)</option>
                    <option value="+65">+65 (SG)</option>
                  </select>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={formData.mobile_number}
                    onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                    className={`flex-1 px-3 py-2 text-xs rounded-xl border ${
                      formErrors.mobile_number ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                    } focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono`}
                  />
                </div>
                {formErrors.mobile_number && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.mobile_number}</p>}
              </div>

              {/* Email & PAN Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="priya@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${
                      formErrors.email ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                    } focus:outline-none focus:ring-2 focus:ring-teal-500/20`}
                  />
                  {formErrors.email && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.email}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PAN Number *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="ABCDE1234F"
                    value={formData.pan_number}
                    onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${
                      formErrors.pan_number ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                    } focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono`}
                  />
                  {formErrors.pan_number && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.pan_number}</p>}
                </div>
              </div>

              {/* Pipeline Status & Employment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pipeline Status</label>
                  <select
                    value={formData.pipeline_status}
                    onChange={(e) => setFormData({ ...formData, pipeline_status: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="NEW_LEAD">New Lead</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="DOCUMENTATION">Documentation</option>
                    <option value="UNDERWRITING">Underwriting</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Type</label>
                  <select
                    value={formData.employment_type}
                    onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="SALARIED">Salaried Employee</option>
                    <option value="SELF_EMPLOYED">Self-Employed Professional</option>
                    <option value="BUSINESS">Business Owner</option>
                  </select>
                </div>
              </div>

              {/* Income, Obligations & CIBIL */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Inflow (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.monthly_income}
                    onChange={(e) => setFormData({ ...formData, monthly_income: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Obligations (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.monthly_obligations}
                    onChange={(e) => setFormData({ ...formData, monthly_obligations: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">CIBIL Score</label>
                  <input
                    type="number"
                    min="300"
                    max="900"
                    value={formData.cibil_score}
                    onChange={(e) => setFormData({ ...formData, cibil_score: Number(e.target.value) })}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${
                      formErrors.cibil_score ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                    } font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20`}
                  />
                  {formErrors.cibil_score && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.cibil_score}</p>}
                </div>
              </div>

              {/* Reference Source */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / Lead Source</label>
                <input
                  type="text"
                  placeholder="e.g. Direct, Branch Walk-in, Agent Referral, Partner"
                  value={formData.reference_source}
                  onChange={(e) => setFormData({ ...formData, reference_source: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Persisting to Database...</span>
                    </>
                  ) : (
                    <span>Create Client Profile</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Update Client Profile</h3>
                <p className="text-[11px] text-slate-500">
                  Editing record for {selectedClient?.first_name} {selectedClient?.last_name}
                </p>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {modalApiError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{modalApiError}</span>
                </div>
              )}

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${
                      formErrors.first_name ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                    } focus:outline-none focus:ring-2 focus:ring-teal-500/20`}
                  />
                  {formErrors.first_name && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.first_name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              {/* Mobile Phone with Country Code */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone *</label>
                <div className="flex gap-2">
                  <select
                    value={formData.country_code}
                    onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                    className="w-24 px-2 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium text-slate-700"
                  >
                    <option value="+91">+91 (IN)</option>
                    <option value="+1">+1 (US)</option>
                    <option value="+44">+44 (UK)</option>
                    <option value="+971">+971 (AE)</option>
                    <option value="+65">+65 (SG)</option>
                  </select>
                  <input
                    type="tel"
                    required
                    value={formData.mobile_number}
                    onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                    className={`flex-1 px-3 py-2 text-xs rounded-xl border ${
                      formErrors.mobile_number ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                    } focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono`}
                  />
                </div>
                {formErrors.mobile_number && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.mobile_number}</p>}
              </div>

              {/* Email & PAN Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${
                      formErrors.email ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                    } focus:outline-none focus:ring-2 focus:ring-teal-500/20`}
                  />
                  {formErrors.email && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.email}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PAN Number *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={formData.pan_number}
                    onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${
                      formErrors.pan_number ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                    } focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono`}
                  />
                  {formErrors.pan_number && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.pan_number}</p>}
                </div>
              </div>

              {/* Pipeline Status & Employment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pipeline Status</label>
                  <select
                    value={formData.pipeline_status}
                    onChange={(e) => setFormData({ ...formData, pipeline_status: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="NEW_LEAD">New Lead</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="DOCUMENTATION">Documentation</option>
                    <option value="UNDERWRITING">Underwriting</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Type</label>
                  <select
                    value={formData.employment_type}
                    onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="SALARIED">Salaried Employee</option>
                    <option value="SELF_EMPLOYED">Self-Employed Professional</option>
                    <option value="BUSINESS">Business Owner</option>
                  </select>
                </div>
              </div>

              {/* Income, Obligations & CIBIL */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Inflow (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.monthly_income}
                    onChange={(e) => setFormData({ ...formData, monthly_income: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Obligations (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.monthly_obligations}
                    onChange={(e) => setFormData({ ...formData, monthly_obligations: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">CIBIL Score</label>
                  <input
                    type="number"
                    min="300"
                    max="900"
                    value={formData.cibil_score}
                    onChange={(e) => setFormData({ ...formData, cibil_score: Number(e.target.value) })}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${
                      formErrors.cibil_score ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                    } font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20`}
                  />
                  {formErrors.cibil_score && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.cibil_score}</p>}
                </div>
              </div>

              {/* Reference Source */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / Lead Source</label>
                <input
                  type="text"
                  placeholder="e.g. Direct, Branch Walk-in, Agent Referral, Partner"
                  value={formData.reference_source}
                  onChange={(e) => setFormData({ ...formData, reference_source: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      {deleteModalOpen && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-slate-900 text-center">Confirm Client Deletion</h3>
              <p className="text-xs text-slate-500 text-center mt-1">
                Are you sure you want to delete the record for{" "}
                <span className="font-bold text-slate-800">
                  {selectedClient.first_name} {selectedClient.last_name}
                </span>{" "}
                ({selectedClient.pan_number})?
              </p>

              {/* Active Work Order Warning */}
              {(selectedClient.active_work_orders_count || 0) > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                    <span>Active Work Orders Attached ({selectedClient.active_work_orders_count})</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    This client currently has active work orders in the system. The enterprise backend retention policy
                    will block deletion until all work orders are completed or reassigned.
                  </p>
                </div>
              )}

              {deleteError && (
                <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Deletion Blocked by Backend</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{deleteError}</p>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {deleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete Client Profile</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client Audit History Modal */}
      {historyModalOpen && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-teal-600" />
                  <span>Client Audit & Activity History</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  {selectedClient.first_name} {selectedClient.last_name} ({selectedClient.pan_number})
                </p>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {loadingHistory ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-600 mb-2" />
                  <span>Loading audit log records from database...</span>
                </div>
              ) : clientHistory.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <History className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                  <span>No audit events recorded for this client yet.</span>
                </div>
              ) : (
                <div className="relative border-l border-slate-200 ml-3 space-y-4 py-1">
                  {clientHistory.map((item, idx) => (
                    <div key={item.id || idx} className="ml-4 relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-teal-600 ring-4 ring-white" />
                      <div className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                            {item.action || "EVENT"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.timestamp ? new Date(item.timestamp).toLocaleString("en-IN") : ""}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {item.details?.description || item.details?.note || `Actor ID: ${item.user_id || "System"}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
