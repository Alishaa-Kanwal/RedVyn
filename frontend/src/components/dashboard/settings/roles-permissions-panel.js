"use client";

import { Loader2, RefreshCcw, Shield } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

const ROLE_COLORS = {
  admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  donor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  guardian: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  hospital: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

function InlineError({ error, onRetry }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <p className="text-sm text-muted-foreground">{error?.message || "Could not load roles."}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        <RefreshCcw className="h-4 w-4" />
        Retry
      </button>
    </div>
  );
}

export function RolesPermissionsPanel() {
  const { data, loading, error, refresh } = useApi("/api/auth/roles");
  const roles = data?.roles || [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-foreground">Roles & Permissions</h2>
        <p className="text-sm text-muted-foreground">
          Permissions derived from the actual backend route-level role gates.
        </p>
      </div>

      {error && <InlineError error={error} onRetry={refresh} />}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {roles.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">No role data available.</p>
          )}
          {roles.map((item) => (
            <div
              key={item.role}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase",
                    ROLE_COLORS[item.role] || "bg-muted text-muted-foreground"
                  )}
                >
                  {item.role}
                </span>
              </div>
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-foreground">
                {item.permissions.map((permission, idx) => (
                  <li key={idx}>{permission}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
