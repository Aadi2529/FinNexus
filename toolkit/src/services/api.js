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

// Immediate purge of any lingering persistent tokens from localStorage
const purgePersistentStorage = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(LEGACY_REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
  } catch {
    // Storage access may be restricted
  }
};
purgePersistentStorage();

export const tokenStorage = {
  getAccessToken: () => {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(LEGACY_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  getRefreshToken: () => {
    try {
      return sessionStorage.getItem(REFRESH_KEY) || sessionStorage.getItem(LEGACY_REFRESH_KEY);
    } catch {
      return null;
    }
  },
  getUser: () => {
    try {
      const u = sessionStorage.getItem(USER_KEY) || sessionStorage.getItem(LEGACY_USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
  setTokens: (accessToken, refreshToken, user) => {
    try {
      if (accessToken) {
        sessionStorage.setItem(TOKEN_KEY, accessToken);
        sessionStorage.setItem(LEGACY_TOKEN_KEY, accessToken);
      }
      if (refreshToken) {
        sessionStorage.setItem(REFRESH_KEY, refreshToken);
        sessionStorage.setItem(LEGACY_REFRESH_KEY, refreshToken);
      }
      if (user) {
        sessionStorage.setItem(USER_KEY, JSON.stringify(user));
        sessionStorage.setItem(LEGACY_USER_KEY, JSON.stringify(user));
      }
    } catch {
      // Storage access may be restricted
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(LEGACY_TOKEN_KEY);
      sessionStorage.removeItem(REFRESH_KEY);
      sessionStorage.removeItem(LEGACY_REFRESH_KEY);
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(LEGACY_USER_KEY);
      sessionStorage.removeItem("finnexus_session_start");
      localStorage.removeItem("finnexus_last_activity");
      localStorage.removeItem("finnexus_session_start");
    } catch {
      // Storage access may be restricted
    }
    purgePersistentStorage();
  },
  processSSOFromUrl: () => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has("sso_token") || params.has("refresh_token")) {
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
    const cleanBase = targetAppUrl.replace(/\/+$/, "");
    const cleanPath = targetPath.startsWith("/") ? targetPath : targetPath ? `/${targetPath}` : "";
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
      credentials: "include",
    });

    if (response.status === 401 && !endpoint.includes("/auth/login") && !endpoint.includes("/auth/refresh") && !endpoint.includes("/auth/session")) {
      const refreshToken = tokenStorage.getRefreshToken();

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
            credentials: "include",
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            tokenStorage.setTokens(data.access_token, data.refresh_token, data.user);
            isRefreshing = false;
            onRefreshed(data.access_token);

            headers["Authorization"] = `Bearer ${data.access_token}`;
            response = await fetch(url, { ...options, headers, body, credentials: "include" });
          } else {
            isRefreshing = false;
            tokenStorage.clear();
            return { success: false, status: 401, error: "Session expired" };
          }
        } catch {
          isRefreshing = false;
          tokenStorage.clear();
          return { success: false, status: 401, error: "Session revalidation failed" };
        }
      } else {
        return new Promise((resolve) => {
          subscribeTokenRefresh(async (newToken) => {
            headers["Authorization"] = `Bearer ${newToken}`;
            try {
              const retryRes = await fetch(url, { ...options, headers, body, credentials: "include" });
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
    const refreshToken = tokenStorage.getRefreshToken();
    const res = await request("/auth/logout", {
      method: "POST",
      body: refreshToken ? { refresh_token: refreshToken } : undefined,
    });
    tokenStorage.clear();
    return res;
  },
  getSession: () => request("/auth/session", { method: "GET" }),
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
  processAadhaar: (formData) =>
    request("/toolkit/identity/aadhaar", {
      method: "POST",
      body: formData,
    }),
  processPAN: (formData) =>
    request("/toolkit/identity/pan", {
      method: "POST",
      body: formData,
    }),
  mergePDFs: (formData) =>
    request("/toolkit/pdf/merge", {
      method: "POST",
      body: formData,
    }),
  convertImagesToPDF: (formData) =>
    request("/toolkit/images/to-pdf", {
      method: "POST",
      body: formData,
    }),
  downloadFile: async (downloadUrl, suggestedFilename) => {
    const token = tokenStorage.getAccessToken();
    const fullUrl = downloadUrl.startsWith("http")
      ? downloadUrl
      : `${API_BASE_URL.replace(/\/api\/v1\/?$/, "")}${downloadUrl.startsWith("/") ? "" : "/"}${downloadUrl}`;
    const response = await fetch(fullUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = suggestedFilename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  },
  getPreviewBlobUrl: async (previewUrl) => {
    const token = tokenStorage.getAccessToken();
    const fullUrl = previewUrl.startsWith("http")
      ? previewUrl
      : `${API_BASE_URL.replace(/\/api\/v1\/?$/, "")}${previewUrl.startsWith("/") ? "" : "/"}${previewUrl}`;
    const response = await fetch(fullUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    return window.URL.createObjectURL(blob);
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
  toolkit: toolkitAPI,
  health: healthAPI,
};

export default api;
