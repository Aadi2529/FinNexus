import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  RefreshCw,
  ExternalLink,
  Clock,
  Briefcase,
  AlertCircle,
  Inbox,
  ArrowRight,
} from "lucide-react";
import { crmAPI } from "../services/api";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await crmAPI.getNotifications(unreadOnly);
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [unreadOnly]);

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await crmAPI.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      // Ignored
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await crmAPI.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // Ignored
    }
  };

  const handleCardClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await crmAPI.markNotificationRead(notif.id);
      } catch {
        // Ignored
      }
    }
    if (notif.work_order_id) {
      navigate(`/work-orders/${notif.work_order_id}`);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Notification Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational alerts, task assignments, deadline escalations, and status notices.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-2 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all as read</span>
            </button>
          )}

          <button
            onClick={fetchNotifications}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
            title="Refresh Alerts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/90 pb-px">
        <button
          onClick={() => setUnreadOnly(false)}
          className={`px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-all ${
            !unreadOnly
              ? "border-teal-600 text-teal-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          All Alerts ({notifications.length})
        </button>
        <button
          onClick={() => setUnreadOnly(true)}
          className={`px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-all flex items-center gap-1.5 ${
            unreadOnly
              ? "border-teal-600 text-teal-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Unread Only</span>
          {unreadCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-teal-500 text-white font-bold text-[10px] flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200 p-8">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700 text-sm">No notifications</p>
            <p className="text-slate-500 mt-0.5">You are up to date on all work order assignments.</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const isUnread = !notif.is_read;

            return (
              <div
                key={notif.id}
                onClick={() => handleCardClick(notif)}
                className={`p-4 rounded-2xl border transition-all duration-150 cursor-pointer flex items-start justify-between gap-4 ${
                  isUnread
                    ? "bg-teal-50/30 border-teal-200/90 shadow-2xs hover:border-teal-300"
                    : "bg-white border-slate-200/80 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isUnread
                        ? "bg-teal-500 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className={`text-xs font-bold text-slate-900 ${isUnread ? "text-teal-950 font-bold" : ""}`}>
                        {notif.title}
                      </h2>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-teal-500" title="Unread" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {notif.message}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                      <span>{new Date(notif.created_at).toLocaleDateString()}</span>
                      <span>&bull;</span>
                      <span>{new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {notif.work_order_id && (
                        <>
                          <span>&bull;</span>
                          <span className="text-teal-600 font-semibold flex items-center gap-1 hover:underline">
                            View Order Details &rarr;
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {isUnread && (
                  <button
                    onClick={(e) => handleMarkAsRead(notif.id, e)}
                    className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors shrink-0"
                    title="Mark as Read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
