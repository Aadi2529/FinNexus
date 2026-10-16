import React, { createContext, useContext, useState, useEffect } from "react";
import { authAPI, tokenStorage, APP_URLS } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(tokenStorage.getUser());
  const [token, setToken] = useState(tokenStorage.getAccessToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initSession() {
      tokenStorage.processSSOFromUrl();
      const storedToken = tokenStorage.getAccessToken();

      if (storedToken) {
        setToken(storedToken);
        const res = await authAPI.getCurrentUser();
        if (res.success && res.data) {
          setUser(res.data);
          tokenStorage.setTokens(storedToken, tokenStorage.getRefreshToken(), res.data);
        } else if (res.status === 401) {
          tokenStorage.clear();
          setUser(null);
          setToken(null);
        }
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    }

    initSession();
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login(email, password);
    if (res.success && res.data) {
      const { access_token, refresh_token, user: loggedUser } = res.data;
      tokenStorage.setTokens(access_token, refresh_token, loggedUser);
      setToken(access_token);
      setUser(loggedUser);
      return { success: true };
    }
    return { success: false, error: res.error || "Authentication failed." };
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch {
      // Clean local storage even if backend fails
    }
    tokenStorage.clear();
    setUser(null);
    setToken(null);
  };

  const redirectToDashboardLogin = () => {
    window.location.href = `${APP_URLS.dashboard}/login?redirect=${encodeURIComponent(window.location.href)}`;
  };

  const userRoles = Array.isArray(user?.roles)
    ? user.roles
    : user?.role
    ? [user.role]
    : [];
  const isSuperAdmin =
    user?.role === "SUPER_ADMIN" || userRoles.includes("SUPER_ADMIN");
  const isAdmin = isSuperAdmin || user?.role === "ADMIN" || userRoles.includes("ADMIN");
  const isEmployee = !isAdmin;
  const primaryRole = isSuperAdmin
    ? "SUPER_ADMIN"
    : isAdmin
    ? "ADMIN"
    : userRoles[0] || user?.role || "EMPLOYEE";

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
