import React, { useState } from "react";
import {
  X,
  CreditCard,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Archive,
  Image as ImageIcon,
  Shield,
  Sliders,
  RefreshCw,
} from "lucide-react";
import api from "../../services/api";

export default function PanModal({ isOpen, onClose, initialFile = null }) {
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [panFile, setPanFile] = useState(initialFile);
  const [isDragging, setIsDragging] = useState(false);
  const [enableCustomCrop, setEnableCustomCrop] = useState(false);
  const [cropBox, setCropBox] = useState({ yPercent: 54, heightPercent: 40 });

  React.useEffect(() => {
    if (initialFile) {
      setPanFile(initialFile);
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
    setPanFile(null);
    setLoading(false);
    setError("");
    setResult(null);
    setPreviewUrls({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!panFile) {
      setError("Please upload the PAN Card PDF.");
      return;
    }
    if (!fullName.trim()) {
      setError("Please provide the client full name.");
      return;
    }
    if (!dob.trim()) {
      setError("Please enter client's date of birth.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", panFile);
    formData.append("full_name", fullName.trim());
    formData.append("dob", dob.trim());

    if (enableCustomCrop) {
      const y0 = 841.9 * (cropBox.yPercent / 100);
      const h = 841.9 * (cropBox.heightPercent / 100);
      const customRect = [35.0, y0, 560.0, Math.min(820.0, y0 + h)];
      formData.append("custom_crop_json", JSON.stringify(customRect));
    }

    const res = await api.toolkit.processPAN(formData);
    setLoading(false);

    if (res.ok) {
      setResult(res.data);
      res.data.files.forEach(async (f) => {
        if (f.file_type === "card_image" && f.preview_url) {
          const blobUrl = await api.toolkit.getPreviewBlobUrl(f.preview_url);
          if (blobUrl) {
            setPreviewUrls((prev) => ({ ...prev, [f.name]: blobUrl }));
          }
        }
      });
    } else {
      setError(res.error || "Failed to decrypt and process PAN card.");
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
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">PAN Card PDF Processor</h2>
              <p className="text-xs text-slate-300">
                Statutory DDMMYYYY Unlocking, ID-1 Card Extraction & 300 DPI Export
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
              {/* Client Info */}
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
                    placeholder="e.g. Aditya Thakare"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Contextual metadata validation</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date of Birth (DOB) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    placeholder="DD/MM/YYYY (e.g. 29/05/2004)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Converted automatically to DDMMYYYY for decryption.
                  </p>
                </div>
              </div>

              {/* Security Banner */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center gap-3 text-xs text-blue-900">
                <Shield className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>
                  <strong>Strict Privacy:</strong> Passwords are never requested directly, stored, or logged. Documents are processed in isolated memory and securely purged.
                </span>
              </div>

              {/* Upload Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
                    setPanFile(file);
                  }
                }}
                className={`border-2 border-dashed rounded-xl p-6 transition text-center ${
                  isDragging
                    ? "border-blue-500 bg-blue-50/80 shadow-md ring-2 ring-blue-500/20 scale-[1.01]"
                    : "border-slate-200 hover:border-blue-500 bg-slate-50/50"
                }`}
              >
                <div className="flex flex-col items-center">
                  <CreditCard
                    className={`w-10 h-10 mb-2 transition ${
                      isDragging ? "text-blue-600 scale-110" : "text-slate-400"
                    }`}
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    {isDragging ? "Drop PAN PDF Here" : "Upload Encrypted or Plain PAN PDF"}
                  </span>
                  <span className="text-[11px] text-slate-400 mb-4">
                    {isDragging ? "Release to attach document" : "Drag and drop or browse NSDL / UTIITSL e-PAN cards (PDF up to 35MB)"}
                  </span>

                  {panFile ? (
                    <div className="w-full max-w-sm flex items-center justify-between bg-white p-2.5 rounded-xl border border-blue-200 text-xs shadow-sm">
                      <span className="truncate font-medium text-slate-700">{panFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setPanFile(null)}
                        className="text-slate-400 hover:text-rose-600 ml-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition">
                      Select PAN Card PDF
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) => setPanFile(e.target.files[0])}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Calibration Option */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEnableCustomCrop(!enableCustomCrop)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700"
                >
                  <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  <span>Manual Crop Calibration {enableCustomCrop ? "(Enabled)" : "(Automatic)"}</span>
                </button>

                {enableCustomCrop && (
                  <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between text-slate-600 font-medium mb-1">
                        <span>Card Vertical Offset</span>
                        <span className="font-mono">{cropBox.yPercent}% from top</span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="70"
                        value={cropBox.yPercent}
                        onChange={(e) =>
                          setCropBox({ ...cropBox, yPercent: Number(e.target.value) })
                        }
                        className="w-full accent-blue-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-600 font-medium mb-1">
                        <span>Card Height Span</span>
                        <span className="font-mono">{cropBox.heightPercent}% of page</span>
                      </div>
                      <input
                        type="range"
                        min="25"
                        max="55"
                        value={cropBox.heightPercent}
                        onChange={(e) =>
                          setCropBox({ ...cropBox, heightPercent: Number(e.target.value) })
                        }
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>
                )}
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
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-700/20 flex items-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Unlocking & Cropping...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Process PAN Card</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Results View */
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold">{result.message}</span>
                </div>
                {result.zip_download_url && (
                  <button
                    onClick={() =>
                      handleDownload(result.zip_download_url, "pan_processed_files.zip")
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold transition"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Download All (ZIP)</span>
                  </button>
                )}
              </div>

              {/* Preview */}
              {result.files
                .filter((f) => f.file_type === "card_image")
                .map((img) => (
                  <div
                    key={img.name}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2"
                  >
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Extracted PAN Card Preview
                    </span>
                    {previewUrls[img.name] ? (
                      <div className="rounded-lg overflow-hidden border border-slate-200 bg-white max-h-56 flex items-center justify-center p-2">
                        <img
                          src={previewUrls[img.name]}
                          alt="PAN Card"
                          className="object-contain max-h-52 w-auto shadow-sm rounded"
                        />
                      </div>
                    ) : (
                      <div className="h-36 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    )}
                  </div>
                ))}

              {/* Download outputs */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Available Formats
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.files.map((file) => (
                    <div
                      key={file.name}
                      className="p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-500 shadow-sm flex items-center justify-between transition"
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
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 transition"
                        title="Download file"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reset / Done */}
              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Process Another PAN</span>
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
