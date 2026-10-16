import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppShell from "./components/AppShell";
import ToolkitPage from "./pages/ToolkitPage";
import { Loader2, ShieldAlert, ArrowRight } from "lucide-react";
import { APP_URLS } from "./services/api";

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

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
                  <ToolkitPage />
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
