import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShopifyConnectionStatus } from "@/lib/creative-production/shopify/store";
import { ensureProductDNA } from "@/lib/creative-production/intelligence/product-dna";
import { loadEffectiveBrandDNA } from "@/lib/creative-production/intelligence/brand-dna";
import { generateConcepts, loadConcepts } from "@/lib/creative-production/generation/concept-generate";

// Creative Studio - Product DNA + ranked creative concepts for one product (Phases 3 + 5 UI).
//   GET  ?productId  -> cached DNA + concepts (fast, no LLM if already derived)
//   POST {productId} -> ensure DNA, load effective brand, generate + rank + persist concepts
export const maxDuration = 120;

async function ctx(userId: string) {
  return getShopifyConnectionStatus(userId);
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const productId = new URL(req.url).searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });
  const concepts = await loadConcepts(user.id, productId);
  return NextResponse.json({ concepts });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const conn = await ctx(user.id);
  if (!conn) return NextResponse.json({ error: "No connected store." }, { status: 400 });
  const shopDomain = conn.shopDomain;

  const { productId } = (await req.json().catch(() => ({}))) as { productId?: string };
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  const brand = await loadEffectiveBrandDNA(user.id, shopDomain);
  const brandSummary = brand.tone !== "UNKNOWN" ? `tone ${brand.tone}` : null;
  const product = await ensureProductDNA(user.id, shopDomain, productId, brandSummary);
  if (!product) return NextResponse.json({ error: "Product not found. Sync the store first." }, { status: 404 });

  const concepts = await generateConcepts(user.id, product, brand, conn.currency);
  return NextResponse.json({ product, concepts });
}
