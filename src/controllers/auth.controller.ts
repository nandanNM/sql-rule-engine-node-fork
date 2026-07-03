import type { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  rotateSession,
  logoutSession,
  getUserById,
} from "../services/auth/auth.service.js";
import { ApiSuccess } from "../utils/api-response.utils.js";
import { AppError } from "../utils/app-error.utils.js";
import { settings } from "../config/settings.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

const REFRESH_COOKIE = "refreshToken";

// Shared cookie options so login/register/refresh/logout stay in sync.
const refreshCookieOptions = {
  httpOnly: true,
  secure: settings.NODE_ENV === "production",
  sameSite: "lax" as const,
};
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const handleRegister = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };
  const result = await registerUser(email, password);
  res.cookie(REFRESH_COOKIE, result.refreshToken, { ...refreshCookieOptions, maxAge: REFRESH_MAX_AGE_MS });
  ApiSuccess(res, "Registration successful", 201, {
    accessToken: result.accessToken,
    user: result.user,
  });
};

export const handleLogin = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };
  const result = await loginUser(email, password);
  res.cookie(REFRESH_COOKIE, result.refreshToken, { ...refreshCookieOptions, maxAge: REFRESH_MAX_AGE_MS });
  ApiSuccess(res, "Login successful", 200, {
    accessToken: result.accessToken,
    user: result.user,
  });
};

export const handleRefresh = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;
  if (!refreshToken) {
    throw new AppError("Unauthorized", 401, "UNAUTHENTICATED");
  }
  const result = await rotateSession(refreshToken);
  res.cookie(REFRESH_COOKIE, result.refreshToken, { ...refreshCookieOptions, maxAge: REFRESH_MAX_AGE_MS });
  ApiSuccess(res, "Token refreshed", 200, { accessToken: result.accessToken });
};

export const handleLogout = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;
  if (refreshToken) {
    await logoutSession(refreshToken);
  }
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  ApiSuccess(res, "Logged out", 200);
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user?.userId;
  if (!userId) {
    throw new AppError("Unauthorized", 401, "UNAUTHENTICATED");
  }
  const user = await getUserById(userId);
  ApiSuccess(res, "Current user", 200, { user });
};
