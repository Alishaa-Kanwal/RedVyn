"use client";

import { Trophy } from "lucide-react";
import { EmptyState } from "@/components/dashboard/guardian/empty-state";

export default function GuardianMilestonesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Milestones</h1>
        <p className="mt-1 text-sm text-muted-foreground">Celebrate care milestones and transfusion targets.</p>
      </div>

      <EmptyState
        title="Milestones coming soon"
        description="Patient milestone tracking is not wired to a backend endpoint yet. Once the data model is ready, this page will show real achievements."
      >
        <Trophy className="mt-3 h-8 w-8 text-muted-foreground" />
      </EmptyState>
    </div>
  );
}
