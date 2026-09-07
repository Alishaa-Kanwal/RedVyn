import type { Request, Response } from "express";
import { z } from "zod";
import { CaseType, OfferState } from "../../generated/prisma/enums";
import { haversineMeters } from "../../lib/blood";
import { param } from "../../lib/http";
import { AppError } from "../../middleware/error";
import { createCase as createCaseSvc } from "../../services/case.service";
import { getCase } from "../../services/registry.service";

const createEmergencyCaseSchema = z.object({
  patientId: z.string().min(1),
  hospitalId: z.string().min(1),
  unitsRequired: z.coerce.number().int().min(1).max(10),
  window: z.string().min(1).max(40),
  radiusMeters: z.coerce.number().int().min(1000).max(50000).default(5000),
});

type CaseWithPatientHospital = NonNullable<Awaited<ReturnType<typeof getCase>>>;

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

function publicPatient(patient: CaseWithPatientHospital["patient"]) {
  return {
    id: patient.id,
    firstName: patient.firstName,
    bloodGroup: patient.bloodGroup,
  };
}

function publicOffer(offer: CaseWithPatientHospital["offers"][number], hospital: CaseWithPatientHospital["hospital"]) {
  const donor = offer.donor;
  const meters = haversineMeters(hospital.lat, hospital.lon, donor.lat, donor.lon);
  return {
    id: offer.id,
    role: offer.role,
    state: offer.state,
    donor: {
      id: donor.id,
      firstName: donor.firstName,
      bloodGroup: donor.bloodGroup,
      reliabilityScore: donor.reliabilityScore,
    },
    distance: Number((meters / 1000).toFixed(2)),
    respondedAt: offer.respondedAt,
  };
}

function liveTrackerResponse(kase: CaseWithPatientHospital) {
  return {
    id: kase.id,
    state: kase.state,
    bloodGroup: kase.bloodGroup,
    unitsRequired: kase.unitsRequired,
    unitsSecured: kase.unitsSecured,
    unitsNeeded: kase.unitsRequired - kase.unitsSecured,
    radiusMeters: kase.radiusMeters,
    offers: kase.offers.map((o) => publicOffer(o, kase.hospital)),
    hospital: publicHospital(kase.hospital),
    patient: publicPatient(kase.patient),
    createdAt: kase.createdAt,
    neededAt: kase.neededAt,
  };
}

/**
 * POST /api/emergency/cases
 * Create an emergency case with parallel broadcast to all eligible donors in radius.
 * All donors are contacted as primary (emergency behavior).
 */
export async function postCreateEmergencyCase(req: Request, res: Response) {
  const parsed = createEmergencyCaseSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AppError(`${first?.path.join(".") ?? "body"}: ${first?.message}`);
  }

  const { patientId, hospitalId, unitsRequired, window, radiusMeters } = parsed.data;

  // The neededAt is now (emergency case)
  const neededAt = new Date();

  const kase = await createCaseSvc({
    patientId,
    hospitalId,
    type: CaseType.emergency, // Emergency broadcast to all as primary
    unitsRequired,
    neededAt,
    window,
    radiusMeters,
  });

  // Fetch with all relations for the live tracker response
  const full = await getCase(kase.id);
  if (!full) throw new AppError("Failed to fetch created case", 500);

  res.status(201).json(liveTrackerResponse(full));
}

/**
 * GET /api/emergency/cases/:id/live
 * Return the live tracker data: units needed/secured + each donor's offer status.
 * Maps 1:1 to real CaseState/offer-status enums.
 */
export async function getEmergencyCaseLive(req: Request, res: Response) {
  const id = param(req, "id");
  const kase = await getCase(id);
  if (!kase) throw new AppError("No such case", 404);

  res.json(liveTrackerResponse(kase));
}
