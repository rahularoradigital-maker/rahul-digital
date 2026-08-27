// One runnable check for the creative winner engine. No frameworks, no fixtures.
// Run: node --experimental-strip-types scripts/check-winner.ts
import assert from "node:assert/strict";
import { winnerScores } from "../lib/scoring/winner.ts";
import type { WinnerInput } from "../lib/scoring/winner.ts";

const accountMaxSpend = 100000;

// A proven scaled workhorse: strong on its objective, carries most of the account
// spend, stable, fresh, long runtime, plenty of half-life left.
const workhorse: WinnerInput = {
  objectiveScore: 85,
  spendRs: 90000,
  roas: 3.2,
  fatigueState: "fresh",
  stable: true,
  days: 21,
  halfLifeDays: 20,
};

// A tiny-spend fluke: same-ish objective number, but almost no proven spend, only a
// couple of days of data, not stable. High ROAS on a rounding error of budget.
const fluke: WinnerInput = {
  objectiveScore: 88,
  spendRs: 400,
  roas: 6.0,
  fatigueState: "fresh",
  stable: false,
  days: 2,
  halfLifeDays: 20,
};

// A fatigued ad: was good, now burning out.
const fatigued: WinnerInput = {
  objectiveScore: 80,
  spendRs: 50000,
  roas: 2.5,
  fatigueState: "fatigued",
  stable: true,
  days: 30,
  halfLifeDays: 1,
};

const w = winnerScores(workhorse, accountMaxSpend);
const f = winnerScores(fluke, accountMaxSpend);
const d = winnerScores(fatigued, accountMaxSpend);

// The workhorse must outrank the fluke overall - this is the whole point of the engine.
assert(w.overall > f.overall, "workhorse should outscore the tiny-spend fluke on overall");
// And especially on scale: proven spend is the differentiator.
assert(w.scale > f.scale, "workhorse should dominate the fluke on scale");
assert(w.scale > 90, "a 90k-of-100k-max spender should score high on scale");
// log-scaling lifts tiny spenders off zero on purpose, but the gap to the workhorse
// must stay wide: proven spend still clearly separates the two.
assert(w.scale - f.scale > 35, "the workhorse must sit far above the fluke on scale");

// The fatigued ad should be discounted on quality and have no opportunity headroom.
assert(d.quality < workhorse.objectiveScore, "fatigued ad quality should be discounted below its raw objectiveScore");
assert(d.opportunity === 0, "fatigued ad should have zero opportunity (no room to scale)");
assert(d.why.some((r) => r.includes("fatigued")), "fatigued ad why[] should flag the discount");

// Freshness boost: a fresh ad beats an otherwise identical fatiguing one on quality.
const freshQ = winnerScores({ ...workhorse, fatigueState: "fresh" }, accountMaxSpend).quality;
const fatiguingQ = winnerScores({ ...workhorse, fatigueState: "fatiguing" }, accountMaxSpend).quality;
assert(freshQ > fatiguingQ, "fresh should boost quality above fatiguing");

// accountMaxSpend <= 0 zeroes scale, never divides by zero.
assert(winnerScores(workhorse, 0).scale === 0, "scale must be 0 when accountMaxSpend<=0");

// Unknown half-life (null) is neutral, not zero opportunity, when the ad is good + fresh.
const unknownHL = winnerScores({ ...workhorse, halfLifeDays: null }, accountMaxSpend);
assert(unknownHL.opportunity > 0, "null half-life should be treated as neutral, not zero");

// Every score stays inside 0-100, for every ad, even with absurd inputs.
const extreme = winnerScores(
  { objectiveScore: 999, spendRs: 1e9, roas: 50, fatigueState: "fresh", stable: true, days: 999, halfLifeDays: 999 },
  accountMaxSpend,
);
for (const s of [w, f, d, extreme]) {
  for (const key of ["quality", "scale", "stability", "opportunity", "overall"] as const) {
    assert(s[key] >= 0 && s[key] <= 100, `${key} must be within 0-100, got ${s[key]}`);
  }
  assert(s.label === "INTERNAL CALCULATION", "label must be the fixed internal marker");
}

console.log("PASS: winner engine checks");
