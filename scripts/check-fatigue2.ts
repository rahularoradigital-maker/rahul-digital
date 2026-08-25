// Runnable check for fatigueV2 + willBreak (lib/rules/fatigue.ts, will-break.ts). No env needed.
//   node --experimental-strip-types scripts/check-fatigue2.ts
import { strict as assert } from "node:assert";
import type { MetricsRow } from "../lib/ad-source.ts";
import { fatigue, fatigueV2 } from "../lib/rules/fatigue.ts";
import { willBreak } from "../lib/rules/will-break.ts";

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

const day = (i: number) => `2026-04-${String(i + 1).padStart(2, "0")}`;

// (a) clearly fatigued: 14 days of rising frequency, collapsing CTR, worsening
// CPA/ROAS (purchases 5 -> 3 -> 1 on flat spend).
const fatiguedAd: MetricsRow[] = Array.from({ length: 14 }, (_, i) =>
  row({
    date: day(i),
    spend: 100,
    impressions: 1000,
    clicks: 60 - 4 * i, // CTR 6% -> 0.8%
    frequency: 1.5 + 0.25 * i, // 1.5 -> 4.75
    purchases: i < 3 ? 5 : i >= 11 ? 1 : 3, // CPA 20 -> 100
    revenue: (i < 3 ? 5 : i >= 11 ? 1 : 3) * 100, // ROAS 5 -> 1
  }),
);

// (b) healthy: 10 flat days, low frequency, steady CTR and outcomes.
const healthyAd: MetricsRow[] = Array.from({ length: 10 }, (_, i) =>
  row({
    date: day(i),
    spend: 100,
    impressions: 1000,
    clicks: 50,
    frequency: 1.2,
    purchases: 4,
    revenue: 400,
  }),
);

// --- (a) fatigued ad → fatigued-family state, index > 0.5, drivers named ------
const fRes = fatigueV2(fatiguedAd);
assert.equal(fRes.status, "ok", "fatigued ad must be diagnosable");
assert.ok(fRes.status === "ok" && fRes.index > 0.5, "fatigued index must exceed 0.5");
assert.ok(
  fRes.status === "ok" && ["fatiguing", "fatigued", "severe_fatigue"].includes(fRes.state),
  `state must be in the fatigued family, got ${fRes.status === "ok" ? fRes.state : fRes.status}`,
);
assert.ok(fRes.status === "ok" && fRes.drivers.length > 0, "fatigued verdict must name its drivers");
assert.ok(fRes.status === "ok" && fRes.confidence > 0 && fRes.confidence <= 1, "confidence in (0,1]");
// signals carry only real data: no zero-filled placeholders for video signals
assert.ok(
  fRes.status === "ok" && !fRes.signals.some((s) => s.id.startsWith("S6") || s.id.startsWith("S7")),
  "hook/hold signals must be excluded (no video data), never zero-filled",
);
// contributions of available signals must sum to the index (renormalised weights)
if (fRes.status === "ok") {
  const sum = fRes.signals.reduce((a, s) => a + s.contribution, 0);
  assert.ok(Math.abs(sum - fRes.index) < 1e-9, "signal contributions must sum to the index");
}

// --- (b) healthy ad → healthy/early_warning, low index ------------------------
const hRes = fatigueV2(healthyAd);
assert.equal(hRes.status, "ok");
assert.ok(hRes.status === "ok" && ["healthy", "early_warning"].includes(hRes.state), "healthy ad must not read fatigued");
assert.ok(hRes.status === "ok" && hRes.index < 0.2, "healthy index must be low");

// --- (c) 5 rows → insufficient_data with NO numeric fields --------------------
const thin = fatiguedAd.slice(0, 5);
const tRes = fatigueV2(thin);
assert.equal(tRes.status, "insufficient_data", "5 rows must refuse");
assert.ok(!("index" in tRes), "insufficient_data must carry no index");
assert.ok(!("confidence" in tRes), "insufficient_data must carry no confidence");
assert.ok(!("signals" in tRes), "insufficient_data must carry no signals");
const wThin = willBreak(thin, 7);
assert.equal(wThin.status, "insufficient_data", "willBreak on 5 rows must refuse");
assert.ok(!("probability" in wThin), "insufficient_data forecast must carry no probability");

// --- (d) willBreak: fatigued ad riskier than healthy ad at 7d ------------------
const wFat7 = willBreak(fatiguedAd, 7);
const wHealthy7 = willBreak(healthyAd, 7);
assert.equal(wFat7.status, "ok");
assert.equal(wHealthy7.status, "ok");
assert.ok(
  wFat7.status === "ok" && wHealthy7.status === "ok" && wFat7.probability > wHealthy7.probability,
  "fatigued ad must carry a higher 7d break probability than a healthy ad",
);
assert.ok(wFat7.status === "ok" && wFat7.factLabel === "MODEL_ESTIMATE", "a forecast is never a fact");
assert.ok(wHealthy7.status === "ok" && wHealthy7.factLabel === "MODEL_ESTIMATE", "a forecast is never a fact");
assert.ok(wFat7.status === "ok" && wFat7.drivers.length > 0, "forecast must name drivers");
assert.ok(wFat7.status === "ok" && wFat7.recommendedAction.length > 0, "forecast must carry an action");

// --- (e) 14d horizon carries LOWER confidence than 7d on identical data --------
const wFat14 = willBreak(fatiguedAd, 14);
assert.equal(wFat14.status, "ok");
assert.ok(
  wFat7.status === "ok" && wFat14.status === "ok" && wFat14.confidence < wFat7.confidence,
  "14d forecast must be less confident than 7d on the same rows",
);

// --- (f) BACKWARD COMPAT: old fatigue() unchanged on the check-rules fixtures --
const oldFatigued: MetricsRow[] = [
  row({ date: "2026-01-01", impressions: 1000, clicks: 60, frequency: 3 }),
  row({ date: "2026-01-02", impressions: 1000, clicks: 55, frequency: 3 }),
  row({ date: "2026-01-03", impressions: 1000, clicks: 50, frequency: 3 }),
  row({ date: "2026-01-04", impressions: 1000, clicks: 30, frequency: 3 }),
  row({ date: "2026-01-05", impressions: 1000, clicks: 8, frequency: 4 }),
  row({ date: "2026-01-06", impressions: 1000, clicks: 4, frequency: 4 }),
  row({ date: "2026-01-07", impressions: 1000, clicks: 2, frequency: 4 }),
];
const oldRes = fatigue(oldFatigued);
assert.equal(oldRes.status, "ok", "old fatigue() must still work");
assert.ok(oldRes.status === "ok" && typeof oldRes.score === "number", "old shape: score is a number");
assert.ok(oldRes.status === "ok" && oldRes.pastHalfLife === true, "old fatigued fixture must stay pastHalfLife=true");
const oldHealthy: MetricsRow[] = Array.from({ length: 7 }, (_, i) =>
  row({ date: `2026-02-0${i + 1}`, impressions: 1000, clicks: 50, frequency: 1 }),
);
const oldH = fatigue(oldHealthy);
assert.ok(oldH.status === "ok" && oldH.pastHalfLife === false, "old healthy fixture must stay pastHalfLife=false");
assert.equal(fatigue(oldFatigued.slice(0, 6)).status, "insufficient_data", "old fatigue() still refuses < 7 rows");

console.log("PASS: fatigue v2 + forecast checks");
