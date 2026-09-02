// Runnable check for the 7d-vs-30d recent-trend comparison (lib/scoring/recent-vs-baseline.ts). No I/O.
// node --experimental-strip-types scripts/check-recent-vs-baseline.ts
import assert from "node:assert/strict";
import { recentVsBaseline, type MetricDay } from "../lib/scoring/recent-vs-baseline.ts";

// Build a day-wise series: `older` days then `recent` days (recent are the most recent dates).
function series(olderDays: number, older: Omit<MetricDay, "date">, recentDays: number, recent: Omit<MetricDay, "date">): MetricDay[] {
  const out: MetricDay[] = [];
  let d = 1;
  for (let i = 0; i < olderDays; i++) out.push({ date: `2026-08-${String(d++).padStart(2, "0")}`, ...older });
  for (let i = 0; i < recentDays; i++) out.push({ date: `2026-08-${String(d++).padStart(2, "0")}`, ...recent });
  return out;
}

// Conversion / ROAS: recent week runs ABOVE the monthly average -> improving.
const up = recentVsBaseline(
  series(23, { spend: 100, impressions: 2000, clicks: 60, purchases: 3, revenue: 100 }, 7, { spend: 100, impressions: 2000, clicks: 60, purchases: 3, revenue: 300 }),
  "conversion",
);
assert.equal(up.metric, "ROAS");
assert.equal(up.direction, "improving", `recent ROAS above baseline -> improving, got ${JSON.stringify(up)}`);
assert.ok((up.deltaPct ?? 0) > 0 && (up.recent ?? 0) > (up.baseline ?? 0), "recent > baseline");
assert.equal(up.recentDays, 7);
assert.equal(up.baselineDays, 30);

// Recent week BELOW the monthly average -> worsening.
const down = recentVsBaseline(
  series(23, { spend: 100, impressions: 2000, clicks: 60, purchases: 3, revenue: 300 }, 7, { spend: 100, impressions: 2000, clicks: 60, purchases: 3, revenue: 100 }),
  "conversion",
);
assert.equal(down.direction, "worsening", `recent below baseline -> worsening, got ${JSON.stringify(down)}`);
assert.ok((down.deltaPct ?? 0) < 0);

// Flat series -> steady (recent ~ baseline, since recent is part of the 30d).
const flat = recentVsBaseline(series(23, { spend: 100, impressions: 2000, clicks: 60, purchases: 3, revenue: 200 }, 7, { spend: 100, impressions: 2000, clicks: 60, purchases: 3, revenue: 200 }), "conversion");
assert.equal(flat.direction, "steady", `flat -> steady, got ${JSON.stringify(flat)}`);

// Traffic / CPC: lower is better. Recent CPC drops (spend halves) -> improving.
const cpc = recentVsBaseline(
  series(23, { spend: 400, impressions: 5000, clicks: 200, purchases: 0, revenue: 0 }, 7, { spend: 200, impressions: 5000, clicks: 200, purchases: 0, revenue: 0 }),
  "traffic",
);
assert.equal(cpc.metric, "CPC");
assert.equal(cpc.direction, "improving", `CPC drop -> improving, got ${JSON.stringify(cpc)}`);

// No data / metric can't form -> insufficient, never a fake verdict.
assert.equal(recentVsBaseline([], "conversion").direction, "insufficient");
const zeroSpend = recentVsBaseline(series(0, { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 }, 7, { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 }), "conversion");
assert.equal(zeroSpend.direction, "insufficient", "zero spend -> can't form ROAS -> insufficient");

console.log("PASS: recent-vs-baseline (7d vs 30d, per-objective metric, improving/worsening/steady/insufficient)");
