import { prisma } from "../db";
import { Prisma } from "../generated/prisma/client";
import type { BloodGroup, CaseState, CaseType, DonorStatus, Language, PatientStatus } from "../generated/prisma/enums";
import { AppError } from "../middleware/error";
import { logEvent } from "./event.service";
import { token } from "./case.service";
import { sealPhone } from "./phone.service";
import type { AuthRole } from "../lib/jwt";

const CONSENT_VERSION = "v1";

export type NewDonor = {
  firstName: string;
  phone: string;
  bloodGroup: BloodGroup;
  city: string;
  lat: number;
  lon: number;
  language: Language;
  lastDonationAt?: Date | null;
};

/** §3.1. Consent is explicit and versioned; manageToken is the web "reply STOP". */
export async function createDonor(input: NewDonor) {
  const sealed = sealPhone(input.phone);
  const existing = await prisma.donor.findUnique({ where: { phoneHash: sealed.phoneHash } });
  if (existing) throw new AppError("A donor with that number is already registered", 409);

  const donor = await prisma.donor.create({
    data: {
      firstName: input.firstName,
      ...sealed,
      bloodGroup: input.bloodGroup,
      city: input.city,
      lat: input.lat,
      lon: input.lon,
      language: input.language,
      lastDonationAt: input.lastDonationAt ?? null,
      // §3.1 written once here, never computed at query time.
      nextEligibleAt: input.lastDonationAt
        ? new Date(input.lastDonationAt.getTime() + 90 * 86400_000)
        : new Date(),
      consentAt: new Date(),
      consentVersion: CONSENT_VERSION,
      manageToken: token(),
    },
  });

  await logEvent("donor.registered", { donorId: donor.id }, { bloodGroup: donor.bloodGroup });
  return donor;
}

export function listDonors() {
  return prisma.donor.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
}

/** The donor-facing opt-out. Revocable consent is a §3.1 requirement, not a nicety. */
export async function optOut(manageToken: string) {
  const donor = await prisma.donor.findUnique({ where: { manageToken } });
  if (!donor) throw new AppError("No such donor", 404);

  await prisma.$transaction([
    prisma.donor.update({ where: { id: donor.id }, data: { status: "opted_out" } }),
    prisma.offer.updateMany({
      where: { donorId: donor.id, state: "pending" },
      data: { state: "released" },
    }),
  ]);

  await logEvent("donor.opted_out", { donorId: donor.id });
  return donor;
}

export async function setDonorStatus(id: string, status: DonorStatus) {
  const donor = await prisma.donor.update({ where: { id }, data: { status } });
  await logEvent("donor.status_changed", { donorId: id }, { status });
  return donor;
}

export type NewPatient = {
  firstName: string;
  guardianPhone: string;
  bloodGroup: BloodGroup;
  homeHospitalId: string;
  intervalDaysEstimate: number;
  lastTransfusionAt?: Date | null;
};

export async function createPatient(input: NewPatient) {
  const sealed = sealPhone(input.guardianPhone);
  const patient = await prisma.patient.create({
    data: {
      firstName: input.firstName,
      guardianPhoneHash: sealed.phoneHash,
      guardianPhoneEnc: sealed.phoneEnc,
      bloodGroup: input.bloodGroup,
      homeHospitalId: input.homeHospitalId,
      intervalDaysEstimate: input.intervalDaysEstimate,
      lastTransfusionAt: input.lastTransfusionAt ?? null,
      predictedNextAt: input.lastTransfusionAt
        ? new Date(input.lastTransfusionAt.getTime() + input.intervalDaysEstimate * 86400_000)
        : null,
    },
  });
  await logEvent("patient.registered", {}, { patientId: patient.id });
  return patient;
}

export function listPatients() {
  return prisma.patient.findMany({
    orderBy: { createdAt: "desc" },
    include: { homeHospital: true },
    take: 200,
  });
}

export function listHospitals() {
  return prisma.hospital.findMany({ orderBy: { name: "asc" } });
}

export async function createHospital(data: {
  name: string;
  city: string;
  lat: number;
  lon: number;
  deskInfo: string;
}) {
  return prisma.hospital.create({ data });
}

export function listCases() {
  return prisma.case.findMany({
    orderBy: { createdAt: "desc" },
    include: { patient: true, hospital: true, offers: { include: { donor: true } } },
    take: 100,
  });
}

export function getCase(id: string) {
  return prisma.case.findUnique({
    where: { id },
    include: {
      patient: true,
      hospital: true,
      offers: { include: { donor: true }, orderBy: { role: "asc" } },
      donations: true,
    },
  });
}

export function recentEvents(limit = 50) {
  return prisma.event.findMany({ orderBy: { at: "desc" }, take: limit });
}

// --- Paginated registry reads for the JSON API (Phase 6) ---------------------

export type DonorFilters = {
  status?: DonorStatus;
  bloodGroup?: BloodGroup;
  city?: string;
  q?: string;
};

export type PatientFilters = {
  status?: PatientStatus;
  bloodGroup?: BloodGroup;
  homeHospitalId?: string;
  q?: string;
};

export type HospitalFilters = {
  city?: string;
  q?: string;
};

export type Pagination = { page: number; pageSize: number };

function buildDonorWhere(filters: DonorFilters): Prisma.DonorWhereInput {
  const where: Prisma.DonorWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.bloodGroup) where.bloodGroup = filters.bloodGroup;
  if (filters.city) where.city = { contains: filters.city, mode: "insensitive" };
  if (filters.q) where.firstName = { contains: filters.q, mode: "insensitive" };
  return where;
}

/**
 * Who each role may see in the donor registry. A hospital sees only donors that have
 * actually engaged with one of its own cases — never the registry at large, which stays
 * admin-only. Single source of truth: canAccessDonor checks membership of this same set.
 */
function donorScopeWhere(role: AuthRole, userId: string): Prisma.DonorWhereInput {
  if (role === "admin") return {};
  if (role === "donor") return { id: userId };
  if (role === "hospital") {
    return {
      OR: [
        { offers: { some: { case: { hospitalId: userId } } } },
        { donations: { some: { case: { hospitalId: userId } } } },
      ],
    };
  }
  return { id: "" };
}

export async function listDonorsPaginatedForUser(
  filters: DonorFilters & Pagination,
  role: AuthRole,
  userId: string,
) {
  const { page, pageSize, ...rest } = filters;
  const base = buildDonorWhere(rest);
  const where: Prisma.DonorWhereInput =
    role === "admin" ? base : { AND: [donorScopeWhere(role, userId), base] };

  const [data, total] = await Promise.all([
    prisma.donor.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.donor.count({ where }),
  ]);
  return { data, total };
}

export function getDonorById(id: string) {
  return prisma.donor.findUnique({ where: { id } });
}

function buildPatientWhere(filters: PatientFilters): Prisma.PatientWhereInput {
  const where: Prisma.PatientWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.bloodGroup) where.bloodGroup = filters.bloodGroup;
  if (filters.homeHospitalId) where.homeHospitalId = filters.homeHospitalId;
  if (filters.q) where.firstName = { contains: filters.q, mode: "insensitive" };
  return where;
}

/** The patient-registry twin of donorScopeWhere: hospital sees its own homed patients,
 *  a guardian sees the patients linked to them. */
function patientScopeWhere(role: AuthRole, userId: string): Prisma.PatientWhereInput {
  if (role === "admin") return {};
  if (role === "hospital") return { homeHospitalId: userId };
  if (role === "guardian") return { guardianId: userId };
  return { id: "" };
}

export async function listPatientsPaginatedForUser(
  filters: PatientFilters & Pagination,
  role: AuthRole,
  userId: string,
) {
  const { page, pageSize, ...rest } = filters;
  const base = buildPatientWhere(rest);
  const where: Prisma.PatientWhereInput =
    role === "admin" ? base : { AND: [patientScopeWhere(role, userId), base] };

  const [data, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { homeHospital: true, guardian: true },
    }),
    prisma.patient.count({ where }),
  ]);
  return { data, total };
}

export function getPatientById(id: string) {
  return prisma.patient.findUnique({
    where: { id },
    include: { homeHospital: true, guardian: true },
  });
}

export async function setPatientStatus(id: string, status: PatientStatus) {
  const patient = await prisma.patient.update({ where: { id }, data: { status } });
  await logEvent("patient.status_changed", {}, { patientId: id, status });
  return patient;
}

function buildHospitalWhere(filters: HospitalFilters): Prisma.HospitalWhereInput {
  const where: Prisma.HospitalWhereInput = {};
  if (filters.city) where.city = { contains: filters.city, mode: "insensitive" };
  if (filters.q) where.name = { contains: filters.q, mode: "insensitive" };
  return where;
}

export async function listHospitalsPaginated(filters: HospitalFilters & Pagination) {
  const { page, pageSize, ...rest } = filters;
  const where = buildHospitalWhere(rest);
  const [data, total] = await Promise.all([
    prisma.hospital.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.hospital.count({ where }),
  ]);
  return { data, total };
}

export function getHospitalById(id: string) {
  return prisma.hospital.findUnique({ where: { id } });
}

export type HospitalUpdate = {
  name?: string;
  city?: string;
  lat?: number;
  lon?: number;
  deskInfo?: string;
  verified?: boolean;
};

export async function updateHospital(id: string, data: HospitalUpdate) {
  return prisma.hospital.update({ where: { id }, data });
}

// --- Paginated case reads for the JSON API (Phase 7) ------------------------

export type CaseFilters = {
  state?: CaseState;
  type?: CaseType;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

const PENDING_REVIEW_CUTOFF_MS = 24 * 3600 * 1000;

function buildCaseWhere(filters: Omit<CaseFilters, "page" | "pageSize">): Prisma.CaseWhereInput {
  const where: Prisma.CaseWhereInput = {};
  if (filters.state) where.state = filters.state;
  if (filters.type) where.type = filters.type;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) where.createdAt.lt = new Date(filters.to);
  }
  return where;
}

export async function listCasesPaginated(filters: CaseFilters) {
  const { page, pageSize, ...rest } = filters;
  const where = buildCaseWhere(rest);
  const [data, total] = await Promise.all([
    prisma.case.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { patient: true, hospital: true },
    }),
    prisma.case.count({ where }),
  ]);
  return { data, total };
}

/**
 * §3.9 pending-review queue: cases where donors accepted (code_issued) but the
 * family/requester has not confirmed the donation, and the expected confirmation
 * window (expiresAt) has been closed for more than 24h.
 */
export async function listPendingReview(pagination: { page: number; pageSize: number }) {
  const { page, pageSize } = pagination;
  const cutoff = new Date(Date.now() - PENDING_REVIEW_CUTOFF_MS);

  const where: Prisma.CaseWhereInput = {
    state: { in: ["filled", "partially_filled"] },
    expiresAt: { lt: cutoff },
    offers: { some: { state: "code_issued" } },
  };

  const [data, total] = await Promise.all([
    prisma.case.findMany({
      where,
      orderBy: { expiresAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { patient: true, hospital: true, offers: { include: { donor: true } } },
    }),
    prisma.case.count({ where }),
  ]);

  return { data, total };
}

/**
 * Event timeline for a case. Event rows carry ids only; names and blood group
 * are joined here at the API layer, never stored in the Event itself.
 */
export async function getCaseTimeline(caseId: string) {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { patient: { select: { id: true, firstName: true, bloodGroup: true } } },
  });
  if (!kase) throw new AppError("No such case", 404);

  const events = await prisma.event.findMany({
    where: { caseId },
    orderBy: { at: "desc" },
  });

  const donorIds = [...new Set(events.map((e) => e.donorId).filter((id): id is string => !!id))];
  const donors = donorIds.length
    ? await prisma.donor.findMany({
        where: { id: { in: donorIds } },
        select: { id: true, firstName: true, bloodGroup: true, city: true },
      })
    : [];
  const donorMap = new Map(donors.map((d) => [d.id, d]));

  return events.map((e) => ({
    id: e.id,
    type: e.type,
    at: e.at,
    payload: e.payload,
    donor: e.donorId ? (donorMap.get(e.donorId) ?? null) : null,
    patient: kase.patient,
  }));
}

// --- Role-scoped reads (Phase 16) ------------------------------------------

export async function canAccessHospital(id: string, role: AuthRole, userId: string): Promise<boolean> {
  if (role === "admin") return true;
  if (role === "hospital") return id === userId;
  return false;
}

export async function canAccessDonor(id: string, role: AuthRole, userId: string): Promise<boolean> {
  if (role === "admin") return true;
  if (role === "donor") return id === userId;
  if (role === "hospital") {
    return (await prisma.donor.count({ where: { AND: [{ id }, donorScopeWhere(role, userId)] } })) > 0;
  }
  return false;
}

export async function canAccessPatient(id: string, role: AuthRole, userId: string): Promise<boolean> {
  if (role === "admin") return true;
  if (role === "guardian" || role === "hospital") {
    return (await prisma.patient.count({ where: { AND: [{ id }, patientScopeWhere(role, userId)] } })) > 0;
  }
  return false;
}

export async function canAccessCase(
  kase: { id: string; hospitalId: string; patientId: string },
  role: AuthRole,
  userId: string,
): Promise<boolean> {
  if (role === "admin") return true;
  if (role === "hospital") return kase.hospitalId === userId;
  if (role === "guardian") {
    const guardian = await prisma.guardian.findUnique({
      where: { id: userId },
      include: { patients: { where: { id: kase.patientId }, select: { id: true } } },
    });
    return Boolean(guardian && guardian.patients.length > 0);
  }
  if (role === "donor") {
    const [offer, donation] = await Promise.all([
      prisma.offer.findFirst({ where: { caseId: kase.id, donorId: userId } }),
      prisma.donation.findFirst({ where: { caseId: kase.id, donorId: userId } }),
    ]);
    return Boolean(offer || donation);
  }
  return false;
}

function caseScopeWhere(role: AuthRole, userId: string): Prisma.CaseWhereInput {
  if (role === "admin") return {};
  if (role === "hospital") return { hospitalId: userId };
  if (role === "guardian") return { patient: { guardianId: userId } };
  if (role === "donor") {
    return {
      OR: [{ offers: { some: { donorId: userId } } }, { donations: { some: { donorId: userId } } }],
    };
  }
  return { id: "" };
}

export async function getDonorHistory(donorId: string) {
  const [offers, donations] = await Promise.all([
    prisma.offer.findMany({
      where: { donorId },
      include: { case: { include: { patient: { select: { id: true, firstName: true, bloodGroup: true } }, hospital: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.donation.findMany({
      where: { donorId },
      include: { case: { include: { patient: { select: { id: true, firstName: true, bloodGroup: true } }, hospital: true } } },
      orderBy: { confirmedAt: "desc" },
    }),
  ]);
  return {
    offers: offers.map((offer) => ({
      id: offer.id,
      role: offer.role,
      state: offer.state,
      case: offer.case,
      createdAt: offer.createdAt,
    })),
    donations: donations.map((donation) => ({
      id: donation.id,
      code: donation.code,
      confirmedAt: donation.confirmedAt,
      case: donation.case,
    })),
  };
}

export async function listCasesPaginatedForUser(filters: CaseFilters, role: AuthRole, userId: string) {
  const { page, pageSize, ...rest } = filters;
  const scope = caseScopeWhere(role, userId);
  const base = buildCaseWhere(rest);
  const where: Prisma.CaseWhereInput =
    role === "admin" ? base : { AND: [scope, base] };

  const [data, total] = await Promise.all([
    prisma.case.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { patient: true, hospital: true, offers: { include: { donor: true } } },
    }),
    prisma.case.count({ where }),
  ]);
  return { data, total };
}
