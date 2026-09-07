"use client";

import { useCallback, useEffect, useState } from "react";
import { settingsApi } from "@/lib/api";

/**
 * Shape returned by GET /api/settings.
 *
 * {
 *   general: {
 *     organizationName: string,
 *     organizationTagline: string,
 *     primaryContact: string,
 *     email: string,
 *     timezone: string,
 *     language: string,
 *     dateFormat: string,
 *     timeFormat: string,
 *     systemTheme: "light" | "dark" | "system",
 *     itemsPerPage: number,
 *   },
 *   notifications: {
 *     newEmergencyCase: boolean,
 *     donorConfirmed: boolean,
 *     missedCalls: boolean,
 *     caseEscalation: boolean,
 *     dailySummary: boolean,
 *   },
 *   sessions: {
 *     autoLogoutMinutes: number,
 *     activeSessions: number,
 *   },
 * }
 */
export const DEFAULT_SETTINGS = {
  general: {
    organizationName: "",
    organizationTagline: "",
    primaryContact: "",
    email: "",
    timezone: "",
    language: "",
    dateFormat: "",
    timeFormat: "",
    systemTheme: "system",
    itemsPerPage: 10,
  },
  notifications: {
    newEmergencyCase: false,
    donorConfirmed: false,
    missedCalls: false,
    caseEscalation: false,
    dailySummary: false,
  },
  sessions: {
    autoLogoutMinutes: 30,
    activeSessions: 0,
  },
};

export function normalizeSettings(body) {
  return {
    general: { ...DEFAULT_SETTINGS.general, ...(body?.general || {}) },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(body?.notifications || {}) },
    sessions: { ...DEFAULT_SETTINGS.sessions, ...(body?.sessions || {}) },
  };
}

export function useSettings() {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { body } = await settingsApi.get();
      setState({ data: normalizeSettings(body), loading: false, error: null });
    } catch (err) {
      setState({ data: null, loading: false, error: err });
    }
  }, []);

  const update = useCallback(async (payload) => {
    const { body } = await settingsApi.update(payload);
    return body;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { body } = await settingsApi.get();
        if (!cancelled) {
          setState({ data: normalizeSettings(body), loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ data: null, loading: false, error: err });
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, refresh: fetchData, update };
}
