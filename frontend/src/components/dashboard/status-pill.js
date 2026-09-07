"use client";

import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  opted_out: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function StatusPill({ status, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        STATUS_STYLES[status] || "bg-muted text-muted-foreground",
        className,
      )}
    >
      {(status || "unknown").replace(/_/g, " ")}
    </span>
  );
}
