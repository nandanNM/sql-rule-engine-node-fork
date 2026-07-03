import { afterAll, describe, expect, it } from "vitest";
import { executeQuery } from "./query-executor.js";
import { pool, sandboxPool } from "../../db/index.js";
import type { SchemaName } from "../../types/api.js";

/**
 * Integration tests for the sandboxed SQL execution engine.
 *
 * Requires a running Postgres with the `ecommerce` schema seeded and the
 * `sandbox_ro` role provisioned:
 *   pnpm run db:push && pnpm run db:seed && pnpm run db:sandbox
 *
 * They validate BOTH layers of defense:
 *   - the application-layer guards in executeQuery(), and
 *   - the least-privilege guarantees of the sandbox role itself.
 */

afterAll(async () => {
  await sandboxPool.end();
  await pool.end();
});

describe("executeQuery — application-layer guards", () => {
  it("runs a valid SELECT and returns rows + columns", async () => {
    const result = await executeQuery("SELECT email FROM customers", "ecommerce");
    expect(result.error).toBeNull();
    expect(result.columns).toContain("email");
    expect(result.row_count).toBeGreaterThan(0);
    expect(result.rows.length).toBe(result.row_count);
  });

  it.each(["INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE"])(
    "rejects non-SELECT statement: %s",
    async (verb) => {
      const statements: Record<string, string> = {
        INSERT: "INSERT INTO customers (email) VALUES ('x@example.com')",
        UPDATE: "UPDATE customers SET email = 'x@example.com'",
        DELETE: "DELETE FROM customers",
        DROP: "DROP TABLE customers",
        CREATE: "CREATE TABLE hacked (id int)",
        ALTER: "ALTER TABLE customers ADD COLUMN hacked int",
        TRUNCATE: "TRUNCATE TABLE customers",
      };
      const result = await executeQuery(statements[verb], "ecommerce");
      expect(result.error).toMatch(/SELECT/i);
      expect(result.rows).toEqual([]);
    },
  );

  it("does not false-positive on identifiers containing blocked keywords", async () => {
    // `created_at` contains "CREATE" and would have tripped the old substring blocker.
    const result = await executeQuery("SELECT email, created_at FROM customers", "ecommerce");
    expect(result.error).toBeNull();
    expect(result.columns).toEqual(expect.arrayContaining(["created_at"]));
  });

  it("rejects multiple statements", async () => {
    const result = await executeQuery("SELECT 1; SELECT 2", "ecommerce");
    expect(result.error).toMatch(/single SELECT/i);
  });

  it("rejects an unknown / non-allow-listed schema", async () => {
    const result = await executeQuery("SELECT 1", "not_a_real_schema" as SchemaName);
    expect(result.error).toMatch(/Invalid schema/i);
  });

  it("caps the result set at maxRows and flags truncation", async () => {
    const result = await executeQuery("SELECT email FROM customers", "ecommerce", { maxRows: 1 });
    expect(result.error).toBeNull();
    expect(result.rows.length).toBe(1);
    expect(result.truncated).toBe(true);
  });

  it("does not flag truncation when the result fits under maxRows", async () => {
    const result = await executeQuery("SELECT email FROM customers", "ecommerce", { maxRows: 100000 });
    expect(result.error).toBeNull();
    expect(result.truncated).toBe(false);
  });

  it("enforces the statement timeout on long-running queries", async () => {
    const result = await executeQuery("SELECT pg_sleep(5)", "ecommerce", {
      statementTimeoutMs: 150,
    });
    expect(result.error).toMatch(/timeout|canceling statement/i);
    expect(result.rows).toEqual([]);
  });
});

describe("sandbox role — database-layer least privilege", () => {
  it("connects as a non-superuser role", async () => {
    const { rows } = await sandboxPool.query("SELECT current_setting('is_superuser') AS super");
    expect(rows[0].super).toBe("off");
  });

  it("cannot read server files via pg_read_file()", async () => {
    await expect(sandboxPool.query("SELECT pg_read_file('/etc/hostname')")).rejects.toThrow(/permission denied/i);
  });

  it("cannot read password hashes from pg_authid", async () => {
    await expect(sandboxPool.query("SELECT * FROM pg_authid")).rejects.toThrow(/permission denied/i);
  });

  it("cannot read the app's expected_results (no leaking correct answers)", async () => {
    await expect(sandboxPool.query("SELECT * FROM public.expected_results")).rejects.toThrow(/permission denied/i);
  });

  it("cannot create objects", async () => {
    await expect(sandboxPool.query("CREATE TABLE _should_fail (id int)")).rejects.toThrow();
  });

  it("cannot write to seed tables (read-only)", async () => {
    await expect(
      sandboxPool.query("INSERT INTO ecommerce.customers (email) VALUES ('x@example.com')"),
    ).rejects.toThrow();
  });
});
