"use client";

import { MapPin } from "lucide-react";
import { formatDate } from "@/lib/registry-config";
import { CaseStatePill } from "./case-state-pill";
import { EmptyState } from "./empty-state";
import { cn } from "@/lib/utils";

/**
 * Horizontal list of upcoming transfusions derived from the patient's real
 * cases. Status labels and colours map 1:1 to the backend CaseState enum.
 */
export function UpcomingTransfusionsList({ cases, loading, className }) {
  if (loading) {
    return (
      <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <h2 className="text-lg font-bold text-foreground">Upcoming Transfusions</h2>

      {cases.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No upcoming transfusions"
            description="When a case is scheduled for this patient, it will appear here."
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((kase) => (
            <div
              key={kase.id}
              className="rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-primary">{formatDate(kase.neededAt)}</p>
                  <div className="mt-2 flex items-start gap-1.5 text-sm text-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>{kase.hospital?.name ?? "—"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{kase.hospital?.city ?? ""}</p>
                </div>
                <CaseStatePill state={kase.state} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
