"use client";

import { useGuardianData } from "@/hooks/use-guardian-data";
import { PatientSummaryCard } from "./patient-summary-card";
import { NextTransfusionCard } from "./next-transfusion-card";
import { CurrentStatusCard } from "./current-status-card";
import { UpcomingTransfusionsList } from "./upcoming-transfusions-list";
import { EmergencyRequestCard } from "./emergency-request-card";
import { RecentDonationsList } from "./recent-donations-list";
import { HelplineCard } from "./helpline-card";

/**
 * Guardian Dashboard overview.
 *
 * All patient and transfusion data is fetched from real backend endpoints.
 * Fields that the backend does not yet store (photo, age, hemoglobin,
 * guardian-scoped donations) render empty states instead of placeholder
 * values.
 */
export function GuardianDashboard() {
  const { user, patient, upcomingCases, loading, error } = useGuardianData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Hello, {user?.name || "Guardian"} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You are not alone. We are here with you.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Could not load dashboard data: {error.message || "Unknown error"}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <PatientSummaryCard patient={patient} loading={loading} className="lg:col-span-1" />
        <NextTransfusionCard patient={patient} loading={loading} className="lg:col-span-1" />
        <CurrentStatusCard patient={patient} loading={loading} className="lg:col-span-1" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UpcomingTransfusionsList cases={upcomingCases} loading={loading} />
        </div>
        <div className="space-y-6 lg:col-span-1">
          <EmergencyRequestCard />
          <RecentDonationsList donations={[]} loading={loading} />
          <HelplineCard />
        </div>
      </div>
    </div>
  );
}
