import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { deriveJSON } from "./llm-json.ts";
import type { ProductDNA } from "@/lib/creative-production/types";

// Product Intelligence (Phase 3): derive a structured, GROUNDED ProductDNA from a cached Shopify product.
// Never invents claims - missing info is "UNKNOWN". Cached in cp_product_dna (derive-once). The price/
// discount/images/url come straight from Shopify (facts); the rest is Gemini reading the real title +
// description + type + tags (inferences, flagged with lower confidence).

type ProductRow = {
  product_id: string;
  title: string | null;
  description: string | null;
  product_type: string | null;
  vendor: string | null;
  tags: string[] | null;
  price: number | null;
  compare_at_price: number | null;
  images: { url: string }[] | null;
  online_store_url: string | null;
};

// The fields Gemini derives (the rest are Shopify facts we fill in deterministically).
type Derived = Pick<ProductDNA, "category" | "primaryBenefit" | "secondaryBenefits" | "problemSolved" | "targetPersona" | "useCase" | "keyIngredients" | "differentiators" | "usps" | "proof" | "claims" | "offerEligibility" | "brandRelevance" | "creativeOpportunities" | "creativeRestrictions" | "confidence">;

function prompt(row: ProductRow, brandSummary: string | null): string {
  return [
    "You are a DTC product strategist. Read this ONE real Shopify product and output a structured product profile.",
    "RULES: use ONLY what the title/description/type/tags actually support. Never invent a benefit, ingredient, proof, or claim.",
    'If something is not stated or clearly implied, use the exact string "UNKNOWN" (for arrays, use []). Plain English, no hype.',
    brandSummary ? `Brand context: ${brandSummary}` : "",
    "Output JSON with keys: category, primaryBenefit, secondaryBenefits[], problemSolved, targetPersona, useCase, keyIngredients[], differentiators[], usps[], proof[], claims[], offerEligibility, brandRelevance, creativeOpportunities[], creativeRestrictions[], confidence (0..1, how grounded your read is).",
    "PRODUCT:",
    JSON.stringify({ title: row.title, description: (row.description ?? "").slice(0, 2000), productType: row.product_type, vendor: row.vendor, tags: row.tags ?? [] }),
  ].filter(Boolean).join("\n");
}

const U = "UNKNOWN" as const;
function fact<T>(v: T | null | undefined, fallback: typeof U): T | typeof U {
  return v == null ? fallback : v;
}

export async function deriveProductDNA(userId: string, shopDomain: string, row: ProductRow, brandSummary: string | null): Promise<ProductDNA | null> {
  const d = await deriveJSON<Derived>(prompt(row, brandSummary));
  if (!d) return null;
  const dna: ProductDNA = {
    productId: row.product_id,
    name: row.title ?? "Untitled product",
    category: fact(d.category, U),
    primaryBenefit: fact(d.primaryBenefit, U),
    secondaryBenefits: Array.isArray(d.secondaryBenefits) ? d.secondaryBenefits : [],
    problemSolved: fact(d.problemSolved, U),
    targetPersona: fact(d.targetPersona, U),
    useCase: fact(d.useCase, U),
    keyIngredients: Array.isArray(d.keyIngredients) ? d.keyIngredients : [],
    differentiators: Array.isArray(d.differentiators) ? d.differentiators : [],
    usps: Array.isArray(d.usps) ? d.usps : [],
    proof: Array.isArray(d.proof) ? d.proof : [],
    claims: Array.isArray(d.claims) ? d.claims : [],
    offerEligibility: fact(d.offerEligibility, U),
    price: row.price ?? null,
    discount: row.compare_at_price != null && row.price != null ? Math.max(0, row.compare_at_price - row.price) : null,
    images: (row.images ?? []).map((i) => i.url).filter(Boolean),
    url: row.online_store_url ?? null,
    brandRelevance: fact(d.brandRelevance, U),
    creativeOpportunities: Array.isArray(d.creativeOpportunities) ? d.creativeOpportunities : [],
    creativeRestrictions: Array.isArray(d.creativeRestrictions) ? d.creativeRestrictions : [],
    confidence: typeof d.confidence === "number" ? Math.max(0, Math.min(1, d.confidence)) : 0.4,
  };
  await createAdminClient()
    .from("cp_product_dna")
    .upsert({ user_id: userId, shop_domain: shopDomain, product_id: row.product_id, dna, updated_at: new Date().toISOString() }, { onConflict: "user_id,shop_domain,product_id" })
    .then(undefined, () => {});
  return dna;
}

export async function loadProductDNA(userId: string, shopDomain: string, productId: string): Promise<ProductDNA | null> {
  const { data } = await createAdminClient()
    .from("cp_product_dna")
    .select("dna")
    .eq("user_id", userId)
    .eq("shop_domain", shopDomain)
    .eq("product_id", productId)
    .maybeSingle();
  return (data?.dna as ProductDNA) ?? null;
}

// Load-or-derive: return the cached DNA if present, else read the synced Shopify row and derive it once.
// Returns null only when the product was never synced. brandSummary lets the derive read stay on-brand.
export async function ensureProductDNA(userId: string, shopDomain: string, productId: string, brandSummary: string | null): Promise<ProductDNA | null> {
  const cached = await loadProductDNA(userId, shopDomain, productId);
  if (cached) return cached;
  const { data } = await createAdminClient()
    .from("shopify_products")
    .select("product_id, title, description, product_type, vendor, tags, price, compare_at_price, images, online_store_url")
    .eq("user_id", userId)
    .eq("shop_domain", shopDomain)
    .eq("product_id", productId)
    .maybeSingle();
  if (!data) return null;
  return deriveProductDNA(userId, shopDomain, data as ProductRow, brandSummary);
}
