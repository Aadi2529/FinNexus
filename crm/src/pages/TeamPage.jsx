import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UserCheck,
  ShieldCheck,
  Briefcase,
  CheckCircle,
  Mail,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  User,
} from "lucide-react";
import { crmAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import UserManagementModal from "../components/UserManagementModal";
import { Plus, UserCog } from "lucide-react";

export default function TeamPage() {
  const navigate = useNavigate();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // User Management Modal State
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const data = await crmAPI.getTeam();
      setTeam(Array.isArray(data) ? data : []);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleOpenCreateUser = () => {
    setSelectedUserForEdit(null);
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (member) => {
    setSelectedUserForEdit(member);
    setUserModalOpen(true);
  };

  const filteredTeam = team.filter((m) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = m.full_name?.toLowerCase().includes(q);
      const matchEmail = m.email?.toLowerCase().includes(q);
      const matchRole = m.role?.toLowerCase().includes(q);
      return matchName || matchEmail || matchRole;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Team Operations Roster</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational workload allocation, system roles, and user account management.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchTeam}
            disabled={loading}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
            <span>Refresh Roster</span>
          </button>

          {(isAdmin || isSuperAdmin) && (
            <button
              onClick={handleOpenCreateUser}
              className="px-3.5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Provision User</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search team member by name, role, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800"
          />
        </div>

        <span className="text-xs text-slate-500 font-mono hidden sm:inline">
          {filteredTeam.length} active specialist(s)
        </span>
      </div>

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
            Loading team roster...
          </div>
        ) : filteredTeam.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            No team members found matching the filter.
          </div>
        ) : (
          filteredTeam.map((member) => {
            const totalWorkload = (member.active_workload_count || 0) + (member.completed_workload_count || 0);
            const completionRatio =
              totalWorkload > 0
                ? Math.round(((member.completed_workload_count || 0) / totalWorkload) * 100)
                : 100;

            return (
              <div
                key={member.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between hover:border-slate-300 transition-all duration-200"
              >
                <div>
                  {/* Top: Avatar, Name & Role */}
                  <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-teal-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                      {member.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h2 className="text-sm font-bold text-slate-900 truncate">
                          {member.full_name}
                        </h2>
                        {member.is_active && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Active" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 font-mono">
                          {member.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-600 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </div>

                  {/* Workload Stats */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Assigned</span>
                      <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                        {member.active_workload_count} orders
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Completed</span>
                      <span className="font-mono font-bold text-emerald-700 text-sm mt-0.5 block">
                        {member.completed_workload_count} resolved
                      </span>
                    </div>
                  </div>

                  {/* Workload Capacity Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Operational Capacity</span>
                      <span className="font-mono font-semibold text-slate-700">
                        {member.active_workload_count > 5 ? "High Load" : "Balanced"}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          member.active_workload_count > 5 ? "bg-amber-500" : "bg-teal-500"
                        }`}
                        style={{ width: `${Math.min(100, member.active_workload_count * 20)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {isAdmin || member.id === user?.id ? (
                    <Link
                      to={member.id === user?.id ? "/my-tasks" : `/work-orders?assigned_to_id=${member.id}`}
                      className="text-xs font-semibold text-teal-600 hover:text-teal-700 hover:underline flex items-center gap-1"
                    >
                      <span>{member.id === user?.id ? "View My Tasks" : "View Assigned Orders"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Peer Specialist</span>
                  )}

                  <div className="flex items-center gap-1.5">
                    {(isAdmin || isSuperAdmin) && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditUser(member)}
                        className="px-2 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs flex items-center gap-1"
                        title="Manage user account, credentials & status"
                      >
                        <UserCog className="w-3.5 h-3.5 text-teal-600" />
                        <span>Manage</span>
                      </button>
                    )}
                    <Link
                      to="/work-orders/new"
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs"
                    >
                      Delegate
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* User Management Modal */}
      <UserManagementModal
        isOpen={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        onUserSaved={() => fetchTeam()}
        editUser={selectedUserForEdit}
        currentLoggedInUser={user}
      />
    </div>
  );
}
