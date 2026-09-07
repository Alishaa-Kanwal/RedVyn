import { Prisma } from "../generated/prisma/client";
import type { BloodGroup } from "../generated/prisma/enums";
import { prisma } from "../db";
import { compatibleGroups } from "../lib/blood";

export type Match = {
  id: string;
  firstName: string;
  bloodGroup: BloodGroup;
  reliabilityScore: number;
  meters: number;
};

/**
 * The ranked match query of §3.3, with two deviations noted in the schema header:
 * haversine over Float lat/lon instead of PostGIS, and no Redis.
 *
 * The arithmetic below must stay identical to `haversineMeters()` in lib/blood.ts —
 * test/matching.test.ts asserts the two agree.
 *
 * The NOT EXISTS clause is the load-bearing one: without it the same high-reliability
 * donor is recruited onto three cases in the same hour and shows up for none.
 */
export async function findMatches(
  recipient: BloodGroup,
  lat: number,
  lon: number,
  radiusMeters: number,
  limit: number,
): Promise<Match[]> {
  const groups = compatibleGroups(recipient);

  return prisma.$queryRaw<Match[]>`
    SELECT * FROM (
      SELECT d.id,
             d."firstName",
             d."bloodGroup",
             d."reliabilityScore",
             2 * 6371000 * asin(least(1, sqrt(
               power(sin(radians(d.lat - ${lat}::float8) / 2), 2) +
               cos(radians(${lat}::float8)) * cos(radians(d.lat)) *
               power(sin(radians(d.lon - ${lon}::float8) / 2), 2)
             ))) AS meters
      FROM "Donor" d
      WHERE d.status = 'active'
        AND d."nextEligibleAt" <= now()
        AND d."bloodGroup" = ANY(ARRAY[${Prisma.join(groups)}]::"BloodGroup"[])
        AND NOT EXISTS (
          SELECT 1 FROM "Offer" o
          WHERE o."donorId" = d.id
            AND o.state IN ('pending', 'accepted', 'code_issued')
        )
    ) ranked
    WHERE meters <= ${radiusMeters}::float8
    ORDER BY ("bloodGroup" = ${recipient}::"BloodGroup") DESC,
             "reliabilityScore" DESC,
             meters ASC
    LIMIT ${limit}::int
  `;
}
