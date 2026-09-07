"use client";

import { Droplet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Emergency Request card.
 *
 * The backend currently restricts POST /api/cases to admin users, so a
 * guardian-facing self-service creation endpoint does not exist yet. The
 * button is wired to a no-op handler that surfaces this limitation clearly
 * instead of fabricating a case creation flow.
 *
 * TODO: Replace the toast with a real POST once a guardian-scoped case
 * creation endpoint is added to the backend roadmap.
 */
export function EmergencyRequestCard({ className }) {
  function handleRequest() {
    toast.info("Guardian self-service blood requests are not available yet.");
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <h2 className="text-lg font-bold text-foreground">Emergency Request</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Use this only for urgent, unscheduled transfusions.
      </p>

      <Button
        onClick={handleRequest}
        className="mt-5 w-full bg-destructive text-white hover:bg-destructive/90"
      >
        <Droplet className="mr-2 h-4 w-4" />
        <span className="flex flex-col items-start leading-tight">
          <span className="text-base font-bold">I Need Blood</span>
          <span className="text-[10px] font-medium opacity-90">Request Now</span>
        </span>
      </Button>
    </div>
  );
}
