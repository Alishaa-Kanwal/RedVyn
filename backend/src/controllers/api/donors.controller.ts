import type { Request, Response } from "express";
import { z } from "zod";
import { BloodGroup } from "../../generated/prisma/enums";
import { param } from "../../lib/http";
import { AppError } from "../../middleware/error";
import { prisma } from "../../db";
import { acceptOffer, declineOffer } from "../../services/case.service";
import { buildOfferPayload } from "../../services/payload.service";
import { revealDonorPhone as revealDonorPhoneSvc } from "../../services/phone.service";
import {
  canAccessDonor,
  createDonor as createDonorSvc,
  getDonorById,
  getDonorHistory as getDonorHistorySvc,
  listDonorsPaginatedForUser,
  setDonorStatus,
} from "../../services/registry.service";

const bloodGroupSchema = z.nativeEnum(BloodGroup);
const coord = z.coerce.number().min(-180).max(180);

export const donorSchema = z.object({
  firstName: z.string().min(1).max(80),
  phone: z.string().min(6).max(20),
  bloodGroup: bloodGroupSchema,
  city: z.string().min(1).max(80),
  lat: coord,
  lon: coord,
  language: z.enum(["ur", "en"]),
  lastDonationAt: z.string().optional(),
});

export const donorStatusSchema = z.object({
  status: z.enum(["active", "paused", "opted_out", "blocked"]),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["active", "paused", "opted_out", "blocked"]).optional(),
  bloodGroup: bloodGroupSchema.optional(),
  city: z.string().optional(),
  q: z.string().optional(),
});

const date = (s?: string): Date | null => (s ? new Date(s) : null);

type Donor = NonNullable<Awaited<ReturnType<typeof getDonorById>>>;

function publicDonor(donor: Donor) {
  return {
    id: donor.id,
    firstName: donor.firstName,
    bloodGroup: donor.bloodGroup,
    city: donor.city,
    lat: donor.lat,
    lon: donor.lon,
    language: donor.language,
    status: donor.status,
    lastDonationAt: donor.lastDonationAt,
    nextEligibleAt: donor.nextEligibleAt,
    reliabilityScore: donor.reliabilityScore,
    consentAt: donor.consentAt,
    consentVersion: donor.consentVersion,
    createdAt: donor.createdAt,
    updatedAt: donor.updatedAt,
  };
}

function parseListQuery(req: Request) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AppError(`${first?.path.join(".") ?? "query"}: ${first?.message}`);
  }
  return parsed.data;
}

export async function listDonors(req: Request, res: Response): Promise<void> {
  const query = parseListQuery(req);
  const { role, sub } = req.user!;
  const { data, total } = await listDonorsPaginatedForUser(query, role, sub);
  res.json({
    data: data.map(publicDonor),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  });
}

export async function getDonor(req: Request, res: Response): Promise<void> {
  const id = param(req, "id");
  if (!(await canAccessDonor(id, req.user!.role, req.user!.sub))) {
    throw new AppError("Forbidden", 403);
  }
  const donor = await getDonorById(id);
  if (!donor) throw new AppError("No such donor", 404);
  res.json({ donor: publicDonor(donor) });
}

export async function getDonorHistory(req: Request, res: Response): Promise<void> {
  if (req.user!.role !== "donor") {
    throw new AppError("Forbidden", 403);
  }
  const history = await getDonorHistorySvc(req.user!.sub);
  res.json(history);
}

export async function createDonor(req: Request, res: Response): Promise<void> {
  const donor = await createDonorSvc({
    ...req.body,
    lastDonationAt: date(req.body.lastDonationAt),
  });
  res.status(201).json({ donor: publicDonor(donor) });
}

export async function updateDonorStatus(req: Request, res: Response): Promise<void> {
  const donor = await setDonorStatus(param(req, "id"), req.body.status);
  res.json({ donor: publicDonor(donor) });
}

export async function revealDonorPhone(req: Request, res: Response): Promise<void> {
  const phone = await revealDonorPhoneSvc(param(req, "id"), req.user!.sub);
  res.json({ phone });
}

export const offerResponseSchema = z.object({
  action: z.enum(["accept", "decline"]),
  reason: z.string().max(200).default(""),
});

/**
 * The logged-in donor's inbox: offers still waiting on them. Everything rendered comes
 * from buildOfferPayload, the §4.3 privacy boundary — a standby sees city and blood
 * group only, never the hospital they have not been promoted to.
 */
export async function getMyOffers(req: Request, res: Response): Promise<void> {
  const offers = await prisma.offer.findMany({
    where: { donorId: req.user!.sub, state: "pending" },
    include: { case: { include: { hospital: true } } },
    orderBy: { sentAt: "desc" },
  });

  res.json({
    offers: offers.map((offer) => ({
      id: offer.id,
      state: offer.state,
      sentAt: offer.sentAt,
      // The case has its own deadline; an offer past it is shown as expired rather
      // than with a Yes button that errors after they tap it.
      expired: offer.case.expiresAt < new Date(),
      expiresAt: offer.case.expiresAt,
      ...buildOfferPayload(offer, offer.case),
    })),
  });
}

/**
 * Accept or decline from the dashboard. The service layer is token-addressed (the SMS
 * magic link is the other caller), so ownership is checked here and the offer's own
 * token is handed down — a donor can never act on an offer that is not theirs.
 */
export async function respondToMyOffer(req: Request, res: Response): Promise<void> {
  const offer = await prisma.offer.findUnique({ where: { id: param(req, "id") } });
  if (!offer || offer.donorId !== req.user!.sub) throw new AppError("No such offer", 404);

  if (req.body.action === "decline") {
    await declineOffer(offer.token, req.body.reason);
    res.json({ result: "declined" });
    return;
  }

  const accepted = await acceptOffer(offer.token);
  // §3.6: null means they said yes but the units were already met. Not a failure —
  // the wording matters for whether they answer the next one.
  if (!accepted) {
    res.json({ result: "released", message: "Thank you — this request was already filled." });
    return;
  }
  res.json({ result: "accepted", code: accepted.code });
}
