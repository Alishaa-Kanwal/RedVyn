"use client";

import { AlertCircle } from "lucide-react";

export default function AdminEmergencyPage() {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Emergency</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            There are no active emergency cases to review right now.
          </p>
        </div>
      </div>
    </section>
  );
}
