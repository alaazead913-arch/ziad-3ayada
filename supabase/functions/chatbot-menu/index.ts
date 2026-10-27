import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all active categories
    const { data: categories, error: catErr } = await supabase
      .from("categories")
      .select("id, name, parent_id, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (catErr) throw catErr;

    // Fetch all active, sellable products (exclude raw)
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, name, code, description, category_id, price, available, track_stock")
      .eq("active", true)
      .order("name", { ascending: true });

    if (prodErr) throw prodErr;

    // Build a nested menu: top-level categories with their sub-categories and items
    const rootCats = (categories ?? []).filter((c) => !c.parent_id);
    const menu = rootCats.map((root) => {
      const subs = (categories ?? []).filter((c) => c.parent_id === root.id);
      const subGroups = subs.map((sub) => ({
        id: sub.id,
        name: sub.name,
        items: (products ?? [])
          .filter((p) => p.category_id === sub.id)
          .map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            price: Number(p.price),
            available: p.track_stock ? Number(p.available) > 0 : true,
            description: p.description ?? null,
          })),
      }));
      const directItems = (products ?? [])
        .filter((p) => p.category_id === root.id)
        .map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          price: Number(p.price),
          available: p.track_stock ? Number(p.available) > 0 : true,
          description: p.description ?? null,
        }));
      return {
        id: root.id,
        name: root.name,
        items: directItems,
        subcategories: subGroups,
      };
    });

    // Flat list of all items (handy for the chatbot to search by name/code)
    const flatItems = (products ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      price: Number(p.price),
      category_id: p.category_id,
      available: p.track_stock ? Number(p.available) > 0 : true,
    }));

    return new Response(
      JSON.stringify({
        restaurant: "مطعمنا",
        currency: "ج.م",
        generated_at: new Date().toISOString(),
        categories: menu,
        items: flatItems,
        total_items: flatItems.length,
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
