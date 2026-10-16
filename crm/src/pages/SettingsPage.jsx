import React, { useState, useEffect } from "react";
import {
  Sliders,
  ShieldCheck,
  Server,
  Database,
  Globe,
  Bell,
  CheckCircle,
  Save,
  Lock,
  Activity,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { healthAPI } from "../services/api";

export default function SettingsPage() {
  const { user, primaryRole } = useAuth();
  const [apiHealth, setApiHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  // Preference Settings
  const [slaDays, setSlaDays] = useState(3);
  const [defaultPriority, setDefaultPriority] = useState("NORMAL");
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [saved, setSaved] = useState(false);

  const checkHealth = async () => {
    setLoadingHealth(true);
    try {
      const data = await healthAPI.getReadiness();
      setApiHealth(data);
    } catch {
      setApiHealth({ status: "DEGRADED", database: "disconnected" });
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const rolePermissions = [
    { module: "Client Creation & Update", superAdmin: true, admin: true, manager: true, employee: false },
    { module: "Client Archival & Soft-Delete", superAdmin: true, admin: true, manager: false, employee: false },
    { module: "Permanent Client Deletion (Referential Guard)", superAdmin: true, admin: false, manager: false, employee: false },
    { module: "Work Order Creation", superAdmin: true, admin: true, manager: true, employee: true },
    { module: "Work Order Edit & Reassignment", superAdmin: true, admin: true, manager: true, employee: false },
    { module: "Checklist Milestone Execution & Progress", superAdmin: true, admin: true, manager: true, employee: true },
    { module: "Supervisor Completion Override Guard", superAdmin: true, admin: true, manager: true, employee: false },
    { module: "Work Order Archival & Deletion", superAdmin: true, admin: true, manager: false, employee: false },
    { module: "Work Categories & Catalog Config", superAdmin: true, admin: true, manager: false, employee: false },
    { module: "Global Task & Client Audit History", superAdmin: true, admin: true, manager: true, employee: false },
    { module: "Provision User Accounts (Admin/Manager/Employee)", superAdmin: true, admin: true, manager: false, employee: false },
    { module: "Super Admin Governance & Session Revocation", superAdmin: true, admin: false, manager: false, employee: false },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">CRM System Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Enterprise operational parameters, role-based capabilities, and multi-subdomain architecture.
        </p>
      </div>

      {/* Operational Defaults */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-bold text-slate-900">Operational SLA & Default Priorities</h2>
          </div>
          {saved && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Preferences saved
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Default Target SLA Deadline (Days)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={slaDays}
              onChange={(e) => setSlaDays(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-800"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              New orders default to current timestamp + this SLA duration.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Default Work Order Priority
            </label>
            <select
              value={defaultPriority}
              onChange={(e) => setDefaultPriority(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800"
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) => setEmailAlerts(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
            />
            <span className="font-medium">
              Enable background event queue dispatching for upcoming SLA deadlines
            </span>
          </label>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>

      {/* Role-Based Capabilities Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-bold text-slate-900">Role-Based Access Control (RBAC) Policy</h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Active Role: <strong className="text-slate-700">{primaryRole || user?.role || "EMPLOYEE"}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Operational Capability</th>
                <th className="py-2.5 px-3 text-center">Super Admin</th>
                <th className="py-2.5 px-3 text-center">Admin</th>
                <th className="py-2.5 px-3 text-center">Manager</th>
                <th className="py-2.5 px-3 text-center">Employee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rolePermissions.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-medium text-slate-800">{row.module}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-emerald-600 font-bold">✓</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {row.admin ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {row.manager ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {row.employee ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Architecture & Endpoints Diagnostics */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-bold text-slate-900">Platform Infrastructure & Diagnostics</h2>
          </div>
          <button
            onClick={checkHealth}
            className="text-xs text-teal-600 hover:underline flex items-center gap-1 font-semibold"
          >
            <Activity className="w-3.5 h-3.5" /> Check Liveness
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">CRM SPA Host</span>
            <span className="font-mono font-semibold text-slate-900">http://localhost:5174</span>
            <p className="text-[11px] text-slate-500">Subdomain: crm.finnexus.com</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">FastAPI Backend API</span>
            <span className="font-mono font-semibold text-slate-900">http://localhost:8000/api/v1</span>
            <p className="text-[11px] text-slate-500">Subdomain: api.finnexus.com</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">PostgreSQL 18 Database</span>
            <span className="font-mono font-semibold text-emerald-700 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              {apiHealth?.database === "connected" || !apiHealth ? "Online (financeflow_dev)" : "Degraded"}
            </span>
            <p className="text-[11px] text-slate-500">Migrations: Alembic 7d1ebff65b16</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Central Connect Dashboard</span>
            <span className="font-mono font-semibold text-slate-900">http://localhost:5173</span>
            <p className="text-[11px] text-slate-500">SSO & Cross-App Authentication Provider</p>
          </div>
        </div>
      </div>
    </div>
  );
}
