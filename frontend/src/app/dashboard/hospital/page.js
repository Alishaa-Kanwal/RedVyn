"use client";

import { useEffect, useState } from "react";
import { Building2, MapPin, BadgeCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { OverviewCard } from "@/components/dashboard/overview-card";
import { profileApi } from "@/lib/api";

export default function HospitalDashboardPage() {
  const { user } = useAuth();
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
      <h1 className="font-serif text-3xl font-bold text-foreground">Hospital Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome back, {user?.name}. Manage cases and donor coordination.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <OverviewCard icon={Building2} title="Hospital" loading={loading} value={profile?.name} />
        <OverviewCard icon={MapPin} title="City" loading={loading} value={profile?.city} />
        <OverviewCard
          icon={BadgeCheck}
          title="Verified"
          loading={loading}
          value={profile?.verified ? "Yes" : "Pending review"}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-2 font-semibold text-foreground">Blood bank desk</h2>
        <p className="text-sm text-muted-foreground">
          {profile?.deskInfo ||
            "Set where donors should report from Settings — it is what a matched donor is shown."}
        </p>
      </div>
    </div>
  );
}
