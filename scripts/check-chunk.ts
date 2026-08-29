// Runnable check for the campaign-filter chunking (ISSUE 06). No env needed.
//   node --experimental-strip-types scripts/check-chunk.ts
// Proves the aggregation the live path relies on (can't be tested against a real 50+ campaign account):
// chunking is an exact disjoint partition, so summing totals and merging top-N across batches match
// the whole-set result.
import { strict as assert } from "node:assert";
import { chunk, CAMPAIGN_FILTER_CHUNK } from "../lib/meta-source.ts";

const ids = Array.from({ length: 133 }, (_, i) => `c${i}`);
const batches = chunk(ids, CAMPAIGN_FILTER_CHUNK);

// Exact disjoint cover, order preserved, no loss/dup.
assert.equal(batches.length, 3, "133 / 50 -> 3 batches");
assert.deepEqual(batches.flat(), ids, "flatten == original (exact cover, in order)");
assert.equal(new Set(batches.flat()).size, 133, "no duplicates across batches");

// A set at/under the chunk size is a single batch = identical to the old single call.
assert.equal(chunk(ids.slice(0, 33), CAMPAIGN_FILTER_CHUNK).length, 1, "33 ids -> 1 batch");
assert.equal(chunk([], CAMPAIGN_FILTER_CHUNK).length, 0, "empty -> 0 batches");

// Totals: summing disjoint per-batch sums == whole-set sum (fetchScopeInsights aggregation).
const spend = new Map(ids.map((id, i) => [id, i + 1]));
const whole = ids.reduce((s, id) => s + spend.get(id)!, 0);
const chunked = batches.reduce((s, b) => s + b.reduce((bs, id) => bs + spend.get(id)!, 0), 0);
assert.equal(chunked, whole, "sum over chunks == sum over whole");

// Top-N: concat of per-batch top-N, re-sorted, sliced == global top-N (listTopSpendingAds aggregation).
const N = 5;
const bySpendDesc = (a: string, b: string) => spend.get(b)! - spend.get(a)!;
const merged = batches.flatMap((b) => [...b].sort(bySpendDesc).slice(0, N)).sort(bySpendDesc).slice(0, N);
const global = [...ids].sort(bySpendDesc).slice(0, N);
assert.deepEqual(merged, global, "chunked top-N == global top-N");

console.log("PASS: campaign-filter chunking is an exact disjoint partition (sum + top-N aggregate correctly)");
