// Runnable check for lib/confidence.ts + lib/data-quality.ts. No env needed.
//   node --experimental-strip-types scripts/check-quality.ts
import { strict as assert } from "node:assert";
import { computeConfidence, describeConfidence } from "../lib/confidence.ts";
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
