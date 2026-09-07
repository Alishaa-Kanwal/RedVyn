"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { caseCreateSchema, CASE_TYPES, bloodLabel } from "@/lib/registry-config";
import { FormInput, FormSelect, FormError } from "./form-fields";
import { Button } from "@/components/ui/button";
import { casesApi } from "@/lib/api";
import { Loader2, Users } from "lucide-react";

/**
 * Raise a case, for a hospital or a guardian. The patient list comes from
 * /api/patients/me, which is already scoped to the caller, so this form can only ever
 * offer patients they are allowed to raise a case for.
 *
 * The preview is the ops console's old dry-run: see who would be paged before anyone is.
 */
export function CaseCreateForm({ onSubmit, onCancel }) {
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState(null);
  const [preview, setPreview] = useState({ data: null, loading: false, error: null });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(caseCreateSchema),
    defaultValues: { type: "scheduled", unitsRequired: 1, radiusMeters: 5000 },
  });

  const patientId = watch("patientId");
  const radiusMeters = watch("radiusMeters");

  useEffect(() => {
    let cancelled = false;
    casesApi
      .myPatients()
      .then(({ body }) => {
        if (!cancelled) setPatients(body?.patients || []);
      })
      .catch((err) => {
        // Swallowing this rendered as "no patients registered to you", which is a very
        // different problem from "the request failed". Say which one it is.
        if (!cancelled) {
          setPatients([]);
          setPatientsError(err.message || "Could not load your patients");
        }
      })
      .finally(() => {
        if (!cancelled) setPatientsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runPreview() {
    if (!patientId) return;
    setPreview({ data: null, loading: true, error: null });
    try {
      const { body } = await casesApi.matchPreview({ patientId, radiusMeters });
      setPreview({ data: body, loading: false, error: null });
    } catch (err) {
      setPreview({ data: null, loading: false, error: err.message });
    }
  }

  async function submit(data) {
    try {
      await onSubmit({
        ...data,
        // The input is local time; the API takes an instant.
        neededAt: new Date(data.neededAt).toISOString(),
      });
    } catch (err) {
      setError("root", { message: err.message || "Could not raise this case" });
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <FormError error={errors.root?.message} />

      <FormSelect
        id="patientId"
        label="Patient"
        required
        error={errors.patientId?.message}
        options={[
          { value: "", label: patientsLoading ? "Loading patients…" : "Select patient" },
          ...patients.map((p) => ({
            value: p.id,
            label: `${p.firstName} (${bloodLabel(p.bloodGroup)})`,
          })),
        ]}
        {...register("patientId")}
      />

      {patientsError && <p className="text-sm text-destructive">{patientsError}</p>}

      {!patientsLoading && !patientsError && patients.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No patients are registered to you yet, so there is nobody to raise a case for.
        </p>
      )}

      <FormSelect
        id="type"
        label="Type"
        required
        error={errors.type?.message}
        options={CASE_TYPES}
        {...register("type")}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormInput
          id="unitsRequired"
          label="Units Required"
          type="number"
          min="1"
          max="10"
          required
          error={errors.unitsRequired?.message}
          {...register("unitsRequired")}
        />
        <FormInput
          id="radiusMeters"
          label="Search Radius (m)"
          type="number"
          min="1000"
          max="50000"
          step="1000"
          required
          error={errors.radiusMeters?.message}
          {...register("radiusMeters")}
        />
      </div>

      <FormInput
        id="neededAt"
        label="Needed By"
        type="datetime-local"
        required
        error={errors.neededAt?.message}
        {...register("neededAt")}
      />

      <FormInput
        id="window"
        label="Window"
        placeholder="10:00-13:00"
        required
        error={errors.window?.message}
        {...register("window")}
      />

      {/* Dry run. Nothing is created and no donor is contacted until Raise Case. */}
      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Who would be contacted
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!patientId || preview.loading}
            onClick={runPreview}
          >
            {preview.loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Preview
          </Button>
        </div>

        {preview.error && <p className="mt-2 text-sm text-destructive">{preview.error}</p>}

        {preview.data && preview.data.matches.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            No eligible donor within {preview.data.radiusMeters}m. Widen the radius.
          </p>
        )}

        {preview.data && preview.data.matches.length > 0 && (
          <ul className="mt-2 space-y-1">
            {preview.data.matches.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-xs">
                <span className="text-foreground">
                  {m.firstName} · {bloodLabel(m.bloodGroup)}
                </span>
                <span className="text-muted-foreground">
                  {m.distance} km · score {m.reliabilityScore}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || patients.length === 0}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Raise Case
        </Button>
      </div>
    </form>
  );
}
