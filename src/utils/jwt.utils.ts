import { randomUUID } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { settings } from "../config/settings.js";

export interface AccessTokenPayload {
  userId: string;
}

export const createAccessToken = (userId: string): string =>
  jwt.sign({ userId }, settings.JWT_SECRET, {
    expiresIn: settings.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
  });

// A unique `jti` guarantees every refresh token is distinct even when issued in
// the same second — essential for stateful rotation and reuse detection.
export const createRefreshToken = (userId: string): string =>
  jwt.sign({ userId }, settings.JWT_REFRESH_SECRET, {
    expiresIn: settings.REFRESH_TOKEN_TTL as SignOptions["expiresIn"],
    jwtid: randomUUID(),
  });

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, settings.JWT_SECRET) as AccessTokenPayload;

export const verifyRefreshToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, settings.JWT_REFRESH_SECRET) as AccessTokenPayload;
