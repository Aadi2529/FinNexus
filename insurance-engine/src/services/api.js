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
};

export const insuranceAPI = {
  // Dashboard & Metrics
  getDashboardMetrics: () => request("/insurance/dashboard/stats"),
  getStats: () => request("/insurance/stats"),

  // Category Master & Taxonomies
  getCategories: () => request("/insurance/categories"),
  getCompanyTypes: () => request("/insurance/company-types"),

  // Company Master (Add / Manage Company)
  getCompanies: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.append("search", params.search);
    if (params.category && params.category !== "ALL") q.append("category", params.category);
    if (params.company_type && params.company_type !== "ALL") q.append("company_type", params.company_type);
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    if (params.sort_by) q.append("sort_by", params.sort_by);
    if (params.sort_order) q.append("sort_order", params.sort_order);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/companies${qs}`);
  },
  getCompany: (id) => request(`/insurance/companies/${id}`),
  getCompanySupportedCategories: (id) => request(`/insurance/companies/${id}/supported-categories`),
  updateCompanySupportedCategories: (id, data) =>
    request(`/insurance/companies/${id}/supported-categories`, {
      method: "PUT",
      body: data,
    }),
  createCompany: (data) =>
    request("/insurance/companies", {
      method: "POST",
      body: data,
    }),
  updateCompany: (id, data) =>
    request(`/insurance/companies/${id}`, {
      method: "PUT",
      body: data,
    }),
  toggleCompanyStatus: (id, isActive) =>
    request(`/insurance/companies/${id}/status?is_active=${isActive}`, {
      method: "PATCH",
    }),
  deleteCompany: (id) =>
    request(`/insurance/companies/${id}`, {
      method: "DELETE",
    }),
  seedMasterData: () =>
    request("/insurance/master/seed?confirm=true", {
      method: "POST",
    }),

  // Plan Master (Add / Manage Plan)
  getPlans: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.append("search", params.search);
    if (params.company_id && params.company_id !== "ALL") q.append("company_id", params.company_id);
    if (params.line_of_business && params.line_of_business !== "ALL")
      q.append("line_of_business", params.line_of_business);
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    if (params.sort_by) q.append("sort_by", params.sort_by);
    if (params.sort_order) q.append("sort_order", params.sort_order);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/plans${qs}`);
  },
  getPlan: (id) => request(`/insurance/plans/${id}`),
  getPlanRiders: (id) => request(`/insurance/plans/${id}/riders`),
  getPlanBenefits: (id) => request(`/insurance/plans/${id}/benefits`),
  createPlan: (data) =>
    request("/insurance/plans", {
      method: "POST",
      body: data,
    }),
  updatePlan: (id, data) =>
    request(`/insurance/plans/${id}`, {
      method: "PUT",
      body: data,
    }),
  togglePlanStatus: (id, status) =>
    request(`/insurance/plans/${id}/status?status=${status}`, {
      method: "PATCH",
    }),
  deletePlan: (id) =>
    request(`/insurance/plans/${id}`, {
      method: "DELETE",
    }),

  // Purchase Party Management
  getPurchaseParties: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.append("search", params.search);
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    if (params.sort_by) q.append("sort_by", params.sort_by);
    if (params.sort_order) q.append("sort_order", params.sort_order);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/purchase-parties${qs}`);
  },
  getPurchaseParty: (id) => request(`/insurance/purchase-parties/${id}`),
  createPurchaseParty: (data) =>
    request("/insurance/purchase-parties", {
      method: "POST",
      body: data,
    }),
  updatePurchaseParty: (id, data) =>
    request(`/insurance/purchase-parties/${id}`, {
      method: "PUT",
      body: data,
    }),
  togglePurchasePartyStatus: (id, isActive) =>
    request(`/insurance/purchase-parties/${id}/status?is_active=${isActive}`, {
      method: "PATCH",
    }),
  deletePurchaseParty: (id) =>
    request(`/insurance/purchase-parties/${id}`, {
      method: "DELETE",
    }),

  // Export Helpers
  downloadPurchasePartiesExport: async (format = "csv", filters = {}) => {
    const q = new URLSearchParams();
    if (filters.search) q.append("search", filters.search);
    if (filters.status && filters.status !== "ALL") q.append("status", filters.status);
    const qs = q.toString() ? `?${q.toString()}` : "";
    const endpoint = `/insurance/purchase-parties/export/${format}${qs}`;

    const token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}${endpoint}`;
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      return { ok: false, error: "Failed to download export file." };
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    const disposition = res.headers.get("Content-Disposition");
    let filename = `purchase_parties_${format}.${format === "excel" ? "csv" : "csv"}`;
    if (disposition && disposition.indexOf("filename=") !== -1) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },

  // Company Documents
  uploadCompanyDocument: (companyId, file, title, docType = "TIEUP_AGREEMENT") => {
    const formData = new FormData();
    formData.append("file", file);
    return request(
      `/insurance/companies/${companyId}/documents?title=${encodeURIComponent(title)}&document_type=${encodeURIComponent(docType)}`,
      {
        method: "POST",
        body: formData,
      }
    );
  },
  getCompanyDocuments: (companyId) => request(`/insurance/companies/${companyId}/documents`),
  downloadCompanyDocument: async (companyId, docId, fallbackName = "company_document.pdf") => {
    const token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}/insurance/companies/${companyId}/documents/${docId}/download`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return { ok: false, error: "Failed to download company document." };
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },
  deleteCompanyDocument: (companyId, docId) =>
    request(`/insurance/companies/${companyId}/documents/${docId}`, {
      method: "DELETE",
    }),

  // Company Export
  downloadCompaniesExport: async (format = "csv", filters = {}) => {
    const q = new URLSearchParams();
    if (filters.search) q.append("search", filters.search);
    if (filters.category && filters.category !== "ALL") q.append("category", filters.category);
    if (filters.status && filters.status !== "ALL") q.append("status", filters.status);
    const qs = q.toString() ? `?${q.toString()}` : "";
    const endpoint = `/insurance/companies/export/${format}${qs}`;

    const token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}${endpoint}`;
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      return { ok: false, error: "Failed to download company export file." };
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    const disposition = res.headers.get("Content-Disposition");
    let filename = `insurance_companies_${format}.${format === "excel" ? "csv" : "csv"}`;
    if (disposition && disposition.indexOf("filename=") !== -1) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },

  // Plan Documents (Brochure & Claim Form)
  uploadPlanBrochure: (planId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/insurance/plans/${planId}/brochure`, {
      method: "POST",
      body: formData,
    });
  },
  downloadPlanBrochure: async (planId, fallbackName = "brochure.pdf") => {
    const token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}/insurance/plans/${planId}/brochure`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return { ok: false, error: "Failed to download plan brochure." };
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },
  uploadPlanClaimForm: (planId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/insurance/plans/${planId}/claim-form`, {
      method: "POST",
      body: formData,
    });
  },
  downloadPlanClaimForm: async (planId, fallbackName = "claim_form.pdf") => {
    const token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}/insurance/plans/${planId}/claim-form`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return { ok: false, error: "Failed to download claim form." };
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },

  // Plan Multi-Document Management
  getPlanDocuments: (planId, docType = null) => {
    const q = docType && docType !== "ALL" ? `?document_type=${encodeURIComponent(docType)}` : "";
    return request(`/insurance/plans/${planId}/documents${q}`);
  },
  uploadPlanDocument: (planId, formData) =>
    request(`/insurance/plans/${planId}/documents`, {
      method: "POST",
      body: formData,
    }),
  downloadPlanDocument: async (planId, docId, fallbackName = "document") => {
    const token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}/insurance/plans/${planId}/documents/${docId}/download`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return { ok: false, error: "Failed to download plan document." };
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },
  viewPlanDocumentUrl: (planId, docId) => {
    return `${API_BASE_URL}/insurance/plans/${planId}/documents/${docId}/view`;
  },
  viewPlanDocumentBlob: async (planId, docId) => {
    const token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}/insurance/plans/${planId}/documents/${docId}/view`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return { ok: false, error: "Failed to open document preview." };
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    return { ok: true, url: blobUrl };
  },
  updatePlanDocument: (planId, docId, formData) =>
    request(`/insurance/plans/${planId}/documents/${docId}`, {
      method: "PUT",
      body: formData,
    }),
  deletePlanDocument: (planId, docId) =>
    request(`/insurance/plans/${planId}/documents/${docId}`, {
      method: "DELETE",
    }),

  // Phase 2: Live Dashboard Metrics & Aggregations
  getLiveDashboardMetrics: () => request("/insurance/dashboard/metrics"),

  // Phase 2: Customer Onboarding & KYC Management
  getCustomers: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.append("search", params.search);
    if (params.customer_type && params.customer_type !== "ALL") q.append("customer_type", params.customer_type);
    if (params.gender && params.gender !== "ALL") q.append("gender", params.gender);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/customers${qs}`);
  },
  getCustomer: (id) => request(`/insurance/customers/${id}`),
  getCustomer360: (customerId) => request(`/insurance/customers/${customerId}/360`),
  createCustomer: (data) => request("/insurance/customers", { method: "POST", body: data }),
  updateCustomer: (id, data) => request(`/insurance/customers/${id}`, { method: "PUT", body: data }),
  uploadCustomerKyc: (customerId, docType, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/insurance/customers/${customerId}/documents?document_type=${docType}`, {
      method: "POST",
      body: formData,
    });
  },
  downloadCustomerKyc: async (customerId, docId, fallbackName = "document.pdf") => {
    const token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}/insurance/customers/${customerId}/documents/${docId}/download`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return { ok: false, error: "Failed to download KYC document." };
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },
  viewCustomerKycBlob: async (customerId, docId) => {
    const token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}/insurance/customers/${customerId}/documents/${docId}/download`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return { ok: false, error: "Failed to open KYC document preview." };
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    return { ok: true, url: blobUrl };
  },
  unmaskCustomerKyc: (customerId) => request(`/insurance/customers/${customerId}/unmask-kyc`),
  verifyCustomerKycDoc: (customerId, docId, status, remarks) =>
    request(`/insurance/customers/${customerId}/documents/${docId}/verify`, {
      method: "PATCH",
      body: { verification_status: status, remarks },
    }),
  deleteCustomerKycDoc: (customerId, docId) =>
    request(`/insurance/customers/${customerId}/documents/${docId}`, {
      method: "DELETE",
    }),
  addCustomerNote: (customerId, note) =>
    request(`/insurance/customers/${customerId}/notes`, {
      method: "POST",
      body: { note },
    }),
  getCustomerActivities: (customerId, params = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    if (params.action_type && params.action_type !== "ALL") q.append("action_type", params.action_type);
    if (params.user_id) q.append("user_id", params.user_id);
    if (params.start_date) q.append("start_date", params.start_date);
    if (params.end_date) q.append("end_date", params.end_date);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/customers/${customerId}/activities${qs}`);
  },
  toggleCustomerStatus: (customerId, isArchived) =>
    request(`/insurance/customers/${customerId}/status?is_archived=${isArchived}`, { method: "PATCH" }),
  archiveCustomer: (customerId) =>
    request(`/insurance/customers/${customerId}`, { method: "DELETE" }),

  // Phase 2: Bulk Customer Import
  downloadCustomerTemplate: async (customerType = "INDIVIDUAL", format = "csv") => {
    const token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}/insurance/customers/import/template?customer_type=${encodeURIComponent(customerType)}&format=${format}`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return { ok: false, error: "Failed to download customer template." };
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `customer_import_template_${customerType.toLowerCase()}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },
  previewCustomerImport: (file, customerType = "INDIVIDUAL") => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/insurance/customers/import/preview?customer_type=${encodeURIComponent(customerType)}`, {
      method: "POST",
      body: formData,
    });
  },
  confirmCustomerImport: (rows, customerType = "INDIVIDUAL") => {
    return request(`/insurance/customers/import/confirm?customer_type=${encodeURIComponent(customerType)}`, {
      method: "POST",
      body: { rows: Array.isArray(rows) ? rows : [] },
    });
  },

  // Phase 2: Family Groups & Consolidated Portfolios
  getFamilyGroups: (search = "") => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return request(`/insurance/family-groups${qs}`);
  },
  getFamilyGroup: (id) => request(`/insurance/family-groups/${id}`),
  createFamilyGroup: (data) => request("/insurance/family-groups", { method: "POST", body: data }),
  addFamilyMember: (groupId, data) =>
    request(`/insurance/family-groups/${groupId}/members`, { method: "POST", body: data }),
  removeFamilyMember: (groupId, memberId) =>
    request(`/insurance/family-groups/${groupId}/members/${memberId}`, { method: "DELETE" }),

  // Phase 2: Sub-Agent / POSP Management & Commission Splits
  getSubAgents: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.append("search", params.search);
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/sub-agents${qs}`);
  },
  getSubAgent: (id) => request(`/insurance/sub-agents/${id}`),
  createSubAgent: (data) => request("/insurance/sub-agents", { method: "POST", body: data }),
  updateSubAgent: (id, data) => request(`/insurance/sub-agents/${id}`, { method: "PUT", body: data }),
  toggleSubAgentStatus: (id) => request(`/insurance/sub-agents/${id}/status`, { method: "PATCH" }),
  deleteSubAgent: (id) => request(`/insurance/sub-agents/${id}`, { method: "DELETE" }),
  getAgentSplits: (id) => request(`/insurance/sub-agents/${id}/splits`),
  createAgentSplit: (id, data) => request(`/insurance/sub-agents/${id}/splits`, { method: "POST", body: data }),
  createCommissionSplitConfig: (id, data) => request(`/insurance/sub-agents/${id}/splits`, { method: "POST", body: data }),

  // Phase 2: Family Groups
  deleteFamilyGroup: (id) => request(`/insurance/family-groups/${id}`, { method: "DELETE" }),

  // Phase 2: Policy Issuance, Management & Dropdown Lookup
  getPolicies: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.append("search", params.search);
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.policy_type && params.policy_type !== "ALL") q.append("policy_type", params.policy_type);
    if (params.business_type && params.business_type !== "ALL") q.append("business_type", params.business_type);
    if (params.company_id) q.append("company_id", params.company_id);
    if (params.sub_agent_id) q.append("sub_agent_id", params.sub_agent_id);
    if (params.customer_id) q.append("customer_id", params.customer_id);
    if (params.start_date_from) q.append("start_date_from", params.start_date_from);
    if (params.start_date_to) q.append("start_date_to", params.start_date_to);
    if (params.expiry_date_from) q.append("expiry_date_from", params.expiry_date_from);
    if (params.expiry_date_to) q.append("expiry_date_to", params.expiry_date_to);
    if (params.issue_year && params.issue_year !== "ALL") q.append("issue_year", params.issue_year);
    if (params.coverage_year) q.append("coverage_year", params.coverage_year);
    if (params.year_bucket && params.year_bucket !== "ALL") q.append("year_bucket", params.year_bucket);
    if (params.sort_by) q.append("sort_by", params.sort_by);
    if (params.sort_order) q.append("sort_order", params.sort_order);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/policies${qs}`);
  },
  getManagedPolicies: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.append("search", params.search);
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.policy_type && params.policy_type !== "ALL") q.append("policy_type", params.policy_type);
    if (params.company_id) q.append("company_id", params.company_id);
    if (params.sub_agent_id) q.append("sub_agent_id", params.sub_agent_id);
    if (params.customer_id) q.append("customer_id", params.customer_id);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/policies${qs}`);
  },
  getPolicy: (id) => request(`/insurance/policies/${id}`),
  getManagedPolicy: (id) => request(`/insurance/policies/${id}`),
  getPolicyLookupData: (params = {}) => {
    const q = new URLSearchParams();
    if (params?.category) q.set("category", params.category);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/policies/lookup-data${qs}`);
  },
  getPolicyIssueYears: () => request("/insurance/policies/issue-years"),
  createPolicy: (data) => request("/insurance/policies", { method: "POST", body: data }),
  createManagedPolicy: (data) => request("/insurance/policies", { method: "POST", body: data }),
  updatePolicy: (id, data) => request(`/insurance/policies/${id}`, { method: "PUT", body: data }),
  updateManagedPolicy: (id, data) => request(`/insurance/policies/${id}`, { method: "PUT", body: data }),
  deletePolicy: (id) => request(`/insurance/policies/${id}`, { method: "DELETE" }),
  deleteManagedPolicy: (id) => request(`/insurance/policies/${id}`, { method: "DELETE" }),

  // Phase 2: Payments
  recordPayment: (policyId, data) =>
    request(`/insurance/policies/${policyId}/payments`, { method: "POST", body: data }),
  recordPolicyPayment: (policyId, data) =>
    request(`/insurance/policies/${policyId}/payments`, { method: "POST", body: data }),
  getPolicyPayments: (policyId) => request(`/insurance/policies/${policyId}/payments`),

  // Phase 2: Premium Schedules & Renewals
  getPremiumSchedules: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.upcoming_days) q.append("upcoming_days", params.upcoming_days);
    if (params.policy_id) q.append("policy_id", params.policy_id);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/premium-schedules${qs}`);
  },
  getUpcomingRenewals: (windowDays = 30) =>
    request(`/insurance/renewals/upcoming?window_days=${windowDays}`),

  // Phase 2: Commission Management, Reconciliation & Reports
  getCommissions: (params = {}) => {
    const q = new URLSearchParams();
    if (params.agent_id) q.append("agent_id", params.agent_id);
    if (params.company_id) q.append("company_id", params.company_id);
    if (params.policy_category && params.policy_category !== "ALL") q.append("policy_category", params.policy_category);
    if (params.commission_type && params.commission_type !== "ALL") q.append("commission_type", params.commission_type);
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.from_date) q.append("from_date", params.from_date);
    if (params.to_date) q.append("to_date", params.to_date);
    if (params.search) q.append("search", params.search);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/commissions${qs}`);
  },
  getCommissionKPIs: () => request("/insurance/commissions/kpis"),
  getComprehensiveCommissionDashboard: () => request("/insurance/commissions/dashboard"),
  getCommissionDetail: (id) => request(`/insurance/commissions/${id}`),
  approveCommission: (id, data = {}) =>
    request(`/insurance/commissions/${id}/approve`, { method: "POST", body: data }),
  recordCommissionReceipt: (id, data) =>
    request(`/insurance/commissions/${id}/receipts`, { method: "POST", body: data }),
  uploadReceiptDoc: (formData) =>
    request(`/insurance/commissions/upload-receipt-doc`, { method: "POST", body: formData }),
  reverseCommission: (id, data) =>
    request(`/insurance/commissions/${id}/reverse`, { method: "POST", body: data }),
  disputeCommission: (id, data) =>
    request(`/insurance/commissions/${id}/dispute`, { method: "POST", body: data }),
  updateCommission: (id, data) =>
    request(`/insurance/commissions/${id}`, { method: "PUT", body: data }),
  updateCommissionStatus: (id, data) =>
    request(`/insurance/commissions/${id}/status`, { method: "PATCH", body: data }),

  // Sub-Agent Payouts Workflow
  getSubAgentPayouts: (params = {}) => {
    const q = new URLSearchParams();
    if (params.sub_agent_id) q.append("sub_agent_id", params.sub_agent_id);
    if (params.company_id) q.append("company_id", params.company_id);
    if (params.policy_id) q.append("policy_id", params.policy_id);
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.from_date) q.append("from_date", params.from_date);
    if (params.to_date) q.append("to_date", params.to_date);
    if (params.search) q.append("search", params.search);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/commissions/sub-agent-payouts${qs}`);
  },
  getSubAgentPayoutDetail: (id) => request(`/insurance/commissions/sub-agent-payouts/${id}`),
  updateSubAgentPayout: (id, data) =>
    request(`/insurance/commissions/sub-agent-payouts/${id}`, { method: "PUT", body: data }),
  approveSubAgentPayout: (id, data = {}) =>
    request(`/insurance/commissions/sub-agent-payouts/${id}/approve`, { method: "POST", body: data }),
  recordSubAgentPayoutPayment: (id, data) =>
    request(`/insurance/commissions/sub-agent-payouts/${id}/payments`, { method: "POST", body: data }),
  holdSubAgentPayout: (id, data = {}) =>
    request(`/insurance/commissions/sub-agent-payouts/${id}/hold`, { method: "POST", body: data }),
  reverseSubAgentPayout: (id, data) =>
    request(`/insurance/commissions/sub-agent-payouts/${id}/reverse`, { method: "POST", body: data }),

  // 8 Dedicated Reports (CSV and XLSX)
  downloadCommissionReport: async (reportKey, format = "csv", params = {}) => {
    const token = tokenStorage.getAccessToken();
    const q = new URLSearchParams();
    q.append("format", format);
    if (params.agent_id) q.append("agent_id", params.agent_id);
    if (params.company_id) q.append("company_id", params.company_id);
    if (params.policy_id) q.append("policy_id", params.policy_id);
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.from_date) q.append("from_date", params.from_date);
    if (params.to_date) q.append("to_date", params.to_date);
    if (params.search) q.append("search", params.search);
    const qs = q.toString() ? `?${q.toString()}` : "";
    const url = `${API_BASE_URL}/insurance/commissions/reports/${reportKey}${qs}`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Export failed" }));
      return { ok: false, error: err.detail || `Failed to export ${reportKey}` };
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    const ext = format === "xlsx" ? "xlsx" : "csv";
    a.download = `${reportKey}_${new Date().toISOString().split("T")[0]}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },
  getCommissionReports: () => request("/insurance/commissions/reports"),
  getAgentCommissionReport: () => request("/insurance/commissions/reports"),
  getAgentPerformanceReports: (params = {}) => {
    const q = new URLSearchParams();
    if (params.from_date) q.append("from_date", params.from_date);
    if (params.to_date) q.append("to_date", params.to_date);
    if (params.company_id) q.append("company_id", params.company_id);
    if (params.policy_category && params.policy_category !== "ALL") q.append("policy_category", params.policy_category);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/commissions/reports/agent-performance${qs}`);
  },
  exportCommissionLedgerCsv: async (params = {}) => {
    const token = tokenStorage.getAccessToken();
    const q = new URLSearchParams();
    if (params.agent_id) q.append("agent_id", params.agent_id);
    if (params.company_id) q.append("company_id", params.company_id);
    if (params.policy_category && params.policy_category !== "ALL") q.append("policy_category", params.policy_category);
    if (params.commission_type && params.commission_type !== "ALL") q.append("commission_type", params.commission_type);
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.from_date) q.append("from_date", params.from_date);
    if (params.to_date) q.append("to_date", params.to_date);
    if (params.search) q.append("search", params.search);
    const qs = q.toString() ? `?${q.toString()}` : "";
    const url = `${API_BASE_URL}/insurance/commissions/reports/export/csv${qs}`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return { ok: false, error: "Failed to export commission CSV." };
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `insurance_commission_ledger_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },
  exportCommissionLedgerExcel: async (params = {}) => {
    const token = tokenStorage.getAccessToken();
    const q = new URLSearchParams();
    if (params.agent_id) q.append("agent_id", params.agent_id);
    if (params.company_id) q.append("company_id", params.company_id);
    if (params.policy_category && params.policy_category !== "ALL") q.append("policy_category", params.policy_category);
    if (params.commission_type && params.commission_type !== "ALL") q.append("commission_type", params.commission_type);
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.from_date) q.append("from_date", params.from_date);
    if (params.to_date) q.append("to_date", params.to_date);
    if (params.search) q.append("search", params.search);
    const qs = q.toString() ? `?${q.toString()}` : "";
    const url = `${API_BASE_URL}/insurance/commissions/reports/export/excel${qs}`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return { ok: false, error: "Failed to export commission Excel." };
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `insurance_commission_ledger_${new Date().toISOString().split("T")[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },
  getCommissionAgreements: (params = {}) => {
    const q = new URLSearchParams();
    if (params.company_id) q.append("company_id", params.company_id);
    if (params.is_active !== undefined) q.append("is_active", params.is_active);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/commissions/agreements${qs}`);
  },
  createCommissionAgreement: (data) =>
    request("/insurance/commissions/agreements", { method: "POST", body: data }),
  updateCommissionAgreement: (id, data) =>
    request(`/insurance/commissions/agreements/${id}`, { method: "PUT", body: data }),

  // Phase 2: Bulk Policy Import & Year-Wise Export
  exportPoliciesExcel: async (params = {}) => {
    const token = tokenStorage.getAccessToken();
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "" && v !== "ALL") {
        query.append(k, v);
      }
    });
    const qs = query.toString() ? `?${query.toString()}` : "";
    const url = `${API_BASE_URL}/insurance/policies/export/excel${qs}`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return { ok: false, error: errJson.detail || "Failed to export policies." };
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    const tag = params.issue_year || params.coverage_year || params.year_bucket || "yearwise";
    a.download = `finnexus_policies_export_${tag}_${new Date().toISOString().split("T")[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },
  downloadImportTemplate: async (format = "xlsx") => {
    const token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}/insurance/policies/import/template?format=${format}`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return { ok: false, error: "Failed to download import template." };
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `policy_import_template.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },
  previewPolicyImport: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/insurance/policies/import/preview", {
      method: "POST",
      body: formData,
    });
  },
  confirmPolicyImport: (fileOrRows) => {
    if (typeof File !== "undefined" && fileOrRows instanceof File) {
      const formData = new FormData();
      formData.append("file", fileOrRows);
      return request("/insurance/policies/import/confirm", { method: "POST", body: formData });
    }
    return request("/insurance/policies/import/confirm", {
      method: "POST",
      body: { rows: Array.isArray(fileOrRows) ? fileOrRows : [] },
    });
  },
  executePolicyImport: (fileOrRows) => {
    if (typeof File !== "undefined" && fileOrRows instanceof File) {
      const formData = new FormData();
      formData.append("file", fileOrRows);
      return request("/insurance/policies/import/confirm", { method: "POST", body: formData });
    }
    return request("/insurance/policies/import/confirm", {
      method: "POST",
      body: { rows: Array.isArray(fileOrRows) ? fileOrRows : [] },
    });
  },

  // Phase 2: Public Agent Lead Profile & Inquiries
  getPublicAgentProfile: (slug) => request(`/insurance/agents/public/${slug}`),
  submitPublicInquiry: (slug, data) =>
    request(`/insurance/agents/public/${slug}/inquiries`, { method: "POST", body: data }),
  getAgentInquiries: (params = {}) => {
    const q = new URLSearchParams();
    if (params.sub_agent_id) q.append("sub_agent_id", params.sub_agent_id);
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/inquiries${qs}`);
  },
  updateInquiryStatus: (id, status) =>
    request(`/insurance/inquiries/${id}/status`, { method: "PATCH", body: { status } }),

  // Lead Management & Sales CRM (Phases 2 - 13)
  getLeadStats: () => request("/insurance/leads/stats"),
  getLeads: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.category && params.category !== "ALL") q.append("category", params.category);
    if (params.source && params.source !== "ALL") q.append("source", params.source);
    if (params.priority && params.priority !== "ALL") q.append("priority", params.priority);
    if (params.assigned_user_id && params.assigned_user_id !== "ALL") q.append("assigned_user_id", params.assigned_user_id);
    if (params.search) q.append("search", params.search);
    if (params.date_from) q.append("date_from", params.date_from);
    if (params.date_to) q.append("date_to", params.date_to);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/leads${qs}`);
  },
  getLeadKanban: (params = {}) => {
    const q = new URLSearchParams();
    if (params.category && params.category !== "ALL") q.append("category", params.category);
    if (params.source && params.source !== "ALL") q.append("source", params.source);
    if (params.priority && params.priority !== "ALL") q.append("priority", params.priority);
    if (params.assigned_user_id && params.assigned_user_id !== "ALL") q.append("assigned_user_id", params.assigned_user_id);
    if (params.search) q.append("search", params.search);
    if (params.view) q.append("view", params.view);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/leads/kanban${qs}`);
  },
  getLead360: (leadId) => request(`/insurance/leads/${leadId}/360`),
  getLeadById: (leadId) => request(`/insurance/leads/${leadId}`),
  createLead: (data, forceDuplicate = false) =>
    request(`/insurance/leads${forceDuplicate ? "?force_duplicate=true" : ""}`, {
      method: "POST",
      body: data,
    }),
  updateLead: (leadId, data) =>
    request(`/insurance/leads/${leadId}`, {
      method: "PATCH",
      body: data,
    }),
  deleteLead: (leadId) =>
    request(`/insurance/leads/${leadId}`, {
      method: "DELETE",
    }),
  updateLeadStatus: (leadId, status, lostReason = null) =>
    request(`/insurance/leads/${leadId}/status`, {
      method: "PATCH",
      body: { status, lost_reason: lostReason },
    }),
  assignLead: (leadId, assignedUserId, subAgentId = null, notes = null) =>
    request(`/insurance/leads/${leadId}/assign`, {
      method: "PATCH",
      body: { assigned_user_id: assignedUserId, sub_agent_id: subAgentId, notes },
    }),
  bulkAssignLeads: (leadIds, assignedUserId, subAgentId = null, notes = null) =>
    request("/insurance/leads/bulk-assign", {
      method: "POST",
      body: { lead_ids: leadIds, assigned_user_id: assignedUserId, sub_agent_id: subAgentId, notes },
    }),
  checkLeadDuplicates: (data) =>
    request("/insurance/leads/check-duplicates", {
      method: "POST",
      body: data,
    }),
  convertLeadToCustomer: (leadId, data = {}) =>
    request(`/insurance/leads/${leadId}/convert`, {
      method: "POST",
      body: data,
    }),
  scheduleLeadFollowUp: (leadId, data = {}) => {
    let reminder_date = data.reminder_date;
    let reminder_time = data.reminder_time;
    if (!reminder_date && data.scheduled_time) {
      const dt = new Date(data.scheduled_time);
      if (!isNaN(dt.getTime())) {
        const year = dt.getFullYear();
        const month = String(dt.getMonth() + 1).padStart(2, "0");
        const day = String(dt.getDate()).padStart(2, "0");
        const hours = String(dt.getHours()).padStart(2, "0");
        const mins = String(dt.getMinutes()).padStart(2, "0");
        reminder_date = `${year}-${month}-${day}`;
        reminder_time = `${hours}:${mins}`;
      }
    }
    const remType = data.reminder_type || "PHONE_CALL";
    const typeLabel = remType.replace(/_/g, " ");
    const title = data.title || `${typeLabel} Follow-up`;
    const description = data.description || data.notes || "";

    const body = {
      title,
      reminder_date: reminder_date || new Date().toISOString().slice(0, 10),
      reminder_time: reminder_time || "10:00",
      reminder_type: remType,
      priority: data.priority || "NORMAL",
      assigned_to_id: data.assigned_to_id || null,
      description,
      scheduled_time: data.scheduled_time,
      notes: description,
      ...data,
      title,
      reminder_date: reminder_date || new Date().toISOString().slice(0, 10),
      reminder_time: reminder_time || "10:00",
      description,
    };

    return request(`/insurance/leads/${leadId}/follow-ups`, {
      method: "POST",
      body,
    });
  },
  completeLeadFollowUp: (reminderId, data, leadId = null) => {
    const url = leadId
      ? `/insurance/leads/${leadId}/follow-ups/${reminderId}/complete`
      : `/insurance/leads/reminders/${reminderId}/complete`;
    return request(url, {
      method: "POST",
      body: data,
    });
  },
  getLeadFollowUps: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.due && params.due !== "ALL") q.append("due", params.due);
    if (params.assigned_to_id) q.append("assigned_to_id", params.assigned_to_id);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/leads/follow-ups${qs}`);
  },
  addLeadNote: (leadId, noteTextOrData, isImportant = false) => {
    const body =
      typeof noteTextOrData === "string"
        ? { description: noteTextOrData, is_important: isImportant }
        : { description: noteTextOrData.description || noteTextOrData.note, ...noteTextOrData };
    return request(`/insurance/leads/${leadId}/notes`, {
      method: "POST",
      body,
    });
  },
  updateLeadNote: (leadId, noteId, data) =>
    request(`/insurance/leads/${leadId}/notes/${noteId}`, {
      method: "PATCH",
      body: data,
    }),
  deleteLeadNote: (leadId, noteId) =>
    request(`/insurance/leads/${leadId}/notes/${noteId}`, {
      method: "DELETE",
    }),
  linkLeadQuotation: (leadId, quotationId) =>
    request(`/insurance/leads/${leadId}/link-quotation/${quotationId}`, {
      method: "POST",
    }),
  downloadLeadExport: async (params = {}) => {
    const q = new URLSearchParams();
    q.append("format", params.format || "xlsx");
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.category && params.category !== "ALL") q.append("category", params.category);
    if (params.source && params.source !== "ALL") q.append("source", params.source);
    if (params.priority && params.priority !== "ALL") q.append("priority", params.priority);
    if (params.assigned_user_id && params.assigned_user_id !== "ALL") q.append("assigned_user_id", params.assigned_user_id);
    if (params.date_from) q.append("date_from", params.date_from);
    if (params.date_to) q.append("date_to", params.date_to);
    const token = tokenStorage.getAccessToken();
    const res = await fetch(`${API_BASE_URL}/insurance/leads/export?${q.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Export failed");
    return await res.blob();
  },
  downloadLeadTemplate: async (format = "xlsx") => {
    const token = tokenStorage.getAccessToken();
    const res = await fetch(`${API_BASE_URL}/insurance/leads/import/template?format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Template download failed");
    return await res.blob();
  },
  previewLeadsImport: (formData) =>
    request("/insurance/leads/import/preview", {
      method: "POST",
      body: formData,
    }),
  confirmLeadsImport: (rows) =>
    request("/insurance/leads/import/confirm", {
      method: "POST",
      body: { rows },
    }),
  getLeadReports: (params = {}) => {
    const q = new URLSearchParams();
    if (params.report_type) q.append("report_type", params.report_type);
    if (params.date_from) q.append("date_from", params.date_from);
    if (params.date_to) q.append("date_to", params.date_to);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/leads/reports${qs}`);
  },
  getStaffUsers: () => request("/auth/users"),

  // Actuarial Products & Calculator
  getProducts: () => request("/insurance/products"),
  calculateQuote: (data) =>
    request("/insurance/quotes/calculate", {
      method: "POST",
      body: data,
    }),
  bindPolicy: (data) =>
    request("/insurance/policies/bind", {
      method: "POST",
      body: data,
    }),
  renewPolicy: (policyIdOrNumber, data = {}) => {
    // If UUID/id, call /insurance/policies/{id}/renew
    if (typeof policyIdOrNumber === "string" && policyIdOrNumber.includes("-") && policyIdOrNumber.length >= 32) {
      return request(`/insurance/policies/${policyIdOrNumber}/renew`, {
        method: "POST",
        body: data,
      });
    }
    // Fallback for legacy policy_number payload
    return request(`/insurance/policies/${policyIdOrNumber}/renew`, {
      method: "POST",
      body: data,
    });
  },
  updatePolicyStatus: (policyId, status, notes = "") =>
    request(`/insurance/policies/${policyId}/status`, {
      method: "PATCH",
      body: { status, notes },
    }),
  getPolicyNominees: (policyId) => request(`/insurance/policies/${policyId}/nominees`),
  setPolicyNominees: (policyId, nominees) =>
    request(`/insurance/policies/${policyId}/nominees`, {
      method: "POST",
      body: nominees,
    }),
  getPolicyCertificate: (policyId) => request(`/insurance/policies/${policyId}/certificate`),
  getPolicyAuditHistory: (policyId) => request(`/insurance/policies/${policyId}/audit-history`),
  // Phase 4: Multi-Member Policy & Family Floater
  getPolicyMembers: (policyId) => request(`/insurance/policies/${policyId}/members`),
  addPolicyMember: (policyId, member) =>
    request(`/insurance/policies/${policyId}/members`, {
      method: "POST",
      body: member,
    }),
  removePolicyMember: (policyId, memberId) =>
    request(`/insurance/policies/${policyId}/members/${memberId}`, {
      method: "DELETE",
    }),
  getCustomerFamilyGroupMembers: (customerId) =>
    request(`/insurance/customers/${customerId}/family-group-members`),

  // Policy Documents (Policy-Specific & Inherited Plan Documents)
  getPolicyDocuments: (policyId) => request(`/insurance/policies/${policyId}/documents`),
  uploadPolicyDocument: (policyId, formData) =>
    request(`/insurance/policies/${policyId}/documents`, {
      method: "POST",
      body: formData,
    }),
  downloadPolicyDocument: async (policyId, docId, fallbackName = "policy_document") => {
    const token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}/insurance/policies/${policyId}/documents/${docId}/download`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return { ok: false, error: "Failed to download policy document." };
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },
  viewPolicyDocumentUrl: (policyId, docId) => {
    return `${API_BASE_URL}/insurance/policies/${policyId}/documents/${docId}/view`;
  },
  viewPolicyDocumentBlob: async (policyId, docId) => {
    const token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}/insurance/policies/${policyId}/documents/${docId}/view`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return { ok: false, error: "Failed to open document preview." };
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    return { ok: true, url: blobUrl };
  },
  updatePolicyDocument: (policyId, docId, formData) =>
    request(`/insurance/policies/${policyId}/documents/${docId}`, {
      method: "PUT",
      body: formData,
    }),
  deletePolicyDocument: (policyId, docId) =>
    request(`/insurance/policies/${policyId}/documents/${docId}`, {
      method: "DELETE",
    }),
  downloadPolicyPlanDocument: async (policyId, planDocId, fallbackName = "plan_document") => {
    const token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}/insurance/policies/${policyId}/plan-documents/${planDocId}/download`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return { ok: false, error: "Failed to download inherited plan document." };
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },
  viewPolicyPlanDocumentBlob: async (policyId, planDocId) => {
    const token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}/insurance/policies/${policyId}/plan-documents/${planDocId}/view`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return { ok: false, error: "Failed to open inherited plan document preview." };
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    return { ok: true, url: blobUrl };
  },

  // Module 6: Custom Health Quotation Generator
  getQuotationTemplates: () => request("/insurance/quotations/templates"),
  getQuotationStats: () => request("/insurance/quotations/stats"),
  calculateExactAge: (dob, referenceDate) =>
    request("/insurance/quotations/calculate-age", {
      method: "POST",
      body: { date_of_birth: dob, reference_date: referenceDate },
    }),
  getQuotations: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.append("search", params.search);
    if (params.status && params.status !== "ALL") q.append("status", params.status);
    if (params.from_date) q.append("from_date", params.from_date);
    if (params.to_date) q.append("to_date", params.to_date);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    if (params.sort_by) q.append("sort_by", params.sort_by);
    if (params.sort_order) q.append("sort_order", params.sort_order);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/insurance/quotations${qs}`);
  },
  getQuotation: (id) => request(`/insurance/quotations/${id}`),
  createQuotation: (data) =>
    request("/insurance/quotations", {
      method: "POST",
      body: data,
    }),
  updateQuotation: (id, data) =>
    request(`/insurance/quotations/${id}`, {
      method: "PUT",
      body: data,
    }),
  duplicateQuotation: (id) =>
    request(`/insurance/quotations/${id}/duplicate`, {
      method: "POST",
    }),
  deleteQuotation: (id) =>
    request(`/insurance/quotations/${id}`, {
      method: "DELETE",
    }),
  exportQuotationFile: async (id, format = "pdf", quotationNumber = "") => {
    let token = tokenStorage.getAccessToken();
    const url = `${API_BASE_URL}/insurance/quotations/${id}/export/${format}`;
    let res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: "include",
    });

    if (res.status === 401) {
      const refreshToken = tokenStorage.getRefreshToken();
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
            credentials: "include",
          });
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            tokenStorage.setTokens(data.access_token, data.refresh_token, data.user);
            token = data.access_token;
            res = await fetch(url, {
              headers: { Authorization: `Bearer ${token}` },
              credentials: "include",
            });
          }
        } catch {
          // Refresh failed
        }
      }
    }

    if (!res.ok) {
      let errMsg = `Failed to export quotation ${format.toUpperCase()}.`;
      try {
        const errJson = await res.json();
        if (errJson && errJson.detail) errMsg = errJson.detail;
      } catch {
        // Not JSON
      }
      return { ok: false, error: errMsg };
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    const ext = format === "excel" ? "xlsx" : format === "image" ? "png" : "pdf";
    const cleanNumber = (quotationNumber || "").replace(/\.(pdf|xlsx|png|image)$/i, "");
    const baseName = cleanNumber ? `Quotation_${cleanNumber}` : `Quotation_${id.slice(0, 8)}`;
    a.download = `${baseName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return { ok: true };
  },
  quotations: {
    list: (params) => insuranceAPI.getQuotations(params),
    stats: () => insuranceAPI.getQuotationStats(),
    get: (id) => insuranceAPI.getQuotation(id),
    create: (data) => insuranceAPI.createQuotation(data),
    update: (id, data) => insuranceAPI.updateQuotation(id, data),
    duplicate: (id) => insuranceAPI.duplicateQuotation(id),
    delete: (id) => insuranceAPI.deleteQuotation(id),
    exportFile: (id, format, quotationNumber) =>
      insuranceAPI.exportQuotationFile(id, format, quotationNumber),
    exportPdf: (id, quotationNumber) =>
      insuranceAPI.exportQuotationFile(id, "pdf", quotationNumber),
    exportExcel: (id, quotationNumber) =>
      insuranceAPI.exportQuotationFile(id, "excel", quotationNumber),
    exportImage: (id, quotationNumber) =>
      insuranceAPI.exportQuotationFile(id, "image", quotationNumber),
  },
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
