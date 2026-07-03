import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { like } from "drizzle-orm";
import { createApp } from "./app.js";
import { db, pool, sandboxPool } from "./db/index.js";
import { users } from "./db/schema.js";

/**
 * End-to-end HTTP tests covering the complete user flow across every route:
 * auth (register/login/me/refresh/logout), public problem browsing, the
 * protected rule engine, the per-question run limit (max 3), and run history.
 *
 * Requires the local Postgres seeded with problems (Q01) + the `ecommerce`
 * schema and the `sandbox_ro` role (pnpm run db:seed && db:sandbox).
 */

const PREFIX = "e2etest+";
const email = `${PREFIX}${Date.now()}@example.com`;
const password = "password123";
const CORRECT_Q01 = "SELECT email FROM customers GROUP BY email HAVING COUNT(*) > 1;";

let server: Server;
let base: string;
let accessToken = "";
let refreshCookie = "";

function extractRefreshCookie(res: Response): string {
  const cookies = res.headers.getSetCookie?.() ?? [];
  const match = cookies.find((c) => c.startsWith("refreshToken="));
  return match ? match.split(";")[0] : "";
}

interface ApiOpts {
  method?: string;
  token?: string;
  cookie?: string;
  body?: unknown;
}

async function api(path: string, opts: ApiOpts = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.cookie) headers.Cookie = opts.cookie;
  const res = await fetch(base + path, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, json, res };
}

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await db.delete(users).where(like(users.email, `${PREFIX}%`));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await Promise.all([pool.end(), sandboxPool.end()]);
});

describe("health & public routes", () => {
  it("GET /health is public", async () => {
    const { status, json } = await api("/health");
    expect(status).toBe(200);
    expect(json.response).toBe(true);
  });

  it("GET /api/problems lists problems without auth", async () => {
    const { status, json } = await api("/api/problems");
    expect(status).toBe(200);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.some((p: { problem_id: string }) => p.problem_id === "Q01")).toBe(true);
  });

  it("GET /api/problems/:id returns a problem without auth", async () => {
    const { status, json } = await api("/api/problems/Q01");
    expect(status).toBe(200);
    expect(json.data.problem_id).toBe("Q01");
  });
});

describe("auth flow", () => {
  it("POST /api/auth/register creates a user and returns a token + cookie", async () => {
    const { status, json, res } = await api("/api/auth/register", { method: "POST", body: { email, password } });
    expect(status).toBe(201);
    expect(json.data.accessToken).toBeTruthy();
    expect(json.data.user.email).toBe(email);
    accessToken = json.data.accessToken;
    refreshCookie = extractRefreshCookie(res);
    expect(refreshCookie).toContain("refreshToken=");
  });

  it("rejects duplicate registration with 409", async () => {
    const { status, json } = await api("/api/auth/register", { method: "POST", body: { email, password } });
    expect(status).toBe(409);
    expect(json.error_code).toBe("USER_EXISTS");
  });

  it("rejects a bad registration body with 400 (validation middleware)", async () => {
    const { status } = await api("/api/auth/register", { method: "POST", body: { email: "nope", password: "x" } });
    expect(status).toBe(400);
  });

  it("GET /api/auth/me requires a token", async () => {
    const { status } = await api("/api/auth/me");
    expect(status).toBe(401);
  });

  it("GET /api/auth/me returns the current user with a token", async () => {
    const { status, json } = await api("/api/auth/me", { token: accessToken });
    expect(status).toBe(200);
    expect(json.data.user.email).toBe(email);
  });

  it("POST /api/auth/login works with correct credentials", async () => {
    const { status, json } = await api("/api/auth/login", { method: "POST", body: { email, password } });
    expect(status).toBe(200);
    expect(json.data.accessToken).toBeTruthy();
  });

  it("POST /api/auth/login rejects a wrong password with 401", async () => {
    const { status } = await api("/api/auth/login", { method: "POST", body: { email, password: "wrong" } });
    expect(status).toBe(401);
  });
});

describe("protected rule engine", () => {
  it("POST /api/evaluate is rejected without a token (401)", async () => {
    const { status } = await api("/api/evaluate", {
      method: "POST",
      body: { sql: CORRECT_Q01, schema_name: "ecommerce", problem_id: "Q01" },
    });
    expect(status).toBe(401);
  });

  it("POST /api/normalize works with a token", async () => {
    const { status, json } = await api("/api/normalize", {
      method: "POST",
      token: accessToken,
      body: { sql: "select 1" },
    });
    expect(status).toBe(200);
    expect(json.data.normalized_sql).toBeTruthy();
  });
});

describe("run limit (max 3 per question) + run tracking", () => {
  it("allows the 1st, 2nd and 3rd runs, decrementing the quota", async () => {
    for (let expectedRemaining = 2; expectedRemaining >= 0; expectedRemaining--) {
      const { status, json } = await api("/api/evaluate", {
        method: "POST",
        token: accessToken,
        body: { sql: CORRECT_Q01, schema_name: "ecommerce", problem_id: "Q01" },
      });
      expect(status).toBe(200);
      expect(json.data.correct).toBe(true);
      expect(json.data.run_quota.remaining).toBe(expectedRemaining);
    }
  });

  it("blocks the 4th run with 429 RUN_LIMIT_EXCEEDED", async () => {
    const { status, json } = await api("/api/evaluate", {
      method: "POST",
      token: accessToken,
      body: { sql: CORRECT_Q01, schema_name: "ecommerce", problem_id: "Q01" },
    });
    expect(status).toBe(429);
    expect(json.error_code).toBe("RUN_LIMIT_EXCEEDED");
  });

  it("GET /api/runs returns the tracked run history", async () => {
    const { status, json } = await api("/api/runs?problemId=Q01", { token: accessToken });
    expect(status).toBe(200);
    expect(json.data.count).toBe(3); // the 4th was blocked before executing, so not logged
    expect(json.data.runs.every((r: { problemId: string; correct: boolean }) => r.problemId === "Q01" && r.correct)).toBe(true);
    expect(json.data.run_quota.remaining).toBe(0);
  });
});

describe("refresh + logout", () => {
  it("POST /api/auth/refresh rotates using the cookie", async () => {
    const { status, json, res } = await api("/api/auth/refresh", { method: "POST", cookie: refreshCookie });
    expect(status).toBe(200);
    expect(json.data.accessToken).toBeTruthy();
    refreshCookie = extractRefreshCookie(res) || refreshCookie;
  });

  it("POST /api/auth/logout clears the session", async () => {
    const { status } = await api("/api/auth/logout", { method: "POST", cookie: refreshCookie });
    expect(status).toBe(200);
  });

  it("a reused (post-logout) refresh token is rejected with 401", async () => {
    const { status } = await api("/api/auth/refresh", { method: "POST", cookie: refreshCookie });
    expect(status).toBe(401);
  });
});
