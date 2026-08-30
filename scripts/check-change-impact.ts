// Runnable check for the change-impact engine (lib/scoring/change-impact.ts). No I/O.
// node --experimental-strip-types scripts/check-change-impact.ts
import assert from "node:assert/strict";
import { measureChangeImpact, type ImpactRow } from "../lib/scoring/change-impact.ts";

// Build N days of identical rows starting at a date.
function days(n: number, row: Omit<ImpactRow, "date">, startDay = 1): ImpactRow[] {
  return Array.from({ length: n }, (_, i) => ({ date: `2026-08-${String(startDay + i).padStart(2, "0")}`, ...row }));
}

// Conversion objective: ROAS doubles after the change (both windows have >=15 conversions) -> improved.
const impr = measureChangeImpact({
  objective: "conversion",
  beforeRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 200 }), // ROAS 2.0, 21 conv
  afterRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 400 }, 10), // ROAS 4.0
});
assert.equal(impr.verdict, "improved", `expected improved, got ${JSON.stringify(impr)}`);
assert.equal(impr.metric, "ROAS");
assert.ok(impr.deltaPct !== null && impr.deltaPct >= 90, "roughly +100%");

// ROAS halves -> worsened.
const worse = measureChangeImpact({
  objective: "conversion",
  beforeRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 400 }),
  afterRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 200 }, 10),
});
assert.equal(worse.verdict, "worsened", `expected worsened, got ${JSON.stringify(worse)}`);
assert.ok((worse.deltaPct ?? 0) < 0, "negative delta");

// Small move -> flat.
const flat = measureChangeImpact({
  objective: "conversion",
  beforeRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 200 }),
  afterRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 208 }, 10), // +4%
});
assert.equal(flat.verdict, "flat", `expected flat, got ${JSON.stringify(flat)}`);

// Too few conversions -> insufficient (never a fake verdict).
const insuf = measureChangeImpact({
  objective: "conversion",
  beforeRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 1, revenue: 200 }), // 7 conv < 15
  afterRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 400 }, 10),
});
assert.equal(insuf.verdict, "insufficient", `expected insufficient, got ${JSON.stringify(insuf)}`);

// Traffic objective: CPC drops (spend halves, clicks constant) -> improved (lower CPC is better).
const cpc = measureChangeImpact({
  objective: "traffic",
  beforeRows: days(7, { spend: 400, impressions: 5000, clicks: 200, conversions: 0, revenue: 0 }), // CPC 2.0
  afterRows: days(7, { spend: 200, impressions: 5000, clicks: 200, conversions: 0, revenue: 0 }, 10), // CPC 1.0
});
assert.equal(cpc.verdict, "improved", `CPC drop should be improved, got ${JSON.stringify(cpc)}`);
assert.equal(cpc.metric, "CPC");

// Settled-tail trim: a 9-day after-window is judged on 7 settled days (last 2 trimmed).
const settled = measureChangeImpact({
  objective: "conversion",
  beforeRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 200 }),
  afterRows: days(9, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 400 }, 10),
});
assert.ok(settled.reason.includes("7d settled after"), `after-window should be trimmed to 7 settled days, got: ${settled.reason}`);

console.log("PASS: change-impact engine (improved/worsened/flat/insufficient, objective metric, settled-tail trim)");
