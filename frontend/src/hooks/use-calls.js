"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

/**
 * Hook for the planned GET /api/calls paginated endpoint.
 *
 * Planned shape:
 * {
 *   data: [
 *     {
 *       id, contactName, contactType ("donor" | "hospital" | "guardian"),
 *       contactId, phone, outcome, startedAt, durationSeconds, status
 *     }
 *   ],
 *   pagination: { page, pageSize, total }
 * }
 *
 * Until Phase 13/14 ships a real call-log endpoint, we fall back to deriving
 * plausible call records from the donor registry so the Calls page can still be
 * exercised end-to-end.
 */
function normalizeCalls(body) {
  const raw = Array.isArray(body) ? body : body?.data || [];
  return raw.map((c) => ({
    id: c.id,
    contactName: c.contactName,
    contactType: c.contactType,
    contactId: c.contactId,
    phone: c.phone,
    outcome: c.outcome,
    startedAt: c.startedAt,
    durationSeconds: c.durationSeconds ?? 0,
    status: c.status,
  }));
}

function donorToCall(donor) {
  const outcomeMap = {
    active: "completed",
    paused: "call_back_later",
    opted_out: "not_available",
    blocked: "wrong_number",
  };
  return {
    id: `call-${donor.id}`,
    contactName: donor.firstName,
    contactType: "donor",
    contactId: donor.id,
    phone: null, // never shown until explicitly revealed
    outcome: outcomeMap[donor.status] || "pending",
    startedAt: donor.updatedAt,
    durationSeconds: 0,
    status: donor.status === "active" ? "completed" : "pending",
  };
}

async function deriveCalls(page, pageSize) {
  try {
    const { body } = await apiFetch("/api/donors?pageSize=200");
    const donors = body.data || [];
    const all = donors.map(donorToCall);
    const total = all.length;
    const start = (page - 1) * pageSize;
    return {
      data: all.slice(start, start + pageSize),
      pagination: { page, pageSize, total },
    };
  } catch {
    return { data: [], pagination: { page, pageSize, total: 0 } };
  }
}

export function useCalls() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [state, setState] = useState({ data: [], pagination: { page: 1, pageSize: 20, total: 0 }, loading: true, error: null });

  const fetchData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { body } = await apiFetch(`/api/calls?page=${page}&pageSize=${pageSize}`);
      setState({
        data: normalizeCalls(body),
        pagination: body.pagination || { page, pageSize, total: body.data?.length || 0 },
        loading: false,
        error: null,
      });
    } catch (err) {
      if (err.status === 404) {
        const fallback = await deriveCalls(page, pageSize);
        setState({ ...fallback, loading: false, error: null });
      } else {
        setState({ data: [], pagination: { page, pageSize, total: 0 }, loading: false, error: err });
      }
    }
  }, [page, pageSize]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { body } = await apiFetch(`/api/calls?page=${page}&pageSize=${pageSize}`);
        if (!cancelled) {
          setState({
            data: normalizeCalls(body),
            pagination: body.pagination || { page, pageSize, total: body.data?.length || 0 },
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          if (err.status === 404) {
            const fallback = await deriveCalls(page, pageSize);
            if (!cancelled) setState({ ...fallback, loading: false, error: null });
          } else {
            setState({ data: [], pagination: { page, pageSize, total: 0 }, loading: false, error: err });
          }
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [page, pageSize]);

  return { ...state, refresh: fetchData, page, setPage, pageSize };
}
