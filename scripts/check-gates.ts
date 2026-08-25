// Runnable check for lib/rules/trust-gates.ts + lib/rules/spend-floor.ts. No env, no I/O.
//   node --experimental-strip-types scripts/check-gates.ts
import { strict as assert } from "node:assert";
import {
  applySpendFloor,
  SPEND_FLOOR,
  type FloorItem,
} from "../lib/rules/spend-floor.ts";
import {
  meetsGate,
  rebalanceWeights,
  needsHumanReview,
} from "../lib/rules/trust-gates.ts";

// --- spend floor: INR boundary (floor 300, strictly greater passes) ---
const inrItems: FloorItem[] = [
  { id: "inr-keep", currency: "INR", spendLast7dInr: 301 },
  { id: "inr-drop", currency: "INR", spendLast7dInr: 299 },
];
const inrOut = applySpendFloor(inrItems);
assert.deepEqual(inrOut.scored.map((i) => i.id), ["inr-keep"], "INR 301 stays scored");
assert.deepEqual(inrOut.lowData.map((i) => i.id), ["inr-drop"], "INR 299 drops to lowData");

// --- spend floor: USD boundary (floor 5) ---
const usdItems: FloorItem[] = [
  { id: "usd-keep", currency: "USD", spendLast7dUsd: 6 },
  { id: "usd-drop", currency: "USD", spendLast7dUsd: 4 },
];
const usdOut = applySpendFloor(usdItems);
assert.deepEqual(usdOut.scored.map((i) => i.id), ["usd-keep"], "USD 6 stays scored");
assert.deepEqual(usdOut.lowData.map((i) => i.id), ["usd-drop"], "USD 4 drops to lowData");

// --- missing spend for the item's currency → treated as 0 → lowData ---
const missing: FloorItem[] = [
  { id: "inr-missing", currency: "INR" }, // no spendLast7dInr
  { id: "usd-wrongcur", currency: "USD", spendLast7dInr: 9999 }, // spend in the other currency
];
const missingOut = applySpendFloor(missing);
assert.equal(missingOut.scored.length, 0, "missing/other-currency spend never gets scored");
assert.deepEqual(
  missingOut.lowData.map((i) => i.id),
  ["inr-missing", "usd-wrongcur"],
  "missing spend routes to lowData",
);

// --- purity: input array not mutated, no items lost or duplicated ---
const original: FloorItem[] = [
  { id: "a", currency: "INR", spendLast7dInr: 500 },
  { id: "b", currency: "INR", spendLast7dInr: 100 },
];
const snapshot = JSON.stringify(original);
const split = applySpendFloor(original);
assert.equal(JSON.stringify(original), snapshot, "applySpendFloor must not mutate input");
assert.equal(original.length, 2, "input length unchanged");
assert.equal(
  split.scored.length + split.lowData.length,
  original.length,
  "every input item lands in exactly one bucket, none deleted",
);

// floor constants are the owner anchors
assert.equal(SPEND_FLOOR.inr, 300, "INR floor anchor");
assert.equal(SPEND_FLOOR.usd, 5, "USD floor anchor");

// --- meetsGate: equal passes (>=) ---
assert.equal(meetsGate(3, 3), true, "actual equal to gate passes");
assert.equal(meetsGate(3, 4), true, "actual above gate passes");
assert.equal(meetsGate(3, 2), false, "actual below gate fails");

// --- rebalanceWeights: drop c, renormalise to sum 1.00, never fill with an average ---
const rebalanced = rebalanceWeights({ a: 0.5, b: 0.3, c: 0.2 }, ["c"]);
assert.deepEqual(rebalanced, { a: 0.625, b: 0.375 }, "dropped dim renormalises survivors");
const rebalSum = rebalanced.a + rebalanced.b;
assert.equal(rebalSum, 1.0, "rebalanced weights sum to exactly 1.0");

// --- needsHumanReview: below the 0.97 floor is a question for a human ---
assert.equal(needsHumanReview(0.96), true, "0.96 needs human review");
assert.equal(needsHumanReview(0.98), false, "0.98 clears the floor");

console.log("PASS: trust gates + spend floor checks");
