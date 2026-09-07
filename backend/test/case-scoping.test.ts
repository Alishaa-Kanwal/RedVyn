import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { prisma } from "../src/db";
import { createApp } from "../src/server";
import { registerGuardian, registerHospital } from "../src/services/auth.service";

/**
 * The scoping rules on POST /api/cases. These are the reason case creation could be
 * opened past admin at all: the body names a patient and a hospital, and without
 * resolveCaseScope any logged-in hospital could raise a case against a rival's.
 *
 * Tagged rows only, cleaned up in `after` — no truncation.
 */
const TAG = `case-scoping-test-${Date.now()}`;
const PASSWORD = "Valid-Pass-1";
const app = createApp();

const created = {
  hospitals: [] as string[],
  patients: [] as string[],
  donors: [] as string[],
  guardians: [] as string[],
  cases: [] as string[],
};

let hospitalA: { id: string; cookie: string[] };
let hospitalB: { id: string; cookie: string[] };
let guardian: { cookie: string[]; patientId: string };
let otherPatientId: string;

function getCookies(header: string | string[] | undefined): string[] {
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

async function signin(email: string) {
  const res = await request(app).post("/api/auth/signin").send({ email, password: PASSWORD }).expect(200);
  return getCookies(res.headers["set-cookie"]);
}

async function makeDonor(n: number) {
  const d = await prisma.donor.create({
    data: {
      firstName: `${TAG}-donor-${n}`,
      phoneHash: `hash-${TAG}-${n}`,
      phoneEnc: `enc-${TAG}-${n}`,
      bloodGroup: "B_POS" as never,
      city: TAG,
      lat: 25.4,
      lon: 68.3,
      nextEligibleAt: new Date(Date.now() - 86400_000),
      consentAt: new Date(),
      consentVersion: "v1",
      manageToken: `${TAG}-manage-${n}`,
    },
  });
  created.donors.push(d.id);
  return d;
}

const caseBody = (patientId: string, hospitalId?: string) => ({
  patientId,
  ...(hospitalId ? { hospitalId } : {}),
  type: "scheduled",
  unitsRequired: 1,
  neededAt: new Date(Date.now() + 3600_000).toISOString(),
  window: "10:00-13:00",
});

before(async () => {
  for (let i = 0; i < 12; i++) await makeDonor(i);

  const a = await registerHospital({
    email: `${TAG}-hospital-a@redvyn.local`,
    password: PASSWORD,
    hospital: { name: `${TAG} hospital A`, city: TAG, lat: 25.4, lon: 68.3, deskInfo: `${TAG} desk` },
  });
  const b = await registerHospital({
    email: `${TAG}-hospital-b@redvyn.local`,
    password: PASSWORD,
    hospital: { name: `${TAG} hospital B`, city: TAG, lat: 25.4, lon: 68.3, deskInfo: `${TAG} desk` },
  });
  created.hospitals.push(a.hospital.id, b.hospital.id);

  hospitalA = { id: a.hospital.id, cookie: await signin(`${TAG}-hospital-a@redvyn.local`) };
  hospitalB = { id: b.hospital.id, cookie: await signin(`${TAG}-hospital-b@redvyn.local`) };

  const g = await registerGuardian({
    name: `${TAG} guardian`,
    email: `${TAG}-guardian@redvyn.local`,
    password: PASSWORD,
    patient: {
      firstName: `${TAG}-patient`,
      guardianPhone: `0300${TAG.slice(-7)}`,
      bloodGroup: "B_POS",
      homeHospitalId: hospitalA.id,
      intervalDaysEstimate: 21,
    },
  });
  created.guardians.push(g.guardian.id);
  const guardianPatientId = g.guardian.patients[0]!.id;
  created.patients.push(guardianPatientId);
  guardian = { cookie: await signin(`${TAG}-guardian@redvyn.local`), patientId: guardianPatientId };

  // A patient with no guardian link, used to prove the guardian cannot reach it.
  const other = await prisma.patient.create({
    data: {
      firstName: `${TAG}-other-patient`,
      guardianPhoneHash: `guardian-hash-${TAG}-other`,
      guardianPhoneEnc: `guardian-enc-${TAG}-other`,
      bloodGroup: "B_POS" as never,
      homeHospitalId: hospitalB.id,
      intervalDaysEstimate: 21,
    },
  });
  created.patients.push(other.id);
  otherPatientId = other.id;
});

describe("POST /api/cases scoping", () => {
  it("lets a hospital raise a case, pinned to itself", async () => {
    const res = await request(app)
      .post("/api/cases")
      .set("Cookie", hospitalA.cookie)
      .send(caseBody(guardian.patientId))
      .expect(201);
    created.cases.push(res.body.case.id);
    assert.equal(res.body.case.hospitalId, hospitalA.id);
  });

  it("ignores a hospitalId naming someone else's hospital", async () => {
    const res = await request(app)
      .post("/api/cases")
      .set("Cookie", hospitalA.cookie)
      .send(caseBody(guardian.patientId, hospitalB.id))
      .expect(201);
    created.cases.push(res.body.case.id);
    // The body said hospital B. The caller is hospital A, so the case is A's.
    assert.equal(res.body.case.hospitalId, hospitalA.id);
  });

  it("lets a guardian raise a case for their own patient, defaulting to the home hospital", async () => {
    const res = await request(app)
      .post("/api/cases")
      .set("Cookie", guardian.cookie)
      .send(caseBody(guardian.patientId))
      .expect(201);
    created.cases.push(res.body.case.id);
    assert.equal(res.body.case.patientId, guardian.patientId);
    assert.equal(res.body.case.hospitalId, hospitalA.id);
  });

  it("refuses a guardian raising a case for a patient they are not linked to", async () => {
    await request(app)
      .post("/api/cases")
      .set("Cookie", guardian.cookie)
      .send(caseBody(otherPatientId))
      .expect(403);
  });

  it("refuses a donor entirely", async () => {
    await request(app).post("/api/cases").send(caseBody(guardian.patientId)).expect(401);
  });
});

describe("GET /api/patients/me", () => {
  it("lists the hospital's own patients", async () => {
    const res = await request(app).get("/api/patients/me").set("Cookie", hospitalA.cookie).expect(200);
    const ids = res.body.patients.map((p: { id: string }) => p.id);
    assert.ok(ids.includes(guardian.patientId), "patient homed at A should be listed");
    assert.ok(!ids.includes(otherPatientId), "patient homed at B must not be");
  });

  it("lists the guardian's own patients", async () => {
    const res = await request(app).get("/api/patients/me").set("Cookie", guardian.cookie).expect(200);
    assert.deepEqual(
      res.body.patients.map((p: { id: string }) => p.id),
      [guardian.patientId],
    );
  });

  // Hospital gained email + passwordHash when it became a login entity; the nested
  // homeHospital used to be passed through raw, shipping the hash to every caller.
  it("never returns hospital credentials in the nested homeHospital", async () => {
    const res = await request(app).get("/api/patients/me").set("Cookie", hospitalA.cookie).expect(200);
    assert.ok(res.body.patients.length > 0);
    assert.ok(
      !JSON.stringify(res.body).includes("passwordHash"),
      "patient payload must not carry a password hash",
    );
    for (const p of res.body.patients) {
      assert.ok(!("passwordHash" in p.homeHospital));
      assert.ok(!("email" in p.homeHospital));
      assert.equal(typeof p.homeHospital.name, "string");
    }
  });
});

describe("GET /api/cases/match-preview", () => {
  it("previews the lineup without creating anything or leaking phones", async () => {
    const before = await prisma.case.count();
    const res = await request(app)
      .get(`/api/cases/match-preview?patientId=${guardian.patientId}`)
      .set("Cookie", guardian.cookie)
      .expect(200);

    assert.equal(await prisma.case.count(), before, "preview must not create a case");
    assert.ok(Array.isArray(res.body.matches));
    assert.equal(res.body.hospital.id, hospitalA.id);
    for (const m of res.body.matches) {
      assert.ok(!("phone" in m) && !("phoneEnc" in m) && !("manageToken" in m));
      assert.equal(typeof m.distance, "number");
    }
  });

  it("refuses a preview for a patient the guardian is not linked to", async () => {
    await request(app)
      .get(`/api/cases/match-preview?patientId=${otherPatientId}`)
      .set("Cookie", guardian.cookie)
      .expect(403);
  });
});

describe("POST /api/cases/:id/confirm", () => {
  it("lets the requester close their case with the donor's code, but not the donor", async () => {
    const made = await request(app)
      .post("/api/cases")
      .set("Cookie", hospitalA.cookie)
      .send(caseBody(guardian.patientId))
      .expect(201);
    created.cases.push(made.body.case.id);

    const offer = await prisma.offer.findFirstOrThrow({ where: { caseId: made.body.case.id } });
    const accept = await request(app).post(`/offer/${offer.token}/accept`).expect(200);
    const code = accept.body.code as string;

    // Hospital B has no claim on this case.
    await request(app)
      .post(`/api/cases/${made.body.case.id}/confirm`)
      .set("Cookie", hospitalB.cookie)
      .send({ code })
      .expect(403);

    const res = await request(app)
      .post(`/api/cases/${made.body.case.id}/confirm`)
      .set("Cookie", hospitalA.cookie)
      .send({ code })
      .expect(200);
    assert.equal(res.body.case.state, "closed");
  });
});

after(async () => {
  await prisma.donation.deleteMany({ where: { caseId: { in: created.cases } } });
  await prisma.offer.deleteMany({ where: { caseId: { in: created.cases } } });
  await prisma.event.deleteMany({ where: { caseId: { in: created.cases } } });
  await prisma.case.deleteMany({ where: { id: { in: created.cases } } });
  await prisma.patient.deleteMany({ where: { id: { in: created.patients } } });
  await prisma.guardian.deleteMany({ where: { id: { in: created.guardians } } });
  await prisma.donor.deleteMany({ where: { id: { in: created.donors } } });
  await prisma.hospital.deleteMany({ where: { id: { in: created.hospitals } } });
  await prisma.$disconnect();
});
