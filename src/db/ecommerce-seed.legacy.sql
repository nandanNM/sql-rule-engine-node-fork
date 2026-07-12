-- Create read-only user if it doesn't exist
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

-- ===== TABLES =====

CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    city VARCHAR(100),
    country VARCHAR(100),
    created_at DATE
);

CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100),
    description TEXT
);

CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(200),
    category_id INTEGER REFERENCES categories(category_id),
    price DECIMAL(10, 2),
    stock_quantity INTEGER,
    brand VARCHAR(100),
    rating DECIMAL(2, 1)
);

CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id),
    order_date DATE,
    status VARCHAR(50),
    shipping_address VARCHAR(300),
    total_amount DECIMAL(10, 2)
);

CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(order_id),
    product_id INTEGER REFERENCES products(product_id),
    quantity INTEGER,
    unit_price DECIMAL(10, 2)
);

CREATE TABLE reviews (
    review_id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(product_id),
    customer_id INTEGER REFERENCES customers(customer_id),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    review_date DATE
);

-- ===== DATA =====

-- Customers (20 rows)
INSERT INTO customers (first_name, last_name, email, phone, city, country, created_at) VALUES
('James', 'Anderson', 'james.anderson@gmail.com', '+1-212-555-0101', 'New York', 'USA', '2023-01-15'),
('Maria', 'Garcia', 'maria.garcia@yahoo.com', '+1-310-555-0102', 'Los Angeles', 'USA', '2023-02-20'),
('Yuki', 'Tanaka', 'yuki.tanaka@outlook.com', '+81-3-5555-0103', 'Tokyo', 'Japan', '2023-03-05'),
('Priya', 'Sharma', 'priya.sharma@gmail.com', '+91-98765-43210', 'Mumbai', 'India', '2023-03-18'),
('Liam', 'O''Brien', 'liam.obrien@gmail.com', '+44-20-5555-0105', 'London', 'UK', '2023-04-02'),
('Fatima', 'Al-Hassan', 'fatima.alhassan@outlook.com', '+971-50-555-0106', 'Dubai', 'UAE', '2023-04-25'),
('Carlos', 'Mendez', 'carlos.mendez@gmail.com', '+52-55-5555-0107', 'Mexico City', 'Mexico', '2023-05-10'),
('Sophie', 'Dubois', 'sophie.dubois@yahoo.fr', '+33-1-5555-0108', 'Paris', 'France', '2023-05-30'),
('Chen', 'Wei', 'chen.wei@qq.com', '+86-10-5555-0109', 'Beijing', 'China', '2023-06-12'),
('Emma', 'Johansson', 'emma.johansson@gmail.com', '+46-8-555-0110', 'Stockholm', 'Sweden', '2023-06-28'),
('Ahmed', 'Khalil', 'ahmed.khalil@gmail.com', '+20-2-5555-0111', 'Cairo', 'Egypt', '2023-07-14'),
('Olivia', 'Smith', 'olivia.smith@icloud.com', '+1-416-555-0112', 'Toronto', 'Canada', '2023-08-01'),
('Ravi', 'Patel', 'ravi.patel@gmail.com', '+91-22-5555-0113', 'Ahmedabad', 'India', '2023-08-19'),
('Anna', 'Müller', 'anna.mueller@web.de', '+49-30-5555-0114', 'Berlin', 'Germany', '2023-09-03'),
('Lucas', 'Silva', 'lucas.silva@gmail.com', '+55-11-5555-0115', 'São Paulo', 'Brazil', '2023-09-22'),
('Hana', 'Kim', 'hana.kim@naver.com', '+82-2-5555-0116', 'Seoul', 'South Korea', '2023-10-08'),
('David', 'Brown', 'david.brown@gmail.com', '+61-2-5555-0117', 'Sydney', 'Australia', '2023-10-25'),
('Isabella', 'Rossi', 'isabella.rossi@libero.it', '+39-06-5555-0118', 'Rome', 'Italy', '2023-11-11'),
('Mohammed', 'Ali', 'mohammed.ali@gmail.com', '+966-11-555-0119', 'Riyadh', 'Saudi Arabia', '2023-11-29'),
('Elena', 'Volkov', 'mohammed.ali@gmail.com', '+7-495-555-0120', 'Moscow', 'Russia', '2023-12-15');

-- Categories (8 rows)
INSERT INTO categories (category_name, description) VALUES
('Electronics', 'Smartphones, laptops, tablets, and other electronic devices'),
('Clothing', 'Men''s and women''s apparel, shoes, and accessories'),
('Home & Kitchen', 'Furniture, cookware, home décor, and appliances'),
('Books', 'Fiction, non-fiction, educational, and reference books'),
('Sports & Outdoors', 'Fitness equipment, outdoor gear, and sportswear'),
('Beauty & Personal Care', 'Skincare, haircare, makeup, and grooming products'),
('Toys & Games', 'Board games, puzzles, action figures, and educational toys'),
('Grocery & Gourmet', 'Organic foods, snacks, beverages, and specialty items');

-- Products (20 rows)
INSERT INTO products (product_name, category_id, price, stock_quantity, brand, rating) VALUES
('iPhone 15 Pro Max 256GB', 1, 1199.00, 45, 'Apple', 4.7),
('Samsung Galaxy S24 Ultra', 1, 1299.99, 30, 'Samsung', 4.6),
('Sony WH-1000XM5 Headphones', 1, 349.99, 120, 'Sony', 4.8),
('MacBook Air M3 15-inch', 1, 1299.00, 25, 'Apple', 4.9),
('Nike Air Max 270 Running Shoes', 2, 150.00, 200, 'Nike', 4.4),
('Levi''s 501 Original Fit Jeans', 2, 69.50, 180, 'Levi''s', 4.3),
('The North Face Puffer Jacket', 2, 229.00, 75, 'The North Face', 4.5),
('Instant Pot Duo 7-in-1 (6 Qt)', 3, 89.95, 300, 'Instant Pot', 4.7),
('Dyson V15 Detect Vacuum', 3, 749.99, 40, 'Dyson', 4.6),
('KitchenAid Stand Mixer', 3, 379.99, 55, 'KitchenAid', 4.8),
('Atomic Habits by James Clear', 4, 16.99, 500, 'Penguin', 4.9),
('Dune by Frank Herbert', 4, 14.99, 320, 'Ace Books', 4.7),
('Yoga Mat Premium 6mm', 5, 34.99, 400, 'Manduka', 4.5),
('Hydro Flask 32oz Water Bottle', 5, 44.95, 250, 'Hydro Flask', 4.6),
('CeraVe Moisturizing Cream 16oz', 6, 18.99, 600, 'CeraVe', 4.7),
('Ordinary Niacinamide Serum', 6, 11.90, 450, 'The Ordinary', 4.4),
('LEGO Star Wars Millennium Falcon', 7, 169.99, 60, 'LEGO', 4.9),
('Settlers of Catan Board Game', 7, 44.99, 150, 'Catan Studio', 4.7),
('Lavazza Super Crema Espresso 2.2lb', 8, 21.99, 340, 'Lavazza', 4.5),
('Manuka Honey UMF 15+ 500g', 8, 54.99, 80, 'Comvita', 4.6);

-- Orders (20 rows)
INSERT INTO orders (customer_id, order_date, status, shipping_address, total_amount) VALUES
(1, '2024-01-10', 'Delivered', '350 Fifth Ave, New York, NY 10118', 1548.99),
(3, '2024-01-18', 'Delivered', '1-1-1 Shibuya, Tokyo 150-0002', 1299.99),
(5, '2024-02-03', 'Delivered', '221B Baker St, London NW1 6XE', 349.99),
(2, '2024-02-14', 'Delivered', '6801 Hollywood Blvd, Los Angeles, CA 90028', 239.50),
(8, '2024-03-01', 'Delivered', '5 Rue de Rivoli, 75004 Paris', 89.95),
(4, '2024-03-12', 'Delivered', '15 Marine Drive, Mumbai 400002', 1199.00),
(10, '2024-04-05', 'Delivered', 'Drottninggatan 53, 111 21 Stockholm', 424.94),
(6, '2024-04-20', 'Delivered', 'Sheikh Zayed Rd, Dubai, UAE', 749.99),
(12, '2024-05-08', 'Delivered', '100 Queen St W, Toronto, ON M5H 2N2', 31.98),
(7, '2024-05-22', 'Shipped', 'Av. Reforma 222, Mexico City 06600', 150.00),
(9, '2024-06-10', 'Shipped', '1 Wangfujing St, Beijing 100006', 1299.00),
(14, '2024-06-25', 'Shipped', 'Friedrichstraße 43, 10117 Berlin', 214.98),
(11, '2024-07-08', 'Processing', '1 Tahrir Square, Cairo 11511', 69.50),
(15, '2024-07-19', 'Processing', 'Av. Paulista 1578, São Paulo 01310-200', 379.99),
(16, '2024-08-02', 'Processing', '123 Gangnam-daero, Seoul 06070', 169.99),
(13, '2024-08-15', 'Pending', 'CG Road, Ahmedabad, Gujarat 380006', 44.95),
(17, '2024-09-01', 'Pending', '1 George St, Sydney NSW 2000', 1199.00),
(18, '2024-09-14', 'Pending', 'Via del Corso 18, 00186 Rome', 229.00),
(1, '2024-09-28', 'Cancelled', 'King Fahd Rd, Riyadh 12271', 54.99),
(2, '2024-10-05', 'Cancelled', 'Tverskaya St 15, Moscow 125009', 89.95);

-- Order Items (25 rows)
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
(1, 1, 1, 1199.00),
(1, 3, 1, 349.99),
(2, 2, 1, 1299.99),
(3, 3, 1, 349.99),
(4, 6, 1, 69.50),
(4, 13, 1, 34.99),
(4, 16, 1, 11.90),
(5, 8, 1, 89.95),
(6, 1, 1, 1199.00),
(7, 10, 1, 379.99),
(7, 14, 1, 44.95),
(8, 9, 1, 749.99),
(9, 11, 1, 16.99),
(9, 12, 1, 14.99),
(10, 5, 1, 150.00),
(11, 4, 1, 1299.00),
(12, 17, 1, 169.99),
(12, 18, 1, 44.99),
(13, 6, 1, 69.50),
(14, 10, 1, 379.99),
(15, 17, 1, 169.99),
(16, 14, 1, 44.95),
(17, 1, 1, 1199.00),
(18, 7, 1, 229.00),
(19, 20, 1, 54.99);

-- Reviews (20 rows)
INSERT INTO reviews (product_id, customer_id, rating, comment, review_date) VALUES
(1, 1, 5, 'Best iPhone yet. Camera is incredible and battery lasts all day.', '2024-02-01'),
(1, 6, 4, 'Great phone but quite expensive. The titanium frame feels premium.', '2024-05-10'),
(2, 3, 5, 'The S Pen integration is seamless. Best Android phone on the market.', '2024-02-15'),
(3, 5, 5, 'Noise cancellation is absolutely top-notch. Very comfortable for long flights.', '2024-03-10'),
(4, 11, 5, 'Fanless design and the M3 chip makes this incredibly fast and silent.', '2024-08-05'),
(5, 10, 4, 'Very comfortable for running. Good cushioning but runs slightly narrow.', '2024-05-01'),
(6, 13, 4, 'Classic fit, durable denim. Shrinks a bit after first wash.', '2024-08-20'),
(7, 18, 5, 'Kept me warm in -10°C weather. Packs down nicely for travel.', '2024-10-01'),
(8, 8, 5, 'A game changer in the kitchen. Makes perfect rice, soups, and stews.', '2024-04-05'),
(9, 6, 4, 'Powerful suction and the laser dust detection is cool. Pricey though.', '2024-05-15'),
(10, 15, 5, 'Made baking bread so much easier. Sturdy build, worth every penny.', '2024-08-10'),
(11, 12, 5, 'Life-changing book. Practical advice on building better habits.', '2024-06-01'),
(11, 9, 4, 'Good read with actionable tips. Some ideas feel repetitive.', '2024-07-20'),
(12, 12, 5, 'A sci-fi masterpiece. The world-building is unmatched.', '2024-06-15'),
(13, 4, 4, 'Great grip and cushioning. Slightly heavy compared to competitors.', '2024-04-18'),
(15, 2, 5, 'Holy grail moisturizer. Works great on sensitive and dry skin.', '2024-03-20'),
(17, 16, 5, 'Took 8 hours to build but absolutely worth it. Stunning display piece.', '2024-09-05'),
(18, 7, 4, 'Fun strategy game for family nights. Easy to learn, hard to master.', '2024-06-08'),
(19, 10, 4, 'Smooth, rich crema. Great value for specialty espresso beans.', '2024-05-20'),
(20, 19, 3, 'Good quality honey but not sure it justifies the premium price.', '2024-10-15');

-- Grant SELECT on all tables
GRANT SELECT ON ALL TABLES IN SCHEMA ecommerce TO readonly_user;