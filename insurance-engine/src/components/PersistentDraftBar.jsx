import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePolicyDraft } from "../context/PolicyDraftContext";
import {
  FileText,
  Maximize2,
  Trash2,
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  GripHorizontal,
  Shield,
  Sparkles,
} from "lucide-react";

const POS_STORAGE_KEY = "FINNEXUS_POLICY_DRAFT_WIDGET_POS";
const COLLAPSED_STORAGE_KEY = "FINNEXUS_POLICY_DRAFT_WIDGET_COLLAPSED";

export default function PersistentDraftBar() {
  const { draft, hasDraft, isMinimized, restoreDraft, discardDraft } = usePolicyDraft();
  const navigate = useNavigate();
  const location = useLocation();

  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const widgetRef = useRef(null);

  // Helper to calculate clamped (x, y) coordinates within browser viewport
  const clampPosition = useCallback((pos, customWidth, customHeight) => {
    if (typeof window === "undefined") return pos;
    const margin = 16;
    const wWidth = customWidth || widgetRef.current?.offsetWidth || 384;
    const wHeight = customHeight || widgetRef.current?.offsetHeight || 220;

    const actualWidth = Math.min(wWidth, window.innerWidth - margin * 2);
    const minX = margin;
    const maxX = Math.max(margin, window.innerWidth - actualWidth - margin);
    const minY = margin;
    const maxY = Math.max(margin, window.innerHeight - wHeight - margin);

    return {
      x: Math.round(Math.max(minX, Math.min(maxX, pos.x))),
      y: Math.round(Math.max(minY, Math.min(maxY, pos.y))),
    };
  }, []);

  // Snap to screen edge when released close to boundaries
  const snapToEdge = useCallback((pos) => {
    if (typeof window === "undefined") return pos;
    const margin = 16;
    const snapThreshold = 36;
    const wWidth = widgetRef.current?.offsetWidth || 384;
    const actualWidth = Math.min(wWidth, window.innerWidth - margin * 2);
    const minX = margin;
    const maxX = Math.max(margin, window.innerWidth - actualWidth - margin);

    let snappedX = pos.x;
    if (pos.x - minX < snapThreshold) {
      snappedX = minX;
    } else if (maxX - pos.x < snapThreshold) {
      snappedX = maxX;
    }

    return { x: snappedX, y: pos.y };
  }, []);

  // Compute default bottom-right position
  const getDefaultPosition = useCallback(() => {
    if (typeof window === "undefined") return { x: 100, y: 100 };
    const wWidth = 384;
    const wHeight = 220;
    const margin = 20;
    return clampPosition(
      {
        x: window.innerWidth - wWidth - margin,
        y: window.innerHeight - wHeight - margin,
      },
      wWidth,
      wHeight
    );
  }, [clampPosition]);

  // Position state (persisted across sessions)
  const [position, setPosition] = useState(() => {
    try {
      const stored = localStorage.getItem(POS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          return clampPosition(parsed);
        }
      }
    } catch {
      // fallback
    }
    return getDefaultPosition();
  });

  const positionRef = useRef(position);
  positionRef.current = position;

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  // Re-clamp position on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampPosition(prev));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPosition]);

  // =============================================================
  // RELIABLE POINTER DRAG HANDLERS (with Pointer Capture)
  // =============================================================
  const handlePointerDown = (e) => {
    // Only primary pointer button (left click = 0, touch = 0)
    if (e.button !== 0) return;
    // Do not initiate drag if user clicked an interactive control (button, link, input)
    if (e.target.closest("button") || e.target.closest("a") || e.target.closest("input")) {
      return;
    }

    e.preventDefault();
    const target = e.currentTarget;

    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // ignore if pointer capture unsupported
    }

    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initialX: positionRef.current.x,
      initialY: positionRef.current.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== null && e.pointerId !== dragRef.current.pointerId) return;

    e.preventDefault();
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    const newPos = clampPosition({
      x: dragRef.current.initialX + dx,
      y: dragRef.current.initialY + dy,
    });

    setPosition(newPos);
  };

  const handlePointerUp = (e) => {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== null && e.pointerId !== dragRef.current.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    setIsDragging(false);

    // Apply edge snapping and persist to localStorage
    const snapped = snapToEdge(positionRef.current);
    setPosition(snapped);

    try {
      localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(snapped));
    } catch {
      // ignore
    }
  };

  // Collapse / Expand handlers
  const handleCollapse = () => {
    setIsCollapsed(true);
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, "true");
    } catch {
      // ignore
    }
  };

  const handleExpand = () => {
    setIsCollapsed(false);
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, "false");
    } catch {
      // ignore
    }
    // Re-clamp position upon expanding
    setPosition((prev) => clampPosition(prev));
  };

  // Resume policy navigation
  const handleResume = () => {
    restoreDraft();
    navigate("/policies?tab=new_policy");
  };

  // Discard draft
  const handleDiscard = () => {
    discardDraft();
    setConfirmDiscard(false);
  };

  // Route visibility filter
  const isAuthOrPublicPage =
    location.pathname === "/login" || location.pathname.startsWith("/agents/");

  // Only render if a draft exists, draft is minimized/backgrounded, and not on unauthenticated pages
  if (!hasDraft || !isMinimized || isAuthOrPublicPage) {
    return null;
  }

  const customerName =
    draft.customerSnapshot?.fullName ||
    draft.customerSnapshot?.name ||
    draft.formData?.customerName ||
    (draft.formData?.customerId ? "Selected Customer" : "Unassigned Client");

  const policyCategory = draft.formData?.policyType || draft.formData?.policyCategory || "HEALTH";
  const companyName =
    draft.formData?.companyName ||
    draft.companySnapshot?.name ||
    draft.formData?.carrierName ||
    "";
  const policyNum = draft.formData?.policyNumber ? `#${draft.formData.policyNumber}` : "Draft Contract";
  const savedTime = draft.savedAt
    ? new Date(draft.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "Recently";

  // -------------------------------------------------------------
  // STATE 1: COLLAPSED TAB (Minimized to Right Edge of Screen)
  // -------------------------------------------------------------
  if (isCollapsed) {
    return (
      <div
        role="region"
        aria-label="Minimized policy draft in progress"
        className="fixed right-0 top-1/2 -translate-y-1/2 z-[9999] animate-in slide-in-from-right duration-300"
      >
        <button
          type="button"
          onClick={handleExpand}
          className="group flex items-center gap-2.5 pl-3.5 pr-2.5 py-2.5 bg-slate-900/95 hover:bg-slate-900 text-white border-l-2 border-y border-indigo-500 rounded-l-2xl shadow-2xl shadow-indigo-950/90 hover:shadow-[0_0_25px_rgba(99,102,241,0.35)] backdrop-blur-xl cursor-pointer transition-all duration-300 hover:-translate-x-2 select-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          title={`Policy Draft: ${customerName} (Click expand arrow to restore)`}
          aria-label="Expand policy draft widget"
        >
          {/* Expand Arrow Pill Indicator */}
          <div className="w-6 h-6 rounded-lg bg-indigo-600/30 group-hover:bg-indigo-600 text-indigo-300 group-hover:text-white flex items-center justify-center transition-all duration-200 shadow-sm shrink-0">
            <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          </div>

          {/* Pulsing Emerald Dot */}
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>

          {/* Draft File Icon */}
          <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />

          {/* Client & Draft Label */}
          <div className="flex flex-col text-left pr-1 max-w-[110px] sm:max-w-[140px]">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 leading-none">
              Draft
            </span>
            <span className="text-xs font-bold text-white truncate leading-tight mt-0.5">
              {customerName}
            </span>
          </div>
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STATE 2: FULL DRAGGABLE FLOATING MINI-WINDOW
  // -------------------------------------------------------------
  return (
    <aside
      ref={widgetRef}
      aria-label="In-progress policy draft"
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
      }}
      className={`w-88 sm:w-96 max-w-[calc(100vw-32px)] select-none ${
        isDragging
          ? "transition-none scale-[1.01] shadow-[0_20px_50px_rgba(99,102,241,0.25)] ring-2 ring-indigo-500/60"
          : "transition-shadow duration-200 shadow-2xl shadow-indigo-950/80"
      }`}
    >
      <div className="bg-slate-900/95 text-white rounded-2xl border border-slate-700/80 backdrop-blur-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
        {/* DRAGGABLE HEADER: Entire bar initiates drag with Pointer Events */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`flex items-center justify-between px-3.5 py-3 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{ touchAction: "none" }}
          title="Click and drag header to reposition anywhere on screen"
        >
          {/* Left: Drag Grip Handle & Status */}
          <div className="flex items-center gap-2 pointer-events-none">
            <div className="p-1 rounded-md bg-slate-800/80 text-slate-400">
              <GripHorizontal className="w-3.5 h-3.5" />
            </div>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
              Draft in Progress
            </span>
          </div>

          {/* Right: Autosave Time & Collapse Arrow Button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 pointer-events-none">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{savedTime}</span>
            </div>

            {/* Collapse Arrow Button (Independent Clickable Control) */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleCollapse();
              }}
              className="w-7 h-7 rounded-lg bg-slate-800/60 hover:bg-indigo-600/30 text-slate-400 hover:text-white border border-slate-700/60 flex items-center justify-center transition-all duration-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400"
              title="Minimize into screen edge tab"
              aria-label="Collapse draft widget"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="p-4 space-y-3">
          {confirmDiscard ? (
            /* Confirmation State for Discarding Draft */
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>Discard this unfinished draft?</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                All in-progress fields for <strong className="text-white">{customerName}</strong> will be permanently cleared.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setConfirmDiscard(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleDiscard}
                  className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Yes, Discard</span>
                </button>
              </div>
            </div>
          ) : (
            /* Active Draft Information & Action Buttons */
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-gradient-to-br from-slate-800/90 to-slate-850/90 rounded-xl p-3 border border-slate-700/70 shadow-inner">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 shadow-sm shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{customerName}</p>
                  <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                    <span className="font-semibold text-slate-300">{policyCategory}</span>
                    {companyName && (
                      <>
                        <span>&bull;</span>
                        <span className="text-indigo-300 truncate">{companyName}</span>
                      </>
                    )}
                    <span>&bull;</span>
                    <span className="text-slate-400 font-mono">{policyNum}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setConfirmDiscard(true)}
                  className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  title="Discard draft permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Discard</span>
                </button>

                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleResume}
                  className="flex-1 py-1.5 px-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/25 active:scale-95 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Resume Policy</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
