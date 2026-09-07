"use client";

import { useGuardianData } from "@/hooks/use-guardian-data";
import { UpcomingTransfusionsList } from "@/components/dashboard/guardian/upcoming-transfusions-list";

export default function GuardianUpcomingPage() {
  const { upcomingCases, loading, error } = useGuardianData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upcoming Transfusions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scheduled and in-progress cases for your patient.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Could not load cases: {error.message || "Unknown error"}
        </div>
      )}

      <UpcomingTransfusionsList cases={upcomingCases} loading={loading} />
    </div>
  );
}
