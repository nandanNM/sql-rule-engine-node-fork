import { index, pgTable, text, uniqueIndex, jsonb, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const problems = pgTable("problems", {
  problemId: text("problem_id").primaryKey(),
  title: text("title").notNull(),
  pattern: text("pattern").notNull(),
  schemaName: text("schema_name").notNull(),
  query: text("query").notNull(),
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


// I have added session_questions — tracks a student's question within a session
export const sessionQuestions = pgTable("session_questions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  problemId: text("problem_id").references(() => problems.problemId),
  sessionMode: text("session_mode").notNull().default("interview"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Now I have added attempts — the submission record for a session question
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
