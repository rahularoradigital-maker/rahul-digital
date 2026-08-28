import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { callGemini, stringObjectSchema } from "@/lib/gemini";

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

// The fields Gemini derives (the editable/reviewable part), separate from the stored metadata.
export type DerivedProfile = {
  category: string | null;
  subcategories: string[];
  keyProducts: string[];
  pricePositioning: string | null;
  targetMarket: string | null;
  brandVoice: string | null;
  summary: string | null;
  website: string | null;
};

// Pure parse of Gemini's flat string object into a DerivedProfile. "unknown"/empty -> null; the
// list fields are comma/semicolon separated. Exported so a check can exercise it without the model.
export function parseDerived(raw: Record<string, unknown>): DerivedProfile {
  const s = (k: string): string | null => {
    const v = raw[k];
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t && t.toLowerCase() !== "unknown" && t.toLowerCase() !== "n/a" ? t : null;
  };
  const list = (k: string): string[] =>
    (s(k) ?? "")
      .split(/[,;]/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 12);
  return {
    category: s("category"),
    subcategories: list("subcategories"),
    keyProducts: list("key_products"),
    pricePositioning: s("price_positioning"),
    targetMarket: s("target_market"),
    brandVoice: s("brand_voice"),
    summary: s("summary"),
    website: s("website"),
  };
}

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
  const raw = await callGemini(prompt, SCHEMA);
  return raw ? parseDerived(raw) : null;
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
