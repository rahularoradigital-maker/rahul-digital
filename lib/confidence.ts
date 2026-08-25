// Confidence Framework (brief.md CONFIDENCE ENGINE; artifact 14 of 28).
// Every recommendation carries a confidence score built from data completeness,
// sample adequacy, signal agreement, and (when available) historical consistency.
// Anti-fake-precision (KILLCRITIC): hard caps stop a pretty blend from outranking
// a thin sample or a confounded read, and zero observable signals is never a score.
// Pure: no I/O, no deps, no Date.

// J7 source-connection confidence ladder (buyer-judgment-rules.md). The
// connected data sources, in the order they earn trust. meta is the base tier.
export const SOURCE_LEVELS = ["meta", "ga4", "shopify", "third_party"] as const;
export type ConnectedSource = "meta" | "ga4" | "shopify" | "third_party";

export type ConfidenceInput = {
  dataCompleteness: number; // 0-1
  sampleSize: number;
  minSample: number;
  signalsAgreeing: number;
  signalsTotal: number;
  historicalConsistency?: number; // 0-1
  confounders?: string[];
  // J7: when BOTH are present the final score is capped at the ceiling this
  // action class can reach on the connected sources. Absent → behaviour is
  // byte-identical to before (economic/creative distinction never applied).
  connectedSources?: ConnectedSource[];
  actionClass?: "creative_delivery" | "economic";
};

export type ConfidenceBand = "low" | "medium" | "high";

export type ConfidenceResult =
  | { status: "ok"; score: number /* 0-1 */; band: ConfidenceBand; reasons: string[]; capped?: string }
  | { status: "insufficient_data" };

// Blend weights — INTERNAL CALIBRATION, calibrate-at-build (rule: no arbitrary
// thresholds presented as truth). When historicalConsistency is absent its weight
// is dropped and the remaining weights are renormalised — never zero-filled, so a
// young account is not punished for having no history.
const W_COMPLETENESS = 0.25;
const W_SAMPLE = 0.25;
const W_AGREEMENT = 0.3;
const W_HISTORY = 0.2;

// Hard caps — INTERNAL CALIBRATION, calibrate-at-build.
const CAP_UNDER_SAMPLE = 0.5; // below minSample nothing may look better than a coin flip
const CAP_CONFOUNDED = 0.7; // a known confounder forbids the high band

// Band edges — INTERNAL CALIBRATION, calibrate-at-build.
const BAND_LOW_BELOW = 0.3;
const BAND_MEDIUM_BELOW = 0.7;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function band(score: number): ConfidenceBand {
  if (score < BAND_LOW_BELOW) return "low";
  if (score < BAND_MEDIUM_BELOW) return "medium";
  return "high";
}

export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  // No observable signals → there is nothing to be confident about. Say so.
  if (input.signalsTotal <= 0) return { status: "insufficient_data" };

  const completeness = clamp01(input.dataCompleteness);
  // Sample adequacy: sampleSize/minSample capped at 1. minSample <= 0 means no
  // floor was set for this decision → treat as adequate rather than divide by zero.
  const sampleAdequacy = input.minSample > 0 ? Math.min(1, input.sampleSize / input.minSample) : 1;
  const agreement = clamp01(input.signalsAgreeing / input.signalsTotal);

  const parts: { w: number; v: number }[] = [
    { w: W_COMPLETENESS, v: completeness },
    { w: W_SAMPLE, v: sampleAdequacy },
    { w: W_AGREEMENT, v: agreement },
  ];
  if (input.historicalConsistency !== undefined) {
    parts.push({ w: W_HISTORY, v: clamp01(input.historicalConsistency) });
  }
  const totalWeight = parts.reduce((acc, p) => acc + p.w, 0);
  let score = parts.reduce((acc, p) => acc + p.w * p.v, 0) / totalWeight;

  const reasons: string[] = [
    `${input.signalsAgreeing} of ${input.signalsTotal} signals agree`,
    `data ${Math.round(completeness * 100)}% complete`,
  ];
  if (input.historicalConsistency !== undefined) {
    reasons.push(`historical consistency ${Math.round(clamp01(input.historicalConsistency) * 100)}%`);
  }

  let capped: string | undefined;
  const confounders = input.confounders ?? [];
  if (confounders.length > 0 && score > CAP_CONFOUNDED) {
    score = CAP_CONFOUNDED;
    capped = `confounders present (${confounders.join(", ")}): capped at ${CAP_CONFOUNDED}`;
  }
  for (const c of confounders) reasons.push(`confounder: ${c}`);
  if (input.sampleSize < input.minSample) {
    const reason = `sample ${input.sampleSize} < min ${input.minSample}: capped`;
    if (score > CAP_UNDER_SAMPLE) {
      score = CAP_UNDER_SAMPLE;
      capped = `${reason} at ${CAP_UNDER_SAMPLE}`; // the binding (lowest) cap wins
    }
    reasons.push(reason);
  } else {
    reasons.push(`sample ${input.sampleSize} >= min ${input.minSample}`);
  }

  // J7: source-connection ceiling. Only binds when BOTH new fields are given,
  // so callers that omit them get the exact pre-J7 result (regression-safe).
  if (input.connectedSources !== undefined && input.actionClass !== undefined) {
    const lvl = sourceLevel(input.connectedSources);
    const ceiling = actionConfidenceCeiling(input.actionClass, input.connectedSources);
    if (score > ceiling) {
      score = ceiling; // the binding (lowest) cap wins over any earlier cap
      capped = `${input.actionClass} action on source level L${lvl}: capped at ${ceiling}`;
    }
    reasons.push(`source level L${lvl} (${input.actionClass}) ceiling ${Math.round(ceiling * 100)}%`);
    const uplift = nextSourceUplift(input.actionClass, input.connectedSources);
    if (uplift) reasons.push(`connect ${uplift.connect} to raise this to ${uplift.toPercent}%`);
  }

  return capped === undefined
    ? { status: "ok", score, band: band(score), reasons }
    : { status: "ok", score, band: band(score), reasons, capped };
}

// ---- J7: confidence rises with connected sources ----
// conf(META-only) <= conf(+GA4) <= conf(+Shopify) <= conf(+3P) — non-decreasing.
// Ceilings per action class, indexed by sourceLevel (L0..L3). INTERNAL
// CALIBRATION, calibrate-at-build — non-decreasing by construction (each is a
// non-decreasing array read at the level index, so the ladder can never dip).
const CEILING_CREATIVE = [0.9, 0.92, 0.93, 0.95] as const; // Meta owns creative/delivery: confident on Meta alone.
const CEILING_ECONOMIC = [0.45, 0.6, 0.9, 0.95] as const; // contribution ROAS / nCAC: LOW until Shopify + finance land.

function ceilingTable(actionClass: "creative_delivery" | "economic"): readonly number[] {
  return actionClass === "economic" ? CEILING_ECONOMIC : CEILING_CREATIVE;
}

/**
 * Level = the highest CONTIGUOUS tier present starting from meta.
 * meta absent → 0 (note: without Meta even the base tier is unconfirmed, and a
 * non-contiguous source — e.g. Shopify without GA4 — cannot lift the level; the
 * missing lower tier breaks the chain).
 */
export function sourceLevel(connected: ConnectedSource[]): 0 | 1 | 2 | 3 {
  if (!connected.includes("meta")) return 0;
  let level: 0 | 1 | 2 | 3 = 0;
  for (let i = 1; i < SOURCE_LEVELS.length; i++) {
    if (connected.includes(SOURCE_LEVELS[i])) level = i as 1 | 2 | 3;
    else break;
  }
  return level;
}

/** The confidence ceiling this action class can reach on the connected sources. */
export function actionConfidenceCeiling(
  actionClass: "creative_delivery" | "economic",
  connected: ConnectedSource[],
): number {
  return ceilingTable(actionClass)[sourceLevel(connected)];
}

/**
 * The one line "connect X to raise this to Y%": the next source (in ladder
 * order) whose connection lifts this action's ceiling, and the new ceiling as a
 * percent. null when already maxed (nothing left to connect raises it).
 */
export function nextSourceUplift(
  actionClass: "creative_delivery" | "economic",
  connected: ConnectedSource[],
): { connect: ConnectedSource; toPercent: number } | null {
  const current = actionConfidenceCeiling(actionClass, connected);
  const have = [...connected];
  for (const src of SOURCE_LEVELS) {
    if (have.includes(src)) continue;
    have.push(src); // walk the ladder in order; the first source that lifts the ceiling is the ask
    const lifted = actionConfidenceCeiling(actionClass, have);
    if (lifted > current) return { connect: src, toPercent: Math.round(lifted * 100) };
  }
  return null;
}

/** One plain sentence. Uses only numbers already present in the result. */
export function describeConfidence(result: ConfidenceResult): string {
  if (result.status === "insufficient_data") {
    return "Insufficient data: no confidence score can be given.";
  }
  return `Confidence ${Math.round(result.score * 100)}% (${result.band}): ${result.reasons.join("; ")}.`;
}
