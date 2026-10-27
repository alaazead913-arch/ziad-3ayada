/*
# Create menu and orders schema for n8n chatbot integration

This migration creates the database schema that powers two Supabase Edge Functions
used by an n8n chatbot workflow:
  1. `chatbot-menu` — returns the full menu (categories + sellable products) as JSON.
  2. `chatbot-create-order` — accepts an order payload from the chatbot and inserts it.

## 1. New Tables

### `categories`
- `id` (uuid, primary key)
- `name` (text, not null) — Arabic display name, e.g. "مشويات"
- `parent_id` (uuid, nullable) — self-reference for sub-categories
- `sort_order` (int, default 0) — display ordering
- `active` (boolean, default true)
- `created_at` (timestamptz, default now())

### `products`
- `id` (uuid, primary key)
- `name` (text, not null) — Arabic display name
- `code` (text, not null, unique) — human-readable SKU, e.g. "BRG-01"
- `description` (text, nullable)
- `category_id` (uuid, foreign key -> categories.id)
- `type` (text, not null) — 'ready' | 'manufactured' (chatbot only sells these; raw excluded)
- `base_cost` (numeric, default 0) — last purchase cost
- `price` (numeric, not null) — single sell price (chatbot uses one price per item)
- `available` (numeric, default 0) — stock quantity
- `track_stock` (boolean, default true)
- `active` (boolean, default true) — only active items appear in menu
- `created_at` (timestamptz, default now())

### `orders`
- `id` (uuid, primary key)
- `number` (text, not null, unique) — sequential-looking order number, e.g. "1001"
- `type` (text, not null) — 'dine_in' | 'takeaway' | 'delivery'
- `customer_name` (text, nullable)
- `customer_phone` (text, nullable)
- `delivery_address` (text, nullable)
- `status` (text, not null, default 'paid')
- `subtotal` (numeric, not null, default 0)
- `discount` (numeric, not null, default 0)
- `tax_rate` (numeric, not null, default 14)
- `tax_amount` (numeric, not null, default 0)
- `total` (numeric, not null, default 0)
- `source` (text, not null, default 'pos')
- `note` (text, nullable)
- `created_at` (timestamptz, default now())

### `order_items`
- `id` (uuid, primary key)
- `order_id` (uuid, foreign key -> orders.id ON DELETE CASCADE)
- `product_id` (uuid, foreign key -> products.id)
- `product_name` (text, not null)
- `unit_price` (numeric, not null)
- `qty` (numeric, not null, default 1)
- `line_total` (numeric, not null)
- `note` (text, nullable)
- `created_at` (timestamptz, default now())

## 2. Indexes
- products_category_id_idx, products_active_idx
- orders_number_idx, orders_created_at_idx
- order_items_order_id_idx

## 3. Security
Single-tenant integration; n8n calls the edge functions with the anon key.
RLS enabled on all tables with open policies (USING true / WITH CHECK true)
because the data is intentionally shared between the POS app and the chatbot.
CRUD granted to anon, authenticated.

## 4. Seed Data
Seeds categories and sellable products so the menu endpoint returns real data
on first call.
*/

-- ============================================================================
-- categories
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_categories" ON categories;
CREATE POLICY "anon_select_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
CREATE POLICY "anon_insert_categories" ON categories FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_categories" ON categories;
CREATE POLICY "anon_update_categories" ON categories FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_categories" ON categories;
CREATE POLICY "anon_delete_categories" ON categories FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================================
-- products
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('ready', 'manufactured')),
  base_cost numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  available numeric NOT NULL DEFAULT 0,
  track_stock boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_category_id_idx ON products(category_id);
CREATE INDEX IF NOT EXISTS products_active_idx ON products(active);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================================
-- orders
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('dine_in', 'takeaway', 'delivery')),
  customer_name text,
  customer_phone text,
  delivery_address text,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('open', 'sent', 'paid', 'cancelled', 'returned')),
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 14,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'pos' CHECK (source IN ('pos', 'chatbot')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_number_idx ON orders(number);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================================
-- order_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  product_name text NOT NULL,
  unit_price numeric NOT NULL,
  qty numeric NOT NULL DEFAULT 1,
  line_total numeric NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_items TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_order_items" ON order_items;
CREATE POLICY "anon_select_order_items" ON order_items FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_order_items" ON order_items;
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_order_items" ON order_items;
CREATE POLICY "anon_update_order_items" ON order_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_order_items" ON order_items;
CREATE POLICY "anon_delete_order_items" ON order_items FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================================
-- Seed data: categories (valid uuids)
-- ============================================================================
INSERT INTO categories (id, name, parent_id, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'أكلات', NULL, 1),
  ('a0000000-0000-0000-0000-000000000002', 'مشويات', 'a0000000-0000-0000-0000-000000000001', 2),
  ('a0000000-0000-0000-0000-000000000003', 'ساندوتشات', 'a0000000-0000-0000-0000-000000000001', 3),
  ('a0000000-0000-0000-0000-000000000004', 'مشروبات', NULL, 4),
  ('a0000000-0000-0000-0000-000000000005', 'ساخنة', 'a0000000-0000-0000-0000-000000000004', 5),
  ('a0000000-0000-0000-0000-000000000006', 'باردة', 'a0000000-0000-0000-0000-000000000004', 6),
  ('a0000000-0000-0000-0000-000000000007', 'حلويات', NULL, 7),
  ('a0000000-0000-0000-0000-000000000008', 'إضافات', NULL, 8)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Seed data: products
-- ============================================================================
INSERT INTO products (id, name, code, category_id, type, base_cost, price, available) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'برجر لحم',      'BRG-01', 'a0000000-0000-0000-0000-000000000003', 'manufactured', 28, 65, 120),
  ('b0000000-0000-0000-0000-000000000002', 'زنجر',          'ZNG-01', 'a0000000-0000-0000-0000-000000000003', 'manufactured', 25, 55, 100),
  ('b0000000-0000-0000-0000-000000000003', 'شاورما دجاج',   'SHW-01', 'a0000000-0000-0000-0000-000000000003', 'manufactured', 18, 45, 80),
  ('b0000000-0000-0000-0000-000000000004', 'بيتزا مارجريتا','PZA-01', 'a0000000-0000-0000-0000-000000000001', 'manufactured', 45, 110, 40),
  ('b0000000-0000-0000-0000-000000000005', 'مشاوي مشكلة',   'GRB-01', 'a0000000-0000-0000-0000-000000000002', 'manufactured', 85, 180, 35),
  ('b0000000-0000-0000-0000-000000000006', 'كفتة مشوية',    'KFT-01', 'a0000000-0000-0000-0000-000000000002', 'manufactured', 40, 95, 50),
  ('b0000000-0000-0000-0000-000000000007', 'كولا',          'DRK-01', 'a0000000-0000-0000-0000-000000000006', 'ready', 6, 18, 200),
  ('b0000000-0000-0000-0000-000000000008', 'مياه',          'DRK-02', 'a0000000-0000-0000-0000-000000000006', 'ready', 2, 7, 300),
  ('b0000000-0000-0000-0000-000000000009', 'شاي',           'DRK-03', 'a0000000-0000-0000-0000-000000000005', 'ready', 3, 12, 500),
  ('b0000000-0000-0000-0000-000000000010', 'قهوة',          'DRK-04', 'a0000000-0000-0000-0000-000000000005', 'ready', 8, 25, 150),
  ('b0000000-0000-0000-0000-000000000011', 'عصير برتقال',   'DRK-05', 'a0000000-0000-0000-0000-000000000006', 'manufactured', 12, 30, 60),
  ('b0000000-0000-0000-0000-000000000012', 'بطاطس مقلية',   'SID-01', 'a0000000-0000-0000-0000-000000000008', 'manufactured', 7, 22, 90),
  ('b0000000-0000-0000-0000-000000000013', 'أرز',           'SID-02', 'a0000000-0000-0000-0000-000000000008', 'manufactured', 5, 18, 70),
  ('b0000000-0000-0000-0000-000000000014', 'سلطة',          'SID-03', 'a0000000-0000-0000-0000-000000000008', 'manufactured', 6, 20, 40),
  ('b0000000-0000-0000-0000-000000000015', 'كنافة',         'DST-01', 'a0000000-0000-0000-0000-000000000007', 'manufactured', 15, 40, 25),
  ('b0000000-0000-0000-0000-000000000016', 'كيك شوكولاتة',  'DST-02', 'a0000000-0000-0000-0000-000000000007', 'manufactured', 20, 50, 20)
ON CONFLICT (id) DO NOTHING;
