"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

type PageItem = number | "ellipsis";

function buildPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 1) {
    return [1];
  }

  const pages = new Set<number>([1, totalPages]);

  if (currentPage <= 3) {
    for (let page = 2; page <= Math.min(4, totalPages - 1); page += 1) {
      pages.add(page);
    }
  } else if (currentPage >= totalPages - 2) {
    for (
      let page = Math.max(2, totalPages - 3);
      page <= totalPages - 1;
      page += 1
    ) {
      pages.add(page);
    }
  } else {
    pages.add(currentPage - 1);
    pages.add(currentPage);
    pages.add(currentPage + 1);
  }

  const sortedPages = Array.from(pages).sort((a, b) => a - b);
  const items: PageItem[] = [];

  sortedPages.forEach((page, index) => {
    if (index > 0 && page - sortedPages[index - 1] > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  });

  return items;
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  itemLabel = "orders",
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);
  const pageItems = buildPageItems(page, totalPages);

  return (
    <div className="flex flex-col gap-4 border-t border-outline-variant/5 bg-surface-container-low px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:flex-1">
        <span className="text-sm font-medium text-on-surface-variant">
          Showing {startItem}-{endItem} of {totalItems} {itemLabel}
        </span>
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          Rows
          <select
            className="rounded-full border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-sm font-semibold tracking-normal text-on-surface outline-none transition-colors hover:border-primary/30 focus:border-primary"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label={`Rows per page for ${itemLabel}`}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-surface-container-high px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/20 text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-30"
            aria-label={`Go to first ${itemLabel} page`}
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/20 text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-30"
            aria-label={`Go to previous ${itemLabel} page`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pageItems.map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-sm font-bold text-outline"
                aria-hidden="true"
              >
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={page === item ? "page" : undefined}
                className={`min-w-10 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                  page === item
                    ? "bg-primary text-on-primary shadow-md"
                    : "border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {item}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/20 text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-30"
            aria-label={`Go to next ${itemLabel} page`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/20 text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-30"
            aria-label={`Go to last ${itemLabel} page`}
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
