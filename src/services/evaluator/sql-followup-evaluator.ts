import type {
  EvaluateSqlFollowupInput,
  ExplanationEvaluation,
  ReadinessLabel,
} from "../../types/api.js";

/**
 * Mock Rule-Based Evaluator for SQL Explanations
 * This service analyzes the student's answer using keyword and pattern detection.
 * In the future, this entire logic can be replaced with a call to the Qwen AI model.
 */
export async function evaluateSqlFollowup(
  input: EvaluateSqlFollowupInput
): Promise<ExplanationEvaluation> {
  try {
    const { answer } = input;
    
    // blank or too short
    const wordCount = answer.trim().split(/\s+/).filter((w) => w.length > 0).length;
    if (wordCount < 10) {
      return {
        evaluationStatus: "not_required",
        evaluatorMetadata: getMetadata(),
      };
    }

    const lowerAnswer = answer.toLowerCase();

    //Mock Rubric Scoring
    let conceptualAccuracy = 0;
    let depth = 0;
    let exampleQuality = 0;
    let edgeCaseAwareness = 0;
    let communicationClarity = 0;

    const strengths: string[] = [];
    const missingPoints: string[] = [];

    //conceptualAccuracy checks
    const mentionsWhere = lowerAnswer.includes("where");
    const mentionsHaving = lowerAnswer.includes("having");
    if (mentionsWhere && mentionsHaving) {
      conceptualAccuracy = 30;
      strengths.push("Correctly differentiates between WHERE and HAVING clauses");
    } else if (mentionsWhere || mentionsHaving) {
      conceptualAccuracy = 15;
      missingPoints.push("Ensure you explain both WHERE and HAVING to show the complete picture");
    } else {
      missingPoints.push("Missing explanation of WHERE and HAVING clauses");
    }

    // depth checks
    const mentionsGroupBy = lowerAnswer.includes("group by") || lowerAnswer.includes("grouping");
    const mentionsAgg = lowerAnswer.includes("sum") || lowerAnswer.includes("count") || lowerAnswer.includes("avg") || lowerAnswer.includes("aggregate");
    if (mentionsGroupBy && mentionsAgg) {
      depth = 25;
      strengths.push("Mentions grouping and aggregation context clearly");
    } else if (mentionsGroupBy || mentionsAgg) {
      depth = 15;
      missingPoints.push("Try to connect grouping (GROUP BY) with aggregation functions (like SUM/COUNT)");
    } else {
      missingPoints.push("Explanation lacks depth regarding grouping and aggregation");
    }

    // exampleQuality checks
    const hasExample = 
      lowerAnswer.includes("sum(") || 
      lowerAnswer.includes("count(") || 
      lowerAnswer.includes("avg(") || 
      (lowerAnswer.includes(">") || lowerAnswer.includes("="));
      
    if (hasExample) {
      exampleQuality = 20;
      strengths.push("Uses a concrete SQL example to illustrate the point");
    } else {
      exampleQuality = 5; // give some base points
      missingPoints.push("Could add a clear GROUP BY and aggregate filtering example");
    }

    // edgeCaseAwareness checks
    const mentionsFilterOrder = lowerAnswer.includes("before") || lowerAnswer.includes("after") || lowerAnswer.includes("filter");
    if (mentionsFilterOrder) {
      edgeCaseAwareness = 15;
      strengths.push("Mentions when filtering happens (before vs after aggregation)");
    } else {
      missingPoints.push("Clarify the order of execution (which filtering happens first)");
    }

    // communicationClarity checks
    if (wordCount >= 20 && (answer.includes(".") || answer.includes(","))) {
      communicationClarity = 10;
    } else {
      communicationClarity = 5;
    }

    // Calculate Total Score and Readiness
    const totalScore = conceptualAccuracy + depth + exampleQuality + edgeCaseAwareness + communicationClarity;
    
    let readiness: ReadinessLabel = "Not Ready";
    if (totalScore >= 85) readiness = "Ready";
    else if (totalScore >= 65) readiness = "Almost Ready";
    else if (totalScore >= 45) readiness = "Building";

    // Determine Next Step
    let nextStep = "Practice explaining aggregate filtering clearly with examples.";
    if (totalScore >= 85) {
      nextStep = "Great job! Keep using clear examples in your explanations.";
    } else if (exampleQuality < 10) {
      nextStep = "Next time, try to include a concrete SQL code snippet in your explanation.";
    } else if (conceptualAccuracy < 30) {
      nextStep = "Revise the exact difference between WHERE and HAVING filters.";
    }

    // 5. Return Completed Evaluation
    return {
      evaluationStatus: "completed",
      scores: {
        conceptualAccuracy,
        depth,
        exampleQuality,
        edgeCaseAwareness,
        communicationClarity,
      },
      readiness,
      strengths,
      missingPoints,
      nextStep,
      evaluatorMetadata: getMetadata(),
    };
  } catch (error) {
    console.error("Evaluator failed:", error);
    return {
      evaluationStatus: "failed",
      evaluatorMetadata: getMetadata(),
    };
  }
}


function getMetadata() {
  return {
    domain: "sql",
    questionType: "sql_followup",
    evaluatorType: "mock_rule_evaluator",
    promptVersion: "v0.1",
    rubricVersion: "sql_followup_v0.1",
  };
}
