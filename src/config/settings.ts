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
  // Max number of times a user may run (evaluate) the same problem.
  MAX_RUNS_PER_QUESTION: z.coerce.number().int().positive().default(3),
  // Auth / JWT
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  throw new Error(
    `Invalid environment configuration: ${parsedEnv.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
  );
}

export const settings = parsedEnv.data;
