import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PolicyDraftProvider } from "./context/PolicyDraftContext";
import { NotificationProvider } from "./context/NotificationContext";
import PersistentDraftBar from "./components/PersistentDraftBar";
import AppShell from "./components/AppShell";
import { Loader2, ShieldAlert, ArrowRight } from "lucide-react";
import { APP_URLS } from "./services/api";

// Route-based code splitting: Lazy loaded page components
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const CompaniesPage = lazy(() => import("./pages/CompaniesPage"));
const PlansPage = lazy(() => import("./pages/PlansPage"));
const PurchasePartiesPage = lazy(() => import("./pages/PurchasePartiesPage"));
const HealthQuotationsPage = lazy(() => import("./pages/HealthQuotationsPage"));
const HealthQuotationFormPage = lazy(() => import("./pages/HealthQuotationFormPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const Customer360Page = lazy(() => import("./pages/Customer360Page"));
const FamilyGroupsPage = lazy(() => import("./pages/FamilyGroupsPage"));
const PoliciesPage = lazy(() => import("./pages/PoliciesPage"));
const CommissionsPage = lazy(() => import("./pages/CommissionsPage"));
const PartnersPage = lazy(() => import("./pages/PartnersPage"));
const MasterDataPage = lazy(() => import("./pages/MasterDataPage"));
const LeadsPage = lazy(() => import("./pages/LeadsPage"));
const PublicAgentProfilePage = lazy(() => import("./pages/PublicAgentProfilePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));

function PageLoadingFallback() {
  return (
    <div className="flex-1 flex items-center justify-center p-12 min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="text-xs font-semibold text-slate-500">Loading enterprise module...</span>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-xs font-semibold text-slate-500">Checking enterprise session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirectParam = encodeURIComponent(window.location.pathname + window.location.search);
    return <Navigate to={`/login?redirect=${redirectParam}`} replace />;
  }

  const userRoles = Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [];
  const hasAccess =
    userRoles.includes("SUPER_ADMIN") ||
    userRoles.includes("ADMIN") ||
    userRoles.includes("MANAGER") ||
    userRoles.includes("EMPLOYEE") ||
    userRoles.includes("UNDERWRITER") ||
    userRoles.includes("LOAN_OFFICER") ||
    user?.role === "SUPER_ADMIN" ||
    user?.role === "ADMIN";

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Enterprise Access Restricted</h2>
          <p className="text-xs text-slate-500 mt-1.5 mb-6 leading-relaxed">
            Your enterprise account does not hold credentials to access the Insurance Engine.
          </p>
          <a
            href={APP_URLS.dashboard}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <span>Return to Connect Dashboard</span>
            <ArrowRight className="w-4 h-4 text-teal-400" />
          </a>
        </div>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <PolicyDraftProvider>
          <BrowserRouter>
            <PersistentDraftBar />
          <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            {/* Dedicated Insurance Engine Login Page */}
            <Route path="/login" element={<LoginPage />} />

            {/* Public Agent Profile Page (Unauthenticated Prospect Leads) */}
            <Route path="/agents/:slug" element={<PublicAgentProfilePage />} />

            {/* Protected Enterprise Insurance Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <DashboardPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <DashboardPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <CustomersPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:id"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Customer360Page />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:id/360"
              element={<Navigate to="/customers/:id" replace />}
            />
            <Route
              path="/family-groups"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <FamilyGroupsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/policies"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <PoliciesPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/commissions"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <CommissionsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/partners"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <PartnersPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/master-data"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <MasterDataPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/leads"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <LeadsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            {/* Health Quotation Module */}
            <Route
              path="/insurance/health-quotations"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <HealthQuotationsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/insurance/health-quotations/create"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <HealthQuotationFormPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/insurance/health-quotations/:id/edit"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <HealthQuotationFormPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calculator"
              element={<Navigate to="/insurance/health-quotations" replace />}
            />

            {/* Retain Phase 1 Direct URLs */}
            <Route
              path="/companies"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <CompaniesPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/plans"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <PlansPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchase-parties"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <PurchasePartiesPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
        </PolicyDraftProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
