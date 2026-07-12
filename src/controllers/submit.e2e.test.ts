import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { like } from "drizzle-orm";
import { createApp } from "../app.js";
import { db, pool, sandboxPool } from "../db/index.js";
import { users, sessionQuestions } from "../db/schema.js";

/**
 * Integration tests for POST /api/sql/session-questions/:id/submit.
 *
 * Requires a live Postgres with the auth + session_questions + attempts tables
 * (pnpm run db:push). The feedback + explanation evaluators it calls are pure
 * mocks (no external AI), so Postgres is the only dependency. Test rows are keyed
 * by a prefix and removed in afterAll.
 */

const EMAIL_PREFIX = "submittest+";
const SESSION_PREFIX = "e2e-submit-sq-";
let counter = 0;
const uniqueSessionId = () => `${SESSION_PREFIX}${Date.now()}-${counter++}`;

let server: Server;
let base: string;

interface ApiOpts {
  method?: string;
  token?: string;
  body?: unknown;
}

async function api(path: string, opts: ApiOpts = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(base + path, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, json };
}

async function registerUser() {
  const email = `${EMAIL_PREFIX}${Date.now()}-${counter++}@example.com`;
  const { json } = await api("/api/auth/register", { body: { email, password: "password123" } });
  return { token: json.data.accessToken as string, userId: json.data.user.id as string };
}

let userA: { token: string; userId: string };
let userB: { token: string; userId: string };

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  userA = await registerUser();
  userB = await registerUser();
});

afterAll(async () => {
  // attempts cascade-delete when their parent session_questions row is removed.
  await db.delete(sessionQuestions).where(like(sessionQuestions.id, `${SESSION_PREFIX}%`));
  await db.delete(users).where(like(users.email, `${EMAIL_PREFIX}%`));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await Promise.allSettled([pool.end(), sandboxPool.end()]);
});

const submitPath = (sessionId: string) => `/api/sql/session-questions/${sessionId}/submit`;
const validBody = {
  finalQuery: "SELECT email FROM customers GROUP BY email HAVING COUNT(*) > 1",
  explanationText: "I grouped by email and used HAVING COUNT(*) > 1 to keep only duplicated addresses.",
  edgeCaseText: "Emails are compared case-sensitively; nulls are excluded by GROUP BY.",
};

describe("auth + validation", () => {
  it("returns 401 without a token", async () => {
    const { status } = await api(submitPath(uniqueSessionId()), { body: validBody, token: undefined });
    expect(status).toBe(401);
  });

  it("returns 400 when finalQuery is missing", async () => {
    const { status, json } = await api(submitPath(uniqueSessionId()), {
      token: userA.token,
      body: { explanationText: "no query provided" },
    });
    expect(status).toBe(400);
    expect(json.response).toBe(false);
  });
});

describe("submission flow", () => {
  it("creates the session on the fly and returns a combined debrief", async () => {
    const sessionId = uniqueSessionId();
    const { status, json } = await api(submitPath(sessionId), { token: userA.token, body: validBody });

    expect(status).toBe(200);
    expect(json.response).toBe(true);
    expect(json.data.attemptId).toMatch(/^attempt_/);
    expect(json.data.sessionQuestionId).toBe(sessionId);
    expect(json.data.explanationEvaluation).toBeDefined();
    expect(json.data.explanationEvaluation.evaluationStatus).toBeDefined();
  });

  it("rejects a second submission for the same question with 409", async () => {
    const sessionId = uniqueSessionId();
    const first = await api(submitPath(sessionId), { token: userA.token, body: validBody });
    expect(first.status).toBe(200);

    const second = await api(submitPath(sessionId), { token: userA.token, body: validBody });
    expect(second.status).toBe(409);
    expect(second.json.error_code).toBe("SUBMIT_LIMIT_REACHED");
  });

  it("rejects submitting another user's session with 403", async () => {
    const sessionId = uniqueSessionId();
    // userA implicitly creates + owns the session via the on-the-fly insert.
    const owned = await api(submitPath(sessionId), { token: userA.token, body: validBody });
    expect(owned.status).toBe(200);

    // userB now tries to submit against userA's existing session.
    const { status, json } = await api(submitPath(sessionId), { token: userB.token, body: validBody });
    expect(status).toBe(403);
    expect(json.error_code).toBe("FORBIDDEN");
  });
});
