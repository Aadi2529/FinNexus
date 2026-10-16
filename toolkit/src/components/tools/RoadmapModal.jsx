import React from "react";
import { X, Clock, Sparkles, CheckCircle2 } from "lucide-react";

export default function RoadmapModal({ tool, isOpen, onClose }) {
  if (!isOpen || !tool) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">{tool.title}</h2>
              <span className="text-[11px] text-amber-300 font-semibold uppercase tracking-wider">
                Roadmap Feature
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed">{tool.description}</p>

          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Phase H Scheduled Development</span>
            </div>
            <p className="text-[11px] text-amber-800">
              This utility is part of the FinNexus 24-tool enterprise document processing suite.
              The four core production workflows (Aadhaar Processor, PAN Processor, PDF Merger, and Images to PDF) are fully active and available now.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <p className="font-semibold text-slate-800">Available Production Capabilities:</p>
            <ul className="space-y-1 text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Aadhaar Authorized Unlocking & Card Cropping</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                <span>PAN Card DDMMYYYY Decryption & 300 DPI Export</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Multi-File PDF Merger Studio</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Images to Vector-Safe PDF Compiler</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 flex justify-end border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition"
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
