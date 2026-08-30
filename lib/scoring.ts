// The ingestion->brain bridge: turn REAL daily Meta metrics (MetricsRow[]) into the
// verdict engine's inputs (CockpitAdInput). This is where "AI narrates, rules compute"
// starts: every sub-score here is a deterministic formula over real numbers, not a guess.
// Scores are 0-100 and RELATIVE TO THE ACCOUNT (an ad is a winner vs its own account,
// per J2 same-objective comparison), so the mapper takes ALL of an account's ads at once.
// Pure, no I/O. calibrate-at-build constants are marked; nothing is fabricated.

import type { MetricsRow } from "./ad-source.ts";
import type { CockpitAdInput } from "./cockpit/analyze.ts";
import type { Objective } from "./rules/comparator.ts";
import { readFatigue } from "./scoring/fatigue.ts";
import { settledRows } from "./scoring/attribution.ts";

export type RealAd = {
  externalId: string;
  name: string;
  objective?: Objective; // from the campaign; defaults to conversion
  rows: MetricsRow[]; // daily rows for the SELECTED display window - drives spend/ROAS/CTR/funnel shown
  // The full 90-day day-wise history for fatigue/trend/stability, independent of the display window: a top
  // buyer views any range but reads fatigue on the long trend. Absent -> fatigue falls back to `rows`.
  baselineRows?: MetricsRow[];
  endsInDays?: number | null; // days until the ad set / campaign end date, if scheduled
  adSetId?: string; // parent ad set id, for the Ads Manager deep link (campaign -> ad set -> ad)
  campaignId?: string; // parent campaign id, for the Ads Manager deep link
  adsetName?: string; // parent ad set / campaign NAMES, so money figures trace to readable entities
  campaignName?: string;
  active?: boolean; // current delivery status: true = ACTIVE, false = paused/archived, undefined = unknown
  thumbUrl?: string | null; // best still image for the leaderboard thumbnail (image, else video thumb); null when none
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

// The metric an objective is actually optimised for (higher = better). Conversion is
// judged on ROAS; awareness on reach per rupee (impressions/spend); everything else
// (traffic, engagement, leads, app_installs) on click-through rate. Returns null when
// the metric cannot be formed (e.g. no spend, no impressions), never a fabricated value.
// This is J2 in practice: an ad is judged against its own objective, not a blanket ROAS.
function goodnessOf(objective: Objective, a: Agg): number | null {
  if (objective === "conversion") return a.roas;
  if (objective === "awareness") return a.spend > 0 ? a.impressions / a.spend : null;
  return a.impressions > 0 ? a.clicks / a.impressions : null; // ctr
}

// Trend: split the ad's own rows by date at the midpoint and compare the later half to
// the earlier half ON THE OBJECTIVE'S OWN METRIC. 50 = flat; >50 improving; <50 declining.
// Real day-wise comparison, not a guess. Objective-aware so an engagement ad trends on
// its CTR, not on a ROAS it was never optimised for.
function trendScore(rows: MetricsRow[], objective: Objective): number {
  // Drop the still-attributing tail before reading direction (see settledRows): otherwise the late
  // half always contains under-reported recent days and every conversion ad reads as declining.
  const byDate = [...settledRows(rows)].sort((a, b) => a.date.localeCompare(b.date));
  if (byDate.length < 2) return 50;
  const mid = Math.floor(byDate.length / 2);
  const early = goodnessOf(objective, aggregate(byDate.slice(0, mid)));
  const late = goodnessOf(objective, aggregate(byDate.slice(mid)));
  if (early === null || late === null || early === 0) return 50;
  const change = (late - early) / early; // -1..+inf
  return clamp(Math.round(50 + change * 100), 0, 100); // +50% -> ~100; -50% -> ~0
}

// Absolute 0-100 "is this ad doing its job", judged on the objective's own metric against
// a real-world benchmark, NOT a within-account percentile. This is what lets Account Health
// differ between accounts: a self-relative percentile averages to ~50 for every account by
// construction, so health could never move. calibrate-at-build benchmarks:
//   ROAS: 1x break-even ~39, 2x ~63, 4x ~86 (100*(1-e^-0.5r))
//   CTR:  ~1% ~49, ~2% ~74, ~4% ~93 (100*(1-e^-(ctr/0.015)))
function roasToScore(roas: number): number {
  if (roas <= 0) return 0;
  return clamp(Math.round(100 * (1 - Math.exp(-0.5 * roas))), 0, 100);
}
function ctrToScore(ctr: number): number {
  if (ctr <= 0) return 0;
  return clamp(Math.round(100 * (1 - Math.exp(-ctr / 0.015))), 0, 100);
}

// Per-ad absolute objective score used for Account Health. Conversion is scored on ROAS
// (falling back to CTR when no revenue is tracked, so the ad still gets an honest read);
// awareness leads on freshness/reach (low frequency-saturation), CTR only minor; the click
// objectives score on CTR. Returns null only when there is genuinely nothing to score (no impressions).
function healthScoreOf(objective: Objective, a: Agg): number | null {
  const ctr = a.impressions > 0 ? a.clicks / a.impressions : null;
  if (objective === "conversion") {
    if (a.roas !== null) return roasToScore(a.roas);
    return ctr === null ? null : ctrToScore(ctr);
  }
  if (objective === "awareness") {
    // Awareness is about broad reach at a controlled frequency, NOT clicks. Lead on freshness (low
    // frequency-saturation = still reaching new people), with CTR only a minor engagement proxy. The old
    // 60% CTR weight wrongly killed a cheap-reach brand video that few people clicked - clicks were never
    // its job. (calibrate-at-build; to be ledger-tuned. See APP-CANON devil's-advocate note.)
    const fresh = 100 - fatigueScore(a.avgFrequency);
    return ctr === null ? fresh : Math.round(0.7 * fresh + 0.3 * ctrToScore(ctr));
  }
  return ctr === null ? null : ctrToScore(ctr);
}

// Performance: the ad's ROAS as a percentile within its account (J2: judged vs its own
// account, same objective). Best ROAS -> ~100, worst -> ~0. INTERNAL CALCULATION.
function percentile(value: number, all: number[]): number {
  if (all.length <= 1) return 50;
  const below = all.filter((v) => v < value).length;
  return Math.round((below / (all.length - 1)) * 100);
}

// Funnel health, objective-aware. For conversion ads it averages click-through and
// click-to-purchase percentiles. For non-conversion ads there is no purchase step to judge,
// so the funnel IS click-through: judging engagement/traffic ads on a purchase rate they
// have none of is what pinned every one of them to "Hold". INTERNAL CALCULATION.
function funnelScore(a: Agg, allCtr: number[], allCvr: number[], objective: Objective): number {
  const ctr = a.impressions > 0 ? a.clicks / a.impressions : 0;
  const ctrPct = percentile(ctr, allCtr);
  if (objective !== "conversion") return ctrPct;
  const cvr = a.clicks > 0 ? a.purchases / a.clicks : 0;
  return Math.round((ctrPct + percentile(cvr, allCvr)) / 2);
}

// Stability: day-to-day ROAS coefficient of variation. Low variance = stable. calibrate-at-build.
const STABLE_CV = 0.5;
function isStable(rows: MetricsRow[]): boolean {
  // Exclude the still-attributing tail: a partial last day spikes daily-ROAS variance and would fail a
  // genuinely steady ad on the winner gate purely because today has not finished settling.
  const daily = settledRows(rows).filter((r) => r.spend > 0).map((r) => r.revenue / r.spend);
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
  const objectives = ads.map((ad) => ad.objective ?? "conversion");
  // medianRoas is the "typical winner" bar for roomToScale, so it must be a median of CONVERSION ads
  // only. An awareness/engagement ad has spend but ~0 revenue -> roas 0, and letting those zeros into
  // the list drags the median down, which then wrongly flags mediocre conversion ads as "room to scale"
  // (J2: compare like with like). Non-conversion ads are judged on their own metric, not ROAS.
  const roasList = aggs.filter((a, i) => objectives[i] === "conversion" && a.roas !== null).map((a) => a.roas as number);
  const ctrList = aggs.map((a) => (a.impressions > 0 ? a.clicks / a.impressions : 0));
  const cvrList = aggs.map((a) => (a.clicks > 0 ? a.purchases / a.clicks : 0));
  const medianRoas = median(roasList);

  // Performance is a percentile WITHIN the same objective (J2), on that objective's own
  // metric, so an engagement ad is ranked by CTR against other engagement ads, not by a
  // ROAS it has none of. Precompute one goodness list per objective present in the account.
  const goodnessByObjective = new Map<Objective, number[]>();
  aggs.forEach((a, i) => {
    const g = goodnessOf(objectives[i], a);
    if (g === null) return;
    const list = goodnessByObjective.get(objectives[i]) ?? [];
    list.push(g);
    goodnessByObjective.set(objectives[i], list);
  });

  // Ad-set window-spend totals, for the fatigue MATERIALITY gate: an ad that spent only a sliver of its
  // ad set's budget in the selected window has not earned a fatigue/half-life verdict (see readFatigue).
  const adSetWindowSpend = new Map<string, number>();
  aggs.forEach((a, i) => {
    const id = ads[i].adSetId;
    if (id) adSetWindowSpend.set(id, (adSetWindowSpend.get(id) ?? 0) + a.spend);
  });

  // "Currently delivering?" - an ACTION (scale/refresh/pause) only makes sense on a LIVE ad. Meta's status
  // sync is best-effort, so an ad whose status we could not fetch is `active === undefined` and would slip
  // into the action queue even if it stopped weeks ago (a paused/ended ad set, or a spent-out schedule).
  // Recency is the honest discriminator: no spend in the recent window = not delivering, regardless of the
  // status flag - and a genuinely-spending unknown-status ad still counts as live (never hide a real leak).
  // Anchored to the window's most recent DATA day, not wall-clock, so historical windows read correctly.
  const RECENT_DELIVERY_DAYS = 7; // calibrate-at-build: zero spend for this many days -> treat as stopped
  const allDates = ads.flatMap((ad) => ad.rows.map((r) => r.date)).sort();
  const asOf = allDates.length ? allDates[allDates.length - 1] : null;
  const deliveringNow = (rows: MetricsRow[]): boolean => {
    if (!asOf) return false;
    let last: string | null = null;
    for (const r of rows) if (r.spend > 0 && (last === null || r.date > last)) last = r.date;
    if (!last) return false;
    const gapDays = Math.round((Date.parse(asOf) - Date.parse(last)) / 86_400_000);
    return gapDays <= RECENT_DELIVERY_DAYS;
  };

  return ads.map((ad, i) => {
    const a = aggs[i];
    const objective = objectives[i];
    // Fatigue/trend/stability read the full 90-day baseline (independent of the selected display window),
    // so switching to a 7-day view never turns a long-trend read into a noisy short one. Falls back to the
    // display rows when no baseline was supplied (the live-pull fallback path).
    const fatigueRows = ad.baselineRows ?? ad.rows;
    // Share of the ad set's window spend this ad took (null when we can't attribute it to an ad set).
    const adSetTotal = ad.adSetId ? adSetWindowSpend.get(ad.adSetId) ?? 0 : 0;
    const spendShareOfAdSet = adSetTotal > 0 ? a.spend / adSetTotal : null;
    const fatigueRead = readFatigue(fatigueRows, { endsInDays: ad.endsInDays, objective, spendShareOfAdSet });
    // insufficient_spend -> not enough budget share to judge: treat as low fatigue, never the frequency proxy.
    const fatigue =
      fatigueRead.sufficiency === "ok"
        ? fatigueRead.index
        : fatigueRead.sufficiency === "insufficient_spend"
          ? 0
          : fatigueScore(a.avgFrequency);
    const goodness = goodnessOf(objective, a);
    const performance = goodness === null ? 0 : percentile(goodness, goodnessByObjective.get(objective) ?? []);
    const roomToScale = a.roas !== null && medianRoas !== null && a.roas > medianRoas && fatigue < 60;
    const wastedRs = objective === "conversion" && a.roas !== null && a.roas < 1 ? a.spend : 0;
    return {
      id: ad.externalId,
      name: ad.name,
      adSetId: ad.adSetId,
      campaignId: ad.campaignId,
      adsetName: ad.adsetName,
      campaignName: ad.campaignName,
      active: ad.active,
      delivering: deliveringNow(ad.rows), // recent-spend liveness, so a stopped ad never gets an action
      thumbUrl: ad.thumbUrl,
      objective,
      performance,
      trend: trendScore(fatigueRows, objective),
      fatigue,
      funnel: funnelScore(a, ctrList, cvrList, objective),
      conversions: a.purchases,
      days: a.days,
      stable: isStable(fatigueRows),
      roomToScale,
      healthScore: healthScoreOf(objective, a),
      fatigueRead,
      halfLifeDays: fatigueRead.daysToFatigue,
      spendRs: Math.round(a.spend),
      revenueRs: Math.round(a.revenue),
      wastedRs: Math.round(wastedRs),
      impressions: a.impressions,
      clicks: a.clicks,
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
