import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getShopifyConnectionStatus } from "@/lib/creative-production/shopify/store";

// Creative Studio - list the connected store's synced products for the product picker (Phase 10 UI).
// Returns connection status + a compact product list (image, title, price, short description). Read-only.
export const maxDuration = 30;

const PAGE = 300;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const _denied = await guardProductApi();
  if (_denied) return _denied;

  const conn = await getShopifyConnectionStatus(user.id);
  if (!conn) return NextResponse.json({ connected: false, shopDomain: null, products: [], total: 0 });

  // Search term: strip PostgREST filter metacharacters so a query can never break the .or() grammar.
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().replace(/[,()%*\\]/g, " ").slice(0, 80);

  let query = createAdminClient()
    .from("shopify_products")
    .select("product_id, title, description, price, compare_at_price, featured_image_url, status, product_type", { count: "exact" })
    .eq("user_id", user.id)
    .eq("shop_domain", conn.shopDomain);
  if (q) query = query.or(`title.ilike.%${q}%,product_type.ilike.%${q}%`); // search the WHOLE catalogue, not just the first page
  query = query.order("updated_at", { ascending: false }).limit(PAGE);

  const { data, count } = await query;

  const products = (data ?? []).map((p) => ({
    productId: p.product_id as string,
    title: (p.title as string) ?? "Untitled",
    description: ((p.description as string) ?? "").slice(0, 160),
    price: p.price as number | null,
    compareAtPrice: p.compare_at_price as number | null,
    image: p.featured_image_url as string | null,
    status: p.status as string | null,
    productType: p.product_type as string | null,
  }));

  const connected = conn.status === "connected" || conn.status === "url_public";
  // total = matches for the current query (whole catalogue when q set); products = the first PAGE shown.
  return NextResponse.json({ connected, status: conn.status, shopDomain: conn.shopDomain, currency: conn.currency, products, total: count ?? products.length, shown: products.length });
}
