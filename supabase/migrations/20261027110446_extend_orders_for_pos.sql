/*
# Extend orders table for POS integration

The existing `orders` table was created for the chatbot edge function only and
lacks columns the in-app POS needs: cashier info, payment splits, credit flag,
table number, and timestamps for payment / cancel / return.

## 1. Modified tables

### `orders` — added columns
- `cashier_id` (text, nullable) — local POS user id (POS uses mock users, not auth.users)
- `cashier_name` (text, nullable) — denormalized cashier display name
- `table_number` (text, nullable) — dine-in table reference
- `is_credit` (boolean, not null, default false) — true when sold on account
- `paid` (numeric, not null, default 0) — amount actually paid (0 for credit sales)
- `payments` (jsonb, not null, default '[]') — array of { method, amount } splits
- `paid_at` (timestamptz, nullable) — when the order was paid
- `cancel_reason` (text, nullable) — reason if cancelled
- `return_reason` (text, nullable) — reason if returned
- `updated_at` (timestamptz, not null, default now()) — row modification time

### `order_items` — added columns
- `size_name` (text, nullable) — size label (وسط/كبير...) if applicable
- `addons` (jsonb, not null, default '[]') — array of { id, name, price }
- `line_discount` (numeric, not null, default 0) — per-line flat discount

All additions are additive (no drops, no type changes, no renames) so existing
chatbot rows keep working unchanged. Existing policies already use `USING (true)`
/ `WITH CHECK (true)` for `anon, authenticated` and cover the new columns
automatically (grants are table-level, all columns).

## 2. Security
- No policy changes needed: existing open policies already allow anon/authenticated
  CRUD on all columns of orders and order_items.
- No new grants needed: existing table-level grants cover the new columns.

## 3. Notes
- `cashier_id` is plain text (not a uuid FK) because the POS front-end uses mock
  user ids like "u_cash1"; there is no auth.users link in this single-tenant app.
- `payments` and `addons` are jsonb so the POS can store split payments and addon
  selections without extra tables.
- An `updated_at` trigger is NOT added to keep things simple; the POS sets it on
  insert. It exists for future update flows.
*/

-- orders additions
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cashier_id text,
  ADD COLUMN IF NOT EXISTS cashier_name text,
  ADD COLUMN IF NOT EXISTS table_number text,
  ADD COLUMN IF NOT EXISTS is_credit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS return_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- order_items additions
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS size_name text,
  ADD COLUMN IF NOT EXISTS addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS line_discount numeric NOT NULL DEFAULT 0;
