// Day-wise account trend series for the cockpit chart. Takes the account's per-day rows (summed
// across ads) and produces one point per day for every KPI we can derive from Meta's day-wise data.
// Reuses dailyFunnel() for the funnel ratios (no duplicated ratio math); adds spend/ROAS/CPA/revenue
// on top. Pure, no I/O. Ratios are null on a zero denominator (never NaN), so the chart skips gaps.

import { dailyFunnel, type ExtendedMetricsRow } from "../metrics/funnel-metrics.ts";

// One account-day of totals. Same shape the funnel engine reads, plus revenue (for ROAS/CPA).
export type DailyInputRow = ExtendedMetricsRow & { revenue: number };

export type DailyPoint = {
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  roas: number | null; // revenue / spend
  cpa: number | null; // spend / purchases
  ctr: number | null; // %
  cpm: number | null; // rupees
  cpc: number | null; // rupees
  thumbStop: number | null; // %
  holdRate: number | null; // %
  lpViewRate: number | null; // %
  atcRate: number | null; // %
  checkoutRate: number | null; // %
};

// The selectable KPIs, in a sensible default order. `fmt` drives display: x = 4.21x, inr = rupees,
// inr2 = rupees with 2 decimals (CPA/CPC), pct = 00.00%, int = whole number.
export type DailyKpiKey = Exclude<keyof DailyPoint, "date">;
export const DAILY_KPIS: { key: DailyKpiKey; label: string; fmt: "x" | "inr" | "inr2" | "pct" | "int" }[] = [
  { key: "roas", label: "ROAS", fmt: "x" },
  { key: "spend", label: "Spend", fmt: "inr" },
  { key: "revenue", label: "Revenue", fmt: "inr" },
  { key: "purchases", label: "Purchases", fmt: "int" },
  { key: "cpa", label: "CPA", fmt: "inr2" },
  { key: "cpc", label: "CPC", fmt: "inr2" },
  { key: "cpm", label: "CPM", fmt: "inr" },
  { key: "ctr", label: "CTR", fmt: "pct" },
  { key: "impressions", label: "Impressions", fmt: "int" },
  { key: "clicks", label: "Clicks", fmt: "int" },
  { key: "thumbStop", label: "Thumb-stop", fmt: "pct" },
  { key: "holdRate", label: "Hold rate", fmt: "pct" },
  { key: "lpViewRate", label: "LP view rate", fmt: "pct" },
  { key: "atcRate", label: "Add-to-cart", fmt: "pct" },
  { key: "checkoutRate", label: "Checkout", fmt: "pct" },
];

export function buildDailySeries(rows: DailyInputRow[]): DailyPoint[] {
  const funnelByDate = new Map(dailyFunnel(rows).map((f) => [f.date, f.metrics]));
  return rows
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      const f = funnelByDate.get(r.date);
      return {
        date: r.date,
        spend: r.spend,
        impressions: r.impressions,
        clicks: r.clicks,
        purchases: r.purchases,
        revenue: r.revenue,
        roas: r.spend > 0 ? r.revenue / r.spend : null,
        cpa: r.purchases > 0 ? r.spend / r.purchases : null,
        ctr: f?.ctr ?? null,
        cpm: f?.cpm ?? null,
        cpc: f?.cpc ?? null,
        thumbStop: f?.thumbStopRate ?? null,
        holdRate: f?.holdRate ?? null,
        lpViewRate: f?.lpViewRate ?? null,
        atcRate: f?.atcRate ?? null,
        checkoutRate: f?.checkoutRate ?? null,
      };
    });
}
