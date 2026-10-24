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

async function crmRequest(endpoint, options = {}) {
  const res = await request(endpoint, options);
  if (!res.success) {
    const err = new Error(res.error || "CRM API request failed.");
    err.status = res.status;
    err.raw = res.raw;
    throw err;
  }
  return res.data;
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
  getUsers: () => request("/auth/users", { method: "GET" }),
  registerUser: (userData) => request("/auth/register", { method: "POST", body: userData }),
  updateUser: (userId, data) => request(`/auth/users/${userId}`, { method: "PATCH", body: data }),
  deleteUser: (userId) => request(`/auth/users/${userId}`, { method: "DELETE" }),
};

export const crmAPI = {
  getTeam: () => crmRequest("/crm/team"),
  getStats: () => crmRequest("/crm/stats"),
  getDashboard: () => crmRequest("/crm/dashboard"),
  getWorkOrders: (params = {}) => {
    const q = new URLSearchParams();
    if (params.q || params.search) q.append("q", params.q || params.search);
    if (params.status) q.append("status", params.status);
    if (params.priority) q.append("priority", params.priority);
    if (params.category_id) q.append("category_id", params.category_id);
    if (params.assigned_to_id) q.append("assigned_to_id", params.assigned_to_id);
    if (params.my_tasks) q.append("my_tasks", "true");
    if (params.skip !== undefined) q.append("skip", params.skip);
    if (params.limit !== undefined) q.append("limit", params.limit);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return crmRequest(`/crm/work-orders${qs}`);
  },
  getWorkOrder: (id) => crmRequest(`/crm/work-orders/${id}`),
  createWorkOrder: (data) =>
    crmRequest("/crm/work-orders", { method: "POST", body: data }),
  updateWorkOrder: (id, data) =>
    crmRequest(`/crm/work-orders/${id}`, { method: "PUT", body: data }),
  updateWorkOrderStatus: (id, data) =>
    crmRequest(`/crm/work-orders/${id}/status`, { method: "PATCH", body: data }),
  deleteWorkOrder: (id, permanent = false) =>
    crmRequest(`/crm/work-orders/${id}${permanent ? "?permanent=true" : ""}`, {
      method: "DELETE",
    }),
  addChecklistItem: (workOrderId, data) =>
    crmRequest(`/crm/work-orders/${workOrderId}/checklist`, {
      method: "POST",
      body: data,
    }),
  updateChecklistItem: (workOrderId, itemId, data) =>
    crmRequest(`/crm/work-orders/${workOrderId}/checklist/${itemId}`, {
      method: "PATCH",
      body: data,
    }),
  getWorkOrderHistory: (id) => crmRequest(`/crm/work-orders/${id}/history`),
  getGlobalHistory: (params = {}) => {
    const q = new URLSearchParams();
    if (params.action) q.append("action", params.action);
    if (params.skip !== undefined) q.append("skip", params.skip);
    if (params.limit !== undefined) q.append("limit", params.limit);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return crmRequest(`/crm/history${qs}`);
  },
  getCategories: (activeOnly = true) =>
    crmRequest(`/crm/categories?active_only=${activeOnly}`),
  createCategory: (data) =>
    crmRequest("/crm/categories", { method: "POST", body: data }),
  updateCategory: (id, data) =>
    crmRequest(`/crm/categories/${id}`, { method: "PUT", body: data }),
  deleteCategory: (id) =>
    crmRequest(`/crm/categories/${id}`, { method: "DELETE" }),
  getTeam: () => crmRequest("/crm/team"),
  getNotifications: (unreadOnly = false) =>
    crmRequest(`/crm/notifications?unread_only=${unreadOnly}`),
  markNotificationRead: (id) =>
    crmRequest(`/crm/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () =>
    crmRequest("/crm/notifications/mark-all-read", { method: "POST" }),
  getClients: (params = {}) => {
    const q = new URLSearchParams();
    if (params.q || params.search) q.append("q", params.q || params.search);
    if (params.pipeline_status || params.status)
      q.append("pipeline_status", params.pipeline_status || params.status);
    if (params.is_archived !== undefined && params.is_archived !== null)
      q.append("is_archived", params.is_archived ? "true" : "false");
    if (params.page !== undefined) q.append("page", params.page);
    if (params.page_size !== undefined) q.append("page_size", params.page_size);
    if (params.skip !== undefined) q.append("skip", params.skip);
    if (params.limit !== undefined) q.append("limit", params.limit);
    if (params.paginate !== undefined)
      q.append("paginate", params.paginate ? "true" : "false");
    const qs = q.toString() ? `?${q.toString()}` : "";
    return crmRequest(`/crm/clients${qs}`);
  },
  searchClients: (q) =>
    crmRequest(`/crm/clients/search?q=${encodeURIComponent(q)}`),
  getClientSummary: () => crmRequest("/crm/clients/summary"),
  getCustomers: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search || params.q) q.append("q", params.search || params.q);
    if (params.status || params.pipeline_status)
      q.append("pipeline_status", params.status || params.pipeline_status);
    if (params.page !== undefined) q.append("page", params.page);
    if (params.page_size !== undefined) q.append("page_size", params.page_size);
    if (params.limit) q.append("limit", params.limit);
    if (params.offset || params.skip)
      q.append("skip", params.offset || params.skip);
    if (params.paginate !== undefined)
      q.append("paginate", params.paginate ? "true" : "false");
    const qs = q.toString() ? `?${q.toString()}` : "";
    return crmRequest(`/crm/customers${qs}`);
  },
  getCustomerDetail: (id) => crmRequest(`/crm/customers/${id}`),
  getClientDetail: (id) => crmRequest(`/crm/clients/${id}`),
  createCustomer: (data) =>
    crmRequest("/crm/customers", { method: "POST", body: data }),
  createClient: (data) =>
    crmRequest("/crm/clients", { method: "POST", body: data }),
  updateCustomer: (id, data) =>
    crmRequest(`/crm/customers/${id}`, { method: "PUT", body: data }),
  updateClient: (id, data) =>
    crmRequest(`/crm/clients/${id}`, { method: "PUT", body: data }),
  archiveClient: (id) =>
    crmRequest(`/crm/clients/${id}/archive`, { method: "POST" }),
  restoreClient: (id) =>
    crmRequest(`/crm/clients/${id}/restore`, { method: "POST" }),
  getClientHistory: (id) => crmRequest(`/crm/clients/${id}/history`),
  getClientWorkOrders: (id) => crmRequest(`/crm/clients/${id}/work-orders`),
  assignWorkOrder: (id, assigned_to_id) =>
    crmRequest(`/crm/work-orders/${id}/assignments`, {
      method: "POST",
      body: { assigned_to_id },
    }),
  getEligibleAssignees: () => crmRequest("/crm/users/eligible-assignees"),
  deleteCustomer: (id) =>
    crmRequest(`/crm/customers/${id}`, { method: "DELETE" }),
  deleteClient: (id) =>
    crmRequest(`/crm/clients/${id}`, { method: "DELETE" }),
  addCustomerNote: (id, content) =>
    crmRequest(`/crm/customers/${id}/notes`, { method: "POST", body: { content } }),
  addNote: (id, content) =>
    crmRequest(`/crm/customers/${id}/notes`, { method: "POST", body: { content } }),
  createTask: (id, taskData) =>
    crmRequest(`/crm/customers/${id}/tasks`, { method: "POST", body: taskData }),
  addTask: (id, taskData) =>
    crmRequest(`/crm/customers/${id}/tasks`, { method: "POST", body: taskData }),
  updateTaskStatus: (taskId, status) =>
    crmRequest(`/crm/tasks/${taskId}`, { method: "PATCH", body: { status } }),
  updateTask: (taskId, taskData) =>
    crmRequest(`/crm/tasks/${taskId}`, { method: "PATCH", body: taskData }),
  deleteTask: (taskId) =>
    crmRequest(`/crm/tasks/${taskId}`, { method: "DELETE" }),
  getTask: (taskId) =>
    crmRequest(`/crm/tasks/${taskId}`),
  getCustomer: (id) =>
    crmRequest(`/crm/customers/${id}`),
  getClient: (id) =>
    crmRequest(`/crm/clients/${id}`),
  getStats: () =>
    crmRequest("/crm/stats"),
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
  crm: crmAPI,
  toolkit: toolkitAPI,
  insurance: insuranceAPI,
  health: healthAPI,
};

export default api;

