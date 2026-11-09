import React from "react";
import TopNavigation from "./TopNavigation";
import { ShieldCheck, GitBranch, Terminal } from "lucide-react";

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-900 selection:bg-indigo-600 selection:text-white">
      <TopNavigation />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      <footer className="bg-white/80 backdrop-blur-xs border-t border-slate-200/90 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">FinNexus Insurance Engine</span>
            <span>&bull;</span>
            <span className="text-slate-500">Enterprise Broker Management ERP</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 text-[11px]">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Actuarial Pricing Tariffs
            </span>
            <span className="flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5 text-blue-600" /> 18% GST Precision Engine
            </span>
            <span className="flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5 text-slate-600" /> Policy Lifecycle Registry
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
