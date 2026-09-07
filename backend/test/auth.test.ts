import "dotenv/config";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";
import { prisma } from "../src/db";
import { createApp } from "../src/server";
import { createAdminUser } from "../src/services/auth.service";

/**
 * Runs against DATABASE_URL. Every row it creates is tagged with this run's marker and
 * deleted in `after`, so it does not truncate and does not touch seeded or real data.
 */
const TAG = `auth-test-${Date.now()}`;
const PASSWORD = "Valid-Pass-1";
const app = createApp();

const created = { users: [] as string[] };

function getCookies(header: string | string[] | undefined): string[] {
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

async function makeUser(active = true) {
  const user = await createAdminUser({
    email: `${TAG}-${created.users.length}@redvyn.local`,
    password: PASSWORD,
    name: `${TAG} user`,
    role: "admin" as never,
  });
  created.users.push(user.id);
  if (!active) {
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
  }
  return user;
}

describe("POST /api/auth/login", () => {
  it("sets a redvyn_token cookie on valid credentials", async () => {
    const user = await makeUser();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: PASSWORD })
      .expect(200);

    assert.equal(res.body.user.email, user.email);
    assert.equal(res.body.user.role, "admin");
    assert.equal(res.body.user.passwordHash, undefined);

    const cookie = getCookies(res.headers["set-cookie"]);
    assert.ok(cookie.some((c) => c.startsWith("redvyn_token=")), "expected auth cookie");
  });

  it("returns 401 for the wrong password", async () => {
    const user = await makeUser();
    await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "wrong-password" })
      .expect(401);
  });

  it("blocks inactive users", async () => {
    const user = await makeUser(false);
    await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: PASSWORD })
      .expect(401);
  });
});

describe("POST /api/auth/admin/users", () => {
  it("forbids non-admin users", async () => {
    // No cookie supplied — endpoint must reject.
    await request(app)
      .post("/api/auth/admin/users")
      .send({
        email: `${TAG}-admin-attempt@redvyn.local`,
        password: "Another-Valid-1",
        name: "Should not create",
        role: "admin",
      })
      .expect(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 with no cookie", async () => {
    await request(app).get("/api/auth/me").expect(401);
  });

  it("returns the current user with a valid cookie", async () => {
    const user = await makeUser();

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: PASSWORD });
    const cookie = getCookies(login.headers["set-cookie"]);

    const res = await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
    assert.equal(res.body.user.id, user.id);
    assert.equal(res.body.user.email, user.email);
    assert.equal(res.body.user.role, "admin");
    assert.equal(res.body.user.passwordHash, undefined);
  });
});

after(async () => {
  await prisma.event.deleteMany({ where: { userId: { in: created.users } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  await prisma.$disconnect();
});
