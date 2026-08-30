// Change-impact engine (Media-Buyer Change Intelligence, Phase 3). PURE: given a change's before/after
// day-wise rows for the affected object, measure whether the change IMPROVED, WORSENED, was FLAT, or there
// is INSUFFICIENT signal - on the objective's OWN headline metric, comparing the object to its own prior
// baseline. Rigor, not naive causality:
//   1. Trim the still-settling attribution tail from the after-window (settledRows) so a conversion ad
//      doesn't read a false decline just because the last days haven't finished attributing.
//   2. Gate on volume sufficiency in BOTH windows (same thresholds as the decision engine) - too little
//      data returns "insufficient", never a fabricated verdict.
//   3. Compare the objective's own metric (ROAS / CPC / CTR / CPM), oriented so positive = better.
// This is correlation with controls, not proof of cause; the buyer-vs-algo learning-phase overlay
// (lib/rules/change-log.ts) refines it upstream. Numbers are never guessed.

import { settledRows } from "./attribution.ts";

// Sufficiency thresholds mirror lib/scoring/decision.ts (volumeSufficiency is module-private there; kept in
// sync here by value). If those change, update both.
const MIN_CONVERSIONS = 15;
const MIN_CLICKS = 100;
const MIN_IMPRESSIONS_RATE = 1000;
const MIN_IMPRESSIONS_AWARENESS = 10000;
const DEFAULT_MIN_DELTA_PCT = 10; // a move smaller than this (in the better direction) reads as "flat"

export type Objective = "conversion" | "traffic" | "engagement" | "awareness" | "leads" | "app_installs";
export type ImpactRow = { date: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number };
export type ChangeImpact = {
  verdict: "improved" | "worsened" | "flat" | "insufficient";
  metric: string; // the objective's headline metric that was judged
  before: number | null;
  after: number | null;
  deltaPct: number | null; // signed % in the BETTER direction (positive = improvement)
  reason: string;
};

type Agg = { spend: number; impressions: number; clicks: number; conversions: number; revenue: number; days: number };

function aggregate(rows: ImpactRow[]): Agg {
  const a: Agg = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, days: rows.length };
  for (const r of rows) {
    a.spend += r.spend || 0;
    a.impressions += r.impressions || 0;
    a.clicks += r.clicks || 0;
    a.conversions += r.conversions || 0;
    a.revenue += r.revenue || 0;
  }
  return a;
}

// Enough volume to trust a verdict on this objective's own metric? Mirrors decision.ts volumeSufficiency.
function sufficient(a: Agg, objective: Objective): { ok: boolean; reason: string } {
  if (objective === "conversion" || objective === "leads" || objective === "app_installs") {
    if (a.conversions < MIN_CONVERSIONS) return { ok: false, reason: `only ${a.conversions} result(s) (need >=${MIN_CONVERSIONS})` };
    return { ok: true, reason: "" };
  }
  if (objective === "awareness") {
    if (a.impressions < MIN_IMPRESSIONS_AWARENESS) return { ok: false, reason: `only ${a.impressions} impressions (need >=${MIN_IMPRESSIONS_AWARENESS})` };
    return { ok: true, reason: "" };
  }
  if (a.clicks < MIN_CLICKS || a.impressions < MIN_IMPRESSIONS_RATE) return { ok: false, reason: `only ${a.clicks} clicks / ${a.impressions} impressions (need >=${MIN_CLICKS}/${MIN_IMPRESSIONS_RATE})` };
  return { ok: true, reason: "" };
}

// The objective's headline metric + its orientation + how to compute it from an aggregate (null if the
// denominator is zero, i.e. the metric can't be formed).
function metricFor(objective: Objective): { name: string; higherIsBetter: boolean; compute: (a: Agg) => number | null } {
  switch (objective) {
    case "conversion":
      return { name: "ROAS", higherIsBetter: true, compute: (a) => (a.spend > 0 ? a.revenue / a.spend : null) };
    case "leads":
    case "app_installs":
      return { name: "cost per result", higherIsBetter: false, compute: (a) => (a.conversions > 0 ? a.spend / a.conversions : null) };
    case "awareness":
      return { name: "CPM", higherIsBetter: false, compute: (a) => (a.impressions > 0 ? (a.spend / a.impressions) * 1000 : null) };
    case "traffic":
      return { name: "CPC", higherIsBetter: false, compute: (a) => (a.clicks > 0 ? a.spend / a.clicks : null) };
    case "engagement":
    default:
      return { name: "CTR", higherIsBetter: true, compute: (a) => (a.impressions > 0 ? a.clicks / a.impressions : null) };
  }
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Measure a single change's impact. `beforeRows` = the object's day-wise metrics in the window BEFORE the
 * change; `afterRows` = the window AFTER (raw; the settling tail is trimmed here). `objective` decides the
 * metric. Returns a verdict oriented so positive deltaPct = the change made things better.
 */
export function measureChangeImpact(opts: { objective: Objective; beforeRows: ImpactRow[]; afterRows: ImpactRow[]; minDeltaPct?: number }): ChangeImpact {
  const m = metricFor(opts.objective);
  const after = settledRows(opts.afterRows); // drop the still-settling tail before judging the after-window
  const before = opts.beforeRows;
  if (before.length === 0 || after.length === 0) return { verdict: "insufficient", metric: m.name, before: null, after: null, deltaPct: null, reason: "not enough days before/after the change" };

  const aB = aggregate(before);
  const aA = aggregate(after);
  const sB = sufficient(aB, opts.objective);
  const sA = sufficient(aA, opts.objective);
  if (!sB.ok || !sA.ok) return { verdict: "insufficient", metric: m.name, before: null, after: null, deltaPct: null, reason: !sA.ok ? `after: ${sA.reason}` : `before: ${sB.reason}` };

  const vB = m.compute(aB);
  const vA = m.compute(aA);
  if (vB == null || vA == null || vB === 0) return { verdict: "insufficient", metric: m.name, before: vB, after: vA, deltaPct: null, reason: `${m.name} could not be formed in one window` };

  const rawPct = ((vA - vB) / Math.abs(vB)) * 100;
  const improvePct = m.higherIsBetter ? rawPct : -rawPct; // orient so positive = better
  const minDelta = opts.minDeltaPct ?? DEFAULT_MIN_DELTA_PCT;
  const verdict = improvePct >= minDelta ? "improved" : improvePct <= -minDelta ? "worsened" : "flat";
  const dir = verdict === "improved" ? "better" : verdict === "worsened" ? "worse" : "about the same";
  return {
    verdict,
    metric: m.name,
    before: round(vB),
    after: round(vA),
    deltaPct: round(improvePct),
    reason: `${m.name} ${dir}: ${round(vB)} -> ${round(vA)} (${improvePct >= 0 ? "+" : ""}${round(improvePct)}% in the better direction) over ${before.length}d before vs ${after.length}d settled after`,
  };
}
