import type { Request, Response } from "express";
import { z } from "zod";
import { CaseState, CaseType } from "../../generated/prisma/enums";
import { haversineMeters, label } from "../../lib/blood";
import { param } from "../../lib/http";
import { AppError } from "../../middleware/error";
import {
  confirmDonation as confirmDonationSvc,
  createCase as createCaseSvc,
  promoteStandby as promoteStandbySvc,
} from "../../services/case.service";
import { findMatches } from "../../services/matching.service";
import { prisma } from "../../db";
import {
  canAccessCase,
  canAccessPatient,
  getCase,
  getCaseTimeline,
  listCasesPaginatedForUser,
  listPendingReview,
} from "../../services/registry.service";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  state: z.nativeEnum(CaseState).optional(),
  type: z.nativeEnum(CaseType).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const confirmDonationSchema = z.object({ code: z.string().min(3).max(12) });

export const matchPreviewSchema = z.object({
  patientId: z.string().min(1),
  hospitalId: z.string().min(1).optional(),
  radiusMeters: z.coerce.number().int().min(1000).max(50000).default(5000),
});

export const createCaseSchema = z.object({
  patientId: z.string().min(1),
  hospitalId: z.string().min(1).optional(),
  type: z.nativeEnum(CaseType),
  unitsRequired: z.coerce.number().int().min(1).max(10),
  neededAt: z.coerce.date(),
  window: z.string().min(1).max(40),
  radiusMeters: z.coerce.number().int().min(1000).max(50000).default(5000),
});

function parseListQuery(req: Request) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AppError(`${first?.path.join(".") ?? "query"}: ${first?.message}`);
  }
  return parsed.data;
}

type CaseWithPatientHospital = NonNullable<Awaited<ReturnType<typeof getCase>>>;

function publicPatient(patient: CaseWithPatientHospital["patient"]) {
  return {
    id: patient.id,
    firstName: patient.firstName,
    bloodGroup: patient.bloodGroup,
  };
}

function publicHospital(hospital: CaseWithPatientHospital["hospital"]) {
  return {
    id: hospital.id,
    name: hospital.name,
    city: hospital.city,
    lat: hospital.lat,
    lon: hospital.lon,
    deskInfo: hospital.deskInfo,
  };
}

function publicDonor(offer: CaseWithPatientHospital["offers"][number]) {
  const donor = offer.donor;
  return {
    id: donor.id,
    firstName: donor.firstName,
    bloodGroup: donor.bloodGroup,
    city: donor.city,
    lat: donor.lat,
    lon: donor.lon,
    reliabilityScore: donor.reliabilityScore,
  };
}

function offerDistance(
  offer: CaseWithPatientHospital["offers"][number],
  hospital: CaseWithPatientHospital["hospital"],
): number {
  const donor = offer.donor;
  const meters = haversineMeters(hospital.lat, hospital.lon, donor.lat, donor.lon);
  return Number((meters / 1000).toFixed(2));
}

function publicOffer(offer: CaseWithPatientHospital["offers"][number], hospital: CaseWithPatientHospital["hospital"]) {
  return {
    id: offer.id,
    role: offer.role,
    state: offer.state,
    code: offer.code,
    donor: publicDonor(offer),
    distance: offerDistance(offer, hospital),
    respondedAt: offer.respondedAt,
    createdAt: offer.createdAt,
  };
}

function publicCase(kase: CaseWithPatientHospital) {
  return {
    id: kase.id,
    patientId: kase.patientId,
    hospitalId: kase.hospitalId,
    type: kase.type,
    bloodGroup: kase.bloodGroup,
    unitsRequired: kase.unitsRequired,
    unitsSecured: kase.unitsSecured,
    slotsRemaining: kase.slotsRemaining,
    state: kase.state,
    neededAt: kase.neededAt,
    window: kase.window,
    expiresAt: kase.expiresAt,
    createdAt: kase.createdAt,
    updatedAt: kase.updatedAt,
    patient: publicPatient(kase.patient),
    hospital: publicHospital(kase.hospital),
  };
}

export async function listCases(req: Request, res: Response): Promise<void> {
  const query = parseListQuery(req);
  const { role, sub } = req.user!;
  const { data, total } = await listCasesPaginatedForUser(query, role, sub);
  res.json({
    data: data.map((kase) => publicCase(kase as unknown as CaseWithPatientHospital)),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  });
}

export async function getCaseDetail(req: Request, res: Response): Promise<void> {
  const kase = await getCase(param(req, "id"));
  if (!kase) throw new AppError("No such case", 404);
  if (!(await canAccessCase(kase, req.user!.role, req.user!.sub))) {
    throw new AppError("Forbidden", 403);
  }

  const offers = kase.offers.map((offer) => publicOffer(offer, kase.hospital));

  res.json({
    case: {
      ...publicCase(kase),
      offers,
    },
  });
}

export async function getTimeline(req: Request, res: Response): Promise<void> {
  const id = param(req, "id");
  const kase = await getCase(id);
  if (!kase) throw new AppError("No such case", 404);
  if (!(await canAccessCase(kase, req.user!.role, req.user!.sub))) {
    throw new AppError("Forbidden", 403);
  }
  const timeline = await getCaseTimeline(id);
  res.json({ timeline });
}

/**
 * Resolves who a case is *for* from the caller's own identity rather than trusting the
 * body. A hospital may only raise cases against itself; a guardian only for a patient
 * they are linked to. Admin is unconstrained. Returns the hospitalId to use.
 *
 * Without this, `requireRole("admin", "hospital", "guardian")` on POST /api/cases would
 * let any logged-in hospital raise a case naming someone else's hospital.
 */
async function resolveCaseScope(
  patientId: string,
  bodyHospitalId: string | undefined,
  role: string,
  userId: string,
): Promise<string> {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new AppError("No such patient", 404);

  if (role === "hospital") return userId;

  if (role === "guardian") {
    if (!(await canAccessPatient(patientId, "guardian", userId))) {
      throw new AppError("Forbidden", 403);
    }
    // A guardian picks from the public hospital list; the patient's home hospital is
    // the default so the common case needs no choice at all.
    return bodyHospitalId ?? patient.homeHospitalId;
  }

  const hospitalId = bodyHospitalId ?? patient.homeHospitalId;
  if (!hospitalId) throw new AppError("hospitalId is required", 400);
  return hospitalId;
}

/** Dry-run the §3.3 match so the requester sees who would be paged before committing. */
export async function matchPreview(req: Request, res: Response): Promise<void> {
  const parsed = matchPreviewSchema.safeParse(req.query);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AppError(`${first?.path.join(".") ?? "query"}: ${first?.message}`);
  }
  const { patientId, hospitalId: bodyHospitalId, radiusMeters } = parsed.data;
  const { role, sub } = req.user!;

  const hospitalId = await resolveCaseScope(patientId, bodyHospitalId, role, sub);
  const [patient, hospital] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId } }),
    prisma.hospital.findUnique({ where: { id: hospitalId } }),
  ]);
  if (!hospital) throw new AppError("No such hospital", 404);

  const matches = await findMatches(
    patient!.bloodGroup,
    hospital.lat,
    hospital.lon,
    radiusMeters,
    8,
  );

  res.json({
    hospital: publicHospital(hospital as CaseWithPatientHospital["hospital"]),
    bloodGroup: patient!.bloodGroup,
    radiusMeters,
    // No phone, no manage token — this is the same donor shape the case detail exposes.
    matches: matches.map((m) => ({
      id: m.id,
      firstName: m.firstName,
      bloodGroup: m.bloodGroup,
      reliabilityScore: m.reliabilityScore,
      distance: Number((m.meters / 1000).toFixed(2)),
    })),
  });
}

export async function createCase(req: Request, res: Response): Promise<void> {
  const { role, sub } = req.user!;
  const hospitalId = await resolveCaseScope(req.body.patientId, req.body.hospitalId, role, sub);
  const kase = await createCaseSvc({ ...req.body, hospitalId });
  const full = await getCase(kase.id);
  if (!full) throw new AppError("Case was not created", 500);
  res.status(201).json({ case: publicCase(full) });
}

/**
 * §3.9 closure from the dashboard. The service is addressed by family token (the SMS
 * link is the other caller), so the token is resolved here from a case the caller can
 * already reach — the same id-plus-ownership shape as the donor offer endpoints.
 *
 * Donors are excluded explicitly: canAccessCase() is true for a donor with an offer on
 * the case, and a donor confirming their own donation would farm reliability score.
 */
export async function confirmDonation(req: Request, res: Response): Promise<void> {
  const { role, sub } = req.user!;
  if (role === "donor") throw new AppError("Forbidden", 403);

  const kase = await getCase(param(req, "id"));
  if (!kase) throw new AppError("No such case", 404);
  if (!(await canAccessCase(kase, role, sub))) throw new AppError("Forbidden", 403);

  const full = await prisma.case.findUnique({ where: { id: kase.id } });
  await confirmDonationSvc(full!.familyToken, req.body.code);

  const fresh = await getCase(kase.id);
  res.json({ case: publicCase(fresh!) });
}

export async function promoteStandby(req: Request, res: Response): Promise<void> {
  const promoted = await promoteStandbySvc(param(req, "id"));
  res.json({ offer: { id: promoted.id, role: promoted.role, state: promoted.state } });
}

export async function pendingReview(req: Request, res: Response): Promise<void> {
  const query = parseListQuery(req);
  const { data, total } = await listPendingReview({ page: query.page, pageSize: query.pageSize });
  res.json({ data, pagination: { page: query.page, pageSize: query.pageSize, total } });
}
