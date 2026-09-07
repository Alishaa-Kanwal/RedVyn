import { CaseState } from "../generated/prisma/enums";
import { prisma } from "../db";
import { logEvent } from "./event.service";
import { findMatches } from "./matching.service";
import { token } from "./case.service";
import { notifyFallbackBloodBank } from "./notification.service";

const EXPANSION_WAIT_MS = 5 * 60 * 1000;
const TIERS: { radiusMeters: number; state: CaseState }[] = [
  { radiusMeters: 5000, state: "awaiting_response" },
  { radiusMeters: 15000, state: "escalating" },
  { radiusMeters: 30000, state: "broadcasting" },
];
const ELIGIBLE_STATES: CaseState[] = ["awaiting_response", "partially_filled", "escalating", "broadcasting"];

function nextTier(currentRadiusMeters: number) {
  for (const tier of TIERS) {
    if (currentRadiusMeters < tier.radiusMeters) {
      return tier;
    }
  }
  return null;
}

/**
 * §3.7 Radius expansion ladder.
 *
 * Evaluates a single case. If the case has pending offers but no acceptance
 * after the expansion wait, it climbs 5km → 15km → 30km. Each step reuses the
 * existing haversine match query with a wider radius. Donors already contacted
 * on this case are skipped. If 30km still yields nothing, the case transitions
 * to fallback_bloodbank and a fallback notification is triggered.
 *
 * Every transition writes an Event.
 */
export async function expandRadiusForCase(caseId: string, now = new Date()): Promise<void> {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      patient: true,
      hospital: true,
      offers: true,
    },
  });
  if (!kase) return;

  if (!ELIGIBLE_STATES.includes(kase.state)) return;

  const pendingOffers = kase.offers.filter((o) => o.state === "pending" && o.sentAt);
  if (pendingOffers.length === 0) return;

  const oldestSentAt = pendingOffers.reduce((min, o) => {
    const t = o.sentAt!.getTime();
    return t < min ? t : min;
  }, Infinity);
  if (oldestSentAt === Infinity || oldestSentAt > now.getTime() - EXPANSION_WAIT_MS) return;

  const hasAcceptance = kase.offers.some((o) => ["accepted", "code_issued", "completed"].includes(o.state));
  if (hasAcceptance) return;

  const alreadyContactedDonorIds = new Set(kase.offers.map((o) => o.donorId));

  let currentRadius = kase.radiusMeters;

  while (true) {
    const tier = nextTier(currentRadius);
    if (!tier) {
      // 30km exhausted — hand off to blood-bank fallback.
      await prisma.case.update({
        where: { id: caseId },
        data: { state: "fallback_bloodbank", radiusMeters: TIERS[TIERS.length - 1]!.radiusMeters },
      });
      await logEvent("case.fallback_bloodbank", { caseId }, { radiusMeters: currentRadius });
      await notifyFallbackBloodBank({ caseId, bloodGroup: kase.bloodGroup });
      return;
    }

    const matches = await findMatches(
      kase.bloodGroup,
      kase.hospital.lat,
      kase.hospital.lon,
      tier.radiusMeters,
      8,
    );

    const fresh = matches.filter((m) => !alreadyContactedDonorIds.has(m.id));

    if (fresh.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.offer.createMany({
          data: fresh.map((m) => ({
            caseId,
            donorId: m.id,
            role: kase.type === "emergency" ? ("primary" as const) : ("standby_1" as const),
            token: token(),
            sentAt: now,
          })),
        });
        await tx.case.update({
          where: { id: caseId },
          data: { state: tier.state, radiusMeters: tier.radiusMeters },
        });
      });

      await logEvent("case.radius_expanded", { caseId }, {
        radiusMeters: tier.radiusMeters,
        newOffers: fresh.length,
        previousRadiusMeters: currentRadius,
      });
      return;
    }

    // No new donors at this tier — record the attempt and climb to the next.
    await logEvent("case.radius_expanded_empty", { caseId }, {
      radiusMeters: tier.radiusMeters,
      previousRadiusMeters: currentRadius,
    });
    currentRadius = tier.radiusMeters;
  }
}

/**
 * Sweep hook for Phase 9's scheduler. Evaluates every case that could need a
 * wider radius during the normal sweep cycle.
 */
export async function sweepRadiusExpansion(now = new Date()): Promise<void> {
  const candidates = await prisma.case.findMany({
    where: {
      state: { in: ELIGIBLE_STATES },
      offers: { some: { state: "pending" } },
    },
    select: { id: true },
  });

  for (const c of candidates) {
    await expandRadiusForCase(c.id, now);
  }
}
