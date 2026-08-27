// Runnable check for the marginal-scaling engine (lib/scoring/marginal.ts).
// node --experimental-strip-types scripts/check-marginal.ts
import assert from "node:assert/strict";
import { marginalScaling, type DayPoint } from "../lib/scoring/marginal.ts";

// Build `n` days where revenue = k * spend^e, spend swept over a range so ln(spend) varies.
function powerSeries(n: number, k: number, e: number, spend0: number, spend1: number): DayPoint[] {
  const out: DayPoint[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const spend = spend0 + (spend1 - spend0) * t;
    out.push({ spend, revenue: k * spend ** e });
  }
  return out;
}

// 1) Constant returns: revenue = 2 * spend (e = 1). Elasticity ~1 -> HEALTHY or UNDERFUNDED,
//    marginal ROAS ~= current ROAS, not diminishing.
{
  const r = marginalScaling(powerSeries(8, 2, 1.0, 500, 2000));
  assert.equal(r.label, "MODELLED");
  assert.ok(r.spendElasticity !== null && Math.abs(r.spendElasticity - 1) < 0.05, `elasticity ~1, got ${r.spendElasticity}`);
  assert.ok(["HEALTHY", "UNDERFUNDED"].includes(r.classification), `constant returns -> HEALTHY/UNDERFUNDED, got ${r.classification}`);
  assert.equal(r.diminishingReturns, false);
  assert.ok(r.currentRoas !== null && Math.abs(r.currentRoas - 2) < 1e-6, `currentRoas ~2, got ${r.currentRoas}`);
  assert.ok(r.marginalRoas !== null && Math.abs(r.marginalRoas - r.currentRoas!) < 0.1, "marginal ~ current at e=1");
  assert.ok(r.confidence > 0.5, `good fit + days -> decent confidence, got ${r.confidence}`);
}

// 2) Clearly diminishing: revenue = 30 * spend^0.4 (e = 0.4). SATURATED, diminishing true,
//    marginal ROAS strictly below current ROAS.
{
  const r = marginalScaling(powerSeries(10, 30, 0.4, 300, 3000));
  assert.ok(r.spendElasticity !== null && r.spendElasticity < 0.5, `strong diminishing elasticity, got ${r.spendElasticity}`);
  assert.ok(["SATURATED", "APPROACHING_SATURATION"].includes(r.classification), `got ${r.classification}`);
  assert.equal(r.diminishingReturns, true);
  assert.ok(r.marginalRoas !== null && r.currentRoas !== null && r.marginalRoas < r.currentRoas, "marginal < current when diminishing");
}

// 2b) Mild diminishing: e = 0.65 -> APPROACHING_SATURATION, diminishing true.
{
  const r = marginalScaling(powerSeries(12, 10, 0.65, 400, 4000));
  assert.equal(r.classification, "APPROACHING_SATURATION", `e=0.65 -> APPROACHING, got ${r.classification}`);
  assert.equal(r.diminishingReturns, true);
}

// 2c) Increasing returns: e = 1.2 -> UNDERFUNDED (headroom), not diminishing.
{
  const r = marginalScaling(powerSeries(9, 0.5, 1.2, 500, 2500));
  assert.equal(r.classification, "UNDERFUNDED", `e=1.2 -> UNDERFUNDED, got ${r.classification}`);
  assert.equal(r.diminishingReturns, false);
  assert.ok(r.marginalRoas !== null && r.currentRoas !== null && r.marginalRoas > r.currentRoas, "marginal > current when increasing");
}

// 3) Too few days (< 5) -> UNKNOWN, low confidence, nulls.
{
  const r = marginalScaling(powerSeries(4, 2, 1.0, 500, 2000));
  assert.equal(r.classification, "UNKNOWN");
  assert.equal(r.spendElasticity, null);
  assert.equal(r.marginalRoas, null);
  assert.equal(r.diminishingReturns, false);
  assert.ok(r.confidence < 0.5, `few days -> low confidence, got ${r.confidence}`);
  assert.ok(r.why.length > 0);
}

// 4) No divide-by-zero / NaN. Empty input, zero/negative spend, flat spend all handled.
{
  const empty = marginalScaling([]);
  assert.equal(empty.classification, "UNKNOWN");
  assert.ok(Number.isFinite(empty.confidence));

  // Rows with non-positive spend/revenue are filtered out (ln undefined), leaving too few.
  const dirty: DayPoint[] = [
    { spend: 0, revenue: 100 },
    { spend: -5, revenue: 100 },
    { spend: 100, revenue: 0 },
    { spend: 100, revenue: -10 },
    { spend: 200, revenue: 400 },
    { spend: 300, revenue: 600 },
  ];
  const rd = marginalScaling(dirty);
  assert.equal(rd.classification, "UNKNOWN", "only 2 clean days survive filtering");

  // Flat spend (no variance in ln spend) -> UNKNOWN, no NaN slope.
  const flat: DayPoint[] = Array.from({ length: 6 }, (_, i) => ({ spend: 1000, revenue: 2000 + i }));
  const rf = marginalScaling(flat);
  assert.equal(rf.classification, "UNKNOWN");
  assert.equal(rf.spendElasticity, null);
  assert.ok(Number.isFinite(rf.confidence));

  // Every numeric field on a real read is finite (no NaN leaking through).
  const ok = marginalScaling(powerSeries(7, 5, 0.7, 400, 2800));
  for (const v of [ok.spendElasticity, ok.currentRoas, ok.marginalRoas, ok.confidence]) {
    assert.ok(v !== null && Number.isFinite(v), "no NaN in numeric outputs");
  }
}

console.log("PASS: marginal scaling checks");
