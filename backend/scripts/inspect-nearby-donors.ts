import "dotenv/config";
import { prisma } from "../src/db";

async function main() {
  const lat = 25.4;
  const lon = 68.3;
  const radiusM = 5000;

  const donors = await prisma.$queryRaw`
    SELECT d.id, d."firstName", d.city, d."bloodGroup", d."reliabilityScore",
           2 * 6371000 * asin(least(1, sqrt(
             power(sin(radians(d.lat - ${lat}::float8) / 2), 2) +
             cos(radians(${lat}::float8)) * cos(radians(d.lat)) *
             power(sin(radians(d.lon - ${lon}::float8) / 2), 2)
           ))) AS meters
    FROM "Donor" d
    WHERE d.status = 'active'
      AND d."nextEligibleAt" <= now()
      AND NOT EXISTS (
        SELECT 1 FROM "Offer" o
        WHERE o."donorId" = d.id
          AND o.state IN ('pending', 'accepted', 'code_issued')
      )
    ORDER BY meters ASC
    LIMIT 50;
  `;
  console.log(`Active eligible donors near ${lat},${lon}:`, (donors as any[]).length);
  for (const d of donors as any[]) console.log(d);
}

main().finally(() => prisma.$disconnect());
