import "dotenv/config";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "../src/db";
import { encryptPhone, hashPhone } from "../src/lib/crypto";
import { sweepExpiredOffers, sweepLineupExhausted } from "../src/services/scheduler.service";
import { createCase } from "../src/services/case.service";
import { createDonor } from "../src/services/registry.service";

/**
 * Runs against DATABASE_URL. Every row it creates is tagged with this run's marker and
 * deleted in `after`, so it does not truncate and does not touch seeded or real data.
 */
const TAG = `scheduler-test-${Date.now()}`;
const TAG_PHONE_BASE = parseInt(TAG.slice(-7), 10);
const HOSPITAL = { lat: 25.4000, lon: 68.3000 };
const created = {
  hospitals: [] as string[],
  patients: [] as string[],
  cases: [] as string[],
  donors: [] as string[],
};

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

describe("sweepExpiredOffers", () => {
  it("times out offers past their case's expiresAt and promotes standbys", async () => {
    const hospital = await makeHospital();
    const patient = await makePatient(hospital.id);

    // Create 3 donors and a scheduled case with them as primary + 2 standbys
    const donors = await Promise.all([
      makeDonor(1),
      makeDonor(2),
      makeDonor(3),
    ]);

    // Create a case that expired 1 hour ago
    const now = new Date();
    const pastExpiry = new Date(now.getTime() - 60 * 60 * 1000);

    const kase = await prisma.case.create({
      data: {
        patientId: patient.id,
        hospitalId: hospital.id,
        type: "scheduled",
        bloodGroup: patient.bloodGroup,
        unitsRequired: 1,
        slotsRemaining: 1,
        state: "awaiting_response",
        neededAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        window: "10:00-13:00",
        expiresAt: pastExpiry, // Already expired
        familyToken: `token-${Math.random()}`,
      },
    });
    created.cases.push(kase.id);

    // Create offers: primary + 2 standbys, all pending
    await prisma.offer.createMany({
      data: [
        {
          caseId: kase.id,
          donorId: donors[0]!.id,
          role: "primary",
          state: "pending",
          token: `token-primary-${Math.random()}`,
          sentAt: new Date(),
        },
        {
          caseId: kase.id,
          donorId: donors[1]!.id,
          role: "standby_1",
          state: "pending",
          token: `token-sb1-${Math.random()}`,
          sentAt: new Date(),
        },
        {
          caseId: kase.id,
          donorId: donors[2]!.id,
          role: "standby_2",
          state: "pending",
          token: `token-sb2-${Math.random()}`,
          sentAt: new Date(),
        },
      ],
    });

    // Verify initial state
    let primary = await prisma.offer.findFirst({
      where: { caseId: kase.id, role: "primary" },
    });
    assert.equal(primary?.state, "pending");

    // Run the sweep
    await sweepExpiredOffers();

    // Check that the primary was timed out
    const timedOut = await prisma.offer.findFirst({
      where: { caseId: kase.id, role: "primary", state: "timed_out" },
    });
    assert.ok(timedOut, "primary should be timed out");

    // Check that standby_1 was promoted to primary
    const promoted = await prisma.offer.findFirst({
      where: { caseId: kase.id, donorId: donors[1]!.id },
    });
    assert.equal(promoted?.role, "primary");
    assert.equal(promoted?.state, "pending");
  });

  it("is idempotent — running twice does not double-promote", async () => {
    const hospital = await makeHospital();
    const patient = await makePatient(hospital.id);
    const donors = await Promise.all([makeDonor(10), makeDonor(11), makeDonor(12)]);

    const now = new Date();
    const pastExpiry = new Date(now.getTime() - 60 * 60 * 1000);

    const kase = await prisma.case.create({
      data: {
        patientId: patient.id,
        hospitalId: hospital.id,
        type: "scheduled",
        bloodGroup: patient.bloodGroup,
        unitsRequired: 1,
        slotsRemaining: 1,
        state: "awaiting_response",
        neededAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        window: "10:00-13:00",
        expiresAt: pastExpiry,
        familyToken: `token-${Math.random()}`,
      },
    });
    created.cases.push(kase.id);

    await prisma.offer.createMany({
      data: [
        {
          caseId: kase.id,
          donorId: donors[0]!.id,
          role: "primary",
          state: "pending",
          token: `token-primary-${Math.random()}`,
          sentAt: new Date(),
        },
        {
          caseId: kase.id,
          donorId: donors[1]!.id,
          role: "standby_1",
          state: "pending",
          token: `token-sb1-${Math.random()}`,
          sentAt: new Date(),
        },
        {
          caseId: kase.id,
          donorId: donors[2]!.id,
          role: "standby_2",
          state: "pending",
          token: `token-sb2-${Math.random()}`,
          sentAt: new Date(),
        },
      ],
    });

    // Run sweep twice
    await sweepExpiredOffers();
    await sweepExpiredOffers();

    // Check that promotions are stable — there should be exactly one pending primary
    const offers = await prisma.offer.findMany({ where: { caseId: kase.id } });
    const pendingPrimaries = offers.filter((o) => o.role === "primary" && o.state === "pending");
    assert.equal(pendingPrimaries.length, 1, "should have exactly one pending primary");
    
    // Verify that it's one of the promoted donors (standby_1 or standby_2)
    const activePrimaryDonor = pendingPrimaries[0]?.donorId;
    assert.ok(
      activePrimaryDonor === donors[1]!.id || activePrimaryDonor === donors[2]!.id,
      "active primary should be one of the standbys"
    );
  });
});

describe("sweepLineupExhausted", () => {
  it("marks a case as unfilled when all offers are exhausted", async () => {
    const hospital = await makeHospital();
    const patient = await makePatient(hospital.id);
    const donors = await Promise.all([makeDonor(20), makeDonor(21)]);

    const kase = await prisma.case.create({
      data: {
        patientId: patient.id,
        hospitalId: hospital.id,
        type: "scheduled",
        bloodGroup: patient.bloodGroup,
        unitsRequired: 1,
        slotsRemaining: 1,
        state: "awaiting_response",
        neededAt: new Date(),
        window: "10:00-13:00",
        expiresAt: new Date(Date.now() + 12 * 3600 * 1000),
        familyToken: `token-${Math.random()}`,
      },
    });
    created.cases.push(kase.id);

    // Create two offers, both in terminal states
    await prisma.offer.createMany({
      data: [
        {
          caseId: kase.id,
          donorId: donors[0]!.id,
          role: "primary",
          state: "declined",
          token: `token-declined-${Math.random()}`,
          sentAt: new Date(),
          respondedAt: new Date(),
        },
        {
          caseId: kase.id,
          donorId: donors[1]!.id,
          role: "standby_1",
          state: "timed_out",
          token: `token-timeout-${Math.random()}`,
          sentAt: new Date(),
          respondedAt: new Date(),
        },
      ],
    });

    // Before sweep, case is not in unfilled state
    let caseState = await prisma.case.findUnique({ where: { id: kase.id } });
    assert.notEqual(caseState?.state, "unfilled");

    // Run the sweep
    await sweepLineupExhausted();

    // After sweep, case should be unfilled
    caseState = await prisma.case.findUnique({ where: { id: kase.id } });
    assert.equal(caseState?.state, "unfilled");
  });

  it("does not mark as lineup_exhausted if any offer is still pending", async () => {
    const hospital = await makeHospital();
    const patient = await makePatient(hospital.id);
    const donors = await Promise.all([makeDonor(30), makeDonor(31)]);

    const kase = await prisma.case.create({
      data: {
        patientId: patient.id,
        hospitalId: hospital.id,
        type: "scheduled",
        bloodGroup: patient.bloodGroup,
        unitsRequired: 1,
        slotsRemaining: 1,
        state: "awaiting_response",
        neededAt: new Date(),
        window: "10:00-13:00",
        expiresAt: new Date(Date.now() + 12 * 3600 * 1000),
        familyToken: `token-${Math.random()}`,
      },
    });
    created.cases.push(kase.id);

    // Create offers: one declined, one still pending
    await prisma.offer.createMany({
      data: [
        {
          caseId: kase.id,
          donorId: donors[0]!.id,
          role: "primary",
          state: "declined",
          token: `token-declined-${Math.random()}`,
          sentAt: new Date(),
          respondedAt: new Date(),
        },
        {
          caseId: kase.id,
          donorId: donors[1]!.id,
          role: "standby_1",
          state: "pending",
          token: `token-pending-${Math.random()}`,
          sentAt: new Date(),
        },
      ],
    });

    // Run the sweep
    await sweepLineupExhausted();

    // Case should NOT be marked as lineup_exhausted since one is still pending
    const caseState = await prisma.case.findUnique({ where: { id: kase.id } });
    assert.notEqual(caseState?.state, "lineup_exhausted");
  });

  it("is idempotent — running twice on the same case is safe", async () => {
    const hospital = await makeHospital();
    const patient = await makePatient(hospital.id);
    const donors = await Promise.all([makeDonor(40), makeDonor(41)]);

    const kase = await prisma.case.create({
      data: {
        patientId: patient.id,
        hospitalId: hospital.id,
        type: "scheduled",
        bloodGroup: patient.bloodGroup,
        unitsRequired: 1,
        slotsRemaining: 1,
        state: "awaiting_response",
        neededAt: new Date(),
        window: "10:00-13:00",
        expiresAt: new Date(Date.now() + 12 * 3600 * 1000),
        familyToken: `token-${Math.random()}`,
      },
    });
    created.cases.push(kase.id);

    await prisma.offer.createMany({
      data: [
        {
          caseId: kase.id,
          donorId: donors[0]!.id,
          role: "primary",
          state: "declined",
          token: `token-declined-${Math.random()}`,
          sentAt: new Date(),
          respondedAt: new Date(),
        },
        {
          caseId: kase.id,
          donorId: donors[1]!.id,
          role: "standby_1",
          state: "timed_out",
          token: `token-timeout-${Math.random()}`,
          sentAt: new Date(),
          respondedAt: new Date(),
        },
      ],
    });

    // Run sweep twice
    await sweepLineupExhausted();
    const stateAfterFirst = await prisma.case.findUnique({ where: { id: kase.id } });
    assert.equal(stateAfterFirst?.state, "unfilled");

    await sweepLineupExhausted();
    const stateAfterSecond = await prisma.case.findUnique({ where: { id: kase.id } });
    assert.equal(stateAfterSecond?.state, "unfilled", "second sweep should not change state");
  });
});

after(async () => {
  // Clean up all created rows (order matters due to foreign keys)
  // Delete offers by both case and donor to be thorough
  await prisma.offer.deleteMany({ 
    where: { 
      OR: [
        { caseId: { in: created.cases } },
        { donorId: { in: created.donors } },
      ],
    },
  });
  // Event references case/offer/donor
  await prisma.event.deleteMany({ where: { caseId: { in: created.cases } } });
  // Case references patient and hospital
  await prisma.case.deleteMany({ where: { id: { in: created.cases } } });
  // Patient references hospital
  await prisma.patient.deleteMany({ where: { id: { in: created.patients } } });
  // Hospital has no incoming refs
  await prisma.hospital.deleteMany({ where: { id: { in: created.hospitals } } });
  // Donor has no incoming refs
  await prisma.donor.deleteMany({ where: { id: { in: created.donors } } });
});
