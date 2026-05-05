import React from 'react';
import { PAGINATION_OPTIONS } from '../hooks/usePagination';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (items: number) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  onItemsPerPageChange,
  onNextPage,
  onPrevPage,
}: PaginationControlsProps) {
  if (totalItems === 0) return null;

  const showing = itemsPerPage === -1 
    ? `Showing all ${totalItems} items`
    : `Showing ${startIndex + 1}-${endIndex} of ${totalItems}`;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2">
      {/* Items count */}
      <div className="text-sm text-gray-600">
        {showing}
      </div>

      {/* Page controls */}
      <div className="flex items-center gap-2">
        {/* Items per page selector */}
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(parseInt(e.target.value, 10))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          {PAGINATION_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === -1 ? 'All' : option}
            </option>
          ))}
        </select>

        {/* Page navigation - only show if not showing all */}
        {itemsPerPage !== -1 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            {/* Previous button */}
            <button
              onClick={onPrevPage}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              ‹
            </button>

            {/* Page numbers */}
            <div className="hidden sm:flex items-center gap-1">
              {getPageNumbers(currentPage, totalPages).map((page, idx) => (
                <React.Fragment key={idx}>
                  {page === '...' ? (
                    <span className="px-3 py-2 text-gray-500">...</span>
                  ) : (
                    <button
                      onClick={() => onPageChange(page as number)}
                      className={`px-3 py-2 border rounded-lg text-sm font-medium ${
                        currentPage === page
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Mobile: Current page indicator */}
            <div className="sm:hidden px-3 py-2 text-sm font-medium">
              {currentPage} / {totalPages}
            </div>

            {/* Next button */}
            <button
              onClick={onNextPage}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to generate page numbers with ellipsis
function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  const pages: (number | string)[] = [];
  const maxVisible = 5;

  if (totalPages <= maxVisible) {
    // Show all pages if total is small
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    // Always show first page
    pages.push(1);

    if (currentPage > 3) {
      pages.push('...');
    }

    // Show pages around current page
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push('...');
    }

    // Always show last page
    pages.push(totalPages);
  }

  return pages;
}
