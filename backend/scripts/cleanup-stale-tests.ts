import "dotenv/config";
import { prisma } from "../src/db";

/**
 * Deletes rows left behind by crashed or interrupted test runs.
 * Only targets rows whose city/name/email matches known test tags.
 */
async function main() {
  const testPrefixes = ["api-registries-test-", "emergency-test-", "api-cases-test-", "api-dashboard-test-", "scheduler-test-", "auth-test-", "redvyn-test-"];

  const tagWhere = (field: string) => ({
    OR: testPrefixes.map((prefix) => ({ [field]: { startsWith: prefix } })),
  });

  // Find candidate IDs first, then delete in FK-safe order.
  const hospitals = await prisma.hospital.findMany({ where: tagWhere("city"), select: { id: true } });
  const hospitalIds = hospitals.map((h) => h.id);

  const patients = await prisma.patient.findMany({
    where: { OR: [{ homeHospitalId: { in: hospitalIds } }, { firstName: { startsWith: "api-registries-test-" } }, { firstName: { startsWith: "emergency-test-" } }] },
    select: { id: true },
  });
  const patientIds = patients.map((p) => p.id);

  const donors = await prisma.donor.findMany({
    where: { OR: [{ city: { startsWith: "api-registries-test-" } }, { city: { startsWith: "emergency-test-" } }, { firstName: { startsWith: "api-registries-test-" } }, { firstName: { startsWith: "emergency-test-" } }] },
    select: { id: true },
  });
  const donorIds = donors.map((d) => d.id);

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: "api-registries-test-" } },
        { email: { startsWith: "emergency-test-" } },
        { email: { startsWith: "auth-test-" } },
        { name: { startsWith: "api-registries-test-" } },
        { name: { startsWith: "emergency-test-" } },
      ],
    },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  const cases = await prisma.case.findMany({
    where: { OR: [{ patientId: { in: patientIds } }, { hospitalId: { in: hospitalIds } }] },
    select: { id: true },
  });
  const caseIds = cases.map((c) => c.id);

  console.log({ hospitals: hospitalIds.length, patients: patientIds.length, donors: donorIds.length, users: userIds.length, cases: caseIds.length });

  await prisma.event.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }, { userId: { in: userIds } }] } });
  await prisma.donation.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }, { patientId: { in: patientIds } }] } });
  await prisma.offer.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }] } });
  await prisma.case.deleteMany({ where: { id: { in: caseIds } } });
  await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  await prisma.donor.deleteMany({ where: { id: { in: donorIds } } });
  await prisma.hospital.deleteMany({ where: { id: { in: hospitalIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  console.log("Stale test data cleaned.");
}

main().finally(() => prisma.$disconnect());
