"use client";

import { useEffect, useState } from "react";
import { Droplet, MapPin, Activity } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { OverviewCard } from "@/components/dashboard/overview-card";
import { bloodLabel } from "@/lib/registry-config";
import { profileApi } from "@/lib/api";

export default function DonorDashboardPage() {
  const { user } = useAuth();
  // /api/auth/me carries identity only. The donor's own blood group and city come from
  // the profile endpoint, the same record the settings page edits.
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let cancelled = false;
    profileApi
      .get()
      .then(({ body }) => !cancelled && setProfile(body.profile))
      .catch(() => !cancelled && setProfile({}));
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = profile === null;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-bold text-foreground">Donor Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome back, {user?.name}. Thank you for being a lifesaver.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <OverviewCard
          icon={Droplet}
          title="Blood Group"
          loading={loading}
          value={profile?.bloodGroup ? bloodLabel(profile.bloodGroup) : null}
        />
        <OverviewCard icon={MapPin} title="City" loading={loading} value={profile?.city} />
        <OverviewCard
          icon={Activity}
          title="Status"
          loading={loading}
          value={profile?.status === "active" ? "Active" : profile?.status?.replace(/_/g, " ")}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-2 font-semibold text-foreground">What happens next?</h2>
        <p className="text-sm text-muted-foreground">
          When a patient near you needs blood that matches your group, RedVyn will reach out with
          an offer. You can accept or decline directly from the link we send.
        </p>
      </div>
    </div>
  );
}
