import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { validateName } from "../utils/validation";
import {
  Users,
  Search,
  Plus,
  Trash2,
  Eye,
  Shield,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  HeartHandshake,
  UserPlus,
  X,
  FileText,
  DollarSign,
  Calendar,
  Building,
} from "lucide-react";

export default function FamilyGroupsPage() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const canMutate = isAdmin || isSuperAdmin;

  // List State
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Customer dropdown list for Head / Member selection
  const [customers, setCustomers] = useState([]);

  // Modals & Drawer State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  // Create Group Form
  const [groupName, setGroupName] = useState("");
  const [headCustomerId, setHeadCustomerId] = useState("");
  const [groupNotes, setGroupNotes] = useState("");

  // Add Member Form
  const [memberCustomerId, setMemberCustomerId] = useState("");
  const [memberRelation, setMemberRelation] = useState("SPOUSE");
  const [memberIsDependent, setMemberIsDependent] = useState(true);
  const [memberNotes, setMemberNotes] = useState("");

  const fetchGroups = async () => {
    setLoading(true);
    setTableError("");
    const res = await api.insurance.getFamilyGroups({
      page,
      page_size: pageSize,
      search: searchTerm.trim() || undefined,
    });
    if (res.ok) {
      setGroups(res.data.items || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
    } else {
      setTableError(res.error || "Failed to load family groups.");
    }
    setLoading(false);
  };

  const loadCustomerOptions = async () => {
    const res = await api.insurance.getCustomers({ page: 1, page_size: 100 });
    if (res.ok) {
      setCustomers(res.data.items || []);
    }
  };

  useEffect(() => {
    fetchGroups();
    loadCustomerOptions();
  }, [page, pageSize, searchTerm]);

  const openGroupDetail = async (group) => {
    setDetailLoading(true);
    const res = await api.insurance.getFamilyGroup(group.id);
    if (res.ok) {
      setSelectedGroup(res.data);
    } else {
      setTableError(res.error || "Failed to fetch family group details.");
    }
    setDetailLoading(false);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    const nameCheck = validateName(groupName, "Family Group Name", true);
    if (!nameCheck.isValid) {
      setModalError(nameCheck.error);
      return;
    }
    if (!headCustomerId) {
      setModalError("Primary Family Head customer is required.");
      return;
    }

    setModalLoading(true);
    setModalError("");
    const res = await api.insurance.createFamilyGroup({
      name: groupName.trim(),
      primary_head_customer_id: headCustomerId,
      notes: groupNotes.trim() || null,
    });
    setModalLoading(false);

    if (res.ok) {
      setActionSuccess(`Family group '${res.data.name}' established successfully.`);
      setCreateModalOpen(false);
      setGroupName("");
      setHeadCustomerId("");
      setGroupNotes("");
      fetchGroups();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setModalError(res.error || "Failed to create family group.");
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberCustomerId) {
      setModalError("Select a customer to add to the family group.");
      return;
    }

    setModalLoading(true);
    setModalError("");
    const res = await api.insurance.addFamilyMember(selectedGroup.id, {
      customer_id: memberCustomerId,
      relation_type: memberRelation,
      is_dependent: memberIsDependent,
      notes: memberNotes.trim() || null,
    });
    setModalLoading(false);

    if (res.ok) {
      setActionSuccess("Family member attached successfully.");
      setAddMemberModalOpen(false);
      setMemberCustomerId("");
      setMemberRelation("SPOUSE");
      setMemberIsDependent(true);
      setMemberNotes("");
      // Refresh selected group
      openGroupDetail(selectedGroup);
      fetchGroups();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setModalError(res.error || "Failed to add family member.");
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this family group?`)) {
      return;
    }
    const res = await api.insurance.removeFamilyMember(selectedGroup.id, memberId);
    if (res.ok) {
      setActionSuccess("Family member removed.");
      openGroupDetail(selectedGroup);
      fetchGroups();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setTableError(res.error || "Failed to remove family member.");
    }
  };

  const handleDeleteGroup = async (groupId, groupTitle) => {
    if (!window.confirm(`Delete family group '${groupTitle}'? All relationships will be dissolved.`)) {
      return;
    }
    const res = await api.insurance.deleteFamilyGroup(groupId);
    if (res.ok) {
      setActionSuccess("Family group deleted.");
      if (selectedGroup?.id === groupId) setSelectedGroup(null);
      fetchGroups();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setTableError(res.error || "Failed to delete family group.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Executive Header Banner */}
      <div className="bg-gradient-to-r from-white via-purple-50/25 to-white p-6 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-md">
                  Customer Onboarding & Retention
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span className="text-xs text-slate-500 font-medium">Household Portfolios</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                Family Group Management
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Organize clients into household units, assign primary heads, and aggregate family insurance policies.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                setModalError("");
                setCreateModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-purple-500/25 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Family Group</span>
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
      <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search family group by household name..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-900"
          />
        </div>
      </div>

      {/* Grid of Family Groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-500">Loading household units...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-8">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No Family Groups Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Combine multiple customers under a single family umbrella to view their consolidated insurance coverage.
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <div
              key={g.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200/80 text-purple-700 flex items-center justify-center font-bold text-sm">
                    {g.name?.slice(0, 2)?.toUpperCase() || "FG"}
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {g.members_count || 1} Member{g.members_count !== 1 ? "s" : ""}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 mt-3">{g.name}</h3>
                <div className="mt-2.5 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span className="text-slate-400">Head:</span>
                    <span className="font-semibold text-slate-800">
                      {g.primary_head_name || "Head of Household"}
                    </span>
                  </div>
                  {g.notes && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 italic pt-1 border-t border-slate-100">
                      "{g.notes}"
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => openGroupDetail(g)}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Household</span>
                </button>
                {canMutate && (
                  <button
                    onClick={() => handleDeleteGroup(g.id, g.name)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                    title="Dissolve Group"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold">{groups.length}</span> of{" "}
            <span className="font-semibold">{total}</span> groups
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

      {/* Create Group Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold text-slate-900">Create New Family Group</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{typeof modalError === "string" ? modalError : (modalError?.error || modalError?.message || JSON.stringify(modalError))}</span>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Family Group Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Sharma Family Household"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Family Head <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={headCustomerId}
                  onChange={(e) => setHeadCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-white"
                >
                  <option value="">Select Primary Head of Family...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name || ""} ({c.phone || c.email || "No contact"})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  The primary head will automatically be designated as HEAD_OF_FAMILY.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes / Household Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g., Joint policy portfolio, VIP client"
                  value={groupNotes}
                  onChange={(e) => setGroupNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {modalLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Family Group</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Family Detail & Consolidated Portfolio Drawer */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-3xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{selectedGroup.name}</h2>
                  <p className="text-xs text-slate-500">
                    Household Portfolio & Consolidated Policy Cover
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedGroup(null)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Portfolio Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200/80">
                  <p className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">
                    Total Members
                  </p>
                  <p className="text-2xl font-black text-purple-900 mt-1">
                    {selectedGroup.members?.length || 0}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200/80">
                  <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">
                    Total Family Policies
                  </p>
                  <p className="text-2xl font-black text-indigo-900 mt-1">
                    {selectedGroup.consolidated_policies?.length || 0}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                  <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                    Total Sum Assured
                  </p>
                  <p className="text-2xl font-black text-emerald-900 mt-1">
                    ₹
                    {(
                      selectedGroup.consolidated_policies?.reduce(
                        (acc, p) => acc + (Number(p.sum_assured) || 0),
                        0
                      ) || 0
                    ).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {/* Members Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-600" />
                    <span>Family Members ({selectedGroup.members?.length || 0})</span>
                  </h3>
                  {canMutate && (
                    <button
                      onClick={() => {
                        setModalError("");
                        setAddMemberModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Member</span>
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {selectedGroup.members?.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            m.relation_type === "HEAD_OF_FAMILY"
                              ? "bg-purple-600 text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {m.customer_name?.slice(0, 1) || "M"}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{m.customer_name}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                m.relation_type === "HEAD_OF_FAMILY"
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                            >
                              {m.relation_type}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {m.customer_phone || m.customer_email || "No direct phone"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {m.relation_type !== "HEAD_OF_FAMILY" && canMutate && (
                          <button
                            onClick={() => handleRemoveMember(m.id, m.customer_name)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Remove Member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Consolidated Family Policy Portfolio */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>
                    Consolidated Family Policy Portfolio (
                    {selectedGroup.consolidated_policies?.length || 0})
                  </span>
                </h3>

                {selectedGroup.consolidated_policies?.length === 0 ? (
                  <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-slate-700">
                      No policies issued to family members yet
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      When policies are created for any member of this household, they will appear here
                      consolidated.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                          <th className="py-2.5 px-3">Policy #</th>
                          <th className="py-2.5 px-3">Insured Member</th>
                          <th className="py-2.5 px-3">Company / Plan</th>
                          <th className="py-2.5 px-3">Sum Assured</th>
                          <th className="py-2.5 px-3">Premium</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedGroup.consolidated_policies?.map((pol) => (
                          <tr key={pol.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              {pol.policy_number}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {pol.customer_name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              <div>{pol.company_name}</div>
                              <div className="text-[10px] text-slate-400">{pol.plan_name}</div>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              ₹{Number(pol.sum_assured || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-emerald-700">
                              ₹{Number(pol.final_premium || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                  pol.status === "ACTIVE"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {pol.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {addMemberModalOpen && selectedGroup && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold text-slate-900">Add Family Member</h3>
              </div>
              <button
                onClick={() => setAddMemberModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{typeof modalError === "string" ? modalError : (modalError?.error || modalError?.message || JSON.stringify(modalError))}</span>
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Record <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={memberCustomerId}
                  onChange={(e) => setMemberCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-white"
                >
                  <option value="">Select Member Customer...</option>
                  {customers
                    .filter(
                      (c) =>
                        !selectedGroup.members?.some((m) => m.customer_id === c.id)
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name || ""} ({c.phone || c.email || "No contact"})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Relationship to Family Head <span className="text-rose-500">*</span>
                </label>
                <select
                  value={memberRelation}
                  onChange={(e) => setMemberRelation(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-white"
                >
                  <option value="SPOUSE">Spouse</option>
                  <option value="CHILD">Child / Dependent</option>
                  <option value="PARENT">Parent</option>
                  <option value="SIBLING">Sibling</option>
                  <option value="DEPENDENT">Other Dependent</option>
                  <option value="OTHER">Other Relation</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="member-dependent-cb"
                  checked={memberIsDependent}
                  onChange={(e) => setMemberIsDependent(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500/20"
                />
                <label htmlFor="member-dependent-cb" className="text-xs text-slate-700 font-medium">
                  Financial Dependent
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="e.g., Primary nominee on policies"
                  value={memberNotes}
                  onChange={(e) => setMemberNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddMemberModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {modalLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Add Member</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

