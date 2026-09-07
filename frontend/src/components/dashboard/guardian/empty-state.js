"use client";

import { Info } from "lucide-react";

export function EmptyState({ title, description, children }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Info className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>}
      {children}
    </div>
  );
}
