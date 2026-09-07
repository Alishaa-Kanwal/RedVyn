"use client";

import { ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({ icon: Icon, label, value, trend, trendDirection, loading, error }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex h-28 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm text-destructive">Unable to load</p>
      </div>
    );
  }

  const isPositive = trendDirection === "up";
  const TrendIcon = isPositive ? ArrowUp : ArrowDown;
  const hasTrend = typeof trend === "number";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value ?? "—"}</p>
          {hasTrend && (
            <div className={cn("mt-2 inline-flex items-center gap-1 text-xs font-semibold", isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              <TrendIcon className="h-3.5 w-3.5" />
              {Math.abs(trend)}%
              <span className="font-normal text-muted-foreground">from yesterday</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
