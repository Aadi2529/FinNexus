import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { tokenStorage } from "../services/api";
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  Users,
  Wrench,
  Shield,
  CheckCircle2,
  AlertCircle,
  Layers,
} from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const searchParams = new URLSearchParams(location.search);
  const redirectUrl = searchParams.get("redirect") || location.state?.from?.pathname || "/";
  const reason = searchParams.get("reason");

  const getSessionNotice = () => {
    if (reason === "inactivity") {
      return "Your session has expired due to 15 minutes of inactivity. Please log in again.";
    }
    if (reason === "absolute_timeout") {
      return "Your session has reached the 8-hour maximum limit. Please sign in again.";
    }
    if (reason === "remote_logout") {
      return "You have signed out from another tab or window.";
    }
    if (reason === "expired") {
      return "Your session has expired. Please log in to continue.";
    }
    return null;
  };
  const sessionNotice = getSessionNotice();

  // Prevent open redirect vulnerabilities by strictly allowlisting valid application origins
  const isAllowedOrigin = (urlStr) => {
    try {
      const parsed = new URL(urlStr, window.location.origin);
      const hostname = parsed.hostname.toLowerCase();
      const port = parsed.port;

      // Allow known ecosystem localhost & 127.0.0.1 ports
      const allowedPorts = ["5173", "5174", "5175", "5176", "3000", "8000"];
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return allowedPorts.includes(port);
      }

      // Allow production ecosystem domains and subdomains
      if (
        hostname === "finnexus.com" ||
        hostname.endsWith(".finnexus.com") ||
        hostname === "financeflow.com" ||
        hostname.endsWith(".financeflow.com")
      ) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  const getSafeHandoffTarget = (rawRedirect) => {
    if (!rawRedirect) return "/";

    // Standard relative internal routes (excluding protocol-relative //)
    if (rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")) {
      return rawRedirect;
    }

    // Absolute URLs: Validate against explicit allowlist of permitted origins
    if (rawRedirect.startsWith("http://") || rawRedirect.startsWith("https://")) {
      if (isAllowedOrigin(rawRedirect)) {
        return tokenStorage.getHandoffUrl(rawRedirect);
      }
    }

    // Fall back to dashboard root for invalid or unauthorized redirect targets
    return "/";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);

    if (result.success) {
      const safeTarget = getSafeHandoffTarget(redirectUrl);
      if (safeTarget.startsWith("http://") || safeTarget.startsWith("https://")) {
        window.location.href = safeTarget;
      } else {
        navigate(safeTarget, { replace: true });
      }
    } else {
      setErrorMessage(result.error);
    }
  };

  const fillDemoAccount = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setErrorMessage("");
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-slate-50 font-sans">
      {/* Left Brand Panel */}
      <div className="lg:col-span-5 bg-navy-900 border-r border-slate-800 p-8 lg:p-12 flex flex-col justify-between text-white relative overflow-hidden">
        {/* Subtle geometric pattern overlay */}
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />

        <div>
          {/* Brand header */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 shadow-sm">
              <Layers className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white block">FinNexus</span>
              <span className="text-xs text-teal-400 font-medium tracking-wide">ENTERPRISE ECOSYSTEM</span>
            </div>
          </div>

          <div className="space-y-3 mb-10">
            <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
              One Workspace. <br />
              <span className="text-teal-400">Three Business Modules.</span>
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed max-w-md">
              Finance operations platform uniting Borrower 360 CRM, precision financial calculators, and actuarial insurance underwriting.
            </p>
          </div>

          {/* Module capability cards */}
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-white">FinNexus CRM</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Manage borrower lifecycle, CIBIL bureau ratings, and task workflows.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-white">FinNexus Toolkit</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Reducing-balance EMI, SIP compounding, and magic-byte KYC vault.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-white">FinNexus Insurance Engine</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tariff catalog, risk quotations, and policy renewals.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security footer */}
        <div className="pt-8 border-t border-slate-800/80 mt-8">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Bank-Grade Argon2id &bull; Dual-Token JWT &bull; Multi-Subdomain SSO</span>
          </div>
        </div>
      </div>

      {/* Right Login Card */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in to your account</h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter your enterprise credentials to access your permitted workspace.
              </p>
            </div>

            {/* Session notice */}
            {sessionNotice && !errorMessage && (
              <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{sessionNotice}</span>
              </div>
            )}

            {/* Error alert */}
            {errorMessage && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="email-input">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@finnexus.com"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="password-input">
                    Password
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      setErrorMessage("Self-service reset is managed by enterprise administrators.");
                    }}
                    className="text-[11px] font-medium text-teal-600 hover:text-teal-700"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password-input"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-10 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-xs text-slate-600 select-none">Remember this device</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-navy-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-navy-900/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                    <span>Verifying session...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Platform</span>
                    <ArrowRight className="w-4 h-4 text-teal-400" />
                  </>
                )}
              </button>
            </form>

            {/* Initial System Authority */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Initial System Authority
                </span>
                <span className="text-[10px] font-mono text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  Super Admin
                </span>
              </div>
              <button
                type="button"
                onClick={() => fillDemoAccount("admin@finnexus.com", "Admin@12345")}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 flex items-center justify-between transition-colors text-left"
              >
                <div>
                  <span className="block text-xs font-bold text-slate-900">Enterprise Super Admin</span>
                  <span className="block text-[10px] text-slate-500 font-mono">admin@finnexus.com</span>
                </div>
                <span className="text-[11px] font-semibold text-teal-600">Prefill Credentials &rarr;</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
