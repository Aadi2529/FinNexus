import React, { useState } from "react";
import Sidebar from "./Sidebar";
import TopHeader from "./TopHeader";
import { ShieldCheck, GitBranch, Terminal } from "lucide-react";

export default function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <TopHeader setMobileOpen={setMobileOpen} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        <footer className="bg-white border-t border-slate-200/80 py-3 px-6 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">FinNexus CRM</span>
              <span>&bull;</span>
              <span>Work Order & Employee Task Management</span>
              <span>&bull;</span>
              <span className="font-mono text-slate-400">Port 5174</span>
            </div>
            <div className="flex items-center gap-4 text-slate-400 text-[11px]">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> RBAC Enforced
              </span>
              <span className="flex items-center gap-1">
                <GitBranch className="w-3.5 h-3.5 text-blue-600" /> PostgreSQL 18
              </span>
              <span className="flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-slate-500" /> FastAPI
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
