"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Users,
  Stethoscope,
  Building2,
  Droplet,
  Activity,
  Heart,
  CheckCircle,
  Phone,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

function bloodLabel(group) {
  if (!group) return "";
  return group.replace("_POS", "+").replace("_NEG", "-");
}

function isToday(isoDate) {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

const ICON_MAP = {
  Users,
  Stethoscope,
  Building2,
  Droplet,
  Activity,
  Heart,
  CheckCircle,
  Phone,
};

export function useDashboardOverview() {
  const [state, setState] = useState({
    loading: true,
    error: null,
  });
  const [overview, setOverview] = useState(null);
  const [donors, setDonors] = useState(null);
  const [hospitals, setHospitals] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const [overviewRes, donorsRes, hospitalsRes] = await Promise.all([
          apiFetch("/api/dashboard/overview"),
          apiFetch("/api/donors?pageSize=100"),
          apiFetch("/api/hospitals?pageSize=100"),
        ]);
        if (!cancelled) {
          setOverview(overviewRes.body);
          setDonors(donorsRes.body);
          setHospitals(hospitalsRes.body);
          setState({ loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const donorList = donors?.data || [];
  const hospitalList = hospitals?.data || [];

  const stats = useMemo(() => {
    const cards = overview?.statCards || {};
    return {
      activeCases: cards.activeCases ?? 0,
      donorsOnline: cards.donorsOnline ?? 0,
      todaysCalls: cards.todaysCalls ?? 0,
      livesSupported: cards.livesSupported ?? 0,
    };
  }, [overview]);

  const caseStatus = useMemo(() => {
    return overview?.caseStatus || [];
  }, [overview]);

  const responseTime = overview?.avgResponseTime ?? null;
  const responseSparkline = [];

  const recentActivity = useMemo(() => {
    const items = overview?.recentActivity || [];
    return items.map((item) => {
      const Icon = ICON_MAP[item.icon] || Activity;
      return {
        icon: Icon,
        color: item.color ?? 1,
        title: item.title,
        subtitle: item.subtitle,
        time: item.time,
      };
    });
  }, [overview]);

  const activeEmergencyCase = useMemo(() => {
    const broadcast = overview?.emergencyBroadcasts?.[0];
    if (!broadcast) return null;
    const hospital = hospitalList.find((h) => h.id === broadcast.hospitalId);
    return {
      id: broadcast.id,
      bloodGroup: broadcast.bloodGroup,
      unitsRequired: broadcast.unitsRequired,
      unitsSecured: broadcast.unitsSecured,
      hospitalId: broadcast.hospitalId,
      hospitalName: broadcast.hospital ?? hospital?.name ?? "—",
      radiusMeters: broadcast.radiusMeters,
    };
  }, [overview, hospitalList]);

  return {
    loading: state.loading,
    error: state.error,
    stats,
    caseStatus,
    responseTime,
    responseSparkline,
    recentActivity,
    activeEmergencyCase,
    hospitals: hospitalList,
    donors: donorList,
  };
}
