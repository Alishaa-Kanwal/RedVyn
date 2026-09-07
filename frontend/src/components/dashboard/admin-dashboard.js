"use client";

import { Activity, Droplet, Heart, Phone } from "lucide-react";
import { useDashboardOverview } from "@/hooks/use-dashboard-overview";
import { StatCard } from "./stat-card";
import { CaseStatusDonut } from "./case-status-donut";
import { ResponseTimeGauge } from "./response-time-gauge";
import { RecentActivityFeed } from "./recent-activity-feed";
import { EmergencyBroadcastBanner } from "./emergency-broadcast-banner";
import { LiveMapPanel } from "./live-map-panel";

export function AdminDashboard() {
  const {
    loading,
    error,
    stats,
    caseStatus,
    responseTime,
    responseSparkline,
    recentActivity,
    activeEmergencyCase,
    hospitals,
    donors,
  } = useDashboardOverview();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Active Cases"
          value={stats.activeCases.toLocaleString()}
          loading={loading}
          error={error}
        />
        <StatCard
          icon={Droplet}
          label="Donors Online"
          value={stats.donorsOnline.toLocaleString()}
          loading={loading}
          error={error}
        />
        <StatCard
          icon={Phone}
          label="Today's Calls"
          value={stats.todaysCalls.toLocaleString()}
          loading={loading}
          error={error}
        />
        <StatCard
          icon={Heart}
          label="Lives Supported"
          value={stats.livesSupported.toLocaleString()}
          loading={loading}
          error={error}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <CaseStatusDonut data={caseStatus} loading={loading} error={error} />
        <ResponseTimeGauge
          value={responseTime}
          sparkline={responseSparkline}
          loading={loading}
          error={error}
        />
        <RecentActivityFeed items={recentActivity} loading={loading} error={error} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <EmergencyBroadcastBanner activeCase={activeEmergencyCase} loading={loading} error={error} />
        <LiveMapPanel
          hospitals={hospitals}
          donors={donors}
          activeCase={activeEmergencyCase}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  );
}
