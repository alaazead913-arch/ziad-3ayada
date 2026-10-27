import { supabase, type OrderRow, type OrderItemRow, type ProductRow } from '@/lib/supabase';
import type { Order, OrderLine, Product } from '@/types';

// Map DB product code -> uuid, so POS lines (which use mock product ids) can
// be resolved to the real product uuid when inserting order_items.
export async function fetchDbProductMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('products')
    .select('id, code');
  if (error || !data) return new Map();
  return new Map(data.map((p) => [(p as ProductRow).code, p.id]));
}

// Convert DB rows -> app Order type
function toOrder(row: OrderRow, items: OrderItemRow[]): Order {
  const lines: OrderLine[] = items.map((it) => ({
    id: it.id,
    productId: it.product_id,
    productName: it.product_name,
    sizeId: 's_only',
    sizeName: it.size_name ?? 'عادي',
    unitPrice: Number(it.unit_price),
    qty: Number(it.qty),
    note: it.note ?? undefined,
    addons: it.addons ?? [],
    lineDiscount: Number(it.line_discount),
    lineTotal: Number(it.line_total),
  }));

  return {
    id: row.id,
    number: row.number,
    type: row.type,
    deliveryKind: undefined,
    tableNumber: row.table_number ?? undefined,
    customerName: row.customer_name ?? undefined,
    customerPhone: row.customer_phone ?? undefined,
    deliveryAddress: row.delivery_address ?? undefined,
    status: row.status,
    lines,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    taxAmount: Number(row.tax_amount),
    total: Number(row.total),
    paid: Number(row.paid),
    payments: (row.payments ?? []).map((p) => ({
      method: p.method as any,
      amount: Number(p.amount),
    })),
    isCredit: row.is_credit,
    cashierId: row.cashier_id ?? '',
    cashierName: row.cashier_name ?? 'شات بوت',
    createdAt: row.created_at,
    paidAt: row.paid_at ?? undefined,
    cancelReason: row.cancel_reason ?? undefined,
    returnReason: row.return_reason ?? undefined,
  };
}

export async function fetchOrdersFromDb(): Promise<Order[]> {
  const [{ data: orders, error: oErr }, ] = await Promise.all([
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(500),
  ]);

  if (oErr || !orders) return [];

  const rows = orders as OrderRow[];
  if (rows.length === 0) return [];

  // Fetch all items for these orders in one query
  const orderIds = rows.map((r) => r.id);
  const { data: items, error: iErr } = await supabase
    .from('order_items')
    .select('*')
    .in('order_id', orderIds);

  if (iErr || !items) return rows.map((r) => toOrder(r as OrderRow, []));

  const itemRows = items as OrderItemRow[];
  const itemsByOrder = new Map<string, OrderItemRow[]>();
  for (const it of itemRows) {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push(it);
    itemsByOrder.set(it.order_id, arr);
  }

  return rows.map((r) => toOrder(r as OrderRow, itemsByOrder.get(r.id) ?? []));
}

// Find the DB product uuid for a POS cart line by looking up the product code
function resolveProductUuid(
  lineProductId: string,
  appProducts: Product[],
  dbMap: Map<string, string>,
): string | null {
  const prod = appProducts.find((p) => p.id === lineProductId);
  if (!prod) return null;
  return dbMap.get(prod.code) ?? null;
}

export async function saveOrderToDb(
  order: Order,
  appProducts: Product[],
  dbMap: Map<string, string>,
): Promise<{ success: boolean; error?: string }> {
  // Generate next order number from DB
  const { data: lastOrder, error: numErr } = await supabase
    .from('orders')
    .select('number')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (numErr) return { success: false, error: numErr.message };

  const nextNumber = lastOrder?.number
    ? String(parseInt(lastOrder.number, 10) + 1)
    : '1001';

  const orderInsert = {
    number: nextNumber,
    type: order.type,
    customer_name: order.customerName ?? null,
    customer_phone: order.customerPhone ?? null,
    delivery_address: order.deliveryAddress ?? null,
    table_number: order.tableNumber ?? null,
    status: order.status,
    subtotal: order.subtotal,
    discount: order.discount,
    tax_rate: 14,
    tax_amount: order.taxAmount,
    total: order.total,
    paid: order.paid,
    is_credit: order.isCredit,
    payments: order.payments,
    source: 'pos',
    note: null,
    cashier_id: order.cashierId,
    cashier_name: order.cashierName,
    paid_at: order.paidAt ?? null,
    cancel_reason: order.cancelReason ?? null,
    return_reason: order.returnReason ?? null,
  };

  const { data: inserted, error: oErr } = await supabase
    .from('orders')
    .insert(orderInsert)
    .select()
    .single();

  if (oErr) return { success: false, error: oErr.message };

  const orderItems = order.lines.map((l) => {
    const uuid = resolveProductUuid(l.productId, appProducts, dbMap);
    return {
      order_id: (inserted as OrderRow).id,
      product_id: uuid,
      product_name: l.productName,
      unit_price: l.unitPrice,
      qty: l.qty,
      line_total: l.lineTotal,
      line_discount: l.lineDiscount,
      size_name: l.sizeName,
      addons: l.addons,
      note: l.note ?? null,
    };
  });

  // Filter out items where product_id is null (product not in DB, e.g. raw items)
  const validItems = orderItems.filter((i) => i.product_id !== null);

  if (validItems.length > 0) {
    const { error: iErr } = await supabase.from('order_items').insert(validItems);
    if (iErr) return { success: false, error: iErr.message };
  }

  return { success: true };
}
