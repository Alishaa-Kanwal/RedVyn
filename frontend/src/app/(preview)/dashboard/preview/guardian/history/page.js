"use client";

import { useGuardianData } from "@/hooks/use-guardian-data";
import { CaseStatePill } from "@/components/dashboard/guardian/case-state-pill";
import { EmptyState } from "@/components/dashboard/guardian/empty-state";
import { bloodLabel, formatDate } from "@/lib/registry-config";

export default function GuardianHistoryPage() {
  const { historyCases, loading, error } = useGuardianData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Past transfusions and closed requests.</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Could not load history: {error.message || "Unknown error"}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : historyCases.length === 0 ? (
        <EmptyState
          title="No history yet"
          description="Completed or past-due cases will appear here once they are recorded."
        />
      ) : (
        <div className="space-y-3">
          {historyCases.map((kase) => (
            <div
              key={kase.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-bold text-foreground">{formatDate(kase.neededAt)}</p>
                <p className="text-xs text-muted-foreground">
                  {kase.hospital?.name ?? "—"} {kase.hospital?.city ? `· ${kase.hospital.city}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-primary">{bloodLabel(kase.bloodGroup)}</p>
                  <p className="text-xs text-muted-foreground">
                    {kase.unitsSecured ?? 0}/{kase.unitsRequired ?? 0} units
                  </p>
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
