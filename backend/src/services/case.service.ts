import { randomBytes, randomInt } from "node:crypto";
import type { BloodGroup, CaseType } from "../generated/prisma/enums";
import { prisma } from "../db";
import { label } from "../lib/blood";
import { AppError } from "../middleware/error";
import { logEvent } from "./event.service";
import { findMatches } from "./matching.service";

const DEFAULT_RADIUS_M = 5000;
const WHOLE_BLOOD_DEFERRAL_DAYS = 90;

// How long after neededAt a donor can still accept. `window` is free text ("10:00-13:00"),
// so the real end of the donation window cannot be computed from it — this grace covers it.
// ponytail: fixed 12h grace; parse `window` into a real end time if ops start needing it tighter.
const OFFER_GRACE_MS = 12 * 3600 * 1000;

export function token(): string {
  return randomBytes(16).toString("hex");
}

/** §3.8 `{group}{4 digits}`, unique across currently open cases so a desk can eyeball it. */
async function issueCode(group: BloodGroup): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const candidate = `${label(group)}${randomInt(1000, 10000)}`;
    const clash = await prisma.offer.findFirst({
      where: { code: candidate, case: { state: { notIn: ["closed", "unfilled"] } } },
    });
    if (!clash) return candidate;
  }
  throw new AppError("Could not allocate a donation code, try again", 503);
}

type CreateCaseInput = {
  patientId: string;
  hospitalId: string;
  type: CaseType;
  unitsRequired: number;
  neededAt: Date;
  window: string;
  radiusMeters?: number;
};

/**
 * Creates the case and its lineup in one transaction (§3.4).
 *
 * Scheduled: top 3 as primary / standby_1 / standby_2.
 * Emergency: up to 8 contacted in parallel, all primary, with the §3.6 no-show margin
 * of one extra slot.
 */
export async function createCase(input: CreateCaseInput) {
  const patient = await prisma.patient.findUnique({ where: { id: input.patientId } });
  if (!patient) throw new AppError("No such patient", 404);
  const hospital = await prisma.hospital.findUnique({ where: { id: input.hospitalId } });
  if (!hospital) throw new AppError("No such hospital", 404);

  if (input.neededAt.getTime() + OFFER_GRACE_MS < Date.now()) {
    throw new AppError(
      "That needed-by time has already passed, so every offer would be dead on arrival.",
      400,
    );
  }

  const emergency = input.type === "emergency";
  const roleOrder = ["primary", "standby_1", "standby_2"] as const;
  const wanted = emergency ? 8 : roleOrder.length;

  const matches = await findMatches(
    patient.bloodGroup,
    hospital.lat,
    hospital.lon,
    input.radiusMeters ?? DEFAULT_RADIUS_M,
    wanted,
  );

  if (matches.length === 0) {
    throw new AppError(
      "No eligible donor in radius. Widen the radius, or the registry is too thin here.",
      409,
    );
  }

  const picked = matches.slice(0, wanted);

  const kase = await prisma.$transaction(async (tx) => {
    const created = await tx.case.create({
      data: {
        patientId: patient.id,
        hospitalId: hospital.id,
        type: input.type,
        bloodGroup: patient.bloodGroup,
        unitsRequired: input.unitsRequired,
        // §3.6: emergency carries one spare slot as the no-show margin, but a
        // 1-unit need has no margin — recruiting a second donor would be wasteful.
        slotsRemaining: input.unitsRequired + (emergency && input.unitsRequired > 1 ? 1 : 0),
        state: "awaiting_response",
        neededAt: input.neededAt,
        window: input.window,
        expiresAt: new Date(input.neededAt.getTime() + OFFER_GRACE_MS),
        radiusMeters: input.radiusMeters ?? DEFAULT_RADIUS_M,
        familyToken: token(),
      },
    });

    await tx.offer.createMany({
      data: picked.map((m, i) => ({
        caseId: created.id,
        donorId: m.id,
        // Emergency broadcasts to everyone as primary: they all need the desk details now.
        role: emergency ? ("primary" as const) : roleOrder[i]!,
        token: token(),
        sentAt: new Date(),
      })),
    });

    return created;
  });

  await logEvent(
    "case.created",
    { caseId: kase.id },
    { type: kase.type, units: kase.unitsRequired, offers: picked.length },
  );
  return kase;
}

/**
 * §3.6 atomic allocation. The decrement is a single guarded UPDATE — reading
 * slotsRemaining and writing it back would let eight concurrent acceptances all pass
 * the check and recruit eight donors for four units.
 *
 * Returns null when the donor lost the race and was released instead.
 */
export async function acceptOffer(offerToken: string) {
  const offer = await prisma.offer.findUnique({
    where: { token: offerToken },
    include: { case: true },
  });
  if (!offer) throw new AppError("No such offer", 404);

  // Idempotent: a donor who submits twice sees their existing code, not a second slot.
  if (offer.state === "accepted" || offer.state === "code_issued") return offer;
  if (offer.state !== "pending") throw new AppError("This offer is no longer open");
  if (offer.case.expiresAt < new Date()) throw new AppError("This offer has expired");

  const won = await prisma.$executeRaw`
    UPDATE "Case"
    SET "slotsRemaining" = "slotsRemaining" - 1,
        "unitsSecured"   = "unitsSecured" + 1,
        state = CASE WHEN "unitsSecured" + 1 >= "unitsRequired"
                     THEN 'filled'::"CaseState"
                     ELSE 'partially_filled'::"CaseState" END,
        "updatedAt" = now()
    WHERE id = ${offer.caseId}
      AND "slotsRemaining" > 0
      AND state IN ('matching', 'awaiting_response', 'partially_filled', 'filled')
  `;
  // 'filled' stays acceptable on purpose: slotsRemaining is the capacity authority, and
  // an emergency case reaches unitsRequired with its no-show margin slot still open.
  // Dropping 'filled' from this list makes that spare slot unreachable.

  if (won === 0) {
    // Lost the race. §3.6: no penalty, recorded positively — they did say yes.
    await prisma.offer.update({
      where: { id: offer.id },
      data: { state: "released", respondedAt: new Date() },
    });
    await logEvent("offer.released", { offerId: offer.id, caseId: offer.caseId }, { reason: "units_met" });
    return null;
  }

  const code = await issueCode(offer.case.bloodGroup);
  const updated = await prisma.offer.update({
    where: { id: offer.id },
    data: {
      state: "code_issued",
      code,
      codeExpiresAt: new Date(offer.case.expiresAt.getTime() + 24 * 3600 * 1000),
      respondedAt: new Date(),
    },
    include: { case: true },
  });

  await logEvent("offer.accepted", { offerId: offer.id, caseId: offer.caseId, donorId: offer.donorId });

  const fresh = await prisma.case.findUnique({ where: { id: offer.caseId } });
  if (fresh && fresh.slotsRemaining === 0) {
    await logEvent("case.units_met", { caseId: offer.caseId }, { secured: fresh.unitsSecured });
    // Emergency broadcasts stand everyone else down immediately — that is the §3.6
    // release message. A scheduled case keeps its standbys pending until the donation
    // is actually confirmed, because a primary who accepts can still not turn up, and
    // releasing them here would leave promoteStandby with nobody to promote.
    if (fresh.type === "emergency") await releaseRemaining(offer.caseId, "units_met");
  }
  return updated;
}

export async function declineOffer(offerToken: string, reason: string): Promise<void> {
  const offer = await prisma.offer.findUnique({
    where: { token: offerToken },
    include: { case: true },
  });
  if (!offer) throw new AppError("No such offer", 404);
  if (offer.state !== "pending") throw new AppError("This offer is no longer open");

  await prisma.offer.update({
    where: { id: offer.id },
    data: { state: "declined", respondedAt: new Date() },
  });
  await logEvent("offer.declined", { offerId: offer.id, caseId: offer.caseId }, { reason });

  // §3.10 rewards declining early precisely because it buys time to re-fill, so act on it
  // now rather than waiting for a human to press Promote. Only for a scheduled primary:
  // an emergency has no standbys (everyone is contacted as primary), and a standby
  // dropping out costs the case nothing.
  if (offer.role === "primary" && offer.case.type === "scheduled") {
    await promoteNextStandby(offer.caseId);
  }

  // Nobody left to ask and nothing secured. Radius expansion (§3.7) is a later build step,
  // so for now this just has to be visible to ops rather than silently stalling.
  const stillOpen = await prisma.offer.count({
    where: { caseId: offer.caseId, state: { in: ["pending", "accepted", "code_issued"] } },
  });
  if (stillOpen === 0) {
    await logEvent("case.lineup_exhausted", { caseId: offer.caseId });
  }
}

/** Every still-pending offer on a case, stood down. */
async function releaseRemaining(caseId: string, reason: string): Promise<void> {
  const { count } = await prisma.offer.updateMany({
    where: { caseId, state: "pending" },
    data: { state: "released" },
  });
  if (count > 0) await logEvent("offer.released", { caseId }, { reason, count });
}

/**
 * Moves the next pending standby into the primary slot, timing out a primary that is still
 * sitting unanswered. Returns null when there is no standby left — the caller decides
 * whether that is an error (an ops click) or just the end of the lineup (a decline).
 *
 * The offer token does not change, so a standby who already has their link simply sees the
 * primary view — hospital, desk, and the accept button — on their next page load.
 */
async function promoteNextStandby(caseId: string) {
  const offers = await prisma.offer.findMany({ where: { caseId }, orderBy: { role: "asc" } });
  const primary = offers.find((o) => o.role === "primary" && o.state === "pending");
  const standby = offers.find((o) => o.role !== "primary" && o.state === "pending");
  if (!standby) return null;

  const promoted = await prisma.$transaction(async (tx) => {
    if (primary) {
      await tx.offer.update({ where: { id: primary.id }, data: { state: "timed_out" } });
    }
    return tx.offer.update({
      where: { id: standby.id },
      data: { role: "primary", state: "pending", sentAt: new Date() },
    });
  });

  await logEvent(
    "offer.promoted",
    { offerId: standby.id, caseId },
    { from_role: standby.role, to_role: "primary" },
  );
  if (primary) await logEvent("offer.timed_out", { offerId: primary.id, caseId });
  return promoted;
}

/** §3.5 T-24h / T-2h step, driven by hand from the console until the scheduler lands. */
export async function promoteStandby(caseId: string) {
  const promoted = await promoteNextStandby(caseId);
  if (!promoted) throw new AppError("No standby left to promote");
  return promoted;
}

/**
 * §3.9 closure. Only the requester side can call this — the family token is the
 * authentication. A donor confirming their own donation would farm reliability score.
 */
export async function confirmDonation(familyToken: string, code: string) {
  const kase = await prisma.case.findUnique({
    where: { familyToken },
    include: { offers: true },
  });
  if (!kase) throw new AppError("No such case", 404);
  if (kase.state === "closed") throw new AppError("This case is already closed");

  // Codes get read aloud at a desk and typed back in, so spacing and case are noise.
  // The +/- is NOT noise — it is the difference between B+ and B-, so it stays significant.
  const tidy = (s: string): string => s.replace(/\s+/g, "").toUpperCase();
  const offer = kase.offers.find(
    (o) => o.code && tidy(o.code) === tidy(code) && o.state === "code_issued",
  );
  if (!offer) throw new AppError("That code does not match an active donor on this case");

  const now = new Date();
  const nextEligible = new Date(now.getTime() + WHOLE_BLOOD_DEFERRAL_DAYS * 86400_000);

  const donation = await prisma.$transaction(async (tx) => {
    const d = await tx.donation.create({
      data: {
        caseId: kase.id,
        donorId: offer.donorId,
        patientId: kase.patientId,
        code: offer.code!,
        confirmedBy: "family",
      },
    });

    await tx.offer.update({ where: { id: offer.id }, data: { state: "completed" } });

    // §3.1 nextEligibleAt is written here, once, so the match query stays a plain scan.
    await tx.donor.update({
      where: { id: offer.donorId },
      data: {
        lastDonationAt: now,
        nextEligibleAt: nextEligible,
        reliabilityScore: { increment: 5 },
      },
    });

    await tx.patient.update({ where: { id: kase.patientId }, data: { lastTransfusionAt: now } });

    const outstanding = await tx.offer.count({
      where: { caseId: kase.id, state: "code_issued" },
    });
    await tx.case.update({
      where: { id: kase.id },
      data: { state: outstanding === 0 ? "closed" : "in_progress" },
    });

    return d;
  });

  await releaseRemaining(kase.id, "case_closed");
  await logEvent(
    "donation.confirmed",
    { caseId: kase.id, offerId: offer.id, donorId: offer.donorId },
    { confirmed_by: "family" },
  );
  return donation;
}
