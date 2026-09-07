import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { Role } from "../generated/prisma/enums";
import { decryptPhone, hashPhone, normalisePhone } from "../lib/crypto";
import { sealPhone } from "./phone.service";
import { signAuthToken, type AuthRole } from "../lib/jwt";
import { hashPassword, verifyPassword } from "../lib/password";
import { AppError } from "../middleware/error";
import { logEvent } from "./event.service";
import { createPatient, createHospital } from "./registry.service";

/**
 * Unified authentication and user management.
 *
 * Handles admin (User) as well as self-service Donor, Guardian and Hospital
 * accounts. All password handling is delegated to ../lib/password.ts and all
 * JWT work to ../lib/jwt.ts so this file only contains domain rules.
 */

function token(): string {
  return randomBytes(16).toString("hex");
}

function assertActive(isActive: boolean, id: string, role: AuthRole) {
  if (!isActive) {
    logEvent(`${role}.login_failed`, { donorId: role === "donor" ? id : undefined, userId: role === "admin" ? id : undefined });
    throw new AppError("Invalid credentials", 401);
  }
}

// --- Admin (User) authentication --------------------------------------------

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    await logEvent("auth.login_failed");
    throw new AppError("Invalid credentials", 401);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid || !user.isActive) {
    await logEvent("auth.login_failed", { userId: user.id });
    throw new AppError("Invalid credentials", 401);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await logEvent("auth.login", { userId: user.id });

  const jwt = signAuthToken({
    sub: updated.id,
    role: updated.role as AuthRole,
    name: updated.name,
  });

  return { user: updated, token: jwt };
}

export async function createAdminUser(input: {
  email: string;
  password: string;
  name: string;
  role: Role;
}) {
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      role: input.role,
    },
  });

  await logEvent("user.created", { userId: user.id });

  return user;
}

export async function listAdminUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, createdAt: true, updatedAt: true },
  });
}

export async function updateAdminUserStatus(id: string, isActive: boolean) {
  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
  });

  await logEvent(isActive ? "user.activated" : "user.deactivated", { userId: user.id });

  return user;
}

// --- Donor self-registration / login -----------------------------------------

export type DonorRegistration = {
  firstName: string;
  phone: string;
  email: string;
  password: string;
  bloodGroup: string;
  city: string;
  lat: number;
  lon: number;
  language?: string;
};

export async function registerDonor(input: DonorRegistration) {
  const existingEmail = await prisma.donor.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existingEmail) throw new AppError("An account with this email already exists", 409);

  const sealed = sealPhone(input.phone);
  const existingPhone = await prisma.donor.findUnique({ where: { phoneHash: sealed.phoneHash } });
  if (existingPhone) throw new AppError("An account with this phone number already exists", 409);

  const donor = await prisma.donor.create({
    data: {
      firstName: input.firstName,
      phoneHash: sealed.phoneHash,
      phoneEnc: sealed.phoneEnc,
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.password),
      bloodGroup: input.bloodGroup as never,
      city: input.city,
      lat: input.lat,
      lon: input.lon,
      language: input.language as never ?? "ur",
      consentAt: new Date(),
      consentVersion: "v1",
      manageToken: token(),
    },
  });

  await logEvent("donor.registered", { donorId: donor.id });

  const jwt = signAuthToken({
    sub: donor.id,
    role: "donor",
    name: donor.firstName,
  });

  return { donor, token: jwt };
}

export async function loginDonor(identifier: { email?: string; phone?: string }, password: string) {
  if (!identifier.email && !identifier.phone) {
    throw new AppError("Provide either email or phone", 400);
  }

  let donor = null;
  if (identifier.email) {
    donor = await prisma.donor.findUnique({ where: { email: identifier.email.toLowerCase() } });
  } else if (identifier.phone) {
    const normalised = normalisePhone(identifier.phone);
    donor = await prisma.donor.findUnique({ where: { phoneHash: hashPhone(normalised) } });
  }

  if (!donor) {
    await logEvent("donor.login_failed");
    throw new AppError("Invalid credentials", 401);
  }

  const valid = await verifyPassword(password, donor.passwordHash ?? "");
  if (!valid || !donor.isActive) {
    await logEvent("donor.login_failed", { donorId: donor.id });
    throw new AppError("Invalid credentials", 401);
  }

  const updated = await prisma.donor.update({
    where: { id: donor.id },
    data: { lastLoginAt: new Date() },
  });

  await logEvent("donor.login", { donorId: donor.id });

  const jwt = signAuthToken({
    sub: updated.id,
    role: "donor",
    name: updated.firstName,
  });

  return { donor: updated, token: jwt };
}

// --- Guardian claim / login --------------------------------------------------

export type GuardianRegistration = {
  patientId?: string;
  name: string;
  email: string;
  password: string;
  patient?: {
    firstName: string;
    guardianPhone: string;
    bloodGroup: string;
    homeHospitalId: string;
    intervalDaysEstimate: number;
  };
};

export async function registerGuardian(input: GuardianRegistration) {
  const existingEmail = await prisma.guardian.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existingEmail) throw new AppError("An account with this email already exists", 409);

  let patient;
  if (input.patientId) {
    patient = await prisma.patient.findUnique({
      where: { id: input.patientId },
      include: { guardian: true },
    });
    if (!patient) throw new AppError("No such patient", 404);
    if (patient.guardian) throw new AppError("This patient already has a guardian account", 409);
  } else if (input.patient) {
    patient = await createPatient({
      firstName: input.patient.firstName,
      guardianPhone: input.patient.guardianPhone,
      bloodGroup: input.patient.bloodGroup as never,
      homeHospitalId: input.patient.homeHospitalId,
      intervalDaysEstimate: input.patient.intervalDaysEstimate,
    });
  } else {
    throw new AppError("Provide either a patientId or patient details", 400);
  }

  const guardian = await prisma.guardian.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.password),
      patients: { connect: { id: patient.id } },
    },
  });

  await logEvent("guardian.registered", { donorId: undefined }, { patientId: patient.id, guardianId: guardian.id });

  const guardianWithPatients = await prisma.guardian.findUnique({
    where: { id: guardian.id },
    include: { patients: { select: { id: true } } },
  });
  if (!guardianWithPatients) throw new AppError("Guardian was not created", 500);

  const jwt = signAuthToken({
    sub: guardianWithPatients.id,
    role: "guardian",
    name: guardianWithPatients.name,
  });

  return { guardian: guardianWithPatients, token: jwt };
}

export async function loginGuardian(email: string, password: string) {
  const guardian = await prisma.guardian.findUnique({
    where: { email: email.toLowerCase() },
    include: { patients: { select: { id: true } } },
  });
  if (!guardian) {
    await logEvent("guardian.login_failed");
    throw new AppError("Invalid credentials", 401);
  }

  const valid = await verifyPassword(password, guardian.passwordHash ?? "");
  if (!valid || !guardian.isActive) {
    await logEvent("guardian.login_failed", {}, { guardianId: guardian.id });
    throw new AppError("Invalid credentials", 401);
  }

  const updated = await prisma.guardian.update({
    where: { id: guardian.id },
    data: { lastLoginAt: new Date() },
    include: { patients: { select: { id: true } } },
  });

  await logEvent("guardian.login", {}, { guardianId: guardian.id });

  const jwt = signAuthToken({
    sub: updated.id,
    role: "guardian",
    name: updated.name,
  });

  return { guardian: updated, token: jwt };
}

// --- Hospital claim / login ------------------------------------------------

export type HospitalRegistration = {
  hospitalId?: string;
  email: string;
  password: string;
  hospital?: {
    name: string;
    city: string;
    lat: number;
    lon: number;
    deskInfo: string;
  };
};

export async function registerHospital(input: HospitalRegistration) {
  let hospital;
  if (input.hospitalId) {
    hospital = await prisma.hospital.findUnique({ where: { id: input.hospitalId } });
    if (!hospital) throw new AppError("No such hospital", 404);
    if (hospital.email || hospital.passwordHash) throw new AppError("This hospital has already been claimed", 409);
  } else if (input.hospital) {
    hospital = await createHospital({
      name: input.hospital.name,
      city: input.hospital.city,
      lat: input.hospital.lat,
      lon: input.hospital.lon,
      deskInfo: input.hospital.deskInfo,
    });
  } else {
    throw new AppError("Provide either a hospitalId or hospital details", 400);
  }

  const existingEmail = await prisma.hospital.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existingEmail) throw new AppError("An account with this email already exists", 409);

  const updated = await prisma.hospital.update({
    where: { id: hospital.id },
    data: {
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.password),
    },
  });

  await logEvent("hospital.registered", {}, { hospitalId: hospital.id });

  const jwt = signAuthToken({
    sub: updated.id,
    role: "hospital",
    name: updated.name,
  });

  return { hospital: updated, token: jwt };
}

export async function loginHospital(email: string, password: string) {
  const hospital = await prisma.hospital.findUnique({ where: { email: email.toLowerCase() } });
  if (!hospital) {
    await logEvent("hospital.login_failed");
    throw new AppError("Invalid credentials", 401);
  }

  const valid = await verifyPassword(password, hospital.passwordHash ?? "");
  if (!valid || !hospital.isActive) {
    await logEvent("hospital.login_failed", {}, { hospitalId: hospital.id });
    throw new AppError("Invalid credentials", 401);
  }

  const updated = await prisma.hospital.update({
    where: { id: hospital.id },
    data: { lastLoginAt: new Date() },
  });

  await logEvent("hospital.login", {}, { hospitalId: hospital.id });

  const jwt = signAuthToken({
    sub: updated.id,
    role: "hospital",
    name: updated.name,
  });

  return { hospital: updated, token: jwt };
}

// --- Unified login used by the shared /signin endpoint -----------------------

type AdminLogin = Awaited<ReturnType<typeof login>>;
type DonorLogin = Awaited<ReturnType<typeof loginDonor>>;
type GuardianLogin = Awaited<ReturnType<typeof loginGuardian>>;
type HospitalLogin = Awaited<ReturnType<typeof loginHospital>>;

type LoginResult =
  | { role: "admin"; user: AdminLogin["user"]; token: string }
  | { role: "donor"; donor: DonorLogin["donor"]; token: string }
  | { role: "guardian"; guardian: GuardianLogin["guardian"]; token: string }
  | { role: "hospital"; hospital: HospitalLogin["hospital"]; token: string };

export async function loginAny(identifier: { email?: string; phone?: string }, password: string): Promise<LoginResult> {
  if (!identifier.email && !identifier.phone) {
    throw new AppError("Provide either email or phone", 400);
  }

  // Admin first: their credentials live in User and they may share an email
  // with a public account.
  if (identifier.email) {
    const user = await prisma.user.findUnique({ where: { email: identifier.email.toLowerCase() } });
    if (user) {
      const result = await login(user.email, password);
      return { role: result.user.role as "admin", user: result.user, token: result.token };
    }
  }

  // Donors can log in by email or phone.
  try {
    const result = await loginDonor(identifier, password);
    return { role: "donor", donor: result.donor, token: result.token };
  } catch {
    // fall through to email-only roles
  }

  if (!identifier.email) {
    throw new AppError("Invalid credentials", 401);
  }

  // Guardian or hospital by email
  try {
    const result = await loginGuardian(identifier.email, password);
    return { role: "guardian", guardian: result.guardian, token: result.token };
  } catch {
    // fall through
  }

  try {
    const result = await loginHospital(identifier.email, password);
    return { role: "hospital", hospital: result.hospital, token: result.token };
  } catch {
    // fall through
  }

  throw new AppError("Invalid credentials", 401);
}

// --- Current-user lookup ----------------------------------------------------

export async function me(role: AuthRole, id: string) {
  if (role === "admin") {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !user.isActive) throw new AppError("Unauthorized", 401);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  if (role === "donor") {
    const donor = await prisma.donor.findUnique({ where: { id } });
    if (!donor || !donor.isActive) throw new AppError("Unauthorized", 401);
    return {
      id: donor.id,
      email: donor.email,
      name: donor.firstName,
      role: "donor",
    };
  }

  if (role === "guardian") {
    const guardian = await prisma.guardian.findUnique({
      where: { id },
      include: { patients: { select: { id: true } } },
    });
    if (!guardian || !guardian.isActive) throw new AppError("Unauthorized", 401);
    return {
      id: guardian.id,
      email: guardian.email,
      name: guardian.name,
      role: "guardian",
      patientIds: guardian.patients.map((p) => p.id),
    };
  }

  if (role === "hospital") {
    const hospital = await prisma.hospital.findUnique({ where: { id } });
    if (!hospital || !hospital.isActive) throw new AppError("Unauthorized", 401);
    return {
      id: hospital.id,
      email: hospital.email,
      name: hospital.name,
      role: "hospital",
    };
  }

  throw new AppError("Unauthorized", 401);
}

/**
 * §4.1: the account holder's own editable record. Deliberately narrower than `me` —
 * a donor's own phone is decrypted here so they can correct it, which is why this is a
 * separate call and not part of the hot /auth/me path every dashboard load hits.
 *
 * Nothing that grades or routes an account is returned as editable: reliabilityScore,
 * verified, homeHospitalId, nextEligibleAt and blocked status stay server-owned.
 */
export async function getProfile(role: AuthRole, id: string) {
  if (role === "admin") {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError("No such account", 404);
    return { role, email: user.email, name: user.name };
  }

  if (role === "donor") {
    const donor = await prisma.donor.findUnique({ where: { id } });
    if (!donor) throw new AppError("No such account", 404);
    return {
      role,
      email: donor.email,
      firstName: donor.firstName,
      phone: decryptPhone(donor.phoneEnc),
      bloodGroup: donor.bloodGroup,
      city: donor.city,
      lat: donor.lat,
      lon: donor.lon,
      language: donor.language,
      status: donor.status,
      reliabilityScore: donor.reliabilityScore,
      nextEligibleAt: donor.nextEligibleAt,
    };
  }

  if (role === "guardian") {
    const guardian = await prisma.guardian.findUnique({ where: { id } });
    if (!guardian) throw new AppError("No such account", 404);
    return { role, email: guardian.email, name: guardian.name };
  }

  const hospital = await prisma.hospital.findUnique({ where: { id } });
  if (!hospital) throw new AppError("No such account", 404);
  return {
    role,
    email: hospital.email,
    name: hospital.name,
    city: hospital.city,
    lat: hospital.lat,
    lon: hospital.lon,
    deskInfo: hospital.deskInfo,
    verified: hospital.verified,
  };
}

export async function updateProfile(
  role: AuthRole,
  id: string,
  input: Record<string, unknown>,
): Promise<void> {
  if (role === "admin") {
    await prisma.user.update({ where: { id }, data: input });
  } else if (role === "donor") {
    const donor = await prisma.donor.findUnique({ where: { id } });
    if (!donor) throw new AppError("No such account", 404);
    // A donor may pause and un-pause themselves; only ops lifts a block.
    if (input["status"] && donor.status === "blocked") {
      throw new AppError("This account is blocked — contact the operations team", 403);
    }
    const { phone, ...rest } = input as { phone?: string };
    await prisma.donor.update({
      where: { id },
      data: { ...rest, ...(phone ? sealPhone(phone) : {}) },
    });
  } else if (role === "guardian") {
    await prisma.guardian.update({ where: { id }, data: input });
  } else {
    await prisma.hospital.update({ where: { id }, data: input });
  }
  // Link the event where the schema has a column for it, so the audit log filters work.
  const link = role === "donor" ? { donorId: id } : role === "admin" ? { userId: id } : {};
  await logEvent("profile.updated", link, { role, id, fields: Object.keys(input).join(",") });
}
