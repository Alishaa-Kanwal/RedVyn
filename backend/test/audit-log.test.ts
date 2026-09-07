import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { prisma } from "../src/db";
import { createApp } from "../src/server";
import { createAdminUser, registerDonor } from "../src/services/auth.service";

/**
 * Runs against DATABASE_URL. Every row it creates is tagged with this run's marker and
 * deleted in `after`, so it does not truncate and does not touch seeded or real data.
 */
const TAG = `audit-log-test-${Date.now()}`;
const PASSWORD = "Valid-Pass-1";
const app = createApp();

const created = {
  users: [] as string[],
  events: [] as string[],
  donors: [] as string[],
};

async function makeAdminUser() {
  const user = await createAdminUser({
    email: `${TAG}-${created.users.length}@redvyn.local`,
    password: PASSWORD,
    name: `${TAG} user`,
    role: "admin" as never,
  });
  created.users.push(user.id);
  return user;
}

async function loginAdminCookie() {
  const user = await makeAdminUser();
  const res = await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD });
  return Array.isArray(res.headers["set-cookie"]) ? res.headers["set-cookie"] : [res.headers["set-cookie"]];
}

async function makeDonorAndCookie() {
  const donor = await registerDonor({
    firstName: `${TAG}-donor`,
    phone: `0300${TAG.slice(-7)}`,
    email: `${TAG}-donor@redvyn.local`,
    password: PASSWORD,
    bloodGroup: "B_POS",
    city: TAG,
    lat: 25.4,
    lon: 68.3,
    language: "ur",
  });
  created.donors.push(donor.donor.id);
  const res = await request(app).post("/api/auth/signin").send({ email: `${TAG}-donor@redvyn.local`, password: PASSWORD }).expect(200);
  return Array.isArray(res.headers["set-cookie"]) ? res.headers["set-cookie"] : [res.headers["set-cookie"]];
}

async function makeEvent(type: string, payload?: Record<string, string | number>) {
  const e = await prisma.event.create({
    data: { type, payload: payload ?? {}, userId: created.users[0] },
  });
  created.events.push(e.id);
  return e;
}

let adminCookie: string[];
let donorCookie: string[];

describe("GET /api/audit-log", { concurrency: false }, () => {
  before(async () => {
    adminCookie = await loginAdminCookie();
    donorCookie = await makeDonorAndCookie();
    await makeEvent("auth.login", { source: "test" });
    await makeEvent("donor.registered", { city: "Lahore" });
  });

  it("returns paginated events for an admin", async () => {
    const res = await request(app).get("/api/audit-log").set("Cookie", adminCookie).expect(200);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(typeof res.body.pagination.total, "number");
    assert.ok(res.body.pagination.total >= 2, "should include seeded events");
    assert.ok(res.body.data.every((e: { payload: unknown }) => typeof e.payload === "object"));
  });

  it("filters by event type", async () => {
    const res = await request(app)
      .get("/api/audit-log?type=auth.login")
      .set("Cookie", adminCookie)
      .expect(200);
    assert.ok(res.body.data.every((e: { type: string }) => e.type.toLowerCase().includes("auth.login")));
  });

  it("is admin-only", async () => {
    await request(app).get("/api/audit-log").set("Cookie", donorCookie).expect(403);
  });

  it("requires authentication", async () => {
    await request(app).get("/api/audit-log").expect(401);
  });
});

after(async () => {
  const tagUserIds = (await prisma.user.findMany({ where: { email: { startsWith: "audit-log-test-" } }, select: { id: true } })).map((u) => u.id);
  const userIds = Array.from(new Set([...created.users, ...tagUserIds]));
  await prisma.event.deleteMany({ where: { OR: [{ id: { in: created.events } }, { userId: { in: userIds } }] } });
  await prisma.donor.deleteMany({ where: { id: { in: created.donors } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});
