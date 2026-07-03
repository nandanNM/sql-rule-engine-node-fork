import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users, authSessions } from "../../db/schema.js";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "../../utils/jwt.utils.js";
import { AppError } from "../../utils/app-error.utils.js";

const BCRYPT_ROUNDS = 12;

export interface PublicUser {
  id: string;
  email: string;
  role: string;
}

interface UserRow {
  id: string;
  email: string;
  role: string;
  passwordHash: string;
  deletedAt: Date | null;
}

const toPublicUser = (user: UserRow): PublicUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
});

// Issues a fresh access + refresh token pair and records the refresh token as
// an active session row (what makes logout/revocation possible).
async function issueSession(user: UserRow) {
  const accessToken = createAccessToken(user.id);
  const refreshToken = createRefreshToken(user.id);
  await db.insert(authSessions).values({ userId: user.id, refreshToken });
  return { user: toPublicUser(user), accessToken, refreshToken };
}

export const registerUser = async (email: string, password: string) => {
  const existing = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (existing) {
    throw new AppError("User already exists", 409, "USER_EXISTS");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const [user] = await db.insert(users).values({ email, passwordHash }).returning();
  if (!user) {
    throw new AppError("Failed to create user", 500);
  }
  return issueSession(user as UserRow);
};

export const loginUser = async (email: string, password: string) => {
  const user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0] as
    | UserRow
    | undefined;
  if (!user || user.deletedAt) {
    throw new AppError("Invalid credentials", 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError("Invalid credentials", 401);
  }
  return issueSession(user);
};

// Stateful refresh with rotation. The token must be (a) validly signed and
// unexpired and (b) present in auth_sessions. A validly-signed token that is NOT
// in the DB is a reuse/revocation signal — drop every session for that user.
export const rotateSession = async (oldRefreshToken: string) => {
  let payload: { userId: string };
  try {
    payload = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw new AppError("Unauthorized", 401, "UNAUTHENTICATED");
  }

  const session = (
    await db.select().from(authSessions).where(eq(authSessions.refreshToken, oldRefreshToken)).limit(1)
  )[0];

  if (!session) {
    await db.delete(authSessions).where(eq(authSessions.userId, payload.userId));
    throw new AppError("Unauthorized", 401, "UNAUTHENTICATED");
  }

  const accessToken = createAccessToken(payload.userId);
  const refreshToken = createRefreshToken(payload.userId);
  await db.update(authSessions).set({ refreshToken }).where(eq(authSessions.id, session.id));
  return { accessToken, refreshToken };
};

// Invalidates a single refresh token (this device/session only). Idempotent.
export const logoutSession = async (refreshToken: string) => {
  await db.delete(authSessions).where(eq(authSessions.refreshToken, refreshToken));
};

export const getUserById = async (userId: string): Promise<PublicUser> => {
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0] as
    | UserRow
    | undefined;
  if (!user || user.deletedAt) {
    throw new AppError("User not found", 404);
  }
  return toPublicUser(user);
};
