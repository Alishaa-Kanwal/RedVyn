import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "./error";

/** Parses req.body through a zod schema and replaces it with the typed result. */
export function validate<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return next(new AppError(`${first?.path.join(".") ?? "input"}: ${first?.message}`));
    }
    req.body = parsed.data;
    next();
  };
}
