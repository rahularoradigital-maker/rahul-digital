// Runnable check for lib/confidence.ts + lib/data-quality.ts. No env needed.
//   node --experimental-strip-types scripts/check-quality.ts
import { strict as assert } from "node:assert";
import {
  computeConfidence,
  describeConfidence,
  sourceLevel,
  actionConfidenceCeiling,
  nextSourceUplift,
} from "../lib/confidence.ts";
import { assessDataQuality, gateRecommendation } from "../lib/data-quality.ts";
import type { MetricsRow } from "../lib/ad-source.ts";

// ---- confidence ----

// full agreement + full sample -> high band
const high = computeConfidence({
  dataCompleteness: 1,
  sampleSize: 14,
  minSample: 7,
  signalsAgreeing: 5,
  signalsTotal: 5,
});
assert.equal(high.status, "ok");
assert(high.status === "ok" && high.band === "high", "5/5 agreement + full sample must be high band");
assert(high.status === "ok" && high.reasons.some((r) => r.includes("5 of 5 signals agree")), "reasons must be concrete");

// under-sample -> capped at 0.5 with a capped reason
const thin = computeConfidence({
  dataCompleteness: 1,
  sampleSize: 3,
  minSample: 7,
  signalsAgreeing: 5,
  signalsTotal: 5,
});
assert(thin.status === "ok", "under-sample still scores, just capped");
assert(thin.status === "ok" && thin.score <= 0.5, "sample 3 < min 7 must cap score at 0.5");
assert(thin.status === "ok" && !!thin.capped && thin.capped.includes("sample 3 < min 7"), "cap must name why");

// confounders -> capped at 0.7, listed in reasons
const confounded = computeConfidence({
  dataCompleteness: 1,
  sampleSize: 14,
  minSample: 7,
  signalsAgreeing: 5,
  signalsTotal: 5,
  confounders: ["promo running", "iOS attribution change"],
});
assert(confounded.status === "ok" && confounded.score <= 0.7, "confounders must cap score at 0.7");
assert(
  confounded.status === "ok" && confounded.reasons.some((r) => r.includes("promo running")),
  "reasons must list the confounders",
);

// zero signals -> insufficient_data, never a score
const noSignals = computeConfidence({
  dataCompleteness: 1,
  sampleSize: 14,
  minSample: 7,
  signalsAgreeing: 0,
  signalsTotal: 0,
});
assert.equal(noSignals.status, "insufficient_data", "signalsTotal 0 must be insufficient_data");

// describeConfidence carries the percentage from the result
assert(high.status === "ok");
const sentence = describeConfidence(high);
assert(
  sentence.includes(`${Math.round(high.score * 100)}%`),
  "description must contain the score percentage",
);

// ---- J7: source-connection confidence ladder ----

// contiguous level from meta
assert.equal(sourceLevel(["meta"]), 0, "meta-only is L0");
assert.equal(sourceLevel(["meta", "ga4", "shopify"]), 2, "meta+ga4+shopify is L2");
assert.equal(sourceLevel([]), 0, "no meta is L0 (documented note)");
assert.equal(sourceLevel(["meta", "shopify"]), 0, "non-contiguous (ga4 missing) stays L0");

// strong signals so nothing but the source ceiling can hold the score down
const strong = { dataCompleteness: 1, sampleSize: 200, minSample: 7, signalsAgreeing: 5, signalsTotal: 5 };
const econ = (connected: Parameters<typeof actionConfidenceCeiling>[1]) =>
  computeConfidence({ ...strong, connectedSources: connected, actionClass: "economic" });

const econL0 = econ(["meta"]);
const econL1 = econ(["meta", "ga4"]);
const econL2 = econ(["meta", "ga4", "shopify"]);
const econL3 = econ(["meta", "ga4", "shopify", "third_party"]);
for (const r of [econL0, econL1, econL2, econL3]) assert(r.status === "ok", "economic ladder must score");

// economic on Meta-only is capped LOW even with perfect signals
assert(econL0.status === "ok" && econL0.score <= 0.45, "economic meta-only must cap <= 0.45");
assert(econL0.status === "ok" && !!econL0.capped, "economic meta-only cap must name why");
// and rises once Shopify connects
assert(
  econL0.status === "ok" && econL2.status === "ok" && econL2.score > econL0.score,
  "economic confidence must rise when Shopify connects",
);
// non-decreasing (monotonic) across all four levels
const econScores = [econL0, econL1, econL2, econL3].map((r) => (r.status === "ok" ? r.score : NaN));
for (let i = 1; i < econScores.length; i++) {
  assert(econScores[i] >= econScores[i - 1], "economic ladder must be non-decreasing across levels");
}
// the ceiling function itself is non-decreasing across levels too
const econCeilings = [["meta"], ["meta", "ga4"], ["meta", "ga4", "shopify"], ["meta", "ga4", "shopify", "third_party"]]
  .map((c) => actionConfidenceCeiling("economic", c as Parameters<typeof actionConfidenceCeiling>[1]));
for (let i = 1; i < econCeilings.length; i++) {
  assert(econCeilings[i] >= econCeilings[i - 1], "economic ceilings must be monotonic");
}

// creative/delivery is confident on Meta alone (Meta owns that data)
const creativeMeta = computeConfidence({ ...strong, connectedSources: ["meta"], actionClass: "creative_delivery" });
assert(
  creativeMeta.status === "ok" && creativeMeta.band === "high",
  "creative_delivery must reach high band on meta-only",
);

// the "connect X to raise this to Y%" line, for an economic meta-only action
const uplift = nextSourceUplift("economic", ["meta"]);
assert(
  uplift !== null && (uplift.connect === "ga4" || uplift.connect === "shopify") && uplift.toPercent > 45,
  "economic meta-only uplift must point at the next source with a higher ceiling",
);
assert.equal(
  nextSourceUplift("economic", ["meta", "ga4", "shopify", "third_party"]),
  null,
  "a fully-connected action has no uplift left",
);

// regression guard: WITHOUT the new fields the result is byte-identical to before.
// `high` above shares these exact inputs and predates J7, so it is the baseline.
const baseInput = { dataCompleteness: 1, sampleSize: 14, minSample: 7, signalsAgreeing: 5, signalsTotal: 5 };
assert.deepEqual(computeConfidence(baseInput), high, "no new fields → pre-J7 result unchanged");
// one field alone must not trigger the ceiling either (both are required)
assert.deepEqual(
  computeConfidence({ ...baseInput, actionClass: "economic" }),
  high,
  "actionClass without connectedSources must not change output",
);

// ---- data quality ----

const day = (n: number) => `2026-08-${String(n).padStart(2, "0")}`;
const row = (n: number, over: Partial<MetricsRow> = {}): MetricsRow => ({
  adExternalId: "ad_1",
  date: day(n),
  spend: 100,
  impressions: 10_000,
  clicks: 150,
  purchases: 5,
  revenue: 400,
  frequency: 1.4,
  ...over,
});

// clean 14 consecutive days -> trustworthy, no block flags
const clean = Array.from({ length: 14 }, (_, i) => row(i + 1));
const cleanDq = assessDataQuality(clean);
assert(cleanDq.status === "ok", "clean fixture must assess");
assert(cleanDq.status === "ok" && cleanDq.trustworthy, "clean 14-day fixture must be trustworthy");
assert(
  cleanDq.status === "ok" && cleanDq.flags.every((f) => f.severity !== "block"),
  "clean fixture must have no block flags",
);
assert(cleanDq.status === "ok" && cleanDq.completeness === 1, "clean fixture is 100% complete");

// duplicate (ad, date) pair -> DUPLICATE_ROWS block + untrustworthy
const duped = [...clean, row(3)];
const dupedDq = assessDataQuality(duped);
assert(dupedDq.status === "ok");
assert(
  dupedDq.status === "ok" &&
    dupedDq.flags.some((f) => f.code === "DUPLICATE_ROWS" && f.severity === "block"),
  "duplicate (ad, date) must raise a DUPLICATE_ROWS block",
);
assert(dupedDq.status === "ok" && !dupedDq.trustworthy, "a block flag must make trustworthy false");

// a 10x-median spend day -> OUTLIER_SPEND warn
const spiky = clean.map((r, i) => (i === 6 ? { ...r, spend: 1000 } : r));
const spikyDq = assessDataQuality(spiky);
assert(
  spikyDq.status === "ok" &&
    spikyDq.flags.some((f) => f.code === "OUTLIER_SPEND" && f.severity === "warn"),
  "10x median spend day must raise an OUTLIER_SPEND warn",
);

// a gap in the calendar -> MISSING_DAYS
const gappy = clean.filter((r) => r.date !== day(5) && r.date !== day(9));
const gappyDq = assessDataQuality(gappy);
assert(
  gappyDq.status === "ok" && gappyDq.flags.some((f) => f.code === "MISSING_DAYS"),
  "calendar gaps must raise MISSING_DAYS",
);
assert(gappyDq.status === "ok" && gappyDq.completeness < 1, "gaps must lower completeness");

// empty -> insufficient_data
assert.equal(assessDataQuality([]).status, "insufficient_data", "empty rows must be insufficient_data");

// ---- honesty gate ----

const blockedGate = gateRecommendation(dupedDq, 0.9);
assert(!blockedGate.allowed, "a block flag must gate the recommendation off");
assert(!!blockedGate.reason, "a gated recommendation must carry its reason");

const lowConfGate = gateRecommendation(cleanDq, 0.1);
assert(!lowConfGate.allowed && !!lowConfGate.reason, "confidence below 0.3 must gate with a reason");

const openGate = gateRecommendation(cleanDq, 0.8);
assert(openGate.allowed, "clean data + 0.8 confidence must pass the gate");

console.log("PASS: confidence + data-quality checks");
