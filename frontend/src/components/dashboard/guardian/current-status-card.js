"use client";

import { Activity } from "lucide-react";
import { formatDate } from "@/lib/registry-config";
import { cn } from "@/lib/utils";

/**
 * Current Status card.
 *
 * Hemoglobin and a clinical status value are not tracked by the backend yet,
 * so this card shows an empty state for those fields and only displays the
 * real patient.updatedAt timestamp as "Last updated".
 */
export function CurrentStatusCard({ patient, loading, className }) {
  if (loading) {
    return (
      <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const lastUpdated = patient?.updatedAt ? formatDate(patient.updatedAt) : null;

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Current Status</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">—</p>
          <p className="mt-2 text-xs text-muted-foreground">Hemoglobin not recorded</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Activity className="h-5 w-5" />
        </div>
      </div>

      {lastUpdated && (
        <p className="mt-5 text-xs text-muted-foreground">(Last Updated {lastUpdated})</p>
      )}
    </div>
  );
}
