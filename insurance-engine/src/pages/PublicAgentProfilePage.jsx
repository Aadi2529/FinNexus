import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Shield,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Building2,
  Award,
  Sparkles,
} from "lucide-react";
import { insuranceAPI } from "../services/api";

export default function PublicAgentProfilePage() {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Inquiry form state
  const [formData, setFormData] = useState({
    leadType: "INDIVIDUAL",
    fullName: "",
    mobile: "",
    email: "",
    city: "",
    pincode: "",
    policyType: "Health Insurance",
    message: "",
    consent: true,
    hpField: "", // Spam prevention honeypot
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);
        const res = await insuranceAPI.getPublicAgentProfile(slug);
        if (res.ok && res.data) {
          setProfile(res.data);
        } else {
          setError(res.error || "Agent profile not found or inactive.");
        }
      } catch (err) {
        setError("Unable to load agent profile.");
      } finally {
        setLoading(false);
      }
    }
    if (slug) loadProfile();
  }, [slug]);

  const handleSubmitInquiry = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!formData.fullName.trim() || !formData.mobile.trim()) {
      setSubmitError("Please provide your full name and mobile number.");
      return;
    }
    if (!formData.consent) {
      setSubmitError("Please confirm your consent for the agent to contact you.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await insuranceAPI.submitPublicInquiry(slug, {
        lead_type: formData.leadType,
        full_name: formData.fullName.trim(),
        mobile: formData.mobile.trim(),
        email: formData.email.trim() || null,
        city: formData.city.trim() || null,
        pincode: formData.pincode.trim() || null,
        policy_type: formData.policyType,
        message: formData.message.trim() || null,
        consent: formData.consent,
        hp_field: formData.hpField || null,
      });

      if (res.ok || res.status === 200 || res.status === 201) {
        setSubmitSuccess(true);
        setFormData({
          leadType: "INDIVIDUAL",
          fullName: "",
          mobile: "",
          email: "",
          city: "",
          pincode: "",
          policyType: "Health Insurance",
          message: "",
          consent: true,
          hpField: "",
        });
      } else {
        setSubmitError(res.error || "Failed to submit inquiry. Please try again.");
      }
    } catch (err) {
      setSubmitError("Network error submitting inquiry.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <span className="text-sm font-semibold text-slate-600">Loading authorized agent profile...</span>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Agent Profile Unavailable</h2>
          <p className="text-xs text-slate-500 mt-2 mb-6 leading-relaxed">
            {error || "The requested insurance advisor profile could not be found or is temporarily inactive."}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            Go to FinNexus Platform
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Brand Banner */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 tracking-tight">FinNexus</span>
              <span className="text-xs text-indigo-600 font-semibold ml-1.5 px-1.5 py-0.2 bg-indigo-50 border border-indigo-200 rounded">
                Verified Advisor
              </span>
            </div>
          </div>
          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>ID: {profile.agent_code}</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Advisor Information */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xl mb-4 border border-indigo-200">
                {profile.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <h1 className="text-xl font-bold text-slate-900">{profile.full_name}</h1>
              <p className="text-xs font-semibold text-indigo-600 mt-0.5">
                Certified Insurance Advisor & POSP
              </p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Associated with {profile.parent_firm || "FinNexus Enterprise"}</span>
              </p>

              {profile.bio && (
                <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
                  {profile.bio}
                </div>
              )}

              {/* Specialties */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Coverage Specialties</span>
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {(profile.specialties && profile.specialties.length > 0
                    ? profile.specialties
                    : ["Life Insurance", "Health Floater", "Motor & Fleet", "Corporate Group"]
                  ).map((spec, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>

              {/* Verified Contact Details (if visible) */}
              {profile.show_contact_info && (profile.mobile || profile.email) && (
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Verified Contact
                  </h3>
                  {profile.mobile && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <a href={`tel:${profile.mobile}`} className="hover:text-indigo-600 font-mono font-medium">
                        {profile.mobile}
                      </a>
                    </div>
                  )}
                  {profile.email && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Mail className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <a href={`mailto:${profile.email}`} className="hover:text-indigo-600 font-medium">
                        {profile.email}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Trust Banner */}
            <div className="bg-indigo-50/80 rounded-2xl border border-indigo-200/80 p-5 text-indigo-950">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">Zero Commission Bias Guarantee</h4>
                  <p className="text-[11px] text-indigo-800/90 mt-1 leading-relaxed">
                    All policy recommendations adhere to statutory disclosure norms and actuarial appropriateness rules.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Customer Lead Inquiry Form */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900">Request Policy Consultation</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Share your requirements with {profile.full_name} for tailored quotes and plan comparisons.
                </p>
              </div>

              {submitSuccess ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-6 text-center animate-in fade-in duration-200">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-emerald-900">Inquiry Submitted Successfully!</h3>
                  <p className="text-xs text-emerald-700 mt-1 mb-4">
                    Your request has been delivered to {profile.full_name}. You will be contacted shortly on your mobile.
                  </p>
                  <button
                    onClick={() => setSubmitSuccess(false)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    Submit Another Request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitInquiry} className="space-y-4">
                  {/* Honeypot field (hidden from human users) */}
                  <input
                    type="text"
                    name="hp_field"
                    value={formData.hpField}
                    onChange={(e) => setFormData({ ...formData, hpField: e.target.value })}
                    style={{ display: "none" }}
                    tabIndex={-1}
                    autoComplete="off"
                  />

                  {submitError && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Lead Type Selector */}
                  <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, leadType: "INDIVIDUAL" })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        formData.leadType === "INDIVIDUAL"
                          ? "bg-white text-indigo-700 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Individual / Family
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, leadType: "CORPORATE" })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        formData.leadType === "CORPORATE"
                          ? "bg-white text-indigo-700 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Corporate / Business
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {formData.leadType === "CORPORATE" ? "Company / Entity Name" : "Full Legal Name"} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={formData.leadType === "CORPORATE" ? "e.g. Acme Technologies Pvt Ltd" : "e.g. Vikramaditya Sharma"}
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Mobile Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9876543210"
                        value={formData.mobile}
                        onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs text-slate-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. client@domain.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        City <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Pune / Mumbai"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        PIN Code <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 411001"
                        maxLength={6}
                        value={formData.pincode}
                        onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs text-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Insurance Category of Interest <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.policyType}
                      onChange={(e) => setFormData({ ...formData, policyType: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs text-slate-900 bg-white"
                    >
                      <option value="Health Insurance">Family Floater & Individual Health Insurance</option>
                      <option value="Life Insurance">Term Life & Critical Illness Protection</option>
                      <option value="Motor Insurance">Comprehensive Motor / Commercial Vehicle</option>
                      <option value="Travel Insurance">International & Domestic Travel Insurance</option>
                      <option value="Fire Insurance">Fire & Special Perils Property Insurance</option>
                      <option value="Home Insurance">Comprehensive Home & Contents Protection</option>
                      <option value="Marine Insurance">Marine Cargo & Inland Transit Insurance</option>
                      <option value="Corporate / Group">Corporate Group Health & Keyman Cover</option>
                      <option value="Other Insurance">Other Specialized Insurance Needs</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Requirements or Message <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Mention preferred coverage amount, family member ages, or specific carrier preference..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs text-slate-900 resize-none"
                    />
                  </div>

                  <div className="pt-2">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.consent}
                        onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[11px] text-slate-600 leading-tight">
                        I authorize {profile.full_name} and FinNexus Enterprise to contact me regarding policy quotations. No marketing spam.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors mt-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending Request...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Consultation Request</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-slate-200 bg-white text-center text-xs text-slate-400">
        <p>FinNexus Enterprise Insurance Engine — Statutory Compliance Verified</p>
      </footer>
    </div>
  );
}




