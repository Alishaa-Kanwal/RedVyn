import type { Request, Response } from "express";
import { z } from "zod";
import { Role } from "../../generated/prisma/enums";
import { tokenMaxAgeMs } from "../../lib/jwt";
import { param } from "../../lib/http";
import { AppError } from "../../middleware/error";
import {
  createAdminUser,
  listAdminUsers,
  login,
  loginAny,
  loginDonor,
  loginGuardian,
  loginHospital,
  me,
  getProfile,
  updateProfile,
  registerDonor,
  registerGuardian,
  registerHospital,
  updateAdminUserStatus,
} from "../../services/auth.service";

/**
 * API surface for admin and public-role authentication.
 */

const COOKIE_NAME = "redvyn_token";

export const loginSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
});

export const createAdminUserSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120),
  role: z.literal("admin"),
});

export const donorRegisterSchema = z.object({
  firstName: z.string().min(1).max(80),
  phone: z.string().min(6).max(20),
  email: z.string().min(1).email(),
  password: z.string().min(8),
  bloodGroup: z.enum([
    "A_POS",
    "A_NEG",
    "B_POS",
    "B_NEG",
    "AB_POS",
    "AB_NEG",
    "O_POS",
    "O_NEG",
  ]),
  city: z.string().min(1).max(80),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  language: z.enum(["ur", "en"]).optional(),
});

export const guardianRegisterSchema = z.object({
  patientId: z.string().min(1).optional(),
  name: z.string().min(1).max(120),
  email: z.string().min(1).email(),
  password: z.string().min(8),
  patient: z.object({
    firstName: z.string().min(1).max(80),
    guardianPhone: z.string().min(6).max(20),
    bloodGroup: z.enum(["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"]),
    homeHospitalId: z.string().min(1),
    intervalDaysEstimate: z.coerce.number().int().min(7).max(60).default(21),
  }).optional(),
}).refine((data) => data.patientId || data.patient, {
  message: "Provide either a patientId or patient details",
  path: ["patientId"],
});

export const hospitalRegisterSchema = z.object({
  hospitalId: z.string().min(1).optional(),
  email: z.string().min(1).email(),
  password: z.string().min(8),
  hospital: z.object({
    name: z.string().min(1).max(120),
    city: z.string().min(1).max(80),
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    deskInfo: z.string().min(1).max(200),
  }).optional(),
}).refine((data) => data.hospitalId || data.hospital, {
  message: "Provide either a hospitalId or hospital details",
  path: ["hospitalId"],
});

const unifiedSigninSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).max(20).optional(),
  password: z.string().min(1),
});

function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    maxAge: tokenMaxAgeMs(token),
  });
}

function publicUser(user: { id: string; email: string; name: string; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

function publicDonor(donor: { id: string; email: string | null; firstName: string; bloodGroup: string }) {
  return {
    id: donor.id,
    email: donor.email,
    name: donor.firstName,
    role: "donor",
    bloodGroup: donor.bloodGroup,
  };
}

function publicGuardian(guardian: { id: string; email: string; name: string }, patientIds: string[]) {
  return {
    id: guardian.id,
    email: guardian.email,
    name: guardian.name,
    role: "guardian",
    patientIds,
  };
}

function publicHospital(hospital: { id: string; email: string | null; name: string }) {
  return {
    id: hospital.id,
    email: hospital.email,
    name: hospital.name,
    role: "hospital",
  };
}

function errorStatus(err: unknown) {
  return err instanceof AppError ? err.status : 500;
}

export async function postLogin(req: Request, res: Response): Promise<void> {
  try {
    const { user, token } = await login(req.body.email, req.body.password);
    setAuthCookie(res, token);
    res.json({ user: publicUser(user) });
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Invalid credentials";
    res.status(401).json({ error: message });
  }
}

export async function postSignin(req: Request, res: Response): Promise<void> {
  const parsed = unifiedSigninSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }

  const { email, phone, password } = parsed.data;
  if (!email && !phone) {
    res.status(400).json({ error: "Provide either email or phone" });
    return;
  }

  try {
    const result = await loginAny({ email, phone }, password);
    setAuthCookie(res, result.token);

    if (result.role === "donor") {
      res.json({ user: publicDonor(result.donor) });
    } else if (result.role === "guardian") {
      const patientIds = result.guardian.patients.map((p) => p.id);
      res.json({ user: publicGuardian(result.guardian, patientIds) });
    } else if (result.role === "hospital") {
      res.json({ user: publicHospital(result.hospital) });
    } else {
      res.json({ user: publicUser(result.user) });
    }
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Invalid credentials";
    res.status(401).json({ error: message });
  }
}

export async function postSignup(req: Request, res: Response): Promise<void> {
  const parsed = donorRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }

  try {
    const { donor, token } = await registerDonor(parsed.data);
    setAuthCookie(res, token);
    res.status(201).json({ user: publicDonor(donor) });
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Could not create account";
    res.status(errorStatus(err)).json({ error: message });
  }
}

export async function postDonorRegister(req: Request, res: Response): Promise<void> {
  const parsed = donorRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }

  try {
    const { donor, token } = await registerDonor(parsed.data);
    setAuthCookie(res, token);
    res.status(201).json({ user: publicDonor(donor) });
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Could not create account";
    res.status(errorStatus(err)).json({ error: message });
  }
}

export async function postDonorLogin(req: Request, res: Response): Promise<void> {
  const parsed = unifiedSigninSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }

  try {
    const { donor, token } = await loginDonor({ email: parsed.data.email, phone: parsed.data.phone }, parsed.data.password);
    setAuthCookie(res, token);
    res.json({ user: publicDonor(donor) });
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Invalid credentials";
    res.status(401).json({ error: message });
  }
}

export async function postGuardianRegister(req: Request, res: Response): Promise<void> {
  const parsed = guardianRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }

  try {
    const { guardian, token } = await registerGuardian(parsed.data);
    setAuthCookie(res, token);
    res.status(201).json({ user: publicGuardian(guardian, guardian.patients.map((p) => p.id)) });
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Could not create account";
    res.status(errorStatus(err)).json({ error: message });
  }
}

export async function postGuardianLogin(req: Request, res: Response): Promise<void> {
  const parsed = unifiedSigninSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }

  try {
    const { guardian, token } = await loginGuardian(parsed.data.email!, parsed.data.password);
    setAuthCookie(res, token);
    res.json({ user: publicGuardian(guardian, guardian.patients.map((p) => p.id)) });
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Invalid credentials";
    res.status(401).json({ error: message });
  }
}

export async function postHospitalRegister(req: Request, res: Response): Promise<void> {
  const parsed = hospitalRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }

  try {
    const { hospital, token } = await registerHospital(parsed.data);
    setAuthCookie(res, token);
    res.status(201).json({ user: publicHospital(hospital) });
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Could not create account";
    res.status(errorStatus(err)).json({ error: message });
  }
}

export async function postHospitalLogin(req: Request, res: Response): Promise<void> {
  const parsed = unifiedSigninSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }

  try {
    const { hospital, token } = await loginHospital(parsed.data.email!, parsed.data.password);
    setAuthCookie(res, token);
    res.json({ user: publicHospital(hospital) });
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Invalid credentials";
    res.status(401).json({ error: message });
  }
}

export function postLogout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME);
  res.status(204).end();
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const profile = await me(req.user.role, req.user.sub);
    res.json({ user: profile });
  } catch (err) {
    const status = err instanceof AppError ? err.status : 401;
    res.status(status).json({ error: err instanceof AppError ? err.message : "Unauthorized" });
  }
}

export async function postAdminUser(req: Request, res: Response): Promise<void> {
  const user = await createAdminUser(req.body);
  res.status(201).json({ user: publicUser(user) });
}

export const updateAdminUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export async function getAdminUsers(_req: Request, res: Response): Promise<void> {
  const users = await listAdminUsers();
  res.json({
    data: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
  });
}

export async function patchAdminUserStatus(req: Request, res: Response): Promise<void> {
  const { isActive } = updateAdminUserStatusSchema.parse(req.body);
  const user = await updateAdminUserStatus(param(req, "id"), isActive);
  res.json({ user: publicUser(user) });
}

const ROLES = ["admin", "donor", "guardian", "hospital"] as const;

const PERMISSIONS: Record<typeof ROLES[number], string[]> = {
  admin: [
    "Full user management (list, create, activate/deactivate)",
    "Full hospital registry (create, edit, verify)",
    "Full donor/patient registry (list, create, change status, reveal phone)",
    "Full case lifecycle (create, promote, review pending cases)",
    "Emergency broadcast and live tracker",
    "Audit log access",
    "System settings and user preferences",
  ],
  donor: [
    "View own profile and donation history",
    "Accept/decline offers",
    "Update own user preferences",
  ],
  guardian: [
    "View linked patient cases and details",
    "Confirm donations with family token",
    "Update own user preferences",
  ],
  hospital: [
    "View own hospital record and linked cases",
    "Update own user preferences",
  ],
};

export async function getRoles(_req: Request, res: Response): Promise<void> {
  res.json({
    roles: ROLES.map((role) => ({ role, permissions: PERMISSIONS[role] })),
  });
}

/**
 * Self-service profile. One endpoint, one schema per role: the role comes from the JWT,
 * never the body, so the schema that runs is the one for the account actually signed in.
 * A field absent from these schemas is not self-editable — that is the whole point of
 * listing them rather than passing req.body through.
 */
const lat = z.coerce.number().min(-90).max(90);
const lon = z.coerce.number().min(-180).max(180);

const profileSchemas: Record<string, z.ZodTypeAny> = {
  admin: z.object({ name: z.string().min(1).max(120) }).partial(),
  donor: z
    .object({
      firstName: z.string().min(1).max(80),
      phone: z.string().min(6).max(20),
      city: z.string().min(1).max(80),
      lat,
      lon,
      language: z.enum(["ur", "en"]),
      // Pausing is the dashboard equivalent of "reply STOP" — §3.1 consent is revocable.
      status: z.enum(["active", "paused"]),
    })
    .partial(),
  guardian: z.object({ name: z.string().min(1).max(120) }).partial(),
  hospital: z
    .object({
      name: z.string().min(1).max(120),
      city: z.string().min(1).max(80),
      deskInfo: z.string().min(1).max(300),
      lat,
      lon,
    })
    .partial(),
};

export async function getProfileHandler(req: Request, res: Response): Promise<void> {
  res.json({ profile: await getProfile(req.user!.role, req.user!.sub) });
}

export async function patchProfileHandler(req: Request, res: Response): Promise<void> {
  const parsed = profileSchemas[req.user!.role]!.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AppError(`${first?.path.join(".") ?? "body"}: ${first?.message}`);
  }
  // Drop undefined keys so a partially filled form never blanks an untouched column.
  const data = Object.fromEntries(Object.entries(parsed.data as Record<string, unknown>).filter(([, v]) => v !== undefined));
  if (Object.keys(data).length === 0) throw new AppError("Nothing to update");

  await updateProfile(req.user!.role, req.user!.sub, data);
  res.json({ profile: await getProfile(req.user!.role, req.user!.sub) });
}
