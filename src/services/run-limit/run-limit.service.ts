import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { settings } from "../../config/settings.js";
import { AppError } from "../../utils/app-error.utils.js";

export interface RunQuota {
  limit: number;
  used: number;
  remaining: number;
}

/**
 * Atomically consumes one run from a user's per-problem quota.
 *
 * Uses a single conditional upsert so it is race-safe: the counter is only
 * incremented while it is below the limit (the `WHERE` on the `DO UPDATE` skips
 * the increment once the cap is hit, returning zero rows). Throws `AppError(429)`
 * when the quota is exhausted.
 */
export async function consumeRun(
  userId: string,
  problemId: string,
  limit: number = settings.MAX_RUNS_PER_QUESTION,
): Promise<RunQuota> {
  const result = await db.execute(sql`
    INSERT INTO problem_run_counts (user_id, problem_id, run_count, updated_at)
    VALUES (${userId}, ${problemId}, 1, now())
    ON CONFLICT (user_id, problem_id)
    DO UPDATE SET run_count = problem_run_counts.run_count + 1, updated_at = now()
    WHERE problem_run_counts.run_count < ${limit}
    RETURNING run_count
  `);

  const rows = (result as unknown as { rows: Array<{ run_count: number }> }).rows ?? [];

  if (rows.length === 0) {
    throw new AppError(
      `Run limit reached — you can run this question at most ${limit} times.`,
      429,
      "RUN_LIMIT_EXCEEDED",
      { limit, used: limit, remaining: 0 },
    );
  }

  const used = Number(rows[0].run_count);
  return { limit, used, remaining: Math.max(0, limit - used) };
}

/** Current quota usage without consuming a run (for surfacing "runs left" in UIs). */
export async function getRunQuota(
  userId: string,
  problemId: string,
  limit: number = settings.MAX_RUNS_PER_QUESTION,
): Promise<RunQuota> {
  const result = await db.execute(sql`
    SELECT run_count FROM problem_run_counts
    WHERE user_id = ${userId} AND problem_id = ${problemId}
    LIMIT 1
  `);
  const rows = (result as unknown as { rows: Array<{ run_count: number }> }).rows ?? [];
  const used = rows.length ? Number(rows[0].run_count) : 0;
  return { limit, used, remaining: Math.max(0, limit - used) };
}
