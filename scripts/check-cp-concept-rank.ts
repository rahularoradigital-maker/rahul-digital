// One runnable check for the concept ranking engine (Creative Production). No frameworks.
// Run: node --experimental-strip-types scripts/check-cp-concept-rank.ts
import assert from "node:assert/strict";
import { scoreConcept, rankConcepts, formatSuitability } from "../lib/creative-production/strategy/concept-engine.ts";
import type { ConceptFormat, StrategySignals } from "../lib/creative-production/types.ts";

const allOnes: StrategySignals = {
  productOpportunity: 1,
  creativeWhiteSpace: 1,
  audienceNeed: 1,
  historicalPerformance: 1,
  formatSuitability: 1,
  brandFit: 1,
};

// All-1s -> perfect 100.
assert.equal(scoreConcept(allOnes), 100, "all signals 1 -> 100");

// Any single zero factor zeroes the whole score (a concept that fails a dimension can't rank).
for (const k of Object.keys(allOnes) as (keyof StrategySignals)[]) {
  assert.equal(scoreConcept({ ...allOnes, [k]: 0 }), 0, `${k}=0 -> score 0`);
}

// Out-of-range inputs are clamped to [0,1] (never blow past 100 or go negative).
assert.equal(scoreConcept({ ...allOnes, brandFit: 5 }), 100, "brandFit>1 clamps to 1");
assert.equal(scoreConcept({ ...allOnes, brandFit: -3 }), 0, "brandFit<0 clamps to 0");

// A higher-signal concept outranks a lower one.
const strong = scoreConcept({ ...allOnes, historicalPerformance: 0.9 });
const weak = scoreConcept({ ...allOnes, historicalPerformance: 0.3 });
assert.ok(strong > weak, "stronger historical performance ranks higher");

// rankConcepts: pure (no mutation) + sorts desc + stable on ties.
const input = [
  { id: "a", score: 40 },
  { id: "b", score: 90 },
  { id: "c", score: 40 }, // ties with a; must keep a-before-c order
  { id: "d", score: 70 },
];
const snapshot = JSON.stringify(input);
const ranked = rankConcepts(input);
assert.equal(JSON.stringify(input), snapshot, "input array not mutated");
assert.deepEqual(ranked.map((r) => r.id), ["b", "d", "a", "c"], "sorted desc, stable on the 40-tie");

// formatSuitability: a review format WITHOUT reviews is a hard 0.
const reviewFmt: ConceptFormat = {
  id: "testimonial-card",
  name: "Testimonial Card",
  awarenessStage: "solution",
  structure: "quote over product",
  textSlots: ["quote", "rating", "cta"],
  visualPattern: "customer + product",
  bestFor: "social proof",
};
assert.equal(formatSuitability(reviewFmt, "solution", false, false), 0, "review format, no reviews -> 0");
assert.equal(formatSuitability(reviewFmt, "solution", true, false), 1, "review format WITH reviews -> 1.0");

// A comparison format merely scores lower without comparison data (not disqualified).
const compareFmt: ConceptFormat = {
  id: "before-after",
  name: "Before / After",
  awarenessStage: "product",
  structure: "split frame",
  textSlots: ["headline", "cta"],
  visualPattern: "two states",
  bestFor: "transformation",
};
assert.equal(formatSuitability(compareFmt, "product", false, false), 0, "comparison format w/o comparison data -> 0 (hard requirement, never fabricate proof)");
assert.equal(formatSuitability(compareFmt, "product", false, true), 1, "comparison WITH data -> 1.0");

// A generic format sits at base 0.6.
const genericFmt: ConceptFormat = {
  id: "hero-shot",
  name: "Hero Shot",
  awarenessStage: "unaware",
  structure: "big product",
  textSlots: ["headline", "cta"],
  visualPattern: "product hero",
  bestFor: "awareness",
};
assert.equal(formatSuitability(genericFmt, "unaware", false, false), 0.6, "generic format -> base 0.6");

console.log("PASS: concept rank engine (all-1s=100, any-zero=0, clamp, desc+stable rank, review-format hard-0)");
