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

export interface ProblemResponse {
  problem_id: string;
  title: string;
  pattern: string;
  schema: string;
  query: string;
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
