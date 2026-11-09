import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function NumberedPagination({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  isLoading = false,
  itemLabel = "total contracts",
}) {
  if (totalItems === 0) return null;

  const validTotalPages = Math.max(1, totalPages);
  const validCurrentPage = Math.min(Math.max(1, currentPage), validTotalPages);

  // Generate numbered pages with ellipsis
  const getPageNumbers = () => {
    if (validTotalPages <= 7) {
      return Array.from({ length: validTotalPages }, (_, i) => i + 1);
    }

    if (validCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", validTotalPages];
    }

    if (validCurrentPage >= validTotalPages - 3) {
      return [
        1,
        "...",
        validTotalPages - 4,
        validTotalPages - 3,
        validTotalPages - 2,
        validTotalPages - 1,
        validTotalPages,
      ];
    }

    return [
      1,
      "...",
      validCurrentPage - 1,
      validCurrentPage,
      validCurrentPage + 1,
      "...",
      validTotalPages,
    ];
  };

  const pages = getPageNumbers();

  const handlePageClick = (page) => {
    if (page === "..." || page === validCurrentPage || isLoading) return;
    onPageChange(page);
  };

  const handlePrev = () => {
    if (validCurrentPage > 1 && !isLoading) {
      onPageChange(validCurrentPage - 1);
    }
  };

  const handleNext = () => {
    if (validCurrentPage < validTotalPages && !isLoading) {
      onPageChange(validCurrentPage + 1);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200">
      {/* Summary label */}
      <div className="text-xs font-medium text-slate-500 text-center sm:text-left">
        Showing page <span className="font-semibold text-slate-800">{validCurrentPage}</span> of{" "}
        <span className="font-semibold text-slate-800">{validTotalPages}</span> —{" "}
        <span className="font-semibold text-teal-700">{totalItems}</span> {itemLabel}
      </div>

      {/* Pagination controls */}
      <nav className="flex items-center gap-1 sm:gap-1.5" aria-label="Pagination Navigation">
        {/* Previous Button */}
        <button
          onClick={handlePrev}
          disabled={validCurrentPage <= 1 || isLoading}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
            validCurrentPage <= 1 || isLoading
              ? "text-slate-300 bg-slate-50 cursor-not-allowed"
              : "text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs"
          }`}
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-slate-400 text-xs font-bold select-none"
                >
                  …
                </span>
              );
            }

            const isActive = p === validCurrentPage;
            return (
              <button
                key={`page-${p}`}
                onClick={() => handlePageClick(p)}
                disabled={isLoading}
                className={`min-w-[34px] h-[34px] px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                  isActive
                    ? "bg-teal-600 text-white shadow-xs shadow-teal-600/30 ring-2 ring-teal-600/20"
                    : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80 bg-white"
                }`}
                aria-current={isActive ? "page" : undefined}
                aria-label={`Go to page ${p}`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={validCurrentPage >= validTotalPages || isLoading}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
            validCurrentPage >= validTotalPages || isLoading
              ? "text-slate-300 bg-slate-50 cursor-not-allowed"
              : "text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs"
          }`}
          aria-label="Next Page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </nav>
    </div>
  );
}
