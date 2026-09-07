"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useApi } from "@/hooks/use-api";

/**
 * Loads the data a guardian dashboard needs from real backend endpoints.
 *
 * - /api/auth/me provides the guardian profile and linked patient IDs.
 * - GET /api/patients/:id returns the linked patient (Phase 6).
 * - GET /api/cases returns cases scoped to the guardian's patients (Phase 7).
 *
 * The hook selects one patient (first by default, or ?patient= if provided and
 * linked). All derived lists are computed from the real case payload.
 */
export function useGuardianData() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();

  const patientIds = user?.patientIds || [];
  const requested = searchParams.get("patient");
  const selectedPatientId = requested && patientIds.includes(requested) ? requested : patientIds[0] || null;

  const patientPath = selectedPatientId ? `/api/patients/${selectedPatientId}` : null;
  const {
    data: patientRes,
    loading: patientLoading,
    error: patientError,
  } = useApi(patientPath);

  const { data: casesRes, loading: casesLoading, error: casesError } = useApi("/api/cases?pageSize=100");

  const patient = patientRes?.patient ?? null;

  const patientCases = useMemo(
    () => (casesRes?.data ?? []).filter((kase) => kase.patientId === selectedPatientId),
    [casesRes, selectedPatientId]
  );

  const now = useMemo(() => new Date(), []);

  const upcomingCases = useMemo(
    () =>
      patientCases
        .filter((kase) => new Date(kase.neededAt) >= now)
        .sort((a, b) => new Date(a.neededAt).getTime() - new Date(b.neededAt).getTime()),
    [patientCases, now]
  );

  const historyCases = useMemo(
    () =>
      patientCases
        .filter((kase) => new Date(kase.neededAt) < now)
        .sort((a, b) => new Date(b.neededAt).getTime() - new Date(a.neededAt).getTime()),
    [patientCases, now]
  );

  return {
    user,
    authLoading,
    selectedPatientId,
    patientIds,
    patient,
    cases: patientCases,
    upcomingCases,
    historyCases,
    loading: authLoading || patientLoading || casesLoading,
    error: patientError || casesError || null,
  };
}
