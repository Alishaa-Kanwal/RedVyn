"use client";

import { useGuardianData } from "@/hooks/use-guardian-data";
import { CaseStatePill } from "@/components/dashboard/guardian/case-state-pill";
import { EmptyState } from "@/components/dashboard/guardian/empty-state";
import { bloodLabel, formatDate } from "@/lib/registry-config";

export default function GuardianRequestsPage() {
  const { cases, loading, error } = useGuardianData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">All blood requests raised for your patient.</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Could not load requests: {error.message || "Unknown error"}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : cases.length === 0 ? (
        <EmptyState
          title="No requests yet"
          description="No blood requests have been created for your patient."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date Needed</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Blood</th>
                  <th className="px-5 py-3 font-semibold">Units</th>
                  <th className="px-5 py-3 font-semibold">Hospital</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cases.map((kase) => (
                  <tr key={kase.id} className="bg-card hover:bg-muted/30">
                    <td className="px-5 py-4 font-medium text-foreground">{formatDate(kase.neededAt)}</td>
                    <td className="px-5 py-4 capitalize text-foreground">{kase.type}</td>
                    <td className="px-5 py-4 font-medium text-primary">{bloodLabel(kase.bloodGroup)}</td>
                    <td className="px-5 py-4 text-foreground">
                      {kase.unitsSecured ?? 0}/{kase.unitsRequired ?? 0}
                    </td>
                    <td className="px-5 py-4 text-foreground">{kase.hospital?.name ?? "—"}</td>
                    <td className="px-5 py-4">
                      <CaseStatePill state={kase.state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
