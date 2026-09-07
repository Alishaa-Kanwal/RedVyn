"use client";

import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const HELPLINE = process.env.NEXT_PUBLIC_HELPLINE ?? "+92 300 1234567";

export function HelplineCard({ className }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Phone className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">24/7 Helpline</p>
          <a
            href={`tel:${HELPLINE.replace(/\s/g, "")}`}
            className="text-lg font-bold text-foreground hover:text-primary"
          >
            {HELPLINE}
          </a>
        </div>
      </div>
    </div>
  );
}
