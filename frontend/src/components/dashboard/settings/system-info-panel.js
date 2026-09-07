"use client";

import { Info } from "lucide-react";
import packageJson from "@/../package.json";

export function SystemInfoPanel() {
  const appVersion = packageJson.version || "unknown";
  const nodeEnv = process.env.NODE_ENV || "development";
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-foreground">System Info</h2>
        <p className="text-sm text-muted-foreground">Real-time system details.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">Application Details</h3>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">App Version</p>
            <p className="text-sm text-foreground">{appVersion}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">NODE_ENV</p>
            <p className="text-sm text-foreground">{nodeEnv}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">API Base URL</p>
            <p className="text-sm text-foreground break-all">{apiBase}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
