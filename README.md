# SQL Rule Engine (Node.js)

A high-performance Node.js REST API for evaluating, normalizing, and verifying SQL queries against a PostgreSQL database. This service takes SQL queries, analyzes their AST using `node-sql-parser`, enforces syntax rules, and safely runs the query to verify accuracy against a predefined set of problems.

## 🚀 Features
- **JWT Authentication**: Stateful access + rotating refresh tokens (httpOnly cookie), bcrypt password hashing, and route protection middleware.
- **SQL Normalization**: Automatically standardizes SQL queries using AST parsing.
- **Rule Engine**: Validates queries against best-practice rules (e.g., no blocked keywords, enforcing SELECT only).
- **Automated Evaluation**: Safely runs queries against isolated schemas (like `ecommerce`).
- **Run Limiting & Tracking**: Caps executions at `MAX_RUNS_PER_QUESTION` (default 3) per user per problem, and logs every run to a history table.
- **Smart Hashing**: Hashes expected query outputs securely for fast comparison.
- **Caching Mechanism**: Utilizes Redis for rapid, repeated evaluations of identical queries.
- **Fully Type-Safe**: Written in TypeScript using Express, Drizzle ORM, and Zod.

## 📚 Documentation
For complete step-by-step instructions on setting up this project from scratch, see the [Setup Guide](SETUP_GUIDE.md).

## 🛠️ Quick Start

### 1. Requirements
- Node.js (v20+ recommended)
- `pnpm` (Package Manager)
- PostgreSQL (Local or remote)
- Redis

### 2. Environment Setup
Create a `.env` file from the sample and fill in your connection strings and JWT secrets:
```bash
cp .env.sample .env
# generate strong auth secrets
echo "JWT_SECRET=$(openssl rand -hex 32)"          # paste into .env
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"  # paste into .env
```

### 3. Install & Seed
```bash
# Install dependencies
pnpm install

# Push the schema to your database
pnpm run db:push

# Seed the problems, expected results, and the database schemas
pnpm run db:seed

# Provision the least-privilege, read-only role used to run untrusted SQL
pnpm run db:sandbox
```

### 4. Start the Server
```bash
pnpm run dev
```
Server runs on `http://localhost:8000`. Health check: `GET /health`. API routes live under `/api/*`.

## 🔒 Sandboxed SQL Execution
User-submitted SQL never touches the privileged database connection. It runs through
a defense-in-depth sandbox:

1. **AST allow-list** — only a single `SELECT` statement is permitted (verified by
   parsing, not fragile keyword matching).
2. **Least-privilege role** — a dedicated `sandbox_ro` role (provisioned by
   `pnpm run db:sandbox`) that is **not** a superuser, can only `SELECT` from the seed
   schemas, and cannot read server files, `pg_authid`, or the app's `expected_results`.
3. **Read-only transaction** with per-query `statement_timeout`, `lock_timeout`, and
   `idle_in_transaction_session_timeout`.
4. **Row cap** — results are streamed through a cursor and bounded by `SQL_MAX_ROWS`
   so a huge result set can't exhaust memory.

Set `SANDBOX_DATABASE_URL` to the read-only role's connection string. If it's unset the
app falls back to the privileged URL and logs a warning. Guardrails are tunable via
`SQL_STATEMENT_TIMEOUT_MS`, `SQL_LOCK_TIMEOUT_MS`, `SQL_IDLE_IN_TX_TIMEOUT_MS`, and
`SQL_MAX_ROWS` (see `.env.sample`).

Run the test suite (integration tests that verify both layers of the sandbox):
```bash
pnpm test
```

## 🔑 Authentication & Authorization
Auth uses a stateful JWT design (mirrors a rotating-refresh best practice):

- **Access token** (15m) returned in the JSON body (`data.accessToken`) — sent as
  `Authorization: Bearer <token>` on protected requests.
- **Refresh token** (7d) in an httpOnly cookie **and** an `auth_sessions` row. Each
  refresh rotates the token (unique `jti`); a validly-signed token not in the DB is
  treated as reuse and wipes all of that user's sessions.
- Passwords hashed with **bcrypt**. Bodies validated by a zod `validate` middleware;
  errors flow through a global error handler as the standard `{ response:false, error }`.

Set `JWT_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV` (and optional `ACCESS_TOKEN_TTL` /
`REFRESH_TOKEN_TTL`) in `.env` — generate secrets with `openssl rand -hex 32`.

### Route map
| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| POST | `/api/auth/register` | public | → `{ accessToken, user }` + refresh cookie |
| POST | `/api/auth/login` | public | → `{ accessToken, user }` + refresh cookie |
| POST | `/api/auth/refresh` | cookie | rotates refresh, → `{ accessToken }` |
| POST | `/api/auth/logout` | cookie | clears session + cookie |
| GET | `/api/auth/me` | **Bearer** | → `{ user: { id, email, role } }` |
| GET | `/api/problems` | public | list problems |
| GET | `/api/problems/:id` | public | problem detail |
| POST | `/api/normalize` `/rules` `/fingerprint` | **Bearer** | rule-engine helpers |
| POST | `/api/evaluate` | **Bearer** | runs sandboxed SQL; enforces run quota; logs run; → `{ ...result, run_quota }` |
| GET | `/api/runs` | **Bearer** | run history; `?problemId=` & `?limit=` |
| POST | `/api/sql/session-questions/:id/submit` | **Bearer** | final submit (uses `req.user`) |

### Run limiting
`POST /api/evaluate` calls `consumeRun(userId, problemId)` before executing: an atomic,
race-safe conditional upsert on `problem_run_counts` that increments only while under
`MAX_RUNS_PER_QUESTION` (default 3), returning **429 `RUN_LIMIT_EXCEEDED`** once
exhausted. Every run (SQL, correctness, runtime, error) is appended to `problem_runs`
and readable via `GET /api/runs`.

## 📜 Scripts
- `pnpm run dev` - Start dev server with nodemon and tsx
- `pnpm run build` - Compile TypeScript to `./dist`
- `pnpm run db:seed` - Seeds database schemas, problems, and expected hashes
- `pnpm run db:push` - Synchronize Drizzle schema to the database
- `pnpm run db:sandbox` - Provision/refresh the read-only sandbox role
- `pnpm test` - Run the Vitest integration suite
- `pnpm run db:studio` - Open Drizzle Studio to view database contents in the browser
