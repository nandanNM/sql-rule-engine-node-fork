import "@dotenvx/dotenvx/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.url(),
  // Least-privilege, read-only connection used to run untrusted SQL. Optional so
  // existing setups keep working, but strongly recommended in production. When
  // absent, the executor falls back to DATABASE_URL and logs a warning.
  SANDBOX_DATABASE_URL: z.url().optional(),
  REDIS_URL: z.url().default("redis://localhost:6379"),
  // Sandbox execution guardrails (all applied per-query inside a read-only tx).
  SQL_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  SQL_LOCK_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  SQL_IDLE_IN_TX_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  SQL_MAX_ROWS: z.coerce.number().int().positive().default(10000),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  throw new Error(
    `Invalid environment configuration: ${parsedEnv.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
  );
}

export const settings = parsedEnv.data;
