import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import type { ProblemRecord, PublicProblem } from "../../types/api.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

function getProblemsFilePath(): string {
  return resolve(__dirname, "../../data/problems.json");
}

let cachedProblems: ProblemRecord[] | null = null;

/**
 * Loads all question records from `src/data/problems.json` (cached after first read).
 *
 * These are the FULL internal records — they include the reference solution
 * (`query`), expected rule codes and developer notes. Never return them directly
 * from an HTTP handler; project to {@link PublicProblem} via {@link getPublicProblems}
 * first. Use this only server-side (e.g. seeding, evaluation tooling).
 *
 * @returns Every question definition, in file order.
 */
export function getProblems(): ProblemRecord[] {
  if (!cachedProblems) {
    cachedProblems = readJsonFile<ProblemRecord[]>(getProblemsFilePath());
  }
  return cachedProblems;
}

/**
 * Finds one full internal question record by its primary id.
 *
 * @param problemId - The question id, e.g. `"Q01"`.
 * @returns The full record, or `undefined` if no question has that id.
 */
export function getProblemById(problemId: string): ProblemRecord | undefined {
  return getProblems().find((problem) => problem.problem_id === problemId);
}

/**
 * Projects a full record onto the student-safe shape, dropping every
 * answer-revealing / internal field (`query`, `expected_rule_codes`,
 * `debrief_hint`, `developer_note`) and mapping to the camelCase field names the
 * frontend consumes.
 */
function toPublicProblem(problem: ProblemRecord): PublicProblem {
  return {
    id: problem.problem_id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    schemaName: problem.schema,
    pattern: problem.pattern,
    concepts: problem.concepts ?? [],
    problemStatement: problem.problem_statement,
    followupQuestion: problem.followup_question,
  };
}

/**
 * Returns every question as a student-safe {@link PublicProblem}. Safe to send
 * from a public HTTP handler — the reference solution and other internal fields
 * are stripped.
 *
 * @returns The full catalogue in projection form.
 * @example
 * ```ts
 * app.get("/api/problems", (_req, res) => res.json({ data: getPublicProblems() }));
 * ```
 */
export function getPublicProblems(): PublicProblem[] {
  return getProblems().map(toPublicProblem);
}

/**
 * Returns one student-safe {@link PublicProblem} by id.
 *
 * @param problemId - The question id, e.g. `"Q01"`.
 * @returns The projected question, or `undefined` if not found.
 */
export function getPublicProblemById(problemId: string): PublicProblem | undefined {
  const problem = getProblemById(problemId);
  return problem ? toPublicProblem(problem) : undefined;
}
