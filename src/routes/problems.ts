import { Router } from "express";
import { getAllProblems, getProblemByIdController } from "../controllers/api.controller.js";

// Public problem browsing — no authentication required.
export const problemsRouter = Router();

problemsRouter.get("/", getAllProblems);
problemsRouter.get("/:problemId", getProblemByIdController);

export default problemsRouter;
