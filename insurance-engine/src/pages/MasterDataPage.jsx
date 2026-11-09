import React, { useState } from "react";
import CompaniesPage from "./CompaniesPage";
import PlansPage from "./PlansPage";
import { Building2, FileText, Database } from "lucide-react";

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState("companies");

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Executive Header Banner */}
      <div className="bg-gradient-to-r from-white via-indigo-50/25 to-white p-6 rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                  Platform Configuration
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span className="text-xs text-slate-500 font-medium">Insurers & Products</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                Master Data Repository
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Configure partner insurance carriers, policy plans, and underlying underwriting catalogs.
              </p>
            </div>
          </div>

          {/* Tab Switcher Segmented Control */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-2xs self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("companies")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "companies"
                  ? "bg-white text-indigo-700 shadow-sm border border-slate-200/80 font-extrabold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Insurance Companies</span>
            </button>
            <button
              onClick={() => setActiveTab("plans")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "plans"
                  ? "bg-white text-indigo-700 shadow-sm border border-slate-200/80 font-extrabold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Policy Plans</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {activeTab === "companies" ? <CompaniesPage /> : <PlansPage />}
      </div>
    </div>
  );
}

