import React, { useState } from "react";
import {
  X,
  FileStack,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  RefreshCw,
} from "lucide-react";
import api from "../../services/api";

export default function PdfMergerModal({ isOpen, onClose, initialFiles = [] }) {
  const [files, setFiles] = useState(initialFiles);
  const [isDragging, setIsDragging] = useState(false);
  const [outputFilename, setOutputFilename] = useState("merged_document.pdf");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  React.useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      setFiles((prev) => [...prev, ...initialFiles]);
    }
  }, [initialFiles]);

  if (!isOpen) return null;

  const handleReset = () => {
    setFiles([]);
    setOutputFilename("merged_document.pdf");
    setLoading(false);
    setError("");
    setResult(null);
  };

  const handleFilesSelected = (newFiles) => {
    const pdfs = Array.from(newFiles).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length === 0) {
      setError("Please select valid PDF documents.");
      return;
    }
    setError("");
    setFiles((prev) => [...prev, ...pdfs]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const moveUp = (index) => {
    if (index === 0) return;
    setFiles((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const moveDown = (index) => {
    if (index === files.length - 1) return;
    setFiles((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMerge = async (e) => {
    e.preventDefault();
    if (files.length < 2) {
      setError("Please add at least 2 PDF documents to merge.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    files.forEach((f) => {
      formData.append("files", f);
    });
    formData.append("output_filename", outputFilename.trim() || "merged_document.pdf");

    const res = await api.toolkit.mergePDFs(formData);
    setLoading(false);

    if (res.ok) {
      setResult(res.data);
    } else {
      setError(res.error || "Failed to merge PDF documents.");
    }
  };

  const handleDownload = async () => {
    if (!result?.download_url) return;
    try {
      await api.toolkit.downloadFile(result.download_url, result.output_filename);
    } catch (err) {
      alert("Download failed: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <FileStack className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">PDF Merger Studio</h2>
              <p className="text-xs text-slate-300">
                Combine Multiple PDFs in Custom Order with Zero Compression Loss
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
                <p className="font-semibold text-rose-900">Merge Limitation</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {!result ? (
            <form onSubmit={handleMerge} className="space-y-5">
              {/* Drop / Select Zone */}
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
                  if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
                }}
                className={`border-2 border-dashed rounded-xl p-6 transition text-center ${
                  isDragging
                    ? "border-indigo-500 bg-indigo-50/80 shadow-md ring-2 ring-indigo-500/20 scale-[1.01]"
                    : "border-slate-200 hover:border-indigo-500 bg-slate-50/50"
                }`}
              >
                <div className="flex flex-col items-center">
                  <FileStack
                    className={`w-10 h-10 mb-2 transition ${
                      isDragging ? "text-indigo-600 scale-110" : "text-slate-400"
                    }`}
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    {isDragging ? "Drop PDF Files Here" : "Drag and Drop PDFs Here"}
                  </span>
                  <span className="text-[11px] text-slate-400 mb-4">
                    {isDragging ? "Release to append to merge sequence" : "Select or drop 2 or more PDF documents to combine"}
                  </span>

                  <label className="cursor-pointer px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-sm transition flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span>Choose PDF Files</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,application/pdf"
                      onChange={(e) => handleFilesSelected(e.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Selected Files List with Reorder Controls */}
              {files.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 uppercase tracking-wider">
                    <span>Merge Sequence ({files.length} Files)</span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Order reflects final document structure
                    </span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {files.map((file, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[11px] flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveUp(idx)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === files.length - 1}
                            onClick={() => moveDown(idx)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 ml-1"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Output Filename */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Output Merged Filename
                </label>
                <input
                  type="text"
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  placeholder="merged_document.pdf"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                />
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
                  disabled={loading || files.length < 2}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-700/20 flex items-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Merging Documents...</span>
                    </>
                  ) : (
                    <>
                      <FileStack className="w-4 h-4" />
                      <span>Merge {files.length} PDFs</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Result View */
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <span className="font-semibold">PDF Merge Completed Successfully!</span>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Total {result.total_pages} pages compiled • {(result.file_size_bytes / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{result.output_filename}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ready for instant secure download.
                  </p>
                </div>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Merged PDF</span>
                </button>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Merge Another Set</span>
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
