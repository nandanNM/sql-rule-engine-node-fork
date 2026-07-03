import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../utils/app-error.utils.js";

type Source = "body" | "params" | "query";

/**
 * Zod validation middleware. Parses `req[source]` against the schema; on failure
 * throws `AppError(400)` with joined issue messages (surfaced by the global error
 * handler). On success, replaces the source with the parsed/coerced data
 * (except `query`, which is read-only in Express 5).
 */
export const validate =
  (schema: ZodType, source: Source = "body"): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      throw new AppError(message, 400, "VALIDATION_ERROR");
    }

    if (source !== "query") {
      req[source] = result.data as never;
    }
    next();
  };
