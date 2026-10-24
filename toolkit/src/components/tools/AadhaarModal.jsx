import React, { useState } from "react";
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Archive,
  Image as ImageIcon,
  Shield,
  RefreshCw,
  Eye,
} from "lucide-react";
import api from "../../services/api";
import { formatDobInput, validateDob } from "../../utils/dateFormatter";

export default function AadhaarModal({ isOpen, onClose, initialFile = null }) {
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [dobError, setDobError] = useState("");
  const [normalFile, setNormalFile] = useState(initialFile);
  const [maskedFile, setMaskedFile] = useState(null);
  const [isDraggingNormal, setIsDraggingNormal] = useState(false);
  const [isDraggingMasked, setIsDraggingMasked] = useState(false);

  React.useEffect(() => {
    if (initialFile) {
      setNormalFile(initialFile);
    }
  }, [initialFile]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [previewUrls, setPreviewUrls] = useState({});

  if (!isOpen) return null;

  const handleReset = () => {
    setFullName("");
    setDob("");
    setDobError("");
    setNormalFile(null);
    setMaskedFile(null);
    setLoading(false);
    setError("");
    setResult(null);
    setPreviewUrls({});
  };

  const handleDobChange = (e) => {
    const formatted = formatDobInput(e.target.value, dob);
    setDob(formatted);
    if (formatted.length === 10) {
      const check = validateDob(formatted);
      setDobError(check.isValid ? "" : check.error);
    } else {
      setDobError("");
    }
  };

  const handleDobBlur = () => {
    if (dob.trim()) {
      const check = validateDob(dob);
      setDobError(check.isValid ? "" : check.error);
    } else {
      setDobError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!normalFile && !maskedFile) {
      setError("Please upload at least one Aadhaar PDF (Normal or Masked).");
      return;
    }
    if (!fullName.trim() || fullName.trim().replace(/[^a-zA-Z]/g, "").length < 4) {
      setError("Please enter client's full name (at least 4 alphabetical characters).");
      return;
    }
    if (!dob.trim()) {
      setError("Please provide client's date of birth.");
      return;
    }
    const dobCheck = validateDob(dob);
    if (!dobCheck.isValid) {
      setDobError(dobCheck.error);
      setError(dobCheck.error);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("full_name", fullName.trim());
    formData.append("dob", dob.trim());
    if (normalFile) formData.append("normal_file", normalFile);
    if (maskedFile) formData.append("masked_file", maskedFile);

    const res = await api.toolkit.processAadhaar(formData);
    setLoading(false);

    if (res.ok) {
      setResult(res.data);
      // Fetch preview images for card_image items
      res.data.files.forEach(async (f) => {
        if (f.file_type === "card_image" && f.preview_url) {
          const blobUrl = await api.toolkit.getPreviewBlobUrl(f.preview_url);
          if (blobUrl) {
            setPreviewUrls((prev) => ({ ...prev, [f.name]: blobUrl }));
          }
        }
      });
    } else {
      setError(res.error || "Failed to process Aadhaar document.");
    }
  };

  const handleDownload = async (url, filename) => {
    try {
      await api.toolkit.downloadFile(url, filename);
    } catch (err) {
      alert("Download failed: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Aadhaar PDF Processor Studio</h2>
              <p className="text-xs text-slate-300">
                UIDAI Authorized Decryption, Smart Boundary Cropping & High-Res JPG Export
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-900">Processing Issue</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Client Details Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Client Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aditya Subhash Thakare"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    First 4 letters are used for standard password rule.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date of Birth (DOB) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={dob}
                    onChange={handleDobChange}
                    onBlur={handleDobBlur}
                    placeholder="DD/MM/YYYY (e.g. 26/05/2004)"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs text-slate-900 focus:outline-none focus:ring-2 focus:border-transparent ${
                      dobError
                        ? "border-rose-400 focus:ring-rose-500 bg-rose-50/20"
                        : "border-slate-300 focus:ring-teal-500"
                    }`}
                  />
                  {dobError ? (
                    <p className="text-[11px] text-rose-600 font-medium mt-1">{dobError}</p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Auto-formats DD/MM/YYYY. 4-digit birth year appended for authorized unlocking.
                    </p>
                  )}
                </div>
              </div>

              {/* Security Badge */}
              <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200/80 flex items-center gap-3 text-xs text-teal-900">
                <Shield className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <span>
                  <strong>Zero-Leak Security:</strong> Passwords are derived in-memory and never stored, logged, or returned. Decrypted files exist only in private temporary sessions.
                </span>
              </div>

              {/* PDF Upload Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Normal Aadhaar */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingNormal(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingNormal(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingNormal(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
                      setNormalFile(file);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-4 transition text-center ${
                    isDraggingNormal
                      ? "border-teal-500 bg-teal-50/80 shadow-md ring-2 ring-teal-500/20 scale-[1.01]"
                      : "border-slate-200 hover:border-teal-500 bg-slate-50/50"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <FileText
                      className={`w-8 h-8 mb-2 transition ${
                        isDraggingNormal ? "text-teal-600 scale-110" : "text-slate-400"
                      }`}
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      {isDraggingNormal ? "Drop Normal Aadhaar PDF" : "Normal Aadhaar PDF"}
                    </span>
                    <span className="text-[11px] text-slate-400 mb-3">
                      {isDraggingNormal ? "Release to attach" : "Drag & drop or browse (12-digit format)"}
                    </span>

                    {normalFile ? (
                      <div className="w-full flex items-center justify-between bg-white p-2 rounded-lg border border-teal-200 text-xs shadow-sm">
                        <span className="truncate max-w-[180px] font-medium text-slate-700">
                          {normalFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setNormalFile(null)}
                          className="text-slate-400 hover:text-rose-600 ml-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs shadow-sm transition">
                        Select PDF
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={(e) => setNormalFile(e.target.files[0])}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Masked Aadhaar */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingMasked(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingMasked(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingMasked(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
                      setMaskedFile(file);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-4 transition text-center ${
                    isDraggingMasked
                      ? "border-teal-500 bg-teal-50/80 shadow-md ring-2 ring-teal-500/20 scale-[1.01]"
                      : "border-slate-200 hover:border-teal-500 bg-slate-50/50"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <FileText
                      className={`w-8 h-8 mb-2 transition ${
                        isDraggingMasked ? "text-teal-600 scale-110" : "text-slate-400"
                      }`}
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      {isDraggingMasked ? "Drop Masked Aadhaar PDF" : "Masked Aadhaar PDF"}
                    </span>
                    <span className="text-[11px] text-slate-400 mb-3">
                      {isDraggingMasked ? "Release to attach" : "Drag & drop or browse (Redacted 8-digit format)"}
                    </span>

                    {maskedFile ? (
                      <div className="w-full flex items-center justify-between bg-white p-2 rounded-lg border border-teal-200 text-xs shadow-sm">
                        <span className="truncate max-w-[180px] font-medium text-slate-700">
                          {maskedFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setMaskedFile(null)}
                          className="text-slate-400 hover:text-rose-600 ml-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs shadow-sm transition">
                        Select PDF
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={(e) => setMaskedFile(e.target.files[0])}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>



              {/* Submit CTA */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-700/20 flex items-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Decrypting & Cropping...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>Process Aadhaar Documents</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Results View */
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-semibold">{result.message}</span>
                </div>
                {result.zip_download_url && (
                  <button
                    onClick={() =>
                      handleDownload(result.zip_download_url, "aadhaar_processed_files.zip")
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Download All (ZIP)</span>
                  </button>
                )}
              </div>

              {/* Card Image Previews */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {result.files
                  .filter((f) => f.file_type === "card_image")
                  .map((img) => (
                    <div
                      key={img.name}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-center"
                    >
                      <span className="text-xs font-bold text-slate-800 capitalize">
                        {img.name.replace(/_/g, " ")}
                      </span>
                      {previewUrls[img.name] ? (
                        <div className="rounded-lg overflow-hidden border border-slate-200 bg-white max-h-48 flex items-center justify-center">
                          <img
                            src={previewUrls[img.name]}
                            alt={img.name}
                            className="object-contain max-h-48 w-full"
                          />
                        </div>
                      ) : (
                        <div className="h-32 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                          <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              {/* Download Files List */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Available Generated Outputs
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.files.map((file) => (
                    <div
                      key={file.name}
                      className="p-3 rounded-xl bg-white border border-slate-200 hover:border-teal-500 shadow-sm flex items-center justify-between transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {file.file_type === "card_image" ? (
                          <ImageIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-teal-600 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {(file.size_bytes / 1024).toFixed(1)} KB • {file.file_type}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownload(file.download_url, file.name)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 transition"
                        title="Download file"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Process Another File</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
