import "express-session";
import type { AuthTokenPayload } from "./lib/jwt";

declare module "express-session" {
  interface SessionData {
    ops?: boolean;
    flash?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}
