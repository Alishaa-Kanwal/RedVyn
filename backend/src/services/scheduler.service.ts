import { CaseState } from "../generated/prisma/enums";
import { prisma } from "../db";
import { AppError } from "../middleware/error";
import { logEvent } from "./event.service";
import { sweepRadiusExpansion } from "./radius-fallback.service";

/**
 * Finds all offers that have passed their case's expiresAt time and are still pending.
 * For each case with expired pending offers, times out the primary and attempts to 
 * promote the next standby.
 *
 * Idempotent: offers already timed_out are skipped, and promotion is per-case, so
 * running twice does not double-fire.
 */
export async function sweepExpiredOffers(): Promise<void> {
  const now = new Date();

  // Find cases (not offers) that have passed their expiration time and have pending offers
  const expiredCases = await prisma.case.findMany({
    where: {
      expiresAt: { lt: now },
      offers: { some: { state: "pending" } },
    },
    include: {
      offers: {
        where: { state: "pending" },
      },
    },
  });

  // For each expired case, time out the primary and try to promote the next standby
  for (const kase of expiredCases) {
    const primary = kase.offers.find((o) => o.role === "primary");
    
    if (primary) {
      // Mark the primary as timed out
      await prisma.offer.update({
        where: { id: primary.id },
        data: { state: "timed_out" },
      });

      await logEvent("offer.timed_out", { offerId: primary.id, caseId: kase.id }, { reason: "sweep" });

      // Try to promote the next standby
      await promoteNextStandbyIfAvailable(kase.id);
    }
  }
}

/**
 * Finds all cases where the entire lineup (primary + all standbys) has been exhausted
 * (no pending offers remain and at least one offer exists). Marks these cases as
 * unfilled if not already marked.
 *
 * Idempotent: cases already in unfilled or closed states are not re-processed.
 */
const LINEUP_EXHAUST_STATES: CaseState[] = ["draft", "matching", "awaiting_response", "partially_filled", "filled", "in_progress", "confirmed", "escalating", "broadcasting"];

export async function sweepLineupExhausted(): Promise<void> {
  // Find cases that are not already terminal and have at least one offer.
  // fallback_bloodbank and pending_review are excluded: the former is an
  // intentional hand-off, the latter is for human review.
  const casesWithOffers = await prisma.case.findMany({
    where: {
      state: { in: LINEUP_EXHAUST_STATES },
      offers: { some: {} }, // At least one offer exists
    },
    include: {
      offers: {
        select: { state: true },
      },
    },
  });

  for (const kase of casesWithOffers) {
    // Check if all offers are in non-continuable states
    const hasOpenOffer = kase.offers.some((o) =>
      ["pending", "accepted", "code_issued"].includes(o.state),
    );

    if (!hasOpenOffer) {
      // All offers exhausted, mark case as unfilled
      const updated = await prisma.case.update({
        where: { id: kase.id },
        data: { state: "unfilled" },
      });

      await logEvent("case.lineup_exhausted", { caseId: kase.id });
    }
  }
}

/**
 * Internal: attempts to promote the next standby on a case, following the same
 * logic as the manual promote button. Does nothing if no standby is available
 * (returns null silently, unlike the user-facing promoteStandby which throws).
 */
async function promoteNextStandbyIfAvailable(caseId: string): Promise<void> {
  const offers = await prisma.offer.findMany({ where: { caseId }, orderBy: { role: "asc" } });
  const primary = offers.find((o) => o.role === "primary" && o.state === "pending");
  const standby = offers.find((o) => o.role !== "primary" && o.state === "pending");

  if (!standby) return; // No standby to promote

  await prisma.$transaction(async (tx) => {
    if (primary) {
      await tx.offer.update({
        where: { id: primary.id },
        data: { state: "timed_out" },
      });
    }
    await tx.offer.update({
      where: { id: standby.id },
      data: { role: "primary", state: "pending", sentAt: new Date() },
    });
  });

  await logEvent(
    "offer.promoted",
    { offerId: standby.id, caseId },
    { from_role: standby.role, to_role: "primary" },
  );

  if (primary) {
    await logEvent("offer.timed_out", { offerId: primary.id, caseId }, { reason: "sweep" });
  }
}

/**
 * Full sweep cycle used by the scheduler runner. Order matters:
 * 1. Time out expired offers and promote standbys.
 * 2. Widen the radius for cases with no acceptance.
 * 3. Mark lineups that are truly exhausted as unfilled.
 */
/**
 * Phase 15: recompute patient predictedNextAt values and donor reliability scores.
 *
 * - predictedNextAt is driven by the patient's own intervalDaysEstimate and the
 *   last transfusion date.
 * - Reliability score starts from a neutral midpoint and is adjusted by the
 *   donor's completed donations, no-shows, and accepted offers. If a Call
 *   model ever lands (Phase 14), this function can be extended to include call
 *   responsiveness without changing the sweep contract.
 */
export async function sweepReliabilityAndPrediction(): Promise<void> {
  // Update predictions for any patient with a known last transfusion.
  const patients = await prisma.patient.findMany({
    where: { lastTransfusionAt: { not: null } },
  });
  for (const patient of patients) {
    const nextAt = new Date(
      patient.lastTransfusionAt!.getTime() + patient.intervalDaysEstimate * 86400_000,
    );
    await prisma.patient.update({
      where: { id: patient.id },
      data: { predictedNextAt: nextAt },
    });
  }

  // Compute per-donor reliability metrics.
  const donors = await prisma.donor.findMany({
    include: {
      offers: true,
      donations: true,
    },
  });

  for (const donor of donors) {
    const completed = donor.donations.length;
    const noShows = donor.offers.filter((o) => o.state === "no_show").length;
    const accepted = donor.offers.filter((o) =>
      ["accepted", "code_issued", "completed"].includes(o.state),
    ).length;

    const score = Math.min(100, Math.max(0, 50 + completed * 10 - noShows * 15 + accepted * 2));
    await prisma.donor.update({
      where: { id: donor.id },
      data: { reliabilityScore: score },
    });
  }
}

export async function sweepAll(now = new Date()): Promise<void> {
  await sweepExpiredOffers();
  await sweepRadiusExpansion(now);
  await sweepLineupExhausted();
  await sweepReliabilityAndPrediction();
}
