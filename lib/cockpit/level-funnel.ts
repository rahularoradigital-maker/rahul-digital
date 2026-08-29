// Per-level funnel rollups: the same 8 funnel ratios, grouped by ad set and by campaign, so the
// funnel card can switch between Ad / Ad set / Campaign views. Creative/funnel numbers are rolled UP
// across each group's own rows before the ratios are computed (rolling up before scoring is the
// correct grain - scoring the same creative separately per ad set is a known way to read fatigue
// wrong). Pure, no I/O. Ratios are null on a zero denominator (never a fabricated 0), via windowFunnel.

import { windowFunnel, type ExtendedMetricsRow, type FunnelMetrics } from "../metrics/funnel-metrics.ts";

// One rolled-up group (an ad set or a campaign). id/name identify it; spendRs orders the list.
export type GroupFunnel = { id: string; name: string; spendRs: number; funnel: FunnelMetrics };

// One ad's contribution to the rollups: its grouping ids/names + its day-wise funnel rows.
export type LevelInputAd = {
  adSetId?: string;
  adsetName?: string;
  campaignId?: string;
  campaignName?: string;
  rows: ExtendedMetricsRow[];
};

export type LevelFunnels = { adset: GroupFunnel[]; campaign: GroupFunnel[] };

function groupBy(ads: LevelInputAd[], idOf: (a: LevelInputAd) => string | undefined, nameOf: (a: LevelInputAd) => string | undefined, limit: number): GroupFunnel[] {
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
    .map(([id, g]) => ({ id, name: g.name, spendRs: Math.round(g.spend), funnel: windowFunnel(g.rows) }))
    .sort((x, y) => y.spendRs - x.spendRs)
    .slice(0, limit);
}

// Top `limit` ad sets and campaigns by spend, each with its own rolled-up funnel.
export function levelFunnels(ads: LevelInputAd[], limit = 8): LevelFunnels {
  return {
    adset: groupBy(ads, (a) => a.adSetId, (a) => a.adsetName, limit),
    campaign: groupBy(ads, (a) => a.campaignId, (a) => a.campaignName, limit),
  };
}
