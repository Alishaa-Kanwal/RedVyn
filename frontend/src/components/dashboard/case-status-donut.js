"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const COLOR_MAP = {
  1: "text-chart-1",
  2: "text-chart-2",
  3: "text-chart-3",
  4: "text-chart-4",
  5: "text-chart-5",
};

const BG_COLOR_MAP = {
  1: "bg-chart-1",
  2: "bg-chart-2",
  3: "bg-chart-3",
  4: "bg-chart-4",
  5: "bg-chart-5",
};

export function CaseStatusDonut({ data, loading, error }) {
  const items = data?.length ? data : [];
  const total = items.reduce((sum, item) => sum + (item.value || 0), 0);

  const radius = 52;
  const stroke = 14;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  const segments = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const value = item.value || 0;
        const share = total > 0 ? value / total : 0;
        const dash = share * circumference;
        const gap = circumference - dash;
        const offset = -acc.accumulated * circumference;
        acc.segments.push({ dash, gap, offset, color: item.color });
        acc.accumulated += share;
        return acc;
      },
      { segments: [], accumulated: 0 },
    ).segments;
  }, [items, total, circumference]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-base font-semibold text-foreground">Case Status</p>
        <div className="flex h-56 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-base font-semibold text-foreground">Case Status</p>
        <p className="mt-4 text-sm text-destructive">Unable to load case status.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-base font-semibold text-foreground">Case Status</p>

      {total === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">No case data available.</p>
        </div>
      ) : (
        <>
          <div className="relative mx-auto mt-4 h-44 w-44">
            <svg width="100%" height="100%" viewBox={`0 0 ${radius * 2} ${radius * 2}`} className="-rotate-90">
              <circle
                cx={radius}
                cy={radius}
                r={normalizedRadius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth={stroke}
                className="text-muted"
              />
              {segments.map((seg, i) => (
                <circle
                  key={i}
                  cx={radius}
                  cy={radius}
                  r={normalizedRadius}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth={stroke}
                  strokeDasharray={`${seg.dash} ${seg.gap}`}
                  strokeDashoffset={seg.offset}
                  strokeLinecap="round"
                  className={cn("transition-all duration-700", COLOR_MAP[seg.color] || COLOR_MAP[1])}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-foreground">{total}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
          </div>

          <ul className="mt-5 space-y-2.5">
            {items.map((item, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", BG_COLOR_MAP[item.color] || BG_COLOR_MAP[1])} />
                  <span className="text-muted-foreground">{item.label}</span>
                </div>
                <span className="font-semibold text-foreground">{item.value}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
