import "dotenv/config";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "../src/db";
import { sweepReliabilityAndPrediction } from "../src/services/scheduler.service";

/**
 * Runs against DATABASE_URL. Every row it creates is tagged with this run's marker and
 * deleted in `after`, so it does not truncate and does not touch seeded or real data.
 */
const TAG = `reliability-test-${Date.now()}`;

const created = {
  hospitals: [] as string[],
  patients: [] as string[],
  donors: [] as string[],
  cases: [] as string[],
  offers: [] as string[],
};

describe("sweepReliabilityAndPrediction", () => {
  it("predicts next transfusion from lastTransfusionAt and interval", async () => {
    const hospital = await prisma.hospital.create({
      data: { name: `${TAG} hospital`, city: TAG, lat: 25.4, lon: 68.3, deskInfo: `${TAG} desk` },
    });
    created.hospitals.push(hospital.id);

    const lastTransfusion = new Date("2026-08-01T10:00:00Z");
    const patient = await prisma.patient.create({
      data: {
        firstName: `${TAG}-patient`,
        guardianPhoneHash: `hash-${TAG}`,
        guardianPhoneEnc: `enc-${TAG}`,
        bloodGroup: "B_POS",
        homeHospitalId: hospital.id,
        intervalDaysEstimate: 21,
        lastTransfusionAt: lastTransfusion,
      },
    });
    created.patients.push(patient.id);

    await sweepReliabilityAndPrediction();

    const updated = await prisma.patient.findUnique({ where: { id: patient.id } });
    const expected = new Date(lastTransfusion.getTime() + 21 * 86400_000);
    assert.equal(updated!.predictedNextAt?.toISOString(), expected.toISOString());
  });

  it("raises reliability score after a completed donation and lowers it after a no-show", async () => {
    const hospital = await prisma.hospital.create({
      data: { name: `${TAG} hospital 2`, city: TAG, lat: 25.4, lon: 68.3, deskInfo: `${TAG} desk` },
    });
    created.hospitals.push(hospital.id);

    const goodDonor = await prisma.donor.create({
      data: {
        firstName: `${TAG}-good`,
        phoneHash: `hash-${TAG}-good`,
        phoneEnc: `enc-${TAG}-good`,
        bloodGroup: "B_POS",
        city: TAG,
        lat: 10.0,
        lon: 10.0,
        consentAt: new Date(),
        consentVersion: "v1",
        manageToken: `${TAG}-good`,
        reliabilityScore: 50,
      },
    });
    created.donors.push(goodDonor.id);

    const badDonor = await prisma.donor.create({
      data: {
        firstName: `${TAG}-bad`,
        phoneHash: `hash-${TAG}-bad`,
        phoneEnc: `enc-${TAG}-bad`,
        bloodGroup: "O_POS",
        city: TAG,
        lat: 10.0,
        lon: 10.0,
        consentAt: new Date(),
        consentVersion: "v1",
        manageToken: `${TAG}-bad`,
        reliabilityScore: 50,
      },
    });
    created.donors.push(badDonor.id);

    const patient = await prisma.patient.create({
      data: {
        firstName: `${TAG}-patient-2`,
        guardianPhoneHash: `hash-${TAG}-2`,
        guardianPhoneEnc: `enc-${TAG}-2`,
        bloodGroup: "B_POS",
        homeHospitalId: hospital.id,
        intervalDaysEstimate: 21,
      },
    });
    created.patients.push(patient.id);

    const kase = await prisma.case.create({
      data: {
        patientId: patient.id,
        hospitalId: hospital.id,
        bloodGroup: "B_POS",
        slotsRemaining: 1,
        neededAt: new Date(Date.now() + 86400_000),
        window: "10:00-13:00",
        expiresAt: new Date(Date.now() + 86400_000),
        familyToken: `${TAG}-family`,
      },
    });
    created.cases.push(kase.id);

    await prisma.offer.create({
      data: {
        caseId: kase.id,
        donorId: goodDonor.id,
        role: "primary",
        token: `${TAG}-offer-good`,
        state: "completed",
      },
    });

    const badOffer = await prisma.offer.create({
      data: {
        caseId: kase.id,
        donorId: badDonor.id,
        role: "standby_1",
        token: `${TAG}-offer-bad`,
        state: "no_show",
      },
    });
    created.offers.push(badOffer.id);

    await prisma.donation.create({
      data: {
        caseId: kase.id,
        donorId: goodDonor.id,
        patientId: patient.id,
        code: `${TAG}-code`,
      },
    });

    await sweepReliabilityAndPrediction();

    const goodUpdated = await prisma.donor.findUnique({ where: { id: goodDonor.id } });
    const badUpdated = await prisma.donor.findUnique({ where: { id: badDonor.id } });

    assert.ok(goodUpdated!.reliabilityScore > 50);
    assert.ok(badUpdated!.reliabilityScore < 50);
  });
});

after(async () => {
  await prisma.offer.deleteMany({ where: { caseId: { in: created.cases } } });
  await prisma.donation.deleteMany({ where: { donorId: { in: created.donors } } });
  await prisma.case.deleteMany({ where: { id: { in: created.cases } } });
  await prisma.patient.deleteMany({ where: { id: { in: created.patients } } });
  await prisma.donor.deleteMany({ where: { id: { in: created.donors } } });
  await prisma.hospital.deleteMany({ where: { id: { in: created.hospitals } } });
  await prisma.$disconnect();
});
