import "@dotenvx/dotenvx/config";
import { Pool } from "pg";
import { SCHEMA_NAMES } from "../types/api.js";

/**
 * Idempotently provisions the least-privilege PostgreSQL role that the API uses
 * to execute untrusted, user-submitted SQL.
 *
 * The role is:
 *   - NOT a superuser (so it cannot read server files, pg_authid, etc.)
 *   - unable to create objects or write data
 *   - granted SELECT only on the seed schemas that exist
 *   - forced read-only by default and bounded by a statement_timeout
 *
 * Run with an admin/superuser DATABASE_URL AFTER the schemas have been seeded:
 *   pnpm run db:sandbox
 */

function ident(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Refusing to build SQL with unsafe identifier: ${name}`);
  }
  return `"${name}"`;
}

function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function parseSandboxCreds(url: string): { user: string; password: string; database: string } {
  const parsed = new URL(url);
  return {
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  };
}

async function main(): Promise<void> {
  const adminUrl = process.env.DATABASE_URL;
  const sandboxUrl = process.env.SANDBOX_DATABASE_URL;

  if (!adminUrl) {
    throw new Error("DATABASE_URL is required to provision the sandbox role.");
  }
  if (!sandboxUrl) {
    throw new Error(
      "SANDBOX_DATABASE_URL is required. Set it to the read-only role's connection string, e.g. " +
        "postgresql://sandbox_ro:<password>@host:5432/sqlruleengine",
    );
  }

  const { user, password, database } = parseSandboxCreds(sandboxUrl);
  if (!user || !password) {
    throw new Error("SANDBOX_DATABASE_URL must include both a username and a password.");
  }

  const statementTimeout = process.env.SQL_STATEMENT_TIMEOUT_MS ?? "5000";
  const idleTimeout = process.env.SQL_IDLE_IN_TX_TIMEOUT_MS ?? "10000";

  const pool = new Pool({
    connectionString: adminUrl,
    ssl: adminUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  const client = await pool.connect();

  try {
    const role = ident(user);

    // 1. Create or update the role (idempotent), locked down to a bare login.
    const existing = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [user]);
    const attrs = "LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS";
    if (existing.rowCount === 0) {
      await client.query(`CREATE ROLE ${role} ${attrs}`);
    } else {
      await client.query(`ALTER ROLE ${role} ${attrs}`);
    }
    await client.query(`ALTER ROLE ${role} PASSWORD ${literal(password)}`);

    // 2. Role-level safety defaults — apply to every connection this role opens.
    await client.query(`ALTER ROLE ${role} SET statement_timeout = ${literal(statementTimeout)}`);
    await client.query(`ALTER ROLE ${role} SET idle_in_transaction_session_timeout = ${literal(idleTimeout)}`);
    await client.query(`ALTER ROLE ${role} SET default_transaction_read_only = on`);

    // 3. Allow connecting to the target database only.
    await client.query(`GRANT CONNECT ON DATABASE ${ident(database)} TO ${role}`);

    // 4. Lock the role out of the public schema (where the app's tracking tables
    //    such as expected_results live — users must not read expected answers).
    await client.query(`REVOKE ALL ON SCHEMA public FROM ${role}`);
    await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${role}`);

    // 5. Grant read-only access to each seed schema that actually exists.
    let grantedCount = 0;
    for (const schema of SCHEMA_NAMES) {
      const schemaExists = await client.query("SELECT 1 FROM information_schema.schemata WHERE schema_name = $1", [
        schema,
      ]);
      if (schemaExists.rowCount === 0) {
        continue;
      }
      const s = ident(schema);
      await client.query(`GRANT USAGE ON SCHEMA ${s} TO ${role}`);
      await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA ${s} TO ${role}`);
      // Ensure tables created later (e.g. by re-seeding) are also readable.
      await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${s} GRANT SELECT ON TABLES TO ${role}`);
      grantedCount += 1;
      console.log(`  ✓ read-only SELECT granted on schema "${schema}"`);
    }

    if (grantedCount === 0) {
      console.warn("  ⚠️  No seed schemas found to grant on. Run `pnpm run db:seed` first, then re-run this.");
    }

    console.log(
      `✅ Sandbox role "${user}" provisioned: non-superuser, read-only, ` +
        `statement_timeout=${statementTimeout}ms, ${grantedCount} schema(s) readable.`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Sandbox role setup failed:", error);
  process.exit(1);
});
