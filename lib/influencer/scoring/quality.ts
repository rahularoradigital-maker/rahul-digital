// Creator Quality Score: the composite the shortlist ranks on. Configurable weights over the transparent
// sub-scores (brand fit, audience fit, content fit, engagement, and inverted risk). Every sub-score is
// itself explainable, so the composite is fully auditable end to end - no unexplained rankings. The
// composite's confidence is the weakest load-bearing sub-score's (a great brand-fit built on a low-
// confidence audience read is not a high-confidence overall). Pure.

import type { NormalizedCreator, BrandTarget, TransparentScore, ScoreComponent } from "../types.ts";
import { compose } from "./util.ts";
import { brandFit } from "./brand-fit.ts";
import { audienceFit } from "./audience-fit.ts";
import { contentFit } from "./content-fit.ts";
import { engagementScore } from "./engagement.ts";
import { reachScore } from "./reach.ts";
import { consistencyScore } from "./consistency.ts";
import { risk } from "./risk.ts";

export type QualityWeights = { brandFit: number; audienceFit: number; contentFit: number; engagement: number; reach: number; consistency: number; safety: number };
// Richer 7-signal formula. Audience is down-weighted because it is usually unavailable without a paid provider
// (it then drops out and the rest rebalance); reach + consistency are the new reel-derived signals.
export const DEFAULT_QUALITY_WEIGHTS: QualityWeights = { brandFit: 0.22, audienceFit: 0.1, contentFit: 0.13, engagement: 0.15, reach: 0.15, consistency: 0.1, safety: 0.15 };

export type CreatorScorecard = {
  quality: TransparentScore;
  brandFit: TransparentScore;
  audienceFit: TransparentScore;
  contentFit: TransparentScore;
  engagement: TransparentScore;
  reach: TransparentScore;
  consistency: TransparentScore;
  risk: TransparentScore;
};

/** Score one creator against a brand target. Returns the composite + every sub-score for full transparency. */
export function scoreCreator(creator: NormalizedCreator, target: BrandTarget, weights: QualityWeights = DEFAULT_QUALITY_WEIGHTS, recentPostText?: string[]): CreatorScorecard {
  const bf = brandFit(creator, target, recentPostText);
  const af = audienceFit(creator, target);
  const cf = contentFit(creator, target, recentPostText);
  const eng = engagementScore(creator);
  const rch = reachScore(creator);
  const con = consistencyScore(creator);
  const rk = risk(creator);

  const components: ScoreComponent[] = [
    { key: "brand_fit", score: bf.score, weight: weights.brandFit, confidence: bf.confidence, reason: bf.reason },
    { key: "audience_fit", score: af.score, weight: weights.audienceFit, confidence: af.confidence, reason: af.reason },
    { key: "content_fit", score: cf.score, weight: weights.contentFit, confidence: cf.confidence, reason: cf.reason },
    { key: "engagement", score: eng.score, weight: weights.engagement, confidence: eng.confidence, reason: eng.reason },
    { key: "reach", score: rch.score, weight: weights.reach, confidence: rch.confidence, reason: rch.reason },
    { key: "consistency", score: con.score, weight: weights.consistency, confidence: con.confidence, reason: con.reason },
    // Safety = inverted risk (100 - risk). Risk's own confidence carries through.
    { key: "safety", score: 100 - rk.score, weight: weights.safety, confidence: rk.confidence, reason: `inverse of risk: ${rk.reason}` },
  ];
  const quality = compose(components, "Quality = weighted brand fit + audience fit + content fit + engagement + reach + consistency + safety (all explainable, weights renormalized over usable sub-scores).");
  return { quality, brandFit: bf, audienceFit: af, contentFit: cf, engagement: eng, reach: rch, consistency: con, risk: rk };
}
