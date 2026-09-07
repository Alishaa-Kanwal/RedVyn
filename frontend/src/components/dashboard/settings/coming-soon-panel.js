"use client";

import { Construction } from "lucide-react";

export function ComingSoonPanel({ title }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Construction className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This section is coming soon. Only General and Notifications settings are built out for
        this pass.
      </p>
    </div>
  );
}
