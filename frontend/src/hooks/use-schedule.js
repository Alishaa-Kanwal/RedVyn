"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { isWithinInterval, toISODate } from "@/lib/date-utils";

/**
 * Planned schedule event shape. A dedicated GET /api/schedule endpoint would
 * return these directly; until it ships we fall back to deriving plausible
 * calendar events from donor nextEligibleAt and patient predictedNextAt dates.
 */
function normalizeEvents(body) {
  const raw = Array.isArray(body) ? body : body?.events || [];
  return raw.map((e) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    startAt: e.startAt,
    endAt: e.endAt,
    durationMinutes: e.durationMinutes || 30,
    relatedId: e.relatedId,
    relatedType: e.relatedType,
  }));
}

function hashTimeFromId(id) {
  if (!id) return { hours: 9, minutes: 0 };
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hours = 8 + (Math.abs(hash) % 10);
  const minutes = (Math.abs(hash >> 8) % 4) * 15;
  return { hours, minutes };
}

function setTimeFromId(date, id) {
  const { hours, minutes } = hashTimeFromId(id);
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

async function deriveEvents(start, end) {
  try {
    const [donorsRes, patientsRes] = await Promise.all([
      apiFetch("/api/donors?pageSize=200"),
      apiFetch("/api/patients?pageSize=200"),
    ]);

    const donors = donorsRes.body.data || [];
    const patients = patientsRes.body.data || [];
    const events = [];

    donors.forEach((donor) => {
      if (!donor.nextEligibleAt) return;
      const date = new Date(donor.nextEligibleAt);
      if (!isWithinInterval(date, start, end)) return;
      events.push({
        id: `donor-${donor.id}`,
        title: `Donor Call - ${donor.firstName}`,
        type: "donor_call",
        startAt: setTimeFromId(donor.nextEligibleAt, donor.id),
        endAt: null,
        durationMinutes: 30,
        relatedId: donor.id,
        relatedType: "donor",
      });
    });

    patients.forEach((patient) => {
      if (!patient.predictedNextAt) return;
      const date = new Date(patient.predictedNextAt);
      if (!isWithinInterval(date, start, end)) return;
      events.push({
        id: `patient-${patient.id}`,
        title: `Hospital Collection - ${patient.firstName}`,
        type: "hospital_collection",
        startAt: setTimeFromId(patient.predictedNextAt, patient.id),
        endAt: null,
        durationMinutes: 60,
        relatedId: patient.id,
        relatedType: "patient",
      });
    });

    return events;
  } catch {
    return [];
  }
}

export function useSchedule(start, end, view) {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  const fetchData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { body } = await apiFetch(
        `/api/schedule?start=${toISODate(start)}&end=${toISODate(end)}&view=${view}`,
      );
      setState({ data: normalizeEvents(body), loading: false, error: null });
    } catch (err) {
      if (err.status === 404) {
        // Fallback: no dedicated schedule endpoint yet; derive from registry data.
        const events = await deriveEvents(start, end);
        setState({ data: events, loading: false, error: null });
      } else {
        setState({ data: [], loading: false, error: err });
      }
    }
  }, [start, end, view]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { body } = await apiFetch(
          `/api/schedule?start=${toISODate(start)}&end=${toISODate(end)}&view=${view}`,
        );
        if (!cancelled) setState({ data: normalizeEvents(body), loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          if (err.status === 404) {
            const events = await deriveEvents(start, end);
            if (!cancelled) setState({ data: events, loading: false, error: null });
          } else {
            setState({ data: [], loading: false, error: err });
          }
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [start, end, view]);

  return { ...state, refresh: fetchData };
}
