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
  customer_phone?: string;
  delivery_address?: string;
  discount?: number;
  tax_rate?: number;
  note?: string;
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
    if (body.type === "delivery" && !body.delivery_address) {
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

    // ---- Insert order ----
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        number: nextNumber,
        type: body.type,
        customer_name: body.customer_name ?? null,
        customer_phone: body.customer_phone ?? null,
        delivery_address: body.delivery_address ?? null,
        status: "paid",
        subtotal,
        discount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        source: "chatbot",
        note: body.note ?? null,
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
    }));
    const { error: itemsErr } = await supabase
      .from("order_items")
      .insert(itemsToInsert);

    if (itemsErr) throw itemsErr;

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
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          delivery_address: order.delivery_address,
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
