"use client";

import { useState } from "react";
import { FileDown, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { ReportsChart } from "@/components/dashboard/reports-chart";
import { useReports } from "@/hooks/use-reports";
import { Activity, Heart, Phone, Briefcase } from "lucide-react";
import { jsPDF } from "jspdf";
import { addDays, toISODate } from "@/lib/date-utils";

const CASE_TYPE_OPTIONS = [
  { value: "all", label: "All Case Types" },
  { value: "emergency", label: "Emergency" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
];

function formatDuration(minutes) {
  if (minutes == null) return "—";
  const m = Math.floor(minutes);
  const s = Math.floor((minutes - m) * 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function exportReportPDF({ summary, casesOverTime }, start, end, typeFilter) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("RedVyn Operations Report", 14, 20);

  doc.setFontSize(11);
  doc.text(
    `Period: ${start.toLocaleDateString("en-US")} - ${end.toLocaleDateString("en-US")}`,
    14,
    30,
  );
  doc.text(`Filter: ${CASE_TYPE_OPTIONS.find((o) => o.value === typeFilter)?.label || typeFilter}`, 14, 38);

  doc.setFontSize(12);
  doc.text("Summary", 14, 52);
  doc.setFontSize(10);
  const summaryRows = [
    `Total Cases: ${summary.totalCases}`,
    `Successful Matches: ${summary.successfulMatches}`,
    `Avg. Response Time: ${formatDuration(summary.avgResponseTimeMinutes)}`,
    `Lives Supported: ${summary.livesSupported}`,
  ];
  summaryRows.forEach((row, i) => doc.text(row, 14, 62 + i * 7));

  if (casesOverTime && casesOverTime.length > 0) {
    doc.setFontSize(12);
    doc.text("Cases Over Time", 14, 102);
    doc.setFontSize(9);
    doc.text("Date       Emergency  Scheduled  Completed", 14, 110);
    casesOverTime.slice(0, 40).forEach((point, i) => {
      const line = `${point.date}      ${point.emergency || 0}          ${point.scheduled || 0}          ${point.completed || 0}`;
      doc.text(line, 14, 118 + i * 5);
    });
  }

  doc.save(`redvyn-report-${toISODate(start)}.pdf`);
}

export default function AdminReportsPage() {
  const [endDate, setEndDate] = useState(new Date());
  const [startDate, setStartDate] = useState(addDays(new Date(), -13));
  const [typeFilter, setTypeFilter] = useState("all");

  const { data, loading, error, refresh } = useReports(startDate, endDate, typeFilter);

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2">
            <input
              type="date"
              value={toISODate(startDate)}
              onChange={(e) => setStartDate(new Date(e.target.value))}
              className="bg-transparent text-sm text-foreground focus:outline-none"
            />
            <span className="text-muted-foreground">-</span>
            <input
              type="date"
              value={toISODate(endDate)}
              onChange={(e) => setEndDate(new Date(e.target.value))}
              className="bg-transparent text-sm text-foreground focus:outline-none"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none"
          >
            {CASE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {error && (
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          )}
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => data && exportReportPDF(data, startDate, endDate, typeFilter)}
            disabled={!data || loading}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {error && !loading && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{error.message || "Unable to load reports."}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Briefcase}
          label="Total Cases"
          value={summary?.totalCases?.toLocaleString() ?? "—"}
          trend={summary?.trends?.totalCases}
          trendDirection={summary?.trends?.totalCases >= 0 ? "up" : "down"}
          loading={loading}
          error={error}
        />
        <StatCard
          icon={Heart}
          label="Successful Matches"
          value={summary?.successfulMatches?.toLocaleString() ?? "—"}
          trend={summary?.trends?.successfulMatches}
          trendDirection={summary?.trends?.successfulMatches >= 0 ? "up" : "down"}
          loading={loading}
          error={error}
        />
        <StatCard
          icon={Phone}
          label="Avg. Response Time"
          value={formatDuration(summary?.avgResponseTimeMinutes)}
          trend={summary?.trends?.avgResponseTime}
          trendDirection={summary?.trends?.avgResponseTime >= 0 ? "up" : "down"}
          loading={loading}
          error={error}
        />
        <StatCard
          icon={Activity}
          label="Lives Supported"
          value={summary?.livesSupported?.toLocaleString() ?? "—"}
          trend={summary?.trends?.livesSupported}
          trendDirection={summary?.trends?.livesSupported >= 0 ? "up" : "down"}
          loading={loading}
          error={error}
        />
      </div>

      {/* Chart */}
      <ReportsChart data={data?.casesOverTime} loading={loading} />
    </div>
  );
}
