// Runnable check for the pure creative-rollup ranking (10x #5). Run: npm run check:creative-rollups
import { strict as assert } from "node:assert";
import { topCreatives, type CreativeAgg, DEFAULT_TOP_N } from "../lib/rollups/creative-pure.ts";

function ad(adId: string, spend: number): CreativeAgg {
  return { adId, name: adId, spend, revenue: spend * 2, purchases: 1, roas: 2, active: true };
}

function main() {
  // Ranks by spend desc, keeps top N.
  const ranked = topCreatives([ad("a", 10), ad("b", 100), ad("c", 50)], 2);
  assert.deepEqual(ranked.map((x) => x.adId), ["b", "c"], "top-2 by spend, descending");
  assert.equal(ranked.length, 2, "respects N");

  // Deterministic tie-break by adId (same input -> same order).
  const tie = topCreatives([ad("z", 5), ad("a", 5), ad("m", 5)]);
  assert.deepEqual(tie.map((x) => x.adId), ["a", "m", "z"], "spend ties break by adId");

  // Empty + N=0 are safe.
  assert.deepEqual(topCreatives([]), [], "empty in -> empty out");
  assert.deepEqual(topCreatives([ad("a", 1)], 0), [], "N=0 -> empty");

  // Default N caps a large set.
  const many = Array.from({ length: 200 }, (_, i) => ad(`ad${i}`, i));
  assert.equal(topCreatives(many).length, DEFAULT_TOP_N, "defaults to DEFAULT_TOP_N");
  assert.equal(topCreatives(many)[0].adId, "ad199", "highest spend first");

  console.log("PASS: creative rollups (rank by spend, deterministic tie-break, N cap, empty-safe)");
}

main();
