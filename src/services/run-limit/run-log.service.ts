import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { problemRuns } from "../../db/schema.js";

export interface RecordRunInput {
  userId: string;
  problemId: string;
  schemaName: string;
  sql: string;
  correct: boolean | null;
  runtimeMs: number | null;
  error: string | null;
}

/** Appends a run to the history log. Never throws in a way that should fail the request. */
export async function recordRun(input: RecordRunInput): Promise<void> {
  await db.insert(problemRuns).values({
    userId: input.userId,
    problemId: input.problemId,
    schemaName: input.schemaName,
    sql: input.sql,
    correct: input.correct,
    runtimeMs: input.runtimeMs,
    error: input.error,
  });
}

export interface ListRunsOptions {
  problemId?: string;
  limit?: number;
}

/** Returns a user's run history, most recent first, optionally filtered by problem. */
export async function listRuns(userId: string, options: ListRunsOptions = {}) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const where = options.problemId
    ? and(eq(problemRuns.userId, userId), eq(problemRuns.problemId, options.problemId))
    : eq(problemRuns.userId, userId);

  return db.select().from(problemRuns).where(where).orderBy(desc(problemRuns.createdAt)).limit(limit);
}
