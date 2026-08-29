// One runnable check for the do-now queue ordering (priority tier, then money at stake). No frameworks.
// Run: node --experimental-strip-types scripts/check-action-order.ts
import assert from "node:assert/strict";
import { orderByMoneyAtStake } from "../lib/cockpit/analyze.ts";

const item = (priority: "DO_NOW" | "DO_NEXT" | "WATCH", moneyAtStakeRs: number, id: string) => ({ priority, moneyAtStakeRs, id });

// Within a tier, higher money sorts first.
const sorted = orderByMoneyAtStake([
  item("DO_NOW", 100, "a"),
  item("DO_NOW", 900, "b"),
  item("DO_NOW", 500, "c"),
]);
assert.deepEqual(sorted.map((i) => i.id), ["b", "c", "a"], "biggest money first within a tier");

// Tiers are respected regardless of money: a huge WATCH never jumps a small DO_NOW.
const tiers = orderByMoneyAtStake([
  item("WATCH", 1_000_000, "watch-big"),
  item("DO_NOW", 1, "donow-tiny"),
  item("DO_NEXT", 5000, "donext"),
]);
assert.deepEqual(tiers.map((i) => i.id), ["donow-tiny", "donext", "watch-big"], "priority tier wins over money");

// A zero-money item sinks to the bottom of its tier, never jumps.
const zero = orderByMoneyAtStake([
  item("DO_NOW", 0, "zero"),
  item("DO_NOW", 10, "ten"),
]);
assert.deepEqual(zero.map((i) => i.id), ["ten", "zero"], "zero-money item does not jump the queue");

// Pure: does not mutate the input.
const input = [item("DO_NOW", 1, "x"), item("DO_NOW", 2, "y")];
orderByMoneyAtStake(input);
assert.deepEqual(input.map((i) => i.id), ["x", "y"], "input array not mutated");

console.log("PASS: do-now queue ordered by priority tier then money at stake");
