// Runnable check for lib/scoring.ts (real metrics -> brain inputs).
// node --experimental-strip-types scripts/check-scoring.ts
import assert from "node:assert/strict";
import { toCockpitInputs, trendScore, type RealAd } from "../lib/scoring.ts";
import { analyzeAccount } from "../lib/cockpit/analyze.ts";
import type { MetricsRow } from "../lib/ad-source.ts";

function row(date: string, spend: number, revenue: number, purchases: number, impressions: number, clicks: number, frequency: number): MetricsRow {
  return { adExternalId: "x", date, spend, impressions, clicks, purchases, revenue, frequency };
}

// A strong ad (high ROAS, low frequency) and a weak ad (loss-making, high frequency).
const ads: RealAd[] = [
  {
    externalId: "strong", name: "Strong", rows: [
      row("2026-08-01", 1000, 5000, 20, 10000, 200, 1.2),
      row("2026-08-02", 1000, 5200, 21, 10000, 210, 1.3),
      row("2026-08-03", 1000, 5100, 20, 10000, 205, 1.4),
    ],
  },
  {
    externalId: "weak", name: "Weak", rows: [
      row("2026-08-01", 1000, 600, 3, 20000, 150, 6.0),
      row("2026-08-02", 1000, 500, 2, 20000, 140, 6.5),
      row("2026-08-03", 1000, 400, 2, 20000, 130, 7.0),
    ],
  },
];

const inputs = toCockpitInputs(ads);
const strong = inputs.find((i) => i.id === "strong")!;
const weak = inputs.find((i) => i.id === "weak")!;

// Real aggregation.
assert.equal(strong.spendRs, 3000);
assert.equal(strong.revenueRs, 15300);
assert.equal(strong.conversions, 61, "purchases summed from real rows");
assert.equal(strong.days, 3);

// The strong ad outscores the weak one on performance (ROAS percentile within the account).
assert.ok(strong.performance > weak.performance, "higher-ROAS ad scores higher");
assert.equal(strong.performance, 100);
assert.equal(weak.performance, 0);

// Fatigue tracks frequency: the high-frequency weak ad is more fatigued.
assert.ok(weak.fatigue > strong.fatigue, "higher frequency -> more fatigue");

// The loss-making weak ad (ROAS < 1) is flagged as wasted spend; the strong ad is not.
assert.equal(weak.wastedRs, 3000, "spend on a below-1-ROAS ad is waste");
assert.equal(strong.wastedRs, 0);

// Scale headroom only for the above-median, non-fatigued ad.
assert.equal(strong.roomToScale, true);
assert.equal(weak.roomToScale, false);

// Declining ROAS -> trend below flat (50).
assert.ok(weak.trend < 50, "declining ROAS trends down");

// Waste is objective-aware: identical low-ROAS economics, differing only in objective.
const objectiveAds: RealAd[] = [
  {
    externalId: "aware-low-roas", name: "Aware", objective: "awareness", rows: [
      row("2026-08-01", 1000, 400, 2, 20000, 130, 1.0),
    ],
  },
  {
    externalId: "conv-low-roas", name: "Conv", objective: "conversion", rows: [
      row("2026-08-01", 1000, 400, 2, 20000, 130, 1.0),
    ],
  },
];
const objectiveInputs = toCockpitInputs(objectiveAds);
const aware = objectiveInputs.find((i) => i.id === "aware-low-roas")!;
const conv = objectiveInputs.find((i) => i.id === "conv-low-roas")!;
assert.equal(aware.wastedRs, 0, "a non-conversion ad is never counted as wasted spend");
assert.equal(conv.wastedRs, 1000, "a conversion ad with ROAS < 1 is still wasted spend");

// --- Objective-aware performance: engagement ads (no ROAS) are ranked by CTR, not zeroed. ---
const engagementAds: RealAd[] = [
  {
    externalId: "eng-hi", name: "Eng Hi", objective: "engagement", rows: [
      row("2026-08-01", 1000, 0, 0, 100000, 3000, 2.0), // 3% CTR
      row("2026-08-02", 1000, 0, 0, 100000, 3200, 2.1),
    ],
  },
  {
    externalId: "eng-lo", name: "Eng Lo", objective: "engagement", rows: [
      row("2026-08-01", 1000, 0, 0, 100000, 500, 2.0), // 0.5% CTR
      row("2026-08-02", 1000, 0, 0, 100000, 480, 2.1),
    ],
  },
];
const eng = toCockpitInputs(engagementAds);
const engHi = eng.find((i) => i.id === "eng-hi")!;
const engLo = eng.find((i) => i.id === "eng-lo")!;
assert.ok(engHi.performance > engLo.performance, "higher-CTR engagement ad ranks higher though neither has ROAS");
assert.ok((engHi.healthScore ?? 0) > (engLo.healthScore ?? 0), "higher CTR -> higher absolute health score");
assert.ok((engHi.healthScore ?? 0) > 60 && (engLo.healthScore ?? 100) < 40, "health is an absolute CTR benchmark, not a self-percentile");

// --- Account Health differs per account and is NOT pinned to 50 for engagement accounts. ---
const goodAcct = analyzeAccount(toCockpitInputs([engagementAds[0]]), "LIVE").accountHealth.score;
const poorAcct = analyzeAccount(toCockpitInputs([engagementAds[1]]), "LIVE").accountHealth.score;
assert.notEqual(goodAcct, 50, "engagement account health is no longer pinned to 50");
assert.ok(goodAcct > poorAcct, "a better-CTR account is healthier than a worse-CTR one");

// --- §145/§20 tiny/tiny trend guard: low-volume halves report flat (50), never a noise-pinned 0/100. ---
// Extreme ROAS swing but only 100 impressions/day (each half 200 < the 500 floor) -> guard returns neutral 50.
const tinyRows: MetricsRow[] = [
  row("2026-08-01", 50, 5, 1, 100, 2, 1.0),
  row("2026-08-02", 50, 5, 1, 100, 2, 1.0),
  row("2026-08-03", 50, 5000, 30, 100, 2, 1.0),
  row("2026-08-04", 50, 5200, 31, 100, 2, 1.0),
];
assert.equal(trendScore(tinyRows, "conversion"), 50, "low-volume halves -> neutral trend, not a noise-pinned swing");

// Same directional swing but well-sampled (5000 impressions/day) -> the direction is read honestly.
const wellUp: MetricsRow[] = [
  row("2026-08-01", 1000, 1000, 5, 5000, 100, 1.0),
  row("2026-08-02", 1000, 1100, 5, 5000, 100, 1.0),
  row("2026-08-03", 1000, 4000, 20, 5000, 100, 1.0),
  row("2026-08-04", 1000, 4200, 21, 5000, 100, 1.0),
];
assert.ok(trendScore(wellUp, "conversion") > 50, "well-sampled improving ROAS trends up");
const wellDown: MetricsRow[] = [
  row("2026-08-01", 1000, 4200, 21, 5000, 100, 1.0),
  row("2026-08-02", 1000, 4000, 20, 5000, 100, 1.0),
  row("2026-08-03", 1000, 1100, 5, 5000, 100, 1.0),
  row("2026-08-04", 1000, 1000, 5, 5000, 100, 1.0),
];
assert.ok(trendScore(wellDown, "conversion") < 50, "well-sampled declining ROAS trends down");

console.log("PASS: scoring (real metrics -> brain inputs) checks");
