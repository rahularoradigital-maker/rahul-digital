// J6 trust gates: concrete "not worthy until" thresholds, plus the missing-data rule.
// Every number here is INTERNAL CALIBRATION (owner-decided starting anchor from J6,
// editable, persisted per account) — a legitimate third state between official fact
// and unknown. NOT truth: calibrate at build against real per-account history.

/**
 * Owner anchors from J6. Editable config, not law.
 * Each field is calibrate-at-build: start here, replace with measured per-account values.
 */
export const TRUST_GATES = {
  // Per-ad score is trustworthy only past this spend AND age (currency auto-detected upstream, J1/5A.1).
  perAdScore: { spendInr: 4000, spendUsd: 50, days: 3 }, // calibrate-at-build
  // Fatigue / half-life needs enough daily exposure to mean anything.
  fatigue: { impressionsPerDay: 1000 }, // calibrate-at-build
  // Funnel conversion rates need a sessions base before a rate is real.
  funnelRates: { sessions: 2000 }, // calibrate-at-build
  // Winner flag: two-gate minimum before anything is called a winner.
  winnerFlag: { conversions: 100, days: 3 }, // calibrate-at-build
  // Account median only means something once the account has enough ads.
  accountMedian: { minAds: 30 }, // calibrate-at-build
  // A trend warning fires only after a continuous run, never on a single day.
  trendWarning: { continuousDays: 7 }, // calibrate-at-build
  // Compare against own past only with enough history, else observe-mode.
  vsOwnPast: { historyDays: 90 }, // calibrate-at-build
  // An AI-decoded label below this confidence is a question for a human, not a value.
  decodeConfidenceFloor: 0.97, // calibrate-at-build
};

/** A measured actual meets a gate when it reaches or exceeds the gate value. */
export function meetsGate(gateValue: number, actual: number): boolean {
  return actual >= gateValue;
}

/**
 * Missing-data rule (J6): never fill a gap with an average. Drop the dropped
 * dimensions entirely and renormalise the surviving weights to sum to 1.00.
 * If nothing survives (or the survivors sum to 0), return an empty map rather
 * than inventing weight from nowhere.
 */
export function rebalanceWeights(
  weights: Record<string, number>,
  drop: string[],
): Record<string, number> {
  const dropped = new Set(drop);
  const kept: Record<string, number> = {};
  let total = 0;
  for (const key of Object.keys(weights)) {
    if (dropped.has(key)) continue;
    kept[key] = weights[key];
    total += weights[key];
  }
  if (total === 0) return kept; // no basis to renormalise — never substitute silently
  for (const key of Object.keys(kept)) {
    // ponytail: round to 1e-10 to shed float drift so survivors sum to exactly 1.00.
    // Ceiling: inputs needing >10 decimals of weight precision would lose it; none do here.
    kept[key] = Math.round((kept[key] / total) * 1e10) / 1e10;
  }
  return kept;
}

/**
 * J6: an AI-decoded label under the confidence floor is a question for a human,
 * not a value. Below 0.97 → needs review.
 */
export function needsHumanReview(decodeConfidence: number): boolean {
  return decodeConfidence < TRUST_GATES.decodeConfidenceFloor;
}
