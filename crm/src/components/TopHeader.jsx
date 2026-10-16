import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  Bell,
  Check,
  ChevronRight,
  ExternalLink,
  LogOut,
  User as UserIcon,
  Activity,
  Layers,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AppSwitcher from "./AppSwitcher";
import { APP_URLS, crmAPI } from "../services/api";

export default function TopHeader({ setMobileOpen }) {
  const { user, logout, primaryRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await crmAPI.getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [location.pathname]);

  const unreadList = notifications.filter((n) => !n.is_read);

  const handleMarkAllRead = async () => {
    try {
      await crmAPI.markAllNotificationsRead();
      loadNotifications();
    } catch {
      // Ignored
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await crmAPI.markNotificationRead(notif.id);
      }
      setNotifOpen(false);
      if (notif.work_order_id) {
        navigate(`/work-orders/${notif.work_order_id}`);
      } else {
        navigate("/notifications");
      }
    } catch {
      // Ignored
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/work-orders?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = `${APP_URLS.dashboard}/login`;
  };

  // Breadcrumbs builder
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === "/" || path === "/dashboard") return [{ label: "Executive Dashboard", path: "/" }];
    if (path === "/work-orders") return [{ label: "Dashboard", path: "/" }, { label: "Work Orders", path: "/work-orders" }];
    if (path === "/work-orders/new") return [{ label: "Work Orders", path: "/work-orders" }, { label: "New Order", path: "/work-orders/new" }];
    if (path.startsWith("/work-orders/") && path.endsWith("/edit")) {
      return [{ label: "Work Orders", path: "/work-orders" }, { label: "Edit Order", path }];
    }
    if (path.startsWith("/work-orders/")) {
      return [{ label: "Work Orders", path: "/work-orders" }, { label: "Order Details", path }];
    }
    if (path === "/my-tasks") return [{ label: "Dashboard", path: "/" }, { label: "My Tasks", path: "/my-tasks" }];
    if (path === "/history") return [{ label: "Governance", path: "/" }, { label: "Task History", path: "/history" }];
    if (path === "/clients") return [{ label: "Management", path: "/" }, { label: "Client Directory", path: "/clients" }];
    if (path === "/team") return [{ label: "Management", path: "/" }, { label: "Team Roster", path: "/team" }];
    if (path === "/categories") return [{ label: "Catalog", path: "/" }, { label: "Work Categories", path: "/categories" }];
    if (path === "/notifications") return [{ label: "Center", path: "/" }, { label: "In-App Alerts", path: "/notifications" }];
    if (path === "/settings") return [{ label: "System", path: "/" }, { label: "Settings", path: "/settings" }];
    return [{ label: "CRM", path: "/" }];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between shadow-xs">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          title="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
              {idx === breadcrumbs.length - 1 ? (
                <span className="font-semibold text-slate-900">{crumb.label}</span>
              ) : (
                <Link to={crumb.path} className="hover:text-slate-800 transition-colors">
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Middle & Right: Search, Notifications, AppSwitcher, Profile */}
      <div className="flex items-center gap-3">
        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="hidden lg:flex items-center relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search orders, clients, PAN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-60 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400"
          />
        </form>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        {/* Cross-App Switcher */}
        <AppSwitcher currentApp="crm" />

        {/* Notifications Flyout */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadList.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-teal-500 ring-2 ring-white" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Notifications</span>
                  {unreadList.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                      {unreadList.length} new
                    </span>
                  )}
                </div>
                {unreadList.length > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.slice(0, 6).map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition-colors flex items-start gap-2.5 ${
                        !notif.is_read ? "bg-teal-50/40" : ""
                      }`}
                    >
                      <span className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${!notif.is_read ? "bg-teal-500" : "bg-slate-300"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-slate-900 truncate ${!notif.is_read ? "font-bold" : ""}`}>
                          {notif.title}
                        </p>
                        <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                          {notif.message}
                        </p>
                        <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                          {new Date(notif.created_at).toLocaleDateString()} &bull; {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                <Link
                  to="/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center justify-center gap-1"
                >
                  <span>View all notifications</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800 leading-none truncate max-w-[110px]">
                {user?.full_name || "Enterprise User"}
              </span>
              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                {primaryRole || user?.role || "EMPLOYEE"}
              </span>
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900">{user?.full_name}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 rounded-full font-mono">
                    {primaryRole || user?.role || "EMPLOYEE"}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active Session
                  </span>
                </div>
              </div>

              <div className="py-1">
                <Link
                  to="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Workspace Preferences</span>
                </Link>
                <a
                  href="http://localhost:8000/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                  <span>FastAPI Swagger Docs</span>
                </a>
              </div>

              <div className="border-t border-slate-100 pt-1 mt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors font-medium text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out of Platform</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
