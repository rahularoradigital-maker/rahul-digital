// One runnable check for the level-metrics rollup. No frameworks, no fixtures.
// Run: node --experimental-strip-types scripts/check-level-metrics.ts
import assert from "node:assert/strict";
import { levelMetrics, type LevelRow } from "../lib/cockpit/level-metrics.ts";

function row(over: Partial<LevelRow>): LevelRow {
  return {
    id: "ad",
    name: "Ad",
    adSetId: undefined,
    adsetName: undefined,
    campaignId: undefined,
    campaignName: undefined,
    spendRs: 0,
    revenueRs: 0,
    conversions: 0,
    ...over,
  };
}

// Two ads in one campaign / ad set, one ad in a second campaign.
const rows: LevelRow[] = [
  row({ id: "a1", name: "Ad 1", adSetId: "s1", adsetName: "Set A", campaignId: "c1", campaignName: "Camp X", spendRs: 1000, revenueRs: 3000, conversions: 10 }),
  row({ id: "a2", name: "Ad 2", adSetId: "s1", adsetName: "Set A", campaignId: "c1", campaignName: "Camp X", spendRs: 500, revenueRs: 500, conversions: 5 }),
  row({ id: "a3", name: "Ad 3", adSetId: "s2", adsetName: "Set B", campaignId: "c2", campaignName: "Camp Y", spendRs: 250, revenueRs: 0, conversions: 0 }),
];

// Ad level: one group per row, identity math, sorted by spend desc.
const ads = levelMetrics(rows, "ad");
assert.equal(ads.length, 3);
assert.deepEqual(ads.map((g) => g.key), ["a1", "a2", "a3"]);
assert.equal(ads[0].roas, 3); // 3000 / 1000
assert.equal(ads[0].cpaRs, 100); // 1000 / 10

// Campaign level: Camp X sums both ads, Camp Y is the third. Sorted by spend desc.
const camps = levelMetrics(rows, "campaign");
assert.equal(camps.length, 2);
assert.equal(camps[0].key, "c1");
assert.equal(camps[0].label, "Camp X");
assert.equal(camps[0].ads, 2);
assert.equal(camps[0].spendRs, 1500);
assert.equal(camps[0].revenueRs, 3500);
assert.equal(camps[0].purchases, 15);
assert.equal(camps[0].roas, 3500 / 1500);
assert.equal(camps[0].cpaRs, 1500 / 15);

// Ad set level: Set A rolls up the same two ads.
const sets = levelMetrics(rows, "adset");
assert.equal(sets.length, 2);
assert.equal(sets[0].key, "s1");
assert.equal(sets[0].label, "Set A");
assert.equal(sets[0].spendRs, 1500);

// Null on zero denominator: Camp Y has revenue 0 (roas defined = 0/250 = 0) and 0 purchases (cpa null).
const campY = camps.find((g) => g.key === "c2");
assert.ok(campY);
assert.equal(campY.roas, 0); // real 0 revenue over real spend is a true 0, not null
assert.equal(campY.cpaRs, null); // 0 purchases -> null, never a divide-by-zero

// A zero-spend group: ROAS is null (no spend to divide by), not NaN.
const zeroSpend = levelMetrics([row({ id: "z", campaignId: "cz", campaignName: "Zero", spendRs: 0, revenueRs: 0, conversions: 0 })], "campaign");
assert.equal(zeroSpend[0].roas, null);
assert.equal(zeroSpend[0].cpaRs, null);
assert.ok(!Number.isNaN(zeroSpend[0].roas ?? 0));

// Empty input yields an empty rollup, not a throw.
assert.deepEqual(levelMetrics([], "ad"), []);

// Missing id/name at a level falls back to a deterministic constant key (no crash, no merge-by-accident).
const unnamed = levelMetrics([row({ id: "u1", name: "", campaignId: "", campaignName: "", spendRs: 10, revenueRs: 20, conversions: 1 })], "campaign");
assert.equal(unnamed.length, 1);
assert.equal(unnamed[0].label, "Unnamed");

console.log("PASS: level metrics rollup checks");
