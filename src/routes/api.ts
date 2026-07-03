import { Router } from "express";
import {
  normalize,
  generateFingerprintController,
  runRulesController,
  evaluateQueryController,
  finalSubmitController,
  evaluateFollowupController,
} from "../controllers/api.controller.js";
import { getRunHistory } from "../controllers/runs.controller.js";
import { asyncHandler } from "../middlewares/async-handler.middleware.js";

// Protected rule-engine routes. Problem browsing lives in the public
// problemsRouter; everything here runs behind authMiddleware (see index.ts).
export const apiRouter = Router();

// SQL normalization
apiRouter.post("/normalize", normalize);

// Fingerprint generation
apiRouter.post("/fingerprint", generateFingerprintController);

// Rules execution
apiRouter.post("/rules", runRulesController);

// Query evaluation (enforces the per-question run quota + logs the run)
apiRouter.post("/evaluate", evaluateQueryController);

// Run history for the authenticated user (optional ?problemId= & ?limit=)
apiRouter.get("/runs", asyncHandler(getRunHistory));

// Final Submit
apiRouter.post("/sql/session-questions/:sessionQuestionId/submit", finalSubmitController);

// Standalone Followup Evaluation
apiRouter.post("/sql/attempts/:attemptId/evaluate-followup", evaluateFollowupController);
