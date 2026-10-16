import React from "react";
import TopNavigation from "./TopNavigation";
import { ShieldCheck, GitBranch, Terminal } from "lucide-react";

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopNavigation />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      <footer className="bg-white border-t border-slate-200/80 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">FinNexus Toolkit</span>
            <span>&bull;</span>
            <span>Independent SPA (Port 5175 / toolkit.finnexus.com)</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> PyMuPDF C-Engine
            </span>
            <span className="flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5 text-blue-600" /> 300 DPI Rasterization
            </span>
            <span className="flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5 text-slate-600" /> Zero PII Retention
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
