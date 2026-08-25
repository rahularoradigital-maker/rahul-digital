// Held-out rules backtest (validation spec V1). Pure logic over metrics rows so it is testable
// offline (scripts/check-backtest.ts). A DB-reading seam feeds it real ad_metrics later.
import type { MetricsRow } from "../lib/ad-source.ts";
import { fatigue } from "../lib/rules/fatigue.ts";

export type AdHistory = { adExternalId: string; rows: MetricsRow[] };

export type Pair = { predicted: boolean; actual: boolean };

export type BacktestResult = {
  totalAds: number;
  scored: number;
  skipped: number;
  willBreak: {
    predicted: number;
    hits: number;
    falsePositives: number;
    falseNegatives: number;
    accuracy: number | null; // precision of "will break" calls; null when none predicted
  };
};

const MIN_HISTORY = 7; // fatigue() needs >= 7 rows; fewer -> skip (never scored as correct)

// Pure scorer: precision/recall accounting over predicted-vs-actual pairs. Tested directly.
export function score(pairs: Pair[]): BacktestResult["willBreak"] {
  let predicted = 0,
    hits = 0,
    fp = 0,
    fn = 0;
  for (const p of pairs) {
    if (p.predicted) {
      predicted++;
      p.actual ? hits++ : fp++;
    } else if (p.actual) {
      fn++;
    }
  }
  return {
    predicted,
    hits,
    falsePositives: fp,
    falseNegatives: fn,
    accuracy: predicted > 0 ? hits / predicted : null,
  };
}

function roasOf(rows: MetricsRow[]): number {
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  const rev = rows.reduce((s, r) => s + r.revenue, 0);
  return spend > 0 ? rev / spend : 0;
}

// Ground truth for "the ad broke": ROAS in the held-out window fell >= 20% below the last 3 days
// before the split. ponytail: simple, documented proxy; refine once we have real outcome labels.
export function didBreak(before: MetricsRow[], after: MetricsRow[]): boolean {
  const beforeRoas = roasOf(before.slice(-3));
  if (beforeRoas === 0) return false;
  return roasOf(after) <= beforeRoas * 0.8;
}

// Run the backtest: predict "will break" from rows <= splitDate (fatigue.pastHalfLife), verify
// against actuals in (splitDate, splitDate+horizon]. Ads with < MIN_HISTORY before, or no after
// rows, are SKIPPED (never counted as a correct prediction).
export function backtest(ads: AdHistory[], splitDate: string, horizonDays = 7): BacktestResult {
  let scored = 0,
    skipped = 0;
  const pairs: Pair[] = [];
  for (const ad of ads) {
    const before = ad.rows
      .filter((r) => r.date <= splitDate)
      .sort((a, b) => a.date.localeCompare(b.date));
    const after = ad.rows.filter((r) => r.date > splitDate).slice(0, horizonDays);
    if (before.length < MIN_HISTORY || after.length === 0) {
      skipped++;
      continue;
    }
    scored++;
    const f = fatigue(before);
    const predicted = f.status === "ok" && f.pastHalfLife;
    pairs.push({ predicted, actual: didBreak(before, after) });
  }
  return { totalAds: ads.length, scored, skipped, willBreak: score(pairs) };
}
