import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { errorHandler, notFound } from "./middleware/error";
import { router } from "./routes";
import { sweepAll } from "./services/scheduler.service";

const loginLimiter =
  process.env["NODE_ENV"] === "production"
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 5,
        standardHeaders: true,
        legacyHeaders: false,
        message: "Too many login attempts, please try again later.",
      })
    : (_req: unknown, _res: unknown, next: () => void) => next();

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(pinoHttp({ logger }));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(
    cors({
      origin: process.env["FRONTEND_URL"] ?? "http://localhost:3000",
      credentials: true,
    }),
  );
  app.use(cookieParser());

  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new Error("SESSION_SECRET is not set — see .env.example");

  app.use(
    session({
      secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env["NODE_ENV"] === "production",
        maxAge: 8 * 3600 * 1000,
      },
    }),
  );

  // Rate limits for authentication endpoints.
  app.post("/api/auth/login", loginLimiter);
  app.post("/api/auth/signin", loginLimiter);
  app.post("/api/auth/signup", loginLimiter);
  app.post("/api/auth/donor/register", loginLimiter);
  app.post("/api/auth/donor/login", loginLimiter);
  app.post("/api/auth/guardian/register", loginLimiter);
  app.post("/api/auth/guardian/login", loginLimiter);
  app.post("/api/auth/hospital/register", loginLimiter);
  app.post("/api/auth/hospital/login", loginLimiter);

  app.use(router);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

if (require.main === module) {
  const port = Number(process.env["PORT"] ?? 4000);
  const app = createApp();

  // Start the escalation scheduler
  const sweepIntervalMs = Number(process.env["SWEEP_INTERVAL_MS"] ?? 60000);
  setInterval(async () => {
    try {
      await sweepAll();
    } catch (err) {
      logger.error({ err }, "scheduler sweep failed");
    }
  }, sweepIntervalMs);

  app.listen(port, () => logger.info(`RedVyn API on http://localhost:${port}`));
}
