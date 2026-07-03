import "@dotenvx/dotenvx/config";
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { apiRouter } from "./routes/api.js";
import { authRouter } from "./routes/auth.js";
import { problemsRouter } from "./routes/problems.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { ApiSuccess, ApiError } from "./utils/api-response.utils.js";

export function createApp() {
  const app = express();

  // Middleware Setup
  app.use(helmet());
  app.use(morgan("dev"));

  // CORS Configuration — credentials enabled so the httpOnly refresh cookie flows.
  app.use(
    cors({
      origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
      ],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      optionsSuccessStatus: 200,
    }),
  );

  // Body / cookie parsers
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Public routes (no access token required).
  app.use("/api/auth", authRouter);
  app.use("/api/problems", problemsRouter);

  // Everything below requires a valid access token.
  app.use("/api", authMiddleware, apiRouter);

  // Health Check Endpoints
  app.get("/", (_req: Request, res: Response): void => {
    ApiSuccess(res, "Welcome to SQL Rule Engine API", 200, { version: "1.0.0" });
  });

  app.get("/health", (_req: Request, res: Response): void => {
    ApiSuccess(res, "API is running fine", 200, { timestamp: new Date().toISOString() });
  });

  // 404 Handler
  app.use((_req: Request, res: Response): void => {
    ApiError(res, "Route not found", 404);
  });

  // Global error handler — MUST be registered last, after all routes.
  app.use(errorHandler);

  return app;
}
