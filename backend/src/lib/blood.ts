import { BloodGroup } from "../generated/prisma/enums";

/**
 * Red cell compatibility — recipient group -> groups they can safely receive.
 *
 * §3.3: compatibility is a lookup table, not an equality check. The full set is
 * used to *filter*; exact match is only a ranking weight, so the system degrades
 * to compatible rather than finding nobody.
 */
export const COMPATIBLE: Record<BloodGroup, BloodGroup[]> = {
  A_POS: ["A_POS", "A_NEG", "O_POS", "O_NEG"],
  A_NEG: ["A_NEG", "O_NEG"],
  B_POS: ["B_POS", "B_NEG", "O_POS", "O_NEG"],
  B_NEG: ["B_NEG", "O_NEG"],
  AB_POS: ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"],
  AB_NEG: ["A_NEG", "B_NEG", "AB_NEG", "O_NEG"],
  O_POS: ["O_POS", "O_NEG"],
  O_NEG: ["O_NEG"],
};

export function compatibleGroups(recipient: BloodGroup): BloodGroup[] {
  return COMPATIBLE[recipient];
}

/** Display form. The donation code embeds this so a desk can eyeball a mismatch. §3.8 */
export function label(group: BloodGroup): string {
  return group.replace("_POS", "+").replace("_NEG", "-");
}

export const ALL_GROUPS = Object.keys(COMPATIBLE) as BloodGroup[];

/**
 * Great-circle distance in metres.
 *
 * Mirrored in SQL inside the match query (src/matching.ts) — the two must agree,
 * which the test asserts. Kept here so the seed and the console can show distances
 * without a round trip.
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
