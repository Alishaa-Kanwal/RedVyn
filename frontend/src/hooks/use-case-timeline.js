"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";

export function useCaseTimeline(caseId) {
  const [state, setState] = useState({
    data: [],
    loading: false,
    error: null,
    open: false,
  });

  const fetchTimeline = useCallback(async () => {
    if (!caseId) return;
    setState((s) => ({ ...s, loading: true, error: null, open: true }));
    try {
      const { body } = await apiFetch(`/api/cases/${caseId}/timeline`);
      setState({ data: body?.timeline || [], loading: false, error: null, open: true });
    } catch (err) {
      setState({ data: [], loading: false, error: err, open: true });
    }
  }, [caseId]);

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  return { ...state, fetchTimeline, close };
}
