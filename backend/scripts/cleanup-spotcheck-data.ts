import "dotenv/config";
import { prisma } from "../src/db";

async function main() {
  const donorIds = ["cmtko407v0004ocvzzmjjtn9e"];
  const hospitalIds = ["cmtko2q400001ocvzso7chnj6"];
  const patientIds = ["cmtko3d8h0002ocvzsry9j77g"];
  const caseIds = ["cmtko4iuj0006ocvz4ffk4zga"];

  await prisma.event.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }] } });
  await prisma.offer.deleteMany({ where: { OR: [{ caseId: { in: caseIds } }, { donorId: { in: donorIds } }] } });
  await prisma.case.deleteMany({ where: { id: { in: caseIds } } });
  await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  await prisma.donor.deleteMany({ where: { id: { in: donorIds } } });
  await prisma.hospital.deleteMany({ where: { id: { in: hospitalIds } } });
  console.log("Spot-check data cleaned.");
}

main().finally(() => prisma.$disconnect());
