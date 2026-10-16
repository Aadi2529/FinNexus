import React, { useState } from "react";
import {
  X,
  Images,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Plus,
  RefreshCw,
  Settings2,
} from "lucide-react";
import api from "../../services/api";

export default function ImagesToPdfModal({ isOpen, onClose, initialImages = [] }) {
  const [images, setImages] = useState([]); // { file, previewUrl }
  const [isDragging, setIsDragging] = useState(false);
  const [pageSize, setPageSize] = useState("a4");
  const [orientation, setOrientation] = useState("auto");
  const [margin, setMargin] = useState("small");
  const [outputFilename, setOutputFilename] = useState("converted_images.pdf");

  React.useEffect(() => {
    if (initialImages && initialImages.length > 0) {
      const newItems = Array.from(initialImages).map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setImages((prev) => [...prev, ...newItems]);
    }
  }, [initialImages]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const handleReset = () => {
    images.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setImages([]);
    setOutputFilename("converted_images.pdf");
    setLoading(false);
    setError("");
    setResult(null);
  };

  const handleFilesSelected = (newFiles) => {
    const valid = Array.from(newFiles).filter((f) =>
      f.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(f.name)
    );
    if (valid.length === 0) {
      setError("Please select valid image files (JPEG, PNG, or WebP).");
      return;
    }
    setError("");
    const newItems = valid.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...newItems]);
  };

  const removeImage = (index) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const moveLeft = (index) => {
    if (index === 0) return;
    setImages((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const moveRight = (index) => {
    if (index === images.length - 1) return;
    setImages((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleConvert = async (e) => {
    e.preventDefault();
    if (images.length === 0) {
      setError("Please add at least 1 image to convert.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    images.forEach((item) => {
      formData.append("files", item.file);
    });
    formData.append("page_size", pageSize);
    formData.append("orientation", orientation);
    formData.append("margin", margin);
    formData.append("output_filename", outputFilename.trim() || "converted_images.pdf");

    const res = await api.toolkit.convertImagesToPDF(formData);
    setLoading(false);

    if (res.ok) {
      setResult(res.data);
    } else {
      setError(res.error || "Failed to convert images to PDF.");
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
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Images className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Images to PDF Studio</h2>
              <p className="text-xs text-slate-300">
                Compile JPEG, PNG & WebP Photos into a Crisp Vector-Safe PDF
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
                <p className="font-semibold text-rose-900">Conversion Limitation</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {!result ? (
            <form onSubmit={handleConvert} className="space-y-5">
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
                    ? "border-emerald-500 bg-emerald-50/80 shadow-md ring-2 ring-emerald-500/20 scale-[1.01]"
                    : "border-slate-200 hover:border-emerald-500 bg-slate-50/50"
                }`}
              >
                <div className="flex flex-col items-center">
                  <Images
                    className={`w-10 h-10 mb-2 transition ${
                      isDragging ? "text-emerald-600 scale-110" : "text-slate-400"
                    }`}
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    {isDragging ? "Drop Photos Here" : "Drag and Drop Images Here"}
                  </span>
                  <span className="text-[11px] text-slate-400 mb-4">
                    {isDragging ? "Release to append images" : "Supports JPG, PNG, and WebP (up to 50 images)"}
                  </span>

                  <label className="cursor-pointer px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span>Select Images</span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleFilesSelected(e.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Image Grid with Reorder Controls */}
              {images.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 uppercase tracking-wider">
                    <span>Selected Photos ({images.length})</span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Reorder slides using arrows
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-64 overflow-y-auto pr-1">
                    {images.map((item, idx) => (
                      <div
                        key={idx}
                        className="group relative rounded-xl border border-slate-200 bg-slate-50 p-2 text-center overflow-hidden flex flex-col justify-between"
                      >
                        <div className="relative h-28 bg-white rounded-lg overflow-hidden border border-slate-100 flex items-center justify-center">
                          <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            className="object-contain h-full w-full"
                          />
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/80 text-white text-[10px] font-bold">
                            #{idx + 1}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-700 font-medium truncate mt-1.5 px-1">
                          {item.file.name}
                        </p>

                        <div className="flex items-center justify-center gap-1 mt-1 pt-1 border-t border-slate-200">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveLeft(idx)}
                            className="p-1 rounded text-slate-400 hover:text-slate-800 disabled:opacity-20"
                            title="Move Earlier"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === images.length - 1}
                            onClick={() => moveRight(idx)}
                            className="p-1 rounded text-slate-400 hover:text-slate-800 disabled:opacity-20"
                            title="Move Later"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversion Settings */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <Settings2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Page & Margin Configuration</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Page Size</label>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
                    >
                      <option value="a4">Standard A4 (595 x 842 pt)</option>
                      <option value="fit">Fit (Match Image Size)</option>
                      <option value="letter">US Letter (612 x 792 pt)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Orientation</label>
                    <select
                      value={orientation}
                      onChange={(e) => setOrientation(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
                    >
                      <option value="auto">Auto (Smart Aspect Fit)</option>
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Margins</label>
                    <select
                      value={margin}
                      onChange={(e) => setMargin(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
                    >
                      <option value="none">No Margin (Full Bleed)</option>
                      <option value="small">Small Margin (20 pt)</option>
                      <option value="normal">Standard Margin (36 pt)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Output Filename */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Output Filename
                </label>
                <input
                  type="text"
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  placeholder="converted_images.pdf"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
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
                  disabled={loading || images.length === 0}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-700/20 flex items-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Converting Images...</span>
                    </>
                  ) : (
                    <>
                      <Images className="w-4 h-4" />
                      <span>Compile to PDF ({images.length})</span>
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
                    <span className="font-semibold">PDF Generated Successfully!</span>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Compiled {result.total_pages} page(s) • {(result.file_size_bytes / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{result.output_filename}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Crisp document ready for instant download.
                  </p>
                </div>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Converted PDF</span>
                </button>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Convert More Images</span>
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
