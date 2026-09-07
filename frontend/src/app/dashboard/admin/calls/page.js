"use client";

import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CallsActivePanel } from "@/components/dashboard/calls-active-panel";
import { Pagination } from "@/components/dashboard/pagination";
import { useCalls } from "@/hooks/use-calls";
import { cn } from "@/lib/utils";

const OUTCOME_STYLES = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  call_back_later: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  not_available: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  wrong_number: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function formatTimestamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(totalSeconds) {
  if (totalSeconds == null) return "—";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function AdminCallsPage() {
  const { data: calls, loading, error, refresh, page, setPage, pagination } = useCalls();
  const [activeCall, setActiveCall] = useState(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Calls</h1>
        {error && (
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        )}
      </div>

      {error && !loading && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{error.message || "Unable to load calls."}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Call list */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Contact</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Type</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Outcome</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Started</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Duration</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 w-full animate-pulse rounded bg-muted" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : calls.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No call records yet.
                      </td>
                    </tr>
                  ) : (
                    calls.map((call) => (
                      <tr
                        key={call.id}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/30",
                          activeCall?.id === call.id && "bg-primary/5",
                        )}
                        onClick={() => setActiveCall(call)}
                      >
                        <td className="px-4 py-3 font-semibold text-foreground">{call.contactName}</td>
                        <td className="px-4 py-3 capitalize text-foreground">{call.contactType}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                              OUTCOME_STYLES[call.outcome] || "bg-muted text-foreground",
                            )}
                          >
                            {(call.outcome || "unknown").replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-foreground">{formatTimestamp(call.startedAt)}</td>
                        <td className="px-4 py-3 text-foreground">{formatDuration(call.durationSeconds)}</td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant={activeCall?.id === call.id ? "default" : "outline"}
                            className={
                              activeCall?.id === call.id
                                ? "bg-primary text-primary-foreground"
                                : "border-primary text-primary hover:bg-primary/10"
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveCall(call);
                            }}
                          >
                            {activeCall?.id === call.id ? "Active" : "Call"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loading && !error && calls.length > 0 && (
              <Pagination page={page} pageSize={pagination.pageSize} total={pagination.total} onChange={setPage} />
            )}
          </div>
        </div>

        {/* Active call panel */}
        <div className="lg:col-span-1">
          <CallsActivePanel
            key={activeCall?.id}
            call={activeCall}
            onEndCall={() => setActiveCall(null)}
            onStatusChanged={refresh}
          />
        </div>
      </div>
    </div>
  );
}
