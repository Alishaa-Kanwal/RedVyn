"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmergencyBroadcastBanner({ activeCase, loading, error }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-base font-semibold text-foreground">Emergency Broadcasts</p>
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-base font-semibold text-foreground">Emergency Broadcasts</p>
        <p className="mt-4 text-sm text-destructive">Unable to load broadcasts.</p>
      </div>
    );
  }

  const hasCase = activeCase && activeCase.unitsRequired > 0;
  const secured = activeCase?.unitsSecured || 0;
  const required = activeCase?.unitsRequired || 0;
  const progress = required > 0 ? Math.round((secured / required) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold text-foreground">Emergency Broadcasts</p>
        {hasCase && (
          <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 dark:bg-red-950 dark:text-red-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            Live Now
          </div>
        )}
      </div>

      {!hasCase ? (
        <div className="flex h-40 flex-col items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">No active emergency broadcasts.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-foreground">{activeCase.title}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{activeCase.unitsRequired} Units</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium text-primary">{activeCase.bloodGroup}</span>
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-950 dark:text-red-400">
              Live
            </span>
          </div>

          <p className="text-sm text-muted-foreground">{activeCase.hospital}</p>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">
                {secured} / {required} Units Secured
              </span>
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              View Case
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
