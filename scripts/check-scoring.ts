// Runnable check for lib/scoring.ts (real metrics -> brain inputs).
// node --experimental-strip-types scripts/check-scoring.ts
import assert from "node:assert/strict";
import { toCockpitInputs, type RealAd } from "../lib/scoring.ts";
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

console.log("PASS: scoring (real metrics -> brain inputs) checks");
