import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getShopifyConnectionStatus } from "@/lib/creative-production/shopify/store";

// Creative Studio - "which products should I advertise?" (Phase 11 UI). GROUNDED, deterministic ranking by
// OFFER STRENGTH (absolute rupee saving) gated by AD-READINESS (has an image), computed in SQL so it is
// scale-safe. HONEST: this is NOT an ad-performance signal (there are no per-product Meta results here) -
// it is a "biggest, ad-ready offer" starting point, labelled as such in the UI. Read-only.
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

  const recommendations = (data ?? []).map((r: { product_id: string; title: string; price: number | null; compare_at_price: number | null; featured_image_url: string | null; product_type: string | null; discount_pct: number; saving: number; advertised: boolean }) => ({
    productId: r.product_id,
    title: r.title ?? "Untitled",
    price: r.price,
    compareAtPrice: r.compare_at_price,
    image: r.featured_image_url,
    productType: r.product_type,
    discountPct: Number(r.discount_pct ?? 0),
    saving: Number(r.saving ?? 0),
    advertised: Boolean(r.advertised),
    // Plain-English, grounded reason — no invented performance claim.
    reason: r.advertised
      ? "Already advertised — you have ads for this"
      : r.discount_pct > 0
        ? `${r.discount_pct}% off, not advertised yet — a strong offer to test`
        : "Ad-ready, not advertised yet",
  }));

  return NextResponse.json({
    recommendations,
    currency: conn.currency,
    basis: "Ranked by offer size (discount) + whether the product is ad-ready, with products you have not advertised yet surfaced first. Not based on ad performance — connect Meta results to rank by what actually sells.",
  });
}
