import type { Request, Response } from "express";
import { z } from "zod";
import { BloodGroup } from "../../generated/prisma/enums";
import { param } from "../../lib/http";
import { AppError } from "../../middleware/error";
import { prisma } from "../../db";
import { revealGuardianPhone as revealGuardianPhoneSvc } from "../../services/phone.service";
import {
  canAccessPatient,
  createPatient as createPatientSvc,
  getPatientById,
  listPatientsPaginatedForUser,
  setPatientStatus,
} from "../../services/registry.service";

const bloodGroupSchema = z.nativeEnum(BloodGroup);

export const patientSchema = z.object({
  firstName: z.string().min(1).max(80),
  guardianPhone: z.string().min(6).max(20),
  bloodGroup: bloodGroupSchema,
  homeHospitalId: z.string().min(1),
  intervalDaysEstimate: z.coerce.number().int().min(7).max(60),
  lastTransfusionAt: z.string().optional(),
});

export const patientStatusSchema = z.object({
  status: z.enum(["active", "paused", "opted_out", "blocked"]),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["active", "paused", "opted_out", "blocked"]).optional(),
  bloodGroup: bloodGroupSchema.optional(),
  homeHospitalId: z.string().optional(),
  q: z.string().optional(),
});

const date = (s?: string): Date | null => (s ? new Date(s) : null);

type Patient = NonNullable<Awaited<ReturnType<typeof getPatientById>>>;
type PatientShape = Omit<Patient, "homeHospital" | "guardian"> & {
  homeHospital?: Patient["homeHospital"];
  guardian?: Patient["guardian"];
};

/**
 * The nested hospital is projected, not passed through. Hospital became a login entity
 * (email + passwordHash) after this endpoint was written, and `homeHospital: patient.homeHospital`
 * shipped the whole row — hash included — to every caller of this function.
 */
function publicHomeHospital(hospital: Patient["homeHospital"] | undefined) {
  if (!hospital) return undefined;
  return {
    id: hospital.id,
    name: hospital.name,
    city: hospital.city,
    lat: hospital.lat,
    lon: hospital.lon,
    deskInfo: hospital.deskInfo,
    verified: hospital.verified,
  };
}

/** Same projection discipline as the hospital above: Guardian is a login entity, so the
 *  row carries a passwordHash that must never leave with the patient record. */
function publicGuardian(guardian: Patient["guardian"] | undefined) {
  if (!guardian) return undefined;
  return { id: guardian.id, name: guardian.name, email: guardian.email };
}

function publicPatient(patient: PatientShape) {
  return {
    id: patient.id,
    firstName: patient.firstName,
    bloodGroup: patient.bloodGroup,
    condition: patient.condition,
    status: patient.status,
    intervalDaysEstimate: patient.intervalDaysEstimate,
    lastTransfusionAt: patient.lastTransfusionAt,
    predictedNextAt: patient.predictedNextAt,
    homeHospital: publicHomeHospital(patient.homeHospital),
    guardian: publicGuardian(patient.guardian),
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
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

export async function listPatients(req: Request, res: Response): Promise<void> {
  const query = parseListQuery(req);
  const { role, sub } = req.user!;
  const { data, total } = await listPatientsPaginatedForUser(query, role, sub);
  res.json({
    data: data.map(publicPatient),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  });
}

/**
 * The caller's own patients — what they pick from when raising a case. A guardian sees
 * the patients linked to them, a hospital sees the patients homed at it, and admin sees
 * all of them. Same scoping rule as canAccessPatient / resolveCaseScope, in list form.
 */
export async function getMyPatients(req: Request, res: Response): Promise<void> {
  const { role, sub } = req.user!;
  const where =
    role === "admin" ? {} : role === "hospital" ? { homeHospitalId: sub } : { guardianId: sub };

  const patients = await prisma.patient.findMany({
    where,
    include: { homeHospital: true, guardian: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ patients: patients.map(publicPatient) });
}

export async function getPatient(req: Request, res: Response): Promise<void> {
  const id = param(req, "id");
  if (!(await canAccessPatient(id, req.user!.role, req.user!.sub))) {
    throw new AppError("Forbidden", 403);
  }
  const patient = await getPatientById(id);
  if (!patient) throw new AppError("No such patient", 404);
  res.json({ patient: publicPatient(patient) });
}

export async function createPatient(req: Request, res: Response): Promise<void> {
  const patient = await createPatientSvc({
    ...req.body,
    lastTransfusionAt: date(req.body.lastTransfusionAt),
  });
  res.status(201).json({ patient: publicPatient(patient) });
}

export async function updatePatientStatus(req: Request, res: Response): Promise<void> {
  const patient = await setPatientStatus(param(req, "id"), req.body.status);
  res.json({ patient: publicPatient(patient) });
}

export async function revealGuardianPhone(req: Request, res: Response): Promise<void> {
  const phone = await revealGuardianPhoneSvc(param(req, "id"), req.user!.sub);
  res.json({ phone });
}
