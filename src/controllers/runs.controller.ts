import type { Request, Response } from "express";
import { ApiError, ApiSuccess } from "../utils/api-response.utils.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { listRuns } from "../services/run-limit/run-log.service.js";
import { getRunQuota } from "../services/run-limit/run-limit.service.js";

/**
 * GET /api/runs — the authenticated user's run history (most recent first).
 * Optional query: `?problemId=Q01` to filter, `?limit=20` (1..100).
 * When filtered by problem, also returns the remaining run quota.
 */
export const getRunHistory = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user?.userId;
  if (!userId) {
    ApiError(res, "User is not authenticated", 401, undefined, "UNAUTHENTICATED");
    return;
  }

  const problemId = typeof req.query.problemId === "string" ? req.query.problemId : undefined;
  const parsedLimit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;

  const runs = await listRuns(userId, { problemId, limit });
  const quota = problemId ? await getRunQuota(userId, problemId) : undefined;

  ApiSuccess(res, "Run history fetched", 200, {
    runs,
    count: runs.length,
    ...(quota && { run_quota: quota }),
  });
};
