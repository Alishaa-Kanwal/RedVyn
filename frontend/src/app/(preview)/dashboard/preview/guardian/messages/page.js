"use client";

import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/dashboard/guardian/empty-state";

export default function GuardianMessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">WhatsApp messaging integration is coming soon.</p>
      </div>

      <EmptyState
        title="Messages"
        description="Real WhatsApp messaging is being built separately (Phase 13) and is not in scope for this dashboard preview."
      >
        <MessageSquare className="mt-3 h-8 w-8 text-muted-foreground" />
      </EmptyState>
    </div>
  );
}
