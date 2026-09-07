import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

/** Thrown by services for conditions the user caused, rendered as a message not a 500. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err instanceof AppError ? err.status : 500;
  if (status >= 500) logger.error({ err }, "unhandled");
  res.status(status).json({
    error: status >= 500 ? "Something broke on our side." : err.message,
  });
}
