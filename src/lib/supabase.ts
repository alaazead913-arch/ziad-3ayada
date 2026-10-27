import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

// Row shapes returned from Supabase (snake_case -> our camelCase app types)
export interface OrderRow {
  id: string;
  number: string;
  type: 'dine_in' | 'takeaway' | 'delivery';
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  table_number: string | null;
  status: 'open' | 'sent' | 'paid' | 'cancelled' | 'returned';
  subtotal: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  paid: number;
  is_credit: boolean;
  payments: { method: string; amount: number }[];
  source: 'pos' | 'chatbot';
  note: string | null;
  cashier_id: string | null;
  cashier_name: string | null;
  cancel_reason: string | null;
  return_reason: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  qty: number;
  line_total: number;
  line_discount: number;
  size_name: string | null;
  addons: { id: string; name: string; price: number }[];
  note: string | null;
}

export interface ProductRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  category_id: string | null;
  type: 'ready' | 'manufactured';
  base_cost: number;
  price: number;
  available: number;
  track_stock: boolean;
  active: boolean;
}
