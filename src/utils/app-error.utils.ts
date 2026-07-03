/**
 * Application-level error carrying an HTTP status code (and optional machine
 * error code / details). Throw it anywhere in a controller/service/middleware
 * and the global error handler turns it into a proper `ApiError` response.
 */
export class AppError extends Error {
  statusCode: number;
  errorCode?: string;
  details?: unknown;

  constructor(message: string, statusCode = 500, errorCode?: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}
