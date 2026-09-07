"use client";

import { Stethoscope, MapPin, Calendar, Droplet } from "lucide-react";
import { useGuardianData } from "@/hooks/use-guardian-data";
import { bloodLabel, formatDate } from "@/lib/registry-config";
import { EmptyState } from "@/components/dashboard/guardian/empty-state";

export default function GuardianPatientPage() {
  const { patient, loading, error } = useGuardianData();

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">My Patient</h1>
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">My Patient</h1>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Could not load patient: {error.message || "Unknown error"}
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">My Patient</h1>
        <EmptyState title="No patient linked" description="There is no patient linked to this guardian account yet." />
      </div>
    );
  }

  const condition =
    patient.condition === "thalassemia_major"
      ? "Thalassemia Major"
      : patient.condition?.replace(/_/g, " ") || "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Patient</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everything about {patient.firstName}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailCard icon={Stethoscope} label="Condition" value={condition} />
        <DetailCard icon={Droplet} label="Blood Group" value={bloodLabel(patient.bloodGroup)} />
        <DetailCard icon={MapPin} label="Home Hospital" value={patient.homeHospital?.name ?? "—"} sub={patient.homeHospital?.city} />
        <DetailCard
          icon={Calendar}
          label="Last Transfusion"
          value={patient.lastTransfusionAt ? formatDate(patient.lastTransfusionAt) : "Not recorded"}
        />
        <DetailCard
          icon={Calendar}
          label="Predicted Next Transfusion"
          value={patient.predictedNextAt ? formatDate(patient.predictedNextAt) : "Not predicted"}
        />
        <DetailCard
          icon={Calendar}
          label="Transfusion Interval"
          value={`${patient.intervalDaysEstimate} days`}
        />
      </div>
    </div>
  );
}

function DetailCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/20">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value || "—"}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
