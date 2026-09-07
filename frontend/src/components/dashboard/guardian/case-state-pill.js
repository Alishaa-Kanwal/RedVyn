"use client";

import { CASE_STATUSES } from "@/lib/registry-config";
import { cn } from "@/lib/utils";

/**
 * Maps real CaseState values (from the backend enum) to a colour. The label is
 * taken from the existing CASE_STATUSES config so the UI never invents labels.
 */
const STATE_STYLES = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
  matching: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  awaiting_response: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  partially_filled: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  filled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  closed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  pending_review: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  escalating: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  broadcasting: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  fallback_bloodbank: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  unfilled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function CaseStatePill({ state, className }) {
  const label = CASE_STATUSES.find((s) => s.value === state)?.label || (state || "unknown").replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        STATE_STYLES[state] || "bg-muted text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
