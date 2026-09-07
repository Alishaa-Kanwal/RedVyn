"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({ page, pageSize, total, onChange }) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);

  function getVisiblePages() {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = [1];
    const start = Math.max(2, current - 2);
    const end = Math.min(totalPages - 1, current + 2);

    if (start > 2) pages.push("...");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("...");
    pages.push(totalPages);

    return pages;
  }

  const visible = getVisiblePages();

  return (
    <div className="flex items-center justify-center gap-1.5 py-4">
      <button
        type="button"
        onClick={() => onChange(current - 1)}
        disabled={current <= 1}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {visible.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">
            ...
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors",
              p === current
                ? "bg-primary text-primary-foreground"
                : "border border-border text-foreground hover:bg-muted",
            )}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(current + 1)}
        disabled={current >= totalPages}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
