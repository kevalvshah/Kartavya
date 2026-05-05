import { useState, useEffect } from 'react';

const PAGINATION_OPTIONS = [25, 50, 100, -1] as const; // -1 = All
const DEFAULT_ITEMS_PER_PAGE = 25;

interface UsePaginationProps {
  totalItems: number;
  storageKey?: string;
}

interface UsePaginationReturn {
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setItemsPerPage: (items: number) => void;
  paginatedItems: <T>(items: T[]) => T[];
}

export function usePagination({ totalItems, storageKey = 'pagination_default' }: UsePaginationProps): UsePaginationReturn {
  // Load from localStorage or use default
  const [itemsPerPage, setItemsPerPageState] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_ITEMS_PER_PAGE;
    const saved = localStorage.getItem(storageKey);
    return saved ? parseInt(saved, 10) : DEFAULT_ITEMS_PER_PAGE;
  });

  const [currentPage, setCurrentPage] = useState(1);

  // Calculate total pages
  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(totalItems / itemsPerPage);

  // Calculate start and end indexes
  const startIndex = itemsPerPage === -1 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === -1 ? totalItems : Math.min(startIndex + itemsPerPage, totalItems);

  // Save to localStorage when changed
  const setItemsPerPage = (items: number) => {
    setItemsPerPageState(items);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, items.toString());
    }
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const paginatedItems = <T,>(items: T[]): T[] => {
    if (itemsPerPage === -1) return items;
    return items.slice(startIndex, endIndex);
  };

  return {
    currentPage,
    itemsPerPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    prevPage,
    setItemsPerPage,
    paginatedItems,
  };
}

export { PAGINATION_OPTIONS };
