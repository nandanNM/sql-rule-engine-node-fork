import { index, pgTable, text, uniqueIndex, jsonb, boolean, integer, timestamp, uuid, varchar, primaryKey } from "drizzle-orm/pg-core";

// ============================================================
// Auth: users + stateful refresh sessions
// ============================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("user"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

// One row per active refresh token. A refresh token only works while a matching
// row exists here — this is what makes logout/revocation real.
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshToken: varchar("refresh_token", { length: 500 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("auth_sessions_user_id_idx").on(table.userId)],
);

export const problems = pgTable("problems", {
  problemId: text("problem_id").primaryKey(),
  slug: text("slug"),
  title: text("title").notNull(),
  difficulty: text("difficulty"),
  pattern: text("pattern").notNull(),
  schemaName: text("schema_name").notNull(),
  concepts: jsonb("concepts"),
  problemStatement: text("problem_statement"),
  // `query` is the canonical reference solution (executed to generate the
  // expected-result hash). It is never returned by the public problems API.
  query: text("query").notNull(),
  expectedRuleCodes: jsonb("expected_rule_codes"),
  followupQuestion: text("followup_question"),
  debriefHint: text("debrief_hint"),
  developerNote: text("developer_note"),
});

export const expectedResults = pgTable(
  "expected_results",
  {
    problemId: text("problem_id")
      .notNull()
      .references(() => problems.problemId, { onDelete: "cascade" }),
    schemaName: text("schema_name").notNull(),
    resultHash: text("result_hash").notNull(),
    resultRows: jsonb("result_rows"),
  },
  (table) => [
    index("idx_expected_results_problem_id").on(table.problemId),
    uniqueIndex("uniq_expected_results_problem_schema").on(table.problemId, table.schemaName),
  ],
);

// A student's question within an interview/practice session.
export const sessionQuestions = pgTable("session_questions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  problemId: text("problem_id").references(() => problems.problemId),
  sessionMode: text("session_mode").notNull().default("interview"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Per-user, per-problem execution quota. Caps how many times a user may run
// (evaluate) the same problem — enforced by consumeRun() using MAX_RUNS_PER_QUESTION.
export const problemRunCounts = pgTable(
  "problem_run_counts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    problemId: text("problem_id")
      .notNull()
      .references(() => problems.problemId, { onDelete: "cascade" }),
    runCount: integer("run_count").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.problemId] })],
);

// History log of every rule-engine run (one row per evaluate/execution). Lets us
// track exactly what a user ran against each problem, with result + timing.
export const problemRuns = pgTable(
  "problem_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    problemId: text("problem_id")
      .notNull()
      .references(() => problems.problemId, { onDelete: "cascade" }),
    schemaName: text("schema_name").notNull(),
    sql: text("sql").notNull(),
    correct: boolean("correct"),
    runtimeMs: integer("runtime_ms"),
    error: text("error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("problem_runs_user_id_idx").on(table.userId),
    index("problem_runs_problem_id_idx").on(table.problemId),
  ],
);

// The submission record for a session question.
export const attempts = pgTable("attempts", {
  id: text("id").primaryKey(),
  sessionQuestionId: text("session_question_id")
    .notNull()
    .references(() => sessionQuestions.id, { onDelete: "cascade" }),
  finalQuery: text("final_query"),
  explanationText: text("explanation_text"),
  edgeCaseText: text("edge_case_text"),
  isCorrect: boolean("is_correct"),
  score: integer("score"),
  finalSubmittedAt: timestamp("final_submitted_at").defaultNow(),
  feedbackSummary: text("feedback_summary"),
  rubricScores: jsonb("rubric_scores"),
  ruleResults: jsonb("rule_results"),
});
