import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { APP_URLS, tokenStorage, healthAPI, crmAPI, insuranceAPI, authAPI } from "../services/api";
import UserManagementModal from "../components/UserManagementModal";
import {
  Users,
  Wrench,
  Shield,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Database,
  Lock,
  Globe,
  FileSpreadsheet,
  TrendingUp,
  Clock,
  Sparkles,
  UserCog,
  Plus,
  RefreshCw,
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    customers: 0,
    policies: 0,
    dbStatus: "checking",
  });

  useEffect(() => {
    Promise.allSettled([
      crmAPI.getCustomers({ limit: 1 }),
      insuranceAPI.getPolicies(),
      healthAPI.getReadiness(),
    ]).then(([crmRes, insRes, healthRes]) => {
      setStats({
        customers:
          crmRes.status === "fulfilled" && crmRes.value?.success && crmRes.value?.data?.total !== undefined
            ? crmRes.value.data.total
            : crmRes.status === "fulfilled" && Array.isArray(crmRes.value?.data)
            ? crmRes.value.data.length
            : 0,
        policies:
          insRes.status === "fulfilled" && insRes.value?.success && Array.isArray(insRes.value?.data)
            ? insRes.value.data.length
            : 0,
        dbStatus:
          healthRes.status === "fulfilled" && healthRes.value?.success
            ? "connected"
            : "live",
      });
    });
  }, []);

  const isSuperAdmin =
    user?.role === "SUPER_ADMIN" ||
    (Array.isArray(user?.roles) && user.roles.includes("SUPER_ADMIN"));
  const isAdmin =
    isSuperAdmin ||
    user?.role === "ADMIN" ||
    (Array.isArray(user?.roles) && user.roles.includes("ADMIN"));

  const [systemUsers, setSystemUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);

  const fetchUsers = async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const res = await authAPI.getUsers();
      if (res.success && Array.isArray(res.data)) {
        setSystemUsers(res.data);
      }
    } catch {
      // Ignored
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleOpenCreateUser = () => {
    setSelectedUserForEdit(null);
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (targetUser) => {
    setSelectedUserForEdit(targetUser);
    setUserModalOpen(true);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const handleLaunchApp = (targetUrl, targetPath = "") => {
    const ssoUrl = tokenStorage.getHandoffUrl(targetUrl, targetPath);
    window.location.href = ssoUrl;
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-600">
                Unified Ecosystem Control Center
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <span className="text-xs text-slate-500 font-medium">Multi-Subdomain Architecture</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {getGreeting()}, {user?.full_name?.split(" ")[0] || "User"}.
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
              Welcome to FinNexus. Select one of the three independent business engines below. 
              Your active session transfers seamlessly between subdomains with zero re-authentication.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border ${
              isSuperAdmin
                ? "bg-amber-100 text-amber-900 border-amber-300 shadow-sm"
                : "bg-navy-900 text-teal-300 border-slate-700"
            }`}>
              <Sparkles className={`w-3.5 h-3.5 ${isSuperAdmin ? "text-amber-600" : "text-teal-400"}`} />
              {isSuperAdmin ? "SUPER ADMIN" : `Role: ${user?.role || "USER"}`}
            </span>
          </div>
        </div>

        {/* Live Ecosystem Metrics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">CRM Borrowers</p>
              <p className="text-sm font-bold text-slate-900">{stats.customers} Profiles</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Active Policies</p>
              <p className="text-sm font-bold text-slate-900">{stats.policies} In Force</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">PostgreSQL 18</p>
              <p className="text-sm font-bold text-slate-900 capitalize">
                {stats.dbStatus === "connected" ? "Connected" : "Live"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Subdomains</p>
              <p className="text-sm font-bold text-slate-900">4 Active SPAs</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Primary Application Launch Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Independent Business Modules</h2>
            <p className="text-xs text-slate-500">Each application runs as an autonomous SPA on its dedicated port or production subdomain.</p>
          </div>
          <span className="text-xs font-semibold text-slate-400">3 of 3 Available</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Module 1: CRM */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> Port 5174
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 tracking-tight">FinNexus CRM</h3>
              <p className="text-xs font-medium text-emerald-700 mt-0.5">Customer Relationship Management</p>

              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                Manage borrower 360 profiles, lead stages, CIBIL bureau credit scores, income/obligation ratios, timeline consultation notes, and follow-up tasks.
              </p>

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Local URL:</span>
                  <span className="font-mono text-slate-800 font-medium">http://localhost:5174</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Production:</span>
                  <span className="font-mono text-slate-800 font-medium">crm.finnexus.com</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={() => handleLaunchApp(APP_URLS.crm)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <span>Launch CRM</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleLaunchApp(APP_URLS.crm, "/work-orders/new")}
                className="py-2.5 px-3 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                title="Open Work Order Form"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>New Order</span>
              </button>
            </div>
          </div>

          {/* Module 2: Toolkit */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200/80 text-teal-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <Wrench className="w-6 h-6" />
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                  <CheckCircle2 className="w-3 h-3" /> Port 5175
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 tracking-tight">Finance Toolkit</h3>
              <p className="text-xs font-medium text-teal-700 mt-0.5">Calculators & KYC Vault</p>

              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                Precision Python Decimal reducing-balance EMI loan engine with 12-month schedule, SIP wealth compounding planner, PAN format validator, and magic-byte document vault.
              </p>

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Local URL:</span>
                  <span className="font-mono text-slate-800 font-medium">http://localhost:5175</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Production:</span>
                  <span className="font-mono text-slate-800 font-medium">toolkit.finnexus.com</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50/70 border-t border-slate-100">
              <button
                onClick={() => handleLaunchApp(APP_URLS.toolkit)}
                className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <span>Launch Toolkit Module</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Module 3: Insurance Engine */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <Shield className="w-6 h-6" />
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <CheckCircle2 className="w-3 h-3" /> Port 5176
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 tracking-tight">FinNexus Insurance Engine</h3>
              <p className="text-xs font-medium text-indigo-700 mt-0.5">Policy & Renewal Management</p>

              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                Explore underwriting product tariffs, calculate risk quotes with smoker & pre-existing condition loadings (plus 18% GST in Decimal), and manage 1-year policy renewals.
              </p>

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Local URL:</span>
                  <span className="font-mono text-slate-800 font-medium">http://localhost:5176</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Production:</span>
                  <span className="font-mono text-slate-800 font-medium">insurance.finnexus.com</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50/70 border-t border-slate-100">
              <button
                onClick={() => handleLaunchApp(APP_URLS.insurance)}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <span>Launch Insurance Module</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Super Admin & Admin: User Directory & Provisioning */}
      {isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Ecosystem User Accounts & Role Governance
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 font-mono">
                  {isSuperAdmin ? "Super Admin Authority" : "Admin Management"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage operational user accounts, roles, initial credentials, and session revocations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchUsers}
                disabled={loadingUsers}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? "animate-spin text-teal-600" : ""}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleOpenCreateUser}
                className="px-3.5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Provision New User</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                  <th className="py-2.5 px-3">Full Name</th>
                  <th className="py-2.5 px-3">Email Address</th>
                  <th className="py-2.5 px-3">Assigned Role</th>
                  <th className="py-2.5 px-3">Account Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingUsers ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto text-teal-600 mb-1" />
                      Loading user directory...
                    </td>
                  </tr>
                ) : systemUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No operational users found. Click "Provision New User" to create Admin, Manager, or Employee accounts.
                    </td>
                  </tr>
                ) : (
                  systemUsers.map((u) => {
                    const uRole = Array.isArray(u.roles) ? u.roles[0] : u.role || "EMPLOYEE";
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900">{u.full_name}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{u.email}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono ${
                              uRole === "SUPER_ADMIN"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : uRole === "ADMIN"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : uRole === "MANAGER"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-teal-50 text-teal-700 border-teal-200"
                            }`}
                          >
                            {uRole}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              u.is_active
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.is_active ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            {u.is_active ? "Active" : "Deactivated"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenEditUser(u)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg shadow-2xs inline-flex items-center gap-1"
                          >
                            <UserCog className="w-3.5 h-3.5 text-teal-600" />
                            <span>Manage</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Management Modal */}
      <UserManagementModal
        isOpen={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        onUserSaved={() => fetchUsers()}
        editUser={selectedUserForEdit}
        currentLoggedInUser={user}
      />

      {/* Cross-Subdomain Architecture Information Card */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-white">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Multi-Subdomain Deployment Blueprint</h3>
              <p className="text-xs text-slate-400">Intended production domains with shared API backend</p>
            </div>
          </div>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1"
          >
            <span>Explore OpenAPI Specs</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Dashboard</span>
            <span className="font-mono text-teal-300 block font-medium">dashboard.finnexus.com</span>
            <span className="text-slate-500 text-[10px]">Port 5173 (Dev)</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">CRM Suite</span>
            <span className="font-mono text-emerald-300 block font-medium">crm.finnexus.com</span>
            <span className="text-slate-500 text-[10px]">Port 5174 (Dev)</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Toolkit</span>
            <span className="font-mono text-teal-300 block font-medium">toolkit.finnexus.com</span>
            <span className="text-slate-500 text-[10px]">Port 5175 (Dev)</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Insurance Engine</span>
            <span className="font-mono text-indigo-300 block font-medium">insurance.finnexus.com</span>
            <span className="text-slate-500 text-[10px]">Port 5176 (Dev)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
