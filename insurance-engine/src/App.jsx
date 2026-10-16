import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppShell from "./components/AppShell";
import InsurancePage from "./pages/InsurancePage";
import { Loader2, ShieldAlert, ArrowRight } from "lucide-react";
import { APP_URLS } from "./services/api";

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();

  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = `${APP_URLS.dashboard}/login?redirect=${encodeURIComponent(window.location.href)}`;
    }
  }, [loading, isAuthenticated]);

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-xs font-semibold text-slate-500">Redirecting to centralized login...</span>
        </div>
      </div>
    );
  }

  const userRoles = Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [];
  const hasAccess =
    userRoles.includes("SUPER_ADMIN") ||
    userRoles.includes("ADMIN") ||
    userRoles.includes("UNDERWRITER") ||
    userRoles.includes("LOAN_OFFICER");

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Actuarial Access Restricted</h2>
          <p className="text-xs text-slate-500 mt-1.5 mb-6 leading-relaxed">
            Your enterprise account does not hold an Underwriter or Risk Officer credential required to generate actuarial tariffs.
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
                  <InsurancePage />
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
