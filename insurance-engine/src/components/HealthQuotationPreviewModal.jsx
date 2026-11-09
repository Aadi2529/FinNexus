import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Edit,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Shield,
  Calendar,
  MapPin,
  User,
  Users,
  Download,
  Award,
} from "lucide-react";
import { api } from "../services/api";
import { formatInr, formatDateDMY, STANDARD_DISCLAIMER } from "../utils/ageCalculator";

export default function HealthQuotationPreviewModal({
  quotation: initialQuotation,
  quotationData,
  quotationId,
  isOpen = true,
  onClose,
  onEdit,
  onDuplicate,
}) {
  const [quotation, setQuotation] = useState(initialQuotation || quotationData || null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(null); // 'pdf' | 'excel' | 'image' | null
  const [exportSuccess, setExportSuccess] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialQuotation) {
      setQuotation(initialQuotation);
    } else if (quotationData) {
      setQuotation(quotationData);
    } else if (quotationId && isOpen) {
      setLoading(true);
      setError("");
      api.insurance.quotations.get(quotationId).then((res) => {
        if (res.ok) {
          setQuotation(res.data);
        } else {
          setError(res.error || "Failed to load quotation for preview.");
        }
        setLoading(false);
      });
    }
  }, [initialQuotation, quotationData, quotationId, isOpen]);

  // Compute dynamically filtered matrix
  const fMatrix = useMemo(() => {
    if (!quotation) return { columns: [], rows: [] };
    if (quotation.filtered_matrix) return quotation.filtered_matrix;

    const cpList = quotation.company_plans || [];
    const TIERS = [
      { code: "5L", amount: 500000, label: "5L" },
      { code: "7.5L", amount: 750000, label: "7.5L" },
      { code: "10L", amount: 1000000, label: "10L" },
      { code: "15L", amount: 1500000, label: "15L" },
      { code: "20L", amount: 2000000, label: "20L" },
      { code: "25L", amount: 2500000, label: "25L" },
      { code: "50L", amount: 5000000, label: "50L" },
      { code: "1CR", amount: 10000000, label: "1CR" },
      { code: "2CR", amount: 20000000, label: "2CR" },
    ];
    const populatedCodes = new Set();
    const rows = [];
    for (const cp of cpList) {
      const prems = cp.premiums || [];
      const premMap = {};
      for (const p of prems) {
        const amt = Number(p.premium_amount);
        if (amt && amt > 0) {
          premMap[p.sum_insured_code] = amt;
          populatedCodes.add(p.sum_insured_code);
        }
      }
      if (Object.keys(premMap).length > 0) {
        rows.push({
          plan_id: cp.id,
          display_company_name: cp.display_company_name || cp.display_name || "Insurer",
          display_plan_variant: cp.display_plan_variant || "",
          notes: cp.notes,
          premiums_by_tier: premMap,
        });
      }
    }
    const columns = TIERS.filter((t) => populatedCodes.has(t.code));
    return { columns, rows };
  }, [quotation]);

  // Compute lowest premium in each column
  const lowestByTier = useMemo(() => {
    const mins = {};
    if (!fMatrix.columns || !fMatrix.rows) return mins;
    fMatrix.columns.forEach((col) => {
      const vals = [];
      fMatrix.rows.forEach((r) => {
        const v = r.premiums_by_tier[col.code];
        if (v !== undefined && v !== null && Number(v) > 0) {
          vals.push(Number(v));
        }
      });
      if (vals.length > 1) {
        mins[col.code] = Math.min(...vals);
      }
    });
    return mins;
  }, [fMatrix]);

  if (!isOpen) return null;
  if (!quotation && !loading) return null;

  const handleExport = async (format) => {
    if (!quotation?.id) {
      setError("Please save the quotation before exporting files.");
      return;
    }
    setExporting(format);
    setError("");
    setExportSuccess(null);

    try {
      let res;
      if (format === "pdf") {
        res = await api.insurance.quotations.exportPdf(quotation.id, quotation.quotation_number);
      } else if (format === "excel") {
        res = await api.insurance.quotations.exportExcel(quotation.id, quotation.quotation_number);
      } else if (format === "image") {
        res = await api.insurance.quotations.exportImage(quotation.id, quotation.quotation_number);
      }

      if (res && res.ok) {
        setExportSuccess(`Successfully downloaded ${format.toUpperCase()} export!`);
        setTimeout(() => setExportSuccess(null), 3500);
      } else {
        setError(res?.error || `Failed to export ${format.toUpperCase()}`);
      }
    } catch (err) {
      setError(`Export error: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  const hasPopulatedMatrix = fMatrix.rows.length > 0 && fMatrix.columns.length > 0;
  const isSaved = Boolean(quotation?.id);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header Bar */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">
                FinNexus Health Advisory Portfolio
              </div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{quotation?.quotation_number || "Draft Proposal Preview"}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                    quotation?.status === "ISSUED"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  }`}
                >
                  {quotation?.status || "DRAFT"}
                </span>
                {!isSaved && (
                  <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30">
                    Live Form State
                  </span>
                )}
              </h2>
            </div>
          </div>

          {/* Quick Export & Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport("pdf")}
              disabled={!!exporting || !isSaved}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-40"
              title={isSaved ? "Download Vector PDF" : "Save quotation to enable PDF download"}
            >
              {exporting === "pdf" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Export PDF</span>
            </button>

            <button
              onClick={() => handleExport("excel")}
              disabled={!!exporting || !isSaved}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-40"
              title={isSaved ? "Download Formatted Excel" : "Save quotation to enable Excel download"}
            >
              {exporting === "excel" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Export Excel</span>
            </button>

            <button
              onClick={() => handleExport("image")}
              disabled={!!exporting || !isSaved}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-40"
              title={isSaved ? "Download PNG Image" : "Save quotation to enable Image download"}
            >
              {exporting === "image" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Export PNG</span>
            </button>

            {onEdit && isSaved && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(quotation.id);
                }}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}

            {onDuplicate && isSaved && (
              <button
                onClick={() => {
                  onClose();
                  onDuplicate(quotation.id);
                }}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicate</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Toasts */}
        {exportSuccess && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs px-5 py-2.5 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportSuccess}</span>
          </div>
        )}
        {error && (
          <div className="bg-rose-50 border-b border-rose-200 text-rose-800 text-xs px-5 py-2.5 font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Document Body (Rendered proposal layout) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 bg-slate-50/60">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 sm:p-6 space-y-5">
            {/* 1. Proposal Title & Metadata Header */}
            <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                  Custom Health Insurance Quotation Proposal
                </span>
                <h1 className="text-xl font-black text-slate-900 mt-1.5">
                  {quotation?.quotation_title || quotation?.title}
                </h1>
                <div className="text-xs text-slate-500 mt-0.5">
                  Advisor: <strong className="text-slate-800">{quotation?.advisor_name || "Enterprise Advisor"}</strong>
                </div>
              </div>

              <div className="text-left md:text-right text-xs space-y-1">
                <div className="font-mono font-black text-slate-900 text-sm">
                  {quotation?.quotation_number || "DRAFT-PREVIEW"}
                </div>
                <div className="text-slate-500 flex items-center md:justify-end gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Date: {formatDateDMY(quotation?.quotation_date)}</span>
                </div>
                <div className="text-slate-500 flex items-center md:justify-end gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>Client PIN: <strong className="text-slate-800 font-mono">{quotation?.pin_code}</strong></span>
                </div>
              </div>
            </div>

            {/* 2. Statutory Disclaimer Banner (Exact required text) */}
            <div className="bg-amber-50/90 border border-amber-300/80 rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xs">
              <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0 font-bold text-xs">
                !
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                  Official Advisory Disclaimer
                </div>
                <p className="text-xs font-bold text-amber-950 mt-0.5 leading-snug">
                  {quotation?.disclaimer_snapshot || STANDARD_DISCLAIMER}
                </p>
              </div>
            </div>

            {/* 3. Proposer & Summary Metadata Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 text-xs">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Proposer Client
                </span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {quotation?.client_name}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  PIN Code
                </span>
                <span className="font-bold text-slate-900 mt-0.5 block font-mono">
                  {quotation?.pin_code}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Premium Basis
                </span>
                <span className="font-bold text-indigo-700 mt-0.5 block">
                  {quotation?.premium_basis === "GROSS"
                    ? "Gross (Incl. 18% GST)"
                    : "Net (Excl. Tax)"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Proposal Status
                </span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {quotation?.status || "DRAFT"}
                </span>
              </div>
            </div>

            {/* 4. Family Members Table & Exact Age Breakdown */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Insured Family Members &amp; Exact Calendar Age</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Reference Date: {formatDateDMY(quotation?.quotation_date)}
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white font-semibold text-[11px]">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[180px]">Member Full Name</th>
                      <th className="py-2.5 px-3 min-w-[110px]">Relationship</th>
                      <th className="py-2.5 px-3 min-w-[80px]">Gender</th>
                      <th className="py-2.5 px-3 min-w-[120px]">DOB (DD-MM-YYYY)</th>
                      <th className="py-2.5 px-3 text-center bg-slate-900 font-bold w-24">AGE (Years)</th>
                      <th className="py-2.5 px-3 text-center bg-slate-900 font-bold w-20">MON</th>
                      <th className="py-2.5 px-3 text-center bg-slate-900 font-bold w-20">DAYS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {quotation?.members && quotation.members.length > 0 ? (
                      quotation.members.map((m, idx) => (
                        <tr
                          key={m.id || idx}
                          className={idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"}
                        >
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-xs">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {m.full_name || m.name}
                            {m.is_primary && (
                              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Primary
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-medium">{m.relationship}</td>
                          <td className="py-2.5 px-3 text-slate-500">{m.gender || "—"}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {formatDateDMY(m.date_of_birth || m.dob)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-black text-slate-900 bg-indigo-50/40 font-mono text-sm">
                            {m.age_years !== null && m.age_years !== undefined ? m.age_years : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800 bg-indigo-50/40 font-mono">
                            {m.age_months !== null && m.age_months !== undefined ? m.age_months : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800 bg-indigo-50/40 font-mono">
                            {m.age_days !== null && m.age_days !== undefined ? m.age_days : "—"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400 text-xs">
                          No family members added.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. Dynamically Filtered Premium Comparison Matrix */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>Dynamic Comparison Matrix (Populated Sum Insured Tiers)</span>
                </h3>
                <span className="text-[11px] text-indigo-600 font-bold bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                  {fMatrix.columns.length} Tiers Displayed
                </span>
              </div>

              {hasPopulatedMatrix ? (
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white font-semibold text-[11px]">
                        <th className="py-3 px-3.5 min-w-[210px]">
                          Company / Plan Variant
                        </th>
                        {fMatrix.columns.map((col) => (
                          <th
                            key={col.code}
                            className="py-3 px-3 text-right font-black tracking-tight min-w-[110px] bg-slate-800"
                          >
                            <div>{col.label}</div>
                            {col.amount && (
                              <div className="text-[9px] font-normal text-slate-400 font-mono">
                                {formatInr(col.amount)}
                              </div>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fMatrix.rows.map((row, idx) => (
                        <tr
                          key={row.plan_id || idx}
                          className={idx % 2 === 1 ? "bg-slate-50/60" : "bg-white"}
                        >
                          <td className="py-3 px-3.5 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span>{row.display_company_name}</span>
                              <span className="text-slate-500 font-normal">
                                {row.display_plan_variant}
                              </span>
                            </div>
                            {row.notes && (
                              <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                                {row.notes}
                              </div>
                            )}
                          </td>
                          {fMatrix.columns.map((col) => {
                            const val = row.premiums_by_tier[col.code];
                            const isLowest =
                              val !== undefined &&
                              val !== null &&
                              lowestByTier[col.code] &&
                              Number(val) === lowestByTier[col.code];

                            return (
                              <td
                                key={col.code}
                                className={`py-3 px-3 text-right font-mono text-xs ${
                                  isLowest
                                    ? "bg-emerald-50/50"
                                    : ""
                                }`}
                              >
                                {val ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span
                                      className={`font-black ${
                                        isLowest
                                          ? "text-emerald-800 bg-emerald-100/70 px-1.5 py-0.5 rounded border border-emerald-300"
                                          : "text-slate-900"
                                      }`}
                                    >
                                      {formatInr(val)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-1">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    No Premiums Populated Yet
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Enter premiums for insurer plan variants and Sum Insured tiers to view the dynamically filtered comparison.
                  </p>
                </div>
              )}
            </div>

            {/* 6. Notes if present */}
            {quotation?.notes && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700">
                <span className="font-bold text-slate-900 block mb-1">
                  Advisor Remarks &amp; Underwriting Notes:
                </span>
                <p className="whitespace-pre-line text-slate-600 leading-relaxed">
                  {quotation.notes}
                </p>
              </div>
            )}

            {/* 7. Footer */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400">
              <div>
                FinNexus Enterprise Insurance Engine • Health Advisory Portfolio
              </div>
              <div className="mt-1 sm:mt-0 font-mono">
                Proposal Generated {new Date().toLocaleDateString("en-IN")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
