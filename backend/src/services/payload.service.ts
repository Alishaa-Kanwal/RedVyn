import type { Case, Hospital, Offer } from "../generated/prisma/client";
import type { BloodGroup } from "../generated/prisma/enums";
import { label } from "../lib/blood";

/**
 * §4.3, the privacy boundary. Neither type has a field for patient name or id, so a
 * donor-facing template cannot render one however it is misconfigured. The standby
 * type additionally has no hospital and no code, because a standby must not learn
 * where to go until they are promoted.
 *
 * This is the whole enforcement mechanism. Do not add a patient field to either type,
 * and do not hand a raw Case or Patient to a donor-facing view.
 */
export type StandbyOfferPayload = {
  kind: "standby";
  neededAt: Date;
  city: string;
  bloodGroup: string;
  role: string;
};

export type PrimaryOfferPayload = {
  kind: "primary";
  neededAt: Date;
  city: string;
  bloodGroup: string;
  role: string;
  hospitalName: string;
  deskInfo: string;
  window: string;
  units: number;
  code: string | null;
};

type CaseWithHospital = Case & { hospital: Hospital };

export function buildOfferPayload(
  offer: Offer,
  kase: CaseWithHospital,
): PrimaryOfferPayload | StandbyOfferPayload {
  const common = {
    neededAt: kase.neededAt,
    city: kase.hospital.city,
    bloodGroup: label(kase.bloodGroup as BloodGroup),
    role: offer.role as string,
  };

  if (offer.role !== "primary") return { kind: "standby", ...common };

  return {
    kind: "primary",
    ...common,
    hospitalName: kase.hospital.name,
    deskInfo: kase.hospital.deskInfo,
    window: kase.window,
    units: kase.unitsRequired,
    code: offer.code,
  };
}
