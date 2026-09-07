import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Express 5 types route params as `string | string[]`. We never declare a repeated
 * param, so collapse it once here rather than asserting at every call site.
 */
export function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/**
 * Wraps async route handlers to catch promise rejections and pass them to
 * the error middleware.
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
