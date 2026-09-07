"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

function bloodLabel(group) {
  if (!group) return "—";
  return group.replace("_POS", "+").replace("_NEG", "-");
}

/**
 * Great-circle distance in kilometres. Mirrors the backend haversine so the
 * detail page can show donor distances even when the API does not include them.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Display metadata for every backend OfferState value.
 * No new states are invented — these are UI labels and colours only.
 */
export const OFFER_STATUS_META = {
  pending: { label: "Searching", variant: "searching" },
  accepted: { label: "Confirmed", variant: "confirmed" },
  code_issued: { label: "Confirmed", variant: "confirmed" },
  completed: { label: "Completed", variant: "confirmed" },
  declined: { label: "Declined", variant: "declined" },
  timed_out: { label: "Timed out", variant: "declined" },
  released: { label: "Released", variant: "neutral" },
  promoted: { label: "Promoted", variant: "neutral" },
  no_show: { label: "No show", variant: "declined" },
};

/**
 * Normalise the live tracker response into a stable shape expected by the
 * Emergency Case Detail page. GET /api/emergency/cases/:id/live returns a case
 * object containing patient, hospital, offers (with donor) and distance.
 */
function normalizeCase(body) {
  const raw = body?.case ?? body;
  if (!raw) return null;

  const hospital = raw.hospital || null;
  const offers = (raw.offers || []).map((offer) => {
    const donor = offer.donor || {};
    let distance = offer.distance;

    if (typeof distance !== "number" && hospital?.lat != null && donor?.lat != null) {
      distance = haversineKm(hospital.lat, hospital.lon, donor.lat, donor.lon);
    }

    return {
      ...offer,
      donor,
      distance: typeof distance === "number" ? distance : null,
    };
  });

  return {
    ...raw,
    hospital,
    offers,
  };
}

export function useCaseDetail(caseId) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });
  const [timeline, setTimeline] = useState({
    data: [],
    loading: false,
    error: null,
    open: false,
  });

  const fetchData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { body } = await apiFetch(`/api/emergency/cases/${caseId}/live`);
      setState({ data: normalizeCase(body), loading: false, error: null });
    } catch (err) {
      setState({ data: null, loading: false, error: err });
    }
  }, [caseId]);

  useEffect(() => {
    if (!caseId) return;

    let cancelled = false;

    async function run() {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { body } = await apiFetch(`/api/emergency/cases/${caseId}/live`);
        if (!cancelled) setState({ data: normalizeCase(body), loading: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ data: null, loading: false, error: err });
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const refresh = fetchData;

  const fetchTimeline = useCallback(async () => {
    if (!caseId) return;
    setTimeline((s) => ({ ...s, loading: true, error: null, open: true }));
    try {
      const { body } = await apiFetch(`/api/cases/${caseId}/timeline`);
      setTimeline({ data: body?.timeline || [], loading: false, error: null, open: true });
    } catch (err) {
      setTimeline({ data: [], loading: false, error: err, open: true });
    }
  }, [caseId]);

  const closeTimeline = useCallback(() => {
    setTimeline((s) => ({ ...s, open: false }));
  }, []);

  /**
   * Phase 11 action: radius expansion is handled automatically by the backend
   * sweeper. Refreshing the case shows the result of any expansion/fallback.
   */
  const escalateRadius = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  /**
   * Phase 11 action: blood-bank fallback notification is handled automatically
   * by the backend sweeper. This action refreshes the current case state.
   */
  const callHospital = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  /**
   * Generic action dispatcher for the bottom-row dropdown.
   * Manual case transitions are not exposed by the currently shipped backend
   * phases; this remains a client-side placeholder.
   */
  const dispatchAction = useCallback(
    async (action) => {
      console.log("Action dispatched for case", caseId, action);
    },
    [caseId],
  );

  const value = useMemo(
    () => ({
      ...state,
      refresh,
      escalateRadius,
      callHospital,
      dispatchAction,
      bloodLabel,
      OFFER_STATUS_META,
      timeline,
      fetchTimeline,
      closeTimeline,
    }),
    [state, refresh, escalateRadius, callHospital, dispatchAction, timeline, fetchTimeline, closeTimeline],
  );

  return value;
}
