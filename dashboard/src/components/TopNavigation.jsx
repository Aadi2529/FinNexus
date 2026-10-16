import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppSwitcher from "./AppSwitcher";
import {
  LogOut,
  User as UserIcon,
  Activity,
  Layers,
} from "lucide-react";

export default function TopNavigation() {
  const { user, logout, isSuperAdmin, primaryRole } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const displayRoleLabel = isSuperAdmin
    ? "Super Admin"
    : primaryRole === "ADMIN"
    ? "Admin"
    : primaryRole === "MANAGER"
    ? "Manager"
    : primaryRole === "EMPLOYEE"
    ? "Employee"
    : user?.role || "Member";

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Left: Brand & App Switcher */}
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-navy-900 border border-slate-700 flex items-center justify-center text-teal-400 shadow-sm group-hover:scale-105 transition-transform">
                <Layers className="w-4 h-4 text-teal-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  FinNexus <span className="text-teal-600 font-semibold text-xs px-1.5 py-0.5 bg-teal-50 border border-teal-200 rounded">Dashboard</span>
                </span>
                <span className="text-[10px] text-slate-400 -mt-0.5 tracking-wider uppercase font-medium">Enterprise Workspace</span>
              </div>
            </Link>

            <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

            {/* Global App Switcher Dropdown */}
            <AppSwitcher currentApp="dashboard" />
          </div>

          {/* Right: Status & User Flyout */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Ecosystem Online</span>
            </div>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold border ${
                    isSuperAdmin
                      ? "bg-amber-900 text-amber-300 border-amber-600"
                      : "bg-navy-900 text-teal-300 border-slate-700"
                  }`}>
                    {getInitials(user.full_name)}
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-900 leading-none">{user.full_name || "User"}</span>
                    <span className={`text-[10px] font-mono mt-0.5 font-bold ${
                      isSuperAdmin ? "text-amber-700" : "text-slate-500"
                    }`}>
                      {displayRoleLabel}
                    </span>
                  </div>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900">{user.full_name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded ${
                        isSuperAdmin
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-teal-50 text-teal-700 border border-teal-200"
                      }`}>
                        {isSuperAdmin ? "SUPER ADMIN" : displayRoleLabel.toUpperCase()}
                      </span>
                    </div>

                    <div className="px-2 py-1">
                      <a
                        href="http://localhost:8000/docs"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg"
                      >
                        <Activity className="w-3.5 h-3.5 text-slate-400" />
                        <span>Interactive API Docs</span>
                      </a>
                    </div>

                    <div className="border-t border-slate-100 px-2 pt-1 mt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-medium text-left"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out of Platform</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-navy-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
