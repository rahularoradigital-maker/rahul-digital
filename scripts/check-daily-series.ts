// One runnable check for the day-wise trend series. No frameworks.
// Run: node --experimental-strip-types scripts/check-daily-series.ts
import assert from "node:assert/strict";
import { buildDailySeries, DAILY_KPIS, type DailyInputRow } from "../lib/cockpit/daily-series.ts";

function row(over: Partial<DailyInputRow> = {}): DailyInputRow {
  return {
    date: "2026-08-01", spend: 0, impressions: 0, clicks: 0, outboundClicks: 0, video3sViews: 0,
    videoThruplays: 0, landingPageViews: 0, addToCarts: 0, initiateCheckouts: 0, purchases: 0, revenue: 0,
    ...over,
  };
}

// Empty in, empty out.
assert.deepEqual(buildDailySeries([]), [], "no rows -> no points");

// ROAS + CPA are computed; sorted ascending by date even when input is unsorted.
const s = buildDailySeries([
  row({ date: "2026-08-02", spend: 200, revenue: 800, purchases: 4, impressions: 1000, clicks: 50 }),
  row({ date: "2026-08-01", spend: 100, revenue: 500, purchases: 2, impressions: 1000, clicks: 10 }),
]);
assert.equal(s.length, 2);
assert.equal(s[0].date, "2026-08-01", "sorted ascending");
assert.equal(s[0].roas, 5, "roas = revenue/spend");
assert.equal(s[0].cpa, 50, "cpa = spend/purchases");
assert.equal(s[1].roas, 4, "day 2 roas");
assert.equal(s[1].cpa, 50, "day 2 cpa");
// CTR is a % from the funnel engine (clicks/impressions * 100).
assert.equal(s[0].ctr, 1, "ctr day1 = 10/1000 *100");
assert.equal(s[1].ctr, 5, "ctr day2 = 50/1000 *100");

// Null (never NaN / never a fake 0) on a zero denominator - the chart draws a gap, not a false point.
const z = buildDailySeries([row({ date: "2026-08-03", spend: 0, revenue: 0, purchases: 0, impressions: 0, clicks: 0 })]);
assert.equal(z[0].roas, null, "spend 0 -> roas null");
assert.equal(z[0].cpa, null, "purchases 0 -> cpa null");
assert.equal(z[0].ctr, null, "impressions 0 -> ctr null");

// Every advertised KPI key exists on a produced point (the selector never points at a missing field).
for (const k of DAILY_KPIS) assert.ok(k.key in s[0], `DailyPoint has ${k.key}`);

console.log("PASS: day-wise trend series (roas/cpa/ctr, sorting, null-on-zero, KPI keys)");
