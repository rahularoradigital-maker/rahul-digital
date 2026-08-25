// J2 — Compare like with like: same campaign objective only, weighted to the
// account's own long history. Public benchmarks are NEVER an input to a score
// (this module does not accept them), only context for conversation elsewhere.
// Pure, no I/O. Fails to "insufficient_data" rather than inventing an average.

export type Objective =
  | "conversion"
  | "traffic"
  | "engagement"
  | "awareness"
  | "leads"
  | "app_installs";

export type ComparableAd = {
  id: string;
  objective: Objective;
  /** The metric value being compared (e.g. ROAS, CPA), in the caller's unit. */
  metric: number;
  /**
   * Weight toward the account's own long history (J2: 180-365 day window carries
   * most weight). Default 1. Callers set higher weights on longer-lived ads.
   * INTERNAL CALIBRATION: the exact history-window weighting is calibrate-at-build.
   */
  historyWeight?: number;
};

export type ObjectiveAverage =
  | { status: "ok"; average: number; n: number }
  | { status: "insufficient_data"; reason: string };

/**
 * Weighted average of `metric` over ONLY the ads sharing `objective`. A
 * conversion ad is never averaged against a traffic/engagement ad. Returns
 * insufficient_data when no same-objective peer exists (or all weights are 0),
 * never a guessed number.
 */
export function objectiveAverage(ads: ComparableAd[], objective: Objective): ObjectiveAverage {
  if (!Array.isArray(ads)) {
    return { status: "insufficient_data", reason: "ads is not an array" };
  }
  const peers = ads.filter((a) => a.objective === objective && Number.isFinite(a.metric));
  if (peers.length === 0) {
    return { status: "insufficient_data", reason: `no same-objective (${objective}) peers` };
  }
  let weightSum = 0;
  let weighted = 0;
  for (const a of peers) {
    const w = a.historyWeight === undefined ? 1 : a.historyWeight;
    if (w <= 0) continue;
    weightSum += w;
    weighted += a.metric * w;
  }
  if (weightSum === 0) {
    return { status: "insufficient_data", reason: "all same-objective peers had zero weight" };
  }
  return { status: "ok", average: weighted / weightSum, n: peers.length };
}

/**
 * An ad's distance from its objective average (J2: `ad_score = distance from
 * objective_average`). Signed: positive = above the same-objective norm. The
 * caller passes an average produced by objectiveAverage for the SAME objective.
 */
export function adScore(adMetric: number, objectiveAvg: number): number {
  return adMetric - objectiveAvg;
}
