"use client";

import { useCallback, useState } from "react";
import { RegistryPage } from "@/components/dashboard/registry-page";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import {
  CASE_STATUSES,
  CASE_TYPES,
  bloodLabel,
  formatDate,
} from "@/lib/registry-config";
import { apiFetch, casesApi } from "@/lib/api";
import { CaseCreateForm } from "./case-create-form";
import { Loader2, RefreshCcw } from "lucide-react";

/**
 * Closing the case. Only the requester side gets this — a donor confirming their own
 * donation would farm reliability score, and the backend bars them regardless.
 */
function ConfirmDonationPanel({ kase }) {
  const [code, setCode] = useState("");
  const [state, setState] = useState({ busy: false, error: null, done: false });

  if (kase.state === "closed" || state.done) {
    return <p className="text-sm text-muted-foreground">This case is closed.</p>;
  }

  async function submit() {
    setState({ busy: true, error: null, done: false });
    try {
      await casesApi.confirm(kase.id, code);
      setState({ busy: false, error: null, done: true });
    } catch (err) {
      setState({ busy: false, error: err.message, done: false });
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Enter the code the donor was given at the desk.
      </p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="B+1234"
          maxLength={12}
          className="w-32 rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <Button size="sm" disabled={state.busy || code.length < 3} onClick={submit}>
          {state.busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Confirm
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  );
}

function caseDisplayId(kase) {
  if (!kase?.id) return "—";
  return `C-${kase.id.slice(0, 8).toUpperCase()}`;
}

function TimelinePanel({ caseId }) {
  const [state, setState] = useState({
    data: [],
    loading: false,
    error: null,
    open: false,
  });

  const fetchTimeline = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null, open: true }));
    try {
      const { body } = await apiFetch(`/api/cases/${caseId}/timeline`);
      setState({ data: body?.timeline || [], loading: false, error: null, open: true });
    } catch (err) {
      setState({ data: [], loading: false, error: err, open: true });
    }
  }, [caseId]);

  if (!state.open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="border-primary text-primary hover:bg-primary/10"
        onClick={fetchTimeline}
      >
        View Timeline
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Case Timeline</p>
        <button
          type="button"
          onClick={fetchTimeline}
          disabled={state.loading}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          aria-label="Refresh timeline"
        >
          <RefreshCcw className={state.loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        </button>
      </div>

      {state.loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading timeline…
        </div>
      )}

      {state.error && (
        <p className="text-sm text-destructive">
          {state.error.message || "Could not load timeline."}
        </p>
      )}

      {!state.loading && state.data.length === 0 && !state.error && (
        <p className="text-sm text-muted-foreground">No timeline events yet.</p>
      )}

      {!state.loading && state.data.length > 0 && (
        <ul className="space-y-2">
          {state.data.map((event) => (
            <li
              key={event.id}
              className="rounded-xl border border-border bg-muted/30 p-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground">{event.type}</span>
                <span className="text-muted-foreground">
                  {formatDate(event.at)}
                </span>
              </div>
              {event.donor && (
                <p className="mt-1 text-muted-foreground">
                  Donor: {event.donor.firstName} ({bloodLabel(event.donor.bloodGroup)})
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One case registry, three roles. Admin gets a read-only view of every case; a hospital
 * and a guardian each get their own cases plus the button to raise one — the list itself
 * is scoped server-side by /api/cases, so nothing here has to filter.
 */
function buildConfig(canRaise) {
  return {
    title: "Cases",
    entityName: "Case",
    basePath: "/api/cases",
    detailKey: "case",
    initialFilters: {},
    filters: [
      { key: "q", type: "search", placeholder: "Search cases…" },
      { key: "state", type: "select", label: "Status", options: CASE_STATUSES },
      { key: "type", type: "select", label: "Type", options: CASE_TYPES },
      { key: "from", type: "text", placeholder: "Created from (YYYY-MM-DD)" },
      { key: "to", type: "text", placeholder: "Created to (YYYY-MM-DD)" },
    ],
    columns: [
      {
        key: "displayId",
        header: "Case ID",
        render: (item) => caseDisplayId(item),
      },
      {
        key: "patient",
        header: "Patient",
        render: (item) => item.patient?.firstName ?? "—",
      },
      {
        key: "hospital",
        header: "Hospital",
        render: (item) => item.hospital?.name ?? "—",
      },
      {
        key: "bloodGroup",
        header: "Blood Group",
        render: (item) => bloodLabel(item.bloodGroup),
      },
      {
        key: "type",
        header: "Type",
        render: (item) =>
          CASE_TYPES.find((t) => t.value === item.type)?.label ?? item.type ?? "—",
      },
      {
        key: "units",
        header: "Units",
        render: (item) => `${item.unitsSecured ?? 0}/${item.unitsRequired ?? 0}`,
      },
      {
        key: "state",
        header: "Status",
        render: (item) => <StatusPill status={item.state} />,
      },
      {
        key: "neededAt",
        header: "Needed By",
        render: (item) => formatDate(item.neededAt),
      },
    ],
    detailTitle: (item) => item.patient?.firstName || caseDisplayId(item),
    detailFields: [
      { label: "Case ID", key: "id", format: (v) => (v ? `C-${v.slice(0, 8).toUpperCase()}` : "—") },
      { label: "Patient", render: (item) => item.patient?.firstName ?? "—" },
      { label: "Hospital", render: (item) => item.hospital?.name ?? "—" },
      { label: "Blood Group", key: "bloodGroup", format: bloodLabel },
      {
        label: "Type",
        render: (item) =>
          CASE_TYPES.find((t) => t.value === item.type)?.label ?? item.type ?? "—",
      },
      {
        label: "Units",
        render: (item) => `${item.unitsSecured ?? 0}/${item.unitsRequired ?? 0}`,
      },
      { label: "Status", render: (item) => <StatusPill status={item.state} /> },
      { label: "Window", key: "window" },
      { label: "Needed By", key: "neededAt", format: formatDate },
      { label: "Created", key: "createdAt", format: formatDate },
      {
        label: "Timeline",
        render: (item) => <TimelinePanel caseId={item.id} />,
      },
      ...(canRaise
        ? [{ label: "Confirm Donation", render: (item) => <ConfirmDonationPanel kase={item} /> }]
        : []),
    ],
    canCreate: () => canRaise,
    CreateForm: canRaise ? CaseCreateForm : undefined,
  };
}

const readOnlyConfig = buildConfig(false);
const raiseConfig = buildConfig(true);

export function CasesRegistry({ canRaise = false }) {
  return <RegistryPage config={canRaise ? raiseConfig : readOnlyConfig} />;
}
