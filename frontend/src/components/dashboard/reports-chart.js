"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

const SERIES = [
  { key: "emergency", label: "Emergency", className: "text-chart-5" },
  { key: "scheduled", label: "Scheduled", className: "text-chart-2" },
  { key: "completed", label: "Completed", className: "text-chart-4" },
];

export function ReportsChart({ data, loading }) {
  const {
    pathData,
    maxValue,
    width: chartWidth,
    height: chartHeightValue,
    padding: chartPadding,
    chartHeight: plotHeight,
    xFor,
  } = useMemo(() => {
    if (!data || data.length === 0) return { pathData: [], maxValue: 10 };

    const width = 700;
    const height = 220;
    const padding = { top: 16, right: 16, bottom: 32, left: 32 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const values = data.flatMap((d) => SERIES.map((s) => d[s.key] || 0));
    const max = Math.max(1, ...values);
    const roundedMax = Math.ceil(max / 5) * 5;

    const xFor = (i) => padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const yFor = (v) => padding.top + chartHeight - (v / roundedMax) * chartHeight;

    const paths = SERIES.map((series) => {
      const d = data
        .map((point, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(point[series.key] || 0)}`)
        .join(" ");
      return { key: series.key, d, className: series.className };
    });

    return {
      pathData: paths,
      maxValue: roundedMax,
      width,
      height,
      padding,
      xFor,
      yFor,
      chartWidth,
      chartHeight,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="h-64 w-full animate-pulse rounded-xl bg-muted" />
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
        <p className="text-sm text-muted-foreground">No trend data available.</p>
      </div>
    );
  }

  const width = chartWidth || 700;
  const height = chartHeightValue || 220;
  const padding = chartPadding || { top: 16, right: 16, bottom: 32, left: 32 };
  const chartHeight = plotHeight || height - padding.top - padding.bottom;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", s.className.replace("text-", "bg-"))} />
            <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full min-w-[600px]"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = padding.top + chartHeight * (1 - ratio);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  className="stroke-border"
                  strokeDasharray="4 4"
                />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
                  {Math.round(maxValue * ratio)}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {data.map((point, i) => {
            const step = Math.max(1, Math.floor(data.length / 6));
            if (i % step !== 0 && i !== data.length - 1) return null;
            const x = xFor(i);
            return (
              <text
                key={point.date}
                x={x}
                y={height - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {formatLabel(point.date)}
              </text>
            );
          })}

          {/* Series lines */}
          {pathData.map((series) => (
            <path
              key={series.key}
              d={series.d}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn("transition-all duration-700", series.className)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

function formatLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}
