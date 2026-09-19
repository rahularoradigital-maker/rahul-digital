// Runnable check for lib/tools/tools.ts — the free-calculator math. node:assert strict, prints one PASS line.
// Run: node --experimental-strip-types scripts/check-tools.ts
import assert from "node:assert/strict";
import { computeBreakEvenRoas, computeLtvCac, computeAdTriage, TOOLS, getTool } from "../lib/tools/tools.ts";

// Break-even ROAS = 1 / margin. 40% -> 2.5; 25% -> 4; 50% -> 2.
assert.equal(computeBreakEvenRoas(40).breakEvenRoas, 2.5, "40% margin -> 2.5 break-even ROAS");
assert.equal(computeBreakEvenRoas(25).breakEvenRoas, 4, "25% margin -> 4");
assert.equal(computeBreakEvenRoas(50).breakEvenRoas, 2, "50% margin -> 2");
assert.ok(Number.isNaN(computeBreakEvenRoas(0).breakEvenRoas), "0% margin -> NaN (guarded)");
assert.ok(Number.isNaN(computeBreakEvenRoas(100).breakEvenRoas), "100% margin -> NaN (guarded)");

// LTV:CAC. AOV 80, margin 40%, 3 orders, CAC 60 -> grossPerOrder 32, LTV 96, ratio 1.6, payback 1.9 orders.
const lc = computeLtvCac({ aov: 80, marginPct: 40, ordersPerCustomer: 3, cac: 60 });
assert.equal(lc.grossPerOrder, 32, "gross per order = 80 * 0.4");
assert.equal(lc.ltv, 96, "LTV = 32 * 3");
assert.equal(lc.ratio, 1.6, "ratio = 96 / 60");
assert.equal(lc.paybackOrders, 1.9, "payback = 60 / 32, 1dp");
assert.ok(Number.isNaN(computeLtvCac({ aov: 80, marginPct: 40, ordersPerCustomer: 3, cac: 0 }).ratio), "CAC 0 -> NaN ratio (guarded)");

// Triage: learning-phase guard wins over everything.
assert.equal(computeAdTriage({ roas: 5, targetRoas: 2, frequency: 2, freqBaseline: 2, inLearning: true }).verdict, "hold", "learning -> hold");
// Clear loss -> kill (ROAS 40% of target).
assert.equal(computeAdTriage({ roas: 0.8, targetRoas: 2, frequency: 2, freqBaseline: 2, inLearning: false }).verdict, "kill", "roas<0.6x target -> kill");
// Clean winner, stable frequency -> scale.
assert.equal(computeAdTriage({ roas: 2.6, targetRoas: 2, frequency: 2, freqBaseline: 2, inLearning: false }).verdict, "scale", "roas>=1.2x target, no fatigue -> scale");
// Winner-ish but frequency spiked -> refresh (fatigue caught before scaling).
assert.equal(computeAdTriage({ roas: 2.6, targetRoas: 2, frequency: 3, freqBaseline: 2, inLearning: false }).verdict, "refresh", "fatigue (1.5x) -> refresh");
// Middle band, no fatigue -> hold.
assert.equal(computeAdTriage({ roas: 2.0, targetRoas: 2, frequency: 2, freqBaseline: 2, inLearning: false }).verdict, "hold", "on-target, stable -> hold");

// Registry integrity: unique slugs, every tool has fields, getTool round-trips.
const slugs = TOOLS.map((t) => t.slug);
assert.equal(new Set(slugs).size, slugs.length, "tool slugs are unique");
for (const t of TOOLS) {
  assert.ok(t.fields.length > 0, `${t.slug} has input fields`);
  assert.equal(getTool(t.slug)?.slug, t.slug, `getTool round-trips ${t.slug}`);
}

console.log(`PASS check-tools: ${TOOLS.length} tools, break-even/LTV-CAC/triage math verified`);
