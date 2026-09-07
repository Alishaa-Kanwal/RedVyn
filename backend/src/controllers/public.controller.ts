import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { param } from "../lib/http";
import { AppError } from "../middleware/error";
import { acceptOffer, confirmDonation, declineOffer } from "../services/case.service";
import { buildOfferPayload } from "../services/payload.service";
import { optOut } from "../services/registry.service";

export const declineSchema = z.object({ reason: z.string().max(200).default("") });
export const confirmSchema = z.object({ code: z.string().min(3).max(12) });

/**
 * Token-addressed JSON for the SMS magic links. The token in the URL is the whole
 * authentication, so these are the only unauthenticated case endpoints — a donor
 * who has not signed up still has to be able to answer.
 *
 * Everything the donor sees comes from buildOfferPayload, the §4.3 privacy boundary —
 * a raw Case or Patient must never be returned here.
 */
export async function getOffer(req: Request, res: Response): Promise<void> {
  const offer = await prisma.offer.findUnique({
    where: { token: param(req, "token") },
    include: { case: { include: { hospital: true } }, donor: true },
  });
  if (!offer) throw new AppError("No such offer", 404);

  res.json({
    offer: {
      state: offer.state,
      // Checked here too, not just in acceptOffer: a donor should be told the request
      // has passed, not shown a working Yes button that errors after they tap it.
      expired: offer.case.expiresAt < new Date(),
      firstName: offer.donor.firstName,
      manageToken: offer.donor.manageToken,
      ...buildOfferPayload(offer, offer.case),
    },
  });
}

export async function postAccept(req: Request, res: Response): Promise<void> {
  const result = await acceptOffer(param(req, "token"));
  if (!result) {
    // §3.6 release wording matters for retention: they said yes, the need was just met.
    res.json({ result: "released", message: "Thank you — this request was already filled." });
    return;
  }
  res.json({ result: "accepted", code: result.code });
}

export async function postDecline(req: Request, res: Response): Promise<void> {
  await declineOffer(param(req, "token"), req.body.reason);
  res.json({ result: "declined" });
}

export async function getManage(req: Request, res: Response): Promise<void> {
  const donor = await prisma.donor.findUnique({ where: { manageToken: param(req, "token") } });
  if (!donor) throw new AppError("No such donor", 404);
  res.json({
    donor: {
      firstName: donor.firstName,
      bloodGroup: donor.bloodGroup,
      city: donor.city,
      status: donor.status,
      lastDonationAt: donor.lastDonationAt,
      nextEligibleAt: donor.nextEligibleAt,
    },
  });
}

export async function postOptOut(req: Request, res: Response): Promise<void> {
  await optOut(param(req, "token"));
  res.json({ result: "opted_out" });
}

/** §3.9. Possession of the family token is the authentication — only this side can confirm. */
export async function getFamily(req: Request, res: Response): Promise<void> {
  const kase = await prisma.case.findUnique({
    where: { familyToken: param(req, "token") },
    include: {
      hospital: true,
      patient: true,
      offers: { where: { state: { in: ["code_issued", "completed"] } }, include: { donor: true } },
    },
  });
  if (!kase) throw new AppError("No such case", 404);

  res.json({
    case: {
      id: kase.id,
      state: kase.state,
      bloodGroup: kase.bloodGroup,
      unitsRequired: kase.unitsRequired,
      unitsSecured: kase.unitsSecured,
      neededAt: kase.neededAt,
      window: kase.window,
      patient: { firstName: kase.patient.firstName },
      hospital: { name: kase.hospital.name, city: kase.hospital.city, deskInfo: kase.hospital.deskInfo },
      donors: kase.offers.map((o) => ({
        firstName: o.donor.firstName,
        state: o.state,
      })),
    },
  });
}

export async function postConfirm(req: Request, res: Response): Promise<void> {
  await confirmDonation(param(req, "token"), req.body.code);
  res.json({ result: "confirmed" });
}
