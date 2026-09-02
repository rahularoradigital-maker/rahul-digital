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

  // Actual generation results, not just config: how many ads are real AI images vs compositor-only placeholders.
  const genCount = async (states: string[]): Promise<number> => {
    if (!brandId) return 0;
    const { count } = await createAdminClient().from("cp_assets").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("brand_id", brandId).in("generation_state", states);
    return count ?? 0;
  };

  const [products, ads, approved, realGen, placeholderGen] = await Promise.all([
    count("shopify_products", [["user_id", user.id], ["shop_domain", conn.shopDomain]]),
    brandId ? count("cp_assets", [["user_id", user.id], ["brand_id", brandId]]) : Promise.resolve(0),
    brandId ? count("cp_assets", [["user_id", user.id], ["brand_id", brandId], ["approval", "approved"]]) : Promise.resolve(0),
    genCount(["AI_GENERATED", "AI_GENERATED_WITH_FALLBACK"]),
    genCount(["COMPOSITOR_ONLY"]),
  ]);

  // Honest image state: "on" (configured), "working" (real AI ads actually produced), or "degraded"
  // (key set but ads came out as placeholders — e.g. gpt-image-1 needs org verification, silently falls back).
  const imageState = !realImages ? "off" : realGen > 0 ? "working" : placeholderGen > 0 ? "degraded" : "on";

  return NextResponse.json({
    connected: conn.status === "connected" || conn.status === "url_public",
    shopDomain: conn.shopDomain,
    realImages, // config: is a real image provider configured at all
    imageState, // off | on | working | degraded (the honest, results-based signal)
    products,
    ads,
    approved,
    realGen,
    placeholderGen,
  });
}
