import React, { useState, useEffect, useRef } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import FormInput from "../components/common/FormInput";
import {
  validateIndianMobile,
  validateEmail,
  validateName,
} from "../utils/validation";
import {
  Briefcase,
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
  Download,
  FileSpreadsheet,
  FileText,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";

export default function PurchasePartiesPage() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const canMutate = isAdmin || isSuperAdmin;

  // Table State
  const [parties, setParties] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [exporting, setExporting] = useState(false);

  // Modal State
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | 'view' | 'delete'
  const [selectedParty, setSelectedParty] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formAutoCode, setFormAutoCode] = useState(true);
  const [formContact, setFormContact] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  const searchTimeoutRef = useRef(null);

  const fetchParties = async () => {
    setLoading(true);
    setTableError("");
    const res = await api.insurance.getPurchaseParties({
      search: searchTerm.trim() || undefined,
      status: statusFilter,
      page,
      page_size: pageSize,
      sort_by: sortBy,
      sort_order: sortOrder,
    });

    if (res.ok) {
      setParties(res.data.items || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
    } else {
      setTableError(res.error || "Failed to load purchase party records.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchParties();
  }, [page, pageSize, statusFilter, sortBy, sortOrder]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchParties();
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

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedParty(null);
    setFormName("");
    setFormCode("");
    setFormAutoCode(true);
    setFormContact("");
    setFormEmail("");
    setFormPhone("");
    setFormAddress("");
    setFormNotes("");
    setFormIsActive(true);
    setModalError("");
  };

  const openEditModal = (p) => {
    setModalMode("edit");
    setSelectedParty(p);
    setFormName(p.name);
    setFormCode(p.code);
    setFormAutoCode(false);
    setFormContact(p.contact_person || "");
    setFormEmail(p.email || "");
    setFormPhone(p.phone || "");
    setFormAddress(p.address || "");
    setFormNotes(p.notes || "");
    setFormIsActive(p.is_active);
    setModalError("");
  };

  const openViewModal = (p) => {
    setModalMode("view");
    setSelectedParty(p);
    setModalError("");
  };

  const openDeleteModal = (p) => {
    setModalMode("delete");
    setSelectedParty(p);
    setModalError("");
  };

  const handleSaveParty = async (e) => {
    e.preventDefault();
    const nameCheck = validateName(formName, "Party Name", true);
    if (!nameCheck.isValid) {
      setModalError(nameCheck.error);
      return;
    }
    if (formContact) {
      const contactCheck = validateName(formContact, "Contact Person", false);
      if (!contactCheck.isValid) {
        setModalError(contactCheck.error);
        return;
      }
    }
    if (formPhone) {
      const phoneCheck = validateIndianMobile(formPhone, "Phone Number", false);
      if (!phoneCheck.isValid) {
        setModalError(phoneCheck.error);
        return;
      }
    }
    if (formEmail) {
      const emailCheck = validateEmail(formEmail, "Email Address", false);
      if (!emailCheck.isValid) {
        setModalError(emailCheck.error);
        return;
      }
    }

    setModalLoading(true);
    setModalError("");

    const payload = {
      name: formName.trim(),
      code: formAutoCode ? undefined : formCode.trim().toUpperCase(),
      contact_person: formContact.trim() || null,
      email: formEmail.trim() || null,
      phone: formPhone.trim() || null,
      address: formAddress.trim() || null,
      notes: formNotes.trim() || null,
      is_active: formIsActive,
    };

    let res;
    if (modalMode === "create") {
      res = await api.insurance.createPurchaseParty(payload);
    } else {
      res = await api.insurance.updatePurchaseParty(selectedParty.id, payload);
    }

    setModalLoading(false);
    if (res.ok) {
      setActionSuccess(
        modalMode === "create"
          ? `Purchase Party '${res.data.name}' (${res.data.code}) created successfully.`
          : `Purchase Party '${res.data.name}' updated successfully.`
      );
      setModalMode(null);
      fetchParties();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setModalError(res.error || "Operation failed.");
    }
  };

  const handleToggleStatus = async (p) => {
    const nextStatus = !p.is_active;
    const confirmMsg = `Change purchase party '${p.name}' to ${nextStatus ? "Active" : "Inactive"}?`;
    if (!window.confirm(confirmMsg)) return;

    const res = await api.insurance.togglePurchasePartyStatus(p.id, nextStatus);
    if (res.ok) {
      setActionSuccess(`Party '${p.name}' is now ${nextStatus ? "Active" : "Inactive"}.`);
      fetchParties();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setTableError(res.error || "Failed to update status.");
    }
  };

  const handleDeleteParty = async () => {
    if (!selectedParty) return;
    setModalLoading(true);
    setModalError("");

    const res = await api.insurance.deletePurchaseParty(selectedParty.id);
    setModalLoading(false);

    if (res.ok) {
      setActionSuccess(`Purchase Party '${selectedParty.name}' was permanently removed.`);
      setModalMode(null);
      fetchParties();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setModalError(res.error || "Failed to delete purchase party.");
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    setActionSuccess("");
    const res = await api.insurance.downloadPurchasePartiesExport(format, {
      search: searchTerm.trim() || undefined,
      status: statusFilter,
    });
    setExporting(false);
    if (res.ok) {
      setActionSuccess(`Filtered purchase parties exported as ${format.toUpperCase()} successfully.`);
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setTableError(res.error || "Export failed.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Executive Header Banner */}
      <div className="bg-gradient-to-r from-white via-emerald-50/25 to-white p-6 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                  Master Data Management
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span className="text-xs text-slate-500 font-medium">Policy Sourcing Entities</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                Purchase Party Management
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Entities and agencies from whom the agent or IMF sources insurance policies.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Export Buttons */}
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting || parties.length === 0}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-40"
              title="Export filtered records to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => handleExport("excel")}
              disabled={exporting || parties.length === 0}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-40"
              title="Export filtered records to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={() => handleExport("pdf")}
              disabled={exporting || parties.length === 0}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-40"
              title="Export filtered records to PDF"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>Export PDF</span>
            </button>

            <button
              onClick={openCreateModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-emerald-500/25 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Purchase Party</span>
            </button>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {tableError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{tableError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              id="party-search-input"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by party name or code..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900"
            />
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-4">
            <select
              id="party-status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Rows per page selector and active tags */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Show:</span>
            {[10, 25, 50].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setPageSize(size);
                  setPage(1);
                }}
                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  pageSize === size
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {size}
              </button>
            ))}
            <span>entries per page</span>
          </div>

          <div className="font-medium text-slate-400">
            Showing {parties.length} of {total} purchase parties
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-black text-[11px] uppercase tracking-wider">
                <th
                  onClick={() => handleSort("name")}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Party Name</span>
                    {sortBy === "name" && (
                      <span className="text-emerald-600">{sortOrder === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("code")}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 select-none font-mono"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Party Code</span>
                    {sortBy === "code" && (
                      <span className="text-emerald-600">{sortOrder === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Contact Person</th>
                <th className="py-3 px-4">Mobile & Email</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    <span>Loading purchase party records...</span>
                  </td>
                </tr>
              ) : parties.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600 text-xs">No purchase parties found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Add a sourcing partner or adjust your search filter.
                    </p>
                  </td>
                </tr>
              ) : (
                parties.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div>{p.name}</div>
                      {p.notes && (
                        <div className="text-[11px] font-normal text-slate-400 truncate max-w-sm">
                          {p.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-700">
                      {p.code}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      {p.contact_person || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-500">
                      {p.phone && <div>{p.phone}</div>}
                      {p.email && <div className="text-slate-400 truncate max-w-xs">{p.email}</div>}
                      {!p.phone && !p.email && <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(p)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                          p.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                        title="Click to toggle status"
                      >
                        {p.is_active ? (
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
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                          title="Edit Party"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {canMutate && (
                          <button
                            type="button"
                            onClick={() => openDeleteModal(p)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete Party"
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
            Page {page} of {totalPages}
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {modalMode === "create" ? "Add Sourcing Purchase Party" : `Edit Party: ${selectedParty?.name}`}
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

            <form onSubmit={handleSaveParty} className="space-y-3.5 text-xs">
              {/* Name */}
              <div>
                <label htmlFor="party-form-name" className="font-semibold text-slate-700 block mb-1">
                  Purchase Party Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  id="party-form-name"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Apex Broking Syndicate, IMF Agency"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              {/* Code */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="party-form-code" className="font-semibold text-slate-700">
                    Unique Party Code <span className="text-rose-500">*</span>
                  </label>
                  {modalMode === "create" && (
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formAutoCode}
                        onChange={(e) => setFormAutoCode(e.target.checked)}
                        className="rounded text-emerald-600 border-slate-300"
                      />
                      <span>Generate Automatically (PP-XXXX)</span>
                    </label>
                  )}
                </div>
                <input
                  type="text"
                  id="party-form-code"
                  disabled={modalMode === "create" && formAutoCode}
                  value={modalMode === "create" && formAutoCode ? "Auto-generated on creation" : formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="e.g. PP-APEX-01"
                  className={`w-full px-3 py-2 rounded-lg border text-slate-900 font-mono ${
                    modalMode === "create" && formAutoCode
                      ? "bg-slate-100 text-slate-500 border-slate-200"
                      : "border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  }`}
                />
              </div>

              {/* Contact Person & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="party-form-contact" className="font-semibold text-slate-700 block mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    id="party-form-contact"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="Key executive..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                </div>
                <FormInput
                  type="mobile"
                  label="Mobile / Phone"
                  id="party-form-phone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="10-digit mobile"
                />
              </div>

              {/* Email */}
              <FormInput
                type="email"
                label="Official Email"
                id="party-form-email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="agency@domain.com"
              />

              {/* Address */}
              <div>
                <label htmlFor="party-form-address" className="font-semibold text-slate-700 block mb-1">
                  Office Address
                </label>
                <textarea
                  id="party-form-address"
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Branch location..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="party-form-notes" className="font-semibold text-slate-700 block mb-1">
                  Operational Notes & Channel Details
                </label>
                <textarea
                  id="party-form-notes"
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Commission terms, branch code..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                />
              </div>

              {/* Active Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-800">Party is active for policy sourcing</span>
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
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2"
                >
                  {modalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{modalMode === "create" ? "Save Party" : "Update Party"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {modalMode === "view" && selectedParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {selectedParty.code}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{selectedParty.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Status:</span>
                <span className={`font-semibold ${selectedParty.is_active ? "text-emerald-600" : "text-slate-400"}`}>
                  {selectedParty.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              {selectedParty.contact_person && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Contact Person:</span>
                  <span className="font-medium text-slate-800">{selectedParty.contact_person}</span>
                </div>
              )}
              {selectedParty.email && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-medium text-slate-800">{selectedParty.email}</span>
                </div>
              )}
              {selectedParty.phone && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Phone:</span>
                  <span className="font-medium text-slate-800">{selectedParty.phone}</span>
                </div>
              )}
              {selectedParty.address && (
                <div className="py-1 border-b border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Address:</span>
                  <span className="text-slate-700 leading-relaxed">{selectedParty.address}</span>
                </div>
              )}
              {selectedParty.notes && (
                <div className="py-1">
                  <span className="text-slate-400 block mb-0.5">Notes:</span>
                  <span className="text-slate-700 leading-relaxed italic">{selectedParty.notes}</span>
                </div>
              )}
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

      {/* DELETE MODAL */}
      {modalMode === "delete" && selectedParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Delete Purchase Party?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to permanently delete <span className="font-bold text-slate-900">{selectedParty.name}</span> ({selectedParty.code})?
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
                onClick={handleDeleteParty}
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
    </div>
  );
}
