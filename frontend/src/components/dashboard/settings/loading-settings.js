"use client";

export function LoadingSettings() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded-lg bg-muted" />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left nav skeleton */}
        <div className="hidden space-y-3 lg:col-span-3 lg:block">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>

        {/* Middle panel skeleton */}
        <div className="space-y-6 lg:col-span-5">
          <div className="h-6 w-40 animate-pulse rounded-lg bg-muted" />
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="h-11 animate-pulse rounded-xl bg-muted" />
              </div>
            ))}
            <div className="h-12 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>

        {/* Right panels skeleton */}
        <div className="space-y-6 lg:col-span-4">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="h-6 w-48 animate-pulse rounded-lg bg-muted" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-6 w-11 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="h-6 w-40 animate-pulse rounded-lg bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-11 animate-pulse rounded-xl bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="h-11 animate-pulse rounded-xl bg-muted" />
            </div>
            <div className="h-10 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
