import type { Request, Response } from "express";
import { z } from "zod";
import { param } from "../../lib/http";
import { AppError } from "../../middleware/error";
import {
  canAccessHospital,
  createHospital as createHospitalSvc,
  getHospitalById,
  listHospitals,
  listHospitalsPaginated,
  updateHospital as updateHospitalSvc,
} from "../../services/registry.service";
import { logEvent } from "../../services/event.service";

const coord = z.coerce.number().min(-180).max(180);

export const hospitalSchema = z.object({
  name: z.string().min(1).max(120),
  city: z.string().min(1).max(80),
  lat: coord,
  lon: coord,
  deskInfo: z.string().min(1).max(200),
});

export const hospitalUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  city: z.string().min(1).max(80).optional(),
  lat: coord.optional(),
  lon: coord.optional(),
  deskInfo: z.string().min(1).max(200).optional(),
});

export const hospitalVerifySchema = z.object({
  verified: z.boolean(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  city: z.string().optional(),
  q: z.string().optional(),
});

type Hospital = NonNullable<Awaited<ReturnType<typeof getHospitalById>>>;

function publicHospital(hospital: Hospital) {
  return {
    id: hospital.id,
    name: hospital.name,
    city: hospital.city,
    lat: hospital.lat,
    lon: hospital.lon,
    deskInfo: hospital.deskInfo,
    verified: hospital.verified,
    createdAt: hospital.createdAt,
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

/** Public hospital list used by the guardian signup form. */
export async function getPublicHospitals(_req: Request, res: Response): Promise<void> {
  const hospitals = await listHospitals();
  res.json({ hospitals: hospitals.map(publicHospital) });
}

export async function listHospitalsHandler(req: Request, res: Response): Promise<void> {
  const query = parseListQuery(req);
  const { data, total } = await listHospitalsPaginated(query);
  res.json({
    data: data.map(publicHospital),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  });
}

export async function getHospital(req: Request, res: Response): Promise<void> {
  const id = param(req, "id");
  if (!(await canAccessHospital(id, req.user!.role, req.user!.sub))) {
    throw new AppError("Forbidden", 403);
  }
  const hospital = await getHospitalById(id);
  if (!hospital) throw new AppError("No such hospital", 404);
  res.json({ hospital: publicHospital(hospital) });
}

export async function createHospital(req: Request, res: Response): Promise<void> {
  const hospital = await createHospitalSvc(req.body);
  res.status(201).json({ hospital: publicHospital(hospital) });
}

export async function updateHospital(req: Request, res: Response): Promise<void> {
  const hospital = await updateHospitalSvc(param(req, "id"), req.body);
  res.json({ hospital: publicHospital(hospital) });
}

export async function verifyHospital(req: Request, res: Response): Promise<void> {
  const { verified } = req.body as { verified: boolean };
  const hospital = await updateHospitalSvc(param(req, "id"), { verified });
  await logEvent(verified ? "hospital.verified" : "hospital.unverified", {}, { hospitalId: hospital.id });
  res.json({ hospital: publicHospital(hospital) });
}
