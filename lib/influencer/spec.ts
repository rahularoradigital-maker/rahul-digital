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
