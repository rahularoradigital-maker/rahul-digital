// One runnable check for the day-wise trend series. No frameworks.
// Run: node --experimental-strip-types scripts/check-daily-series.ts
import assert from "node:assert/strict";
import { buildDailySeries, DAILY_KPIS, windowHeadline, type DailyInputRow } from "../lib/cockpit/daily-series.ts";
import { windowFunnel } from "../lib/metrics/funnel-metrics.ts";

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

// windowHeadline: the headline must be the WHOLE-WINDOW aggregate, never the last day. This is the
// bug the KPI cards showed: the last day of a window under-reports conversions (Meta attributes
// purchases days after the click), so ROAS/Revenue/Purchases read a false 0 on the last day while CPA
// (null that day) fell back to an earlier day - spend + CPA present, ROAS 0.00, 0 purchases, all at once.
const winRows: DailyInputRow[] = [
  row({ date: "2026-08-01", spend: 100, revenue: 500, purchases: 2, impressions: 1000, clicks: 10 }),
  // Last day: real spend/clicks but conversions not yet attributed (the attribution-lag day).
  row({ date: "2026-08-02", spend: 100, revenue: 0, purchases: 0, impressions: 1000, clicks: 10 }),
];
const totals = {
  spendRs: 200, revenueRs: 500, roas: 500 / 200,
  impressions: 2000, clicks: 20, purchases: 2,
  cpm: (200 / 2000) * 1000, ctrAll: (20 / 2000) * 100, cpcAll: 200 / 20, cpa: 200 / 2,
};
const head = windowHeadline(totals, windowFunnel(winRows));
assert.equal(head.roas, 2.5, "headline ROAS = window revenue/spend (NOT the last day's 0.00)");
assert.equal(head.purchases, 2, "headline purchases = window total (NOT the last day's 0)");
assert.equal(head.revenue, 500, "headline revenue = window total");
assert.equal(head.cpa, 100, "headline CPA = window spend/purchases, consistent with ROAS");
assert.equal(head.spend, 200, "headline spend = window total (NOT one day)");
// Self-consistency: a non-null ROAS forbids 0 purchases (the exact contradiction that shipped).
assert.ok(!(head.roas !== null && head.roas > 0 && head.purchases === 0), "ROAS>0 and 0 purchases can never co-occur");
// Every KPI key is present on the headline too.
for (const k of DAILY_KPIS) assert.ok(k.key in head, `windowHeadline has ${k.key}`);

console.log("PASS: day-wise trend series + window headline (whole-window aggregate, no attribution-lag contradiction)");
