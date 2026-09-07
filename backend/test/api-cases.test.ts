import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { prisma } from "../src/db";
import { Role } from "../src/generated/prisma/enums";
import { createApp } from "../src/server";
import { createAdminUser, registerDonor } from "../src/services/auth.service";

/**
 * Runs against DATABASE_URL. Every row it creates is tagged with this run's marker and
 * deleted in `after`, so it does not truncate and does not touch seeded or real data.
 */
const TAG = `api-cases-test-${Date.now()}`;
const PASSWORD = "Valid-Pass-1";
const app = createApp();

const created = {
  users: [] as string[],
  hospitals: [] as string[],
  patients: [] as string[],
  donors: [] as string[],
  cases: [] as string[],
};

let adminAuthCookie: string[];
let donorAuthCookie: string[];

function getCookies(header: string | string[] | undefined): string[] {
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

async function makeUser(role: Role) {
  const user = await createAdminUser({
    email: `${TAG}-${created.users.length}@redvyn.local`,
    password: PASSWORD,
    name: `${TAG} user`,
    role,
  });
  created.users.push(user.id);
  return user;
}

async function loginCookie(role: Role) {
  const user = await makeUser(role);
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: user.email, password: PASSWORD })
    .expect(200);
  return getCookies(res.headers["set-cookie"]);
}

async function makeHospital(n: number) {
  const h = await prisma.hospital.create({
    data: { name: `${TAG} hospital ${n}`, city: TAG, lat: 25.4, lon: 68.3, deskInfo: `${TAG} desk` },
  });
  created.hospitals.push(h.id);
  return h;
}

async function makeDonor(n: number, group = "B_POS", metresEast = 0) {
  const d = await prisma.donor.create({
    data: {
      firstName: `${TAG}-donor-${n}`,
      phoneHash: `hash-${TAG}-${n}`,
      phoneEnc: `enc-${TAG}-${n}`,
      bloodGroup: group as never,
      city: TAG,
      lat: 25.4,
      lon: 68.3 + metresEast * 0.0000105,
      nextEligibleAt: new Date(Date.now() - 86400_000),
      consentAt: new Date(),
      consentVersion: "v1",
      manageToken: `${TAG}-manage-${n}`,
    },
  });
  created.donors.push(d.id);
  return d;
}

async function makePatient(hospitalId: string, n: number, group = "B_POS") {
  const p = await prisma.patient.create({
    data: {
      firstName: `${TAG}-patient-${n}`,
      guardianPhoneHash: `guardian-hash-${TAG}-${n}`,
      guardianPhoneEnc: `guardian-enc-${TAG}-${n}`,
      bloodGroup: group as never,
      homeHospitalId: hospitalId,
      intervalDaysEstimate: 21,
    },
  });
  created.patients.push(p.id);
  return p;
}

before(async () => {
  adminAuthCookie = await loginCookie(Role.admin);

  const donor = await registerDonor({
    firstName: `${TAG} donor`,
    phone: `0300${TAG.slice(-7)}`,
    email: `${TAG}-donor@redvyn.local`,
    bloodGroup: "B_POS",
    city: TAG,
    lat: 25.4,
    lon: 68.3,
    password: PASSWORD,
  });
  created.donors.push(donor.donor.id);

  const donorLogin = await request(app)
    .post("/api/auth/signin")
    .send({ email: `${TAG}-donor@redvyn.local`, password: PASSWORD })
    .expect(200);
  donorAuthCookie = getCookies(donorLogin.headers["set-cookie"]);
});

describe("GET /api/cases", () => {
  it("returns a paginated list of cases", async () => {
    const h = await makeHospital(1);
    await makeDonor(1);
    const p = await makePatient(h.id, 1);

    const createdCase = await request(app)
      .post("/api/cases")
      .set("Cookie", adminAuthCookie)
      .send({
        patientId: p.id,
        hospitalId: h.id,
        type: "scheduled",
        unitsRequired: 1,
        neededAt: new Date(Date.now() + 3600_000).toISOString(),
        window: "10:00-13:00",
      })
      .expect(201);
    created.cases.push(createdCase.body.case.id);

    const res = await request(app).get("/api/cases").set("Cookie", adminAuthCookie).expect(200);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(typeof res.body.pagination.page, "number");
    assert.equal(typeof res.body.pagination.pageSize, "number");
    assert.equal(typeof res.body.pagination.total, "number");
  });

  it("filters by status and type", async () => {
    const h = await makeHospital(2);
    // Need enough donors that the scheduled case (3) and the emergency case (up to 8)
    // both find eligible donors without exhausting the same pool.
    for (let i = 2; i < 8; i++) await makeDonor(i);
    const p = await makePatient(h.id, 2);

    const scheduled = await request(app)
      .post("/api/cases")
      .set("Cookie", adminAuthCookie)
      .send({
        patientId: p.id,
        hospitalId: h.id,
        type: "scheduled",
        unitsRequired: 1,
        neededAt: new Date(Date.now() + 3600_000).toISOString(),
        window: "10:00-13:00",
      })
      .expect(201);
    created.cases.push(scheduled.body.case.id);

    const emergency = await request(app)
      .post("/api/cases")
      .set("Cookie", adminAuthCookie)
      .send({
        patientId: p.id,
        hospitalId: h.id,
        type: "emergency",
        unitsRequired: 1,
        neededAt: new Date(Date.now() + 3600_000).toISOString(),
        window: "now",
      })
      .expect(201);
    created.cases.push(emergency.body.case.id);

    const byType = await request(app)
      .get("/api/cases?type=emergency")
      .set("Cookie", adminAuthCookie)
      .expect(200);
    assert.ok(byType.body.data.every((c: { type: string }) => c.type === "emergency"));

    const byState = await request(app)
      .get("/api/cases?state=awaiting_response")
      .set("Cookie", adminAuthCookie)
      .expect(200);
    assert.ok(byState.body.data.every((c: { state: string }) => c.state === "awaiting_response"));
  });
});

describe("GET /api/cases/:id", () => {
  it("returns full case detail with offer lineup", async () => {
    const h = await makeHospital(3);
    for (let i = 10; i < 13; i++) await makeDonor(i);
    const p = await makePatient(h.id, 3);

    const createdCase = await request(app)
      .post("/api/cases")
      .set("Cookie", adminAuthCookie)
      .send({
        patientId: p.id,
        hospitalId: h.id,
        type: "scheduled",
        unitsRequired: 1,
        neededAt: new Date(Date.now() + 3600_000).toISOString(),
        window: "10:00-13:00",
      })
      .expect(201);
    const caseId = createdCase.body.case.id;
    created.cases.push(caseId);

    const res = await request(app).get(`/api/cases/${caseId}`).set("Cookie", adminAuthCookie).expect(200);
    assert.equal(res.body.case.id, caseId);
    assert.ok(Array.isArray(res.body.case.offers));
    assert.equal(res.body.case.offers.length, 3);

    const primary = res.body.case.offers.find((o: { role: string }) => o.role === "primary");
    assert.ok(primary, "expected a primary offer");
    assert.ok(primary.donor.id, "offer lineup must include donor id");
    assert.equal(typeof primary.distance, "number");
    assert.ok(["pending", "accepted", "code_issued"].includes(primary.state));
  });
});

describe("GET /api/cases/:id/timeline", () => {
  it("returns real Event rows for the case", async () => {
    const h = await makeHospital(4);
    await makeDonor(20);
    const p = await makePatient(h.id, 4);

    const createdCase = await request(app)
      .post("/api/cases")
      .set("Cookie", adminAuthCookie)
      .send({
        patientId: p.id,
        hospitalId: h.id,
        type: "scheduled",
        unitsRequired: 1,
        neededAt: new Date(Date.now() + 3600_000).toISOString(),
        window: "10:00-13:00",
      })
      .expect(201);
    const caseId = createdCase.body.case.id;
    created.cases.push(caseId);

    const res = await request(app).get(`/api/cases/${caseId}/timeline`).set("Cookie", adminAuthCookie).expect(200);
    assert.ok(Array.isArray(res.body.timeline));
    assert.ok(res.body.timeline.length > 0, "timeline should contain case.created event");
    assert.ok(res.body.timeline.some((e: { type: string }) => e.type === "case.created"));
    assert.ok(res.body.timeline.every((e: { id: string; type: string; at: string }) => e.id && e.type && e.at));
  });
});

describe("POST /api/cases/:id/promote", () => {
  it("promotes a standby to primary", async () => {
    const h = await makeHospital(5);
    for (let i = 30; i < 33; i++) await makeDonor(i);
    const p = await makePatient(h.id, 5);

    const createdCase = await request(app)
      .post("/api/cases")
      .set("Cookie", adminAuthCookie)
      .send({
        patientId: p.id,
        hospitalId: h.id,
        type: "scheduled",
        unitsRequired: 1,
        neededAt: new Date(Date.now() + 3600_000).toISOString(),
        window: "10:00-13:00",
      })
      .expect(201);
    const caseId = createdCase.body.case.id;
    created.cases.push(caseId);

    const before = await request(app).get(`/api/cases/${caseId}`).set("Cookie", adminAuthCookie).expect(200);
    const standby = before.body.case.offers.find((o: { role: string }) => o.role !== "primary");
    assert.ok(standby, "expected a standby to promote");

    const res = await request(app)
      .post(`/api/cases/${caseId}/promote`)
      .set("Cookie", adminAuthCookie)
      .expect(200);
    assert.equal(res.body.offer.role, "primary");
    assert.equal(res.body.offer.id, standby.id);

    const after = await request(app).get(`/api/cases/${caseId}`).set("Cookie", adminAuthCookie).expect(200);
    const promoted = after.body.case.offers.find((o: { id: string }) => o.id === standby.id);
    assert.equal(promoted.role, "primary");
  });
});

describe("Auth and role gates", () => {
  it("returns 401 when not authenticated", async () => {
    await request(app).get("/api/cases").expect(401);
    await request(app).get("/api/cases/cju0000000000000000000000").expect(401);
    await request(app)
      .post("/api/cases")
      .send({ patientId: "x", hospitalId: "y", type: "scheduled", unitsRequired: 1, neededAt: new Date().toISOString(), window: "w" })
      .expect(401);
    await request(app).post("/api/cases/cju0000000000000000000000/promote").expect(401);
  });

  it("returns 403 when a public donor tries to create a case", async () => {
    const h = await makeHospital(6);
    await makeDonor(40);
    const p = await makePatient(h.id, 6);

    await request(app)
      .post("/api/cases")
      .set("Cookie", donorAuthCookie)
      .send({
        patientId: p.id,
        hospitalId: h.id,
        type: "scheduled",
        unitsRequired: 1,
        neededAt: new Date(Date.now() + 3600_000).toISOString(),
        window: "10:00-13:00",
      })
      .expect(403);
  });
});

after(async () => {
  // Also purge any rows from previous interrupted runs that share this file's tag prefix.
  const tagHospitalIds = (await prisma.hospital.findMany({ where: { city: { startsWith: "api-cases-test-" } }, select: { id: true } })).map((h) => h.id);
  const tagDonorIds = (await prisma.donor.findMany({ where: { city: { startsWith: "api-cases-test-" } }, select: { id: true } })).map((d) => d.id);
  const tagUserIds = (await prisma.user.findMany({ where: { email: { startsWith: "api-cases-test-" } }, select: { id: true } })).map((u) => u.id);
  const tagPatientIds = (await prisma.patient.findMany({
    where: { OR: [{ homeHospitalId: { in: tagHospitalIds } }, { firstName: { startsWith: "api-cases-test-" } }] },
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
  await prisma.donation.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }, { patientId: { in: patientIds } }] } });
  await prisma.offer.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }] } });
  await prisma.case.deleteMany({ where: { id: { in: caseIds } } });
  await prisma.donor.deleteMany({ where: { id: { in: donorIds } } });
  await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  await prisma.hospital.deleteMany({ where: { id: { in: hospitalIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});
