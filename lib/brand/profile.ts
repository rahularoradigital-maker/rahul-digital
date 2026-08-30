import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stringObjectSchema } from "@/lib/gemini";
import { runTaskJson } from "@/lib/ai/router";
import { parseDerived, type DerivedProfile } from "./parse";

export { parseDerived, type DerivedProfile } from "./parse";

// The "brand learning folder" seed: a structured understanding of the brand we run ads for,
// derived from its REAL ad data (account name + ad names + a sample of ad copy + account currency)
// via Gemini, then reviewed/confirmed by the user before it drives competitor discovery. Grounded:
// the prompt forbids inventing anything the ad data does not support. Server-only.

export type BrandProfile = {
  accountExternalId: string;
  accountName: string | null;
  currency: string | null;
  targetMarket: string | null;
  category: string | null;
  subcategories: string[];
  keyProducts: string[];
  pricePositioning: string | null;
  brandVoice: string | null;
  summary: string | null;
  website: string | null;
  status: "draft" | "confirmed";
  derivedAt: string;
  confirmedAt: string | null;
};

const SCHEMA = stringObjectSchema([
  "category",
  "subcategories",
  "key_products",
  "price_positioning",
  "target_market",
  "brand_voice",
  "summary",
  "website",
]);

export async function deriveBrandProfile(
  accountName: string,
  currency: string | null,
  adNames: string[],
  adCopy: string[],
): Promise<DerivedProfile | null> {
  const prompt = [
    "You are a brand analyst. From this brand's REAL Meta ad data, produce a grounded brand profile.",
    `Account name: ${accountName}`,
    currency ? `Ad account currency: ${currency}` : "",
    adNames.length ? `Ad names (internal, but they reveal products/themes):\n${adNames.slice(0, 60).join("\n")}` : "",
    adCopy.length ? `Ad copy samples (what customers see):\n${adCopy.slice(0, 30).join("\n---\n")}` : "",
    "",
    "Rules: use ONLY what this data supports; never invent a product or fact not evidenced by the names/copy; if a field is not evident, return \"unknown\".",
    "Fields:",
    "- category: the single best primary product category (e.g. 'bath & body / personal care').",
    "- subcategories: comma-separated product lines you actually see.",
    "- key_products: comma-separated real product names/types visible in the data.",
    "- price_positioning: one of value / mass premium / premium / luxury, inferred from the copy's tone, offers, and product type (say unknown if unclear).",
    "- target_market: the country or region the ads target, inferred from language, currency, and references (e.g. 'India').",
    "- brand_voice: 2-4 words describing the tone (e.g. 'warm, gifting-led').",
    "- summary: ONE plain sentence describing what this brand sells and to whom.",
    "- website: the brand's website domain if it appears in the copy, else unknown.",
  ]
    .filter(Boolean)
    .join("\n");
  const raw = await runTaskJson("brand-profile", prompt, SCHEMA);
  return raw ? parseDerived(raw) : null;
}

// Discovery brain: propose real competitor BRAND NAMES for this brand. The Ad Library search endpoint
// matches by brand NAME (not product keywords), so we ask Gemini - which knows the market - for
// same-country, same-price-band rivals, then the route resolves each NAME to a REAL Ad Library page.
// Fabricated or wrong names simply resolve to nothing and are dropped, so nothing unreal is surfaced.
export async function suggestCompetitorNames(p: BrandProfile): Promise<string[]> {
  const prompt = [
    "You are a competitive-intelligence analyst. Name the real, well-known competitor BRANDS of the brand below.",
    p.accountName ? `Brand: ${p.accountName}` : "",
    p.summary ? `What it sells: ${p.summary}` : "",
    p.category ? `Category: ${p.category}` : "",
    p.subcategories.length ? `Sub-categories: ${p.subcategories.join(", ")}` : "",
    p.keyProducts.length ? `Key products: ${p.keyProducts.join(", ")}` : "",
    p.pricePositioning ? `Price positioning: ${p.pricePositioning}` : "",
    p.targetMarket ? `Primary market / country: ${p.targetMarket}` : "",
    "",
    "Rules:",
    "- List up to 12 REAL brands a shopper would consider direct alternatives to this brand.",
    "- Same country / market and roughly the same price tier (same price band, not a super-luxury or bargain outlier).",
    "- Brands that actively advertise (likely to have a Facebook / Meta page). Exclude the brand itself and generic marketplaces (Amazon, Myntra, Flipkart) unless one is truly the direct competitor.",
    "- Return ONLY the brand names, comma-separated. No numbering, no notes, no explanations.",
  ]
    .filter(Boolean)
    .join("\n");
  const raw = await runTaskJson("brand-profile", prompt, stringObjectSchema(["competitors"]));
  const list = String((raw as { competitors?: unknown } | null)?.competitors ?? "");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of list.split(/[,;\n]/)) {
    const t = part.trim();
    const k = t.toLowerCase();
    if (t.length >= 2 && t.length <= 40 && !seen.has(k)) {
      seen.add(k);
      out.push(t);
      if (out.length >= 12) break;
    }
  }
  return out;
}

// --- Storage (service-role) ---

type Row = {
  account_external_id: string;
  account_name: string | null;
  currency: string | null;
  target_market: string | null;
  category: string | null;
  subcategories: string[] | null;
  key_products: string[] | null;
  price_positioning: string | null;
  brand_voice: string | null;
  summary: string | null;
  website: string | null;
  status: string;
  derived_at: string;
  confirmed_at: string | null;
};

function toProfile(r: Row): BrandProfile {
  return {
    accountExternalId: r.account_external_id,
    accountName: r.account_name,
    currency: r.currency,
    targetMarket: r.target_market,
    category: r.category,
    subcategories: r.subcategories ?? [],
    keyProducts: r.key_products ?? [],
    pricePositioning: r.price_positioning,
    brandVoice: r.brand_voice,
    summary: r.summary,
    website: r.website,
    status: r.status === "confirmed" ? "confirmed" : "draft",
    derivedAt: r.derived_at,
    confirmedAt: r.confirmed_at,
  };
}

export async function loadBrandProfile(userId: string, accountExternalId: string): Promise<BrandProfile | null> {
  try {
    const { data } = await createAdminClient()
      .from("brand_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("account_external_id", accountExternalId)
      .maybeSingle();
    return data ? toProfile(data as Row) : null;
  } catch {
    return null;
  }
}

// Upsert the profile. status="draft" on a fresh derive; status="confirmed" when the user saves their
// reviewed/edited version (stamps confirmed_at). Best-effort; returns whether it saved.
export async function saveBrandProfile(
  userId: string,
  accountExternalId: string,
  accountName: string | null,
  currency: string | null,
  d: DerivedProfile,
  status: "draft" | "confirmed",
): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const { error } = await createAdminClient().from("brand_profiles").upsert(
      {
        user_id: userId,
        account_external_id: accountExternalId,
        account_name: accountName,
        currency,
        target_market: d.targetMarket,
        category: d.category,
        subcategories: d.subcategories,
        key_products: d.keyProducts,
        price_positioning: d.pricePositioning,
        brand_voice: d.brandVoice,
        summary: d.summary,
        website: d.website,
        status,
        derived_at: now,
        confirmed_at: status === "confirmed" ? now : null,
      },
      { onConflict: "user_id,account_external_id" },
    );
    return !error;
  } catch {
    return false;
  }
}
