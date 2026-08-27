// Objective-aware decision engine. The old logic was conversion/ROAS-centric, so every
// engagement / traffic / awareness ad collapsed to a flat "Hold / 35%". A top-1% media buyer
// does not read those objectives on ROAS: they read the ad on its OWN metric (CTR, CPC, CPM,
// engagement rate), against benchmark, against its own siblings, and against fatigue trajectory.
//
// This module takes those signals already computed upstream (objectiveScore is the absolute
// grade on the objective's own metric, performance is the percentile within same-objective
// siblings, fatigue comes from fatigue.ts) and turns them into a varied, rule-based call with
// a plain "why" for every branch. No fabrication: every number in `why` is one that was passed in.
//
// Pure, no I/O. calibrate-at-build constants are marked. One runnable check accompanies it
// (scripts/check-decision-engine.ts).

export type Decision = {
  action: "scale" | "continue" | "refresh" | "pause" | "hold";
  priority: "DO_NOW" | "DO_NEXT" | "WATCH";
  confidence: number; // 0..1
  why: string[];
};

export type DecisionInput = {
  objective: "conversion" | "traffic" | "engagement" | "awareness" | "leads" | "app_installs";
  objectiveScore: number; // 0-100 absolute score on the objective's own metric (ROAS or CTR benchmark)
  performance: number; // 0-100 percentile within the account's same-objective ads
  fatigueState: "fresh" | "watch" | "fatiguing" | "fatigued";
  fatigueTrajectory: "improving" | "stable" | "worsening";
  fatigueSufficiency: "ok" | "insufficient_data";
  roas: number | null;
  conversions: number;
  days: number; // days the ad ran in the window
  roomToScale: boolean;
};

// calibrate-at-build. These are the thresholds a buyer would defend in a review; tune here.
const MIN_DAYS = 4; // fewer than this cannot support any trend-based call -> hold and watch
const STRONG = 70; // objectiveScore at/above this is a genuinely strong ad
const GOOD = 55; // still working, but eligible for a refresh once it starts wearing
const WEAK = 45; // below this the ad is underperforming its objective benchmark
const FULL_CONFIDENCE_DAYS = 14; // data volume at/after which the volume term is maxed out

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Confidence must never be constant. It blends how much data we have (more days = more trust)
// with how clear the signal is (base), so two otherwise-identical ads read at different day
// counts get different confidence. `base` is the branch's intrinsic clarity, `span` how much of
// it the data volume is allowed to move.
function confidence(base: number, span: number, days: number): number {
  const volume = Math.min(1, Math.max(0, days) / FULL_CONFIDENCE_DAYS); // 0..1 ramp with data
  return clamp01(base + span * volume);
}

function label(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * Decide what to do with one ad, read on its own objective. Branch order is deliberate:
 * thin data first (never over-claim), then strong, then good-but-wearing, then weak, else hold.
 */
export function decide(input: DecisionInput): Decision {
  const { objectiveScore, performance, fatigueState, fatigueTrajectory, fatigueSufficiency, days, roomToScale } = input;

  const fresh = fatigueState === "fresh" || fatigueState === "watch";
  const worsening = fatigueTrajectory === "worsening";
  const wearing = fatigueState === "fatiguing" || fatigueState === "fatigued";

  // 1) Thin data: not enough runway (or the fatigue read itself flagged insufficient data) to
  // trust any trend. Hold and watch. Confidence stays low but still climbs with the few days we
  // do have, so day-2 and day-3 reads differ.
  if (days < MIN_DAYS || fatigueSufficiency === "insufficient_data") {
    const reason =
      fatigueSufficiency === "insufficient_data"
        ? "fatigue read reports insufficient data"
        : `only ${label(days)} day${days === 1 ? "" : "s"} of delivery (need ${MIN_DAYS})`;
    return {
      action: "hold",
      priority: "WATCH",
      // base 0.30, +0.10 across the ramp -> ~0.30 at day 0 up to ~0.40 near the threshold.
      confidence: confidence(0.3, 0.1, days),
      why: [`Too early to act: ${reason}.`, `Objective score ${label(objectiveScore)}/100, but the trend cannot be trusted yet.`],
    };
  }

  // 2) Strong and not wearing: this is a winner. Scale if there is headroom, else keep it running.
  if (objectiveScore >= STRONG && fresh && !worsening) {
    if (roomToScale) {
      return {
        action: "scale",
        priority: "DO_NEXT",
        // base 0.70, +0.15 with volume -> ~0.70 early, ~0.85 with a full window.
        confidence: confidence(0.7, 0.15, days),
        why: [
          `Strong: objective score ${label(objectiveScore)}/100 (>=${STRONG}), fatigue ${fatigueState}, trajectory ${fatigueTrajectory}.`,
          `Room to scale and ${label(performance)}th percentile vs same-objective ads. Push budget.`,
        ],
      };
    }
    return {
      action: "continue",
      priority: "WATCH",
      confidence: confidence(0.7, 0.15, days),
      why: [
        `Strong: objective score ${label(objectiveScore)}/100 (>=${STRONG}), fatigue ${fatigueState}.`,
        `No headroom to scale right now, so hold budget and keep it running.`,
      ],
    };
  }

  // 3) Good but wearing: still above the good bar, but fatigue is setting in or the trend is
  // turning. The fix is a creative refresh before performance decays, not a pause.
  if (objectiveScore >= GOOD && (fatigueState === "fatiguing" || worsening)) {
    return {
      action: "refresh",
      priority: "DO_NEXT",
      // base 0.55, +0.10 -> ~0.55-0.65. Wearing signals are directional, so moderate confidence.
      confidence: confidence(0.55, 0.1, days),
      why: [
        `Good but wearing: objective score ${label(objectiveScore)}/100 (>=${GOOD}), fatigue ${fatigueState}, trajectory ${fatigueTrajectory}.`,
        `Refresh the creative before performance decays; the audience is starting to wear out.`,
      ],
    };
  }

  // 4) Weak and worsening or fatigued: it is underperforming its objective and the trend is not
  // recovering. Cut it. More days of a bad read = more confidence it is really bad.
  if (objectiveScore < WEAK && (worsening || fatigueState === "fatigued")) {
    return {
      action: "pause",
      priority: "DO_NOW",
      // base 0.60, +0.20 with volume -> ~0.60 with little data, up to ~0.80 with a full window.
      confidence: confidence(0.6, 0.2, days),
      why: [
        `Weak and not recovering: objective score ${label(objectiveScore)}/100 (<${WEAK}), fatigue ${fatigueState}, trajectory ${fatigueTrajectory}.`,
        `Underperforming its objective with no recovery over ${label(days)} days. Pause and reallocate.`,
      ],
    };
  }

  // 5) Everything else: mid-table, no clear scale/refresh/pause signal. Hold and watch, with
  // moderate confidence that rises with data volume.
  return {
    action: "hold",
    priority: "WATCH",
    // base 0.45, +0.10 -> ~0.45-0.55.
    confidence: confidence(0.45, 0.1, days),
    why: [
      `Mixed signal: objective score ${label(objectiveScore)}/100, fatigue ${fatigueState}, trajectory ${fatigueTrajectory}.`,
      `No decisive scale, refresh, or pause trigger yet. Hold and keep watching.`,
    ],
  };
}
