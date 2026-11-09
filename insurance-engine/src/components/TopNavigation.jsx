import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppSwitcher from "./AppSwitcher";
import {
  Shield,
  LogOut,
  Activity,
  ArrowLeft,
  LayoutDashboard,
  Building2,
  FileText,
  Users,
  Umbrella,
  HeartHandshake,
  DollarSign,
  Briefcase,
  Database,
  MessageSquare,
  Menu,
  X,
  ChevronDown,
  Layers,
} from "lucide-react";
import { APP_URLS, tokenStorage } from "../services/api";

export default function TopNavigation() {
  const { user, logout, isSuperAdmin, primaryRole } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // 'setup' | 'proposals' | null

  const location = useLocation();
  const navRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setOpenDropdown(null);
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on location change
  useEffect(() => {
    setOpenDropdown(null);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const displayRoleLabel = isSuperAdmin
    ? "Super Admin"
    : primaryRole === "ADMIN"
    ? "Admin"
    : primaryRole === "MANAGER"
    ? "Manager"
    : primaryRole === "EMPLOYEE"
    ? "Employee"
    : user?.role || "Member";

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
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

  const isSetupActive = ["/companies", "/plans", "/purchase-parties", "/partners"].some((p) =>
    location.pathname.startsWith(p)
  );

  const isProposalsActive = ["/customers", "/family-groups", "/policies"].some((p) =>
    location.pathname.startsWith(p)
  );

  const basicSetupItems = [
    { label: "Insurance Companies", path: "/companies", icon: Building2, desc: "Carrier & provider tie-ups" },
    { label: "Policy Plans", path: "/plans", icon: FileText, desc: "Actuarial tariff catalog" },
    { label: "Purchase Parties", path: "/purchase-parties", icon: Database, desc: "Sourcing & IMF channels" },
    { label: "Sub-Agents / POSP", path: "/partners", icon: Briefcase, desc: "Brokers & agent networks" },
  ];

  const customerProposalsItems = [
    { label: "Customers", path: "/customers", icon: Users, desc: "Individual & corporate clients" },
    { label: "Family Groups", path: "/family-groups", icon: HeartHandshake, desc: "Multi-member portfolios" },
    { label: "Policies", path: "/policies", icon: Shield, desc: "Issue contracts & schedules" },
  ];

  return (
    <header ref={navRef} className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Upper Bar */}
        <div className="flex items-center justify-between h-14">
          {/* Left: Brand & App Switcher */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  FinNexus{" "}
                  <span className="text-indigo-700 font-semibold text-xs px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 rounded">
                    Insurance
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 -mt-0.5 tracking-wider uppercase font-medium hidden sm:inline">
                  Broker Management ERP
                </span>
              </div>
            </Link>

            <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

            <AppSwitcher currentApp="insurance" />
          </div>

          {/* Right: Quick link & User Flyout */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={tokenStorage.getHandoffUrl(APP_URLS.dashboard)}
              className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </a>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                      isSuperAdmin ? "bg-amber-800 text-amber-200" : "bg-indigo-700 text-white"
                    }`}
                  >
                    {getInitials(user.full_name)}
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-900 leading-none">
                      {user.full_name || "User"}
                    </span>
                    <span
                      className={`text-[10px] font-mono mt-0.5 font-bold ${
                        isSuperAdmin ? "text-amber-700" : "text-slate-500"
                      }`}
                    >
                      {displayRoleLabel}
                    </span>
                  </div>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900">{user.full_name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded ${
                          isSuperAdmin
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                        }`}
                      >
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
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Desktop Primary Grouped Navigation Bar */}
        <nav className="hidden md:flex items-center gap-1 border-t border-slate-100 py-1 overflow-visible">
          {/* 1. Dashboard */}
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                isActive || location.pathname === "/dashboard"
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent"
              }`
            }
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-indigo-600" />
            <span>Dashboard</span>
          </NavLink>

          {/* 2. Group: Basic Setup */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "setup" ? null : "setup")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                isSetupActive || openDropdown === "setup"
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent"
              }`}
            >
              <Building2 className={`w-3.5 h-3.5 ${isSetupActive ? "text-indigo-600" : "text-slate-400"}`} />
              <span>Basic Setup</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${openDropdown === "setup" ? "rotate-180" : ""}`} />
            </button>

            {openDropdown === "setup" && (
              <div className="absolute left-0 mt-1 w-60 bg-white rounded-xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Master Configurations
                </div>
                {basicSetupItems.map((sub) => {
                  const SubIcon = sub.icon;
                  const isCurrent = location.pathname.startsWith(sub.path);
                  return (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      onClick={() => setOpenDropdown(null)}
                      className={`flex items-start gap-2.5 px-3 py-2 text-xs transition-colors ${
                        isCurrent ? "bg-indigo-50/70 text-indigo-700 font-bold" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <SubIcon className={`w-4 h-4 mt-0.5 shrink-0 ${isCurrent ? "text-indigo-600" : "text-slate-400"}`} />
                      <div>
                        <div className="font-semibold">{sub.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{sub.desc}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Group: Customer / Proposals */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "proposals" ? null : "proposals")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                isProposalsActive || openDropdown === "proposals"
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent"
              }`}
            >
              <Users className={`w-3.5 h-3.5 ${isProposalsActive ? "text-indigo-600" : "text-slate-400"}`} />
              <span>Customer / Proposals</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${openDropdown === "proposals" ? "rotate-180" : ""}`} />
            </button>

            {openDropdown === "proposals" && (
              <div className="absolute left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Client &amp; Policy Portfolio
                </div>
                {customerProposalsItems.map((sub) => {
                  const SubIcon = sub.icon;
                  const isCurrent = location.pathname.startsWith(sub.path);
                  return (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      onClick={() => setOpenDropdown(null)}
                      className={`flex items-start gap-2.5 px-3 py-2 text-xs transition-colors ${
                        isCurrent ? "bg-indigo-50/70 text-indigo-700 font-bold" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <SubIcon className={`w-4 h-4 mt-0.5 shrink-0 ${isCurrent ? "text-indigo-600" : "text-slate-400"}`} />
                      <div>
                        <div className="font-semibold">{sub.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{sub.desc}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Commission */}
          <NavLink
            to="/commissions"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent"
              }`
            }
          >
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            <span>Commission</span>
          </NavLink>

          {/* 5. Health Quotation */}
          <NavLink
            to="/insurance/health-quotations"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                isActive || location.pathname.startsWith("/insurance/health-quotations")
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent"
              }`
            }
          >
            <Umbrella className="w-3.5 h-3.5 text-slate-400" />
            <span>Health Quotation</span>
          </NavLink>

          {/* 6. Lead Management */}
          <NavLink
            to="/leads"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent"
              }`
            }
          >
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            <span>Lead Management</span>
          </NavLink>
        </nav>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2 shadow-lg animate-in slide-in-from-top-2 duration-150 max-h-[80vh] overflow-y-auto">
          {/* Dashboard */}
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <LayoutDashboard className="w-4 h-4 text-indigo-600" />
            <span>Dashboard</span>
          </Link>

          {/* Group 1: Basic Setup */}
          <div className="pt-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">
              Basic Setup
            </div>
            {basicSetupItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Group 2: Customer / Proposals */}
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">
              Customer / Proposals
            </div>
            {customerProposalsItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Core Operations */}
          <div className="pt-2 border-t border-slate-100">
            <Link
              to="/commissions"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <DollarSign className="w-4 h-4 text-slate-400" />
              <span>Commission</span>
            </Link>
            <Link
              to="/insurance/health-quotations"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Umbrella className="w-4 h-4 text-slate-400" />
              <span>Health Quotation</span>
            </Link>
            <Link
              to="/leads"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <span>Lead Management</span>
            </Link>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <a
              href={tokenStorage.getHandoffUrl(APP_URLS.dashboard)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to FinNexus Connect</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
