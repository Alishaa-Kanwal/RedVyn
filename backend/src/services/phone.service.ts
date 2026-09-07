import { prisma } from "../db";
import { decryptPhone, encryptPhone, hashPhone } from "../lib/crypto";
import { AppError } from "../middleware/error";
import { logEvent } from "./event.service";

export function sealPhone(raw: string): { phoneHash: string; phoneEnc: string } {
  return { phoneHash: hashPhone(raw), phoneEnc: encryptPhone(raw) };
}

/**
 * The ONLY sanctioned path back to a plaintext number. §4.1 requires every access be
 * logged, which is why routes call this and never `decryptPhone` directly.
 */
export async function revealDonorPhone(donorId: string, actor: string): Promise<string> {
  const donor = await prisma.donor.findUnique({ where: { id: donorId } });
  if (!donor) throw new AppError("No such donor", 404);
  await logEvent("phone.revealed", { donorId }, { actor });
  return decryptPhone(donor.phoneEnc);
}

export async function revealGuardianPhone(patientId: string, actor: string): Promise<string> {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new AppError("No such patient", 404);
  await logEvent("phone.revealed", {}, { actor, patientId });
  return decryptPhone(patient.guardianPhoneEnc);
}
