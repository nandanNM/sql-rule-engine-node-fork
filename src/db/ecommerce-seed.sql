-- ============================================================================
-- CareerCafe SQL Practice - V2 "ecommerce" sandbox seed
-- ----------------------------------------------------------------------------
-- Self-contained dataset for the 8 launch questions (Q01-Q08). The schema uses
-- exactly the columns the V2 reference SQL assumes, so every reference query in
-- src/data/problems.json runs verbatim against it.
--
-- The data is purpose-built so each question's "Developer / Seed Data Note"
-- edge case is present and outputs are deterministic:
--   Q1 case-variant + exact duplicate emails, plus a NULL email
--   Q2 tied highest order value (second-highest distinct = 9800.00)
--   Q3 a NULL product price + a product priced exactly at the average
--   Q4 revenue ties at rank 1 and at the rank-3 boundary (Electronics -> 5 rows)
--   Q5 a customer (Zoya) who never ordered
--   Q6 single-line vs multi-line orders, incl. a 1-line order with quantity 5
--   Q7 several orders sharing a date, across multiple dates
--   Q8 the zero-order customer (Zoya) is excluded
--
-- NOTE: orders.total_amount is the recorded order total; order_items line
-- revenue (quantity * unit_price) is tracked independently for the revenue
-- analytics questions (Q4). No single query joins the two, so they need not
-- reconcile -- a common real-world denormalization.
--
-- Regenerate expected-result hashes on the REAL PostgreSQL sandbox after seeding:
--   npx tsx src/data/update-hashes.ts   &&   pnpm run db:seed
-- ============================================================================

-- Create read-only user if it doesn't exist (legacy grant target; the primary
-- sandbox role is provisioned separately by `pnpm run db:sandbox`).
DO $$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE rolname = 'readonly_user') THEN
      CREATE USER readonly_user WITH PASSWORD 'readonly_pass';
   END IF;
END
$$;

-- Drop schema if exists to allow rerunning the seed
DROP SCHEMA IF EXISTS ecommerce CASCADE;

-- Create schema
CREATE SCHEMA ecommerce;

-- Grant read-only access
GRANT USAGE ON SCHEMA ecommerce TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA ecommerce TO readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA ecommerce GRANT SELECT ON TABLES TO readonly_user;

SET search_path TO ecommerce;

-- ===== TABLES (V2 assumed columns) =====

CREATE TABLE customers (
    customer_id   INTEGER PRIMARY KEY,
    customer_name VARCHAR(150),
    email         VARCHAR(255)
);

CREATE TABLE categories (
    category_id   INTEGER PRIMARY KEY,
    category_name VARCHAR(100)
);

CREATE TABLE products (
    product_id   INTEGER PRIMARY KEY,
    product_name VARCHAR(200),
    category_id  INTEGER REFERENCES categories(category_id),
    price        DECIMAL(10, 2)
);

CREATE TABLE orders (
    order_id     INTEGER PRIMARY KEY,
    customer_id  INTEGER REFERENCES customers(customer_id),
    order_date   DATE,
    total_amount DECIMAL(10, 2)
);

CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id      INTEGER REFERENCES orders(order_id),
    product_id    INTEGER REFERENCES products(product_id),
    quantity      INTEGER,
    unit_price    DECIMAL(10, 2)
);

-- ===== DATA =====

-- Customers -- #3/#4 share an email exactly, #6 is a case variant of #1's email,
-- #7 has a NULL email (Q1), and #5 (Zoya) never places an order (Q5, Q8).
INSERT INTO customers (customer_id, customer_name, email) VALUES
(1, 'Asha',       'asha@example.com'),
(2, 'Rohan',      'rohan@example.com'),
(3, 'Meera',      'meera@example.com'),
(4, 'Meera Nair', 'meera@example.com'),
(5, 'Zoya',       'zoya@example.com'),
(6, 'Aditya',     'ASHA@example.com'),
(7, 'Kabir',      NULL),
(8, 'Nisha',      'nisha@example.com');

-- Categories
INSERT INTO categories (category_id, category_name) VALUES
(1, 'Electronics'),
(2, 'Books'),
(3, 'Home & Kitchen');

-- Products -- AVG(price) over non-NULL rows = 1000.00 exactly. Blender is priced
-- at 1000.00 (== average, excluded by strict >) and Monitor has a NULL price (Q3).
INSERT INTO products (product_id, product_name, category_id, price) VALUES
(101, 'Laptop',         1, 2000.00),
(102, 'Tablet',         1, 1800.00),
(103, 'Wireless Mouse', 1, 1300.00),
(104, 'Keyboard',       1, 1200.00),
(105, 'Monitor',        1, NULL),
(106, 'HDMI Cable',     1, 200.00),
(201, 'SQL Guide',      2, 800.00),
(202, 'Data Handbook',  2, 700.00),
(203, 'Python Intro',   2, 500.00),
(301, 'Blender',        3, 1000.00),
(302, 'Toaster',        3, 500.00);

-- Orders -- 9900.00 is TIED across orders 1 & 2 (highest); 9800.00 (order 3) is
-- the second-highest DISTINCT value (Q2). Dates repeat across orders (Q7).
INSERT INTO orders (order_id, customer_id, order_date, total_amount) VALUES
(1, 3, '2024-01-03', 9900.00),
(2, 4, '2024-01-03', 9900.00),
(3, 6, '2024-01-04', 9800.00),
(4, 1, '2024-01-01', 3000.00),
(5, 1, '2024-01-02', 4500.00),
(6, 2, '2024-01-01', 4200.00),
(7, 7, '2024-01-04', 1500.00),
(8, 8, '2024-01-02', 2000.00);

-- Order items -- per-product revenue (SUM(quantity*unit_price)) sets the Q4 ranks:
-- Electronics ties 50000 (rank 1: Laptop, Tablet) and 20000 (rank 3: Keyboard,
-- Monitor). Order 3 is a single line with quantity 5, so its item_count is 1, not
-- 5 (Q6). Orders 1, 2 and 4 carry multiple lines; order 8 (Nisha) carries none.
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
(1, 101, 50, 1000.00),
(1, 102, 50, 1000.00),
(2, 103, 30, 1000.00),
(2, 104, 20, 1000.00),
(2, 105, 20, 1000.00),
(3, 106,  5, 1000.00),
(4, 201, 12, 1000.00),
(4, 202,  8, 1000.00),
(5, 203,  3, 1000.00),
(6, 301,  6, 1000.00),
(7, 302,  4, 1000.00);

-- Grant SELECT on all tables (covers tables created above)
GRANT SELECT ON ALL TABLES IN SCHEMA ecommerce TO readonly_user;
