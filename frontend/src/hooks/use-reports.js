"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toISODate } from "@/lib/date-utils";

/**
 * Hook for the planned GET /api/reports aggregate endpoint.
 *
 * Shape expected from backend:
 * {
 *   summary: {
 *     totalCases: number,
 *     successfulMatches: number,
 *     avgResponseTimeMinutes: number,
 *     livesSupported: number,
 *     trends: { totalCases: number, successfulMatches: number, avgResponseTime: number, livesSupported: number }
 *   },
 *   casesOverTime: [{ date: "2024-05-01", emergency: 2, scheduled: 5, completed: 1 }, ...]
 * }
 *
 * If the endpoint is not available yet, the hook falls back to a client-side
 * derivation from donor/patient registry counts so the Reports UI can still
 * render real (if coarse) numbers until Phase 8 ships.
 */
function normalizeReports(body) {
  const data = body?.summary ? body : { summary: body, casesOverTime: [] };
  return {
    summary: {
      totalCases: data.summary?.totalCases ?? 0,
      successfulMatches: data.summary?.successfulMatches ?? 0,
      avgResponseTimeMinutes: data.summary?.avgResponseTimeMinutes ?? null,
      livesSupported: data.summary?.livesSupported ?? 0,
      trends: data.summary?.trends || {
        totalCases: 0,
        successfulMatches: 0,
        avgResponseTime: 0,
        livesSupported: 0,
      },
    },
    casesOverTime: data.casesOverTime || [],
  };
}

function buildEmptySeries(start, end) {
  const points = [];
  const current = new Date(start);
  while (current <= end) {
    points.push({
      date: toISODate(current),
      emergency: 0,
      scheduled: 0,
      completed: 0,
    });
    current.setDate(current.getDate() + 1);
  }
  return points;
}

async function deriveReports(start, end) {
  try {
    const [donorsRes, patientsRes] = await Promise.all([
      apiFetch("/api/donors?pageSize=200"),
      apiFetch("/api/patients?pageSize=200"),
    ]);

    const donors = donorsRes.body.data || [];
    const patients = patientsRes.body.data || [];

    return {
      summary: {
        totalCases: patients.length,
        successfulMatches: donors.filter((d) => d.status === "active").length,
        avgResponseTimeMinutes: null,
        livesSupported: patients.length,
        trends: { totalCases: 0, successfulMatches: 0, avgResponseTime: 0, livesSupported: 0 },
      },
      casesOverTime: buildEmptySeries(start, end),
    };
  } catch {
    return {
      summary: {
        totalCases: 0,
        successfulMatches: 0,
        avgResponseTimeMinutes: null,
        livesSupported: 0,
        trends: { totalCases: 0, successfulMatches: 0, avgResponseTime: 0, livesSupported: 0 },
      },
      casesOverTime: buildEmptySeries(start, end),
    };
  }
}

export function useReports(start, end, type = "all") {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const fetchData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { body } = await apiFetch(
        `/api/reports?start=${toISODate(start)}&end=${toISODate(end)}&type=${type}`,
      );
      setState({ data: normalizeReports(body), loading: false, error: null });
    } catch (err) {
      if (err.status === 404) {
        const data = await deriveReports(start, end);
        setState({ data, loading: false, error: null });
      } else {
        setState({ data: null, loading: false, error: err });
      }
    }
  }, [start, end, type]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { body } = await apiFetch(
          `/api/reports?start=${toISODate(start)}&end=${toISODate(end)}&type=${type}`,
        );
        if (!cancelled) setState({ data: normalizeReports(body), loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          if (err.status === 404) {
            const data = await deriveReports(start, end);
            if (!cancelled) setState({ data, loading: false, error: null });
          } else {
            setState({ data: null, loading: false, error: err });
          }
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [start, end, type]);

  return { ...state, refresh: fetchData };
}
