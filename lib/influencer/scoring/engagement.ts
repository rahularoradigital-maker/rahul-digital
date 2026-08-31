// Engagement scorer: map a creator's engagement rate to a 0..100 quality score, and DOCUMENT the method.
// Engagement has no universal cross-platform formula, so we carry the denominator we used; we never present
// one platform's calculation as universal truth (APP-CANON). Pure.

import type { NormalizedCreator, TransparentScore } from "../types.ts";
import { compose } from "./util.ts";

// Engagement QUALITY, not raw magnitude. Two regimes:
//  1. Rising diminishing-returns up to a plausible ceiling: ~1% -> 39, ~3% -> 78, ~6% -> ~95, ~12% -> ~99.
//  2. ABOVE the plausible ceiling the score TURNS OVER and declines, because engagement that high is far more
//     likely bought/inflated than genuinely better - it must not out-score a healthy real rate. (Risk scores
//     the anomaly separately; this keeps the quality signal itself from rewarding implausible engagement.)
// A legitimately high-engagement nano (say 12-15%) is barely touched; only clearly implausible rates (>~20%)
// are pulled down hard. calibrate-at-build (to be ledger-tuned).
const PLAUSIBLE_CEIL = 0.15; // above this, extra "engagement" is treated as increasingly likely inauthentic
function erToScore(er: number): number {
  if (er <= 0) return 0;
  const rising = 100 * (1 - Math.exp(-er / 0.02)); // → ~100 by ~6%
  if (er <= PLAUSIBLE_CEIL) return Math.min(100, Math.round(rising));
  // Past the ceiling: subtract a penalty that grows with how far past plausible we are (full 60 at ~2x ceil).
  const penalty = Math.min(60, ((er - PLAUSIBLE_CEIL) / PLAUSIBLE_CEIL) * 60);
  return Math.max(0, Math.round(rising - penalty));
}

/** True when the engagement rate is high enough to read as likely inflated rather than genuinely strong. */
function isImplausible(er: number): boolean {
  return er > PLAUSIBLE_CEIL;
}

export function engagementScore(creator: NormalizedCreator): TransparentScore {
  const er = creator.engagementRate.value;
  if (er == null || creator.engagementRate.confidence === "none") {
    return compose([{ key: "engagement", score: 0, weight: 1, confidence: "none", reason: "no engagement data" }], "Engagement unknown.");
  }
  const flag = isImplausible(er) ? " - implausibly high, likely inflated, so scored down" : "";
  return compose(
    [{ key: "engagement", score: erToScore(er), weight: 1, confidence: creator.engagementRate.confidence, reason: `${(er * 100).toFixed(1)}% via ${creator.engagementMethod}${flag}` }],
    `Engagement ${(er * 100).toFixed(1)}% (${creator.engagementMethod})${flag}.`,
  );
}
