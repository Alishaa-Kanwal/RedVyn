import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken, type AuthTokenPayload } from "../lib/jwt";

/**
 * JWT-based auth for ops console and API.
 *
 * The token lives in the httpOnly `redvyn_token` cookie. Middleware validates it,
 * attaches the decoded identity, and fails in the style appropriate to its surface.
 */

const COOKIE_NAME = "redvyn_token";

function tokenFromCookie(req: Request): string | undefined {
  return req.cookies?.[COOKIE_NAME];
}

export function requireOps(req: Request, res: Response, next: NextFunction): void {
  const token = tokenFromCookie(req);
  if (!token) {
    res.redirect("/ops/login");
    return;
  }

  try {
    req.user = verifyAuthToken(token);
    next();
  } catch {
    res.redirect("/ops/login");
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = tokenFromCookie(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    req.user = verifyAuthToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireRole(...roles: Array<AuthTokenPayload["role"]>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
