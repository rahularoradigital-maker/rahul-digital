// Pure search-spec + query helpers for discovery. Kept free of any `@/` import so the discovery orchestration
// (which imports these) stays importable by the node runnable checks. brandTargetFromProfile - which needs the
// app's iso2 helper - lives in brand-target.ts and is only used server-side.

import type { BrandTarget, CreatorSearchSpec } from "./types.ts";

/** The Instagram search spec. No hard follower/engagement gates by default so real discovery is not
 * over-filtered (the ranking formula sorts them) - and NO creator-country gate, because the public IG
 * profile does not expose creator country, so gating on it would wrongly reject everyone. */
export function creatorSearchSpecFrom(target: BrandTarget): CreatorSearchSpec {
  return {
    platform: "instagram",
    keywords: target.contentKeywords,
    minFollowers: null,
    maxFollowers: null,
    minEngagementRate: null,
    creatorCountry: null,
    creatorGender: null,
    audienceCountry: target.targetCountry,
    languages: target.languages,
    tier: null,
  };
}

/** Hashtags to discover CREATORS from (people posting under the brand's topics), not shops named after the
 * category. Built from the category + each product + content keywords, compacted to hashtag form
 * (alphanumeric, lowercased). Category/products first (most specific), then content tokens. Deduped, capped.
 * Falls back to the account name so a thin brand profile still yields a hashtag to try. */
export function discoveryHashtags(target: BrandTarget, accountName: string | null, max = 6): string[] {
  const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const ordered = [target.category ?? "", ...target.keyProducts, ...target.contentKeywords]
    .map(compact)
    .filter((h) => h.length >= 4);
  const uniq = [...new Set(ordered)].slice(0, max);
  if (uniq.length === 0 && accountName?.trim()) uniq.push(compact(accountName));
  return uniq.filter(Boolean);
}

/** The actual strings handed to the provider's search endpoint. Category + each key product make good creator
 * search terms (e.g. "women's ethnic wear", "kurta", "saree"). Deduped, trimmed, capped to keep credit cost
 * bounded. Falls back to the account name so a brand with a thin profile still returns something. */
export function discoveryQueries(target: BrandTarget, accountName: string | null, max = 4): string[] {
  const out = [target.category ?? "", ...target.keyProducts].map((q) => q.trim()).filter(Boolean);
  const seen = new Set<string>();
  const uniq = out.filter((q) => {
    const k = q.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const queries = uniq.slice(0, max);
  if (queries.length === 0 && accountName?.trim()) queries.push(accountName.trim());
  return queries;
}
