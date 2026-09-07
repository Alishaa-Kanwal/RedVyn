"use client";

import { Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

function timeAgo(isoDate) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const COLOR_MAP = {
  1: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
  2: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  3: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  4: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  5: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
};

export function RecentActivityFeed({ items, loading, error }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-base font-semibold text-foreground">Recent Activity</p>
        <div className="flex h-56 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-base font-semibold text-foreground">Recent Activity</p>
        <p className="mt-4 text-sm text-destructive">Unable to load activity.</p>
      </div>
    );
  }

  const activities = items?.length ? items : [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-base font-semibold text-foreground">Recent Activity</p>

      {activities.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-4">
            {activities.map((item, i) => {
              const Icon = item.icon;
              return (
                <li key={i} className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      COLOR_MAP[item.color] || COLOR_MAP[1],
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.time)}</span>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            View All Activity <ArrowRight className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
