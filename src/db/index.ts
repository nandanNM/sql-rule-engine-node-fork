import "@dotenvx/dotenvx/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Privileged pool — used for migrations, seeding, and trusted metadata reads.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // timeout after 10 secs if connection could not be established
  allowExitOnIdle: false,
  ssl:
    process.env.DATABASE_URL?.includes("localhost") || process.env.PGSSLMODE === "disable"
      ? false
      : { rejectUnauthorized: false },
});

export const db = drizzle(pool, {
  schema,
  casing: "snake_case",
});

export type DB = typeof db;

// Sandbox pool — used ONLY to run untrusted, user-submitted SQL. It should point
// at a least-privilege, read-only role (see src/db/setup-sandbox-role.ts). If
// SANDBOX_DATABASE_URL is unset we fall back to the privileged URL and warn, so
// existing dev setups keep working while flagging the missing isolation.
const sandboxConnectionString = process.env.SANDBOX_DATABASE_URL ?? process.env.DATABASE_URL;
if (!process.env.SANDBOX_DATABASE_URL) {
  console.warn(
    "⚠️  SANDBOX_DATABASE_URL is not set — untrusted SQL will run through the privileged DATABASE_URL. " +
      "Provision a read-only role (pnpm run db:sandbox) and set SANDBOX_DATABASE_URL before deploying.",
  );
}

export const sandboxPool = new Pool({
  connectionString: sandboxConnectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: false,
  ssl:
    sandboxConnectionString?.includes("localhost") || process.env.PGSSLMODE === "disable"
      ? false
      : { rejectUnauthorized: false },
});
