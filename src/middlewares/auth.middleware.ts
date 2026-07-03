import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.utils.js";
import { verifyAccessToken, type AccessTokenPayload } from "../utils/jwt.utils.js";

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
}

/**
 * Verifies the `Authorization: Bearer <accessToken>` header and attaches the
 * decoded payload to `req.user`. Any failure results in a 401. Register this
 * before the routes that require authentication.
 */
export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new AppError("Unauthorized", 401, "UNAUTHENTICATED");
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    throw new AppError("Unauthorized", 401, "UNAUTHENTICATED");
  }

  try {
    (req as AuthenticatedRequest).user = verifyAccessToken(token);
    next();
  } catch {
    throw new AppError("Unauthorized", 401, "UNAUTHENTICATED");
  }
};
