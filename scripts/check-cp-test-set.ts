// Runnable check for the A/B test-set builder (lib/creative-production/strategy/test-set.ts). No I/O.
// node --experimental-strip-types scripts/check-cp-test-set.ts
import assert from "node:assert/strict";
import { buildTestSet, distinctAngleCount } from "../lib/creative-production/strategy/test-set.ts";

const c = (id: string, score: number, angle: string, awarenessStage = "product", formatId = "single") => ({ id, score, angle, awarenessStage, formatId });

// Diverse angles: picks the top of each distinct angle, best-first.
const many = [c("a", 90, "benefit"), c("b", 85, "benefit"), c("c", 80, "social-proof"), c("d", 70, "urgency")];
const set = buildTestSet(many, 3);
assert.deepEqual(set.map((x) => x.id), ["a", "c", "d"], "top of each distinct angle, best-first (skips 'b' = same angle as 'a')");
assert.equal(distinctAngleCount(set), 3, "3 distinct angles");

// Few distinct angles: still returns n by filling with next-highest remaining.
const few = [c("a", 90, "benefit"), c("b", 85, "benefit"), c("c", 80, "benefit")];
const set2 = buildTestSet(few, 3);
assert.deepEqual(set2.map((x) => x.id), ["a", "b", "c"], "one angle -> fills with next-highest to reach n");
assert.equal(distinctAngleCount(set2), 1, "honest: only 1 distinct angle");

// Respects n and never fabricates.
assert.equal(buildTestSet(many, 2).length, 2);
assert.equal(buildTestSet([], 3).length, 0, "no concepts -> empty, never invented");
assert.equal(buildTestSet(many, 0).length, 0);

// Highest score always leads.
assert.equal(buildTestSet(many, 1)[0].id, "a", "best concept leads the set");

console.log("PASS: A/B test-set builder (diverse angles, fills to n, honest distinct count, no fabrication)");
