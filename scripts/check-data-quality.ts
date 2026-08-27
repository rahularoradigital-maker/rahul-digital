// One runnable check for the data-quality engine. No frameworks, no fixtures.
// Run: node --experimental-strip-types scripts/check-data-quality.ts
import assert from "node:assert/strict";
import { assessDataQuality, type QualityRow } from "../lib/scoring/data-quality.ts";

function row(over: Partial<QualityRow>): QualityRow {
  return { date: "2026-01-01", spend: 100, impressions: 1000, clicks: 50, purchases: 2, revenue: 300, ...over };
}

// A clean, well-delivered series has no issues to flag.
function series(days: number, over: (i: number) => Partial<QualityRow> = () => ({})): QualityRow[] {
  return Array.from({ length: days }, (_, i) => row({ date: `2026-01-${String(i + 1).padStart(2, "0")}`, ...over(i) }));
}

// 1. Clean 14-day series -> reliable, zero penalty, no flags.
const clean = assessDataQuality(series(14));
assert.equal(clean.flags.length, 0);
assert.equal(clean.confidencePenalty, 0);
assert.equal(clean.reliable, true);
assert.equal(clean.days, 14);

// 2. A 2-day series -> critical small_sample, not reliable.
const twoDay = assessDataQuality(series(2));
const ss = twoDay.flags.find((f) => f.code === "small_sample");
assert.ok(ss, "expected small_sample flag");
assert.equal(ss.severity, "critical");
assert.equal(twoDay.reliable, false);

// 3. Spend jumping 100 -> 500 mid-series -> spend_shock.
const shock = assessDataQuality(series(14, (i) => (i === 5 ? { spend: 500 } : { spend: 100 })));
assert.ok(shock.flags.some((f) => f.code === "spend_shock"), "expected spend_shock flag");

// 4. Spend out, zero revenue -> zero_revenue_with_spend.
const noRev = assessDataQuality(series(14, () => ({ revenue: 0, purchases: 0 })));
assert.ok(noRev.flags.some((f) => f.code === "zero_revenue_with_spend"), "expected zero_revenue_with_spend flag");

// 5. A mid-series 3-day zero-impression gap -> delivery_gap.
const gapped = assessDataQuality(
  series(9, (i) => (i >= 3 && i <= 5 ? { impressions: 0, spend: 0, clicks: 0, purchases: 0, revenue: 0 } : {})),
);
const gap = gapped.flags.find((f) => f.code === "delivery_gap");
assert.ok(gap, "expected delivery_gap flag");

// Penalty is the clamped sum of per-flag penalties, never above 1.
assert.ok(twoDay.confidencePenalty > 0 && twoDay.confidencePenalty <= 1);
assert.ok(shock.confidencePenalty <= 1);

// Empty input degrades safely (critical small sample, no NaN).
const empty = assessDataQuality([]);
assert.equal(empty.reliable, false);
assert.ok(!Number.isNaN(empty.confidencePenalty));

console.log("PASS: data quality checks");
