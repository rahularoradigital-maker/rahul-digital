import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBrandId } from "@/lib/tenancy/resolve";
import { deriveJSON } from "@/lib/creative-production/intelligence/llm-json.ts";
import { primaryFormats } from "@/lib/creative-production/formats/ad-format-library.ts";
import { scoreConcept, rankConcepts, formatSuitability } from "@/lib/creative-production/strategy/concept-engine.ts";
import type { BrandDNA, ConceptFormat, CreativeConcept, ProductDNA, StrategySignals } from "@/lib/creative-production/types";

// Creative Strategy Engine (Phase 5). For one product it: (1) scores EVERY format archetype with the
// deterministic 6-signal formula (concept-engine, not gut feel), (2) takes the top K, (3) writes GROUNDED
// copy for those K in one batched LLM call, (4) persists ranked concepts. Signals are sourced from what we
// actually know today; the two that need live Meta data (white space, historical performance) use honest
// neutral constants until the ingestion pipeline is wired - marked ponytail below so it's a known ceiling.

const TOP_K = 6;

// Fraction of brand identity fields we actually know (drives brandFit).
function brandKnownFraction(b: BrandDNA): number {
  const fields = [b.palette.primary, b.palette.secondary, b.imageStyle, b.designStyle, b.tone, b.fonts.heading];
  const known = fields.filter((f) => f && f !== "UNKNOWN").length;
  return known / fields.length;
}

function signalsFor(product: ProductDNA, brand: BrandDNA, fmt: ConceptFormat): StrategySignals {
  const hasReviews = product.proof.length > 0;
  const hasComparison = product.differentiators.length > 0 || product.usps.length > 0;
  return {
    productOpportunity: Math.max(0.4, product.confidence), // how well we understand the product to sell it
    // ponytail: creativeWhiteSpace + historicalPerformance need live ad_metrics coverage/fatigue; neutral
    // 0.7 until the ingestion pipeline feeds them. Upgrade: read lib/creative/diversity + ad_metrics here.
    creativeWhiteSpace: 0.7,
    audienceNeed: product.targetPersona !== "UNKNOWN" ? 0.85 : 0.6,
    historicalPerformance: 0.7,
    formatSuitability: formatSuitability(fmt, fmt.awarenessStage, hasReviews, hasComparison),
    brandFit: Math.max(0.4, brandKnownFraction(brand)),
  };
}

type CopyOut = {
  formatId: string;
  hook: string;
  angle: string;
  coreMessage: string;
  visualDirection: string;
  headline: string;
  supportingCopy: string;
  cta: string;
  offer: string | null;
  persona: string;
  problem: string;
  desire: string;
  whyThisConcept: string;
  whyNow: string;
  evidence: string[];
}[];

function copyPrompt(product: ProductDNA, brand: BrandDNA, formats: ConceptFormat[], currency: string | null): string {
  // Pass prices as clearly-labelled fields so the model never confuses the discount amount with the MRP.
  const cur = currency ?? "";
  const sellingPrice = product.price;
  const mrp = product.price != null && product.discount != null && product.discount > 0 ? product.price + product.discount : null;
  return [
    "You are a senior DTC creative strategist. Write ad copy for the product below, one entry per format.",
    "RULES: ground every line in the product facts. Never invent a claim, review, or statistic that is not in the product data. No em dashes. Keep headlines under 40 characters, CTA 2-3 words.",
    `PRICING (use ONLY these exact numbers, never invent a price): currency=${cur || "unknown"}, sellingPrice=${sellingPrice ?? "unknown"}, mrp=${mrp ?? "unknown"}. mrp is the crossed-out original; sellingPrice is what the customer pays. If an offer references price, write it as "${cur}${mrp ?? ""} ${cur}${sellingPrice ?? ""}" (original then current). If mrp is unknown, do not state an MRP.`,
    `PRODUCT: ${JSON.stringify({ name: product.name, category: product.category, primaryBenefit: product.primaryBenefit, benefits: product.secondaryBenefits, problem: product.problemSolved, persona: product.targetPersona, usps: product.usps, proof: product.proof })}`,
    `BRAND TONE: ${brand.tone}`,
    `FORMATS (write copy that fits each format's structure and visual execution - e.g. a Reddit post reads like a real post, a text-message ad reads like a real chat): ${JSON.stringify(formats.map((f) => ({ formatId: f.id, name: f.name, structure: f.structure, visual: f.visualPattern })))}`,
    'Output a JSON ARRAY. Each item: {formatId, hook, angle, coreMessage, visualDirection, headline, supportingCopy, cta, offer (string or null), persona, problem, desire, whyThisConcept, whyNow, evidence (string[])}.',
  ].join("\n");
}

export async function generateConcepts(userId: string, product: ProductDNA, brand: BrandDNA, currency: string | null = null): Promise<CreativeConcept[]> {
  // 1) score every executional format deterministically, 2) rank, 3) keep the top K to write copy for.
  // Pool = the 42 best-performing ad formats (source of truth); concept-formats.ts stays the extended fallback.
  const scored = primaryFormats().map((fmt) => ({ fmt, score: scoreConcept(signalsFor(product, brand, fmt)) }));
  const top = rankConcepts(scored).slice(0, TOP_K);

  // 4) batched grounded copy for the top K (one LLM call to keep tokens/cost down).
  const copy = (await deriveJSON<CopyOut>(copyPrompt(product, brand, top.map((t) => t.fmt), currency))) ?? [];
  const copyById = new Map(copy.map((c) => [c.formatId, c]));

  const concepts: CreativeConcept[] = top.map(({ fmt, score }) => {
    const c = copyById.get(fmt.id);
    return {
      id: `cc_${product.productId}_${fmt.id}`,
      productId: product.productId,
      formatId: fmt.id,
      persona: c?.persona ?? (product.targetPersona === "UNKNOWN" ? "General buyer" : product.targetPersona),
      problem: c?.problem ?? (product.problemSolved === "UNKNOWN" ? "" : product.problemSolved),
      desire: c?.desire ?? "",
      awarenessStage: fmt.awarenessStage,
      hook: c?.hook ?? "",
      angle: c?.angle ?? fmt.name,
      coreMessage: c?.coreMessage ?? (product.primaryBenefit === "UNKNOWN" ? product.name : product.primaryBenefit),
      visualDirection: c?.visualDirection ?? fmt.visualPattern,
      headline: c?.headline ?? product.name,
      supportingCopy: c?.supportingCopy ?? "",
      cta: c?.cta ?? "Shop now",
      offer: c?.offer ?? null,
      whyThisConcept: c?.whyThisConcept ?? `${fmt.name} suits this product's awareness stage.`,
      whyNow: c?.whyNow ?? "",
      evidence: Array.isArray(c?.evidence) ? c!.evidence : [],
      confidence: product.confidence,
      score,
    };
  });

  // Persist (idempotent per concept id). Never throws - concept UX degrades gracefully on a DB hiccup.
  const admin = createAdminClient();
  const brandId = await getActiveBrandId(userId); // tag concepts with the brand they were generated for
  await admin
    .from("cp_concepts")
    .upsert(
      concepts.map((cc) => ({ id: cc.id, user_id: userId, brand_id: brandId, product_id: cc.productId, concept: cc, score: cc.score, created_at: new Date().toISOString() })),
      { onConflict: "user_id,id" },
    )
    .then(undefined, () => {});
  return concepts;
}

export async function loadConcepts(userId: string, productId: string): Promise<CreativeConcept[]> {
  const brandId = await getActiveBrandId(userId); // only the current brand's concepts
  if (!brandId) return [];
  const { data } = await createAdminClient().from("cp_concepts").select("concept").eq("user_id", userId).eq("brand_id", brandId).eq("product_id", productId).order("score", { ascending: false });
  return (data ?? []).map((r) => r.concept as CreativeConcept);
}
