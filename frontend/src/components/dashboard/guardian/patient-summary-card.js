"use client";

import { bloodLabel } from "@/lib/registry-config";
import { cn } from "@/lib/utils";

/**
 * Patient summary card for the Guardian dashboard.
 *
 * The backend Patient model currently ships firstName, condition, bloodGroup,
 * and id. Age and photo are not stored, so they render as empty states rather
 * than fabricated values.
 */
export function PatientSummaryCard({ patient, loading, className }) {
  if (loading) {
    return (
      <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
        <div className="flex animate-pulse gap-4">
          <div className="h-24 w-24 rounded-2xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="h-4 w-48 rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
        <p className="text-sm text-muted-foreground">No linked patient found.</p>
      </div>
    );
  }

  const initials = patient.firstName?.charAt(0).toUpperCase() || "?";
  const condition = patient.condition === "thalassemia_major" ? "Thalassemia Major" : patient.condition?.replace(/_/g, " ") || "—";

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* Photo placeholder */}
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-3xl font-bold text-primary">
          {initials}
        </div>

        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">{patient.firstName}</h2>
          <p className="text-sm text-muted-foreground">{condition}</p>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1.5">
              <span className="text-lg font-bold text-primary">{bloodLabel(patient.bloodGroup)}</span>
            </div>

            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Age:</span> Not recorded
            </div>

            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">ID:</span>{" "}
              <span className="font-mono text-xs">{patient.id}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
