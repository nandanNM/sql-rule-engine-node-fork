export const SCHEMA_NAMES = ["ecommerce", "banking", "social", "inventory", "analytics"] as const;

export type SchemaName = (typeof SCHEMA_NAMES)[number];

export interface NormalizeRequest {
  sql: string;
}

export interface NormalizeResponse {
  normalized_sql: string | null;
  error: string | null;
}

export interface FingerprintRequest {
  sql: string;
  schema_name: SchemaName;
  problem_id?: string;
}

export interface FingerprintResponse {
  fingerprint: string;
  normalized_sql: string;
}

export interface RulesRequest {
  sql: string;
}

export interface RuleIssue {
  triggered: boolean;
  issue: string;
  category: string;
  explanation: string;
}

export interface RulesResponse {
  normalized_sql: string;
  issues_count: number;
  issues: RuleIssue[];
}

export interface EvaluateRequest {
  sql: string;
  schema_name: SchemaName;
  problem_id: string;
}

export interface QuestionAttempt {
  problem_id?: string;
  raw_sql?: string;
  normalized_sql?: string;
  runtime_status?: string;
  preview_columns?: string[];
  preview_rows?: Record<string, unknown>[];
  row_count?: number;
}

export interface EvaluateResponse {
  cached?: boolean;
  fingerprint?: string;
  result_hash?: string;
  correct?: boolean;
  rule_results?: RuleIssue[];
  feedback?: {
    is_correct: boolean;
    score: number;
    rule_issues: RuleIssue[];
    messages: string[];
  };
  question_attempt?: QuestionAttempt;
  error?: string;
}

// Full internal record — the shape of src/data/problems.json. Includes the
// reference solution (`query`), expected rule codes and developer notes, so it
// must NEVER be sent to a client. Use PublicProblem for API responses.
export interface ProblemRecord {
  problem_id: string;
  slug?: string;
  title: string;
  difficulty?: string;
  pattern: string;
  schema: string;
  concepts?: string[];
  problem_statement?: string;
  query: string;
  expected_rule_codes?: string[];
  followup_question?: string;
  debrief_hint?: string;
  developer_note?: string;
}

// Student-safe projection returned by the public problems API. Deliberately
// omits the reference solution, expected rule codes, debrief hint and developer
// notes so browsing the catalogue can never leak the answer. Field names are
// camelCase to match what the frontend QuestionCard/QuestionExplorer consume.
export interface PublicProblem {
  id: string;
  slug?: string;
  title: string;
  difficulty?: string;
  schemaName: string;
  pattern: string;
  concepts: string[];
  problemStatement?: string;
  followupQuestion?: string;
}





// Final Submit + Debrief Module Types
export type ApprovedRuleCode = 
  | "MISSING_GROUP_BY" | "WRONG_JOIN_TYPE" | "WRONG_JOIN_KEY"
  | "MISSING_FILTER" | "WRONG_AGGREGATION" | "MISSING_HAVING"
  | "WINDOW_TIE_HANDLING_ERROR" | "ORDER_BY_MISSING"
  | "DUPLICATE_ROW_INFLATION" | "NULL_HANDLING_ISSUE" | "UNSAFE_SQL_BLOCKED";

export type ReadinessLabel = "Not Ready" | "Building" | "Almost Ready" | "Ready";

export interface RuleResultDebrief {
  ruleCode: ApprovedRuleCode;
  passed: boolean;
  message: string;
}

export interface RubricScores {
  correctOutput: number;
  sqlLogic: number;
  edgeCase: number;
  readability: number;
  explanationQuality: null;
}

// 3 possible states for evaluation
export type EvaluationStatus = "completed" | "not_required" | "failed";

// The 5 scoring dimensions (total = 100)
export interface ExplanationEvaluationScores {
  conceptualAccuracy: number; // max 30
  depth: number;              // max 25
  exampleQuality: number;     // max 20
  edgeCaseAwareness: number;  // max 15
  communicationClarity: number; // max 10
}

// Metadata about the evaluator itself (helps future Qwen swap)
export interface EvaluatorMetadata {
  domain: string;
  questionType: string;
  evaluatorType: string;
  promptVersion: string;
  rubricVersion: string;
}

// The full evaluator result returned by the evaluator service
export interface ExplanationEvaluation {
  evaluationStatus: EvaluationStatus;
  readiness?: ReadinessLabel;          
  scores?: ExplanationEvaluationScores; 
  strengths?: string[];                 
  missingPoints?: string[];             
  nextStep?: string;                  
  evaluatorMetadata: EvaluatorMetadata;
}

// Input shape for the evaluator function
export interface EvaluateSqlFollowupInput {
  questionId: string;
  attemptId: string;
  followupQuestion: string;
  answer: string;
}

// Combined debrief = SQL feedback + explanation evaluation
export interface CombinedDebriefResponse extends DebriefResponse {
  explanationEvaluation: ExplanationEvaluation;
  overallNextStep: string;
}

export interface DebriefResponse {
  success: boolean;
  attemptId: string;
  sessionQuestionId: string;
  isCorrect: boolean;
  score: number;
  readiness: ReadinessLabel;
  feedbackSummary: string;
  strengths: string[];
  mistakes: string[];
  nextStep: string;
  rubricScores: RubricScores;
  ruleResults: RuleResultDebrief[];
}

export interface ComparisonResult {
  isCorrect: boolean;
  matchedExpectedOutput: boolean;
  detectedRules: Array<{ ruleCode: ApprovedRuleCode; passed: boolean }>;
}
