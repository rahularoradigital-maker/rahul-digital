// 7-day recent trend vs 30-day baseline, per ad, on the objective's OWN metric - the "how is the recent
// week doing vs the last month" read a media buyer cross-checks against Ads Manager's 30-day view.
//
// PURE + ADDITIVE. It deliberately does NOT feed the 90-day fatigue/scoring engine (that stays the trend
// authority so a short window can't turn a long read noisy). This is a separate, explicit comparison
// surfaced on each ad. The baseline is the LAST 30 days INCLUDING the recent 7 (exactly the number Ads
// Manager shows for "last 30 days"), so `direction` says whether the recent week is running above or below
// the monthly average. Positive deltaPct = the recent week is BETTER. Never fabricates: too little to
// compare -> direction "insufficient", numbers null.

import { metricFor, type MetricAgg } from "./objective-metric.ts";

export type RvbObjective = "conversion" | "traffic" | "engagement" | "awareness" | "leads" | "app_installs";
export type MetricDay = { date: string; spend: number; impressions: number; clicks: number; purchases: number; revenue: number };
export type RecentVsBaseline = {
  metric: string;
  recent: number | null;
  baseline: number | null;
  deltaPct: number | null; // signed %, positive = recent BETTER than the baseline (oriented per metric)
  direction: "improving" | "worsening" | "steady" | "insufficient";
  recentDays: number;
  baselineDays: number;
};

// Aggregate shape + objective->metric switch are SHARED with change-impact.ts via objective-metric.ts. This
// file used to carry a verbatim copy (Phase-0 audit) - MetricDay.purchases maps onto MetricAgg.conversions.
type Agg = MetricAgg;
function aggregate(rows: MetricDay[]): Agg {
  const a: Agg = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
  for (const r of rows) {
    a.spend += r.spend || 0;
    a.impressions += r.impressions || 0;
    a.clicks += r.clicks || 0;
    a.conversions += r.purchases || 0;
    a.revenue += r.revenue || 0;
  }
  return a;
}

const round = (n: number) => Math.round(n * 100) / 100;
const DEFAULT_MIN_DELTA_PCT = 10; // smaller than this (in the better direction) reads as "steady"

export function recentVsBaseline(
  rows: MetricDay[],
  objective: RvbObjective,
  opts: { recentDays?: number; baselineDays?: number; minDeltaPct?: number } = {},
): RecentVsBaseline {
  const recentDays = opts.recentDays ?? 7;
  const baselineDays = opts.baselineDays ?? 30;
  const m = metricFor(objective);
  const base = { metric: m.name, recentDays, baselineDays };
  if (!rows.length) return { ...base, recent: null, baseline: null, deltaPct: null, direction: "insufficient" };

  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-recentDays);
  const baseline = sorted.slice(-baselineDays); // last 30d incl. the recent 7 = the Ads Manager 30-day number
  const vR = m.compute(aggregate(recent));
  const vB = m.compute(aggregate(baseline));
  if (vR == null || vB == null || vB === 0) return { ...base, recent: vR, baseline: vB, deltaPct: null, direction: "insufficient" };

  const rawPct = ((vR - vB) / Math.abs(vB)) * 100;
  const better = m.higherIsBetter ? rawPct : -rawPct; // orient so positive = recent is better
  const minDelta = opts.minDeltaPct ?? DEFAULT_MIN_DELTA_PCT;
  const direction = better >= minDelta ? "improving" : better <= -minDelta ? "worsening" : "steady";
  return { ...base, recent: round(vR), baseline: round(vB), deltaPct: round(better), direction };
}
