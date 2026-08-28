// Pure brand-profile parsing - NO server-only / no I/O, so it is unit-testable in a plain node
// check (lib/brand/profile.ts, which imports server-only, re-uses these).

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

// Parse Gemini's flat string object into a DerivedProfile. "unknown"/"n/a"/empty -> null; the list
// fields are comma/semicolon separated and capped.
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
