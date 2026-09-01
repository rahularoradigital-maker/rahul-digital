import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { spendTokens } from "@/lib/billing/meter";
import { createClient } from "@/lib/supabase/server";
import { setAiUser } from "@/lib/ai/context";
import { getShopifyConnectionStatus } from "@/lib/creative-production/shopify/store";
import { ensureProductDNA } from "@/lib/creative-production/intelligence/product-dna";
import { loadEffectiveBrandDNA } from "@/lib/creative-production/intelligence/brand-dna";
import { loadConcepts } from "@/lib/creative-production/generation/concept-generate";
import { generateAssetsForConcept, signedAssetUrl } from "@/lib/creative-production/pipeline";
import { META_DEFAULT_SET, GOOGLE_DEFAULT_SET } from "@/lib/creative-production/formats/ad-formats";
import { pickFormats } from "@/lib/creative-production/formats/pick";
import { isRealImageProviderConfigured } from "@/lib/creative-production/providers/registry";
import { demoPathsAllowed } from "@/lib/demo-mode";

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

  const body = (await req.json().catch(() => ({}))) as { conceptId?: string; productId?: string; platform?: string; formatIds?: string[]; overrides?: { headline?: string; supportingCopy?: string; cta?: string; offer?: string | null } };
  const { conceptId, productId, platform, formatIds, overrides } = body;
  if (!conceptId || !productId) return NextResponse.json({ error: "conceptId and productId required" }, { status: 400 });

  const concepts = await loadConcepts(user.id, productId);
  const found = concepts.find((c) => c.id === conceptId);
  if (!found) return NextResponse.json({ error: "Concept not found. Generate concepts first." }, { status: 404 });

  // User copy edits (optional): apply to the concept BEFORE the pipeline so buildBrief + the composed text
  // both pick them up. Length-capped; edited copy hashes differently, so it makes a NEW asset (no overwrite).
  const cap = (s: string | undefined | null, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : undefined);
  const concept = overrides
    ? {
        ...found,
        headline: cap(overrides.headline, 120) ?? found.headline,
        supportingCopy: cap(overrides.supportingCopy, 200) ?? found.supportingCopy,
        cta: cap(overrides.cta, 40) ?? found.cta,
        offer: overrides.offer === null ? null : cap(overrides.offer, 60) ?? found.offer,
      }
    : found;

  const product = await ensureProductDNA(user.id, conn.shopDomain, productId, null);
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  const brand = await loadEffectiveBrandDNA(user.id, conn.shopDomain);

  // Honest gate (cleanup #3): if no REAL image provider is configured, the pipeline would return a 1x1
  // placeholder. Refuse BEFORE charging tokens - never sell a fake image - unless demo paths are opted in.
  if (!isRealImageProviderConfigured() && !demoPathsAllowed()) {
    return NextResponse.json(
      { error: "Ad image generation isn't set up yet. Add an image provider key (OpenAI or Gemini) to generate real creatives - no tokens were charged.", code: "image_provider_unconfigured" },
      { status: 503 },
    );
  }

  // Image generation is the cost driver (Phase 0): 20 tokens, and BLOCKED on Free (fails closed) - this is the
  // rule that keeps a free user's cost near zero. Charge before the expensive provider call.
  const spend = await spendTokens(user.id, "image");
  if (!spend.ok) {
    const msg =
      spend.reason === "image_not_in_plan"
        ? "Creative image generation is not included on the Free plan. Upgrade to a paid plan to generate ads."
        : `You have used all ${spend.allowance} of this month's tokens. Upgrade your plan for more, or wait for your monthly reset.`;
    return NextResponse.json({ error: msg, code: spend.reason, usage: { used: spend.used, allowance: spend.allowance } }, { status: 402 });
  }

  // Format selection: the user may pick a subset of the platform's set (fewer sizes = less work/clutter).
  // Filter the platform's default set to the requested ids; if none match, fall back to the full set.
  const base = platform === "google" ? GOOGLE_DEFAULT_SET : META_DEFAULT_SET;
  const formats = pickFormats(base, formatIds);
  const records = await generateAssetsForConcept(user.id, product, brand, concept, formats);

  const assets = await Promise.all(
    records.map(async (r) => ({ ...r, url: await signedAssetUrl(r.storagePath) })),
  );
  const totalCost = records.reduce((s, r) => s + r.costUsd, 0);
  return NextResponse.json({ assets, totalCostUsd: Number(totalCost.toFixed(4)), provider: records[0]?.provider ?? "stub" });
}
