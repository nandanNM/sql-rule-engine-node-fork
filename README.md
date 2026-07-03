# SQL Rule Engine (Node.js)

A high-performance Node.js REST API for evaluating, normalizing, and verifying SQL queries against a PostgreSQL database. This service takes SQL queries, analyzes their AST using `node-sql-parser`, enforces syntax rules, and safely runs the query to verify accuracy against a predefined set of problems.

## 🚀 Features
- **SQL Normalization**: Automatically standardizes SQL queries using AST parsing.
- **Rule Engine**: Validates queries against best-practice rules (e.g., no blocked keywords, enforcing SELECT only).
- **Automated Evaluation**: Safely runs queries against isolated schemas (like `ecommerce`).
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
Create a `.env` file from the sample and fill in your connection strings:
```bash
cp .env.sample .env
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

## 📜 Scripts
- `pnpm run dev` - Start dev server with nodemon and tsx
- `pnpm run build` - Compile TypeScript to `./dist`
- `pnpm run db:seed` - Seeds database schemas, problems, and expected hashes
- `pnpm run db:push` - Synchronize Drizzle schema to the database
- `pnpm run db:sandbox` - Provision/refresh the read-only sandbox role
- `pnpm test` - Run the Vitest integration suite
- `pnpm run db:studio` - Open Drizzle Studio to view database contents in the browser
