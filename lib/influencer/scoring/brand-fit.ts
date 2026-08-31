// Brand-Fit: "why is THIS creator right for THIS brand?" - the core differentiator. Category/product
// relevance (creator's own words vs the brand's) plus geography. Audience alignment is NOT included here: it
// is its own top-level quality component (audience_fit), so counting it inside brand-fit too would weight the
// audience twice. Brand-fit also DELIBERATELY excludes follower count: fit is about relevance, not reach
// (APP-CANON). Every component shows evidence. Pure.

import type { NormalizedCreator, BrandTarget, TransparentScore, ScoreComponent, Confidence } from "../types.ts";
import { tokens, overlapScore, compose } from "./util.ts";

export function brandFit(creator: NormalizedCreator, target: BrandTarget): TransparentScore {
  const components: ScoreComponent[] = [];

  const brandWords = tokens(target.category, ...target.keyProducts, ...target.contentKeywords, target.tone);
  const creatorWords = tokens(creator.name.value, creator.bio.value);
  const catConf: Confidence = creator.bio.value ? "medium" : creatorWords.size > 0 ? "low" : "none";
  // Category relevance is the dominant brand-fit signal; geography is a lighter modifier.
  components.push({ key: "category_relevance", score: overlapScore(brandWords, creatorWords), weight: 0.7, confidence: catConf, reason: creator.bio.value ? "creator's bio/name overlaps the brand's category, products and needed angles" : "little public text to judge category relevance" });

  const geoScore = target.targetCountry && creator.creatorCountry.value ? (creator.creatorCountry.value === target.targetCountry ? 100 : 0) : 0;
  components.push({ key: "geo_relevance", score: geoScore, weight: 0.3, confidence: creator.creatorCountry.value ? creator.creatorCountry.confidence : "none", reason: creator.creatorCountry.value ? `creator is in ${creator.creatorCountry.value}${target.targetCountry ? ` vs target ${target.targetCountry}` : ""}` : "creator location unknown" });

  return compose(components, "Brand fit = category/product relevance + geography (audience is scored separately; follower count deliberately excluded).");
}
