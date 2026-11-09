import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2, X } from "lucide-react";

const NotificationContext = createContext(null);

export const NOTIFICATION_TYPES = {
  SUCCESS: "success",
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
  LOADING: "loading",
};

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addNotification = useCallback(
    ({ type = NOTIFICATION_TYPES.INFO, title, message, duration, persistent = false, id }) => {
      const toastId = id || `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // De-duplicate if identical message is already in stack
      setNotifications((prev) => {
        const isDuplicate = prev.some((n) => n.message === message && n.type === type);
        if (isDuplicate) return prev;

        const newNotification = {
          id: toastId,
          type,
          title,
          message,
          persistent,
          timestamp: Date.now(),
        };

        return [newNotification, ...prev].slice(0, 5); // Keep at most 5 stacked
      });

      // Automatic dismissal
      if (!persistent && type !== NOTIFICATION_TYPES.LOADING) {
        let timeoutMs = duration;
        if (!timeoutMs) {
          if (type === NOTIFICATION_TYPES.ERROR) timeoutMs = 8500;
          else if (type === NOTIFICATION_TYPES.WARNING) timeoutMs = 6500;
          else timeoutMs = 4500; // SUCCESS or INFO
        }

        if (timersRef.current[toastId]) {
          clearTimeout(timersRef.current[toastId]);
        }

        timersRef.current[toastId] = setTimeout(() => {
          dismiss(toastId);
        }, timeoutMs);
      }

      return toastId;
    },
    [dismiss]
  );

  const showSuccess = useCallback(
    (message, options = {}) =>
      addNotification({
        type: NOTIFICATION_TYPES.SUCCESS,
        title: options.title || "Success",
        message,
        ...options,
      }),
    [addNotification]
  );

  const showError = useCallback(
    (message, options = {}) =>
      addNotification({
        type: NOTIFICATION_TYPES.ERROR,
        title: options.title || "Action Failed",
        message: typeof message === "string" ? message : (message?.message || "An unexpected error occurred."),
        ...options,
      }),
    [addNotification]
  );

  const showWarning = useCallback(
    (message, options = {}) =>
      addNotification({
        type: NOTIFICATION_TYPES.WARNING,
        title: options.title || "Attention Required",
        message,
        ...options,
      }),
    [addNotification]
  );

  const showInfo = useCallback(
    (message, options = {}) =>
      addNotification({
        type: NOTIFICATION_TYPES.INFO,
        title: options.title || "Notification",
        message,
        ...options,
      }),
    [addNotification]
  );

  const showLoading = useCallback(
    (message = "Processing request...", options = {}) =>
      addNotification({
        type: NOTIFICATION_TYPES.LOADING,
        title: options.title || "Please wait",
        message,
        persistent: true,
        ...options,
      }),
    [addNotification]
  );

  return (
    <NotificationContext.Provider
      value={{
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showLoading,
        dismiss,
      }}
    >
      {children}

      {/* Global Fixed Viewport Toast Container (scroll-independent) */}
      <div
        className="fixed top-4 right-4 left-4 sm:left-auto z-[99999] pointer-events-none flex flex-col gap-2.5 max-w-md sm:w-96 select-none"
        aria-live="polite"
        role="region"
        aria-label="Notifications"
      >
        {notifications.map((n) => {
          let bgClass = "bg-white border-slate-200 text-slate-800 shadow-xl";
          let icon = <Info className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />;
          let accentBar = "bg-sky-500";

          if (n.type === NOTIFICATION_TYPES.SUCCESS) {
            bgClass = "bg-emerald-950/95 border-emerald-500/30 text-emerald-100 shadow-emerald-950/40 shadow-xl backdrop-blur-md";
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />;
            accentBar = "bg-emerald-400";
          } else if (n.type === NOTIFICATION_TYPES.ERROR) {
            bgClass = "bg-rose-950/95 border-rose-500/30 text-rose-100 shadow-rose-950/40 shadow-xl backdrop-blur-md";
            icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />;
            accentBar = "bg-rose-400";
          } else if (n.type === NOTIFICATION_TYPES.WARNING) {
            bgClass = "bg-amber-950/95 border-amber-500/30 text-amber-100 shadow-amber-950/40 shadow-xl backdrop-blur-md";
            icon = <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />;
            accentBar = "bg-amber-400";
          } else if (n.type === NOTIFICATION_TYPES.LOADING) {
            bgClass = "bg-slate-900/95 border-indigo-500/30 text-slate-100 shadow-slate-950/40 shadow-xl backdrop-blur-md";
            icon = <Loader2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5 animate-spin" />;
            accentBar = "bg-indigo-400";
          } else {
            bgClass = "bg-slate-900/95 border-cyan-500/30 text-slate-100 shadow-slate-950/40 shadow-xl backdrop-blur-md";
            icon = <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />;
            accentBar = "bg-cyan-400";
          }

          return (
            <div
              key={n.id}
              className={`pointer-events-auto relative overflow-hidden rounded-xl border p-4 transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-3 ${bgClass}`}
              role="alert"
            >
              <div className={`absolute top-0 left-0 bottom-0 w-1 ${accentBar}`} />
              <div className="flex items-start gap-3 pl-1">
                {icon}
                <div className="flex-1 min-w-0 pr-2">
                  {n.title && (
                    <h4 className="text-xs font-bold tracking-wide uppercase opacity-90 mb-0.5">
                      {n.title}
                    </h4>
                  )}
                  <p className="text-xs leading-relaxed font-medium break-words">
                    {n.message}
                  </p>
                </div>
                {n.type !== NOTIFICATION_TYPES.LOADING && (
                  <button
                    onClick={() => dismiss(n.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    aria-label="Close notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    // Graceful fallback if invoked outside provider
    return {
      showSuccess: (msg) => console.log("[Notification: Success]", msg),
      showError: (msg) => console.error("[Notification: Error]", msg),
      showWarning: (msg) => console.warn("[Notification: Warning]", msg),
      showInfo: (msg) => console.info("[Notification: Info]", msg),
      showLoading: (msg) => console.log("[Notification: Loading]", msg),
      dismiss: () => {},
    };
  }
  return context;
}

export default NotificationContext;
