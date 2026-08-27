// The ingestion->brain bridge: turn REAL daily Meta metrics (MetricsRow[]) into the
// verdict engine's inputs (CockpitAdInput). This is where "AI narrates, rules compute"
// starts: every sub-score here is a deterministic formula over real numbers, not a guess.
// Scores are 0-100 and RELATIVE TO THE ACCOUNT (an ad is a winner vs its own account,
// per J2 same-objective comparison), so the mapper takes ALL of an account's ads at once.
// Pure, no I/O. calibrate-at-build constants are marked; nothing is fabricated.

import type { MetricsRow } from "./ad-source.ts";
import type { CockpitAdInput } from "./cockpit/analyze.ts";
import type { Objective } from "./rules/comparator.ts";

export type RealAd = {
  externalId: string;
  name: string;
  objective?: Objective; // from the campaign; defaults to conversion
  rows: MetricsRow[]; // daily performance rows (oldest..newest order not required)
};

type Agg = {
  spend: number;
  revenue: number;
  purchases: number;
  impressions: number;
  clicks: number;
  days: number;
  avgFrequency: number;
  roas: number | null;
};

function aggregate(rows: MetricsRow[]): Agg {
  const spend = sum(rows, (r) => r.spend);
  const revenue = sum(rows, (r) => r.revenue);
  const purchases = sum(rows, (r) => r.purchases);
  const impressions = sum(rows, (r) => r.impressions);
  const clicks = sum(rows, (r) => r.clicks);
  const days = new Set(rows.map((r) => r.date)).size;
  const avgFrequency = rows.length ? sum(rows, (r) => r.frequency) / rows.length : 0;
  return { spend, revenue, purchases, impressions, clicks, days, avgFrequency, roas: spend > 0 ? revenue / spend : null };
}

// Fatigue from the exposure curve (fatigue formula library [07]): 100*(1-(N+1)^-0.4),
// N = cumulative frequency. Frequency-driven, monotonic, never a hard threshold. MODEL_ESTIMATE.
function fatigueScore(avgFrequency: number): number {
  const n = Math.max(0, avgFrequency);
  return Math.round(100 * (1 - Math.pow(n + 1, -0.4)));
}

// Trend: split the ad's own rows by date at the midpoint, compare later-half ROAS to
// earlier-half. 50 = flat; >50 improving; <50 declining. Real day-wise comparison, not a guess.
function trendScore(rows: MetricsRow[]): number {
  const byDate = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  if (byDate.length < 2) return 50;
  const mid = Math.floor(byDate.length / 2);
  const early = aggregate(byDate.slice(0, mid));
  const late = aggregate(byDate.slice(mid));
  if (early.roas === null || late.roas === null || early.roas === 0) return 50;
  const change = (late.roas - early.roas) / early.roas; // -1..+inf
  return clamp(Math.round(50 + change * 100), 0, 100); // +50% ROAS -> ~100; -50% -> ~0
}

// Performance: the ad's ROAS as a percentile within its account (J2: judged vs its own
// account, same objective). Best ROAS -> ~100, worst -> ~0. INTERNAL CALCULATION.
function percentile(value: number, all: number[]): number {
  if (all.length <= 1) return 50;
  const below = all.filter((v) => v < value).length;
  return Math.round((below / (all.length - 1)) * 100);
}

// Funnel health: click-through (impressions->clicks) and click-to-purchase, each as a
// percentile within the account, averaged. Higher = the funnel converts. INTERNAL CALCULATION.
function funnelScore(a: Agg, allCtr: number[], allCvr: number[]): number {
  const ctr = a.impressions > 0 ? a.clicks / a.impressions : 0;
  const cvr = a.clicks > 0 ? a.purchases / a.clicks : 0;
  return Math.round((percentile(ctr, allCtr) + percentile(cvr, allCvr)) / 2);
}

// Stability: day-to-day ROAS coefficient of variation. Low variance = stable. calibrate-at-build.
const STABLE_CV = 0.5;
function isStable(rows: MetricsRow[]): boolean {
  const daily = rows.filter((r) => r.spend > 0).map((r) => r.revenue / r.spend);
  if (daily.length < 3) return false; // not enough days to call it stable
  const mean = daily.reduce((s, v) => s + v, 0) / daily.length;
  if (mean === 0) return false;
  const variance = daily.reduce((s, v) => s + (v - mean) ** 2, 0) / daily.length;
  return Math.sqrt(variance) / mean < STABLE_CV;
}

/**
 * Map an account's real ads to the brain's inputs. All scores are relative to THIS account.
 * `wastedRs` uses a conservative, honest rule: for conversion-objective ads only, spend
 * returning less than it costs (ROAS < 1) is flagged as waste; other objectives (traffic,
 * engagement, awareness, leads, app_installs) were never optimised to convert, so low ROAS
 * there is not waste. Not a fabricated number.
 */
export function toCockpitInputs(ads: RealAd[]): CockpitAdInput[] {
  const aggs = ads.map((ad) => aggregate(ad.rows));
  const roasList = aggs.filter((a) => a.roas !== null).map((a) => a.roas as number);
  const ctrList = aggs.map((a) => (a.impressions > 0 ? a.clicks / a.impressions : 0));
  const cvrList = aggs.map((a) => (a.clicks > 0 ? a.purchases / a.clicks : 0));
  const medianRoas = median(roasList);

  return ads.map((ad, i) => {
    const a = aggs[i];
    const objective = ad.objective ?? "conversion";
    const fatigue = fatigueScore(a.avgFrequency);
    const performance = a.roas === null ? 0 : percentile(a.roas, roasList);
    const roomToScale = a.roas !== null && medianRoas !== null && a.roas > medianRoas && fatigue < 60;
    const wastedRs = objective === "conversion" && a.roas !== null && a.roas < 1 ? a.spend : 0;
    return {
      id: ad.externalId,
      name: ad.name,
      objective,
      performance,
      trend: trendScore(ad.rows),
      fatigue,
      funnel: funnelScore(a, ctrList, cvrList),
      conversions: a.purchases,
      days: a.days,
      stable: isStable(ad.rows),
      roomToScale,
      spendRs: Math.round(a.spend),
      revenueRs: Math.round(a.revenue),
      wastedRs: Math.round(wastedRs),
    };
  });
}

function sum<T>(list: T[], f: (t: T) => number): number {
  return list.reduce((acc, t) => acc + f(t), 0);
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
