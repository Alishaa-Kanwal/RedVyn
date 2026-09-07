"use client";

import { useMemo, useState } from "react";
import { Loader2, RefreshCcw, Search } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { Pagination } from "@/components/dashboard/pagination";
import { formatDate } from "@/lib/registry-config";
import { cn } from "@/lib/utils";

function buildQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  return query.toString();
}

function InlineError({ error, onRetry }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <p className="text-sm text-muted-foreground">
        {error?.message || "Could not load audit logs."}
      </p>
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

export function AuditLogsPanel() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(5);
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [caseId, setCaseId] = useState("");
  const [donorId, setDonorId] = useState("");
  const [userId, setUserId] = useState("");

  const query = useMemo(
    () =>
      buildQuery({
        page,
        pageSize,
        type,
        from,
        to,
        caseId,
        donorId,
        userId,
      }),
    [page, pageSize, type, from, to, caseId, donorId, userId],
  );

  const { data, loading, error, refresh } = useApi(`/api/audit-log?${query}`);

  const events = data?.data || [];
  const pagination = data?.pagination || { page: 1, pageSize: 20, total: 0 };

  function clearFilters() {
    setType("");
    setFrom("");
    setTo("");
    setCaseId("");
    setDonorId("");
    setUserId("");
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-foreground">Audit Logs</h2>
        <p className="text-sm text-muted-foreground">
          Append-only event stream from the backend Event table.
        </p>
      </div>

      {error && <InlineError error={error} onRetry={refresh} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-center rounded-full border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by event type…"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="ml-2 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-full border border-border bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-full border border-border bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="text"
          placeholder="Case ID"
          value={caseId}
          onChange={(e) => {
            setCaseId(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-full border border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="text"
          placeholder="Donor ID"
          value={donorId}
          onChange={(e) => {
            setDonorId(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-full border border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="text"
          placeholder="User ID"
          value={userId}
          onChange={(e) => {
            setUserId(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-full border border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={clearFilters}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Clear filters
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">At</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Case</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Donor</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">User</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    <p className="mt-2 text-sm">Loading audit logs…</p>
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No audit events match the current filters.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{event.type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(event.at)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {event.caseId ? event.caseId.slice(0, 8) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {event.donorId ? event.donorId.slice(0, 8) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {event.userId ? event.userId.slice(0, 8) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <pre
                        className={cn(
                          "max-w-xs overflow-x-auto rounded-lg bg-muted p-2 text-xs text-muted-foreground",
                        )}
                      >
                        {JSON.stringify(event.payload ?? {}, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && events.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={pagination.total}
            onChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
