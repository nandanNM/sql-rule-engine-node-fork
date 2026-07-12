import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { pool, sandboxPool } from "../db/index.js";
import { createAccessToken } from "../utils/jwt.utils.js";

/**
 * HTTP tests for the rule-engine + follow-up endpoints in api.controller.ts.
 *
 * These paths are pure (SQL parsing, hashing, rule matching, the mock explanation
 * evaluator) and never touch Postgres, so this file runs WITHOUT a database — a
 * valid access token is minted locally with createAccessToken. The DB-backed
 * paths (run limit, query execution, final submit) are covered by
 * app.e2e.test.ts, query-executor.test.ts, and submit.e2e.test.ts.
 */

let server: Server;
let base: string;
const token = createAccessToken("test-user-id");

interface ApiOpts {
  method?: string;
  token?: string | null;
  body?: unknown;
  rawBody?: string;
}

async function api(path: string, opts: ApiOpts = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token !== null) headers.Authorization = `Bearer ${opts.token ?? token}`;
  const body = opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined);
  const res = await fetch(base + path, { method: opts.method ?? "POST", headers, body });
  const json = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, json };
}

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  // Pools are constructed at import but never connected in this file; ending them
  // is a safe no-op that guarantees a clean process exit.
  await Promise.allSettled([pool.end(), sandboxPool.end()]);
});

describe("auth guard on /api/* routes", () => {
  const protectedRoutes: Array<[string, string]> = [
    ["POST", "/api/normalize"],
    ["POST", "/api/fingerprint"],
    ["POST", "/api/rules"],
    ["POST", "/api/evaluate"],
    ["POST", "/api/sql/attempts/attempt_1/evaluate-followup"],
  ];

  it.each(protectedRoutes)("%s %s returns 401 without a token", async (method, path) => {
    const { status, json } = await api(path, { method, token: null, body: {} });
    expect(status).toBe(401);
    expect(json.response).toBe(false);
  });

  it("returns 401 for a malformed bearer token", async () => {
    const { status } = await api("/api/normalize", { token: "not-a-jwt", body: { sql: "SELECT 1" } });
    expect(status).toBe(401);
  });
});

describe("POST /api/normalize", () => {
  it("normalizes a valid query", async () => {
    const { status, json } = await api("/api/normalize", { body: { sql: "select   id ,  name from users" } });
    expect(status).toBe(200);
    expect(json.response).toBe(true);
    expect(typeof json.data.normalized_sql).toBe("string");
    expect(json.data.normalized_sql.length).toBeGreaterThan(0);
    expect(json.data.error).toBeNull();
  });

  it("rejects an empty sql string with 400", async () => {
    const { status, json } = await api("/api/normalize", { body: { sql: "" } });
    expect(status).toBe(400);
    expect(json.response).toBe(false);
  });

  it("rejects a missing sql field with 400", async () => {
    const { status } = await api("/api/normalize", { body: {} });
    expect(status).toBe(400);
  });

  it("rejects sql longer than 5000 characters with 400", async () => {
    const { status } = await api("/api/normalize", { body: { sql: `SELECT ${"a".repeat(5001)}` } });
    expect(status).toBe(400);
  });

  it("rejects unparseable SQL with 400", async () => {
    const { status, json } = await api("/api/normalize", { body: { sql: "SELCT FRM WHERE ;;" } });
    expect(status).toBe(400);
    expect(json.response).toBe(false);
  });
});

describe("POST /api/fingerprint", () => {
  const validBody = { sql: "SELECT id FROM users", schema_name: "ecommerce", problem_id: "Q01" };

  it("returns a fingerprint and normalized_sql for a valid request", async () => {
    const { status, json } = await api("/api/fingerprint", { body: validBody });
    expect(status).toBe(200);
    expect(json.data.fingerprint).toMatch(/^Q01:ecommerce:[a-f0-9]{64}$/);
    expect(json.data.normalized_sql).toBeTruthy();
  });

  it("is deterministic — identical input yields an identical fingerprint", async () => {
    const a = await api("/api/fingerprint", { body: validBody });
    const b = await api("/api/fingerprint", { body: validBody });
    expect(a.json.data.fingerprint).toBe(b.json.data.fingerprint);
  });

  it("scopes the fingerprint by problem_id", async () => {
    const a = await api("/api/fingerprint", { body: { ...validBody, problem_id: "Q01" } });
    const b = await api("/api/fingerprint", { body: { ...validBody, problem_id: "Q02" } });
    expect(a.json.data.fingerprint).not.toBe(b.json.data.fingerprint);
  });

  it("defaults to the 'global' scope when problem_id is omitted", async () => {
    const { status, json } = await api("/api/fingerprint", {
      body: { sql: "SELECT id FROM users", schema_name: "ecommerce" },
    });
    expect(status).toBe(200);
    expect(json.data.fingerprint).toMatch(/^global:ecommerce:/);
  });

  it("rejects an invalid schema_name with 400", async () => {
    const { status } = await api("/api/fingerprint", { body: { ...validBody, schema_name: "not_a_schema" } });
    expect(status).toBe(400);
  });

  it("rejects a missing schema_name with 400", async () => {
    const { status } = await api("/api/fingerprint", { body: { sql: "SELECT 1" } });
    expect(status).toBe(400);
  });

  it("rejects unparseable SQL with 400", async () => {
    const { status } = await api("/api/fingerprint", { body: { ...validBody, sql: "NOT SQL @@@" } });
    expect(status).toBe(400);
  });
});

describe("POST /api/rules", () => {
  it("flags SELECT * via the select_star rule", async () => {
    const { status, json } = await api("/api/rules", { body: { sql: "SELECT * FROM users" } });
    expect(status).toBe(200);
    expect(json.data.issues_count).toBeGreaterThanOrEqual(1);
    expect(json.data.issues.map((i: { issue: string }) => i.issue)).toContain("select_star");
  });

  it("reports no issues for a clean, column-scoped query", async () => {
    const { status, json } = await api("/api/rules", { body: { sql: "SELECT id, name FROM users WHERE id = 1" } });
    expect(status).toBe(200);
    expect(json.data.issues_count).toBe(0);
    expect(json.data.issues).toEqual([]);
  });

  it("rejects unparseable SQL with 400", async () => {
    const { status } = await api("/api/rules", { body: { sql: "definitely not sql" } });
    expect(status).toBe(400);
  });
});

describe("POST /api/evaluate — validation layer (pre-DB)", () => {
  // Validation and auth run before consumeRun/executeQuery touch the DB, so these
  // failure cases return without a database. The successful run-limit/execution
  // flow is covered by app.e2e.test.ts.
  it("rejects a missing problem_id with 400", async () => {
    const { status } = await api("/api/evaluate", { body: { sql: "SELECT 1", schema_name: "ecommerce" } });
    expect(status).toBe(400);
  });

  it("rejects an invalid schema_name with 400", async () => {
    const { status } = await api("/api/evaluate", {
      body: { sql: "SELECT 1", schema_name: "bogus", problem_id: "Q01" },
    });
    expect(status).toBe(400);
  });

  it("rejects an empty sql with 400", async () => {
    const { status } = await api("/api/evaluate", { body: { sql: "", schema_name: "ecommerce", problem_id: "Q01" } });
    expect(status).toBe(400);
  });
});

describe("POST /api/sql/attempts/:attemptId/evaluate-followup", () => {
  const path = "/api/sql/attempts/attempt_123/evaluate-followup";

  it("completes evaluation for a detailed answer and returns rubric scores", async () => {
    const answer =
      "The WHERE clause filters individual rows before grouping, while HAVING filters " +
      "the aggregated groups after GROUP BY. I used COUNT(*) to count duplicate emails " +
      "and filtered groups having count greater than one.";
    const { status, json } = await api(path, {
      body: { questionId: "Q01", followupQuestion: "Explain WHERE vs HAVING", answer },
    });
    expect(status).toBe(200);
    expect(json.data.evaluationStatus).toBe("completed");
    expect(json.data.scores).toBeDefined();
    expect(json.data.readiness).toBeTruthy();
  });

  it("marks a too-short answer as not_required", async () => {
    const { status, json } = await api(path, {
      body: { questionId: "Q01", followupQuestion: "Explain", answer: "it filters rows" },
    });
    expect(status).toBe(200);
    expect(json.data.evaluationStatus).toBe("not_required");
  });

  it("treats an XSS-style answer as inert text (returns JSON, never executes it)", async () => {
    const { status, json } = await api(path, {
      body: {
        questionId: "Q01",
        followupQuestion: "Explain",
        answer: "<script>alert('xss')</script> ".repeat(5),
      },
    });
    expect(status).toBe(200);
    expect(json.response).toBe(true);
  });

  it("rejects a missing followupQuestion with 400", async () => {
    const { status } = await api(path, { body: { questionId: "Q01", answer: "some answer" } });
    expect(status).toBe(400);
  });

  it("rejects a missing questionId with 400", async () => {
    const { status } = await api(path, { body: { followupQuestion: "Explain", answer: "some answer" } });
    expect(status).toBe(400);
  });
});

describe("cross-cutting error handling", () => {
  it("returns 404 for an unknown route", async () => {
    const { status, json } = await api("/api/does-not-exist", { method: "GET" });
    expect(status).toBe(404);
    expect(json.response).toBe(false);
  });

  it("returns 400 INVALID_JSON for a malformed JSON body", async () => {
    const { status, json } = await api("/api/normalize", { rawBody: "{ not valid json " });
    expect(status).toBe(400);
    expect(json.response).toBe(false);
    expect(json.error_code).toBe("INVALID_JSON");
  });
});
