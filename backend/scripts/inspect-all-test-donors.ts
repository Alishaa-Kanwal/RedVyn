 
import { prisma } from "../src/db";

async function main() {
  const nonLahoreDonors = await prisma.donor.findMany({
    where: { city: { not: "Lahore" } },
    select: { id: true, firstName: true, city: true, lat: true, lon: true, bloodGroup: true, nextEligibleAt: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  console.log(`Non-Lahore donors: ${nonLahoreDonors.length}`);
  for (const d of nonLahoreDonors) console.log(d);
}

main().finally(() => prisma.$disconnect());
