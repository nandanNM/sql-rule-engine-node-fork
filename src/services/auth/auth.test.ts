import { afterAll, describe, expect, it } from "vitest";
import { eq, like } from "drizzle-orm";
import { db, pool } from "../../db/index.js";
import { users, authSessions } from "../../db/schema.js";
import { registerUser, loginUser, rotateSession, logoutSession, getUserById } from "./auth.service.js";
import { AppError } from "../../utils/app-error.utils.js";

/**
 * Integration tests for the auth service. Requires the local Postgres with the
 * `users` + `auth_sessions` tables (pnpm run db:push).
 */

const TEST_PREFIX = "authtest+";
let counter = 0;
const uniqueEmail = () => `${TEST_PREFIX}${Date.now()}-${counter++}@example.com`;

afterAll(async () => {
  // Cascades to auth_sessions via the FK.
  await db.delete(users).where(like(users.email, `${TEST_PREFIX}%`));
  await pool.end();
});

async function expectAppError(promise: Promise<unknown>, status: number) {
  try {
    await promise;
    throw new Error("expected the promise to reject");
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(status);
  }
}

describe("registerUser", () => {
  it("creates a user, returns tokens + public user, and records a session", async () => {
    const email = uniqueEmail();
    const result = await registerUser(email, "password123");

    expect(result.user).toMatchObject({ email, role: "user" });
    expect(result.user.id).toBeTruthy();
    expect((result.user as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();

    const sessions = await db.select().from(authSessions).where(eq(authSessions.userId, result.user.id));
    expect(sessions).toHaveLength(1);
    expect(sessions[0].refreshToken).toBe(result.refreshToken);
  });

  it("rejects a duplicate email with 409", async () => {
    const email = uniqueEmail();
    await registerUser(email, "password123");
    await expectAppError(registerUser(email, "password123"), 409);
  });
});

describe("loginUser", () => {
  it("logs in with correct credentials", async () => {
    const email = uniqueEmail();
    await registerUser(email, "password123");
    const result = await loginUser(email, "password123");
    expect(result.user.email).toBe(email);
    expect(result.accessToken).toBeTruthy();
  });

  it("rejects a wrong password with 401", async () => {
    const email = uniqueEmail();
    await registerUser(email, "password123");
    await expectAppError(loginUser(email, "wrong-password"), 401);
  });

  it("rejects an unknown email with 401", async () => {
    await expectAppError(loginUser(uniqueEmail(), "password123"), 401);
  });
});

describe("rotateSession", () => {
  it("rotates the refresh token and invalidates the old one", async () => {
    const { refreshToken: oldToken, user } = await registerUser(uniqueEmail(), "password123");
    const rotated = await rotateSession(oldToken);

    expect(rotated.refreshToken).not.toBe(oldToken);

    const sessions = await db.select().from(authSessions).where(eq(authSessions.userId, user.id));
    expect(sessions).toHaveLength(1);
    expect(sessions[0].refreshToken).toBe(rotated.refreshToken);
  });

  it("treats reuse of an already-rotated token as a breach and wipes all sessions", async () => {
    const { refreshToken: oldToken, user } = await registerUser(uniqueEmail(), "password123");
    await rotateSession(oldToken); // rotates old -> new

    await expectAppError(rotateSession(oldToken), 401); // reuse of old

    const sessions = await db.select().from(authSessions).where(eq(authSessions.userId, user.id));
    expect(sessions).toHaveLength(0);
  });

  it("rejects a garbage refresh token with 401", async () => {
    await expectAppError(rotateSession("not-a-valid-jwt"), 401);
  });
});

describe("logoutSession", () => {
  it("deletes the session row for the given refresh token", async () => {
    const { refreshToken, user } = await registerUser(uniqueEmail(), "password123");
    await logoutSession(refreshToken);
    const sessions = await db.select().from(authSessions).where(eq(authSessions.userId, user.id));
    expect(sessions).toHaveLength(0);
  });
});

describe("getUserById", () => {
  it("returns the public user", async () => {
    const { user } = await registerUser(uniqueEmail(), "password123");
    const fetched = await getUserById(user.id);
    expect(fetched).toEqual({ id: user.id, email: user.email, role: "user" });
  });

  it("rejects an unknown id with 404", async () => {
    await expectAppError(getUserById("00000000-0000-0000-0000-000000000000"), 404);
  });
});
