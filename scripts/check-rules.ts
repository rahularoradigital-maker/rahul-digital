// Runnable check for the deterministic rules engine (lib/rules/*). No env needed.
//   node --experimental-strip-types scripts/check-rules.ts
import { strict as assert } from "node:assert";
import type { MetricsRow } from "../lib/ad-source.ts";
import { roas, ctr, cpa } from "../lib/rules/metrics.ts";
import { fatigue } from "../lib/rules/fatigue.ts";
import { wasteForAd } from "../lib/rules/waste.ts";

// Small helper so fixtures stay readable.
function row(p: Partial<MetricsRow> & { date: string }): MetricsRow {
  return {
    adExternalId: "ad_1",
    spend: 0,
    impressions: 0,
    clicks: 0,
    purchases: 0,
    revenue: 0,
    frequency: 0,
    ...p,
  };
}

// --- metrics: known hand-computed values ------------------------------------
const set = [
  row({ date: "2026-01-01", spend: 100, impressions: 1000, clicks: 50, purchases: 2, revenue: 400 }),
  row({ date: "2026-01-02", spend: 100, impressions: 1000, clicks: 30, purchases: 3, revenue: 200 }),
];
// roas = (400+200)/(100+100) = 600/200 = 3
const r = roas(set);
assert.equal(r.status, "ok");
assert.equal(r.status === "ok" && r.value, 3, "roas must equal hand-computed 3");
// ctr = (50+30)/(1000+1000) = 80/2000 = 0.04
const c = ctr(set);
assert.equal(c.status === "ok" && c.value, 0.04, "ctr must equal hand-computed 0.04");
// cpa = (100+100)/(2+3) = 200/5 = 40
const cp = cpa(set);
assert.equal(cp.status === "ok" && cp.value, 40, "cpa must equal hand-computed 40");

// --- the core safety rule: thin/empty input NEVER yields a number -----------
const empty: MetricsRow[] = [];
for (const [name, res] of [
  ["roas", roas(empty)],
  ["ctr", ctr(empty)],
  ["cpa", cpa(empty)],
] as const) {
  assert.equal(res.status, "insufficient_data", `${name}([]) must be insufficient_data`);
  assert.ok(!("value" in res), `${name}([]) must NOT return a numeric value`);
}
// zero denominators are also refusals, not zero/NaN
assert.equal(roas([row({ date: "2026-01-01", revenue: 5 })]).status, "insufficient_data", "zero spend → insufficient");
assert.equal(ctr([row({ date: "2026-01-01", clicks: 5 })]).status, "insufficient_data", "zero impressions → insufficient");
assert.equal(cpa([row({ date: "2026-01-01", spend: 5 })]).status, "insufficient_data", "zero purchases → insufficient");

// --- fatigue: high frequency + collapsing CTR → pastHalfLife=true -----------
const fatigued: MetricsRow[] = [
  row({ date: "2026-01-01", impressions: 1000, clicks: 60, frequency: 3 }), // ctr 0.06
  row({ date: "2026-01-02", impressions: 1000, clicks: 55, frequency: 3 }),
  row({ date: "2026-01-03", impressions: 1000, clicks: 50, frequency: 3 }),
  row({ date: "2026-01-04", impressions: 1000, clicks: 30, frequency: 3 }),
  row({ date: "2026-01-05", impressions: 1000, clicks: 8, frequency: 4 }),
  row({ date: "2026-01-06", impressions: 1000, clicks: 4, frequency: 4 }),
  row({ date: "2026-01-07", impressions: 1000, clicks: 2, frequency: 4 }), // ctr near 0
];
const fRes = fatigue(fatigued);
assert.equal(fRes.status, "ok");
assert.ok(fRes.status === "ok" && fRes.score >= 0.7, "fatigued fixture score must be >= 0.7");
assert.ok(fRes.status === "ok" && fRes.pastHalfLife === true, "fatigued fixture must be pastHalfLife");

// fatigue refuses on < 7 rows (no guessing)
assert.equal(fatigue(fatigued.slice(0, 6)).status, "insufficient_data", "fatigue needs >= 7 rows");

// a healthy, low-frequency, steady-CTR ad is not past half-life
const healthy: MetricsRow[] = Array.from({ length: 7 }, (_, i) =>
  row({ date: `2026-02-0${i + 1}`, impressions: 1000, clicks: 50, frequency: 1 }),
);
const hRes = fatigue(healthy);
assert.ok(hRes.status === "ok" && hRes.pastHalfLife === false, "healthy ad must not be pastHalfLife");

// --- waste: below-floor and fatigued buckets --------------------------------
// (a) below-floor: tiny total spend under the floor → whole spend wasted.
const tiny = [
  row({ date: "2026-03-01", spend: 40 }),
  row({ date: "2026-03-02", spend: 30 }),
];
const wA = wasteForAd(tiny, { spendFloorRs: 100 });
assert.equal(wA.status, "ok");
assert.ok(wA.status === "ok" && wA.reasons.includes("below_floor"), "must flag below_floor");
assert.equal(wA.status === "ok" && wA.wastedRs, 70, "below-floor waste = total spend 70");

// (b) fatigued: past half-life with plenty of spend above the floor → last 3 days wasted.
const fatiguedSpend = fatigued.map((r, i) =>
  row({ ...r, spend: 100 + i /* days 5,6,7 spend = 104+105+106 = 315 */ }),
);
const wB = wasteForAd(fatiguedSpend, { spendFloorRs: 100 });
assert.equal(wB.status, "ok");
assert.ok(wB.status === "ok" && wB.reasons.includes("fatigued"), "must flag fatigued");
assert.ok(wB.status === "ok" && !wB.reasons.includes("below_floor"), "high-spend ad is not below_floor");
assert.equal(wB.status === "ok" && wB.wastedRs, 315, "fatigued waste = last 3 days spend 315");

// empty rows → insufficient (never a rupee figure)
const wEmpty = wasteForAd(empty, { spendFloorRs: 100 });
assert.equal(wEmpty.status, "insufficient_data", "wasteForAd([]) must be insufficient_data");
assert.ok(!("wastedRs" in wEmpty), "wasteForAd([]) must NOT return a number");

console.log("PASS: rules engine checks");
