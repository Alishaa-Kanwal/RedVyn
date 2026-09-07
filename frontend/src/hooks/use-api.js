"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

/**
 * Reusable fetch hook built on the existing apiFetch wrapper.
 *
 * Returns the latest fetched data, loading state, and any error. The request
 * is re-run whenever `path` changes. `refresh` can be called to re-fetch
 * without changing the path.
 */
export function useApi(path) {
  const [state, setState] = useState({
    data: null,
    loading: !!path,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { body } = await apiFetch(path);
      setState({ data: body, loading: false, error: null });
    } catch (err) {
      setState({ data: null, loading: false, error: err });
    }
  }, [path]);

  useEffect(() => {
    if (!path) return;

    let cancelled = false;

    async function run() {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { body } = await apiFetch(path);
        if (!cancelled) setState({ data: body, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ data: null, loading: false, error: err });
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [path]);

  return { ...state, refresh: fetchData };
}
