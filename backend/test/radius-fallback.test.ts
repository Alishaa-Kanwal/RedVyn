import "dotenv/config";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "../src/db";
import { createCase } from "../src/services/case.service";
import { createDonor } from "../src/services/registry.service";
import { expandRadiusForCase } from "../src/services/radius-fallback.service";

/**
 * Runs against DATABASE_URL. Every row it creates is tagged with this run's marker and
 * deleted in `after`, so it does not truncate and does not touch seeded or real data.
 */
const TAG = `radius-fallback-test-${Date.now()}`;
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

async function makeDonor(n: number, metresEast = 0) {
  const d = await createDonor({
    firstName: `${TAG}-${n}`,
    phone: `0300${String((TAG_PHONE_BASE + n) % 10_000_000).padStart(7, "0")}`,
    bloodGroup: "B_POS" as never,
    city: TAG,
    lat: HOSPITAL.lat,
    lon: HOSPITAL.lon + metresEast * 0.0000105,
    language: "ur",
  });
  created.donors.push(d.id);
  return d;
}

async function makePatient(hospitalId: string) {
  const p = await prisma.patient.create({
    data: {
      firstName: `${TAG} patient`,
      guardianPhoneHash: `guardian-hash-${TAG}`,
      guardianPhoneEnc: `guardian-enc-${TAG}`,
      bloodGroup: "B_POS" as never,
      homeHospitalId: hospitalId,
      intervalDaysEstimate: 21,
    },
  });
  created.patients.push(p.id);
  return p;
}

async function makeScheduledCase(hospitalId: string, patientId: string) {
  const kase = await createCase({
    patientId,
    hospitalId,
    type: "scheduled",
    unitsRequired: 1,
    neededAt: new Date(Date.now() + 3600_000),
    window: "10:00-13:00",
    radiusMeters: 5000,
  });
  created.cases.push(kase.id);
  return kase;
}

/**
 * Rewind the sentAt of every pending offer on the case so the expansion wait
 * is satisfied.
 */
async function ageOffers(caseId: string, minutesAgo = 10) {
  const offers = await prisma.offer.findMany({ where: { caseId, state: "pending" } });
  const past = new Date(Date.now() - minutesAgo * 60_000);
  for (const o of offers) {
    await prisma.offer.update({ where: { id: o.id }, data: { sentAt: past } });
  }
}

describe("radius-fallback", { concurrency: false }, () => {
  it("expands 5km -> 15km and finds donors just outside the original radius", async () => {
    const hospital = await makeHospital();
    const patient = await makePatient(hospital.id);

    // One donor inside 5km so the initial case can be created.
    const inner = await makeDonor(1, 0);
    // One donor ~7.4km east: outside 5km, inside 15km.
    const outer = await makeDonor(2, 7000);

    const kase = await makeScheduledCase(hospital.id, patient.id);
    await ageOffers(kase.id);

    await expandRadiusForCase(kase.id);

    const updated = await prisma.case.findUnique({ where: { id: kase.id } });
    assert.equal(updated?.state, "escalating");
    assert.equal(updated?.radiusMeters, 15000);

    const offers = await prisma.offer.findMany({ where: { caseId: kase.id } });
    assert.equal(offers.length, 2, "should keep the original offer and add one at 15km");
    assert.ok(
      offers.some((o) => o.donorId === outer.id),
      "the 15km donor should now have an offer",
    );

    const event = await prisma.event.findFirst({
      where: { caseId: kase.id, type: "case.radius_expanded" },
    });
    assert.ok(event, "radius expansion event should be logged");
  });

  it("transitions to fallback_bloodbank when no donor exists within 30km", async () => {
    const hospital = await makeHospital();
    const patient = await makePatient(hospital.id);

    // One donor at the hospital so the initial case can be created.
    const inner = await makeDonor(3, 0);
    // A donor ~42km away is outside 30km and should never be contacted.
    await makeDonor(4, 40000);

    const kase = await makeScheduledCase(hospital.id, patient.id);
    await ageOffers(kase.id);

    // Make the only in-radius donor ineligible so the widened searches find nothing.
    await prisma.donor.update({
      where: { id: inner.id },
      data: { nextEligibleAt: new Date(Date.now() + 365 * 86400_000) },
    });

    await expandRadiusForCase(kase.id);

    const updated = await prisma.case.findUnique({ where: { id: kase.id } });
    assert.equal(updated?.state, "fallback_bloodbank");
    assert.equal(updated?.radiusMeters, 30000);

    const event = await prisma.event.findFirst({
      where: { caseId: kase.id, type: "case.fallback_bloodbank" },
    });
    assert.ok(event, "fallback bloodbank event should be logged");

    const notification = await prisma.event.findFirst({
      where: { caseId: kase.id, type: "notification.fallback_bloodbank" },
    });
    assert.ok(notification, "fallback notification event should be logged");
  });
});

after(async () => {
  // Clean up all created rows (order matters due to foreign keys)
  const tagHospitalIds = (await prisma.hospital.findMany({ where: { city: { startsWith: "radius-fallback-test-" } }, select: { id: true } })).map((h) => h.id);
  const tagDonorIds = (await prisma.donor.findMany({ where: { city: { startsWith: "radius-fallback-test-" } }, select: { id: true } })).map((d) => d.id);
  const tagPatientIds = (await prisma.patient.findMany({
    where: { OR: [{ homeHospitalId: { in: tagHospitalIds } }, { firstName: { startsWith: "radius-fallback-test-" } }] },
    select: { id: true },
  })).map((p) => p.id);
  const tagCaseIds = (await prisma.case.findMany({
    where: { OR: [{ patientId: { in: tagPatientIds } }, { hospitalId: { in: tagHospitalIds } }] },
    select: { id: true },
  })).map((c) => c.id);

  const hospitalIds = Array.from(new Set([...created.hospitals, ...tagHospitalIds]));
  const donorIds = Array.from(new Set([...created.donors, ...tagDonorIds]));
  const patientIds = Array.from(new Set([...created.patients, ...tagPatientIds]));
  const caseIds = Array.from(new Set([...created.cases, ...tagCaseIds]));

  await prisma.event.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }] } });
  await prisma.offer.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }] } });
  await prisma.donation.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }, { patientId: { in: patientIds } }] } });
  await prisma.case.deleteMany({ where: { id: { in: caseIds } } });
  await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  await prisma.donor.deleteMany({ where: { id: { in: donorIds } } });
  await prisma.hospital.deleteMany({ where: { id: { in: hospitalIds } } });
});
