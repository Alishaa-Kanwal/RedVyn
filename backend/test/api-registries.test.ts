import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { prisma } from "../src/db";
import { signAuthToken } from "../src/lib/jwt";
import { createApp } from "../src/server";
import { createAdminUser } from "../src/services/auth.service";

/**
 * Runs against DATABASE_URL. Every row it creates is tagged with this run's marker and
 * deleted in `after`, so it does not truncate and does not touch seeded or real data.
 */
const TAG = `api-registries-test-${Date.now()}`;
const TAG_PHONE_BASE = parseInt(TAG.slice(-7), 10);
const PASSWORD = "Valid-Pass-1";
const app = createApp();
let adminAuthCookie: string[];

const created = {
  users: [] as string[],
  hospitals: [] as string[],
  donors: [] as string[],
  patients: [] as string[],
};

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

before(async () => {
  adminAuthCookie = await loginCookie();
});

function hospitalPayload(n: number) {
  return {
    name: `${TAG} hospital ${n}`,
    city: TAG,
    lat: 25.4,
    lon: 68.3,
    deskInfo: `${TAG} desk`,
  };
}

function donorPayload(n: number) {
  return {
    firstName: `${TAG}-donor-${n}`,
    phone: `0300${String((TAG_PHONE_BASE + n) % 10_000_000).padStart(7, "0")}`,
    bloodGroup: "B_POS",
    city: TAG,
    lat: 25.4,
    lon: 68.3,
    language: "ur",
  };
}

function patientPayload(hospitalId: string, n: number) {
  return {
    firstName: `${TAG}-patient-${n}`,
    guardianPhone: `0301${String((TAG_PHONE_BASE + n) % 10_000_000).padStart(7, "0")}`,
    bloodGroup: "B_POS",
    homeHospitalId: hospitalId,
    intervalDaysEstimate: 21,
  };
}

describe("GET /api/donors", () => {
  it("returns a paginated list of donors", async () => {
    const cookie = adminAuthCookie;
    const createdDonor = await request(app)
      .post("/api/donors")
      .set("Cookie", cookie)
      .send(donorPayload(1))
      .expect(201);
    created.donors.push(createdDonor.body.donor.id);

    const res = await request(app).get("/api/donors").set("Cookie", cookie).expect(200);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(typeof res.body.pagination.page, "number");
    assert.equal(typeof res.body.pagination.pageSize, "number");
    assert.equal(typeof res.body.pagination.total, "number");
    assert.ok(res.body.pagination.total >= 1);
  });
});

describe("GET /api/donors/:id", () => {
  it("returns a single donor", async () => {
    const cookie = adminAuthCookie;
    const createdDonor = await request(app)
      .post("/api/donors")
      .set("Cookie", cookie)
      .send(donorPayload(2))
      .expect(201);
    const id = createdDonor.body.donor.id;
    created.donors.push(id);

    const res = await request(app).get(`/api/donors/${id}`).set("Cookie", cookie).expect(200);
    assert.equal(res.body.donor.id, id);
    assert.equal(res.body.donor.firstName, `${TAG}-donor-2`);
    assert.equal(res.body.donor.phone, undefined);
  });
});

describe("POST /api/donors", () => {
  it("creates a donor", async () => {
    const cookie = adminAuthCookie;
    const res = await request(app)
      .post("/api/donors")
      .set("Cookie", cookie)
      .send(donorPayload(3))
      .expect(201);
    created.donors.push(res.body.donor.id);
    assert.equal(res.body.donor.firstName, `${TAG}-donor-3`);
    assert.equal(res.body.donor.status, "active");
  });
});

describe("PATCH /api/donors/:id/status", () => {
  it("changes donor status", async () => {
    const cookie = adminAuthCookie;
    const createdDonor = await request(app)
      .post("/api/donors")
      .set("Cookie", cookie)
      .send(donorPayload(4))
      .expect(201);
    const id = createdDonor.body.donor.id;
    created.donors.push(id);

    const res = await request(app)
      .patch(`/api/donors/${id}/status`)
      .set("Cookie", cookie)
      .send({ status: "paused" })
      .expect(200);
    assert.equal(res.body.donor.status, "paused");
  });
});

describe("GET /api/patients", () => {
  it("returns a paginated list of patients", async () => {
    const adminCookie = adminAuthCookie;
    const hospital = await request(app)
      .post("/api/hospitals")
      .set("Cookie", adminCookie)
      .send(hospitalPayload(1))
      .expect(201);
    const hospitalId = hospital.body.hospital.id;
    created.hospitals.push(hospitalId);

    const patient = await request(app)
      .post("/api/patients")
      .set("Cookie", adminCookie)
      .send(patientPayload(hospitalId, 1))
      .expect(201);
    created.patients.push(patient.body.patient.id);

    const res = await request(app).get("/api/patients").set("Cookie", adminCookie).expect(200);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.pagination.pageSize, 20);
    assert.ok(res.body.pagination.total >= 1);
  });
});

describe("GET /api/patients/:id", () => {
  it("returns a single patient", async () => {
    const adminCookie = adminAuthCookie;
    const hospital = await request(app)
      .post("/api/hospitals")
      .set("Cookie", adminCookie)
      .send(hospitalPayload(2))
      .expect(201);
    const hospitalId = hospital.body.hospital.id;
    created.hospitals.push(hospitalId);

    const patient = await request(app)
      .post("/api/patients")
      .set("Cookie", adminCookie)
      .send(patientPayload(hospitalId, 2))
      .expect(201);
    const id = patient.body.patient.id;
    created.patients.push(id);

    const res = await request(app).get(`/api/patients/${id}`).set("Cookie", adminCookie).expect(200);
    assert.equal(res.body.patient.id, id);
    assert.equal(res.body.patient.homeHospital.id, hospitalId);
  });
});

describe("POST /api/patients", () => {
  it("creates a patient", async () => {
    const adminCookie = adminAuthCookie;
    const hospital = await request(app)
      .post("/api/hospitals")
      .set("Cookie", adminCookie)
      .send(hospitalPayload(3))
      .expect(201);
    const hospitalId = hospital.body.hospital.id;
    created.hospitals.push(hospitalId);

    const res = await request(app)
      .post("/api/patients")
      .set("Cookie", adminCookie)
      .send(patientPayload(hospitalId, 3))
      .expect(201);
    created.patients.push(res.body.patient.id);
    assert.equal(res.body.patient.firstName, `${TAG}-patient-3`);
    assert.equal(res.body.patient.status, "active");
  });
});

describe("PATCH /api/patients/:id/status", () => {
  it("changes patient status", async () => {
    const adminCookie = adminAuthCookie;
    const hospital = await request(app)
      .post("/api/hospitals")
      .set("Cookie", adminCookie)
      .send(hospitalPayload(4))
      .expect(201);
    const hospitalId = hospital.body.hospital.id;
    created.hospitals.push(hospitalId);

    const patient = await request(app)
      .post("/api/patients")
      .set("Cookie", adminCookie)
      .send(patientPayload(hospitalId, 4))
      .expect(201);
    const id = patient.body.patient.id;
    created.patients.push(id);

    const res = await request(app)
      .patch(`/api/patients/${id}/status`)
      .set("Cookie", adminCookie)
      .send({ status: "paused" })
      .expect(200);
    assert.equal(res.body.patient.status, "paused");
  });
});

describe("GET /api/hospitals", () => {
  it("returns a paginated list of hospitals", async () => {
    const adminCookie = adminAuthCookie;
    const hospital = await request(app)
      .post("/api/hospitals")
      .set("Cookie", adminCookie)
      .send(hospitalPayload(5))
      .expect(201);
    created.hospitals.push(hospital.body.hospital.id);

    const res = await request(app).get("/api/hospitals").set("Cookie", adminCookie).expect(200);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(typeof res.body.pagination.total, "number");
  });
});

describe("POST /api/hospitals", () => {
  it("is admin-only and creates a hospital", async () => {
    await request(app)
      .post("/api/hospitals")
      .send(hospitalPayload(6))
      .expect(401);

    const res = await request(app)
      .post("/api/hospitals")
      .set("Cookie", adminAuthCookie)
      .send(hospitalPayload(6))
      .expect(201);
    created.hospitals.push(res.body.hospital.id);
    assert.equal(res.body.hospital.city, TAG);
  });
});

describe("POST /api/donors/:id/reveal-phone", () => {
  it("returns the phone only after writing the audit event", async () => {
    const cookie = adminAuthCookie;
    const body = donorPayload(5);
    const createdDonor = await request(app).post("/api/donors").set("Cookie", cookie).send(body).expect(201);
    const id = createdDonor.body.donor.id;
    created.donors.push(id);

    const before = await prisma.event.count({ where: { donorId: id, type: "phone.revealed" } });
    assert.equal(before, 0);

    const res = await request(app).post(`/api/donors/${id}/reveal-phone`).set("Cookie", cookie).expect(200);
    assert.ok(res.body.phone.startsWith("+92"));

    const after = await prisma.event.findFirst({ where: { donorId: id, type: "phone.revealed" } });
    assert.ok(after, "audit event must be written before the phone is returned");
  });
});

describe("Unauthenticated requests", () => {
  it("returns 401 for donor routes", async () => {
    const seed = await prisma.donor.findFirst();
    const id = seed?.id ?? "cju0000000000000000000000";
    await request(app).get("/api/donors").expect(401);
    await request(app).get(`/api/donors/${id}`).expect(401);
    await request(app).post("/api/donors").send(donorPayload(900)).expect(401);
    await request(app).patch(`/api/donors/${id}/status`).send({ status: "paused" }).expect(401);
    await request(app).post(`/api/donors/${id}/reveal-phone`).expect(401);
  });

  it("returns 401 for patient routes", async () => {
    const seed = await prisma.patient.findFirst();
    const id = seed?.id ?? "cju0000000000000000000000";
    await request(app).get("/api/patients").expect(401);
    await request(app).get(`/api/patients/${id}`).expect(401);
    await request(app).post("/api/patients").send(patientPayload(id, 900)).expect(401);
    await request(app).patch(`/api/patients/${id}/status`).send({ status: "paused" }).expect(401);
    await request(app).post(`/api/patients/${id}/reveal-guardian-phone`).expect(401);
  });

  it("returns 401 for admin hospital routes", async () => {
    const seed = await prisma.hospital.findFirst();
    const id = seed?.id ?? "cju0000000000000000000000";
    await request(app).get("/api/hospitals").expect(401);
    await request(app).get(`/api/hospitals/${id}`).expect(401);
    await request(app).post("/api/hospitals").send(hospitalPayload(900)).expect(401);
    await request(app).patch(`/api/hospitals/${id}`).send({ city: TAG }).expect(401);
  });
});

after(async () => {
  await prisma.event.deleteMany({ where: { donorId: { in: created.donors } } });
  for (const patientId of created.patients) {
    await prisma.event.deleteMany({
      where: { payload: { path: ["patientId"], equals: patientId } },
    });
  }
  await prisma.event.deleteMany({ where: { userId: { in: created.users } } });
  await prisma.donation.deleteMany({
    where: { OR: [{ donorId: { in: created.donors } }, { patientId: { in: created.patients } }] },
  });
  await prisma.offer.deleteMany({ where: { donorId: { in: created.donors } } });
  await prisma.case.deleteMany({
    where: { OR: [{ patientId: { in: created.patients } }, { hospitalId: { in: created.hospitals } }] },
  });
  await prisma.patient.deleteMany({ where: { id: { in: created.patients } } });
  await prisma.donor.deleteMany({ where: { id: { in: created.donors } } });
  await prisma.hospital.deleteMany({ where: { id: { in: created.hospitals } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  await prisma.$disconnect();
});
