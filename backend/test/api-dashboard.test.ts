import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { prisma } from "../src/db";
import { createApp } from "../src/server";
import { createAdminUser } from "../src/services/auth.service";

/**
 * Runs against DATABASE_URL. Every row it creates is tagged with this run's marker and
 * deleted in `after`, so it does not truncate and does not touch seeded or real data.
 */
const TAG = `api-dashboard-test-${Date.now()}`;
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

function getCookies(header: string | string[] | undefined): string[] {
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
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

async function loginCookie() {
  const user = await makeUser();
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

async function makeDonor(n: number, group = "B_POS", eligible = true) {
  const d = await prisma.donor.create({
    data: {
      firstName: `${TAG}-donor-${n}`,
      phoneHash: `hash-${TAG}-${n}`,
      phoneEnc: `enc-${TAG}-${n}`,
      bloodGroup: group as never,
      city: TAG,
      lat: 25.4,
      lon: 68.3,
      nextEligibleAt: eligible ? new Date(Date.now() - 86400_000) : new Date(Date.now() + 86400_000),
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

async function makeCase(hospitalId: string, patientId: string, n: number, type: "scheduled" | "emergency") {
  const body = {
    patientId,
    hospitalId,
    type,
    unitsRequired: 1,
    neededAt: new Date(Date.now() + 3600_000).toISOString(),
    window: type === "emergency" ? "now" : "10:00-13:00",
  };
  const res = await request(app).post("/api/cases").set("Cookie", adminAuthCookie).send(body).expect(201);
  created.cases.push(res.body.case.id);
  return res.body.case;
}

before(async () => {
  adminAuthCookie = await loginCookie();
});

describe("GET /api/dashboard/overview", () => {
  it("returns stat counts that include manually-seeded data", async () => {
    const h = await makeHospital(1);
    for (let i = 1; i <= 3; i++) await makeDonor(i, "B_POS", true);
    await makeDonor(4, "B_POS", false);
    const p = await makePatient(h.id, 1);
    await makeCase(h.id, p.id, 1, "scheduled");

    const res = await request(app).get("/api/dashboard/overview").set("Cookie", adminAuthCookie).expect(200);

    assert.equal(typeof res.body.statCards.activeCases, "number");
    assert.equal(typeof res.body.statCards.donorsOnline, "number");
    assert.equal(res.body.statCards.todaysCalls, 0);
    assert.equal(typeof res.body.statCards.livesSupported, "number");

    // We seeded 3 active eligible donors; the dashboard should count at least those.
    assert.ok(res.body.statCards.donorsOnline >= 3, "donorsOnline should count active eligible donors");
  });

  it("returns caseStatus totals that sum to the total case count", async () => {
    const total = await prisma.case.count();
    const res = await request(app).get("/api/dashboard/overview").set("Cookie", adminAuthCookie).expect(200);
    const sum = res.body.caseStatus.reduce((acc: number, item: { value: number }) => acc + item.value, 0);
    assert.equal(sum, total, "caseStatus values should sum to total cases");
    assert.ok(res.body.caseStatus.every((item: { label: string; value: number; color: number }) => item.label && typeof item.value === "number" && item.color));
  });

  it("returns recent activity rows sorted newest first", async () => {
    const h = await makeHospital(2);
    await makeDonor(10);
    const p = await makePatient(h.id, 2);
    await makeCase(h.id, p.id, 2, "scheduled");

    const res = await request(app).get("/api/dashboard/overview").set("Cookie", adminAuthCookie).expect(200);
    assert.ok(Array.isArray(res.body.recentActivity));
    assert.ok(res.body.recentActivity.length > 0);

    for (const item of res.body.recentActivity) {
      assert.ok(item.type);
      assert.ok(item.title);
      assert.ok(item.time);
      assert.ok(typeof item.color === "number");
      assert.ok(item.icon);
    }

    const times = res.body.recentActivity.map((item: { time: string }) => new Date(item.time).getTime());
    for (let i = 1; i < times.length; i++) {
      assert.ok(times[i - 1] >= times[i], "recent activity should be newest first");
    }
  });

  it("returns active emergency broadcasts", async () => {
    const h = await makeHospital(3);
    for (let i = 20; i < 23; i++) await makeDonor(i);
    const p = await makePatient(h.id, 3);
    const emergency = await makeCase(h.id, p.id, 3, "emergency");

    const res = await request(app).get("/api/dashboard/overview").set("Cookie", adminAuthCookie).expect(200);
    assert.ok(Array.isArray(res.body.emergencyBroadcasts));
    assert.ok(res.body.emergencyBroadcasts.some((b: { id: string }) => b.id === emergency.id));
  });

  it("omits avgResponseTime when no timestamp is tracked", async () => {
    const res = await request(app).get("/api/dashboard/overview").set("Cookie", adminAuthCookie).expect(200);
    assert.equal(res.body.avgResponseTime, null);
  });

  it("returns 401 without authentication", async () => {
    await request(app).get("/api/dashboard/overview").expect(401);
  });
});

after(async () => {
  await prisma.donation.deleteMany({ where: { caseId: { in: created.cases } } });
  await prisma.offer.deleteMany({ where: { caseId: { in: created.cases } } });
  await prisma.case.deleteMany({ where: { id: { in: created.cases } } });
  await prisma.event.deleteMany({ where: { caseId: { in: created.cases } } });
  await prisma.event.deleteMany({ where: { donorId: { in: created.donors } } });
  await prisma.event.deleteMany({ where: { userId: { in: created.users } } });
  await prisma.donor.deleteMany({ where: { id: { in: created.donors } } });
  await prisma.patient.deleteMany({ where: { id: { in: created.patients } } });
  await prisma.hospital.deleteMany({ where: { id: { in: created.hospitals } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  await prisma.$disconnect();
});
