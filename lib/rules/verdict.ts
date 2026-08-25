// J10 — The verdict engine: winner / refresh / do_not_kill_yet / loser.
// CreativeScore = 0.30 performance + 0.30 trend + 0.20 (100 - fatigue) + 0.20 funnel_health.
// Two hard rules from the rulebook:
//  - WINNER requires ALL gates (enough purchases + days + stability + healthy funnel +
//    low fatigue + room to scale). "8x ROAS on 2 purchases" is a coin toss, not a winner,
//    so the purchases/days trust gate blocks it regardless of headline ROAS.
//  - LOSER only after the causality ladder has ruled out every non-creative cause
//    (data, audience, CPM, funnel, stock, LP, promo, tracking) i.e. cause === creative_fatigue.
//    A non-creative cause, or missing diagnosis, downgrades to do_not_kill_yet — never loser.
// Pure, no I/O. Output: one verdict + confidence + a why-list of exact signals.

import { TRUST_GATES, meetsGate } from "./trust-gates.ts";
import type { DiagnoseResult } from "../causality.ts";

export type Verdict = "winner" | "refresh" | "do_not_kill_yet" | "loser";

/** J10 score weights: editable and persisted. INTERNAL CALIBRATION (calibrate-at-build). */
export const VERDICT_WEIGHTS = {
  performance: 0.3,
  trend: 0.3,
  fatigue: 0.2, // applied to (100 - fatigue): fresher scores higher
  funnel: 0.2,
} as const;

/** Verdict cut points on the 0-100 CreativeScore + "healthy/high" bands. calibrate-at-build. */
export const VERDICT_CONFIG = {
  funnelOk: 60, // funnel_health >= this is "healthy"
  fatigueHigh: 60, // fatigue >= this is "high" (refresh territory)
  winnerScore: 70, // CreativeScore >= this is required for a winner
  loserScore: 40, // CreativeScore <= this is required for a loser
} as const;

/** All 0-100. fatigue is the exposure-curve fatigue (higher = more worn). */
export type ScoreInputs = {
  performance: number;
  trend: number;
  fatigue: number;
  funnel: number;
};

export type VerdictInput = ScoreInputs & {
  conversions: number; // purchases/conversions in the comparison window
  days: number; // days the ad has been running
  stable: boolean; // performance stability (not swinging)
  roomToScale: boolean; // budget headroom to scale further
  /**
   * Result of causality.diagnose() for this ad's drop, if a drop is being judged.
   * Required to reach a "loser" verdict (loser only when cause === creative_fatigue).
   * Omit when there is no drop to diagnose (e.g. judging a healthy scaler).
   */
  diagnosis?: DiagnoseResult;
};

export type VerdictResult = {
  verdict: Verdict;
  score: number; // the CreativeScore, 0-100
  confidence: number; // 0-1
  why: string[]; // exact signals behind the verdict
};

/** CreativeScore per J10. Weights default to VERDICT_WEIGHTS but are overridable. */
export function creativeScore(s: ScoreInputs, weights = VERDICT_WEIGHTS): number {
  return (
    weights.performance * s.performance +
    weights.trend * s.trend +
    weights.fatigue * (100 - s.fatigue) +
    weights.funnel * s.funnel
  );
}

export function verdict(input: VerdictInput): VerdictResult {
  const why: string[] = [];
  const score = creativeScore(input);
  why.push(`CreativeScore ${score.toFixed(1)}/100`);

  // --- Winner gate: ALL must hold. ---
  const enoughConversions = meetsGate(TRUST_GATES.winnerFlag.conversions, input.conversions);
  const enoughDays = meetsGate(TRUST_GATES.winnerFlag.days, input.days);
  const healthyFunnel = input.funnel >= VERDICT_CONFIG.funnelOk;
  const lowFatigue = input.fatigue < VERDICT_CONFIG.fatigueHigh;
  const strongScore = score >= VERDICT_CONFIG.winnerScore;
  const winnerGates =
    enoughConversions &&
    enoughDays &&
    input.stable &&
    healthyFunnel &&
    lowFatigue &&
    input.roomToScale &&
    strongScore;

  if (winnerGates) {
    why.push(
      `winner gates all met: ${input.conversions} purchases (>=${TRUST_GATES.winnerFlag.conversions}), ${input.days}d (>=${TRUST_GATES.winnerFlag.days}), stable, funnel ${input.funnel} healthy, fatigue ${input.fatigue} low, room to scale`,
    );
    return { verdict: "winner", score, confidence: 0.8, why };
  }

  // Not a winner: record which gate(s) failed (a small sample is the classic block).
  if (!enoughConversions) {
    why.push(
      `not winner: only ${input.conversions} purchases (<${TRUST_GATES.winnerFlag.conversions}) — too small to trust the headline number`,
    );
  }
  if (!enoughDays) why.push(`not winner: only ${input.days}d running (<${TRUST_GATES.winnerFlag.days})`);
  if (!input.stable) why.push("not winner: performance not stable");
  if (!healthyFunnel) why.push(`not winner: funnel ${input.funnel} below healthy (${VERDICT_CONFIG.funnelOk})`);
  if (!input.roomToScale) why.push("not winner: no room to scale");

  const smallSample = !enoughConversions || !enoughDays;

  // --- Loser gate: only when the causality ladder has ruled out every non-creative cause. ---
  const d = input.diagnosis;
  if (d !== undefined) {
    if (d.status === "suppressed") {
      why.push(`cannot judge creative: ${d.reason} (measurement gate) — do not kill`);
      return { verdict: "do_not_kill_yet", score, confidence: 0.4, why };
    }
    if (d.status === "insufficient_data") {
      why.push("cannot diagnose the drop yet (insufficient data) — do not kill");
      return { verdict: "do_not_kill_yet", score, confidence: 0.35, why };
    }
    // status === "ok"
    if (d.cause !== "creative_fatigue") {
      why.push(`drop cause is ${d.cause}, not the creative — fix that first (do not kill)`);
      return { verdict: "do_not_kill_yet", score, confidence: 0.6, why };
    }
    // cause === creative_fatigue: every cheaper cause was ruled out.
    why.push(`non-creative causes ruled out (${d.ruledOut.join(", ")}); cause is creative fatigue`);
    if (score <= VERDICT_CONFIG.loserScore) {
      why.push(`score ${score.toFixed(1)} <= loser cut ${VERDICT_CONFIG.loserScore}`);
      return { verdict: "loser", score, confidence: smallSample ? 0.5 : 0.8, why };
    }
    // Worn creative but not a bad-enough score to kill: refresh it.
    why.push("creative worn but score above loser cut — refresh, do not kill");
    return { verdict: "refresh", score, confidence: smallSample ? 0.5 : 0.7, why };
  }

  // --- No diagnosis supplied: cannot declare loser (J10). Route on fatigue/funnel. ---
  if (input.fatigue >= VERDICT_CONFIG.fatigueHigh && healthyFunnel) {
    why.push(`fatigue ${input.fatigue} high but funnel ${input.funnel} healthy — refresh the creative`);
    return { verdict: "refresh", score, confidence: smallSample ? 0.4 : 0.6, why };
  }
  why.push("no drop diagnosed and not a clear winner — hold, do not kill without ruling out non-creative causes");
  return { verdict: "do_not_kill_yet", score, confidence: smallSample ? 0.35 : 0.55, why };
}
