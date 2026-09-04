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
import { metricFor, type MetricAgg } from "./objective-metric.ts";
import { VOLUME_FLOORS } from "./decision.ts";

// Sufficiency floors come from decision.ts (VOLUME_FLOORS) - the ONE source of truth. They used to be
// re-declared here by value (Phase-0 audit: silent-divergence bug). The objective->metric switch likewise now
// lives in objective-metric.ts, shared with recent-vs-baseline.ts.
const DEFAULT_MIN_DELTA_PCT = 10; // a move smaller than this (in the better direction) reads as "flat"

export type Objective = "conversion" | "traffic" | "engagement" | "awareness" | "leads" | "app_installs";
export type ImpactRow = { date: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number };
export type Grain = "ad" | "adset" | "campaign";
export type ChangeImpact = {
  verdict: "improved" | "worsened" | "flat" | "insufficient";
  metric: string; // the objective's headline metric that was judged
  before: number | null;
  after: number | null;
  deltaPct: number | null; // signed % in the BETTER direction (positive = improvement)
  reason: string;
  grain?: Grain; // the level the verdict was actually measured at (ad = most precise; a coarser grain means
  // the ad's own window was too thin, so we read the parent - honest, but attribution is looser)
  windowDays?: number; // the after/before window length used (the shortest that cleared the volume floor)
};

type Agg = MetricAgg & { days: number };

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
    if (a.conversions < VOLUME_FLOORS.conversions) return { ok: false, reason: `only ${a.conversions} result(s) (need >=${VOLUME_FLOORS.conversions})` };
    return { ok: true, reason: "" };
  }
  if (objective === "awareness") {
    if (a.impressions < VOLUME_FLOORS.impressionsAwareness) return { ok: false, reason: `only ${a.impressions} impressions (need >=${VOLUME_FLOORS.impressionsAwareness})` };
    return { ok: true, reason: "" };
  }
  if (a.clicks < VOLUME_FLOORS.clicks || a.impressions < VOLUME_FLOORS.impressionsRate) return { ok: false, reason: `only ${a.clicks} clicks / ${a.impressions} impressions (need >=${VOLUME_FLOORS.clicks}/${VOLUME_FLOORS.impressionsRate})` };
  return { ok: true, reason: "" };
}

// metricFor (objective -> ROAS/CPC/CTR/CPM + orientation) is imported from objective-metric.ts - shared.

const round = (n: number) => Math.round(n * 10) / 10;

const DAY_MS = 86_400_000;

/**
 * Isolate a change's before/after windows so neither crosses an ADJACENT change on the SAME object - otherwise
 * a change's "after" would include a later change's effect (or its "before" a prior change's), confounding the
 * verdict. Given the change day and the day-timestamps of the object's OTHER changes, clip:
 *   before = [beforeStart, changeDay)   after = (changeDay, afterEnd]
 * to start the day AFTER the previous change and end the day BEFORE the next one. When a neighbour is so close
 * the window collapses (afterEnd <= changeDay), the caller gets an empty window -> the engine returns
 * "insufficient" rather than a confounded verdict. Day granularity: two changes on the SAME day on the same
 * object can't be separated and are left to collapse to insufficient.
 */
export function isolatedWindow(changeDayMs: number, otherChangeDaysMs: number[], beforeDays: number, afterDays: number): { beforeStart: number; afterEnd: number } {
  let prev = -Infinity;
  let next = Infinity;
  for (const d of otherChangeDaysMs) {
    if (d < changeDayMs) prev = Math.max(prev, d);
    else if (d > changeDayMs) next = Math.min(next, d);
  }
  const beforeStart = Math.max(changeDayMs - beforeDays * DAY_MS, prev + DAY_MS); // day after the prior change
  const afterEnd = Math.min(changeDayMs + afterDays * DAY_MS, next - DAY_MS); // day before the next change
  return { beforeStart, afterEnd };
}

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

const asMs = (d: string) => new Date(`${d}T00:00:00Z`).getTime();

// One rung of the coverage cascade: the object's day-wise rows at a given grain, plus that object's OTHER
// change days (at the SAME grain) so the window can be isolated from adjacent structural changes.
export type CascadeLevel = { grain: Grain; objective: Objective; rows: ImpactRow[]; changeDayMs: number; otherChangeDaysMs: number[] };

// COVERAGE (Media-Buyer Change Intelligence): a single ad's own conversions in a ~7-day window almost never
// clear the volume floor on a large account, so ad-level-only judging leaves ~97% of changes "insufficient"
// (measured live: 3 of ~4,500). Cascade instead - measure at the FINEST grain and SHORTEST window that clears
// the floor, cascading ad -> ad-set -> campaign and short -> long window. This maximizes honest coverage
// (parents aggregate enough volume) while never fabricating a verdict: it still returns "insufficient" when
// even the coarsest/longest window is too thin, and it labels the grain + window used so a coarser (looser)
// attribution is always visible, not hidden. Rigor unchanged - only WHICH window feeds measureChangeImpact.
// `levels` MUST be ordered finest -> coarsest; `windows` shortest -> longest.
export function measureWithCascade(levels: CascadeLevel[], windows: number[]): ChangeImpact {
  let firstInsufficient: ChangeImpact | null = null;
  for (const lvl of levels) {
    if (lvl.rows.length === 0) continue;
    for (const w of windows) {
      const { beforeStart, afterEnd } = isolatedWindow(lvl.changeDayMs, lvl.otherChangeDaysMs, w, w);
      const beforeRows = lvl.rows.filter((r) => { const t = asMs(r.date); return t < lvl.changeDayMs && t >= beforeStart; });
      const afterRows = lvl.rows.filter((r) => { const t = asMs(r.date); return t > lvl.changeDayMs && t <= afterEnd; });
      const impact = measureChangeImpact({ objective: lvl.objective, beforeRows, afterRows });
      if (impact.verdict !== "insufficient") return { ...impact, grain: lvl.grain, windowDays: w };
      if (!firstInsufficient) firstInsufficient = { ...impact, grain: lvl.grain, windowDays: w };
    }
  }
  return firstInsufficient ?? { verdict: "insufficient", metric: metricFor(levels[0]?.objective ?? "engagement").name, before: null, after: null, deltaPct: null, reason: "no measurable window at any level", grain: levels[0]?.grain, windowDays: windows[0] };
}
