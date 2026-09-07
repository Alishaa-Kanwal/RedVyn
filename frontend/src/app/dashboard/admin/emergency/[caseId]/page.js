"use client";

import { useParams } from "next/navigation";
import {
  Loader2,
  RefreshCcw,
  Phone,
  Maximize2,
  Clock,
  MoreHorizontal,
  User,
} from "lucide-react";
import { LiveMapPanel } from "@/components/dashboard/live-map-panel";
import { Button } from "@/components/ui/button";
import { useCaseDetail } from "@/hooks/use-case-detail";
import { cn } from "@/lib/utils";

function caseDisplayId(kase) {
  if (!kase) return "—";
  if (kase.caseId) return kase.caseId;
  return `C-${kase.id.slice(0, 8).toUpperCase()}`;
}

function formatNeededAt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function bloodLabel(group) {
  if (!group) return "—";
  return group.replace("_POS", "+").replace("_NEG", "-");
}

function StatusPill({ state }) {
  const meta = {
    pending: { label: "Searching", variant: "searching" },
    accepted: { label: "Confirmed", variant: "confirmed" },
    code_issued: { label: "Confirmed", variant: "confirmed" },
    completed: { label: "Completed", variant: "confirmed" },
    declined: { label: "Declined", variant: "declined" },
    timed_out: { label: "Timed out", variant: "declined" },
    released: { label: "Released", variant: "neutral" },
    promoted: { label: "Promoted", variant: "neutral" },
    no_show: { label: "No show", variant: "declined" },
  }[state] || { label: state || "Unknown", variant: "neutral" };

  const variantClasses = {
    confirmed:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    searching:
      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    declined: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    neutral:
      "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        variantClasses[meta.variant],
      )}
    >
      {meta.variant === "searching" && (
        <MoreHorizontal className="h-3.5 w-3.5 animate-pulse" />
      )}
      {meta.label}
    </span>
  );
}

function InfoField({ label, children, className }) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-sm font-medium text-primary">{label}</p>
      <div className="text-base font-semibold text-foreground">{children}</div>
    </div>
  );
}

function DonorRow({ offer, index }) {
  const donor = offer?.donor || {};
  const initial = donor.firstName?.charAt(0).toUpperCase() || <User className="h-4 w-4" />;
  const distanceText =
    typeof offer.distance === "number"
      ? `${offer.distance.toFixed(1)} km`
      : "—";

  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        {donor.firstName ? (
          <span className="text-sm font-bold">{initial}</span>
        ) : (
          <User className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {donor.firstName || `Slot ${index + 1}`}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {bloodLabel(donor.bloodGroup)} · {distanceText}
        </p>
      </div>
      <StatusPill state={offer.state} />
    </div>
  );
}

function EmptySlotRow({ index }) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        <MoreHorizontal className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Slot {index + 1}</p>
        <p className="text-xs text-muted-foreground">Searching...</p>
      </div>
      <StatusPill state="pending" />
    </div>
  );
}

function CaseDetailSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-5 w-full animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>

        <div className="lg:col-span-5">
          <div className="h-64 w-full animate-pulse rounded-2xl bg-muted" />
        </div>

        <div className="lg:col-span-4 space-y-3">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-8 w-16 animate-pulse rounded bg-muted" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <div className="h-11 w-36 animate-pulse rounded-full bg-muted" />
        <div className="h-11 w-36 animate-pulse rounded-full bg-muted" />
        <div className="h-11 w-40 animate-pulse rounded-full bg-muted" />
        <div className="h-11 w-36 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}

function CaseDetailError({ error, onRetry }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <p className="text-sm text-muted-foreground">
        {error?.message || "Unable to load case details."}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 border-primary text-primary hover:bg-primary/10"
        onClick={onRetry}
      >
        <RefreshCcw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  );
}

export default function EmergencyCaseDetailPage() {
  const params = useParams();
  const caseId = params?.caseId;
  const {
    data: kase,
    loading,
    error,
    refresh,
    escalateRadius,
    callHospital,
    dispatchAction,
    timeline,
    fetchTimeline,
    closeTimeline,
  } = useCaseDetail(caseId);

  if (loading) return <CaseDetailSkeleton />;
  if (error) return <CaseDetailError error={error} onRetry={refresh} />;
  if (!kase) return <CaseDetailError error={{ message: "Case not found" }} onRetry={refresh} />;

  const hospital = kase.hospital || {};
  const patient = kase.patient || {};
  const offers = kase.offers || [];
  const unitsRequired = kase.unitsRequired || 0;
  const unitsSecured =
    typeof kase.unitsSecured === "number"
      ? kase.unitsSecured
      : offers.filter((o) => ["accepted", "code_issued", "completed"].includes(o.state)).length;

  const donorDots = offers.map((o) => ({
    id: o.donor?.id || o.id,
    lat: o.donor?.lat ?? 0,
    lon: o.donor?.lon ?? 0,
    distance: o.distance,
  }));

  const radiusMeters =
    kase.radiusMeters && kase.radiusMeters > 0
      ? kase.radiusMeters
      : null;

  const activeCase = hospital.id
    ? { hospitalId: hospital.id, radiusMeters }
    : null;

  const fillerCount = Math.max(unitsRequired - offers.length, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Emergency Case</h1>
        <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-mono text-muted-foreground">
          {caseDisplayId(kase)}
        </span>
        <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          High Priority
        </span>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left info column */}
        <div className="space-y-4 lg:col-span-3">
          <InfoField label="Hospital">{hospital.name || "—"}</InfoField>
          <InfoField label="Contact">
            {hospital.phone || hospital.deskInfo || "—"}
          </InfoField>
          <InfoField label="Patient">
            <p>{patient.firstName || "—"}</p>
            {(patient.age || patient.gender) && (
              <p className="text-sm font-normal text-muted-foreground">
                {patient.age ? `Age: ${patient.age}` : null}
                {patient.age && patient.gender ? " | " : null}
                {patient.gender || null}
              </p>
            )}
          </InfoField>

          <div className="grid grid-cols-2 gap-4">
            <InfoField label="Blood Group">
              <p className="text-2xl font-bold">{bloodLabel(kase.bloodGroup || patient.bloodGroup)}</p>
            </InfoField>
            <InfoField label="Units Required">
              <p className="text-2xl font-bold">{unitsRequired || "—"}</p>
            </InfoField>
          </div>

          <InfoField label="Needed By">{formatNeededAt(kase.neededAt)}</InfoField>
        </div>

        {/* Center radar */}
        <div className="lg:col-span-5">
          <LiveMapPanel
            mode="radar"
            hospitals={hospital.id ? [hospital] : []}
            donors={donorDots}
            activeCase={activeCase}
            loading={false}
          />
        </div>

        {/* Right donor list */}
        <div className="lg:col-span-4">
          <div className="mb-4">
            <p className="text-sm font-medium text-muted-foreground">Units Secured</p>
            <p className="text-4xl font-bold text-primary">
              {unitsSecured} <span className="text-foreground">/ {unitsRequired || "—"}</span>
            </p>
          </div>

          <div className="divide-y divide-border rounded-2xl border border-border bg-background/50 p-1">
            {offers.map((offer, i) => (
              <DonorRow key={offer.id || i} offer={offer} index={i} />
            ))}
            {[...Array(fillerCount)].map((_, i) => (
              <EmptySlotRow key={`empty-${i}`} index={offers.length + i} />
            ))}
            {offers.length === 0 && fillerCount === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No donor slots assigned yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom action row */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          className="border-primary text-primary hover:bg-primary/10"
          onClick={escalateRadius}
        >
          <Maximize2 className="mr-2 h-4 w-4" />
          Escalate Radius
        </Button>

        <Button
          variant="outline"
          className="border-primary text-primary hover:bg-primary/10"
          onClick={callHospital}
        >
          <Phone className="mr-2 h-4 w-4" />
          Call Hospital
        </Button>

        <select
          aria-label="Case action"
          className="h-11 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          defaultValue=""
          onChange={(e) => {
            const action = e.target.value;
            if (action) dispatchAction(action);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Action
          </option>
          <option value="mark_in_progress">Mark in progress</option>
          <option value="mark_filled">Mark filled</option>
          <option value="close_case">Close case</option>
        </select>

        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={fetchTimeline}
        >
          <Clock className="mr-2 h-4 w-4" />
          View Timeline
        </Button>
      </div>

      {timeline.open && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Case Timeline</h2>
            <button
              type="button"
              onClick={closeTimeline}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          {timeline.loading && <p className="text-sm text-muted-foreground">Loading timeline...</p>}
          {timeline.error && (
            <p className="text-sm text-red-600">{timeline.error.message || "Unable to load timeline."}</p>
          )}
          {!timeline.loading && !timeline.error && timeline.data.length === 0 && (
            <p className="text-sm text-muted-foreground">No timeline events yet.</p>
          )}
          <ul className="space-y-3">
            {timeline.data.map((event) => (
              <li key={event.id} className="text-sm">
                <p className="font-medium text-foreground">{event.type}</p>
                <p className="text-xs text-muted-foreground">
                  {event.at ? new Date(event.at).toLocaleString() : "—"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
