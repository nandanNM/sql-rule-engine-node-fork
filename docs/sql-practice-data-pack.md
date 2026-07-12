# SQL Practice — V2 Data Pack & Problems API

Reference for the CareerCafe **SQL Practice** 8-question launch pack: the sandbox
schema, the per-question seed data and the edge cases it guarantees, the
hash-generation workflow, and the public **Problems API**.

Source of truth lives in:

| File | Purpose |
| --- | --- |
| `src/db/ecommerce-seed.sql` | The `ecommerce` sandbox schema + engineered dataset (V2). |
| `src/db/ecommerce-seed.legacy.sql` | Previous general-purpose dataset, kept for reference. |
| `src/data/problems.json` | The 8 question definitions (full metadata + reference SQL). |
| `src/data/expected-results.json` | Per-question expected-output hash (generated on Postgres). |
| `src/db/seed.ts` | Loads all three into the database. |
| `src/data/update-hashes.ts` | Runs each reference query on Postgres and writes the hashes. |

> **Dialect:** PostgreSQL only. Expected-result hashes must be generated on the
> real Postgres sandbox — never SQLite (date/decimal/window behaviour differs).

---

## 1. Sandbox schema (`ecommerce`)

The seed uses exactly the columns each reference query assumes, so every query in
`problems.json` runs verbatim.

```
customers    (customer_id PK, customer_name, email)
categories   (category_id PK, category_name)
products     (product_id PK, product_name, category_id → categories, price)
orders       (order_id PK, customer_id → customers, order_date, total_amount)
order_items  (order_item_id PK, order_id → orders, product_id → products, quantity, unit_price)
```

**Design note:** `orders.total_amount` is the recorded order total; `order_items`
line revenue (`quantity * unit_price`) is tracked independently for the revenue
analytics questions. No single query joins the two, so they intentionally do not
reconcile — a common real-world denormalization.

---

## 2. The 8 questions

Each row set is engineered so the question's "Developer / Seed Data Note" edge
case is present and the output is deterministic.

| ID | Title | Difficulty | Pattern | Edge case the seed proves | Expected output |
| --- | --- | --- | --- | --- | --- |
| Q01 | Find Duplicate Emails | easy | Duplicate / Data Quality | exact dup + **case-variant** dup + **NULL** email excluded | `asha@example.com`→2, `meera@example.com`→2 |
| Q02 | Second Highest Order Value | medium | Subquery / Aggregation | **tie** at the top (9900 ×2) with lower values below | `9800.00` |
| Q03 | Products Above Average Price | easy | Subquery / Filtering | **NULL** price + product priced **== average** both excluded | Laptop 2000, Tablet 1800, Wireless Mouse 1300, Keyboard 1200 |
| Q04 | Top 3 Products per Category | hard | Ranking / Window | **rank-1 tie** (50000) + **rank-3 boundary tie** → Electronics returns 5 rows | see below |
| Q05 | Customers Who Never Ordered | easy | Joins | one zero-order customer | `5, Zoya, zoya@example.com` |
| Q06 | Orders with Multiple Items | easy | Aggregation + HAVING | single-line vs multi-line + a **1-line order with quantity 5** | order 1→2, 2→3, 4→2 |
| Q07 | Cumulative Revenue | medium | Date / Window | **multiple orders per date**, multiple dates | 4 rows, running total → 44800.00 |
| Q08 | Total Revenue per Customer | medium | Join + Aggregation | zero-order customer **excluded** | Asha 7500, Rohan 4200, … |

**Q04 expected output** (`category_name, product_id, product_name, total_revenue, revenue_rank`):

```
Books          201  SQL Guide       12000.00  1
Books          202  Data Handbook    8000.00  2
Books          203  Python Intro     3000.00  3
Electronics    101  Laptop          50000.00  1   ← tie
Electronics    102  Tablet          50000.00  1   ← tie
Electronics    103  Wireless Mouse  30000.00  2
Electronics    104  Keyboard        20000.00  3   ← rank-3 tie
Electronics    105  Monitor         20000.00  3   ← rank-3 tie (5 rows total)
Home & Kitchen 301  Blender          6000.00  1
Home & Kitchen 302  Toaster          4000.00  2
```

> Row order for hashing follows each query's `ORDER BY` where present; otherwise
> row order is ignored, decimals are rounded to 2 places, dates normalized to
> `YYYY-MM-DD`, and NULLs use a consistent token (see the data-pack normalization
> policy).

---

## 3. Seeding & hash generation

`expected-results.json` ships with **empty hashes on purpose** — they must be
generated against Postgres. Until you complete this, `POST /api/evaluate` returns
`Problem '<id>' not found in expected_results` for every question.

```bash
pnpm run db:push                    # (or db:migrate) add the problems metadata columns
pnpm run db:seed                    # load schema + data + problem definitions
npx tsx src/data/update-hashes.ts   # run each reference query on Postgres, write hashes
pnpm run db:seed                    # apply the freshly generated hashes to the DB
pnpm run db:sandbox                 # re-grant read-only SELECT on the re-seeded schema
```

Re-run all five whenever you change the dataset or any reference query.

---

## 4. Problems API

Two **public** (unauthenticated) endpoints for browsing the catalogue. They return
a **student-safe projection** — the reference solution, expected rule codes,
debrief hint, and developer notes are stripped so browsing can never leak an
answer.

### `GET /api/problems`

List all questions.

**Response `200`** (`{ response, message, data }` envelope):

```json
{
  "response": true,
  "message": "Problems fetched successfully",
  "data": [
    {
      "id": "Q01",
      "slug": "sql_duplicate_email_001",
      "title": "Find Duplicate Emails",
      "difficulty": "easy",
      "schemaName": "ecommerce",
      "pattern": "Duplicate / Data Quality Checks",
      "concepts": ["GROUP BY", "COUNT", "HAVING", "LOWER/TRIM"],
      "problemStatement": "Find email addresses that appear more than once …",
      "followupQuestion": "Why do we use GROUP BY and HAVING …?"
    }
  ]
}
```

```bash
curl http://localhost:8080/api/problems
```

### `GET /api/problems/:problemId`

Fetch one question by id (e.g. `Q01`).

- **`200`** — single object with the same shape as an array element above.
- **`404`** — `{ "response": false, "error": "Problem 'Q99' not found" }`
- **`400`** — invalid `problemId` param.

```bash
curl http://localhost:8080/api/problems/Q01
```

**Fields never exposed by these endpoints:** `query` (reference solution),
`expected_rule_codes`, `debrief_hint`, `developer_note`. They live only in
`problems.json` / the `problems` table and are used server-side for hashing and
evaluation.

### Frontend contract

The projection is camelCase to match the client (`QuestionCard` destructures
`id, difficulty, title, schemaName, concepts`). When wiring the client, point
`NEXT_PUBLIC_API_URL` at `.../api`, call `GET /problems`, and read the array at
`response.data.data`.

---

## 5. Data model — `problems.json`

Each question object (stored in the `problems` table; camelCase columns via
Drizzle):

| Field | Type | Public? | Notes |
| --- | --- | --- | --- |
| `problem_id` | string | ✅ (as `id`) | Primary key, e.g. `Q01`. |
| `slug` | string | ✅ | Data-pack question id, e.g. `sql_duplicate_email_001`. |
| `title` | string | ✅ | |
| `difficulty` | `easy \| medium \| hard` | ✅ | Lowercase (matches client difficulty colours). |
| `pattern` | string | ✅ | One of the fixed SQL patterns. |
| `schema` | string | ✅ (as `schemaName`) | `ecommerce`. |
| `concepts` | string[] | ✅ | SQL concepts exercised. |
| `problem_statement` | string | ✅ | Student-facing prompt. |
| `query` | string | ❌ | **Reference solution.** Executed to generate the hash. |
| `expected_rule_codes` | string[] | ❌ | Rule codes the rule-engine should flag. |
| `followup_question` | string | ✅ | Conceptual follow-up. |
| `debrief_hint` | string | ❌ | Approach hint (shown post-attempt only). |
| `developer_note` | string | ❌ | Seed / hash notes. |

`expected-results.json` entries: `{ problem_id, result_hash, result_rows }` —
both `result_hash` and `result_rows` are written by `update-hashes.ts`.

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Problem 'Q01' not found in expected_results` on `/api/evaluate` | Hashes are still empty (pending) | Run `update-hashes.ts` then re-seed (§3). |
| `column "customer_name" does not exist` when running a reference query | DB still has the legacy dataset | Re-run `pnpm run db:seed` (drops & recreates `ecommerce`). |
| New `problems` columns missing after pulling | Schema not migrated | `pnpm run db:push` (or `db:migrate`). |
| Sandbox query fails with `permission denied` after re-seed | Re-seed dropped/recreated tables | `pnpm run db:sandbox` to re-grant SELECT. |
| Client question grid empty | `NEXT_PUBLIC_API_URL` unset or wrong endpoint/unwrap | Set base URL to `.../api`, call `GET /problems`, read `response.data.data`. |
| Hashes look wrong / non-deterministic | Generated off a non-Postgres engine | Regenerate on the real Postgres sandbox only. |
