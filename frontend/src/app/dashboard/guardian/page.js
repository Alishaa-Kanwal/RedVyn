"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Droplet, Stethoscope, UserRound, Users } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { OverviewCard } from "@/components/dashboard/overview-card";
import { bloodLabel } from "@/lib/registry-config";
import { casesApi } from "@/lib/api";

export default function GuardianDashboardPage() {
  const { user } = useAuth();
  // The patients linked to this guardian. Same endpoint the case form picks from, so the
  // overview can never disagree with what you are allowed to raise a case for.
  const [patients, setPatients] = useState(null);

  useEffect(() => {
    let cancelled = false;
    casesApi
      .myPatients()
      .then(({ body }) => !cancelled && setPatients(body.patients))
      .catch(() => !cancelled && setPatients([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = patients === null;
  const primary = patients?.[0];

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-bold text-foreground">Guardian Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome back{primary ? `. You are caring for ${primary.firstName}` : ""}.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewCard
          icon={Droplet}
          title="Blood Group"
          loading={loading}
          value={primary?.bloodGroup ? bloodLabel(primary.bloodGroup) : null}
        />
        <OverviewCard
          icon={Stethoscope}
          title="Home Hospital"
          loading={loading}
          value={primary?.homeHospital?.name}
        />
        <OverviewCard
          icon={UserRound}
          title="Guardian"
          loading={loading}
          value={primary?.guardian?.name || user?.name}
        />
        <OverviewCard
          icon={Users}
          title="Patients"
          loading={loading}
          value={patients ? String(patients.length) : null}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-2 font-semibold text-foreground">Need blood?</h2>
        <p className="text-sm text-muted-foreground">
          Raise a case from{" "}
          <Link href="/dashboard/guardian/cases" className="font-semibold text-primary underline">
            My Cases
          </Link>
          . You will get a family link to track progress and confirm the donation with the code the
          donor is given at the desk.
        </p>
      </div>
    </div>
  );
}
