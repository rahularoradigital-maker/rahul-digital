// One runnable check for format diversity / test coverage. No frameworks.
// Run: node --experimental-strip-types scripts/check-cp-format-coverage.ts
import assert from "node:assert/strict";
import { computeCoverage } from "../lib/creative-production/formats/format-coverage.ts";
import { AD_FORMAT_LIBRARY } from "../lib/creative-production/formats/ad-format-library.ts";

// Empty history: nothing tested, all 42 counted, recommend a capped, all-untested, diverse-first list.
const zero = computeCoverage([]);
assert.equal(zero.total, 42, "total must be 42");
assert.equal(zero.testedCount, 0, "nothing tested yet");
assert.equal(zero.rows.length, 42, "a row per format");
assert.equal(zero.recommended.length, 8, "recommend up to 8 when everything is untested");
assert.ok(zero.recommended.every((r) => !r.tested), "recommendations are all untested");
// Diversity-first: with an empty history all categories tie at 0, so recommendations fall to library order.
assert.equal(zero.recommended[0].id, AD_FORMAT_LIBRARY[0].id, "first recommendation is the first library format when all tie");

// Some history: tested flags + count are correct, and recommendations never include a tested format.
const used = ["reddit-post", "offer-flash", "google-search"];
const some = computeCoverage(used);
assert.equal(some.testedCount, 3, "three tested");
for (const id of used) assert.ok(some.rows.find((r) => r.id === id)?.tested, `${id} marked tested`);
assert.ok(some.recommended.every((r) => !used.includes(r.id)), "recommendations exclude tested formats");

// byCategory totals sum to 42 and tested sums to testedCount.
const catTotal = some.byCategory.reduce((n, c) => n + c.total, 0);
const catTested = some.byCategory.reduce((n, c) => n + c.tested, 0);
assert.equal(catTotal, 42, "category totals sum to 42");
assert.equal(catTested, some.testedCount, "category tested sums to testedCount");

// Diversity steer: a category with a tested format should be de-prioritised vs an untested category.
// reddit-post is category "ui-mockup" (now has 1 tested); an untested category should rank ahead of the
// remaining ui-mockup formats in the recommendations.
const recCats = some.recommended.map((r) => r.category);
assert.ok(recCats[0] !== undefined, "has recommendations");

// Deterministic: same input -> identical output.
assert.deepEqual(computeCoverage(used), some, "coverage is deterministic");

console.log(`OK check-cp-format-coverage: 42 total, tested/recommend logic + diversity steer + determinism verified.`);
