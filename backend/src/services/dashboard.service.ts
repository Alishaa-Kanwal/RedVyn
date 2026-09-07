import { prisma } from "../db";
import type { CaseState } from "../generated/prisma/enums";
import { label } from "../lib/blood";

const RECENT_ACTIVITY_LIMIT = 10;
const TERMINAL_STATES: CaseState[] = ["closed", "unfilled", "pending_review"];

function displayBloodGroup(group: string): string {
  return label(group as never);
}

function activityIcon(type: string): string {
  if (type === "donor.registered") return "Users";
  if (type === "patient.registered") return "Stethoscope";
  if (type === "case.created") return "Activity";
  if (type === "offer.accepted" || type === "donation.confirmed") return "Heart";
  if (type === "case.closed") return "CheckCircle";
  return "Activity";
}

function activityColor(type: string): number {
  if (type === "case.created") return 1;
  if (["donor.registered", "offer.accepted", "donation.confirmed", "case.closed"].includes(type)) return 2;
  if (type === "patient.registered") return 3;
  if (type.startsWith("offer.")) return 4;
  return 5;
}

function activityTitle(type: string): string {
  const map: Record<string, string> = {
    "case.created": "New case created",
    "case.closed": "Case closed",
    "case.units_met": "Case units met",
    "case.lineup_exhausted": "Case lineup exhausted",
    "donor.registered": "New donor registered",
    "donor.status_changed": "Donor status changed",
    "donor.opted_out": "Donor opted out",
    "patient.registered": "New patient registered",
    "patient.status_changed": "Patient status changed",
    "offer.created": "Offer sent",
    "offer.accepted": "Donor accepted",
    "offer.declined": "Donor declined",
    "offer.promoted": "Standby promoted",
    "offer.timed_out": "Offer timed out",
    "offer.released": "Offer released",
    "donation.confirmed": "Donation confirmed",
  };
  return map[type] || type;
}

export async function getDashboardOverview() {
  const now = new Date();

  const [
    activeCases,
    eligibleDonors,
    todaysCalls,
    livesSupported,
    caseStatusCounts,
    recentEvents,
    emergencyBroadcasts,
  ] = await Promise.all([
    prisma.case.count({ where: { state: { notIn: TERMINAL_STATES } } }),
    prisma.donor.count({ where: { status: "active", nextEligibleAt: { lte: now } } }),
    Promise.resolve(0),
    prisma.case.count({ where: { state: "closed" } }),
    prisma.case.groupBy({ by: ["state"], _count: { state: true } }),
    prisma.event.findMany({ orderBy: { at: "desc" }, take: RECENT_ACTIVITY_LIMIT }),
    prisma.case.findMany({
      where: { type: "emergency", state: { notIn: TERMINAL_STATES } },
      orderBy: { createdAt: "desc" },
      include: { hospital: { select: { name: true } } },
      take: 5,
    }),
  ]);

  const donorIds = [...new Set(recentEvents.map((e) => e.donorId).filter((id): id is string => !!id))];
  const donors = donorIds.length
    ? await prisma.donor.findMany({
        where: { id: { in: donorIds } },
        select: { id: true, firstName: true, bloodGroup: true, city: true },
      })
    : [];
  const donorMap = new Map(donors.map((d) => [d.id, d]));

  const patientIds = [...new Set(recentEvents.map((e) => (e.payload as Record<string, string> | null)?.patientId).filter((id): id is string => !!id))];
  const patients = patientIds.length
    ? await prisma.patient.findMany({
        where: { id: { in: patientIds } },
        select: { id: true, firstName: true, bloodGroup: true },
      })
    : [];
  const patientMap = new Map(patients.map((p) => [p.id, p]));

  const caseIds = [...new Set(recentEvents.map((e) => e.caseId).filter((id): id is string => !!id))];
  const cases = caseIds.length
    ? await prisma.case.findMany({
        where: { id: { in: caseIds } },
        select: {
          id: true,
          bloodGroup: true,
          type: true,
          unitsRequired: true,
          hospital: { select: { name: true } },
        },
      })
    : [];
  const caseMap = new Map(cases.map((c) => [c.id, c]));

  const recentActivity = recentEvents.map((e) => {
    const donor = e.donorId ? donorMap.get(e.donorId) : null;
    const payload = (e.payload as Record<string, string> | null) ?? {};
    const patient = payload.patientId ? patientMap.get(payload.patientId) : null;
    const kase = e.caseId ? caseMap.get(e.caseId) : null;

    let subtitle = "";
    if (donor) {
      subtitle = `${donor.firstName} · ${displayBloodGroup(donor.bloodGroup)}${donor.city ? ` · ${donor.city}` : ""}`;
    } else if (patient) {
      subtitle = `${patient.firstName} · ${displayBloodGroup(patient.bloodGroup)}`;
    } else if (kase) {
      subtitle = `${kase.type} · ${displayBloodGroup(kase.bloodGroup)} · ${kase.hospital?.name ?? ""}`.trim();
    }

    return {
      type: e.type,
      title: activityTitle(e.type),
      subtitle,
      time: e.at.toISOString(),
      icon: activityIcon(e.type),
      color: activityColor(e.type),
    };
  });

  return {
    statCards: {
      activeCases,
      donorsOnline: eligibleDonors,
      todaysCalls,
      livesSupported,
    },
    caseStatus: caseStatusCounts.map((c, i) => ({
      label: c.state,
      value: c._count.state,
      color: (i % 5) + 1,
    })),
    avgResponseTime: null,
    recentActivity,
    emergencyBroadcasts: emergencyBroadcasts.map((b) => ({
      id: b.id,
      title: `Emergency ${displayBloodGroup(b.bloodGroup)}`,
      unitsRequired: b.unitsRequired,
      unitsSecured: b.unitsSecured,
      bloodGroup: displayBloodGroup(b.bloodGroup),
      hospital: b.hospital?.name ?? "—",
      hospitalId: b.hospitalId,
      radiusMeters: null,
    })),
  };
}
