import jwt from "jsonwebtoken";

/**
 * Short-lived JWT for ops/API authentication.
 *
 * The token carries only identity claims; freshness checks (isActive) are done
 * on every protected request.
 */

export type AuthRole = "admin" | "donor" | "guardian" | "hospital";

export interface AuthTokenPayload {
  sub: string;
  role: AuthRole;
  name: string;
}

const DEFAULT_TTL = "12h";

const ROLES: AuthRole[] = ["admin", "donor", "guardian", "hospital"];

function secret(): string {
  const value = process.env["JWT_SECRET"];
  if (!value) throw new Error("JWT_SECRET is not set — see .env.example");
  return value;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  const ttl = process.env["JWT_TTL"] || DEFAULT_TTL;
  return jwt.sign(payload, secret(), { expiresIn: ttl as jwt.SignOptions["expiresIn"] });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, secret());
  if (typeof decoded === "string") throw new Error("Malformed token payload");
  const role = ROLES.includes(decoded.role as AuthRole) ? (decoded.role as AuthRole) : "donor";
  return {
    sub: String(decoded.sub),
    role,
    name: String(decoded.name),
  };
}

/** Max-age in milliseconds for the cookie that carries the token. */
export function tokenMaxAgeMs(token: string): number {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === "string" || !decoded.exp || !decoded.iat) {
    // Fallback to the default TTL if the token has no expiry claims.
    return 12 * 3600 * 1000;
  }
  return (decoded.exp - decoded.iat) * 1000;
}
