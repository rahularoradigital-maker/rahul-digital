// Funnel DIAGNOSIS engine (pure, no I/O; gated by scripts/check-funnel-diagnosis.ts).
// The deterministic half of the workflow: for every ad it (1) tags the funnel stage, (2) computes the funnel
// chain, and (3) names the single weakest step by comparing each ad to THE ACCOUNT'S OWN BEST same-objective
// ad - never an outside benchmark. It refuses to answer (returns a Hold with the reason) rather than name a
// leak it cannot trust: too little spend, too few events behind a number, or no fair baseline to compare
// against. Every number is arithmetic (no AI). Reuses lib/metrics/funnel-metrics + lib/rules/comparator.
import { sumRows, funnelFromTotals, type ExtendedMetricsRow, type FunnelMetrics } from "../metrics/funnel-metrics.ts";
import type { Objective } from "../rules/comparator.ts";
import { classifyStage, type StageResult } from "./stage.ts";
import { spendFloorFor, MATERIALITY_GAP_PCT, MIN_BASELINE_ADS, THIN_FRACTION, STEP_VOLUME_FLOOR } from "./thresholds.ts";

export type FunnelAd = {
  adId: string;
  name?: string;
  objective: Objective;
  optimizationGoal?: string | null; // raw Meta ad-set goal when known; else undefined -> classify from objective
  rows: ExtendedMetricsRow[]; // this ad's day-wise rows
};

// The five funnel-chain steps we can measure from Meta alone, in order. Each maps to a rate in FunnelMetrics
// and to the denominator (event count) behind it. All are "higher is better" rates, so gaps never invert.
type StepDef = { key: string; label: string; rate: (m: FunnelMetrics) => number | null; denom: (t: ExtendedMetricsRow) => number; floor: number };
export const CHAIN: StepDef[] = [
  { key: "link_ctr", label: "Click-through (of everyone who saw it, how many clicked)", rate: (m) => m.ctr, denom: (t) => t.impressions, floor: STEP_VOLUME_FLOOR.link_ctr },
  { key: "lpv_rate", label: "Landing-page view (of clickers, how many saw the page load)", rate: (m) => m.lpViewRate, denom: (t) => t.outboundClicks, floor: STEP_VOLUME_FLOOR.lpv_rate },
  { key: "lpv_to_atc", label: "Add-to-cart (of page viewers, how many added to cart)", rate: (m) => m.atcRate, denom: (t) => t.landingPageViews, floor: STEP_VOLUME_FLOOR.lpv_to_atc },
  { key: "atc_to_checkout", label: "Checkout start (of carts, how many began paying)", rate: (m) => m.checkoutRate, denom: (t) => t.addToCarts, floor: STEP_VOLUME_FLOOR.atc_to_checkout },
  { key: "checkout_to_purchase", label: "Purchase (of checkouts, how many paid)", rate: (m) => m.purchaseRate, denom: (t) => t.initiateCheckouts, floor: STEP_VOLUME_FLOOR.checkout_to_purchase },
];

export type StepRead = {
  key: string; label: string;
  value: number | null; // this ad's rate for the step (%), null if no data
  ownBest: number | null; // best same-objective value that CLEARED the volume floor, or a weak fallback
  objectiveAvg: number | null; // average across qualifying same-objective peers, for context
  gap: number | null; // how far below own-best, as % of own-best (0 if at/above best)
  weakBar: boolean; // the bar could not be set by a volume-qualified ad
  thin: boolean; // this ad's own denominator is too small to trust its value
};

export type AdDiagnosis = {
  adId: string; name?: string; objective: Objective;
  stage: StageResult;
  spend: number;
  metrics: FunnelMetrics;
  steps: StepRead[]; // ranked by gap desc (largest leak first); steps with no gap sink to the end
  leak: { key: string; label: string; value: number | null; ownBest: number | null; objectiveAvg: number | null; gap: number } | null;
  hold: string | null; // set when no leak can be honestly named; the reason why
};

export type AccountVerdict = {
  headlineStep: string | null; // the step leaking the most SPEND across the account
  spendBehindHeadline: number;
  leakingAds: number;
  noLeakAds: number;
  heldAds: number;
};

export type FunnelReport = {
  ads: AdDiagnosis[]; // diagnosed (passed the spend floor)
  held: { adId: string; name?: string; spend: number; reason: string }[]; // below the spend floor
  verdict: AccountVerdict;
  warnings: string[];
};

type Precomputed = { ad: FunnelAd; totals: ExtendedMetricsRow; metrics: FunnelMetrics; spend: number };

function mean(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

// The account's own bar for one step within one objective group: the max value among ads whose denominator
// cleared the step's volume floor. If none qualify, fall back to the max of any non-null value and flag weakBar.
function ownBestForStep(group: Precomputed[], step: StepDef): { ownBest: number | null; objectiveAvg: number | null; weakBar: boolean } {
  const qualified: number[] = [];
  const anyValue: number[] = [];
  for (const p of group) {
    const v = step.rate(p.metrics);
    if (v == null) continue;
    anyValue.push(v);
    if (step.denom(p.totals) >= step.floor) qualified.push(v);
  }
  if (qualified.length) return { ownBest: Math.max(...qualified), objectiveAvg: mean(qualified), weakBar: false };
  if (anyValue.length) return { ownBest: Math.max(...anyValue), objectiveAvg: mean(anyValue), weakBar: true };
  return { ownBest: null, objectiveAvg: null, weakBar: true };
}

/**
 * Diagnose a whole account's ads. `currency` picks the spend floor; `minSpend` overrides it. Deterministic.
 */
export function diagnoseFunnel(ads: FunnelAd[], opts: { currency?: string | null; minSpend?: number } = {}): FunnelReport {
  const floor = opts.minSpend ?? spendFloorFor(opts.currency);
  const warnings: string[] = [];

  // 1) Precompute totals + metrics; split on the spend floor (held ads never influence anyone's bar).
  const kept: Precomputed[] = [];
  const held: FunnelReport["held"] = [];
  for (const ad of ads) {
    const totals = sumRows(ad.rows);
    const p: Precomputed = { ad, totals, metrics: funnelFromTotals(totals), spend: totals.spend };
    if (p.spend > floor) kept.push(p);
    else held.push({ adId: ad.adId, name: ad.name, spend: p.spend, reason: `Spent ${p.spend.toFixed(0)} which is at or under the ${floor} floor; results here are luck, not evidence. Held for the next run.` });
  }

  // 2) Group kept ads by objective (like compared with like).
  const groups = new Map<Objective, Precomputed[]>();
  for (const p of kept) {
    const g = groups.get(p.ad.objective) ?? [];
    g.push(p);
    groups.set(p.ad.objective, g);
  }

  // 3) Per group, per step: the own-best bar. Then per ad: the ranked chain + the leak (or a Hold).
  const diagnoses: AdDiagnosis[] = [];
  for (const [objective, group] of groups) {
    const baselineN = group.length;
    const bars = CHAIN.map((step) => ({ step, ...ownBestForStep(group, step) }));

    for (const p of group) {
      const steps: StepRead[] = bars.map(({ step, ownBest, objectiveAvg, weakBar }) => {
        const value = step.rate(p.metrics);
        const denom = step.denom(p.totals);
        const gap = ownBest != null && ownBest > 0 && value != null ? Math.max(0, ((ownBest - value) / ownBest) * 100) : null;
        return { key: step.key, label: step.label, value, ownBest, objectiveAvg, gap, weakBar, thin: value != null && denom < step.floor * THIN_FRACTION };
      });
      // Rank: largest gap first; steps with no measurable gap sink to the end.
      const ranked = [...steps].sort((a, b) => (b.gap ?? -1) - (a.gap ?? -1));
      const top = ranked.find((s) => s.gap != null) ?? null;

      let leak: AdDiagnosis["leak"] = null;
      let hold: string | null = null;
      if (baselineN < MIN_BASELINE_ADS) {
        hold = `No leak can be called: only ${baselineN} ad(s) share this objective (need ${MIN_BASELINE_ADS}), so "the best ad" would be this ad itself.`;
      } else if (!top || top.gap == null || top.gap < MATERIALITY_GAP_PCT) {
        hold = `No step is materially below the account's best (all under the ${MATERIALITY_GAP_PCT}% floor). Hold.`;
      } else if (top.weakBar) {
        hold = `The weakest step looks like "${top.key}", but no same-objective ad had enough volume to set a trustworthy bar. Treat as a direction to check, not a finding.`;
      } else if (top.thin) {
        hold = `The weakest step looks like "${top.key}", but this ad has too few events there to trust the number. Hold.`;
      } else {
        leak = { key: top.key, label: top.label, value: top.value, ownBest: top.ownBest, objectiveAvg: top.objectiveAvg, gap: top.gap };
      }

      diagnoses.push({
        adId: p.ad.adId, name: p.ad.name, objective,
        stage: classifyStage(p.ad.optimizationGoal, objective),
        spend: p.spend, metrics: p.metrics, steps: ranked, leak, hold,
      });
    }
  }

  // 4) Account verdict: among leaking ads, which STEP leaks the most SPEND (money, not just percentage).
  const spendByStep = new Map<string, number>();
  let leakingAds = 0;
  for (const d of diagnoses) {
    if (!d.leak) continue;
    leakingAds++;
    spendByStep.set(d.leak.key, (spendByStep.get(d.leak.key) ?? 0) + d.spend);
  }
  let headlineStep: string | null = null;
  let spendBehindHeadline = 0;
  for (const [step, spend] of spendByStep) {
    if (spend > spendBehindHeadline) { spendBehindHeadline = spend; headlineStep = step; }
  }
  const noLeakAds = diagnoses.filter((d) => !d.leak && d.hold).length;

  if (kept.length === 0) warnings.push("Every ad is under the spend floor; nothing could be diagnosed yet.");

  return {
    ads: diagnoses,
    held,
    verdict: { headlineStep, spendBehindHeadline, leakingAds, noLeakAds, heldAds: held.length },
    warnings,
  };
}
