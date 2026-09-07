import { hash, compare } from "bcryptjs";

/**
 * Password hashing for admin and self-service accounts.
 *
 * bcryptjs is used so the backend stays pure JS/TS and does not pull in a native
 * module at build time.
 */

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return compare(plain, hash);
}
