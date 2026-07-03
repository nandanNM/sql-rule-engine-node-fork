import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/app-error.utils.js";
import { ApiError } from "../utils/api-response.utils.js";

function formatZodError(err: ZodError): string {
  return err.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
}

/**
 * Global error handler. Must be registered LAST, after all routes. Maps known
 * error types to the standard `ApiError` envelope; everything else becomes a 500.
 */
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (res.headersSent) {
    return;
  }

  if (err instanceof ZodError) {
    ApiError(res, formatZodError(err), 400, undefined, "VALIDATION_ERROR");
    return;
  }

  if (err instanceof AppError) {
    ApiError(res, err.message, err.statusCode, err.details, err.errorCode);
    return;
  }

  if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
    ApiError(res, "Unauthorized", 401, undefined, "UNAUTHENTICATED");
    return;
  }

  console.error("Unhandled error:", err);
  ApiError(res, "Internal Server Error", 500);
};
