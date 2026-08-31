import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { setAiUser } from "@/lib/ai/context";
import { getShopifyConnectionStatus } from "@/lib/creative-production/shopify/store";
import { ensureProductDNA } from "@/lib/creative-production/intelligence/product-dna";
import { loadEffectiveBrandDNA } from "@/lib/creative-production/intelligence/brand-dna";
import { loadConcepts } from "@/lib/creative-production/generation/concept-generate";
import { generateAssetsForConcept, signedAssetUrl } from "@/lib/creative-production/pipeline";
import { META_DEFAULT_SET, GOOGLE_DEFAULT_SET } from "@/lib/creative-production/formats/ad-formats";

// Creative Studio - generate finished, QA'd assets for one approved concept across a platform's format set
// (Phases 6-10 UI). Provider-independent: with no image key it composes deterministic placeholders so the
// whole flow works end-to-end; set IMAGE_PROVIDER=google + a billed key to get real visuals, no code change.
export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const _denied = await guardProductApi();
  if (_denied) return _denied;
  setAiUser(user.id); // attribute AI spend to this user
  const conn = await getShopifyConnectionStatus(user.id);
  if (!conn) return NextResponse.json({ error: "No connected store." }, { status: 400 });

  const { conceptId, productId, platform } = (await req.json().catch(() => ({}))) as { conceptId?: string; productId?: string; platform?: string };
  if (!conceptId || !productId) return NextResponse.json({ error: "conceptId and productId required" }, { status: 400 });

  const concepts = await loadConcepts(user.id, productId);
  const concept = concepts.find((c) => c.id === conceptId);
  if (!concept) return NextResponse.json({ error: "Concept not found. Generate concepts first." }, { status: 404 });

  const product = await ensureProductDNA(user.id, conn.shopDomain, productId, null);
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  const brand = await loadEffectiveBrandDNA(user.id, conn.shopDomain);

  const formats = platform === "google" ? GOOGLE_DEFAULT_SET : META_DEFAULT_SET;
  const records = await generateAssetsForConcept(user.id, product, brand, concept, formats);

  const assets = await Promise.all(
    records.map(async (r) => ({ ...r, url: await signedAssetUrl(r.storagePath) })),
  );
  const totalCost = records.reduce((s, r) => s + r.costUsd, 0);
  return NextResponse.json({ assets, totalCostUsd: Number(totalCost.toFixed(4)), provider: records[0]?.provider ?? "stub" });
}
