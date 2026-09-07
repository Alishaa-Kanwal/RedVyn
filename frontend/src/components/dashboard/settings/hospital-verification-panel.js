"use client";

import { useCallback } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { formatDate } from "@/lib/registry-config";
import { Button } from "@/components/ui/button";

function InlineError({ error, onRetry }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <p className="text-sm text-muted-foreground">{error?.message || "Could not load hospitals."}</p>
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

export function HospitalVerificationPanel() {
  const { data, loading, error, refresh } = useApi("/api/hospitals?pageSize=100");
  const hospitals = data?.data || [];

  const verify = useCallback(
    async (id, verified) => {
      try {
        await apiFetch(`/api/hospitals/${id}/verify`, {
          method: "PATCH",
          body: JSON.stringify({ verified }),
        });
        toast.success(verified ? "Hospital verified." : "Hospital unverified.");
        refresh();
      } catch (err) {
        toast.error(err.message || "Could not update verification.");
      }
    },
    [refresh]
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-foreground">Hospital Verification</h2>
        <p className="text-sm text-muted-foreground">
          Approve or reject hospital records.
        </p>
      </div>

      {error && <InlineError error={error} onRetry={refresh} />}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">City</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Created</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    <p className="mt-2 text-sm">Loading hospitals…</p>
                  </td>
                </tr>
              ) : hospitals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No hospitals found.
                  </td>
                </tr>
              ) : (
                hospitals.map((hospital) => (
                  <tr key={hospital.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-foreground">{hospital.name}</td>
                    <td className="px-4 py-3 text-foreground">{hospital.city}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          hospital.verified
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {hospital.verified ? "Verified" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {hospital.createdAt ? formatDate(hospital.createdAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {hospital.verified ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => verify(hospital.id, false)}
                        >
                          Reject
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                          onClick={() => verify(hospital.id, true)}
                        >
                          Verify
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
