import "dotenv/config";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";
import { prisma } from "../src/db";

import { createApp } from "../src/server";
import { createAdminUser, registerDonor, registerGuardian, registerHospital } from "../src/services/auth.service";

/**
 * Runs against DATABASE_URL. Every row it creates is tagged with this run's marker and
 * deleted in `after`, so it does not truncate and does not touch seeded or real data.
 */
const TAG = `multi-role-auth-test-${Date.now()}`;
const PASSWORD = "Valid-Pass-1";
const app = createApp();

const created = {
  users: [] as string[],
  hospitals: [] as string[],
  patients: [] as string[],
  donors: [] as string[],
  guardians: [] as string[],
  cases: [] as string[],
};

function getCookies(header: string | string[] | undefined): string[] {
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

function testPhone(index: number): string {
  return `0300${String(index).padStart(7, "0")}`;
}

async function loginCookie(email: string, password = PASSWORD) {
  const res = await request(app).post("/api/auth/signin").send({ email, password }).expect(200);
  return getCookies(res.headers["set-cookie"]);
}

describe("Multi-role authentication", () => {
  it("donor can register, login, and call /api/auth/me", async () => {
    const donor = await registerDonor({
      firstName: `${TAG}-donor-1`,
      phone: testPhone(1),
      email: `${TAG}-donor-1@redvyn.local`,
      password: PASSWORD,
      bloodGroup: "B_POS",
      city: TAG,
      lat: 10.0,
      lon: 10.0,
    });
    created.donors.push(donor.donor.id);

    const res = await request(app)
      .post("/api/auth/donor/login")
      .send({ email: donor.donor.email, password: PASSWORD })
      .expect(200);
    assert.equal(res.body.user.role, "donor");
    assert.ok(getCookies(res.headers["set-cookie"]).some((c) => c.startsWith("redvyn_token=")));

    const me = await request(app)
      .get("/api/auth/me")
      .set("Cookie", getCookies(res.headers["set-cookie"]))
      .expect(200);
    assert.equal(me.body.user.role, "donor");
    assert.equal(me.body.user.email, donor.donor.email);
  });

  it("guardian can claim a patient and login", async () => {
    const hospital = await prisma.hospital.create({
      data: { name: `${TAG} hospital`, city: TAG, lat: 10.0, lon: 10.0, deskInfo: `${TAG} desk` },
    });
    created.hospitals.push(hospital.id);

    const patient = await prisma.patient.create({
      data: {
        firstName: `${TAG}-patient`,
        guardianPhoneHash: `guardian-hash-${TAG}`,
        guardianPhoneEnc: `guardian-enc-${TAG}`,
        bloodGroup: "B_POS",
        homeHospitalId: hospital.id,
        intervalDaysEstimate: 21,
      },
    });
    created.patients.push(patient.id);

    const guardian = await registerGuardian({
      patientId: patient.id,
      name: `${TAG} guardian`,
      email: `${TAG}-guardian@redvyn.local`,
      password: PASSWORD,
    });
    created.guardians.push(guardian.guardian.id);

    const res = await request(app)
      .post("/api/auth/guardian/login")
      .send({ email: guardian.guardian.email, password: PASSWORD })
      .expect(200);
    assert.equal(res.body.user.role, "guardian");
    assert.ok(res.body.user.patientIds.includes(patient.id));

    const me = await request(app)
      .get("/api/auth/me")
      .set("Cookie", getCookies(res.headers["set-cookie"]))
      .expect(200);
    assert.equal(me.body.user.role, "guardian");
  });

  it("hospital can claim an admin-created hospital record and login", async () => {
    const hospital = await prisma.hospital.create({
      data: { name: `${TAG}-claimed-hospital`, city: TAG, lat: 10.0, lon: 10.0, deskInfo: `${TAG} desk` },
    });
    created.hospitals.push(hospital.id);

    const claimed = await registerHospital({
      hospitalId: hospital.id,
      email: `${TAG}-hospital@redvyn.local`,
      password: PASSWORD,
    });
    created.hospitals.push(claimed.hospital.id);

    const res = await request(app)
      .post("/api/auth/hospital/login")
      .send({ email: claimed.hospital.email, password: PASSWORD })
      .expect(200);
    assert.equal(res.body.user.role, "hospital");

    const me = await request(app)
      .get("/api/auth/me")
      .set("Cookie", getCookies(res.headers["set-cookie"]))
      .expect(200);
    assert.equal(me.body.user.role, "hospital");
  });
});

describe("Cross-account access is blocked", () => {
  it("donor cannot view another donor's data", async () => {
    const donorA = await registerDonor({
      firstName: `${TAG}-donor-A`,
      phone: testPhone(10),
      email: `${TAG}-donor-A@redvyn.local`,
      password: PASSWORD,
      bloodGroup: "B_POS",
      city: TAG,
      lat: 10.0,
      lon: 10.0,
    });
    created.donors.push(donorA.donor.id);

    const donorB = await registerDonor({
      firstName: `${TAG}-donor-B`,
      phone: testPhone(11),
      email: `${TAG}-donor-B@redvyn.local`,
      password: PASSWORD,
      bloodGroup: "O_POS",
      city: TAG,
      lat: 10.0,
      lon: 10.0,
    });
    created.donors.push(donorB.donor.id);

    const cookieA = await loginCookie(donorA.donor.email!);
    await request(app).get(`/api/donors/${donorB.donor.id}`).set("Cookie", cookieA).expect(403);
    await request(app).get("/api/donors").set("Cookie", cookieA).expect(403);
  });

  it("guardian cannot view an unlinked patient's data", async () => {
    const hospital = await prisma.hospital.create({
      data: { name: `${TAG} guardian hospital`, city: TAG, lat: 10.0, lon: 10.0, deskInfo: `${TAG} desk` },
    });
    created.hospitals.push(hospital.id);

    const linked = await prisma.patient.create({
      data: {
        firstName: `${TAG}-linked`,
        guardianPhoneHash: `linked-hash-${TAG}`,
        guardianPhoneEnc: `linked-enc-${TAG}`,
        bloodGroup: "B_POS",
        homeHospitalId: hospital.id,
        intervalDaysEstimate: 21,
      },
    });
    created.patients.push(linked.id);

    const unlinked = await prisma.patient.create({
      data: {
        firstName: `${TAG}-unlinked`,
        guardianPhoneHash: `unlinked-hash-${TAG}`,
        guardianPhoneEnc: `unlinked-enc-${TAG}`,
        bloodGroup: "O_POS",
        homeHospitalId: hospital.id,
        intervalDaysEstimate: 21,
      },
    });
    created.patients.push(unlinked.id);

    const guardian = await registerGuardian({
      patientId: linked.id,
      name: `${TAG} guardian`,
      email: `${TAG}-guardian-block@redvyn.local`,
      password: PASSWORD,
    });
    created.guardians.push(guardian.guardian.id);

    const cookie = await loginCookie(guardian.guardian.email);
    await request(app).get(`/api/patients/${unlinked.id}`).set("Cookie", cookie).expect(403);

    // The list is open to guardians now (their "My Patients" tab) — scoped, not refused.
    const list = await request(app)
      .get("/api/patients?pageSize=100")
      .set("Cookie", cookie)
      .expect(200);
    const ids = list.body.data.map((p: { id: string }) => p.id);
    assert.ok(ids.includes(linked.id));
    assert.ok(!ids.includes(unlinked.id));
  });

  it("hospital cannot view another hospital's cases", async () => {
    const hospitalA = await prisma.hospital.create({
      data: { name: `${TAG} hospital A`, city: TAG, lat: 10.0, lon: 10.0, deskInfo: `${TAG} desk` },
    });
    created.hospitals.push(hospitalA.id);

    const hospitalB = await prisma.hospital.create({
      data: { name: `${TAG} hospital B`, city: TAG, lat: 10.0, lon: 10.0, deskInfo: `${TAG} desk` },
    });
    created.hospitals.push(hospitalB.id);

    const claimedA = await registerHospital({
      hospitalId: hospitalA.id,
      email: `${TAG}-hospital-A@redvyn.local`,
      password: PASSWORD,
    });
    created.hospitals.push(claimedA.hospital.id);

    const claimedB = await registerHospital({
      hospitalId: hospitalB.id,
      email: `${TAG}-hospital-B@redvyn.local`,
      password: PASSWORD,
    });
    created.hospitals.push(claimedB.hospital.id);

    const cookieA = await loginCookie(claimedA.hospital.email!);
    await request(app).get(`/api/hospitals/${hospitalB.id}`).set("Cookie", cookieA).expect(403);
  });

  it("public roles cannot hit admin-only routes", async () => {
    const donor = await registerDonor({
      firstName: `${TAG}-donor-admin-attempt`,
      phone: testPhone(12),
      email: `${TAG}-donor-admin@redvyn.local`,
      password: PASSWORD,
      bloodGroup: "A_POS",
      city: TAG,
      lat: 10.0,
      lon: 10.0,
    });
    created.donors.push(donor.donor.id);

    const cookie = await loginCookie(donor.donor.email!);
    await request(app).post("/api/auth/admin/users").set("Cookie", cookie).send({
      email: `${TAG}-should-not-create@redvyn.local`,
      password: PASSWORD,
      name: "Should not create",
      role: "admin",
    }).expect(403);

    await request(app).get("/api/hospitals").set("Cookie", cookie).expect(403);
  });
});

after(async () => {
  await prisma.event.deleteMany({
    where: { OR: [{ donorId: { in: created.donors } }, { userId: { in: created.users } }] },
  });
  await prisma.donation.deleteMany({ where: { donorId: { in: created.donors } } });
  await prisma.offer.deleteMany({ where: { donorId: { in: created.donors } } });
  await prisma.case.deleteMany({ where: { hospitalId: { in: created.hospitals } } });
  await prisma.patient.deleteMany({ where: { id: { in: created.patients } } });
  await prisma.guardian.deleteMany({ where: { id: { in: created.guardians } } });
  await prisma.donor.deleteMany({ where: { id: { in: created.donors } } });
  await prisma.hospital.deleteMany({ where: { id: { in: created.hospitals } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  await prisma.$disconnect();
});
