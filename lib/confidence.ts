// Confidence Framework (brief.md CONFIDENCE ENGINE; artifact 14 of 28).
// Every recommendation carries a confidence score built from data completeness,
// sample adequacy, signal agreement, and (when available) historical consistency.
// Anti-fake-precision (KILLCRITIC): hard caps stop a pretty blend from outranking
// a thin sample or a confounded read, and zero observable signals is never a score.
// Pure: no I/O, no deps, no Date.

export type ConfidenceInput = {
  dataCompleteness: number; // 0-1
  sampleSize: number;
  minSample: number;
  signalsAgreeing: number;
  signalsTotal: number;
  historicalConsistency?: number; // 0-1
  confounders?: string[];
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

  return capped === undefined
    ? { status: "ok", score, band: band(score), reasons }
    : { status: "ok", score, band: band(score), reasons, capped };
}

/** One plain sentence. Uses only numbers already present in the result. */
export function describeConfidence(result: ConfidenceResult): string {
  if (result.status === "insufficient_data") {
    return "Insufficient data: no confidence score can be given.";
  }
  return `Confidence ${Math.round(result.score * 100)}% (${result.band}): ${result.reasons.join("; ")}.`;
}
