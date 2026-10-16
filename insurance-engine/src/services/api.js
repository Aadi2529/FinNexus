/**
 * Centralized API & SSO Client for FinNexus Enterprise Platform.
 * Supports cross-app SSO token handoff, automatic refresh token rotation, and standardized API envelopes.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export const APP_URLS = {
  dashboard: import.meta.env.VITE_DASHBOARD_URL || "http://localhost:5173",
  crm: import.meta.env.VITE_CRM_URL || "http://localhost:5174",
  toolkit: import.meta.env.VITE_TOOLKIT_URL || "http://localhost:5175",
  insurance: import.meta.env.VITE_INSURANCE_URL || "http://localhost:5176",
};

const TOKEN_KEY = "finnexus_access_token";
const LEGACY_TOKEN_KEY = "financeflow_access_token";
const REFRESH_KEY = "finnexus_refresh_token";
const LEGACY_REFRESH_KEY = "financeflow_refresh_token";
const USER_KEY = "finnexus_user";
const LEGACY_USER_KEY = "financeflow_user";

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY) || localStorage.getItem(LEGACY_REFRESH_KEY),
  getUser: () => {
    try {
      const u = localStorage.getItem(USER_KEY) || localStorage.getItem(LEGACY_USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
  setTokens: (accessToken, refreshToken, user) => {
    if (accessToken) {
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(LEGACY_TOKEN_KEY, accessToken);
    }
    if (refreshToken) {
      localStorage.setItem(REFRESH_KEY, refreshToken);
      localStorage.setItem(LEGACY_REFRESH_KEY, refreshToken);
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(LEGACY_USER_KEY, JSON.stringify(user));
    }
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(LEGACY_REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
  },
  processSSOFromUrl: () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ssoToken = params.get("sso_token");
      const refreshToken = params.get("refresh_token");

      if (ssoToken) {
        localStorage.setItem(TOKEN_KEY, ssoToken);
        localStorage.setItem(LEGACY_TOKEN_KEY, ssoToken);
        if (refreshToken) {
          localStorage.setItem(REFRESH_KEY, refreshToken);
          localStorage.setItem(LEGACY_REFRESH_KEY, refreshToken);
        }

        params.delete("sso_token");
        params.delete("refresh_token");
        const remainingQuery = params.toString() ? `?${params.toString()}` : "";
        window.history.replaceState(
          {},
          document.title,
          `${window.location.pathname}${remainingQuery}${window.location.hash}`
        );
        return true;
      }
    } catch {
      // Ignored
    }
    return false;
  },
  getHandoffUrl: (targetAppUrl, targetPath = "") => {
    const token = tokenStorage.getAccessToken();
    const refresh = tokenStorage.getRefreshToken();
    const cleanBase = targetAppUrl.replace(/\/+$/, "");
    const cleanPath = targetPath.startsWith("/") ? targetPath : targetPath ? `/${targetPath}` : "";
    
    if (token) {
      const sep = cleanPath.includes("?") ? "&" : "?";
      return `${cleanBase}${cleanPath}${sep}sso_token=${encodeURIComponent(token)}${refresh ? `&refresh_token=${encodeURIComponent(refresh)}` : ""}`;
    }
    return `${cleanBase}${cleanPath}`;
  },
};

tokenStorage.processSSOFromUrl();

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const token = tokenStorage.getAccessToken();
  const headers = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  let body = options.body;
  if (body && typeof body === "object" && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  try {
    let response = await fetch(url, {
      ...options,
      headers,
      body,
    });

    if (response.status === 401 && !endpoint.includes("/auth/login") && !endpoint.includes("/auth/refresh")) {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        tokenStorage.clear();
        return { success: false, status: 401, error: "Session expired" };
      }

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            tokenStorage.setTokens(data.access_token, data.refresh_token, data.user);
            isRefreshing = false;
            onRefreshed(data.access_token);

            headers["Authorization"] = `Bearer ${data.access_token}`;
            response = await fetch(url, { ...options, headers, body });
          } else {
            isRefreshing = false;
            tokenStorage.clear();
            return { success: false, status: 401, error: "Refresh token expired" };
          }
        } catch (err) {
          isRefreshing = false;
          tokenStorage.clear();
          return { success: false, status: 401, error: "Session revalidation failed" };
        }
      } else {
        return new Promise((resolve) => {
          subscribeTokenRefresh(async (newToken) => {
            headers["Authorization"] = `Bearer ${newToken}`;
            try {
              const retryRes = await fetch(url, { ...options, headers, body });
              const retryData = await retryRes.json();
              resolve({ success: retryRes.ok, status: retryRes.status, data: retryData });
            } catch (err) {
              resolve({ success: false, error: err.message });
            }
          });
        });
      }
    }

    const contentType = response.headers.get("content-type");
    let data = null;
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      let errorMsg = "An unexpected error occurred.";
      if (data && typeof data === "object") {
        if (data.detail) {
          errorMsg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        } else if (data.message) {
          errorMsg = data.message;
        }
      }
      return { success: false, ok: false, status: response.status, error: errorMsg, raw: data };
    }

    return { success: true, ok: true, status: response.status, data };
  } catch (err) {
    return {
      success: false,
      ok: false,
      status: 0,
      error: err.message || "Network error. Please verify the backend is running.",
    };
  }
}

export const authAPI = {
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  logout: async () => {
    const res = await request("/auth/logout", { method: "POST" });
    tokenStorage.clear();
    return res;
  },
  getCurrentUser: () => request("/auth/me", { method: "GET" }),
};

export const crmAPI = {
  getStats: () => request("/crm/stats"),
  getCustomers: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.append("search", params.search);
    if (params.status) q.append("status", params.status);
    if (params.limit) q.append("limit", params.limit);
    if (params.offset) q.append("offset", params.offset);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/crm/customers${qs}`);
  },
  getCustomerDetail: (id) => request(`/crm/customers/${id}`),
  createCustomer: (data) => request("/crm/customers", { method: "POST", body: data }),
  updateCustomer: (id, data) => request(`/crm/customers/${id}`, { method: "PUT", body: data }),
  addCustomerNote: (id, content) =>
    request(`/crm/customers/${id}/notes`, { method: "POST", body: { content } }),
  createTask: (id, taskData) =>
    request(`/crm/customers/${id}/tasks`, { method: "POST", body: taskData }),
  updateTaskStatus: (taskId, status) =>
    request(`/crm/tasks/${taskId}`, { method: "PATCH", body: { status } }),
};

export const toolkitAPI = {
  calculateEMI: (principal, annual_rate, tenure_months) =>
    request("/toolkit/calculator/emi", {
      method: "POST",
      body: { principal, annual_rate, tenure_months },
    }),
  calculateSIP: (monthly_investment, annual_return_rate, years) =>
    request("/toolkit/calculator/sip", {
      method: "POST",
      body: { monthly_investment, annual_return_rate, years },
    }),
  verifyPAN: (pan_number) =>
    request("/toolkit/documents/verify-pan", {
      method: "POST",
      body: { pan_number },
    }),
  getDocuments: () => request("/toolkit/documents"),
  uploadDocument: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/toolkit/documents/upload", {
      method: "POST",
      body: formData,
    });
  },
};

export const insuranceAPI = {
  getProducts: () => request("/insurance/products"),
  calculateQuote: (data) =>
    request("/insurance/quotes/calculate", {
      method: "POST",
      body: data,
    }),
  getPolicies: () => request("/insurance/policies"),
  bindPolicy: (data) =>
    request("/insurance/policies/bind", {
      method: "POST",
      body: data,
    }),
  renewPolicy: (policy_id) =>
    request("/insurance/policies/renew", {
      method: "POST",
      body: { policy_id },
    }),
  getStats: () => request("/insurance/stats"),
};

export const healthAPI = {
  getLiveness: () => request("/health/live"),
  getReadiness: () => request("/health/ready"),
};

export const api = {
  auth: authAPI,
  insurance: insuranceAPI,
  health: healthAPI,
};

export default api;
