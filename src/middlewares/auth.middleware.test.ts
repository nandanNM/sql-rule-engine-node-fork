import { describe, expect, it } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware } from "./auth.middleware.js";
import { validate } from "./validate.middleware.js";
import { createAccessToken } from "../utils/jwt.utils.js";
import { AppError } from "../utils/app-error.utils.js";

// These tests exercise pure middleware logic — no database connection is opened.

function spyNext() {
  let called = 0;
  const next = (() => {
    called += 1;
  }) as unknown as NextFunction;
  return { next, calledCount: () => called };
}

describe("authMiddleware", () => {
  const res = {} as Response;

  it("throws 401 when the Authorization header is missing", () => {
    const req = { headers: {} } as Request;
    expect(() => authMiddleware(req, res, spyNext().next)).toThrow(AppError);
  });

  it("throws 401 when the token is malformed/invalid", () => {
    const req = { headers: { authorization: "Bearer not-a-jwt" } } as Request;
    expect(() => authMiddleware(req, res, spyNext().next)).toThrow(AppError);
  });

  it("attaches req.user and calls next() for a valid access token", () => {
    const token = createAccessToken("user-123");
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const { next, calledCount } = spyNext();

    authMiddleware(req, res, next);

    expect((req as unknown as { user: { userId: string } }).user.userId).toBe("user-123");
    expect(calledCount()).toBe(1);
  });
});

describe("validate middleware", () => {
  const res = {} as Response;
  const schema = z.object({ email: z.email(), password: z.string().min(8) });

  it("throws a 400 AppError on invalid body", () => {
    const req = { body: { email: "nope", password: "short" } } as Request;
    try {
      validate(schema)(req, res, spyNext().next);
      throw new Error("expected validate to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("passes valid input and replaces req.body with parsed data", () => {
    const req = { body: { email: "a@b.com", password: "longenough" } } as Request;
    const { next, calledCount } = spyNext();

    validate(schema)(req, res, next);

    expect(calledCount()).toBe(1);
    expect((req.body as { email: string }).email).toBe("a@b.com");
  });
});
