"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { offersApi } from "@/lib/api";
import { formatDate } from "@/lib/registry-config";
import { Loader2, MapPin, RefreshCcw } from "lucide-react";

/**
 * The donor's request inbox.
 *
 * A standby offer deliberately shows city and blood group only — no hospital, no desk,
 * no code. That is the §4.3 privacy boundary and it is enforced server-side by
 * buildOfferPayload; this component only renders what it is given.
 */
function OfferCard({ offer, onRespond, busy }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const primary = offer.kind === "primary";

  return (
    <li className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-serif text-xl font-bold text-foreground">
            {offer.bloodGroup} needed
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {primary ? offer.hospitalName : offer.city}
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {primary ? "Primary" : "Standby"}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Needed by</dt>
          <dd className="font-medium text-foreground">{formatDate(offer.neededAt)}</dd>
        </div>
        {primary && (
          <>
            <div>
              <dt className="text-muted-foreground">Window</dt>
              <dd className="font-medium text-foreground">{offer.window}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Desk</dt>
              <dd className="font-medium text-foreground">{offer.deskInfo}</dd>
            </div>
          </>
        )}
      </dl>

      {!primary && (
        <p className="mt-4 text-sm text-muted-foreground">
          You are on standby. If you are needed, the hospital and desk details appear here.
        </p>
      )}

      {offer.expired ? (
        <p className="mt-4 text-sm text-muted-foreground">
          This request has passed its needed-by time.
        </p>
      ) : declining ? (
        <div className="mt-4 space-y-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            maxLength={200}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onRespond(offer.id, "decline", reason)}
            >
              Confirm decline
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeclining(false)}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => onRespond(offer.id, "accept")}>
            {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Yes, I can donate
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setDeclining(true)}>
            Can&apos;t this time
          </Button>
        </div>
      )}
    </li>
  );
}

export default function DonorOffersPage() {
  const [state, setState] = useState({ offers: [], loading: true, error: null });
  const [busyId, setBusyId] = useState(null);
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { body } = await offersApi.mine();
      setState({ offers: body?.offers || [], loading: false, error: null });
    } catch (err) {
      setState({ offers: [], loading: false, error: err.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(id, action, reason) {
    setBusyId(id);
    setResult(null);
    try {
      const { body } = await offersApi.respond(id, action, reason);
      // §3.6: "released" means they said yes but the units were already met. Worth
      // saying plainly — it is not a rejection, and they will be asked again.
      setResult(
        body.result === "accepted"
          ? { tone: "good", text: `Confirmed. Your donation code is ${body.code}.` }
          : body.result === "released"
            ? { tone: "good", text: body.message }
            : { tone: "muted", text: "Thanks for letting us know." },
      );
      await load();
    } catch (err) {
      setResult({ tone: "bad", text: err.message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">My Offers</h1>
          <p className="mt-2 text-muted-foreground">
            Blood requests waiting on your answer.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={state.loading}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          aria-label="Refresh offers"
        >
          <RefreshCcw className={state.loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </button>
      </div>

      {result && (
        <p
          className={
            result.tone === "bad"
              ? "mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
              : "mt-4 rounded-xl bg-muted p-3 text-sm text-foreground"
          }
        >
          {result.text}
        </p>
      )}

      {state.error && <p className="mt-4 text-sm text-destructive">{state.error}</p>}

      {state.loading && state.offers.length === 0 && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading offers…
        </p>
      )}

      {!state.loading && state.offers.length === 0 && !state.error && (
        <p className="mt-6 text-muted-foreground">You have no active offers right now.</p>
      )}

      <ul className="mt-6 space-y-4">
        {state.offers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            onRespond={respond}
            busy={busyId === offer.id}
          />
        ))}
      </ul>
    </div>
  );
}
