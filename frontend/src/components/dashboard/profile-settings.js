"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { FormInput, FormSelect, FormError } from "./form-fields";
import { LANGUAGES, bloodLabel, formatDate } from "@/lib/registry-config";
import { profileApi } from "@/lib/api";

/**
 * The account's own settings, one component for every role.
 *
 * These lists mirror the per-role schemas on PATCH /api/auth/profile. They are a UI
 * convenience, not the gate: the server ignores anything outside its own list, so
 * reliability score, verification and hospital assignment stay server-owned whatever
 * a hand-rolled request sends.
 */
const EDITABLE = {
  donor: [
    { key: "firstName", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "city", label: "City" },
    { key: "lat", label: "Latitude", type: "number", step: "any", half: true },
    { key: "lon", label: "Longitude", type: "number", step: "any", half: true },
    { key: "language", label: "Language", options: LANGUAGES },
    {
      key: "status",
      label: "Availability",
      // §3.1 consent is revocable — this is the dashboard's "reply STOP".
      options: [
        { value: "active", label: "Active — send me requests" },
        { value: "paused", label: "Paused — do not send me requests" },
      ],
    },
  ],
  guardian: [{ key: "name", label: "Name" }],
  hospital: [
    { key: "name", label: "Hospital Name" },
    { key: "city", label: "City" },
    { key: "deskInfo", label: "Blood Bank Desk", placeholder: "Where donors should report" },
    { key: "lat", label: "Latitude", type: "number", step: "any", half: true },
    { key: "lon", label: "Longitude", type: "number", step: "any", half: true },
  ],
  admin: [{ key: "name", label: "Name" }],
};

const READ_ONLY = {
  donor: [
    { key: "email", label: "Email" },
    { key: "bloodGroup", label: "Blood Group", format: bloodLabel },
    { key: "reliabilityScore", label: "Reliability Score" },
    { key: "nextEligibleAt", label: "Next Eligible", format: formatDate },
  ],
  guardian: [{ key: "email", label: "Email" }],
  hospital: [
    { key: "email", label: "Email" },
    { key: "verified", label: "Verified", format: (v) => (v ? "Yes" : "Pending review") },
  ],
  admin: [{ key: "email", label: "Email" }],
};

export function ProfileSettings() {
  const { user } = useAuth();
  const role = user?.role;
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [state, setState] = useState({ loading: true, saving: false, error: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    profileApi
      .get()
      .then(({ body }) => {
        if (cancelled) return;
        setProfile(body.profile);
        setForm(body.profile);
        setState((s) => ({ ...s, loading: false }));
      })
      .catch((err) => {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: err.message }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <FormError error={state.error || "Could not load your profile."} />
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          <RefreshCcw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  const fields = EDITABLE[role] ?? [];
  const facts = READ_ONLY[role] ?? [];

  // Only changed fields are sent. That keeps an untouched select from re-submitting a
  // value the server will not accept back (a donor who opted out, say), and means a
  // failed save never blanks a column the user never looked at.
  const changed = Object.fromEntries(
    fields
      .filter(({ key }) => String(form[key] ?? "") !== String(profile[key] ?? ""))
      .map(({ key }) => [key, form[key]]),
  );
  const dirty = Object.keys(changed).length > 0;

  async function save(event) {
    event.preventDefault();
    if (!dirty) return;
    setState((s) => ({ ...s, saving: true, error: null }));
    try {
      const { body } = await profileApi.update(changed);
      setProfile(body.profile);
      setForm(body.profile);
      toast.success("Profile updated");
    } catch (err) {
      setState((s) => ({ ...s, error: err.message || "Could not save your changes" }));
    } finally {
      setState((s) => ({ ...s, saving: false }));
    }
  }

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Your details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep this current — it is what we use to reach you and to work out who is nearby.
        </p>

        <div className="mt-4">
          <FormError error={state.error} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          {fields.map((field) =>
            field.options ? (
              <FormSelect
                key={field.key}
                id={field.key}
                label={field.label}
                className={field.half ? "" : "col-span-2"}
                options={field.options}
                value={form[field.key] ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
              />
            ) : (
              <FormInput
                key={field.key}
                id={field.key}
                label={field.label}
                type={field.type || "text"}
                step={field.step}
                placeholder={field.placeholder}
                className={field.half ? "" : "col-span-2"}
                value={form[field.key] ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
              />
            ),
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set by the operations team. Contact them if any of this is wrong.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-4">
          {facts.map((fact) => (
            <div key={fact.key}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {fact.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {(fact.format ? fact.format(profile[fact.key]) : profile[fact.key]) ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || state.saving}
          onClick={() => setForm(profile)}
        >
          Discard
        </Button>
        <Button type="submit" disabled={!dirty || state.saving}>
          {state.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
