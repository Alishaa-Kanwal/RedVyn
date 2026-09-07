import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { prisma } from "../src/db";
import { createApp } from "../src/server";
import { registerDonor, registerGuardian, registerHospital } from "../src/services/auth.service";

/**
 * The registry tabs a hospital now sees, and the self-service profile behind every
 * settings page.
 *
 * Both open surfaces that used to be admin-only, so the tests that matter are the
 * negative ones: a hospital must not be able to read a rival's patients, browse the
 * donor registry at large, or promote itself by PATCHing a field it does not own.
 *
 * Tagged rows only, cleaned up in `after` — no truncation.
 */
const TAG = `registry-scoping-test-${Date.now()}`;
const PASSWORD = "Valid-Pass-1";
const app = createApp();
const startedAt = new Date();

const created = {
  hospitals: [] as string[],
  patients: [] as string[],
  donors: [] as string[],
  guardians: [] as string[],
  cases: [] as string[],
};

let hospitalA: { id: string; cookie: string[] };
let hospitalB: { id: string; cookie: string[] };
let guardianCookie: string[];
let donor: { id: string; cookie: string[] };
let strangerDonorId: string;
let patientA: string;
let patientB: string;
let guardianPatient: string;

function getCookies(header: string | string[] | undefined): string[] {
  return !header ? [] : Array.isArray(header) ? header : [header];
}

async function signin(email: string) {
  const res = await request(app)
    .post("/api/auth/signin")
    .send({ email, password: PASSWORD })
    .expect(200);
  return getCookies(res.headers["set-cookie"]);
}

async function makeHospital(suffix: string) {
  const email = `${TAG}-hospital-${suffix}@redvyn.local`;
  const h = await registerHospital({
    email,
    password: PASSWORD,
    hospital: {
      name: `${TAG} hospital ${suffix}`,
      city: TAG,
      lat: 25.4,
      lon: 68.3,
      deskInfo: `${TAG} desk`,
    },
  });
  created.hospitals.push(h.hospital.id);
  return { id: h.hospital.id, cookie: await signin(email) };
}

/** A bare patient homed at a hospital, with no guardian account attached. */
async function makePatient(name: string, homeHospitalId: string) {
  const p = await prisma.patient.create({
    data: {
      firstName: `${TAG}-${name}`,
      guardianPhoneHash: `guardian-hash-${TAG}-${name}`,
      guardianPhoneEnc: `guardian-enc-${TAG}-${name}`,
      bloodGroup: "B_POS" as never,
      homeHospitalId,
      intervalDaysEstimate: 21,
    },
  });
  created.patients.push(p.id);
  return p.id;
}

before(async () => {
  hospitalA = await makeHospital("a");
  hospitalB = await makeHospital("b");

  patientA = await makePatient("patient-a", hospitalA.id);
  patientB = await makePatient("patient-b", hospitalB.id);

  const g = await registerGuardian({
    name: `${TAG} guardian`,
    email: `${TAG}-guardian@redvyn.local`,
    password: PASSWORD,
    patient: {
      firstName: `${TAG}-guardian-patient`,
      guardianPhone: `0300${TAG.slice(-7)}`,
      bloodGroup: "B_POS",
      homeHospitalId: hospitalA.id,
      intervalDaysEstimate: 21,
    },
  });
  created.guardians.push(g.guardian.id);
  guardianPatient = g.guardian.patients[0]!.id;
  created.patients.push(guardianPatient);
  guardianCookie = await signin(`${TAG}-guardian@redvyn.local`);

  const d = await registerDonor({
    firstName: `${TAG}-donor`,
    phone: `0311${TAG.slice(-7)}`,
    email: `${TAG}-donor@redvyn.local`,
    password: PASSWORD,
    bloodGroup: "B_POS",
    city: TAG,
    lat: 25.4,
    lon: 68.3,
    language: "en",
  });
  created.donors.push(d.donor.id);
  donor = { id: d.donor.id, cookie: await signin(`${TAG}-donor@redvyn.local`) };

  // A donor neither hospital has ever paged.
  const stranger = await prisma.donor.create({
    data: {
      firstName: `${TAG}-stranger`,
      phoneHash: `hash-${TAG}-stranger`,
      phoneEnc: `enc-${TAG}-stranger`,
      bloodGroup: "B_POS" as never,
      city: TAG,
      lat: 25.4,
      lon: 68.3,
      consentAt: new Date(),
      consentVersion: "v1",
      manageToken: `${TAG}-manage-stranger`,
    },
  });
  created.donors.push(stranger.id);
  strangerDonorId = stranger.id;
});

describe("GET /api/patients scoped to the caller", () => {
  it("shows a hospital only the patients homed at it", async () => {
    const res = await request(app)
      .get("/api/patients?pageSize=100")
      .set("Cookie", hospitalA.cookie)
      .expect(200);

    const ids = res.body.data.map((p: { id: string }) => p.id);
    assert.ok(ids.includes(patientA), "hospital A should see its own patient");
    assert.ok(!ids.includes(patientB), "hospital A must not see hospital B's patient");
  });

  it("lets a hospital open a patient it homes, and refuses one it does not", async () => {
    await request(app).get(`/api/patients/${patientA}`).set("Cookie", hospitalA.cookie).expect(200);
    await request(app).get(`/api/patients/${patientB}`).set("Cookie", hospitalA.cookie).expect(403);
  });

  it("shows a guardian only the patients linked to them, and nothing to a donor", async () => {
    await request(app).get("/api/patients").set("Cookie", donor.cookie).expect(403);

    const res = await request(app)
      .get("/api/patients?pageSize=100")
      .set("Cookie", guardianCookie)
      .expect(200);
    const ids = res.body.data.map((p: { id: string }) => p.id);
    assert.deepEqual(ids, [guardianPatient]);
  });

  it("names the guardian on a patient without shipping either account's passwordHash", async () => {
    const res = await request(app)
      .get("/api/patients?pageSize=100")
      .set("Cookie", hospitalA.cookie)
      .expect(200);

    const linked = res.body.data.find((p: { id: string }) => p.id === guardianPatient);
    assert.equal(linked.guardian.name, `${TAG} guardian`);
    assert.equal(linked.guardian.email, `${TAG}-guardian@redvyn.local`);
    // A patient with no guardian account still renders.
    const bare = res.body.data.find((p: { id: string }) => p.id === patientA);
    assert.equal(bare.guardian, undefined);
    assert.ok(!JSON.stringify(res.body).includes("passwordHash"));
  });
});

describe("GET /api/donors scoped to the caller", () => {
  it("shows a hospital nothing until a donor engages with one of its cases", async () => {
    const res = await request(app)
      .get("/api/donors?pageSize=100")
      .set("Cookie", hospitalA.cookie)
      .expect(200);
    const ids = res.body.data.map((d: { id: string }) => d.id);
    assert.ok(!ids.includes(donor.id));
    assert.ok(!ids.includes(strangerDonorId));
  });

  it("shows the donor once they have been offered a case at that hospital", async () => {
    const kase = await prisma.case.create({
      data: {
        patientId: patientA,
        hospitalId: hospitalA.id,
        type: "scheduled" as never,
        bloodGroup: "B_POS" as never,
        unitsRequired: 1,
        slotsRemaining: 1,
        neededAt: new Date(Date.now() + 3600_000),
        window: "10:00-13:00",
        radiusMeters: 5000,
        expiresAt: new Date(Date.now() + 3600_000),
        familyToken: `${TAG}-family`,
      },
    });
    created.cases.push(kase.id);
    await prisma.offer.create({
      data: {
        caseId: kase.id,
        donorId: donor.id,
        role: "primary" as never,
        token: `${TAG}-offer-token`,
      },
    });

    const mine = await request(app)
      .get("/api/donors?pageSize=100")
      .set("Cookie", hospitalA.cookie)
      .expect(200);
    const ids = mine.body.data.map((d: { id: string }) => d.id);
    assert.ok(ids.includes(donor.id), "the paged donor is now hospital A's to see");
    assert.ok(!ids.includes(strangerDonorId), "an unrelated donor still is not");

    // The offer belongs to hospital A. B has no claim on the donor either way.
    const theirs = await request(app)
      .get("/api/donors?pageSize=100")
      .set("Cookie", hospitalB.cookie)
      .expect(200);
    assert.ok(!theirs.body.data.map((d: { id: string }) => d.id).includes(donor.id));

    await request(app).get(`/api/donors/${donor.id}`).set("Cookie", hospitalA.cookie).expect(200);
    await request(app).get(`/api/donors/${donor.id}`).set("Cookie", hospitalB.cookie).expect(403);
    await request(app)
      .get(`/api/donors/${strangerDonorId}`)
      .set("Cookie", hospitalA.cookie)
      .expect(403);
  });

  it("never exposes a phone number through the hospital list", async () => {
    const res = await request(app)
      .get("/api/donors?pageSize=100")
      .set("Cookie", hospitalA.cookie)
      .expect(200);
    assert.ok(!JSON.stringify(res.body).includes("phone"));
    // Reveal stays admin-only regardless of who the donor answered for.
    await request(app)
      .post(`/api/donors/${donor.id}/reveal-phone`)
      .set("Cookie", hospitalA.cookie)
      .expect(403);
  });
});

describe("PATCH /api/auth/profile", () => {
  it("lets a donor correct their own details, phone included", async () => {
    const res = await request(app)
      .patch("/api/auth/profile")
      .set("Cookie", donor.cookie)
      .send({ city: `${TAG}-moved`, phone: "03119998877", status: "paused" })
      .expect(200);

    assert.equal(res.body.profile.city, `${TAG}-moved`);
    // Stored normalised, the same as at registration, so the login hash still matches.
    assert.equal(res.body.profile.phone, "+923119998877");
    assert.equal(res.body.profile.status, "paused");

    // The phone is re-sealed, not stored plaintext, so the hash moved with it.
    const row = await prisma.donor.findUniqueOrThrow({ where: { id: donor.id } });
    assert.notEqual(row.phoneEnc, "+923119998877");
  });

  it("ignores fields outside the caller's schema", async () => {
    const before = await prisma.donor.findUniqueOrThrow({ where: { id: donor.id } });
    await request(app)
      .patch("/api/auth/profile")
      .set("Cookie", donor.cookie)
      .send({ firstName: `${TAG}-renamed`, reliabilityScore: 100, nextEligibleAt: new Date(0) })
      .expect(200);

    const after = await prisma.donor.findUniqueOrThrow({ where: { id: donor.id } });
    assert.equal(after.firstName, `${TAG}-renamed`);
    assert.equal(after.reliabilityScore, before.reliabilityScore);
    assert.equal(after.nextEligibleAt.getTime(), before.nextEligibleAt.getTime());
  });

  it("will not let a hospital verify itself or move its own patients", async () => {
    await request(app)
      .patch("/api/auth/profile")
      .set("Cookie", hospitalA.cookie)
      .send({ verified: true })
      .expect(400); // nothing self-editable in the body at all

    const res = await request(app)
      .patch("/api/auth/profile")
      .set("Cookie", hospitalA.cookie)
      .send({ deskInfo: `${TAG} gate 4`, verified: true })
      .expect(200);

    assert.equal(res.body.profile.deskInfo, `${TAG} gate 4`);
    const row = await prisma.hospital.findUniqueOrThrow({ where: { id: hospitalA.id } });
    assert.equal(row.verified, false, "verification stays an ops decision");
  });

  it("scopes the profile to the signed-in account", async () => {
    const g = await request(app).get("/api/auth/profile").set("Cookie", guardianCookie).expect(200);
    assert.equal(g.body.profile.role, "guardian");
    assert.equal(g.body.profile.name, `${TAG} guardian`);
    // A guardian has no donor fields to leak.
    assert.equal(g.body.profile.phone, undefined);

    await request(app).get("/api/auth/profile").expect(401);
  });
});

after(async () => {
  await prisma.event.deleteMany({
    where: { OR: [{ caseId: { in: created.cases } }, { donorId: { in: created.donors } }] },
  });
  await prisma.event.deleteMany({ where: { type: "profile.updated", at: { gte: startedAt } } });
  await prisma.donation.deleteMany({ where: { caseId: { in: created.cases } } });
  await prisma.offer.deleteMany({ where: { caseId: { in: created.cases } } });
  await prisma.case.deleteMany({ where: { id: { in: created.cases } } });
  await prisma.patient.deleteMany({ where: { id: { in: created.patients } } });
  await prisma.guardian.deleteMany({ where: { id: { in: created.guardians } } });
  await prisma.donor.deleteMany({ where: { id: { in: created.donors } } });
  await prisma.hospital.deleteMany({ where: { id: { in: created.hospitals } } });
  await prisma.$disconnect();
});
