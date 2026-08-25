// Deterministic creative-fatigue heuristic (rules engine = source of truth).
// Fatigue rises when an ad is shown to the same people repeatedly (high frequency)
// and its click-through rate is decaying. This is a HEURISTIC, not a model: it
// returns a bounded 0-1 score, and refuses to score at all when data is too thin.

import type { MetricsRow } from "../ad-source.ts";
import { ctr } from "./metrics.ts";

export type FatigueResult =
  | { status: "ok"; score: number; pastHalfLife: boolean }
  | { status: "insufficient_data" };

const MIN_ROWS = 7; // need at least a week of daily data to judge a trend
const WINDOW = 3; // compare the first vs last 3 days

// ceiling: this is a linear two-signal blend, not a survival/half-life model.
// frequency is normalised against FREQ_CAP (freq >= 3 is treated as fully saturated),
// and the CTR-decay signal is the relative drop from the first window to the last.
// Upgrade path: fit a real decay curve per ad once we have enough history.
const FREQ_CAP = 3;
const FREQ_WEIGHT = 0.5;
const DECAY_WEIGHT = 0.5;

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Score creative fatigue on [0,1]. Requires >= 7 daily rows or → insufficient_data
 * (never guesses on thin data). pastHalfLife = score >= 0.7.
 */
export function fatigue(rows: MetricsRow[]): FatigueResult {
  if (rows.length < MIN_ROWS) return { status: "insufficient_data" };

  // Order by date so "first 3 days" vs "last 3 days" is meaningful regardless of input order.
  const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  // Signal 1: average frequency, normalised. More repeat exposure → more fatigue.
  const avgFreq =
    ordered.reduce((acc, r) => acc + r.frequency, 0) / ordered.length;
  const freqSignal = clamp01(avgFreq / FREQ_CAP);

  // Signal 2: CTR decay. Compare aggregate CTR of the last 3 days to the first 3 days.
  const first = ctr(ordered.slice(0, WINDOW));
  const last = ctr(ordered.slice(-WINDOW));
  let decaySignal = 0;
  if (first.status === "ok" && last.status === "ok" && first.value > 0) {
    // relative drop: 0 if CTR held or rose, up to 1 if it collapsed to zero.
    decaySignal = clamp01((first.value - last.value) / first.value);
  }

  const score = clamp01(FREQ_WEIGHT * freqSignal + DECAY_WEIGHT * decaySignal);
  return { status: "ok", score, pastHalfLife: score >= 0.7 };
}

// ---------------------------------------------------------------------------
// Fatigue v2 — multi-signal composite per docs/product-spec/07-fatigue-formula-library.md.
// Additive upgrade (spec 07 §8: "migration is additive"): fatigue() above stays
// untouched as the back-compat surface consumed by waste.ts and backtest.ts;
// fatigueV2 is the spec'd model. MetricsRow supports 9 of the 11 spec'd signals:
// S6/S7 (hook/hold rate) need video-play fields the row does not carry, so they
// are EXCLUDED and the weights renormalise over what is available — a missing
// signal is never zero-filled (spec 07 principle 5). Reach is proxied as
// impressions/frequency for S11 (documented below).

export type FatigueV2State =
  | "healthy"
  | "early_warning"
  | "emerging_fatigue"
  | "fatiguing"
  | "fatigued"
  | "severe_fatigue"
  | "recovering"
  | "insufficient_data";

/** value = the signal's normalised fatigue contribution c ∈ [0,1] (spec 07 §3);
 *  contribution = its renormalised weighted share of the index (they sum to index). */
export type FatigueSignal = { id: string; value: number; contribution: number };

export type FatigueV2Result =
  | {
      status: "ok";
      index: number; // FI ∈ [0,1], INTERNAL CALCULATION (spec 07 §4)
      state: FatigueV2State;
      signals: FatigueSignal[];
      confidence: number; // §6 honesty layer, [0,1]
      drivers: string[];
    }
  | { status: "insufficient_data" };

// Every constant below is a v0 prior — calibrate-at-build (spec 07 §10 calibration
// ledger). None is a validated benchmark; the per-account calibration job replaces
// them against that account's own history.
export const FATIGUE_V2_CONFIG = {
  MIN_ROWS: 7, // per-signal floors are UNKNOWN (spec 07 §3); reuse fatigue()'s documented start
  WINDOW: 3, // baseline = first 3 days, recent = last 3 days
  FREQ_CAP: 3, // calibrate-at-build: freq >= 3 treated as fully saturated (carried from fatigue())
  FREQ_RISE_CAP: 1, // calibrate-at-build: +100% frequency rise = full S2 contribution
  COST_RISE_CAP: 1, // calibrate-at-build: +100% CPM/CPC rise = full S3/S5 contribution
  CPA_RISE_CAP: 1, // calibrate-at-build: +100% CPA rise = full S9 contribution
  FIRING: 0.5, // calibrate-at-build: c >= 0.5 counts as "firing" for the §5 state gates
  COVERAGE_FLOOR: 0.3, // calibrate-at-build: min share of model weight observed (§6)
  RECOVERY_DELTA: 0.1, // calibrate-at-build: index drop needed to read "recovering"
  // §5 state band cutoffs — v0 priors, fit to account transition history at build.
  BANDS: { early: 0.2, emerging: 0.35, fatiguing: 0.5, fatigued: 0.65, severe: 0.8 },
  // v0 weights from spec 07 §4 (leading > lagging > precursor > context by design).
  // S6/S7 omitted: MetricsRow has no video fields to compute them from.
  WEIGHTS: { S1: 0.06, S2: 0.04, S3: 0.06, S4: 0.14, S5: 0.06, S8: 0.08, S9: 0.1, S10: 0.12, S11: 0.06 },
} as const;

type WindowAgg = {
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  freq: number; // average frequency over the window
};

function aggregate(rows: MetricsRow[]): WindowAgg {
  const a = { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0, freq: 0 };
  for (const r of rows) {
    a.spend += r.spend;
    a.impressions += r.impressions;
    a.clicks += r.clicks;
    a.purchases += r.purchases;
    a.revenue += r.revenue;
    a.freq += r.frequency;
  }
  a.freq = rows.length ? a.freq / rows.length : 0;
  return a;
}

type EvaluatedSignal = { id: string; weight: number; c: number; driver: string | null };

// Each signal is either computed from real data or DROPPED (spec 07 principle 5:
// insufficient data is a state, not a zero). A dropped signal's weight leaves the
// denominator, so the composite is scored fairly on what is observable.
function evaluateSignals(ordered: MetricsRow[]): EvaluatedSignal[] {
  const C = FATIGUE_V2_CONFIG;
  const base = aggregate(ordered.slice(0, C.WINDOW));
  const now = aggregate(ordered.slice(-C.WINDOW));
  const all = aggregate(ordered);
  const sigs: EvaluatedSignal[] = [];
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  // S1 frequency level (precursor): repeat exposure vs the saturation cap.
  if (all.freq > 0) {
    const c = clamp01(all.freq / C.FREQ_CAP);
    sigs.push({
      id: "S1_frequency_level", weight: C.WEIGHTS.S1, c,
      driver: c >= C.FIRING ? `frequency averaging ${all.freq.toFixed(1)} (audience saturation)` : null,
    });
  }

  // S2 frequency trend (precursor): rate of saturation vs the ad's own baseline.
  if (base.freq > 0 && now.freq > 0) {
    const rise = now.freq / base.freq - 1;
    const c = clamp01(rise / C.FREQ_RISE_CAP);
    sigs.push({
      id: "S2_frequency_trend", weight: C.WEIGHTS.S2, c,
      driver: c >= C.FIRING ? `frequency up ${pct(rise)} vs baseline` : null,
    });
  }

  // S3 CPM trend (context/cost): most confounded by auction/season; low weight.
  if (base.impressions > 0 && now.impressions > 0 && base.spend > 0 && now.spend > 0) {
    const cpmBase = (base.spend / base.impressions) * 1000;
    const cpmNow = (now.spend / now.impressions) * 1000;
    const rise = cpmNow / cpmBase - 1;
    const c = clamp01(rise / C.COST_RISE_CAP);
    sigs.push({
      id: "S3_cpm_trend", weight: C.WEIGHTS.S3, c,
      driver: c >= C.FIRING ? `CPM up ${pct(rise)} vs baseline (check auction/seasonality)` : null,
    });
  }

  // S4 CTR decay (leading): strongest non-video leading signal.
  if (base.impressions > 0 && now.impressions > 0) {
    const ctrBase = base.clicks / base.impressions;
    if (ctrBase > 0) {
      const ctrNow = now.clicks / now.impressions;
      const drop = (ctrBase - ctrNow) / ctrBase;
      const c = clamp01(drop);
      sigs.push({
        id: "S4_ctr_decay", weight: C.WEIGHTS.S4, c,
        driver: c >= C.FIRING ? `CTR down ${pct(drop)} vs baseline` : null,
      });
    }
  }

  // S5 CPC trend (leading/cost): corroborates S4 in cost terms.
  if (base.clicks > 0 && now.clicks > 0 && base.spend > 0) {
    const rise = now.spend / now.clicks / (base.spend / base.clicks) - 1;
    const c = clamp01(rise / C.COST_RISE_CAP);
    sigs.push({
      id: "S5_cpc_trend", weight: C.WEIGHTS.S5, c,
      driver: c >= C.FIRING ? `CPC up ${pct(rise)} vs baseline` : null,
    });
  }

  // S8 CVR decay (lagging): outcome confirmation. CVR = purchases/clicks.
  if (base.clicks > 0 && now.clicks > 0) {
    const cvrBase = base.purchases / base.clicks;
    if (cvrBase > 0) {
      const drop = (cvrBase - now.purchases / now.clicks) / cvrBase;
      const c = clamp01(drop);
      sigs.push({
        id: "S8_cvr_decay", weight: C.WEIGHTS.S8, c,
        driver: c >= C.FIRING ? `conversion rate down ${pct(drop)} vs baseline` : null,
      });
    }
  }

  // S9 CPA increase (lagging): outcome-cost confirmation.
  if (base.purchases > 0 && now.purchases > 0 && base.spend > 0) {
    const rise = now.spend / now.purchases / (base.spend / base.purchases) - 1;
    const c = clamp01(rise / C.CPA_RISE_CAP);
    sigs.push({
      id: "S9_cpa_increase", weight: C.WEIGHTS.S9, c,
      driver: c >= C.FIRING ? `CPA up ${pct(rise)} vs baseline` : null,
    });
  }

  // S10 ROAS decay (lagging): the bottom-line symptom.
  if (base.spend > 0 && now.spend > 0) {
    const roasBase = base.revenue / base.spend;
    if (roasBase > 0) {
      const drop = (roasBase - now.revenue / now.spend) / roasBase;
      const c = clamp01(drop);
      sigs.push({
        id: "S10_roas_decay", weight: C.WEIGHTS.S10, c,
        driver: c >= C.FIRING ? `ROAS down ${pct(drop)} vs baseline` : null,
      });
    }
  }

  // S11 reach saturation (precursor). MetricsRow carries no reach field, so daily
  // reach is PROXIED as impressions/frequency — calibrate-at-build proxy, replace
  // with real reach when the fetcher supplies it. Spec: c = 1 - reach_growth /
  // impr_growth when impressions are growing; otherwise the signal is dropped.
  const imprGrowth = now.impressions - base.impressions;
  if (imprGrowth > 0 && base.freq > 0 && now.freq > 0) {
    const reachGrowth = now.impressions / now.freq - base.impressions / base.freq;
    const c = clamp01(1 - reachGrowth / imprGrowth);
    sigs.push({
      id: "S11_reach_saturation", weight: C.WEIGHTS.S11, c,
      driver: c >= C.FIRING ? "impressions growing without new reach (same people, more often)" : null,
    });
  }

  return sigs;
}

function compositeIndex(sigs: EvaluatedSignal[]): { index: number; availableWeight: number } {
  const availableWeight = sigs.reduce((a, s) => a + s.weight, 0);
  const index = availableWeight > 0
    ? sigs.reduce((a, s) => a + s.weight * s.c, 0) / availableWeight
    : 0;
  return { index, availableWeight };
}

/**
 * Multi-signal fatigue diagnosis (spec 07 §4–§6). Weights renormalise over the
 * signals actually available; refuses (never guesses) below the row floor, when
 * too little model weight is observable, or when no leading signal exists.
 */
export function fatigueV2(rows: MetricsRow[]): FatigueV2Result {
  const C = FATIGUE_V2_CONFIG;
  if (rows.length < C.MIN_ROWS) return { status: "insufficient_data" };

  const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const sigs = evaluateSignals(ordered);
  const { index, availableWeight } = compositeIndex(sigs);
  const totalWeight = Object.values(C.WEIGHTS).reduce((a, w) => a + w, 0);

  // §6 critical-coverage rule: a verdict is refused when too little of the model's
  // weight is observed, or when no leading signal (S4/S5) is available — a
  // lagging-only verdict is a post-mortem, not a diagnosis.
  const hasLeading = sigs.some((s) => s.id === "S4_ctr_decay" || s.id === "S5_cpc_trend");
  if (availableWeight / totalWeight < C.COVERAGE_FLOOR || !hasLeading) {
    return { status: "insufficient_data" };
  }

  const B = C.BANDS;
  let state: FatigueV2State =
    index < B.early ? "healthy"
    : index < B.emerging ? "early_warning"
    : index < B.fatiguing ? "emerging_fatigue"
    : index < B.fatigued ? "fatiguing"
    : index < B.severe ? "fatigued"
    : "severe_fatigue";

  // §5 lagging-confirmation gate: FATIGUED/SEVERE require an outcome signal
  // (S8/S9/S10) firing — leading signals alone top out at fatiguing, so a CTR dip
  // never reads as "the ad is dead" while it still converts.
  const laggingFiring = sigs.some(
    (s) => (s.id === "S8_cvr_decay" || s.id === "S9_cpa_increase" || s.id === "S10_roas_decay") && s.c >= C.FIRING,
  );
  if ((state === "fatigued" || state === "severe_fatigue") && !laggingFiring) state = "fatiguing";

  // Recovering heuristic: no persisted FI history exists yet, so re-score the
  // series without its last WINDOW days; if the ad WAS emerging+ and the index has
  // since fallen by RECOVERY_DELTA, the recent 3-day trend is improving.
  // ceiling: single-snapshot approximation of the spec's "FI falling >= 2
  // consecutive windows" — upgrade to real stored FI snapshots when available.
  if (ordered.length >= C.MIN_ROWS + C.WINDOW) {
    const prev = compositeIndex(evaluateSignals(ordered.slice(0, -C.WINDOW)));
    if (prev.availableWeight > 0 && prev.index >= B.emerging && prev.index - index >= C.RECOVERY_DELTA) {
      state = "recovering";
    }
  }

  // §6 honesty layer: confidence = coverage (share of model weight observed)
  // discounted by sample depth (rows vs a 14-day target). Both factors and the
  // 0.6/0.4 mix are calibrate-at-build priors, not validated numbers.
  const coverage = availableWeight / totalWeight;
  const sampleDepth = Math.min(1, ordered.length / 14);
  const confidence = clamp01(coverage * (0.6 + 0.4 * sampleDepth));

  return {
    status: "ok",
    index,
    state,
    signals: sigs.map((s) => ({ id: s.id, value: s.c, contribution: (s.weight * s.c) / availableWeight })),
    confidence,
    drivers: sigs.filter((s) => s.driver !== null).map((s) => s.driver as string),
  };
}
