import nodeSqlParser from "node-sql-parser";
import { SCHEMA_NAMES, type SchemaName } from "../../types/api.js";
import { sandboxPool } from "../../db/index.js";
import { settings } from "../../config/settings.js";

const { Parser } = nodeSqlParser;
const parser = new Parser();

const CURSOR_NAME = "_sandbox_cursor";

export interface ExecuteQueryOptions {
  maxRows?: number;
  statementTimeoutMs?: number;
  lockTimeoutMs?: number;
  idleInTransactionTimeoutMs?: number;
}

export interface ExecuteQueryResult {
  rows: Record<string, unknown>[];
  columns: string[];
  row_count: number;
  execution_time: number;
  truncated: boolean;
  error: string | null;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * AST-level gate: only a single, read-only SELECT is allowed to reach the
 * database. This is the authoritative application-layer guard — we intentionally
 * do NOT rely on naive keyword string matching (which both misses obfuscated
 * writes and false-positives on identifiers like `created_at`/`updated_at`).
 */
function validateSelectOnly(sql: string): string | null {
  let ast: unknown;
  try {
    ast = parser.astify(sql, { database: "PostgreSQL" });
  } catch (err) {
    return `Unable to parse SQL: ${err instanceof Error ? err.message : String(err)}`;
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length !== 1) {
    return "Only a single SELECT statement is allowed.";
  }
  const type = String((statements[0] as { type?: unknown })?.type ?? "").toLowerCase();
  if (type !== "select") {
    return "Only SELECT statements are allowed.";
  }
  return null;
}

/**
 * Safely executes an untrusted, user-submitted SQL query.
 *
 * Defense in depth:
 *   1. Schema name must be on the allow-list.
 *   2. Query must parse to a single SELECT (AST check).
 *   3. Runs on the least-privilege sandbox pool (non-superuser, read-only role).
 *   4. Wrapped in a READ ONLY transaction with statement/lock/idle timeouts.
 *   5. Streamed through a cursor with a hard row cap so a huge result set can't
 *      exhaust process memory.
 *
 * Validation and runtime failures are returned as `error` (never thrown) so the
 * caller can surface a clean 400 rather than a 500.
 */
export async function executeQuery(
  sql: string,
  schemaName: SchemaName,
  options: ExecuteQueryOptions = {},
): Promise<ExecuteQueryResult> {
  const emptyResult: Omit<ExecuteQueryResult, "error" | "execution_time"> = {
    rows: [],
    columns: [],
    row_count: 0,
    truncated: false,
  };

  if (!SCHEMA_NAMES.includes(schemaName)) {
    return { ...emptyResult, execution_time: 0, error: `Invalid schema name: ${schemaName}` };
  }

  const validationError = validateSelectOnly(sql);
  if (validationError) {
    return { ...emptyResult, execution_time: 0, error: validationError };
  }

  const maxRows = options.maxRows ?? settings.SQL_MAX_ROWS;
  const statementTimeoutMs = options.statementTimeoutMs ?? settings.SQL_STATEMENT_TIMEOUT_MS;
  const lockTimeoutMs = options.lockTimeoutMs ?? settings.SQL_LOCK_TIMEOUT_MS;
  const idleTimeoutMs = options.idleInTransactionTimeoutMs ?? settings.SQL_IDLE_IN_TX_TIMEOUT_MS;

  // A trailing semicolon would break the `DECLARE ... CURSOR FOR <sql>` wrapping.
  const cursorSql = sql.trim().replace(/;\s*$/, "");

  const client = await sandboxPool.connect();
  const startedAt = Date.now();

  try {
    await client.query("BEGIN");
    await client.query("SET TRANSACTION READ ONLY");
    await client.query(`SET LOCAL statement_timeout = ${statementTimeoutMs}`);
    await client.query(`SET LOCAL lock_timeout = ${lockTimeoutMs}`);
    await client.query(`SET LOCAL idle_in_transaction_session_timeout = ${idleTimeoutMs}`);
    await client.query(`SET LOCAL search_path TO ${quoteIdent(schemaName)}`);

    await client.query(`DECLARE ${CURSOR_NAME} NO SCROLL CURSOR FOR ${cursorSql}`);
    // Fetch one extra row so we can detect (and report) truncation.
    const result = await client.query(`FETCH FORWARD ${maxRows + 1} FROM ${CURSOR_NAME}`);
    await client.query(`CLOSE ${CURSOR_NAME}`);
    await client.query("COMMIT");

    const fetched = result.rows as Record<string, unknown>[];
    const truncated = fetched.length > maxRows;
    const rows = truncated ? fetched.slice(0, maxRows) : fetched;

    return {
      rows,
      columns: result.fields.map((field) => field.name),
      row_count: rows.length,
      execution_time: (Date.now() - startedAt) / 1000,
      truncated,
      error: null,
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Connection may already be aborted (e.g. after a timeout); ignore.
    }
    return {
      ...emptyResult,
      execution_time: (Date.now() - startedAt) / 1000,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    client.release();
  }
}
