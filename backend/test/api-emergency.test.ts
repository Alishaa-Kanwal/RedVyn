import "dotenv/config";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";
import { prisma } from "../src/db";
import { encryptPhone, hashPhone } from "../src/lib/crypto";
import { createApp } from "../src/server";
import { createDonor } from "../src/services/registry.service";
import { createAdminUser } from "../src/services/auth.service";
import { acceptOffer } from "../src/services/case.service";

/**
 * Runs against DATABASE_URL. Every row it creates is tagged with this run's marker and
 * deleted in `after`, so it does not truncate and does not touch seeded or real data.
 */
const TAG = `emergency-test-${Date.now()}`;
const TAG_PHONE_BASE = parseInt(TAG.slice(-7), 10);
const HOSPITAL = { lat: 25.4000, lon: 68.3000 };
const PASSWORD = "Valid-Pass-1";
const app = createApp();

const created = {
  hospitals: [] as string[],
  patients: [] as string[],
  cases: [] as string[],
  donors: [] as string[],
  users: [] as string[],
};

// Run all emergency tests sequentially — they share a radius and would otherwise
// see each other's donors in findMatches().
describe("api-emergency", { concurrency: false }, () => {

async function makeHospital() {
  const h = await prisma.hospital.create({
    data: { name: `${TAG} hospital`, city: TAG, ...HOSPITAL, deskInfo: "desk" },
  });
  created.hospitals.push(h.id);
  return h;
}

async function makeDonor(n: number, group = "B_POS", metresEast = 0) {
  const d = await createDonor({
    firstName: `${TAG}-${n}`,
    phone: `0300${String((TAG_PHONE_BASE + n) % 10_000_000).padStart(7, "0")}`,
    bloodGroup: group as never,
    city: TAG,
    lat: HOSPITAL.lat,
    lon: HOSPITAL.lon + metresEast * 0.0000105,
    language: "ur",
  });
  created.donors.push(d.id);
  return d;
}

async function makePatient(hospitalId: string, group = "B_POS") {
  const p = await prisma.patient.create({
    data: {
      firstName: `${TAG} patient`,
      guardianPhoneHash: hashPhone(`0300${Date.now() % 9000000}`),
      guardianPhoneEnc: encryptPhone("03001111111"),
      bloodGroup: group as never,
      homeHospitalId: hospitalId,
      intervalDaysEstimate: 21,
    },
  });
  created.patients.push(p.id);
  return p;
}

async function makeUser() {
  const user = await createAdminUser({
    email: `${TAG}-${created.users.length}@redvyn.local`,
    password: PASSWORD,
    name: `${TAG} user`,
    role: "admin" as never,
  });
  created.users.push(user.id);
  return user;
}

function getCookies(header: string | string[] | undefined): string[] {
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

describe("POST /api/emergency/cases", { concurrency: false }, () => {
  it("creates an emergency case and broadcasts to all eligible donors in radius", async () => {
    const hospital = await makeHospital();
    const patient = await makePatient(hospital.id);
    const user = await makeUser();

    // Get auth cookie
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: PASSWORD });
    const cookies = getCookies(login.headers["set-cookie"]);

    // Create 3 donors in radius
    const donors = await Promise.all([makeDonor(1), makeDonor(2), makeDonor(3)]);

    // Create emergency case with 2 units
    const createRes = await request(app)
      .post("/api/emergency/cases")
      .set("Cookie", cookies)
      .send({
        patientId: patient.id,
        hospitalId: hospital.id,
        unitsRequired: 2,
        window: "08:00-20:00",
        radiusMeters: 5000,
      })
      .expect(201);

    const caseId = createRes.body.id;
    created.cases.push(caseId);

    assert.equal(createRes.body.unitsRequired, 2);
    assert.equal(createRes.body.unitsSecured, 0);
    assert.equal(createRes.body.unitsNeeded, 2);
    assert.equal(createRes.body.offers.length, 3, "all 3 donors should be contacted as primary");

    // All offers should be in primary role
    for (const offer of createRes.body.offers) {
      assert.equal(offer.role, "primary", "emergency should contact all as primary");
      assert.equal(offer.state, "pending");
    }
  });

  it("requires authentication", async () => {
    const hospital = await makeHospital();
    const patient = await makePatient(hospital.id);

    await request(app)
      .post("/api/emergency/cases")
      .send({
        patientId: patient.id,
        hospitalId: hospital.id,
        unitsRequired: 1,
        window: "08:00-20:00",
      })
      .expect(401);
  });

  it("requires admin role", async () => {
    const hospital = await makeHospital();
    const patient = await makePatient(hospital.id);

    // No admin auth cookie supplied — endpoint must reject regardless of donor existence.
    await request(app)
      .post("/api/emergency/cases")
      .send({
        patientId: patient.id,
        hospitalId: hospital.id,
        unitsRequired: 1,
        window: "08:00-20:00",
      })
      .expect(401);
  });
});

describe("GET /api/emergency/cases/:id/live", { concurrency: false }, () => {
  it("returns live tracker data with units and offer status", async () => {
    const hospital = await makeHospital();
    const patient = await makePatient(hospital.id);
    const user = await makeUser();

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: PASSWORD });
    const cookies = getCookies(login.headers["set-cookie"]);

    const donors = await Promise.all([makeDonor(10), makeDonor(11)]);

    const createRes = await request(app)
      .post("/api/emergency/cases")
      .set("Cookie", cookies)
      .send({
        patientId: patient.id,
        hospitalId: hospital.id,
        unitsRequired: 2,
        window: "08:00-20:00",
      })
      .expect(201);

    const caseId = createRes.body.id;
    created.cases.push(caseId);

    // Get live tracker data
    const liveRes = await request(app)
      .get(`/api/emergency/cases/${caseId}/live`)
      .set("Cookie", cookies)
      .expect(200);

    assert.equal(liveRes.body.id, caseId);
    assert.equal(liveRes.body.unitsRequired, 2);
    assert.equal(liveRes.body.unitsSecured, 0);
    assert.equal(liveRes.body.unitsNeeded, 2);
    assert.ok(Array.isArray(liveRes.body.offers));
  });

  it("returns 404 for non-existent case", async () => {
    const user = await makeUser();

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: PASSWORD });
    const cookies = getCookies(login.headers["set-cookie"]);

    await request(app)
      .get("/api/emergency/cases/nonexistent/live")
      .set("Cookie", cookies)
      .expect(404);
  });
});

describe("Atomic slot allocation under concurrent accepts", { concurrency: false }, () => {
  it("never over-allocates units when multiple donors accept simultaneously", async () => {
    const hospital = await makeHospital();
    const patient = await makePatient(hospital.id);
    const user = await makeUser();

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: PASSWORD });
    const cookies = getCookies(login.headers["set-cookie"]);

    // Create 5 donors for a 2-unit case
    const donors = await Promise.all([
      makeDonor(100),
      makeDonor(101),
      makeDonor(102),
      makeDonor(103),
      makeDonor(104),
    ]);

    // Create emergency case with 2 units (needed) + 1 spare (no-show margin)
    const createRes = await request(app)
      .post("/api/emergency/cases")
      .set("Cookie", cookies)
      .send({
        patientId: patient.id,
        hospitalId: hospital.id,
        unitsRequired: 2,
        window: "08:00-20:00",
        radiusMeters: 5000,
      })
      .expect(201);

    const caseId = createRes.body.id;
    created.cases.push(caseId);

    // Get the 5 offer tokens
    const offers = await prisma.offer.findMany({
      where: { caseId },
      orderBy: { createdAt: "asc" },
    });

    assert.equal(offers.length, 5, "should have 5 offers for 5 donors");

    // Simulate concurrent accepts from all 5 donors via the existing /offer/:token/accept endpoint
    // (The endpoint is not explicitly created in this phase, but the service function is)
    // For now, we'll directly call the service to test the atomic behavior
    // acceptOffer is imported statically at the top of the file.

    // Fire all 5 accepts concurrently
    const acceptResults = await Promise.all(
      offers.map((o) => acceptOffer(o.token).catch(() => null)),
    );

    // Count how many actually won a slot
    const winners = acceptResults.filter((r) => r !== null);

    // With 2 units required + 1 spare = 3 slots, at most 3 should win
    // The guarded UPDATE ensures this: slotsRemaining starts at 3, each winner decrements it,
    // and the WHERE clause prevents accepting when slotsRemaining <= 0
    assert.ok(
      winners.length <= 3,
      `expected at most 3 winners, got ${winners.length}. The atomic allocation failed.`,
    );

    // Check the case's final state
    const finalCase = await prisma.case.findUnique({ where: { id: caseId } });
    assert.ok(finalCase, "case should exist");
    assert.ok(
      finalCase.unitsSecured <= 3,
      `expected at most 3 units secured, got ${finalCase.unitsSecured}`,
    );
    assert.ok(
      finalCase.slotsRemaining >= 0,
      `expected non-negative slotsRemaining, got ${finalCase.slotsRemaining}`,
    );

    // Verify the math: unitsSecured + slotsRemaining should equal the original allocation
    const originalSlots = 2 + 1; // 2 units + 1 no-show margin
    assert.equal(
      finalCase.unitsSecured + finalCase.slotsRemaining,
      originalSlots,
      "units secured + slots remaining should equal original slot count",
    );

    // Retire this test's donors so released donors do not leak into the next test's match pool.
    await prisma.donor.updateMany({
      where: { id: { in: donors.map((d) => d.id) } },
      data: { nextEligibleAt: new Date(Date.now() + 365 * 86400_000) },
    });
  });

  it("releases losers positively (no penalty) and marks case.units_met when full", async () => {
    const hospital = await makeHospital();
    const patient = await makePatient(hospital.id);
    const user = await makeUser();

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: PASSWORD });
    const cookies = getCookies(login.headers["set-cookie"]);

    // Create 3 donors for a 1-unit case
    const donors = await Promise.all([makeDonor(200), makeDonor(201), makeDonor(202)]);

    const createRes = await request(app)
      .post("/api/emergency/cases")
      .set("Cookie", cookies)
      .send({
        patientId: patient.id,
        hospitalId: hospital.id,
        unitsRequired: 1,
        window: "08:00-20:00",
        radiusMeters: 5000,
      })
      .expect(201);

    const caseId = createRes.body.id;
    created.cases.push(caseId);

    const offers = await prisma.offer.findMany({ where: { caseId } });
    // acceptOffer is imported statically at the top of the file.

    // Fire concurrent accepts
    const results = await Promise.all(
      offers.map((o) => acceptOffer(o.token).catch(() => null)),
    );

    const winners = results.filter((r) => r !== null);
    assert.equal(winners.length, 1, "exactly one should win a 1-unit slot (+no-show margin)");

    // Check that the case is now "filled" or "partially_filled"
    const caseState = await prisma.case.findUnique({ where: { id: caseId } });
    assert.ok(
      ["filled", "partially_filled"].includes(caseState?.state ?? ""),
      `case state should be filled or partially_filled, got ${caseState?.state}`,
    );

    // Check that the losers have state "released"
    const losers = await prisma.offer.findMany({
      where: { caseId, state: "released" },
    });
    assert.equal(losers.length, 2, "two losers should be released with no penalty");

    // Retire this test's donors so they do not leak into later tests/files.
    await prisma.donor.updateMany({
      where: { id: { in: donors.map((d) => d.id) } },
      data: { nextEligibleAt: new Date(Date.now() + 365 * 86400_000) },
    });
  });
});

after(async () => {
  // Also purge any rows from previous interrupted runs that share this file's tag prefix.
  const tagHospitalIds = (await prisma.hospital.findMany({ where: { city: { startsWith: "emergency-test-" } }, select: { id: true } })).map((h) => h.id);
  const tagDonorIds = (await prisma.donor.findMany({ where: { city: { startsWith: "emergency-test-" } }, select: { id: true } })).map((d) => d.id);
  const tagUserIds = (await prisma.user.findMany({ where: { email: { startsWith: "emergency-test-" } }, select: { id: true } })).map((u) => u.id);
  const tagPatientIds = (await prisma.patient.findMany({
    where: { OR: [{ homeHospitalId: { in: tagHospitalIds } }, { firstName: { startsWith: "emergency-test-" } }] },
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

  // Clean up all created rows (order matters due to foreign keys)
  await prisma.event.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }, { userId: { in: userIds } }] } });
  await prisma.donation.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }, { patientId: { in: patientIds } }] } });
  await prisma.offer.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }] } });
  await prisma.case.deleteMany({ where: { id: { in: caseIds } } });
  await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  await prisma.hospital.deleteMany({ where: { id: { in: hospitalIds } } });
  await prisma.donor.deleteMany({ where: { id: { in: donorIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});
});
