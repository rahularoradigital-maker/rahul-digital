// Engagement scorer: map a creator's engagement rate to a 0..100 quality score, and DOCUMENT the method.
// Engagement has no universal cross-platform formula, so we carry the denominator we used; we never present
// one platform's calculation as universal truth (APP-CANON). Pure.

import type { NormalizedCreator, TransparentScore, ScoreComponent } from "../types.ts";
import { compose } from "./util.ts";

// Engagement QUALITY, not raw magnitude. Two regimes:
//  1. Rising diminishing-returns up to a plausible ceiling: ~1% -> 39, ~3% -> 78, ~6% -> ~95, ~12% -> ~99.
//  2. ABOVE the plausible ceiling the score TURNS OVER and declines, because engagement that high is far more
//     likely bought/inflated than genuinely better - it must not out-score a healthy real rate. (Risk scores
//     the anomaly separately; this keeps the quality signal itself from rewarding implausible engagement.)
// A legitimately high-engagement nano (say 12-15%) is barely touched; only clearly implausible rates (>~20%)
// are pulled down hard. calibrate-at-build (to be ledger-tuned).
export const BASE_PLAUSIBLE_CEIL = 0.15; // at reach = 1x: above this, extra "engagement" reads as inauthentic
const MAX_REACH_MULTIPLIER = 4; // a viral spike widens the plausible band, but never enough to excuse ANY rate

/** The plausible ceiling for a FOLLOWER engagement rate, RAISED in proportion to how far the creator's content
 * travels beyond its follower base. Reels seen by R× the followers legitimately drive ~R× the follower-ER (the
 * same per-viewer interaction rate over a smaller denominator), so a high follower-ER is EXPECTED, not inflated.
 * Capped at MAX_REACH_MULTIPLIER so a viral spike can't excuse an arbitrarily high rate. reachRatio null or <=1
 * (no amplification beyond followers) leaves the base ceiling untouched. `base` lets callers with a looser
 * anomaly line (e.g. the risk engine's 0.2) share the same reach-scaling; defaults to the quality ceiling. */
export function plausibleErCeil(reachRatio: number | null, base: number = BASE_PLAUSIBLE_CEIL): number {
  const mult = reachRatio != null && reachRatio > 1 ? Math.min(reachRatio, MAX_REACH_MULTIPLIER) : 1;
  return base * mult;
}

function erToScore(er: number, ceil: number): number {
  if (er <= 0) return 0;
  const rising = 100 * (1 - Math.exp(-er / 0.02)); // → ~100 by ~6%
  if (er <= ceil) return Math.min(100, Math.round(rising));
  // Past the ceiling: subtract a penalty that grows with how far past plausible we are (full 60 at ~2x ceil).
  const penalty = Math.min(60, ((er - ceil) / ceil) * 60);
  return Math.max(0, Math.round(rising - penalty));
}

/** True when a FOLLOWER-based engagement rate is high enough to read as likely inflated, AFTER crediting the
 * creator's reach beyond its followers (viral reach legitimately lifts the plausible ceiling). */
export function isImplausibleEr(er: number, reachRatio: number | null): boolean {
  return er > plausibleErCeil(reachRatio);
}

// Reel engagement rate is (likes+comments)/VIEWS - a different denominator than follower ER, and a legitimately
// engaging reel can hit double digits, so it uses the plain rising curve (no turn-over penalty).
function reelErToScore(er: number): number {
  if (er <= 0) return 0;
  return Math.min(100, Math.round(100 * (1 - Math.exp(-er / 0.02))));
}

export function engagementScore(creator: NormalizedCreator): TransparentScore {
  // Blend the POST engagement rate (interactions/followers, plausibility-penalized) with the REEL engagement
  // rate (interactions/views) when we have it - a richer, harder-to-fake read than either alone.
  const components: ScoreComponent[] = [];

  const reachRatio = creator.reels?.reachRatio ?? null;
  const ceil = plausibleErCeil(reachRatio);
  const er = creator.engagementRate.value;
  if (er != null && creator.engagementRate.confidence !== "none") {
    const reachLifted = reachRatio != null && reachRatio > 1 && er > BASE_PLAUSIBLE_CEIL && er <= ceil;
    const flag = isImplausibleEr(er, reachRatio)
      ? " - implausibly high, likely inflated, so scored down"
      : reachLifted
        ? ` - high but expected given ${reachRatio.toFixed(1)}x reach beyond followers`
        : "";
    components.push({ key: "post_engagement", score: erToScore(er, ceil), weight: 1, confidence: creator.engagementRate.confidence, reason: `posts ${(er * 100).toFixed(1)}% via ${creator.engagementMethod}${flag}` });
  }

  const reelEr = creator.reels?.reelEngagementRate ?? null;
  if (reelEr != null && creator.reels && creator.reels.confidence !== "none") {
    components.push({ key: "reel_engagement", score: reelErToScore(reelEr), weight: 1, confidence: creator.reels.confidence, reason: `reels ${(reelEr * 100).toFixed(1)}% (likes+comments per view over ${creator.reels.sampled} reels)` });
  }

  if (components.length === 0) {
    return compose([{ key: "engagement", score: 0, weight: 1, confidence: "none", reason: "no engagement data" }], "Engagement unknown.");
  }
  const labels = components.map((c) => (c.key === "reel_engagement" ? "reel" : "post")).join(" + ");
  return compose(components, `Engagement from ${labels} rates.`);
}
