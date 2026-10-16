import React, { useState, useMemo } from "react";
import {
  FileText,
  CreditCard,
  FileStack,
  Images,
  Scissors,
  Minimize2,
  FileImage,
  Layers,
  ArrowRightLeft,
  RotateCw,
  Stamp,
  Hash,
  Unlock,
  Lock,
  Search,
  CheckCircle2,
  AlertCircle,
  Shield,
  Clock,
  Sparkles,
  ArrowRight,
  Upload,
  Plus,
  X,
  FileUp,
} from "lucide-react";

import AadhaarModal from "../components/tools/AadhaarModal";
import PanModal from "../components/tools/PanModal";
import PdfMergerModal from "../components/tools/PdfMergerModal";
import ImagesToPdfModal from "../components/tools/ImagesToPdfModal";
import RoadmapModal from "../components/tools/RoadmapModal";

export default function ToolkitPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Drag and Drop Hub State
  const [isPageDragging, setIsPageDragging] = useState(false);
  const [quickDoc, setQuickDoc] = useState(null);

  // Active Modals & Preloaded Files
  const [isAadhaarOpen, setIsAadhaarOpen] = useState(false);
  const [initialAadhaarFile, setInitialAadhaarFile] = useState(null);

  const [isPanOpen, setIsPanOpen] = useState(false);
  const [initialPanFile, setInitialPanFile] = useState(null);

  const [isPdfMergerOpen, setIsPdfMergerOpen] = useState(false);
  const [initialPdfMergerFiles, setInitialPdfMergerFiles] = useState([]);

  const [isImagesToPdfOpen, setIsImagesToPdfOpen] = useState(false);
  const [initialImagesFiles, setInitialImagesFiles] = useState([]);

  const [selectedRoadmapTool, setSelectedRoadmapTool] = useState(null);

  // Handle Drag & Drop on the Universal Landing Page Dropzone
  const handleUniversalFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const imageFiles = files.filter((f) =>
      f.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(f.name)
    );
    const pdfFiles = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );

    // If images dropped -> Launch Images to PDF Studio
    if (imageFiles.length > 0) {
      setInitialImagesFiles(imageFiles);
      setIsImagesToPdfOpen(true);
      return;
    }

    // If multiple PDFs dropped -> Launch PDF Merger Studio
    if (pdfFiles.length > 1) {
      setInitialPdfMergerFiles(pdfFiles);
      setIsPdfMergerOpen(true);
      return;
    }

    // If a single PDF dropped -> open tool chooser
    if (pdfFiles.length === 1) {
      setQuickDoc(pdfFiles[0]);
      return;
    }
  };

  // 20 Master Document Processing Tools Catalog
  const tools = useMemo(
    () => [
      // A. Identity Documents
      {
        id: "aadhaar-processor",
        category: "identity",
        title: "Aadhaar PDF Processor",
        description:
          "Authorized UIDAI decryption (NAME4_YYYY), smart card region detection, cropped PDF, 300 DPI JPEG, and ZIP bundle.",
        icon: Shield,
        color: "teal",
        isCore: true,
        action: () => {
          setInitialAadhaarFile(null);
          setIsAadhaarOpen(true);
        },
      },
      {
        id: "pan-processor",
        category: "identity",
        title: "PAN Card PDF Processor",
        description:
          "Income Tax Department DDMMYYYY authorized decryption, ISO/IEC 7810 ID-1 card cropping, and 300 DPI print-ready JPEG.",
        icon: CreditCard,
        color: "blue",
        isCore: true,
        action: () => {
          setInitialPanFile(null);
          setIsPanOpen(true);
        },
      },
      {
        id: "identity-history",
        category: "identity",
        title: "Processing History",
        description:
          "Cryptographic audit log of processed documents with client isolation and zero sensitive document retention.",
        icon: Clock,
        color: "slate",
        isCore: false,
      },

      // B. PDF Suite
      {
        id: "pdf-merger",
        category: "pdf",
        title: "PDF Merger Studio",
        description:
          "Combine multiple PDF documents into a consolidated file with custom sequencing, page validation, and fast download.",
        icon: FileStack,
        color: "indigo",
        isCore: true,
        action: () => {
          setInitialPdfMergerFiles([]);
          setIsPdfMergerOpen(true);
        },
      },
      {
        id: "pdf-splitter",
        category: "pdf",
        title: "PDF Splitter",
        description: "Extract specific page ranges or burst large documents into individual standalone PDF files.",
        icon: Scissors,
        color: "purple",
        isCore: false,
      },
      {
        id: "pdf-compressor",
        category: "pdf",
        title: "PDF Compressor",
        description: "Reduce PDF document file size while maintaining optimal text vector clarity and image DPI.",
        icon: Minimize2,
        color: "amber",
        isCore: false,
      },
      {
        id: "pdf-to-images",
        category: "pdf",
        title: "PDF to Images",
        description: "Convert all pages of any PDF document into crisp 300 DPI JPEG or PNG image files.",
        icon: FileImage,
        color: "sky",
        isCore: false,
      },
      {
        id: "images-to-pdf",
        category: "pdf",
        title: "Images to PDF",
        description:
          "Compile multiple JPEG, PNG, and WebP images into a proportion-preserved PDF with A4/fit dimensions and margin options.",
        icon: Images,
        color: "emerald",
        isCore: true,
        action: () => {
          setInitialImagesFiles([]);
          setIsImagesToPdfOpen(true);
        },
      },
      {
        id: "pdf-organizer",
        category: "pdf",
        title: "PDF Organizer",
        description: "Visually reorder pages, rotate sideways sheets, and eliminate unnecessary pages from documents.",
        icon: Layers,
        color: "violet",
        isCore: false,
      },
      {
        id: "pdf-page-extraction",
        category: "pdf",
        title: "PDF Page Extraction",
        description: "Isolate and export specific individual pages or odd/even batches from large documents.",
        icon: ArrowRightLeft,
        color: "cyan",
        isCore: false,
      },
      {
        id: "pdf-page-rotation",
        category: "pdf",
        title: "PDF Page Rotation",
        description: "Permanently rotate 90°, 180°, or 270° orientation of sideways scanned pages.",
        icon: RotateCw,
        color: "orange",
        isCore: false,
      },
      {
        id: "pdf-watermark",
        category: "pdf",
        title: "PDF Watermark",
        description: "Apply customized confidentiality stamps, client watermarks, or security markings over pages.",
        icon: Stamp,
        color: "rose",
        isCore: false,
      },
      {
        id: "pdf-page-numbers",
        category: "pdf",
        title: "PDF Page Numbers",
        description: "Insert standardized header/footer pagination, Bates stamping, and custom indexing.",
        icon: Hash,
        color: "slate",
        isCore: false,
      },
      {
        id: "pdf-unlock",
        category: "pdf",
        title: "PDF Password Unlocker",
        description: "Remove security restrictions from authorized documents using authorized decryption keys.",
        icon: Unlock,
        color: "emerald",
        isCore: false,
      },
      {
        id: "pdf-protect",
        category: "pdf",
        title: "PDF Password Protect",
        description: "Encrypt PDF files with AES-256 military-grade encryption and granular permission flags.",
        icon: Lock,
        color: "red",
        isCore: false,
      },

      // C. Image Tools
      {
        id: "img-to-pdf-alt",
        category: "images",
        title: "Single / Multi Image to PDF",
        description: "Quickly convert image uploads to standard printable PDF format.",
        icon: Images,
        color: "emerald",
        isCore: true,
        action: () => {
          setInitialImagesFiles([]);
          setIsImagesToPdfOpen(true);
        },
      },
      {
        id: "img-compress",
        category: "images",
        title: "Image Compressor",
        description: "Losslessly compress photos and scans for client submission limits.",
        icon: Minimize2,
        color: "amber",
        isCore: false,
      },
      {
        id: "img-resize",
        category: "images",
        title: "Image Resizer",
        description: "Scale image pixel dimensions and aspect ratios for portal compliance.",
        icon: FileImage,
        color: "blue",
        isCore: false,
      },
      {
        id: "img-convert",
        category: "images",
        title: "Image Format Converter",
        description: "Inter-convert between WebP, PNG, JPEG, and TIFF image formats.",
        icon: ArrowRightLeft,
        color: "indigo",
        isCore: false,
      },
    ],
    []
  );

  // Filter tools by search and category
  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      const matchesCategory =
        selectedCategory === "all" || tool.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [tools, selectedCategory, searchQuery]);

  const handleToolClick = (tool) => {
    if (tool.action) {
      tool.action();
    } else {
      setSelectedRoadmapTool(tool);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-8 sm:p-10 text-white overflow-hidden shadow-xl border border-teal-900/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>FinNexus Enterprise Document Processing Suite</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Document Processing Toolkit
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Zero-leak statutory document decryption, 300 DPI high-resolution cropping for Aadhaar & PAN,
            multi-file PDF merging, and lossless photo compilers.
          </p>

          {/* Quick Launch Buttons for Core Priority Tools */}
          <div className="pt-4 flex flex-wrap gap-2.5">
            <button
              onClick={() => {
                setInitialAadhaarFile(null);
                setIsAadhaarOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-lg shadow-teal-900/40 flex items-center gap-2 transition"
            >
              <Shield className="w-4 h-4" />
              <span>Aadhaar Processor</span>
            </button>
            <button
              onClick={() => {
                setInitialPanFile(null);
                setIsPanOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/40 flex items-center gap-2 transition"
            >
              <CreditCard className="w-4 h-4" />
              <span>PAN Card Processor</span>
            </button>
            <button
              onClick={() => {
                setInitialPdfMergerFiles([]);
                setIsPdfMergerOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-900/40 flex items-center gap-2 transition"
            >
              <FileStack className="w-4 h-4" />
              <span>PDF Merger Studio</span>
            </button>
            <button
              onClick={() => {
                setInitialImagesFiles([]);
                setIsImagesToPdfOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/40 flex items-center gap-2 transition"
            >
              <Images className="w-4 h-4" />
              <span>Images to PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Universal Drag and Drop Hub */}


      {/* 3. Controls & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search document tools (e.g. merge, aadhaar, pan, split)..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-slate-400 hover:text-slate-600 text-xs absolute right-3 top-1/2 -translate-y-1/2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All Document Tools" },
            { id: "identity", label: "Identity Suite" },
            { id: "pdf", label: "PDF Suite" },
            { id: "images", label: "Image Tools" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                selectedCategory === cat.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Tool Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.id}
              onClick={() => handleToolClick(tool)}
              className="group relative bg-white rounded-2xl border border-slate-200/90 hover:border-teal-500 hover:shadow-lg p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 group-hover:bg-teal-50 group-hover:border-teal-200 text-teal-700 flex items-center justify-center transition">
                    <Icon className="w-5 h-5" />
                  </div>
                  {tool.isCore ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      ACTIVE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                      ROADMAP
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-sm group-hover:text-teal-700 transition">
                    {tool.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1 line-clamp-3">
                    {tool.description}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600 group-hover:text-teal-700">
                <span>{tool.isCore ? "Launch Studio" : "View Details"}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>

      {filteredTools.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No matching tools found</h3>
          <p className="text-xs text-slate-400 mt-1">
            Try adjusting your search query or switching categories.
          </p>
        </div>
      )}

      {/* 5. Quick Route Modal for Dropped PDF */}
      {quickDoc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-slate-900 to-teal-950 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-teal-400" />
                <span className="font-bold text-sm">Select Document Engine</span>
              </div>
              <button
                onClick={() => setQuickDoc(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <FileText className="w-8 h-8 text-teal-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{quickDoc.name}</p>
                  <p className="text-slate-400">{(quickDoc.size / 1024).toFixed(1)} KB • PDF Document</p>
                </div>
              </div>

              <p className="text-slate-600 font-medium">Choose how you want to process this document:</p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setInitialAadhaarFile(quickDoc);
                    setQuickDoc(null);
                    setIsAadhaarOpen(true);
                  }}
                  className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 flex items-center justify-between text-left transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-teal-100/70 text-teal-700 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-teal-700">Aadhaar PDF Processor</p>
                      <p className="text-slate-500 text-[11px]">UIDAI password unlock & card crop</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInitialPanFile(quickDoc);
                    setQuickDoc(null);
                    setIsPanOpen(true);
                  }}
                  className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between text-left transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-blue-700">PAN Card PDF Processor</p>
                      <p className="text-slate-500 text-[11px]">DDMMYYYY password unlock & crop</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInitialPdfMergerFiles([quickDoc]);
                    setQuickDoc(null);
                    setIsPdfMergerOpen(true);
                  }}
                  className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 flex items-center justify-between text-left transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100/70 text-indigo-700 flex items-center justify-center flex-shrink-0">
                      <FileStack className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-indigo-700">PDF Merger Studio</p>
                      <p className="text-slate-500 text-[11px]">Combine with other PDF documents</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Active Tool Modals */}
      <AadhaarModal
        isOpen={isAadhaarOpen}
        onClose={() => {
          setIsAadhaarOpen(false);
          setInitialAadhaarFile(null);
        }}
        initialFile={initialAadhaarFile}
      />
      <PanModal
        isOpen={isPanOpen}
        onClose={() => {
          setIsPanOpen(false);
          setInitialPanFile(null);
        }}
        initialFile={initialPanFile}
      />
      <PdfMergerModal
        isOpen={isPdfMergerOpen}
        onClose={() => {
          setIsPdfMergerOpen(false);
          setInitialPdfMergerFiles([]);
        }}
        initialFiles={initialPdfMergerFiles}
      />
      <ImagesToPdfModal
        isOpen={isImagesToPdfOpen}
        onClose={() => {
          setIsImagesToPdfOpen(false);
          setInitialImagesFiles([]);
        }}
        initialImages={initialImagesFiles}
      />
      <RoadmapModal
        tool={selectedRoadmapTool}
        isOpen={Boolean(selectedRoadmapTool)}
        onClose={() => setSelectedRoadmapTool(null)}
      />
    </div>
  );
}
