// Runnable check for the pure creative-rollup ranking (10x #5). Run: npm run check:creative-rollups
import { strict as assert } from "node:assert";
import { topCreatives, classifyCreatives, type CreativeAgg, DEFAULT_TOP_N } from "../lib/rollups/creative-pure.ts";

function ad(adId: string, spend: number): CreativeAgg {
  return { adId, name: adId, spend, revenue: spend * 2, purchases: 1, roas: 2, active: true };
}
function adRoas(adId: string, spend: number, roas: number | null): CreativeAgg {
  return { adId, name: adId, spend, revenue: roas == null ? 0 : spend * roas, purchases: 1, roas, active: true };
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

  // classifyCreatives: judged against the account's OWN average ROAS, material-spend gated (1% of total).
  // Account: one big winner, one big waster, one tiny ad (immaterial -> steady regardless).
  const flagged = classifyCreatives([
    adRoas("win", 1000, 5), // well above avg
    adRoas("bleed", 1000, 0.2), // spending, near-zero return
    adRoas("tiny", 5, 0.01), // immaterial spend -> steady
  ]);
  const byId = Object.fromEntries(flagged.map((f) => [f.adId, f.flag]));
  assert.equal(byId["win"], "winner", "materially above account avg ROAS -> winner");
  assert.equal(byId["bleed"], "wasting", "material spend, far below avg -> wasting");
  assert.equal(byId["tiny"], "steady", "immaterial spend -> steady (never judged)");
  // No account bar (all zero spend) -> everything steady, no crash.
  assert.ok(classifyCreatives([{ adId: "z", name: "z", spend: 0, revenue: 0, purchases: 0, roas: null, active: null }]).every((f) => f.flag === "steady"));

  console.log("PASS: creative rollups (rank by spend, deterministic tie-break, N cap, empty-safe, own-avg flagging)");
}

main();
