// Derive the influencer BrandTarget from the account's REAL confirmed brand profile (the same brand
// understanding the Market tab shows). This is what makes Influencer Hunt "know" the brand with zero extra
// input: category, products, market, and voice flow straight into who we look for and how creators are scored.
// Server-side only (uses the app's iso2 helper). The pure spec/query helpers live in spec.ts.

import type { BrandProfile } from "@/lib/brand/profile";
import { iso2FromMarket } from "@/lib/meta-source";
import type { BrandTarget } from "./types";

// Rough language priors by market. Deliberately small + honest: used only to weight audience-language fit,
// never to reject a creator. Unknown market -> English (the broadest), not a fabricated local language.
function languagesFor(iso2: string): string[] {
  switch (iso2) {
    case "IN": return ["hi", "en"];
    case "AE": return ["ar", "en"];
    case "GB": case "US": case "AU": case "CA": return ["en"];
    default: return ["en"];
  }
}

/** Turn the confirmed brand profile into the target the scoring engines compare creators against. */
export function brandTargetFromProfile(p: BrandProfile): BrandTarget {
  const targetCountry = iso2FromMarket(p.targetMarket, p.currency);
  // Content keywords = the distinct, meaningful words across category + subcategories + products. These
  // drive brand-fit and content-fit overlap against a creator's bio/posts. Lowercased + deduped + capped.
  const raw = [p.category ?? "", ...p.subcategories, ...p.keyProducts].join(" ").toLowerCase();
  const stop = new Set(["and", "for", "the", "with", "wear", "&", "-"]);
  const contentKeywords = [...new Set(raw.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !stop.has(w)))].slice(0, 14);

  return {
    category: p.category,
    keyProducts: p.keyProducts,
    targetCountry,
    languages: languagesFor(targetCountry),
    personaGender: null, // the brand profile has no customer-gender field yet; never guessed
    tone: p.brandVoice,
    requiredFormats: ["video", "ugc", "static"],
    contentKeywords,
    competitors: [],
  };
}
