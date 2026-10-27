import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface IncomingItem {
  product_id: string;
  qty: number;
  note?: string;
}

interface IncomingOrder {
  type: "dine_in" | "takeaway" | "delivery";
  items: IncomingItem[];
  customer_name?: string;
  customer?: { name?: string; phone?: string };
  from_name?: string;
  sender_name?: string;
  name?: string;
  customer_phone?: string;
  phone?: string;
  from_phone?: string;
  delivery_address?: string;
  address?: string;
  discount?: number;
  tax_rate?: number;
  note?: string;
  platform?: string;
  [key: string]: unknown;
}

const placeholderNames = new Set(["اسم العميل", "اسم العميل الحقيقي", "customer name", "customer"]);

function isUsableName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !placeholderNames.has(value.trim().toLowerCase());
}

function findCustomerName(value: unknown, key = ""): string | null {
  if (isUsableName(value) && /name|profile|contact|sender|customer|from|user|push/i.test(key)) return value.trim();
  if (!value || typeof value !== "object") return null;

  for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
    if (/items|products|lines|text|content/i.test(childKey)) continue;
    if (/name|full_name|display_name|pushname|push_name|customer_name|sender_name|from_name/i.test(childKey) && isUsableName(childValue)) {
      return childValue.trim();
    }
    const nestedName = findCustomerName(childValue, childKey);
    if (nestedName) return nestedName;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = (await req.json()) as IncomingOrder;

    // ---- Normalize customer fields from common chatbot payload formats ----
    const customerName = findCustomerName(body);
    const customerPhone =
      body.customer_phone ||
      body.customer?.phone ||
      body.phone ||
      body.from_phone ||
      null;
    const deliveryAddress = body.delivery_address || body.address || null;

    // ---- Validate ----
    if (!body || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return new Response(
        JSON.stringify({ error: "الحقل items مطلوب ويجب أن يحتوي على عنصر واحد على الأقل" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const validTypes = ["dine_in", "takeaway", "delivery"];
    if (!validTypes.includes(body.type)) {
      return new Response(
        JSON.stringify({ error: `type يجب أن يكون أحد: ${validTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (body.type === "delivery" && !deliveryAddress) {
      return new Response(
        JSON.stringify({ error: "عنوان التوصيل مطلوب لطلبات الديليفري" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ---- Fetch referenced products in one query ----
    const productIds = body.items.map((i) => i.product_id);
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, name, price, available, track_stock, active")
      .in("id", productIds);

    if (prodErr) throw prodErr;

    // Map for quick lookup
    const productMap = new Map((products ?? []).map((p) => [p.id, p]));

    // ---- Validate each item & compute totals ----
    const orderItems: {
      product_id: string;
      product_name: string;
      unit_price: number;
      qty: number;
      line_total: number;
      note: string | null;
    }[] = [];

    let subtotal = 0;
    for (const item of body.items) {
      const p = productMap.get(item.product_id);
      if (!p) {
        return new Response(
          JSON.stringify({ error: `الصنف بالمعرف ${item.product_id} غير موجود` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!p.active) {
        return new Response(
          JSON.stringify({ error: `الصنف "${p.name}" غير متاح حالياً` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (p.track_stock && Number(p.available) <= 0) {
        return new Response(
          JSON.stringify({ error: `الصنف "${p.name}" نفذ من المخزون` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const qty = Math.max(1, Number(item.qty) || 1);
      const unitPrice = Number(p.price);
      const lineTotal = Math.round(unitPrice * qty * 100) / 100;
      subtotal += lineTotal;
      orderItems.push({
        product_id: p.id,
        product_name: p.name,
        unit_price: unitPrice,
        qty,
        line_total: lineTotal,
        note: item.note ?? null,
      });
    }
    subtotal = Math.round(subtotal * 100) / 100;

    const discount = Math.max(0, Math.min(subtotal, Number(body.discount) || 0));
    const taxable = Math.max(0, subtotal - discount);
    const taxRate = Number(body.tax_rate) || 14;
    const taxAmount = Math.round(taxable * (taxRate / 100) * 100) / 100;
    const total = Math.round((taxable + taxAmount) * 100) / 100;

    // ---- Generate order number ----
    const { data: lastOrder, error: numErr } = await supabase
      .from("orders")
      .select("number")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (numErr) throw numErr;

    const nextNumber = lastOrder?.number
      ? String(parseInt(lastOrder.number, 10) + 1)
      : "1001";

    const platform = body.platform ?? "chatbot";

    // ---- Insert order ----
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        number: nextNumber,
        type: body.type,
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_address: deliveryAddress,
        status: "paid",
        subtotal,
        discount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        paid: total,
        is_credit: false,
        payments: [{ method: "cash", amount: total }],
        source: "chatbot",
        note: body.note ?? null,
        cashier_id: null,
        cashier_name: "بوت",
        paid_at: new Date().toISOString(),
        cancel_reason: null,
        return_reason: null,
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    // ---- Insert order items ----
    const itemsToInsert = orderItems.map((i) => ({
      order_id: order.id,
      product_id: i.product_id,
      product_name: i.product_name,
      unit_price: i.unit_price,
      qty: i.qty,
      line_total: i.line_total,
      note: i.note,
      size_name: null,
      addons: [],
      line_discount: 0,
    }));
    const { error: itemsErr } = await supabase
      .from("order_items")
      .insert(itemsToInsert);

    if (itemsErr) throw itemsErr;

    // ---- Deduct stock for tracked products ----
    for (const item of orderItems) {
      const p = productMap.get(item.product_id);
      if (p && p.track_stock) {
        await supabase
          .from("products")
          .update({ available: Math.max(0, Number(p.available) - item.qty) })
          .eq("id", item.product_id);
      }
    }

    // ---- Return receipt-shaped response for the chatbot ----
    return new Response(
      JSON.stringify({
        success: true,
        order: {
          id: order.id,
          number: order.number,
          type: order.type,
          status: order.status,
          source: order.source,
          platform,
          customer_name: customerName,
          customer_phone: customerPhone,
          delivery_address: deliveryAddress,
          subtotal: Number(order.subtotal),
          discount: Number(order.discount),
          tax_rate: Number(order.tax_rate),
          tax_amount: Number(order.tax_amount),
          total: Number(order.total),
          created_at: order.created_at,
        },
        items: orderItems,
        message: `تم تسجيل الطلب رقم #${order.number} بقيمة ${total} ج.م`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
