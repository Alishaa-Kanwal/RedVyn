import "dotenv/config";
import { prisma } from "../src/db";

async function main() {
  const staleDonors = await prisma.donor.findMany({
    where: { city: { startsWith: "emergency-test-" } },
    select: { id: true, firstName: true, city: true, lat: true, lon: true, phoneHash: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  console.log(`Stale emergency-test donors: ${staleDonors.length}`);
  for (const d of staleDonors.slice(0, 20)) console.log(d);

  const staleHospitals = await prisma.hospital.findMany({
    where: { city: { startsWith: "emergency-test-" } },
    select: { id: true, name: true, city: true, createdAt: true },
    take: 100,
  });
  console.log(`Stale emergency-test hospitals: ${staleHospitals.length}`);

  const staleUsers = await prisma.user.findMany({
    where: { email: { startsWith: "emergency-test-" } },
    select: { id: true, email: true, createdAt: true },
    take: 100,
  });
  console.log(`Stale emergency-test users: ${staleUsers.length}`);
}

main().finally(() => prisma.$disconnect());
