import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppShell from "./components/AppShell";
import DashboardPage from "./pages/DashboardPage";
import WorkOrdersPage from "./pages/WorkOrdersPage";
import WorkOrderFormPage from "./pages/WorkOrderFormPage";
import WorkOrderDetailPage from "./pages/WorkOrderDetailPage";
import MyTasksPage from "./pages/MyTasksPage";
import TaskHistoryPage from "./pages/TaskHistoryPage";
import ClientsPage from "./pages/ClientsPage";
import TeamPage from "./pages/TeamPage";
import CategoriesPage from "./pages/CategoriesPage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import { Loader2, ShieldAlert, ArrowRight } from "lucide-react";
import { APP_URLS } from "./services/api";

function ProtectedRoute({ children, requiredRoles }) {
  const { isAuthenticated, loading, userRoles, isAdmin } = useAuth();

  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = `${APP_URLS.dashboard}/login?redirect=${encodeURIComponent(window.location.href)}`;
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          <span className="text-xs font-semibold text-slate-500">Checking enterprise session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          <span className="text-xs font-semibold text-slate-500">Redirecting to centralized login...</span>
        </div>
      </div>
    );
  }

  if (requiredRoles && !isAdmin && !requiredRoles.some((r) => userRoles.includes(r))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-500 mt-1.5 mb-6 leading-relaxed">
            Your enterprise account does not possess the required permissions ({requiredRoles.join(", ")}) to access this view.
          </p>
          <a
            href={APP_URLS.dashboard}
            className="w-full py-2.5 px-4 rounded-xl bg-navy-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
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
      <BrowserRouter>
        <Routes>
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
            path="/work-orders"
            element={
              <ProtectedRoute>
                <AppShell>
                  <WorkOrdersPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/work-orders/new"
            element={
              <ProtectedRoute>
                <AppShell>
                  <WorkOrderFormPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/work-orders/:id/edit"
            element={
              <ProtectedRoute>
                <AppShell>
                  <WorkOrderFormPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/work-orders/:id"
            element={
              <ProtectedRoute>
                <AppShell>
                  <WorkOrderDetailPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-tasks"
            element={
              <ProtectedRoute>
                <AppShell>
                  <MyTasksPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <AppShell>
                  <TaskHistoryPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ClientsPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/team"
            element={
              <ProtectedRoute>
                <AppShell>
                  <TeamPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <AppShell>
                  <CategoriesPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <AppShell>
                  <NotificationsPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppShell>
                  <SettingsPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

