import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { authAPI, tokenStorage, APP_URLS } from "../services/api";

const AuthContext = createContext(null);

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity
const MAX_SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000; // 8 hours absolute limit

export function AuthProvider({ children }) {
  const [user, setUser] = useState(tokenStorage.getUser());
  const [token, setToken] = useState(tokenStorage.getAccessToken());
  const [loading, setLoading] = useState(true);
  const [sessionReason, setSessionReason] = useState(null);
  const isLoggingOut = useRef(false);

  const redirectToDashboardLogin = useCallback((reason = null) => {
    const reasonParam = reason ? `?reason=${encodeURIComponent(reason)}` : "";
    const redirectParam = encodeURIComponent(window.location.href);
    const sep = reasonParam ? "&" : "?";
    window.location.href = `${APP_URLS.dashboard}/login${reasonParam}${sep}redirect=${redirectParam}`;
  }, []);

  const logout = useCallback(async (reason = null) => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;
    if (reason) setSessionReason(reason);

    try {
      await authAPI.logout();
    } catch {
      // Backend may be offline; guarantee local eviction
    }

    tokenStorage.clear();
    try {
      localStorage.setItem("finnexus_logout_event", Date.now().toString());
    } catch {
      // Storage access may be restricted
    }

    setUser(null);
    setToken(null);
    isLoggingOut.current = false;

    redirectToDashboardLogin(reason);
  }, [redirectToDashboardLogin]);

  // Initial session verification & cookie-based session recovery
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      tokenStorage.processSSOFromUrl();
      const storedToken = tokenStorage.getAccessToken();

      if (storedToken) {
        setToken(storedToken);
        const res = await authAPI.getCurrentUser();
        if (!isMounted) return;

        if (res.success && res.data) {
          setUser(res.data);
          tokenStorage.setTokens(storedToken, tokenStorage.getRefreshToken(), res.data);
        } else if (res.status === 401) {
          tokenStorage.clear();
          setUser(null);
          setToken(null);
        }
      } else {
        // Attempt recovery from secure browser-session cookie (/auth/session)
        const sessionRes = await authAPI.getSession();
        if (!isMounted) return;

        if (sessionRes.success && sessionRes.data) {
          const { access_token, refresh_token, user: sessionUser } = sessionRes.data;
          tokenStorage.setTokens(access_token, refresh_token, sessionUser);
          setToken(access_token);
          setUser(sessionUser);

          const startTs = Date.now().toString();
          if (!sessionStorage.getItem("finnexus_session_start")) {
            sessionStorage.setItem("finnexus_session_start", startTs);
            try {
              localStorage.setItem("finnexus_session_start", startTs);
              localStorage.setItem("finnexus_last_activity", startTs);
            } catch {
              // Ignore storage errors
            }
          }
        } else {
          tokenStorage.clear();
          setUser(null);
          setToken(null);
        }
      }
      if (isMounted) setLoading(false);
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Inactivity and absolute maximum lifetime monitoring
  useEffect(() => {
    if (!token || !user) return;

    const now = Date.now();
    let sessionStart = parseInt(sessionStorage.getItem("finnexus_session_start") || "0", 10);
    if (!sessionStart) {
      sessionStart = parseInt(localStorage.getItem("finnexus_session_start") || "0", 10) || now;
      sessionStorage.setItem("finnexus_session_start", sessionStart.toString());
      try {
        localStorage.setItem("finnexus_session_start", sessionStart.toString());
      } catch {
        // Ignore storage errors
      }
    }

    try {
      if (!localStorage.getItem("finnexus_last_activity")) {
        localStorage.setItem("finnexus_last_activity", now.toString());
      }
    } catch {
      // Ignore storage errors
    }

    let lastThrottleWrite = 0;
    const registerActivity = () => {
      const current = Date.now();
      // Throttle writes to at most once every 5 seconds
      if (current - lastThrottleWrite > 5000) {
        lastThrottleWrite = current;
        try {
          localStorage.setItem("finnexus_last_activity", current.toString());
        } catch {
          // Ignore storage errors
        }
      }
    };

    // Track appropriate user inputs: keyboard, pointer, and touch
    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    activityEvents.forEach((evt) => window.addEventListener(evt, registerActivity, { passive: true }));

    // Periodic timer checking every 10 seconds
    const intervalTimer = setInterval(() => {
      const current = Date.now();
      const lastActivity = parseInt(localStorage.getItem("finnexus_last_activity") || current.toString(), 10);
      const start = parseInt(sessionStorage.getItem("finnexus_session_start") || current.toString(), 10);

      // Check 15-minute inactivity timeout
      if (current - lastActivity >= INACTIVITY_TIMEOUT_MS) {
        logout("inactivity");
        return;
      }

      // Check 8-hour maximum session lifetime
      if (current - start >= MAX_SESSION_LIFETIME_MS) {
        logout("absolute_timeout");
        return;
      }
    }, 10000);

    // Cross-tab synchronization via storage events
    const handleStorageChange = (e) => {
      if (e.key === "finnexus_logout_event") {
        tokenStorage.clear();
        setUser(null);
        setToken(null);
        redirectToDashboardLogin("remote_logout");
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Check timeouts immediately when switching back to this tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const current = Date.now();
        const lastActivity = parseInt(localStorage.getItem("finnexus_last_activity") || current.toString(), 10);
        const start = parseInt(sessionStorage.getItem("finnexus_session_start") || current.toString(), 10);

        if (current - lastActivity >= INACTIVITY_TIMEOUT_MS) {
          logout("inactivity");
        } else if (current - start >= MAX_SESSION_LIFETIME_MS) {
          logout("absolute_timeout");
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, registerActivity));
      clearInterval(intervalTimer);
      window.removeEventListener("storage", handleStorageChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [token, user, logout, redirectToDashboardLogin]);

  const login = async (email, password) => {
    const res = await authAPI.login(email, password);
    if (res.success && res.data) {
      const { access_token, refresh_token, user: loggedUser } = res.data;
      tokenStorage.setTokens(access_token, refresh_token, loggedUser);
      const startTs = Date.now().toString();
      sessionStorage.setItem("finnexus_session_start", startTs);
      try {
        localStorage.setItem("finnexus_session_start", startTs);
        localStorage.setItem("finnexus_last_activity", startTs);
      } catch {
        // Ignore storage errors
      }
      setToken(access_token);
      setUser(loggedUser);
      return { success: true };
    }
    return { success: false, error: res.error || "Authentication failed." };
  };

  const userRoles = Array.isArray(user?.roles)
    ? user.roles
    : user?.role
    ? [user.role]
    : [];
  const isSuperAdmin = userRoles.includes("SUPER_ADMIN");
  const isAdmin = isSuperAdmin || userRoles.includes("ADMIN");
  const isEmployee = !isAdmin;
  const primaryRole = isSuperAdmin
    ? "SUPER_ADMIN"
    : isAdmin
    ? "ADMIN"
    : userRoles[0] || "EMPLOYEE";

  const value = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    userRoles,
    isSuperAdmin,
    isAdmin,
    isEmployee,
    primaryRole,
    loading,
    sessionReason,
    login,
    logout,
    redirectToDashboardLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
