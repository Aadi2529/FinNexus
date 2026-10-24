import React, { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  CheckCircle2,
  History,
  Users,
  UserCheck,
  FolderTree,
  Bell,
  Sliders,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { APP_URLS, crmAPI } from "../services/api";

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { user, isAdmin, primaryRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const notifs = await crmAPI.getNotifications(true);
        if (isMounted) setUnreadCount(Array.isArray(notifs) ? notifs.length : 0);
      } catch {
        // Ignored
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [location.pathname]);

  const navGroups = [
    {
      group: "Operations",
      items: [
        { label: "Dashboard", path: "/", icon: LayoutDashboard },
        { label: "Work Orders", path: "/work-orders", icon: ClipboardList },
        { label: "My Tasks", path: "/my-tasks", icon: CheckCircle2 },
        ...(isAdmin
          ? [{ label: "Task History", path: "/history", icon: History }]
          : []),
      ],
    },
    {
      group: "Management",
      items: [
        { label: "Client Directory", path: "/clients", icon: Users },
        { label: "Team Roster", path: "/team", icon: UserCheck },
        { label: "Work Categories", path: "/categories", icon: FolderTree },
        {
          label: "In-App Alerts",
          path: "/notifications",
          icon: Bell,
          badge: unreadCount > 0 ? unreadCount : null,
        },
        { label: "Settings", path: "/settings", icon: Sliders },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col transition-all duration-300 ease-in-out shrink-0 select-none ${
          collapsed ? "w-20" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3 overflow-hidden">
            <Link to={APP_URLS.dashboard} onClick={() => setCollapsed(false)}>
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs ring-1 ring-teal-400/30">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            </Link>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                  FinNexus <span className="text-[10px] uppercase font-bold text-teal-400 bg-teal-950/80 px-1.5 py-0.5 rounded border border-teal-800/80">CRM</span>
                </span>
                <span className="text-[10px] text-slate-400 tracking-wider uppercase font-medium">
                  Work Orders & Tasks
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Quick Action Button */}
        <div className="p-3">
          <button
            onClick={() => {
              navigate("/work-orders/new");
              if (mobileOpen) setMobileOpen(false);
            }}
            className={`w-full py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all duration-150 active:scale-95 ${
              collapsed ? "px-0" : ""
            }`}
            title="Create Work Order"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            {!collapsed && <span>New Work Order</span>}
          </button>
        </div>

        {/* Nav Links */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!collapsed && (
                <div className="px-3 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  {group.group}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.path === "/"
                    ? location.pathname === "/" || location.pathname === "/dashboard"
                    : location.pathname.startsWith(item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      if (mobileOpen) setMobileOpen(false);
                    }}
                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-slate-800 text-teal-400 font-semibold shadow-xs"
                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                    } ${collapsed ? "justify-center px-0" : ""}`}
                    title={collapsed ? item.label : undefined}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-teal-500" />
                    )}
                    <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? "text-teal-400" : "text-slate-400"}`} />
                    {!collapsed && (
                      <span className="flex-1 truncate">{item.label}</span>
                    )}
                    {!collapsed && item.badge && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Card & System Status */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/30">
          <div className={`flex items-center gap-3 p-2 rounded-xl bg-slate-800/40 border border-slate-800 ${collapsed ? "justify-center p-1.5" : ""}`}>
            <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {user?.full_name || "Operator"}
                </span>
                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-teal-400" /> {primaryRole || user?.role || "EMPLOYEE"}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
