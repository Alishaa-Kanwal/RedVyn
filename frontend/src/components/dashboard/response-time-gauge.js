"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

function formatMinutes(totalMinutes) {
  const mins = Math.floor(totalMinutes);
  const secs = Math.floor((totalMinutes - mins) * 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function ResponseTimeGauge({ value, max = 5, sparkline, loading, error }) {
  const radius = 70;
  const stroke = 12;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const arcLength = circumference * 0.75;
  const share = Math.min(Math.max((value || 0) / max, 0), 1);
  const dash = arcLength * share;
  const gap = circumference - dash;

  const path = useMemo(() => {
    if (!sparkline || sparkline.length === 0) return null;
    const width = 220;
    const height = 48;
    const padding = 4;
    const min = Math.min(...sparkline);
    const maxVal = Math.max(...sparkline);
    const range = maxVal - min || 1;
    const stepX = (width - padding * 2) / (sparkline.length - 1);

    return sparkline
      .map((point, i) => {
        const x = padding + i * stepX;
        const y = height - padding - ((point - min) / range) * (height - padding * 2);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [sparkline]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-base font-semibold text-foreground">Average Response Time</p>
        <div className="flex h-56 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-base font-semibold text-foreground">Average Response Time</p>
        <p className="mt-4 text-sm text-destructive">Unable to load response time.</p>
      </div>
    );
  }

  const hasData = typeof value === "number";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-base font-semibold text-foreground">Average Response Time</p>

      {!hasData ? (
        <div className="flex h-56 flex-col items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">No response time data available.</p>
        </div>
      ) : (
        <>
          <div className="relative mx-auto mt-2 h-40 w-40">
            <svg width="100%" height="100%" viewBox={`0 0 ${radius * 2} ${radius * 2}`} className="-rotate-[135deg]">
              <circle
                cx={radius}
                cy={radius}
                r={normalizedRadius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth={stroke}
                strokeDasharray={`${arcLength} ${circumference - arcLength}`}
                strokeLinecap="round"
                className="text-muted"
              />
              <circle
                cx={radius}
                cy={radius}
                r={normalizedRadius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={0}
                strokeLinecap="round"
                className="text-primary"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-foreground">{formatMinutes(value)}</span>
              <span className="text-xs text-muted-foreground">Minutes</span>
            </div>
          </div>

          {path && (
            <div className="mt-2 h-12 w-full overflow-hidden">
              <svg
                viewBox="0 0 220 48"
                preserveAspectRatio="none"
                className="h-full w-full text-primary"
                fill="none"
              >
                <motion.path
                  d={path}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                />
                <motion.path
                  d={`${path} L 220 48 L 0 48 Z`}
                  fill="currentColor"
                  className="text-primary/10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 0.3 }}
                />
              </svg>
            </div>
          )}
        </>
      )}
    </div>
  );
}
