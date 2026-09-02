import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getShopifyConnectionStatus } from "@/lib/creative-production/shopify/store";
import { getActiveBrandId } from "@/lib/tenancy/resolve";
import { isRealImageProviderConfigured } from "@/lib/creative-production/providers/registry";

// Creative Studio - at-a-glance readiness for the whole module: is a store connected, how much is synced,
// how many ads exist/approved, and (the key one) whether REAL image generation is configured or the pipeline
// is in placeholder mode. Read-only, cheap count queries. Surfaces the "do I need an image key?" answer.
export const maxDuration = 20;

async function count(table: string, filters: [string, string][]): Promise<number> {
  let q = createAdminClient().from(table).select("*", { count: "exact", head: true });
  for (const [k, v] of filters) q = q.eq(k, v);
  const { count } = await q;
  return count ?? 0;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;

  const conn = await getShopifyConnectionStatus(user.id);
  const realImages = isRealImageProviderConfigured();
  if (!conn) return NextResponse.json({ connected: false, realImages, products: 0, ads: 0, approved: 0 });

  const brandId = await getActiveBrandId(user.id);
  const [products, ads, approved] = await Promise.all([
    count("shopify_products", [["user_id", user.id], ["shop_domain", conn.shopDomain]]),
    brandId ? count("cp_assets", [["user_id", user.id], ["brand_id", brandId]]) : Promise.resolve(0),
    brandId ? count("cp_assets", [["user_id", user.id], ["brand_id", brandId], ["approval", "approved"]]) : Promise.resolve(0),
  ]);

  return NextResponse.json({
    connected: conn.status === "connected" || conn.status === "url_public",
    shopDomain: conn.shopDomain,
    realImages, // false = placeholder mode; add a billed image key + IMAGE_PROVIDER to turn on real pictures
    products,
    ads,
    approved,
  });
}
