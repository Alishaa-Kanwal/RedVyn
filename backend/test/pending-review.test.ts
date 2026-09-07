import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { prisma } from "../src/db";
import { createApp } from "../src/server";
import { createAdminUser } from "../src/services/auth.service";
import { createCase } from "../src/services/case.service";
import { createDonor } from "../src/services/registry.service";

/**
 * Runs against DATABASE_URL. Every row it creates is tagged with this run's marker and
 * deleted in `after`, so it does not truncate and does not touch seeded or real data.
 */
const TAG = `pending-review-test-${Date.now()}`;
const TAG_PHONE_BASE = parseInt(TAG.slice(-7), 10);
const PASSWORD = "Valid-Pass-1";
const HOSPITAL = { lat: 25.4000, lon: 68.3000 };
const app = createApp();

const created = {
  users: [] as string[],
  hospitals: [] as string[],
  patients: [] as string[],
  cases: [] as string[],
  donors: [] as string[],
};

async function makeAdmin() {
  const user = await createAdminUser({
    email: `${TAG}-${created.users.length}@redvyn.local`,
    password: PASSWORD,
    name: `${TAG} user`,
    role: "admin" as never,
  });
  created.users.push(user.id);
  return user;
}

async function makeHospital() {
  const h = await prisma.hospital.create({
    data: { name: `${TAG} hospital`, city: TAG, ...HOSPITAL, deskInfo: "desk" },
  });
  created.hospitals.push(h.id);
  return h;
}

async function makeDonor(n: number) {
  const d = await createDonor({
    firstName: `${TAG}-${n}`,
    phone: `0300${String((TAG_PHONE_BASE + n) % 10_000_000).padStart(7, "0")}`,
    bloodGroup: "B_POS" as never,
    city: TAG,
    lat: HOSPITAL.lat,
    lon: HOSPITAL.lon,
    language: "ur",
  });
  created.donors.push(d.id);
  return d;
}

async function makePatient(hospitalId: string) {
  const p = await prisma.patient.create({
    data: {
      firstName: `${TAG} patient`,
      guardianPhoneHash: `guardian-hash-${TAG}`,
      guardianPhoneEnc: `guardian-enc-${TAG}`,
      bloodGroup: "B_POS" as never,
      homeHospitalId: hospitalId,
      intervalDaysEstimate: 21,
    },
  });
  created.patients.push(p.id);
  return p;
}

async function loginCookie() {
  const user = await makeAdmin();
  const res = await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD });
  return Array.isArray(res.headers["set-cookie"]) ? res.headers["set-cookie"] : [res.headers["set-cookie"]];
}

let adminCookie: string[];

describe("GET /api/cases/pending-review", { concurrency: false }, () => {
  before(async () => {
    adminCookie = await loginCookie();
  });

  it("returns cases with code_issued offers past the confirmation window", async () => {
    const hospital = await makeHospital();
    const patient = await makePatient(hospital.id);
    const donor = await makeDonor(1);

    const kase = await createCase({
      patientId: patient.id,
      hospitalId: hospital.id,
      type: "scheduled",
      unitsRequired: 1,
      neededAt: new Date(Date.now() + 3600_000),
      window: "10:00-13:00",
    });
    created.cases.push(kase.id);

    // Simulate an accepted-but-unconfirmed donation that expired more than 24h ago.
    const expired = new Date(Date.now() - 48 * 3600_000);
    const offer = await prisma.offer.findFirstOrThrow({ where: { caseId: kase.id } });
    await prisma.offer.update({ where: { id: offer.id }, data: { state: "code_issued", code: "B1234", respondedAt: expired } });
    await prisma.case.update({ where: { id: kase.id }, data: { state: "filled", expiresAt: expired } });

    const res = await request(app).get("/api/cases/pending-review").set("Cookie", adminCookie).expect(200);

    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.some((c: { id: string }) => c.id === kase.id), "pending-review should include the stale unconfirmed case");
    assert.equal(typeof res.body.pagination.total, "number");
  });

  it("does not include cases still inside the 24h confirmation window", async () => {
    const hospital = await makeHospital();
    const patient = await makePatient(hospital.id);
    const donor = await makeDonor(2);

    const kase = await createCase({
      patientId: patient.id,
      hospitalId: hospital.id,
      type: "scheduled",
      unitsRequired: 1,
      neededAt: new Date(Date.now() + 3600_000),
      window: "10:00-13:00",
    });
    created.cases.push(kase.id);

    const recent = new Date(Date.now() - 30 * 60_000); // 30 minutes ago
    const offer = await prisma.offer.findFirstOrThrow({ where: { caseId: kase.id } });
    await prisma.offer.update({ where: { id: offer.id }, data: { state: "code_issued", code: "B1234", respondedAt: recent } });
    await prisma.case.update({ where: { id: kase.id }, data: { state: "filled", expiresAt: recent } });

    const res = await request(app).get("/api/cases/pending-review").set("Cookie", adminCookie).expect(200);
    assert.ok(!res.body.data.some((c: { id: string }) => c.id === kase.id), "recent case should not be pending review");
  });

  it("requires authentication", async () => {
    await request(app).get("/api/cases/pending-review").expect(401);
  });
});

after(async () => {
  const tagHospitalIds = (await prisma.hospital.findMany({ where: { city: { startsWith: "pending-review-test-" } }, select: { id: true } })).map((h) => h.id);
  const tagDonorIds = (await prisma.donor.findMany({ where: { city: { startsWith: "pending-review-test-" } }, select: { id: true } })).map((d) => d.id);
  const tagUserIds = (await prisma.user.findMany({ where: { email: { startsWith: "pending-review-test-" } }, select: { id: true } })).map((u) => u.id);
  const tagPatientIds = (await prisma.patient.findMany({
    where: { OR: [{ homeHospitalId: { in: tagHospitalIds } }, { firstName: { startsWith: "pending-review-test-" } }] },
    select: { id: true },
  })).map((p) => p.id);
  const tagCaseIds = (await prisma.case.findMany({
    where: { OR: [{ patientId: { in: tagPatientIds } }, { hospitalId: { in: tagHospitalIds } }] },
    select: { id: true },
  })).map((c) => c.id);

  const hospitalIds = Array.from(new Set([...created.hospitals, ...tagHospitalIds]));
  const donorIds = Array.from(new Set([...created.donors, ...tagDonorIds]));
  const userIds = Array.from(new Set([...created.users, ...tagUserIds]));
  const patientIds = Array.from(new Set([...created.patients, ...tagPatientIds]));
  const caseIds = Array.from(new Set([...created.cases, ...tagCaseIds]));

  await prisma.event.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }, { userId: { in: userIds } }] } });
  await prisma.offer.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }] } });
  await prisma.donation.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }, { patientId: { in: patientIds } }] } });
  await prisma.case.deleteMany({ where: { id: { in: caseIds } } });
  await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  await prisma.donor.deleteMany({ where: { id: { in: donorIds } } });
  await prisma.hospital.deleteMany({ where: { id: { in: hospitalIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});
