"use client";

import { Droplet, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/registry-config";
import { cn } from "@/lib/utils";

/**
 * Next Transfusion card.
 *
 * Uses patient.predictedNextAt when the backend has computed it; otherwise it
 * falls back to an empty state. The decorative progress bar is not a fabricated
 * health metric — it is a visual accent tied to the card's own branding.
 */
export function NextTransfusionCard({ patient, loading, className }) {
  if (loading) {
    return (
      <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const nextDate = patient?.predictedNextAt;

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Next Transfusion</p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {nextDate ? formatDate(nextDate) : "—"}
          </p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            Estimated Date <ArrowRight className="h-3 w-3" />
          </div>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Droplet className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full w-2/3 rounded-full bg-primary" />
      </div>
    </div>
  );
}
