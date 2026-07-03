import type { ComparisonResult, ApprovedRuleCode } from "../../types/api.js";

/**
 * Temporary mocked comparison result for MVP.
 * This can be replaced later with the real comparison engine output.
 */
export function getMockedComparisonResult(finalQuery: string): ComparisonResult {
  // Simple heuristic for testing: if it contains HAVING, pass it
  const hasHaving = /HAVING/i.test(finalQuery);

  const detectedRules: Array<{ ruleCode: ApprovedRuleCode; passed: boolean }> = [];

  if (!hasHaving) {
    detectedRules.push({
      ruleCode: "MISSING_HAVING",
      passed: false,
    });
  } else {
    // Add a passed rule just to show it works
    detectedRules.push({
      ruleCode: "MISSING_HAVING",
      passed: true,
    });
  }

  return {
    isCorrect: hasHaving,
    matchedExpectedOutput: hasHaving,
    detectedRules,
  };
}
