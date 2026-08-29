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
import { risk } from "./risk.ts";

export type QualityWeights = { brandFit: number; audienceFit: number; contentFit: number; engagement: number; safety: number };
export const DEFAULT_QUALITY_WEIGHTS: QualityWeights = { brandFit: 0.3, audienceFit: 0.25, contentFit: 0.15, engagement: 0.15, safety: 0.15 };

export type CreatorScorecard = {
  quality: TransparentScore;
  brandFit: TransparentScore;
  audienceFit: TransparentScore;
  contentFit: TransparentScore;
  engagement: TransparentScore;
  risk: TransparentScore;
};

/** Score one creator against a brand target. Returns the composite + every sub-score for full transparency. */
export function scoreCreator(creator: NormalizedCreator, target: BrandTarget, weights: QualityWeights = DEFAULT_QUALITY_WEIGHTS, recentPostText?: string[]): CreatorScorecard {
  const bf = brandFit(creator, target);
  const af = audienceFit(creator, target);
  const cf = contentFit(creator, target, recentPostText);
  const eng = engagementScore(creator);
  const rk = risk(creator);

  const components: ScoreComponent[] = [
    { key: "brand_fit", score: bf.score, weight: weights.brandFit, confidence: bf.confidence, reason: bf.reason },
    { key: "audience_fit", score: af.score, weight: weights.audienceFit, confidence: af.confidence, reason: af.reason },
    { key: "content_fit", score: cf.score, weight: weights.contentFit, confidence: cf.confidence, reason: cf.reason },
    { key: "engagement", score: eng.score, weight: weights.engagement, confidence: eng.confidence, reason: eng.reason },
    // Safety = inverted risk (100 - risk). Risk's own confidence carries through.
    { key: "safety", score: 100 - rk.score, weight: weights.safety, confidence: rk.confidence, reason: `inverse of risk: ${rk.reason}` },
  ];
  const quality = compose(components, "Quality = weighted brand fit + audience fit + content fit + engagement + safety (all explainable, weights renormalized over usable sub-scores).");
  return { quality, brandFit: bf, audienceFit: af, contentFit: cf, engagement: eng, risk: rk };
}
