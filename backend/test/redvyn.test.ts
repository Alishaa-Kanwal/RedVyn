import "dotenv/config";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "../src/db";
import { compatibleGroups, haversineMeters, label } from "../src/lib/blood";
import { encryptPhone, decryptPhone, hashPhone, normalisePhone } from "../src/lib/crypto";
import {
  acceptOffer,
  confirmDonation,
  createCase,
  declineOffer,
  promoteStandby,
  token,
} from "../src/services/case.service";
import { findMatches } from "../src/services/matching.service";
import { buildOfferPayload } from "../src/services/payload.service";
import { createDonor } from "../src/services/registry.service";

/**
 * Runs against DATABASE_URL. Every row it creates is tagged with this run's marker and
 * deleted in `after`, so it does not truncate and does not touch seeded or real data.
 */
const TAG = `test-${Date.now()}`;
const TAG_PHONE_BASE = parseInt(TAG.slice(-7), 10);
// Deliberately nowhere near the seed data: these tests must not compete with seeded
// Lahore donors for lineup slots, and must not recruit them either.
const HOSPITAL = { lat: 25.4000, lon: 68.3000 };
const created = { hospitals: [] as string[], patients: [] as string[], cases: [] as string[], donors: [] as string[] };

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
    // ~0.0000103 degrees of longitude per metre at this latitude.
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

describe("blood compatibility", () => {
  it("gives a B+ recipient the four groups they can receive", () => {
    assert.deepEqual(compatibleGroups("B_POS").sort(), ["B_NEG", "B_POS", "O_NEG", "O_POS"]);
  });

  it("gives O- only O-, and AB+ everything", () => {
    assert.deepEqual(compatibleGroups("O_NEG"), ["O_NEG"]);
    assert.equal(compatibleGroups("AB_POS").length, 8);
  });

  it("labels groups the way the donation code prints them", () => {
    assert.equal(label("B_POS"), "B+");
    assert.equal(label("O_NEG"), "O-");
  });
});

describe("phone sealing", () => {
  it("normalises Pakistani local form to E.164", () => {
    assert.equal(normalisePhone("0300-1234567"), "+923001234567");
    assert.equal(normalisePhone("+92 300 1234567"), "+923001234567");
  });

  it("round-trips through encryption and hashes deterministically", () => {
    assert.equal(decryptPhone(encryptPhone("03001234567")), "+923001234567");
    assert.equal(hashPhone("0300-1234567"), hashPhone("+923001234567"));
  });

  it("produces a different ciphertext each time, so the column leaks nothing", () => {
    assert.notEqual(encryptPhone("03001234567"), encryptPhone("03001234567"));
  });
});

describe("matching", () => {
  it("agrees with the SQL haversine to within a metre", async () => {
    const h = await makeHospital();
    await makeDonor(1, "B_POS", 2000);
    const p = await makePatient(h.id);

    const matches = await findMatches(p.bloodGroup, h.lat, h.lon, 5000, 10);
    const mine = matches.find((m) => m.firstName === `${TAG}-1`);
    assert.ok(mine, "seeded donor should match");

    const js = haversineMeters(h.lat, h.lon, HOSPITAL.lat, HOSPITAL.lon + 2000 * 0.0000105);
    assert.ok(
      Math.abs(Number(mine.meters) - js) < 1,
      `SQL said ${mine.meters}, JS said ${js} — the two haversines have drifted apart`,
    );
  });

  it("excludes donors outside the radius", async () => {
    const h = await makeHospital();
    await makeDonor(2, "B_POS", 40000);
    const p = await makePatient(h.id);

    const near = await findMatches(p.bloodGroup, h.lat, h.lon, 5000, 10);
    assert.equal(near.find((m) => m.firstName === `${TAG}-2`), undefined);

    const far = await findMatches(p.bloodGroup, h.lat, h.lon, 50000, 10);
    assert.ok(far.find((m) => m.firstName === `${TAG}-2`));
  });

  it("excludes a donor who already holds an open offer", async () => {
    const h = await makeHospital();
    const donor = await makeDonor(3, "B_POS", 100);
    const p = await makePatient(h.id);

    const before = await findMatches(p.bloodGroup, h.lat, h.lon, 5000, 20);
    assert.ok(before.some((m) => m.id === donor.id));

    const kase = await prisma.case.create({
      data: {
        patientId: p.id, hospitalId: h.id, bloodGroup: "B_POS", unitsRequired: 1,
        slotsRemaining: 1, neededAt: new Date(), window: "10:00-13:00",
        // Built straight through prisma, bypassing the service, so expiresAt is ours to set.
        expiresAt: new Date(Date.now() + 86400_000), familyToken: token(),
      },
    });
    created.cases.push(kase.id);
    await prisma.offer.create({
      data: { caseId: kase.id, donorId: donor.id, role: "primary", token: token() },
    });

    const after = await findMatches(p.bloodGroup, h.lat, h.lon, 5000, 20);
    assert.equal(
      after.find((m) => m.id === donor.id),
      undefined,
      "a donor on an open offer must not be recruited onto a second case",
    );
  });
});

describe("privacy boundary", () => {
  it("gives a standby no hospital and no code, whatever the case holds", async () => {
    const h = await makeHospital();
    const payload = buildOfferPayload(
      { role: "standby_1", code: "B+1234" } as never,
      { bloodGroup: "B_POS", neededAt: new Date(), window: "10:00-13:00", unitsRequired: 2, hospital: h } as never,
    );

    assert.equal(payload.kind, "standby");
    const keys = Object.keys(payload);
    for (const leaked of ["hospitalName", "deskInfo", "code", "window"]) {
      assert.ok(!keys.includes(leaked), `standby payload must not carry ${leaked}`);
    }
  });

  it("never carries a patient field in either shape", async () => {
    const h = await makeHospital();
    const kase = { bloodGroup: "B_POS", neededAt: new Date(), window: "w", unitsRequired: 1, hospital: h } as never;
    for (const role of ["primary", "standby_2"]) {
      const keys = Object.keys(buildOfferPayload({ role, code: null } as never, kase));
      assert.ok(!keys.some((k) => k.toLowerCase().includes("patient")));
    }
  });
});

describe("atomic slot allocation", () => {
  it("hands out exactly the available slots when everyone accepts at once", async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    for (let i = 10; i < 18; i++) await makeDonor(i, "B_POS", 100 + i);

    // Emergency: 2 units required, so 3 slots — the §3.6 no-show margin.
    const kase = await createCase({
      patientId: p.id, hospitalId: h.id, type: "emergency", unitsRequired: 2,
      neededAt: new Date(Date.now() + 3600_000), window: "now", radiusMeters: 5000,
    });
    created.cases.push(kase.id);

    const offers = await prisma.offer.findMany({ where: { caseId: kase.id } });
    assert.equal(offers.length, 8, "emergency should broadcast to 8");

    const results = await Promise.all(offers.map((o) => acceptOffer(o.token)));
    const won = results.filter((r) => r !== null);

    assert.equal(won.length, 3, "exactly unitsRequired + 1 acceptances may win");

    const fresh = await prisma.case.findUniqueOrThrow({ where: { id: kase.id } });
    assert.equal(fresh.slotsRemaining, 0);
    assert.equal(fresh.unitsSecured, 3);
    assert.equal(fresh.state, "filled");

    const released = await prisma.offer.count({ where: { caseId: kase.id, state: "released" } });
    assert.equal(released, 5, "everyone who lost the race is released, not left pending");
  });

  it("is idempotent — a donor pressing twice does not consume two slots", async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    for (let i = 20; i < 23; i++) await makeDonor(i, "B_POS", 100 + i);

    const kase = await createCase({
      patientId: p.id, hospitalId: h.id, type: "scheduled", unitsRequired: 2,
      neededAt: new Date(Date.now() + 3600_000), window: "10:00-13:00", radiusMeters: 5000,
    });
    created.cases.push(kase.id);

    const primary = await prisma.offer.findFirstOrThrow({
      where: { caseId: kase.id, role: "primary" },
    });

    const first = await acceptOffer(primary.token);
    const second = await acceptOffer(primary.token);

    assert.ok(first && second);
    assert.equal(first.code, second.code, "the second press returns the same code");

    const fresh = await prisma.case.findUniqueOrThrow({ where: { id: kase.id } });
    assert.equal(fresh.unitsSecured, 1, "one press, one slot");
  });
});

describe("standby lineup", () => {
  it("keeps scheduled standbys promotable after the primary accepts", async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    for (let i = 50; i < 53; i++) await makeDonor(i, "B_POS", 300 + i);

    const kase = await createCase({
      patientId: p.id, hospitalId: h.id, type: "scheduled", unitsRequired: 1,
      neededAt: new Date(Date.now() + 3600_000), window: "10:00-13:00", radiusMeters: 5000,
    });
    created.cases.push(kase.id);

    const primary = await prisma.offer.findFirstOrThrow({ where: { caseId: kase.id, role: "primary" } });
    await acceptOffer(primary.token);

    // A primary who says yes can still not turn up, so the standbys must stay live.
    const pending = await prisma.offer.count({ where: { caseId: kase.id, state: "pending" } });
    assert.equal(pending, 2, "scheduled standbys must not be released at fill time");

    const promoted = await promoteStandby(kase.id);
    assert.equal(promoted.role, "primary");
  });

  it("releases everyone else immediately on an emergency, which scheduled does not", async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    for (let i = 60; i < 66; i++) await makeDonor(i, "B_POS", 300 + i);

    const kase = await createCase({
      patientId: p.id, hospitalId: h.id, type: "emergency", unitsRequired: 1,
      neededAt: new Date(Date.now() + 3600_000), window: "now", radiusMeters: 5000,
    });
    created.cases.push(kase.id);

    const offers = await prisma.offer.findMany({ where: { caseId: kase.id } });
    await acceptOffer(offers[0]!.token);

    // A 1-unit emergency has no no-show margin; the first accept stands everyone else down.
    const pending = await prisma.offer.count({ where: { caseId: kase.id, state: "pending" } });
    assert.equal(pending, 0, "an emergency stands the rest down as soon as units are met");
  });
});

describe("case expiry", () => {
  it("refuses to build a lineup for a need that has already passed", async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    await makeDonor(80, "B_POS", 500);

    await assert.rejects(
      () => createCase({
        patientId: p.id, hospitalId: h.id, type: "scheduled", unitsRequired: 1,
        neededAt: new Date(Date.now() - 3 * 86400_000), window: "10:00-13:00", radiusMeters: 5000,
      }),
      /already passed/,
      "a past neededAt must not lock donors into offers that can never be accepted",
    );
  });

  it("leaves a grace window after neededAt so the donation window is still coverable", async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    await makeDonor(81, "B_POS", 500);

    // Needed an hour ago: still inside the grace, so the offer must remain acceptable.
    const kase = await createCase({
      patientId: p.id, hospitalId: h.id, type: "emergency", unitsRequired: 1,
      neededAt: new Date(Date.now() - 3600_000), window: "now", radiusMeters: 5000,
    });
    created.cases.push(kase.id);

    assert.ok(kase.expiresAt > new Date(), "expiresAt must not equal neededAt");
    const offer = await prisma.offer.findFirstOrThrow({ where: { caseId: kase.id } });
    assert.ok(await acceptOffer(offer.token), "an emergency needed now must be acceptable now");
  });
});

describe("decline promotes the next standby", () => {
  it("turns standby_1 into the primary the moment the primary declines", async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    for (let i = 90; i < 93; i++) await makeDonor(i, "B_POS", 600 + i);

    const kase = await createCase({
      patientId: p.id, hospitalId: h.id, type: "scheduled", unitsRequired: 1,
      neededAt: new Date(Date.now() + 3600_000), window: "10:00-13:00", radiusMeters: 5000,
    });
    created.cases.push(kase.id);

    const primary = await prisma.offer.findFirstOrThrow({ where: { caseId: kase.id, role: "primary" } });
    const standby = await prisma.offer.findFirstOrThrow({ where: { caseId: kase.id, role: "standby_1" } });

    await declineOffer(primary.token, "out of town");

    const promoted = await prisma.offer.findUniqueOrThrow({ where: { id: standby.id } });
    assert.equal(promoted.role, "primary", "standby_1 should be promoted without an ops click");
    assert.equal(promoted.state, "pending");
    assert.equal(promoted.token, standby.token, "the token must not change — their link still works");

    // The promoted donor now sees hospital and desk, which they could not before.
    const full = await prisma.case.findUniqueOrThrow({ where: { id: kase.id }, include: { hospital: true } });
    const payload = buildOfferPayload(promoted, full);
    assert.equal(payload.kind, "primary");
  });

  it("does not promote when a standby declines, only a primary", async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    for (let i = 95; i < 98; i++) await makeDonor(i, "B_POS", 700 + i);

    const kase = await createCase({
      patientId: p.id, hospitalId: h.id, type: "scheduled", unitsRequired: 1,
      neededAt: new Date(Date.now() + 3600_000), window: "10:00-13:00", radiusMeters: 5000,
    });
    created.cases.push(kase.id);

    const s1 = await prisma.offer.findFirstOrThrow({ where: { caseId: kase.id, role: "standby_1" } });
    await declineOffer(s1.token, "busy");

    const s2 = await prisma.offer.findFirstOrThrow({ where: { caseId: kase.id, role: "standby_2" } });
    assert.equal(s2.role, "standby_2", "a standby dropping out must not shuffle the lineup");
  });

  it("does not throw when the primary declines and no standby is left", async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    await makeDonor(99, "B_POS", 800);

    const kase = await createCase({
      patientId: p.id, hospitalId: h.id, type: "scheduled", unitsRequired: 1,
      neededAt: new Date(Date.now() + 3600_000), window: "10:00-13:00", radiusMeters: 5000,
    });
    created.cases.push(kase.id);

    // Declined donors from earlier cases are eligible again, so this lineup may hold more
    // than one offer. Exhaust all of them — that is the condition under test.
    const all = await prisma.offer.findMany({ where: { caseId: kase.id } });
    for (const o of all) await declineOffer(o.token, "cannot");

    const types = (await prisma.event.findMany({ where: { caseId: kase.id } })).map((e) => e.type);
    assert.ok(types.includes("case.lineup_exhausted"), "ops must be able to see the case stalled");
  });
});

describe("audit log", () => {
  it("actually writes a row for every state change on a case", async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    for (let i = 70; i < 73; i++) await makeDonor(i, "B_POS", 400 + i);

    const kase = await createCase({
      patientId: p.id, hospitalId: h.id, type: "scheduled", unitsRequired: 1,
      neededAt: new Date(Date.now() + 3600_000), window: "10:00-13:00", radiusMeters: 5000,
    });
    created.cases.push(kase.id);

    const primary = await prisma.offer.findFirstOrThrow({ where: { caseId: kase.id, role: "primary" } });
    await acceptOffer(primary.token);

    const rows = await prisma.event.findMany({ where: { caseId: kase.id } });
    const types = rows.map((r) => r.type);

    // Prisma promises are lazy: an un-awaited logEvent writes nothing and this goes to zero.
    assert.ok(rows.length > 0, "§5.5 requires an audit trail — nothing was written");
    assert.ok(types.includes("case.created"), `expected case.created, got ${types.join(",")}`);
    assert.ok(types.includes("offer.accepted"), `expected offer.accepted, got ${types.join(",")}`);
  });

  it("keeps PII out of the payload", async () => {
    const rows = await prisma.event.findMany({ orderBy: { at: "desc" }, take: 50 });
    for (const r of rows) {
      const blob = JSON.stringify(r.payload);
      assert.ok(!/\+92\d|@|phone/i.test(blob), `event ${r.type} payload looks like PII: ${blob}`);
    }
  });
});

describe("confirmation", () => {
  it("resets eligibility, scores the donor and closes the case", async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    await makeDonor(30, "B_POS", 200);

    const kase = await createCase({
      patientId: p.id, hospitalId: h.id, type: "scheduled", unitsRequired: 1,
      neededAt: new Date(Date.now() + 3600_000), window: "10:00-13:00", radiusMeters: 5000,
    });
    created.cases.push(kase.id);

    const offer = await prisma.offer.findFirstOrThrow({
      where: { caseId: kase.id, role: "primary" },
    });
    assert.ok(created.donors.includes(offer.donorId), "primary must come from this run's donors");
    const accepted = await acceptOffer(offer.token);
    assert.ok(accepted?.code);

    const withToken = await prisma.case.findUniqueOrThrow({ where: { id: kase.id } });
    await confirmDonation(withToken.familyToken, ` ${accepted.code.toLowerCase()} `);

    const after = await prisma.donor.findUniqueOrThrow({ where: { id: offer.donorId } });
    assert.equal(after.reliabilityScore, 55);
    assert.ok(after.nextEligibleAt > new Date(Date.now() + 89 * 86400_000), "90-day deferral");

    const closed = await prisma.case.findUniqueOrThrow({ where: { id: kase.id } });
    assert.equal(closed.state, "closed");
  });

  it("rejects a code that is not on the case", async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    await makeDonor(40, "B_POS", 200);

    const kase = await createCase({
      patientId: p.id, hospitalId: h.id, type: "scheduled", unitsRequired: 1,
      neededAt: new Date(Date.now() + 3600_000), window: "10:00-13:00", radiusMeters: 5000,
    });
    created.cases.push(kase.id);
    const withToken = await prisma.case.findUniqueOrThrow({ where: { id: kase.id } });

    await assert.rejects(() => confirmDonation(withToken.familyToken, "B+0000"));
  });
});

after(async () => {
  await prisma.donation.deleteMany({ where: { caseId: { in: created.cases } } });
  await prisma.offer.deleteMany({ where: { caseId: { in: created.cases } } });
  await prisma.case.deleteMany({ where: { id: { in: created.cases } } });
  await prisma.patient.deleteMany({ where: { id: { in: created.patients } } });
  await prisma.offer.deleteMany({ where: { donorId: { in: created.donors } } });
  await prisma.donor.deleteMany({ where: { id: { in: created.donors } } });
  await prisma.hospital.deleteMany({ where: { id: { in: created.hospitals } } });
  await prisma.event.deleteMany({ where: { caseId: { in: created.cases } } });
  await prisma.$disconnect();
});
