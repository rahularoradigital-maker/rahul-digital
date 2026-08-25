// Runnable check for lib/rules/comparator.ts (J2). check-crypto style: node:assert
// strict, prints one PASS line. Run: node --experimental-strip-types scripts/check-comparator.ts
import assert from "node:assert/strict";
import { objectiveAverage, adScore, type ComparableAd } from "../lib/rules/comparator.ts";

const ads: ComparableAd[] = [
  { id: "a", objective: "conversion", metric: 4.0 },
  { id: "b", objective: "conversion", metric: 6.0 },
  { id: "c", objective: "traffic", metric: 100 }, // different objective: must be ignored
];

// Same-objective average ignores the traffic ad entirely (J2: never cross-objective).
const conv = objectiveAverage(ads, "conversion");
assert.equal(conv.status, "ok");
if (conv.status === "ok") {
  assert.equal(conv.average, 5.0, "conversion avg = (4+6)/2, traffic ad excluded");
  assert.equal(conv.n, 2);
}

// History weighting: a long-history ad pulls the average toward itself.
const weighted = objectiveAverage(
  [
    { id: "old", objective: "conversion", metric: 5.0, historyWeight: 3 },
    { id: "new", objective: "conversion", metric: 1.0, historyWeight: 1 },
  ],
  "conversion",
);
assert.equal(weighted.status, "ok");
if (weighted.status === "ok") {
  assert.equal(weighted.average, (5 * 3 + 1 * 1) / 4, "weighted toward own long history");
}

// No same-objective peer -> insufficient_data, never a guessed number.
const none = objectiveAverage(ads, "leads");
assert.equal(none.status, "insufficient_data");

// All-zero-weight peers -> insufficient_data (cannot divide by zero weight).
const zero = objectiveAverage(
  [{ id: "z", objective: "conversion", metric: 9, historyWeight: 0 }],
  "conversion",
);
assert.equal(zero.status, "insufficient_data");

// adScore is the signed distance from the objective average.
assert.equal(adScore(6.0, 5.0), 1.0, "above-norm ad scores positive");
assert.equal(adScore(4.0, 5.0), -1.0, "below-norm ad scores negative");

console.log("PASS: same-objective comparator checks");
