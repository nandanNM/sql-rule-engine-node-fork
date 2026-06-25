interface FeedbackInput {
  isCorrect: boolean;
  ruleIssues: Array<{
    triggered: boolean;
    issue: string;
    category: string;
    explanation: string;
  }>;
}

export function generateFeedback({ isCorrect, ruleIssues }: FeedbackInput) {
  const messages: string[] = [];

  if (isCorrect) {
    messages.push("✅ Your query produces the correct result!");
  } else {
    messages.push("❌ Query output does not match the expected result.");
  }

  if (ruleIssues.length === 0) {
    messages.push("✓ Rule Engine: no issues found.");
  } else {
    ruleIssues.forEach((r) => messages.push(`⚠️ ${r.issue}: ${r.explanation}`));
  }

  return {
    is_correct: isCorrect,
    score: isCorrect ? 100 : 0,
    rule_issues: ruleIssues,
    messages,
  };
}

import type { ComparisonResult, ApprovedRuleCode, ReadinessLabel, DebriefResponse } from "../../types/api.js";

export function generateSqlFeedback(input: {
  finalQuery: string;
  comparisonResult: ComparisonResult;
  ruleSignals: Array<{ ruleCode: ApprovedRuleCode; passed: boolean }>;
  explanationText?: string;
  edgeCaseText?: string;
}): Omit<DebriefResponse, "success" | "attemptId" | "sessionQuestionId"> {
  const { comparisonResult, ruleSignals } = input;

  // 1. Map Rule Signals to Debrief Format
  const ruleResults = ruleSignals.map((r) => ({
    ruleCode: r.ruleCode,
    passed: r.passed,
    message: r.passed ? `Good job avoiding ${r.ruleCode}` : `Failed rule: ${r.ruleCode}`, // Simple message mapping for MVP
  }));

  // 2. Deterministic Scoring Logic for MVP
  let correctOutput = comparisonResult.matchedExpectedOutput ? 30 : 0;
  let sqlLogic = comparisonResult.isCorrect ? 30 : 10;
  let edgeCase = input.edgeCaseText && input.edgeCaseText.length > 10 ? 20 : 0;
  
  // Basic readability check
  const hasFormatting = input.finalQuery.includes("\n") || input.finalQuery.includes("  ");
  let readability = hasFormatting ? 20 : 10;

  // Deduct points for failed rules
  const failedRulesCount = ruleSignals.filter(r => !r.passed).length;
  sqlLogic = Math.max(0, sqlLogic - (failedRulesCount * 5));

  const totalScore = correctOutput + sqlLogic + edgeCase + readability;

  // 3. Readiness Label Mapping
  let readiness: ReadinessLabel = "Not Ready";
  if (totalScore >= 85) readiness = "Ready";
  else if (totalScore >= 70) readiness = "Almost Ready";
  else if (totalScore >= 50) readiness = "Building";

  // 4. Feedback Summary
  let feedbackSummary = "";
  if (totalScore >= 85) {
    feedbackSummary = "Excellent query. You have demonstrated a strong understanding of SQL logic and formatting.";
  } else if (totalScore >= 70) {
    feedbackSummary = "Your query is close, but there are a few areas that need improvement.";
  } else {
    feedbackSummary = "Your query needs significant revision to meet the requirements.";
  }

  // Strengths and mistakes derived from rule signals
  const strengths = ruleSignals.filter(r => r.passed).map(r => `Passed: ${r.ruleCode}`);
  if (comparisonResult.matchedExpectedOutput) strengths.push("Output matched exactly");
  
  const mistakes = ruleSignals.filter(r => !r.passed).map(r => `Issue: ${r.ruleCode}`);
  if (!comparisonResult.matchedExpectedOutput) mistakes.push("Output does not match expected result");

  return {
    isCorrect: comparisonResult.isCorrect,
    score: totalScore,
    readiness,
    feedbackSummary,
    strengths,
    mistakes,
    nextStep: "Review the mistakes and try again.",
    rubricScores: {
      correctOutput,
      sqlLogic,
      edgeCase,
      readability,
      explanationQuality: null,
    },
    ruleResults,
  };
}
