import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PurchasePartiesPage from "./PurchasePartiesPage";
import DatePicker from "../components/common/DatePicker";
import FormInput from "../components/common/FormInput";
import {
  validateIndianMobile,
  validateEmail,
  validateName,
  validatePercentage,
  validatePositiveDecimal,
} from "../utils/validation";
import {
  Users,
  Briefcase,
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Percent,
  Calendar,
  X,
  UserCheck,
  Building2,
  Phone,
  Mail,
  Award,
  DollarSign,
} from "lucide-react";

export default function PartnersPage() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const canMutate = isAdmin || isSuperAdmin;

  // Active Tab: 'agents' | 'purchase_parties'
  const [activeTab, setActiveTab] = useState("agents");

  // Agents State
  const [agents, setAgents] = useState([]);
  const [totalAgents, setTotalAgents] = useState(0);
  const [agentTotalPages, setAgentTotalPages] = useState(1);
  const [agentPage, setAgentPage] = useState(1);
  const [agentSearch, setAgentSearch] = useState("");
  const [agentStatus, setAgentStatus] = useState("ALL");
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Sub-Agent Form Modal State
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [agentModalLoading, setAgentModalLoading] = useState(false);
  const [agentModalError, setAgentModalError] = useState("");

  // Sub-Agent Form Fields
  const [fullName, setFullName] = useState("");
  const [agentCode, setAgentCode] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split("T")[0]);
  const [parentAgentFirm, setParentAgentFirm] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [bio, setBio] = useState("");
  const [showContactInfo, setShowContactInfo] = useState(true);

  // Sub-Agent Drawer Detail State
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Commission Split Config Modal State
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitError, setSplitError] = useState("");
  const [splitAgentId, setSplitAgentId] = useState("");
  const [splitCompanyId, setSplitCompanyId] = useState("");
  const [splitPlanId, setSplitPlanId] = useState("");
  const [splitType, setSplitType] = useState("PERCENTAGE");
  const [firmRate, setFirmRate] = useState("40.00");
  const [agentRate, setAgentRate] = useState("60.00");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [splitNotes, setSplitNotes] = useState("");

  // Dropdown data
  const [companies, setCompanies] = useState([]);
  const [plans, setPlans] = useState([]);

  const fetchAgents = async () => {
    setAgentsLoading(true);
    setAgentsError("");
    const res = await api.insurance.getSubAgents({
      page: agentPage,
      page_size: 10,
      search: agentSearch.trim() || undefined,
      status: agentStatus,
    });
    if (res.ok) {
      setAgents(res.data.items || []);
      setTotalAgents(res.data.total || 0);
      setAgentTotalPages(res.data.total_pages || 1);
    } else {
      setAgentsError(res.error || "Failed to load sub-agents.");
    }
    setAgentsLoading(false);
  };

  const loadDropdowns = async () => {
    const [compRes, planRes] = await Promise.all([
      api.insurance.getCompanies({ page_size: 100 }),
      api.insurance.getPlans({ page_size: 100 }),
    ]);
    if (compRes.ok) setCompanies(compRes.data.items || []);
    if (planRes.ok) setPlans(planRes.data.items || []);
  };

  useEffect(() => {
    if (activeTab === "agents") {
      fetchAgents();
      loadDropdowns();
    }
  }, [activeTab, agentPage, agentSearch, agentStatus]);

  const openAddAgentModal = () => {
    setEditingAgent(null);
    setFullName("");
    setAgentCode("");
    setMobileNumber("");
    setEmail("");
    setAddress("");
    setJoiningDate(new Date().toISOString().split("T")[0]);
    setParentAgentFirm("");
    setSpecialties("");
    setBio("");
    setShowContactInfo(true);
    setAgentModalError("");
    setAgentModalOpen(true);
  };

  const openEditAgentModal = (agent) => {
    setEditingAgent(agent);
    setFullName(agent.full_name || "");
    setAgentCode(agent.agent_code || "");
    setMobileNumber(agent.mobile_number || "");
    setEmail(agent.email || "");
    setAddress(agent.address || "");
    setJoiningDate(agent.joining_date || new Date().toISOString().split("T")[0]);
    setParentAgentFirm(agent.parent_agent_firm || "");
    setSpecialties(agent.specialties || "");
    setBio(agent.bio || "");
    setShowContactInfo(agent.show_contact_info ?? true);
    setAgentModalError("");
    setAgentModalOpen(true);
  };

  const openAgentDrawer = async (agent) => {
    setDrawerLoading(true);
    const res = await api.insurance.getSubAgent(agent.id);
    if (res.ok) {
      setSelectedAgent(res.data);
    } else {
      setAgentsError(res.error || "Failed to load agent profile details.");
    }
    setDrawerLoading(false);
  };

  const handleSaveAgent = async (e) => {
    e.preventDefault();
    const nameCheck = validateName(fullName, "Full Name", true);
    if (!nameCheck.isValid) {
      setAgentModalError(nameCheck.error);
      return;
    }
    const mobileCheck = validateIndianMobile(mobileNumber, "Mobile Number", true);
    if (!mobileCheck.isValid) {
      setAgentModalError(mobileCheck.error);
      return;
    }
    if (email) {
      const emailCheck = validateEmail(email, "Email Address", false);
      if (!emailCheck.isValid) {
        setAgentModalError(emailCheck.error);
        return;
      }
    }

    setAgentModalLoading(true);
    setAgentModalError("");

    const payload = {
      full_name: fullName.trim(),
      agent_code: agentCode.trim() || undefined,
      mobile_number: mobileNumber.trim(),
      email: email.trim() || null,
      address: address.trim() || null,
      joining_date: joiningDate || null,
      parent_agent_firm: parentAgentFirm.trim() || null,
      specialties: specialties.trim() || null,
      bio: bio.trim() || null,
      show_contact_info: showContactInfo,
    };

    let res;
    if (editingAgent) {
      res = await api.insurance.updateSubAgent(editingAgent.id, payload);
    } else {
      res = await api.insurance.createSubAgent(payload);
    }
    setAgentModalLoading(false);

    if (res.ok) {
      setActionSuccess(
        editingAgent
          ? `Sub-agent ${res.data.full_name} updated successfully.`
          : `Sub-agent ${res.data.full_name} enrolled with code ${res.data.agent_code}.`
      );
      setAgentModalOpen(false);
      fetchAgents();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setAgentModalError(res.error || "Operation failed.");
    }
  };

  const handleDeactivateAgent = async (agent) => {
    const nextStatus = agent.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (!window.confirm(`Mark sub-agent ${agent.full_name} as ${nextStatus}?`)) return;

    const res = await api.insurance.updateSubAgent(agent.id, { status: nextStatus });
    if (res.ok) {
      setActionSuccess(`Agent ${agent.full_name} status updated to ${nextStatus}.`);
      fetchAgents();
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setAgentsError(res.error || "Failed to update agent status.");
    }
  };

  const openSplitConfigModal = (agent) => {
    setSplitAgentId(agent.id);
    setSplitCompanyId("");
    setSplitPlanId("");
    setSplitType("PERCENTAGE");
    setFirmRate("40.00");
    setAgentRate("60.00");
    setEffectiveDate(new Date().toISOString().split("T")[0]);
    setSplitNotes("");
    setSplitError("");
    setSplitModalOpen(true);
  };

  const handleSaveSplit = async (e) => {
    e.preventDefault();
    if (splitType === "PERCENTAGE") {
      const fCheck = validatePercentage(firmRate, "Firm Rate", true);
      if (!fCheck.isValid) {
        setSplitError(fCheck.error);
        return;
      }
      const aCheck = validatePercentage(agentRate, "Sub-Agent Rate", true);
      if (!aCheck.isValid) {
        setSplitError(aCheck.error);
        return;
      }
      const fRate = parseFloat(firmRate);
      const aRate = parseFloat(agentRate);
      if (fRate + aRate > 100.0) {
        setSplitError("Percentage allocation cannot exceed 100% total.");
        return;
      }
    } else {
      const fCheck = validatePositiveDecimal(firmRate, "Firm Fee", true);
      if (!fCheck.isValid) {
        setSplitError(fCheck.error);
        return;
      }
      const aCheck = validatePositiveDecimal(agentRate, "Agent Payout", true);
      if (!aCheck.isValid) {
        setSplitError(aCheck.error);
        return;
      }
    }

    const fRate = parseFloat(firmRate);
    const aRate = parseFloat(agentRate);

    setSplitLoading(true);
    setSplitError("");
    const res = await api.insurance.createCommissionSplitConfig({
      sub_agent_id: splitAgentId,
      company_id: splitCompanyId || null,
      plan_id: splitPlanId || null,
      split_type: splitType,
      firm_commission_rate: fRate,
      agent_commission_rate: aRate,
      effective_date: effectiveDate,
      notes: splitNotes.trim() || null,
    });
    setSplitLoading(false);

    if (res.ok) {
      setActionSuccess("Commission split agreement saved and effective.");
      setSplitModalOpen(false);
      setTimeout(() => setActionSuccess(""), 4000);
    } else {
      setSplitError(res.error || "Failed to configure commission split.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Executive Header Banner */}
      <div className="bg-gradient-to-r from-white via-teal-50/25 to-white p-6 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-indigo-500" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-700 flex items-center justify-center text-white shadow-md shadow-teal-500/20 shrink-0">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded-md">
                  Third-Party & Partner Network
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span className="text-xs text-slate-500 font-medium">Distribution & Sourcing</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                Partner & Sourcing Management
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Manage your network of POSP Sub-Agents, commission-sharing rules, and Purchase Party agencies.
              </p>
            </div>
          </div>

          {/* Tab Switcher Segmented Control */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-2xs self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("agents")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "agents"
                  ? "bg-white text-teal-700 shadow-sm border border-slate-200/80 font-extrabold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <Users className="w-4 h-4 text-teal-600" />
              <span>Sub-Agents & POSP</span>
            </button>
            <button
              onClick={() => setActiveTab("purchase_parties")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "purchase_parties"
                  ? "bg-white text-emerald-700 shadow-sm border border-slate-200/80 font-extrabold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <Briefcase className="w-4 h-4 text-emerald-600" />
              <span>Purchase Parties</span>
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

      {/* TAB 1: Sub-Agents & POSP */}
      {activeTab === "agents" && (
        <div className="space-y-4">
          {/* Top Actions & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by agent name, code, or phone..."
                  value={agentSearch}
                  onChange={(e) => {
                    setAgentSearch(e.target.value);
                    setAgentPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-900"
                />
              </div>

              <select
                value={agentStatus}
                onChange={(e) => {
                  setAgentStatus(e.target.value);
                  setAgentPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            {canMutate && (
              <button
                onClick={openAddAgentModal}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-teal-500/25 active:scale-95 transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Onboard Sub-Agent / POSP</span>
              </button>
            )}
          </div>

          {agentsError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{agentsError}</span>
            </div>
          )}

          {/* Sub-Agents Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Sub-Agent / Code</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Firm / Affiliation</th>
                  <th className="py-3 px-4">Joining Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agentsLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                      Loading sub-agents...
                    </td>
                  </tr>
                ) : agents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No sub-agents registered in the system.
                    </td>
                  </tr>
                ) : (
                  agents.map((ag) => (
                    <tr key={ag.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{ag.full_name}</div>
                        <div className="font-mono text-[10px] text-teal-700 font-semibold">
                          {ag.agent_code}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>{ag.mobile_number}</div>
                        <div className="text-[11px] text-slate-400">{ag.email || "No email"}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {ag.parent_agent_firm || "Direct Main Firm"}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{ag.joining_date || "—"}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ag.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {ag.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openAgentDrawer(ag)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                            title="View Agent Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canMutate && (
                            <>
                              <button
                                onClick={() => openSplitConfigModal(ag)}
                                className="p-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 transition-colors"
                                title="Configure Commission Split"
                              >
                                <Percent className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openEditAgentModal(ag)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                                title="Edit Agent"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeactivateAgent(ag)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                                title={ag.status === "ACTIVE" ? "Deactivate" : "Activate"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {agentTotalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-xs text-slate-500">
                Showing <span className="font-semibold">{agents.length}</span> of{" "}
                <span className="font-semibold">{totalAgents}</span> agents
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAgentPage((p) => Math.max(1, p - 1))}
                  disabled={agentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold px-2">
                  Page {agentPage} of {agentTotalPages}
                </span>
                <button
                  onClick={() => setAgentPage((p) => Math.min(agentTotalPages, p + 1))}
                  disabled={agentPage >= agentTotalPages}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Purchase Parties */}
      {activeTab === "purchase_parties" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <PurchasePartiesPage />
        </div>
      )}

      {/* Onboard / Edit Sub-Agent Modal */}
      {agentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingAgent ? "Edit Sub-Agent Details" : "Onboard New Sub-Agent / POSP"}
                </h3>
              </div>
              <button
                onClick={() => setAgentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {agentModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{agentModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAgent} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormInput
                  label="Full Name"
                  required
                  placeholder="e.g., Rajesh Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Agent Code (Leave blank to auto-generate)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto: POSP-XXXX-XXXX"
                    value={agentCode}
                    onChange={(e) => setAgentCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormInput
                  type="mobile"
                  label="Mobile Number"
                  required
                  placeholder="10-digit mobile"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                />
                <FormInput
                  type="email"
                  label="Email Address"
                  placeholder="agent@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Parent Firm / Sub-Broker
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Prime Wealth Advisory"
                    value={parentAgentFirm}
                    onChange={(e) => setParentAgentFirm(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Joining Date
                  </label>
                  <DatePicker
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Specialties (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Term Life, Comprehensive Motor, Group Health"
                  value={specialties}
                  onChange={(e) => setSpecialties(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Public Profile Bio
                </label>
                <textarea
                  rows={2}
                  placeholder="Short introduction visible on the agent's public lead page..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-contact-cb"
                  checked={showContactInfo}
                  onChange={(e) => setShowContactInfo(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500/20"
                />
                <label htmlFor="show-contact-cb" className="text-xs text-slate-700 font-medium">
                  Display Phone & Email on Public Lead Page
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAgentModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={agentModalLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {agentModalLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingAgent ? "Update Sub-Agent" : "Onboard Sub-Agent"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Commission Split Configuration Modal */}
      {splitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Configure Commission Split Arrangement
                </h3>
              </div>
              <button
                onClick={() => setSplitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {splitError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{typeof splitError === "string" ? splitError : (splitError?.error || splitError?.message || JSON.stringify(splitError))}</span>
              </div>
            )}

            <form onSubmit={handleSaveSplit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Arrangement Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSplitType("PERCENTAGE")}
                    className={`py-2 text-xs font-bold rounded-xl border text-center transition-colors ${
                      splitType === "PERCENTAGE"
                        ? "bg-teal-50 border-teal-500 text-teal-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Percentage Split (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitType("FIXED_AMOUNT")}
                    className={`py-2 text-xs font-bold rounded-xl border text-center transition-colors ${
                      splitType === "FIXED_AMOUNT"
                        ? "bg-teal-50 border-teal-500 text-teal-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Fixed Sourcing Fee (₹)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {splitType === "PERCENTAGE" ? "Firm Retained (%)" : "Firm Fee (₹)"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={firmRate}
                    onChange={(e) => setFirmRate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {splitType === "PERCENTAGE" ? "Sub-Agent Payout (%)" : "Agent Payout (₹)"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={agentRate}
                    onChange={(e) => setAgentRate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company Scope (Optional)
                  </label>
                  <select
                    value={splitCompanyId}
                    onChange={(e) => setSplitCompanyId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="">All Insurers</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Effective Date
                  </label>
                  <DatePicker
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Terms</label>
                <input
                  type="text"
                  placeholder="e.g., Valid for FY 2026-27 renewal tiers"
                  value={splitNotes}
                  onChange={(e) => setSplitNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSplitModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={splitLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {splitLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agent Detail Profile Drawer */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  {selectedAgent.full_name?.slice(0, 2)?.toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{selectedAgent.full_name}</h2>
                  <p className="text-xs text-slate-500 font-mono">{selectedAgent.agent_code}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Public Profile Link Alert */}
              <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    <span>Public Lead & Agent Profile Active</span>
                  </p>
                  <p className="text-[11px] text-teal-700 mt-0.5">
                    Prospects can view this agent's public landing page and submit direct inquiries.
                  </p>
                </div>
                <a
                  href={`/agents/${selectedAgent.public_profile_slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-white text-teal-700 border border-teal-300 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-teal-100 transition-colors shrink-0"
                >
                  <span>Open Profile</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Performance Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">
                    Policies Sourced
                  </p>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    {selectedAgent.policies_count || 0}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="text-[11px] font-semibold text-emerald-700 uppercase">
                    Commission Earned
                  </p>
                  <p className="text-2xl font-black text-emerald-900 mt-1">
                    ₹{Number(selectedAgent.total_commission_earned || 0).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {/* Contact & Bio */}
              <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 text-xs">
                <h4 className="font-bold text-slate-800">Agent Information</h4>
                <div className="space-y-1.5 text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedAgent.mobile_number}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedAgent.email || "No email"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedAgent.parent_agent_firm || "Direct Main Firm"}</span>
                  </div>
                </div>
                {selectedAgent.specialties && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Specialties:
                    </span>
                    <p className="text-slate-700 font-medium mt-0.5">{selectedAgent.specialties}</p>
                  </div>
                )}
                {selectedAgent.bio && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Bio:</span>
                    <p className="text-slate-600 italic mt-0.5">"{selectedAgent.bio}"</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

