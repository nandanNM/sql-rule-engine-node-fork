# Step-by-Step Setup Guide

Follow this guide to get the SQL Rule Engine (Node.js) up and running on your local machine. This is ideal for a new developer setting up their environment.

## Step 1: Install Prerequisites
Ensure you have the following installed:
- **Node.js**: v20 or higher.
- **Package Manager**: We use `pnpm` for this project. (`npm install -g pnpm`)
- **PostgreSQL**: A local Postgres server running on port 5432, or a remote Neon connection.
- **Redis**: A local Redis server running on port 6379, or an Upstash/Cloud Redis connection.

## Step 2: Clone & Install Dependencies
1. Navigate to your project directory.
2. Install the necessary packages:
   ```bash
   pnpm install
   ```

## Step 3: Environment Variables
The application needs to connect to Postgres and Redis.
1. Create a `.env` file in the root directory. You can use `.env.sample` as a template.
2. Example configuration for local development:
   ```env
   PORT=8000
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sqlruleengine
   SANDBOX_DATABASE_URL=postgresql://sandbox_ro:sandbox_ro@localhost:5432/sqlruleengine
   REDIS_URL=redis://localhost:6379
   ```
   - `DATABASE_URL` is the **privileged** connection (migrations, seeding).
   - `SANDBOX_DATABASE_URL` is the **least-privilege, read-only** role used to run
     untrusted user SQL. You provision it in Step 5b below.
3. Add the **auth** variables (JWT). Generate strong secrets with `openssl rand -hex 32`:
   ```env
   NODE_ENV=development
   JWT_SECRET=<openssl rand -hex 32>
   JWT_REFRESH_SECRET=<openssl rand -hex 32>
   ACCESS_TOKEN_TTL=15m
   REFRESH_TOKEN_TTL=7d
   MAX_RUNS_PER_QUESTION=3
   ```
   The `users` and `auth_sessions` tables are created by `pnpm run db:push` (Step 4),
   along with `problem_run_counts` (run quota) and `problem_runs` (run history).

## Step 4: Database Setup & Migrations
We use Drizzle ORM for database schema management.

1. **Create the Database** (if using a local database):
   Make sure your target database (e.g., `sqlruleengine`) exists in your local PostgreSQL cluster.
   
2. **Push the Schema**:
   This command creates the necessary tracking tables (`problems` and `expected_results`) based on our Drizzle schema.
   ```bash
   pnpm run db:push
   ```

## Step 5: Seeding the Database
The evaluation engine relies on sample database schemas (e.g., `ecommerce`) and a list of expected SQL output hashes. 

1. **Run the Seeder**:
   ```bash
   pnpm run db:seed
   ```
   **What this does:**
   - Reads `src/db/ecommerce-seed.sql` and creates the `ecommerce` schema with tables like `customers`, `orders`, and `products`.
   - Inserts problem definitions from `src/data/problems.json` into the DB.
   - Inserts the expected result hashes from `src/data/expected-results.json` into the DB.

## Step 5b: Provision the Sandbox Role (Security)
User-submitted SQL is executed through a dedicated **read-only, non-superuser** role so
it cannot write data, read server files, or read the expected answers. Provision it
**after seeding** (it grants `SELECT` on the schemas that now exist):
```bash
pnpm run db:sandbox
```
This reads `DATABASE_URL` (as an admin) and creates/updates the role described by
`SANDBOX_DATABASE_URL`, applying `SELECT`-only grants and a role-level `statement_timeout`.
Re-run it any time you add or re-seed a schema. If you skip it, the app will run untrusted
SQL through the privileged connection and log a warning.

## Step 5c: Run the Tests (Optional but recommended)
```bash
pnpm test
```
The Vitest suite verifies both the application-layer guards (SELECT-only, row cap, timeout)
and the database-layer least-privilege guarantees (no file reads, no writes, no answer leaks).

## Step 6: Updating Hashes (Optional)
If you ever change the data in the `ecommerce` schema or update the queries in `problems.json`, the expected result hashes will become outdated. 
To recalculate and update the hashes for Node.js:
```bash
npx tsx src/data/update-hashes.ts
```
*(After running this, run `pnpm run db:seed` again to apply the new hashes to the database!)*

## Step 7: Start the Server
Start the development server using nodemon and tsx:
```bash
pnpm run dev
```

You should see:
```text
⟐ injecting env (3) from .env
✅ Server running on http://localhost:8000
```

## Step 8: Test the Setup
Verify that the evaluator can properly connect to the DB and execute a rule check. Send a POST request to the `/evaluate` endpoint.

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/evaluate \
-H "Content-Type: application/json" \
-d '{
  "sql": "SELECT email FROM customers GROUP BY email HAVING COUNT(*) > 1;",
  "schema_name": "ecommerce",
  "problem_id": "Q01"
}'
```

If everything is configured correctly, you'll receive a `200 OK` JSON response with `correct: true`!
