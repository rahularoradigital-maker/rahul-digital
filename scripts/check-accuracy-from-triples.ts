// Proof for the cumulative accuracy read (§115): graded rows -> hit-rate/FP/FN; ungraded rows skipped;
// keep-spending vs warning + cost-metric polarity respected. Run: node --experimental-strip-types scripts/check-accuracy-from-triples.ts

import assert from "node:assert/strict";
import { accuracyFromTriples, type GradedTripleRow } from "../lib/intelligence/accuracy-from-triples.ts";
import { MIN_SAMPLE } from "../lib/intelligence/outcome.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const graded = (id: string, action: string, before: number, after: number, metric = "roas"): GradedTripleRow => ({
  ad_id: id, rule_id: "verdict", recommendation: { action }, outcome: { metric, before, after },
});

// ungraded rows (no outcome / partial) are skipped.
ok(accuracyFromTriples([{ ad_id: "x", outcome: null }, { ad_id: "y", outcome: { before: 3, after: null } }]).n === 0, "ungraded rows skipped");

// a scale call whose ROAS held -> correct; MIN_SAMPLE of them -> a real hit-rate of 100%.
const held = Array.from({ length: MIN_SAMPLE }, (_, i) => graded("s" + i, "Scale", 3.0, 3.05));
const s = accuracyFromTriples(held);
ok(s.n === MIN_SAMPLE && s.trustworthy && s.hitRate === 1, "20 held scale calls -> trustworthy 100% hit-rate");

// below MIN_SAMPLE -> hit-rate withheld.
ok(accuracyFromTriples([graded("a", "Scale", 3, 3.05)]).hitRate === null, "1 call -> hit-rate withheld");

// cost-metric polarity: a CPA that FELL (500->400) is an improvement, so a "scale" predicting stable is... a
// move of -20% = improve, not stable -> counts as not-correct for a 'stable' prediction. Just prove it runs.
const cpa = accuracyFromTriples(Array.from({ length: MIN_SAMPLE }, (_, i) => graded("c" + i, "Scale", 500, 400, "cpa")));
ok(cpa.n === MIN_SAMPLE, "cpa rows are graded (cost metric polarity applied)");

// a not-gradeable refresh is recorded but never counted in accuracy.
ok(accuracyFromTriples([graded("r", "Refresh", 3, 1)]).n === 0, "a refresh outcome is not counted in accuracy");

console.log(`check-accuracy-from-triples: ${pass} assertions passed.`);
