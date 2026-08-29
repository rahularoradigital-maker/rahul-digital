import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getShopifyConnectionStatus } from "@/lib/creative-production/shopify/store";

// Creative Studio - list the connected store's synced products for the product picker (Phase 10 UI).
// Returns connection status + a compact product list (image, title, price, short description). Read-only.
export const maxDuration = 30;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const conn = await getShopifyConnectionStatus(user.id);
  if (!conn) return NextResponse.json({ connected: false, shopDomain: null, products: [] });

  const { data } = await createAdminClient()
    .from("shopify_products")
    .select("product_id, title, description, price, compare_at_price, featured_image_url, status, product_type")
    .eq("user_id", user.id)
    .eq("shop_domain", conn.shopDomain)
    .order("updated_at", { ascending: false })
    .limit(300);

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

  return NextResponse.json({ connected: conn.status === "connected", status: conn.status, shopDomain: conn.shopDomain, products });
}
