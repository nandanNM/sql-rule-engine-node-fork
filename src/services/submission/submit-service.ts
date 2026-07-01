import { getMockedComparisonResult } from "./mock-comparison.js";
import { generateSqlFeedback } from "../feedback/feedback-generator.js";
import type { CombinedDebriefResponse } from "../../types/api.js";
import { db } from "../../db/index.js";
import { attempts, sessionQuestions } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { evaluateSqlFollowup } from "../evaluator/sql-followup-evaluator.js";

export async function submitSessionQuestion(
  sessionQuestionId: string,
  userId: string,
  finalQuery: string,
  explanationText: string,
  edgeCaseText: string
): Promise<{ success: boolean; data?: CombinedDebriefResponse; error?: string; errorCode?: string; statusCode?: number }> {
  
  // 1. Check if session question exists
  let sessionRecord = await db.query.sessionQuestions.findFirst({
    where: eq(sessionQuestions.id, sessionQuestionId)
  });

  if (!sessionRecord) {
    // For MVP testing ease, if it doesn't exist, create it on the fly
    const [newSession] = await db.insert(sessionQuestions).values({
      id: sessionQuestionId,
      userId: userId,
      sessionMode: "interview"
    }).returning();
    sessionRecord = newSession;
  }

  // 2. Verify ownership
  if (sessionRecord.userId !== userId) {
    return {
      success: false,
      error: "You do not have permission to submit this question.",
      errorCode: "FORBIDDEN",
      statusCode: 403
    };
  }

  // 3. Check if already submitted
  const existingAttempt = await db.query.attempts.findFirst({
    where: eq(attempts.sessionQuestionId, sessionQuestionId)
  });

  if (existingAttempt) {
    return {
      success: false,
      error: "Final submission already completed for this question.",
      errorCode: "SUBMIT_LIMIT_REACHED",
      statusCode: 409
    };
  }

  try {
    // 4. Get comparison result (mocked for now, replaceable later)
    const comparisonResult = getMockedComparisonResult(finalQuery);

    // 5. Generate Feedback
    const feedbackData = generateSqlFeedback({
      finalQuery,
      comparisonResult,
      ruleSignals: comparisonResult.detectedRules,
      explanationText,
      edgeCaseText
    });

    // 6. Save to DB using Drizzle
    const attemptId = `attempt_${randomUUID()}`;
    await db.insert(attempts).values({
      id: attemptId,
      sessionQuestionId: sessionQuestionId,
      finalQuery: finalQuery,
      explanationText: explanationText,
      edgeCaseText: edgeCaseText,
      isCorrect: feedbackData.isCorrect,
      score: feedbackData.score,
      feedbackSummary: feedbackData.feedbackSummary,
      rubricScores: feedbackData.rubricScores,
      ruleResults: feedbackData.ruleResults
    });

    const explanationEvaluation = await evaluateSqlFollowup({
      questionId: sessionRecord.problemId || "unknown",
      attemptId: attemptId,
      followupQuestion: "Please explain your SQL query and logic.",
      answer: explanationText
    });

    // 8. Return frontend-ready Combined Debrief JSON
    const debrief: CombinedDebriefResponse = {
      success: true,
      attemptId: attemptId,
      sessionQuestionId,
      ...feedbackData,
      explanationEvaluation,
      overallNextStep: explanationEvaluation.nextStep || feedbackData.nextStep
    };

    return { success: true, data: debrief };

  } catch (error) {
    console.error("Feedback generation/DB save failed:", error);
    return {
      success: false,
      error: "Failed to generate feedback for submission.",
      errorCode: "FEEDBACK_FAILED",
      statusCode: 500
    };
  }
}
