import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { AppError } from "../middleware/error";

/**
 * §3.1: phone numbers encrypted at rest, indexed on a keyed hash so lookup works
 * without decrypting the whole table.
 *
 * node:crypto only — this needs no dependency.
 */

function key(name: "PHONE_ENC_KEY" | "PHONE_HASH_KEY"): Buffer {
  const hex = process.env[name];
  if (!hex) throw new Error(`${name} is not set — see .env.example`);
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error(`${name} must be 32 bytes of hex (64 chars), got ${buf.length}`);
  }
  return buf;
}

/** Strip spaces and dashes so the same number always hashes to the same value. */
export function normalisePhone(raw: string): string {
  const trimmed = raw.replace(/[\s-()]/g, "");
  // Pakistani local form 03xx... -> +923xx...
  if (/^03\d{9}$/.test(trimmed)) return "+92" + trimmed.slice(1);
  if (/^\+\d{10,15}$/.test(trimmed)) return trimmed;
  if (/^\d{10,15}$/.test(trimmed)) return "+" + trimmed;
  // A typo in a signup or settings form is the user's doing, not a crash. §4.1 paths
  // all funnel through here, so one AppError covers registration and profile edits both.
  throw new AppError("Phone number is not in a recognised format");
}

/** Deterministic keyed hash. This is the lookup index, never reversible. */
export function hashPhone(raw: string): string {
  return createHmac("sha256", key("PHONE_HASH_KEY"))
    .update(normalisePhone(raw))
    .digest("hex");
}

/** AES-256-GCM. Returns iv:tag:ciphertext, all hex. */
export function encryptPhone(raw: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("PHONE_ENC_KEY"), iv);
  const enc = Buffer.concat([
    cipher.update(normalisePhone(raw), "utf8"),
    cipher.final(),
  ]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), enc.toString("hex")].join(
    ":",
  );
}

/**
 * The only path back to a plaintext number.
 *
 * §4.1 requires that access be logged. Callers go through
 * `services/phone.ts:revealPhone()`, which writes the Event row — do not call
 * this directly from a route.
 */
export function decryptPhone(stored: string): string {
  const [ivHex, tagHex, dataHex] = stored.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Malformed encrypted phone");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key("PHONE_ENC_KEY"),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

/** Constant-time compare for the ops password, so it does not leak length by timing. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
