import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { settings } from "../config/settings.js";

interface ProblemRecord {
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

interface ExpectedResultRecord {
  problem_id: string;
  result_hash: string;
  result_rows: string;
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const problemsPath = resolve(__dirname, "../data/problems.json");
const expectedResultsPath = resolve(__dirname, "../data/expected-results.json");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

async function seed(): Promise<void> {
  const pool = new Pool({ connectionString: settings.DATABASE_URL });
  const problems = readJson<ProblemRecord[]>(problemsPath);
  const expectedResults = readJson<ExpectedResultRecord[]>(expectedResultsPath);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const problem of problems) {
      await client.query(
        `INSERT INTO problems (
           problem_id, slug, title, difficulty, pattern, schema_name,
           concepts, problem_statement, query, expected_rule_codes,
           followup_question, debrief_hint, developer_note
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, $11, $12, $13)
         ON CONFLICT (problem_id) DO UPDATE
         SET slug = EXCLUDED.slug,
             title = EXCLUDED.title,
             difficulty = EXCLUDED.difficulty,
             pattern = EXCLUDED.pattern,
             schema_name = EXCLUDED.schema_name,
             concepts = EXCLUDED.concepts,
             problem_statement = EXCLUDED.problem_statement,
             query = EXCLUDED.query,
             expected_rule_codes = EXCLUDED.expected_rule_codes,
             followup_question = EXCLUDED.followup_question,
             debrief_hint = EXCLUDED.debrief_hint,
             developer_note = EXCLUDED.developer_note`,
        [
          problem.problem_id,
          problem.slug ?? null,
          problem.title,
          problem.difficulty ?? null,
          problem.pattern,
          problem.schema,
          JSON.stringify(problem.concepts ?? []),
          problem.problem_statement ?? null,
          problem.query,
          JSON.stringify(problem.expected_rule_codes ?? []),
          problem.followup_question ?? null,
          problem.debrief_hint ?? null,
          problem.developer_note ?? null,
        ],
      );
    }

    for (const expected of expectedResults) {
      await client.query(
        `INSERT INTO expected_results (problem_id, schema_name, result_hash, result_rows)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (problem_id, schema_name) DO UPDATE
         SET result_hash = EXCLUDED.result_hash,
             result_rows = EXCLUDED.result_rows`,
        [expected.problem_id, "ecommerce", expected.result_hash, expected.result_rows],
      );
    }

    // Seed the ecommerce schema
    const ecommerceSeedPath = resolve(__dirname, "ecommerce-seed.sql");
    const ecommerceSeedSql = readFileSync(ecommerceSeedPath, "utf-8");
    await client.query(ecommerceSeedSql);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void seed()
  .then(() => {
    console.log("Seed completed.");
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
