import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getShopifyConnectionStatus } from "@/lib/creative-production/shopify/store";
import { rankProducts, type ProductPerfSignal } from "@/lib/creative-production/recommend/performance-rank";

// Creative Studio - "which products should I advertise?" (Phase 11 UI). GROUNDED, deterministic. The SQL RPC
// finds the biggest ad-ready OFFERS scale-safely; performance-rank (#1) then orders them on an explainable
// priority ladder (refresh a fatiguing winner > untested white-space > test a new angle > leave a winner to
// scale). HONEST: the winner/fatigue rungs stay dormant until per-product Meta ROAS is fed in (the seam
// below) - we NEVER fabricate a ROAS. Today the ladder runs on the real signals we have (advertised + offer).
export const maxDuration = 30;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;

  const conn = await getShopifyConnectionStatus(user.id);
  if (!conn) return NextResponse.json({ recommendations: [], basis: null });

  const { data } = await createAdminClient().rpc("cp_product_opportunities", { p_user: user.id, p_shop: conn.shopDomain, p_limit: 8 });

  type Row = { product_id: string; title: string; price: number | null; compare_at_price: number | null; featured_image_url: string | null; product_type: string | null; discount_pct: number; saving: number; advertised: boolean };
  const rows: Row[] = data ?? [];

  // Build the performance signal for each candidate. ponytail: bestRoas/fatiguing/spendRs are the SEAM for
  // per-product Meta results - feed them from the winner + fatigue engines (needs a product<->ad<->ROAS join)
  // and the "refresh-winner"/"scale-working" rungs light up. Until then we pass only the real signals we have,
  // so the ladder degrades honestly to offer + ad-readiness. Never fabricate a ROAS here.
  const signals: ProductPerfSignal[] = rows.map((r) => ({
    productId: r.product_id,
    advertised: Boolean(r.advertised),
    discountPct: Number(r.discount_pct ?? 0),
  }));
  const byId = new Map(rows.map((r) => [r.product_id, r]));

  // Emit in ranked order (rankProducts is score-desc, ties keep RPC order = biggest offer first).
  const recommendations = rankProducts(signals).map((rk) => {
    const r = byId.get(rk.productId)!;
    return {
      productId: r.product_id,
      title: r.title ?? "Untitled",
      price: r.price,
      compareAtPrice: r.compare_at_price,
      image: r.featured_image_url,
      productType: r.product_type,
      discountPct: Number(r.discount_pct ?? 0),
      saving: Number(r.saving ?? 0),
      advertised: Boolean(r.advertised),
      priority: rk.priority,
      reason: rk.reason,
    };
  });

  return NextResponse.json({
    recommendations,
    currency: conn.currency,
    basis: "Ranked on a priority ladder: untested products with a strong offer first, then a new angle for advertised products not winning yet. Winner-refresh and scale rungs turn on once per-product Meta ROAS is connected — no ad performance is used yet.",
  });
}
