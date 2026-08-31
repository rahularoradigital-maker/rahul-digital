// Concept ranking engine (Phase 5) — PURE, no I/O. This module does NOT compute the six strategy
// signals; it only COMBINES them into one deterministic rank. The signals themselves are sourced
// upstream from AdBrain's existing intelligence:
//   - productOpportunity   — Product DNA / offer eligibility read (lib/creative-production/shopify + Product DNA).
//   - creativeWhiteSpace   — diversity/white-space gap analysis (lib/creative/diversity.ts).
//   - audienceNeed         — persona/awareness demand from the strategy read.
//   - historicalPerformance— ad_metrics + fatigue signal (what has actually worked / gone stale).
//   - formatSuitability    — formatSuitability() below (does the format's data requirement hold?).
//   - brandFit             — Brand DNA alignment.
// Keeping the combine step here (and only here) means the ranking is one auditable formula, not a
// number smeared across the pipeline.

import type { ConceptFormat, StrategySignals } from "@/lib/creative-production/types";

// Clamp any incoming signal to the [0,1] contract before it enters the product.
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// Deterministic ranking score = PRODUCT of the six 0..1 signals, scaled to 0..100 and rounded.
// The product (not an average) is deliberate: a concept that fails ANY dimension can't rank, because
// one zero factor zeroes the whole score. A weak-but-nonzero factor only discounts the score.
export function scoreConcept(s: StrategySignals): number {
  const product =
    clamp01(s.productOpportunity) *
    clamp01(s.creativeWhiteSpace) *
    clamp01(s.audienceNeed) *
    clamp01(s.historicalPerformance) *
    clamp01(s.formatSuitability) *
    clamp01(s.brandFit);
  return Math.round(product * 100);
}

// Pure sort by score desc: stable (equal scores keep input order) and non-mutating (copy first).
export function rankConcepts<T extends { score: number }>(items: T[]): T[] {
  // Decorate with the original index so the sort is a STABLE desc sort regardless of engine internals.
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.score - a.item.score || a.index - b.index)
    .map((d) => d.item);
}

// Small, explainable 0..1 heuristic for the formatSuitability signal.
//   - A review/testimonial/rating format is credible ONLY with real reviews present: absent reviews is
//     a HARD requirement and returns 0 (the format literally has nothing true to show).
//   - A comparison / vs / before-after format WANTS comparison data: absent, it merely scores lower
//     (base, no bonus), it is not disqualified.
//   - base 0.6; +0.4 when the format's data requirement is actually met; generic formats stay at base.
// (The `awareness` param type mirrors the shared contract; it is accepted for call-site symmetry with
// the rest of the strategy read and does not change suitability on its own.)
export function formatSuitability(
  format: ConceptFormat,
  awareness: StrategySignals["audienceNeed"] extends never ? never : string,
  hasReviews: boolean,
  hasComparison: boolean,
): number {
  const hay = `${format.id} ${format.name}`.toLowerCase();
  const slots = format.textSlots;
  const isReviewFormat =
    /review|testimonial|rating/.test(hay) || slots.includes("rating") || slots.includes("quote");
  const isComparisonFormat = /compar|versus|(^|[^a-z])vs([^a-z]|$)|before[- ]?after/.test(hay);

  // HARD requirements: a format that must SHOW proof cannot run without that proof, or it fabricates - which
  // is exactly how a soundbar ended up with fake till-receipts. A review/rating format needs real reviews; a
  // comparison/versus/before-after format needs genuine comparison evidence. Missing -> 0, so the engine
  // never auto-selects a fake-proof ad. (Spec: do not fabricate competitive or product proof.)
  if (isReviewFormat && !hasReviews) return 0;
  if (isComparisonFormat && !hasComparison) return 0;

  const requirementMet = (isReviewFormat && hasReviews) || (isComparisonFormat && hasComparison);
  return 0.6 + (requirementMet ? 0.4 : 0);
}
