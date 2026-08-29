// Engagement scorer: map a creator's engagement rate to a 0..100 quality score, and DOCUMENT the method.
// Engagement has no universal cross-platform formula, so we carry the denominator we used; we never present
// one platform's calculation as universal truth (APP-CANON). Pure.

import type { NormalizedCreator, TransparentScore } from "../types.ts";
import { compose } from "./util.ts";

// Diminishing-returns curve: ~1% -> 39, ~3% -> 78, ~6%+ -> ~95. calibrate-at-build (to be ledger-tuned).
function erToScore(er: number): number {
  if (er <= 0) return 0;
  return Math.min(100, Math.round(100 * (1 - Math.exp(-er / 0.02))));
}

export function engagementScore(creator: NormalizedCreator): TransparentScore {
  const er = creator.engagementRate.value;
  if (er == null || creator.engagementRate.confidence === "none") {
    return compose([{ key: "engagement", score: 0, weight: 1, confidence: "none", reason: "no engagement data" }], "Engagement unknown.");
  }
  return compose(
    [{ key: "engagement", score: erToScore(er), weight: 1, confidence: creator.engagementRate.confidence, reason: `${(er * 100).toFixed(1)}% via ${creator.engagementMethod}` }],
    `Engagement ${(er * 100).toFixed(1)}% (${creator.engagementMethod}).`,
  );
}
