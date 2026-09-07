"use client";

import { useCallback, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useApi } from "./use-api";

function buildQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export function useRegistryList(basePath, initialFilters = {}) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filters, setFiltersState] = useState(initialFilters);

  const query = useMemo(
    () => buildQuery({ ...filters, page, pageSize }),
    [filters, page, pageSize],
  );

  const { data, loading, error, refresh } = useApi(`${basePath}${query}`);

  const setFilters = useCallback((updater) => {
    setFiltersState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      return next;
    });
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters);
    setPage(1);
  }, [initialFilters]);

  return {
    data: data?.data || [],
    pagination: data?.pagination || { page: 1, pageSize: 20, total: 0 },
    loading,
    error,
    refresh,
    page,
    setPage,
    pageSize,
    filters,
    setFilters,
    resetFilters,
  };
}

export function useRegistryDetail(basePath, id) {
  return useApi(id ? `${basePath}/${id}` : null);
}

export function useRegistryCreate() {
  const create = useCallback(async (basePath, body) => {
    const res = await apiFetch(basePath, { method: "POST", body: JSON.stringify(body) });
    return res.body;
  }, []);
  return create;
}

export function useRegistryUpdateStatus() {
  const update = useCallback(async (basePath, id, status) => {
    const res = await apiFetch(`${basePath}/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    return res.body;
  }, []);
  return update;
}

export function useRegistryRevealPhone() {
  const reveal = useCallback(async (basePath, id, type = "phone") => {
    const endpoint =
      type === "guardian" ? `${basePath}/${id}/reveal-guardian-phone` : `${basePath}/${id}/reveal-phone`;
    const res = await apiFetch(endpoint, { method: "POST" });
    return res.body;
  }, []);
  return reveal;
}

export function useRegistryUpdateItem() {
  const update = useCallback(async (basePath, id, body) => {
    const res = await apiFetch(`${basePath}/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    return res.body;
  }, []);
  return update;
}
