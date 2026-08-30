// Per-level funnel rollups: the same 8 funnel ratios, grouped by ad set and by campaign, so the
// funnel card can switch between Ad / Ad set / Campaign views. Creative/funnel numbers are rolled UP
// across each group's own rows before the ratios are computed (rolling up before scoring is the
// correct grain - scoring the same creative separately per ad set is a known way to read fatigue
// wrong). Pure, no I/O. Ratios are null on a zero denominator (never a fabricated 0), via windowFunnel.

import { windowFunnel, type ExtendedMetricsRow, type FunnelMetrics } from "../metrics/funnel-metrics.ts";

// LEVEL-NATIVE metrics: the ones that CANNOT be rolled up from ad rows and must be pulled from Meta at
// level=adset/campaign - reach de-dups people across the group's ads, and budget is a config field on the
// ad set (or campaign under CBO). Frequency = impressions / reach at the level. null when not pulled (the UI
// shows "n/a", never a fabricated number).
export type LevelNative = { reach: number | null; frequency: number | null; budgetRs: number | null; budgetType: "daily" | "lifetime" | null };
export type NativeByLevel = { adset: Map<string, LevelNative>; campaign: Map<string, LevelNative> };

// One rolled-up group (an ad set or a campaign). id/name identify it; spendRs orders the list.
// `daily` is the day-wise spend series (the "strike graph" of delivery), and `delivering` is recent-spend
// liveness so the UI can flag a group that has stopped (paused/ended) without pointing to it as actionable.
// `native` carries the level-only metrics (reach/frequency/budget) when a Meta level pull supplied them.
export type GroupFunnel = { id: string; name: string; spendRs: number; funnel: FunnelMetrics; daily: { date: string; spend: number }[]; delivering: boolean; native?: LevelNative };

const RECENT_DELIVERY_DAYS = 7; // matches lib/scoring: no spend within this many days of the window end -> stopped

// Sum a group's rows into one spend-per-day series (sorted), and decide liveness from its recent tail.
function dailySpend(rows: ExtendedMetricsRow[], asOf: string | null): { daily: { date: string; spend: number }[]; delivering: boolean } {
  const byDate = new Map<string, number>();
  for (const r of rows) byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.spend);
  const daily = [...byDate.entries()].map(([date, spend]) => ({ date, spend })).sort((a, b) => a.date.localeCompare(b.date));
  let lastSpendDate: string | null = null;
  for (const d of daily) if (d.spend > 0 && (lastSpendDate === null || d.date > lastSpendDate)) lastSpendDate = d.date;
  const delivering = Boolean(asOf && lastSpendDate && Math.round((Date.parse(asOf) - Date.parse(lastSpendDate)) / 86_400_000) <= RECENT_DELIVERY_DAYS);
  return { daily, delivering };
}

// One ad's contribution to the rollups: its grouping ids/names + its day-wise funnel rows.
export type LevelInputAd = {
  adSetId?: string;
  adsetName?: string;
  campaignId?: string;
  campaignName?: string;
  rows: ExtendedMetricsRow[];
};

export type LevelFunnels = { adset: GroupFunnel[]; campaign: GroupFunnel[] };

function groupBy(ads: LevelInputAd[], idOf: (a: LevelInputAd) => string | undefined, nameOf: (a: LevelInputAd) => string | undefined, limit: number, asOf: string | null, native?: Map<string, LevelNative>): GroupFunnel[] {
  const groups = new Map<string, { name: string; rows: ExtendedMetricsRow[]; spend: number }>();
  for (const a of ads) {
    const id = idOf(a);
    if (!id) continue; // an ad with no ad-set/campaign id cannot be grouped at that level - skip it, never guess
    const g = groups.get(id) ?? { name: nameOf(a) ?? id, rows: [], spend: 0 };
    for (const r of a.rows) {
      g.rows.push(r);
      g.spend += r.spend;
    }
    groups.set(id, g);
  }
  return [...groups.entries()]
    .map(([id, g]) => ({ id, name: g.name, spendRs: Math.round(g.spend), funnel: windowFunnel(g.rows), ...dailySpend(g.rows, asOf), native: native?.get(id) }))
    .sort((x, y) => y.spendRs - x.spendRs)
    .slice(0, limit);
}

// Top `limit` ad sets and campaigns by spend, each with its own rolled-up funnel + delivery strike graph.
// `native` (optional) supplies the level-only metrics (reach/frequency/budget) merged by entity id.
export function levelFunnels(ads: LevelInputAd[], limit = 8, native?: NativeByLevel): LevelFunnels {
  // asOf = the window's most recent data day, so liveness reads correctly for historical windows too.
  const allDates = ads.flatMap((a) => a.rows.map((r) => r.date)).sort();
  const asOf = allDates.length ? allDates[allDates.length - 1] : null;
  return {
    adset: groupBy(ads, (a) => a.adSetId, (a) => a.adsetName, limit, asOf, native?.adset),
    campaign: groupBy(ads, (a) => a.campaignId, (a) => a.campaignName, limit, asOf, native?.campaign),
  };
}
