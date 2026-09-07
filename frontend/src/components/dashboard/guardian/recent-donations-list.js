"use client";

import { Droplet } from "lucide-react";
import { EmptyState } from "./empty-state";
import { cn } from "@/lib/utils";

/**
 * Recent Donations list.
 *
 * The backend does not expose a guardian-scoped donation history endpoint yet
 * (donations are stored, but only surfaced via donor history and the public
 * family confirmation page). This widget therefore renders an empty state with
 * a TODO note rather than fabricating donation rows.
 *
 * TODO: Wire to a real guardian donation endpoint once it ships.
 */
export function RecentDonationsList({ donations, loading, className }) {
  if (loading) {
    return (
      <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <h2 className="text-lg font-bold text-foreground">Recent Donations</h2>

      {donations && donations.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {donations.map((donation) => (
            <li
              key={donation.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Droplet className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {donation.units ? `${donation.units} Units` : "Donation"}
                </p>
                <p className="truncate text-xs text-muted-foreground">{donation.hospitalName}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4">
          <EmptyState
            title="No recent donations"
            description="Donation history is not exposed to the guardian API yet. This will populate once the backend ships a guardian-scoped donation endpoint."
          />
        </div>
      )}
    </div>
  );
}
