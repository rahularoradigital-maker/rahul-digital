// Runnable check for the ad-level funnel ratio engine (lib/metrics/funnel-metrics.ts).
// node --experimental-strip-types scripts/check-funnel-metrics.ts
import assert from "node:assert/strict";
import { windowFunnel, dailyFunnel } from "../lib/metrics/funnel-metrics.ts";
import type { ExtendedMetricsRow } from "../lib/metrics/funnel-metrics.ts";

// A normal, fully-populated day. Numbers chosen so each ratio is exact.
const normal: ExtendedMetricsRow = {
  date: "2026-08-01",
  spend: 100,
  impressions: 10000,
  clicks: 200,           // ctr 2%
  outboundClicks: 150,   // lpViewRate = 120/150 = 80%
  video3sViews: 3000,    // thumbStopRate 30%
  videoThruplays: 900,   // holdRate = 900/3000 = 30%
  landingPageViews: 120, // atcRate = 30/120 = 25%
  addToCarts: 30,        // checkoutRate = 20/30 = 66.66..%
  initiateCheckouts: 20, // purchaseRate = 5/20 = 25%
  purchases: 5,
};

const m = windowFunnel([normal]);
assert.equal(m.ctr, 2, "ctr = clicks/impressions %");
assert.equal(m.cpm, 10, "cpm = spend/impressions*1000");
assert.equal(m.cpc, 0.5, "cpc = spend/clicks");
assert.equal(m.thumbStopRate, 30, "thumbStopRate = 3sViews/impressions %");
assert.equal(m.holdRate, 30, "holdRate = thruplays/3sViews %");
assert.equal(m.lpViewRate, 80, "lpViewRate = lpViews/outboundClicks %");
assert.equal(m.atcRate, 25, "atcRate = atc/lpViews %");
assert.ok(Math.abs(m.checkoutRate! - 66.6666) < 0.001, "checkoutRate = checkouts/atc %");
assert.equal(m.purchaseRate, 25, "purchaseRate = purchases/checkouts %");

// Zero-denominator cases must return null - never NaN or Infinity.
const zeros: ExtendedMetricsRow = {
  date: "2026-08-02",
  spend: 50,
  impressions: 0,
  clicks: 0,
  outboundClicks: 0,
  video3sViews: 0,
  videoThruplays: 0,
  landingPageViews: 0,
  addToCarts: 0,
  initiateCheckouts: 0,
  purchases: 0,
};
const z = windowFunnel([zeros]);
for (const [k, v] of Object.entries(z)) {
  assert.equal(v, null, `${k} is null when its denominator is 0`);
  assert.ok(!Number.isNaN(v as unknown as number), `${k} is not NaN`);
  assert.notEqual(v, Infinity, `${k} is not Infinity`);
}

// windowFunnel sums the day rows before dividing (not an average of ratios).
// Day A: 100 clicks / 10000 impr. Day B: 300 clicks / 10000 impr.
// Summed: 400 / 20000 = 2% (a naive mean of 1% and 3% would also give 2% here,
// so make volumes unequal to prove summing, not averaging).
const dayA: ExtendedMetricsRow = { ...normal, date: "2026-08-03", impressions: 10000, clicks: 100, spend: 100 };
const dayB: ExtendedMetricsRow = { ...normal, date: "2026-08-04", impressions: 90000, clicks: 900, spend: 900 };
const summed = windowFunnel([dayA, dayB]);
// clicks 1000 / impressions 100000 = 1%. Averaging the two 1% days is also 1%,
// so also assert cpm which depends on summed spend and impressions.
assert.equal(summed.ctr, 1, "window ctr from summed totals");
assert.equal(summed.cpm, 10, "window cpm = 1000 spend / 100000 impr * 1000");

// Prove summing over averaging with mismatched-rate, mismatched-volume days.
const lowVol: ExtendedMetricsRow = { ...zeros, date: "2026-08-05", impressions: 100, clicks: 50 };   // 50% ctr, tiny
const highVol: ExtendedMetricsRow = { ...zeros, date: "2026-08-06", impressions: 9900, clicks: 99 }; // 1% ctr, big
const weighted = windowFunnel([lowVol, highVol]);
// Summed: 149 clicks / 10000 impr = 1.49%. A per-day average would be (50+1)/2 = 25.5%.
assert.ok(Math.abs(weighted.ctr! - 1.49) < 1e-9, `summed ctr weights by volume, got ${weighted.ctr}`);

// dailyFunnel returns one entry per day, in order, with that day's own ratios.
const daily = dailyFunnel([dayA, dayB, zeros]);
assert.equal(daily.length, 3, "one entry per day row");
assert.deepEqual(daily.map((d) => d.date), ["2026-08-03", "2026-08-04", "2026-08-02"], "dates preserved in order");
assert.equal(daily[0].metrics.ctr, 1, "day A own ctr = 100/10000");
assert.equal(daily[1].metrics.ctr, 1, "day B own ctr = 900/90000");
assert.equal(daily[2].metrics.ctr, null, "zero-impression day has null ctr");

// Empty input: window aggregate has no denominators, so every ratio is null.
const empty = windowFunnel([]);
assert.ok(Object.values(empty).every((v) => v === null), "empty window yields all-null metrics");
assert.deepEqual(dailyFunnel([]), [], "empty window has no daily entries");

console.log("PASS: funnel metrics checks");
