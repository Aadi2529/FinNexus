import React, { useState, useRef, useEffect } from "react";
import {
  Grid,
  ChevronDown,
  LayoutDashboard,
  Users,
  Wrench,
  Shield,
  ExternalLink,
  CheckCircle,
} from "lucide-react";
import { APP_URLS, tokenStorage } from "../services/api";
import { BRANDING } from "../config/branding";

export default function AppSwitcher({ currentApp = "dashboard" }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const apps = [
    {
      id: "dashboard",
      name: BRANDING.dashboard.name,
      tagline: BRANDING.dashboard.tagline,
      url: APP_URLS.dashboard,
      icon: LayoutDashboard,
      color: "text-blue-600 bg-blue-50 border-blue-200",
      activeBg: "bg-blue-50/80 border-blue-300",
    },
    {
      id: "crm",
      name: BRANDING.crm.name,
      tagline: BRANDING.crm.tagline,
      url: APP_URLS.crm,
      icon: Users,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
      activeBg: "bg-emerald-50/80 border-emerald-300",
    },
    {
      id: "toolkit",
      name: BRANDING.toolkit.name,
      tagline: BRANDING.toolkit.tagline,
      url: APP_URLS.toolkit,
      icon: Wrench,
      color: "text-teal-600 bg-teal-50 border-teal-200",
      activeBg: "bg-teal-50/80 border-teal-300",
    },
    {
      id: "insurance",
      name: BRANDING.insurance.name,
      tagline: BRANDING.insurance.tagline,
      url: APP_URLS.insurance,
      icon: Shield,
      color: "text-indigo-600 bg-indigo-50 border-indigo-200",
      activeBg: "bg-indigo-50/80 border-indigo-300",
    },
  ];

  const handleNavigate = (targetUrl) => {
    const handoffUrl = tokenStorage.getHandoffUrl(targetUrl);
    window.location.href = handoffUrl;
  };

  const currentAppObj = apps.find((a) => a.id === currentApp) || apps[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        title="Switch Application"
      >
        <Grid className="w-3.5 h-3.5 text-slate-500" />
        <span className="hidden sm:inline text-slate-900 font-medium">{currentAppObj.name}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200/80 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              {BRANDING.ecosystemTitle}
            </p>
          </div>
          <div className="space-y-1 px-1">
            {apps.map((app) => {
              const Icon = app.icon;
              const isActive = app.id === currentApp;

              return (
                <button
                  key={app.id}
                  onClick={() => {
                    if (!isActive) handleNavigate(app.url);
                    setIsOpen(false);
                  }}
                  disabled={isActive}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                    isActive
                      ? "bg-slate-100/70 border border-slate-200 cursor-default"
                      : "hover:bg-slate-50 hover:border-slate-200 border border-transparent cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 ${app.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900">{app.name}</span>
                        {isActive && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-700 bg-emerald-100/80 rounded">
                            <CheckCircle className="w-2.5 h-2.5" /> Current
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">{app.tagline}</p>
                    </div>
                  </div>
                  {!isActive && <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
