import React, { useState, useEffect } from "react";
import api from "../services/api";
import {
  Umbrella,
  Shield,
  FileCheck,
  TrendingUp,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Plus,
  Loader2,
  DollarSign,
  Briefcase,
  HeartPulse,
  Car,
  Building2,
  ArrowRight,
} from "lucide-react";

export default function InsurancePage() {
  const [products, setProducts] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Quote Generator State
  const [selectedProduct, setSelectedProduct] = useState("TERM_LIFE");
  const [customerAge, setCustomerAge] = useState(32);
  const [sumAssured, setSumAssured] = useState(5000000);
  const [policyTerm, setPolicyTerm] = useState(20);
  const [isSmoker, setIsSmoker] = useState(false);
  const [hasConditions, setHasConditions] = useState(false);

  const [quoteResult, setQuoteResult] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  // Renewal Action State
  const [renewingPolicy, setRenewingPolicy] = useState(null);
  const [renewalMessage, setRenewalMessage] = useState("");
  const [bindingPolicy, setBindingPolicy] = useState(false);

  const handleBindPolicy = async () => {
    if (!quoteResult) return;
    setBindingPolicy(true);
    const res = await api.insurance.bindPolicy({
      product_code: selectedProduct,
      sum_assured: sumAssured,
      annual_premium: quoteResult.total_annual_premium,
      customer_name: "Active Client",
    });
    setBindingPolicy(false);
    if (res.ok) {
      setRenewalMessage(`Successfully bound coverage policy ${res.data.policy_number}!`);
      loadInsuranceData();
    }
  };

  const loadInsuranceData = async () => {
    setLoading(true);
    const [prodRes, polRes, statsRes] = await Promise.all([
      api.insurance.getProducts(),
      api.insurance.getPolicies(),
      api.insurance.getStats(),
    ]);

    if (prodRes.ok) setProducts(prodRes.data);
    if (polRes.ok) setPolicies(polRes.data);
    if (statsRes.ok) setStats(statsRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadInsuranceData();
  }, []);

  const handleCalculateQuote = async (e) => {
    e.preventDefault();
    setQuoteLoading(true);
    setQuoteError("");

    const res = await api.insurance.calculateQuote({
      product_code: selectedProduct,
      customer_age: parseInt(customerAge, 10),
      sum_assured: parseFloat(sumAssured),
      policy_term_years: parseInt(policyTerm, 10),
      is_smoker: isSmoker,
      has_pre_existing_conditions: hasConditions,
    });

    setQuoteLoading(false);
    if (res.ok) {
      setQuoteResult(res.data);
    } else {
      setQuoteError(res.error);
    }
  };

  const handleRenewPolicy = async (policyNumber) => {
    setRenewingPolicy(policyNumber);
    setRenewalMessage("");

    const res = await api.insurance.renewPolicy(policyNumber, 1);
    setRenewingPolicy(null);

    if (res.ok) {
      setRenewalMessage(res.data.message);
      // Reload policies
      const polRes = await api.insurance.getPolicies();
      if (polRes.ok) setPolicies(polRes.data);
    }
  };

  const getProductIcon = (code) => {
    switch (code) {
      case "TERM_LIFE":
        return <Shield className="w-5 h-5 text-indigo-600" />;
      case "HEALTH_SHIELD":
        return <HeartPulse className="w-5 h-5 text-emerald-600" />;
      case "MOTOR_AUTO":
        return <Car className="w-5 h-5 text-blue-600" />;
      case "COMMERCIAL_PROP":
        return <Building2 className="w-5 h-5 text-purple-600" />;
      default:
        return <Umbrella className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Module Header */}
      <div className="pb-6 border-b border-slate-200">
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          Module 03 • Policy & Underwriting
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
          FinNexus Insurance Engine
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Product tariff catalog, actuarial risk-weighted quotation calculator, and policy renewal operations.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Policies in Portfolio
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {stats?.total_policies ?? "—"}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">
            {stats?.active_policies ?? 0} active coverage contracts
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Renewals Due (30 Days)
          </span>
          <span className="text-2xl font-bold text-amber-600 mt-1 block">
            {stats?.expiring_soon_policies ?? "—"}
          </span>
          <span className="text-[11px] text-slate-400 font-medium">Action required</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Gross Written Premium
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            ₹{stats?.gross_written_premium ? stats.gross_written_premium.toLocaleString("en-IN") : "—"}
          </span>
          <span className="text-[11px] text-teal-600 font-medium">Annualized AUM</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Portfolio Retention
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {stats?.renewal_retention_rate ?? "94.8"}%
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">Target &gt; 90%</span>
        </div>
      </div>

      {/* Product Catalog Grid */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-3">Underwriting Product Catalog</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {products.map((prod) => (
            <div
              key={prod.code}
              className={`p-4 rounded-xl bg-white border transition-all cursor-pointer ${
                selectedProduct === prod.code
                  ? "border-indigo-600 ring-2 ring-indigo-500/10 shadow-md"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              onClick={() => setSelectedProduct(prod.code)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-slate-50">{getProductIcon(prod.code)}</div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {prod.category}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-sm">{prod.name}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{prod.description}</p>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">Tariff:</span>
                <span className="font-semibold text-indigo-700">₹{prod.base_annual_rate_per_thousand} / 1k</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Quotation Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Controls */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Umbrella className="w-4 h-4 text-indigo-600" />
              Risk Quotation Engine
            </h2>
            <span className="text-xs font-semibold text-indigo-600 font-mono">
              Selected: {selectedProduct}
            </span>
          </div>

          {quoteError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {quoteError}
            </div>
          )}

          <form onSubmit={handleCalculateQuote} className="space-y-4 text-xs">
            {/* Sum Assured */}
            <div>
              <div className="flex items-center justify-between font-semibold text-slate-700 mb-1.5">
                <span>Sum Assured (Coverage Amount)</span>
                <span className="text-indigo-700 font-mono text-sm">
                  ₹{Number(sumAssured).toLocaleString("en-IN")}
                </span>
              </div>
              <input
                type="range"
                min="500000"
                max="20000000"
                step="500000"
                value={sumAssured}
                onChange={(e) => setSumAssured(e.target.value)}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            {/* Age & Term */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Proposer Age (Years)</label>
                <input
                  type="number"
                  min="18"
                  max="70"
                  required
                  value={customerAge}
                  onChange={(e) => setCustomerAge(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Policy Term (Years)</label>
                <input
                  type="number"
                  min="1"
                  max="40"
                  required
                  value={policyTerm}
                  onChange={(e) => setPolicyTerm(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                />
              </div>
            </div>

            {/* Actuarial Risk Multipliers */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <span className="font-bold text-slate-800 block text-xs">Actuarial Risk Loadings</span>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSmoker}
                  onChange={(e) => setIsSmoker(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span className="text-slate-700">Tobacco / Cigarette Consumption (+35% Loading)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasConditions}
                  onChange={(e) => setHasConditions(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span className="text-slate-700">Declared Pre-existing Medical Conditions (+25% Loading)</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={quoteLoading}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2"
            >
              {quoteLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Computing Premium Multipliers...</span>
                </>
              ) : (
                "Generate Risk-Adjusted Quotation"
              )}
            </button>
          </form>
        </div>

        {/* Quotation Summary Card */}
        <div className="lg:col-span-6 space-y-4">
          {quoteResult ? (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-mono font-semibold text-indigo-700">{quoteResult.quote_id}</span>
                  <h3 className="font-bold text-slate-900 text-base">{quoteResult.product_name}</h3>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Calculated
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Base Annual Tariff:</span>
                  <span className="font-mono font-semibold">₹{parseFloat(quoteResult.base_annual_premium).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Underwriting Risk Loading:</span>
                  <span className="font-mono font-semibold text-amber-600">+₹{parseFloat(quoteResult.risk_loading).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Statutory GST (18%):</span>
                  <span className="font-mono font-semibold">+₹{parseFloat(quoteResult.gst_tax).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between py-2 text-sm font-bold text-slate-900 bg-slate-50 px-3 rounded-lg">
                  <span>Total Annual Premium:</span>
                  <span className="text-indigo-700 font-mono">₹{parseFloat(quoteResult.total_annual_premium).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between py-1 px-3 text-xs text-slate-600">
                  <span>Monthly Installment:</span>
                  <span className="font-mono font-semibold">₹{parseFloat(quoteResult.monthly_installment_premium).toLocaleString("en-IN")}/mo</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBindPolicy}
                disabled={bindingPolicy}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                {bindingPolicy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Binding Coverage...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Bind Coverage Contract Now</span>
                  </>
                )}
              </button>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                {quoteResult.disclaimer}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400">
              <Umbrella className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-medium">Select parameters and click "Generate Risk-Adjusted Quotation".</p>
            </div>
          )}
        </div>
      </div>

      {/* Managed Policies & Renewal Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Policy Management & Renewals</h3>
            <p className="text-xs text-slate-500">
              Track portfolio expiration dates, renewal eligibility, and issue 1-year renewals.
            </p>
          </div>
          {renewalMessage && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              {renewalMessage}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                <th className="py-3 px-4">Policy Number</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Product & Category</th>
                <th className="py-3 px-4">Sum Assured</th>
                <th className="py-3 px-4">Annual Premium</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-600">No active policies in portfolio</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Generate a quotation above and click "Bind Coverage Contract" to issue active policies.
                    </p>
                  </td>
                </tr>
              ) : (
                policies.map((p) => (
                <tr key={p.policy_number} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold text-slate-800">
                    {p.policy_number}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {p.customer_name}
                  </td>
                  <td className="py-3 px-4">
                    <div>{p.product_name}</div>
                    <div className="text-[11px] text-slate-400">{p.category}</div>
                  </td>
                  <td className="py-3 px-4 font-mono font-medium">
                    ₹{parseFloat(p.sum_assured).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">
                    ₹{parseFloat(p.annual_premium).toLocaleString("en-IN")}/yr
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <div>{p.expiry_date}</div>
                    <div
                      className={`text-[10px] font-semibold ${
                        p.days_to_expiry <= 30 ? "text-amber-600" : "text-slate-400"
                      }`}
                    >
                      {p.days_to_expiry} days remaining
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        p.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {p.renewal_eligible ? (
                      <button
                        type="button"
                        onClick={() => handleRenewPolicy(p.policy_number)}
                        disabled={renewingPolicy === p.policy_number}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <RefreshCw className={`w-3 h-3 ${renewingPolicy === p.policy_number ? "animate-spin" : ""}`} />
                        <span>Renew (1 Yr)</span>
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Current</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
