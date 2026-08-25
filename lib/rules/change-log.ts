// J8: change-log attribution — rule the humans out before the creative.
// When performance drops we ask "was it the buyer's own edits, the algorithm, or the
// creative?" BEFORE anyone blames the creative. A day with too many manual (BUYER)
// changes followed by a real drop is a learning reset, not creative fatigue. A day with
// ZERO logged buyer changes where delivery still moved is the ALGO (Meta reallocation /
// learning-phase). Only what survives both is handed to the causality ladder as creative.
// Pure, no I/O: dates come from the inputs, never the wall clock. Numbers are never guessed —
// empty input returns the insufficient_data sentinel (metrics.ts style), never a fake verdict.

/** One logged activity on a day. `source` distinguishes a human edit from a delivery move. */
export type ChangeEvent = {
  date: string;
  source: "buyer" | "algo";
  type: string; // pause | scale | budget | audience | offer | ...
};

/** A day's activity plus the signed perf move vs the prior day (e.g. ROAS points). */
export type DayPerf = {
  date: string;
  changes: ChangeEvent[];
  perfDeltaPoints: number; // signed; negative = drop
};

/** >= this many BUYER changes in a day resets learning. INTERNAL CALIBRATION (editable). */
export const VOLATILITY_CUT = 4; // calibrate-at-build (J8: ">= 4 manual changes")

/** perfDeltaPoints <= this counts as a real drop worth attributing. INTERNAL CALIBRATION. */
export const DROP_CUT = -2; // calibrate-at-build (J8: ">= 2-point drop")

/** A move of this magnitude (either sign) with no human action reads as ALGO. INTERNAL CALIBRATION. */
export const ALGO_MOVE = 2; // calibrate-at-build (J8: "delivery moved with no logged change")

/** The standard J8 fix once changes are ruled the cause. A note, not an action — no I/O. */
export const LEARNING_FIX =
  "Freeze changes 72h and cap one budget change per ad set per day (J8 freeze-and-relearn).";

/** Count of BUYER changes on a day. ALGO events are delivery moves, not human volatility. */
export function changeVolatility(day: DayPerf): number {
  return day.changes.reduce((n, c) => n + (c.source === "buyer" ? 1 : 0), 0);
}

/** Number of days whose buyer volatility hit the cut — the learning-reset penalty (J8). */
export function learningPenalty(days: DayPerf[]): number {
  return days.reduce((n, d) => n + (changeVolatility(d) >= VOLATILITY_CUT ? 1 : 0), 0);
}

type Attribution = { date: string; cause: "buyer" | "algo" | "creative"; reason: string };

/**
 * Walk each day; for every real drop (perfDeltaPoints <= DROP_CUT) attribute a cause per J8,
 * in order — humans first, algo second, creative last:
 *   buyer    — same day OR the immediately prior day had buyer volatility >= VOLATILITY_CUT
 *              (learning reset from too many manual changes).
 *   algo     — that day had ZERO logged buyer changes but perf still moved >= ALGO_MOVE points
 *              (Meta reallocation / learning-phase move with no human action).
 *   creative — neither held; hand off to the causality ladder (J3).
 * Empty input → insufficient_data (never a fabricated verdict). Pure: input is not mutated.
 */
export function attributeDrop(
  days: DayPerf[],
):
  | { status: "ok"; attributions: Attribution[] }
  | { status: "insufficient_data" } {
  if (days.length === 0) return { status: "insufficient_data" };

  const attributions: Attribution[] = [];
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (day.perfDeltaPoints > DROP_CUT) continue; // no real drop to attribute this day

    const todayVol = changeVolatility(day);
    // Prior day only counts if it is the immediately preceding calendar-adjacent entry
    // we were handed; ordering is the caller's contract (J14 ledger is time-ordered).
    const priorVol = i > 0 ? changeVolatility(days[i - 1]) : 0;

    if (todayVol >= VOLATILITY_CUT || priorVol >= VOLATILITY_CUT) {
      attributions.push({
        date: day.date,
        cause: "buyer",
        reason: `Learning reset: ${
          todayVol >= VOLATILITY_CUT ? `${todayVol} buyer changes this day` : `${priorVol} buyer changes the prior day`
        } (>= ${VOLATILITY_CUT}) before a ${day.perfDeltaPoints}-point move.`,
      });
    } else if (todayVol === 0 && Math.abs(day.perfDeltaPoints) >= ALGO_MOVE) {
      attributions.push({
        date: day.date,
        cause: "algo",
        reason: `No logged buyer changes but perf moved ${day.perfDeltaPoints} points (>= ${ALGO_MOVE}) — Meta reallocation / learning-phase move.`,
      });
    } else {
      attributions.push({
        date: day.date,
        cause: "creative",
        reason: `${day.perfDeltaPoints}-point drop with ${todayVol} buyer change(s) and no algo-only signal — hand to the causality ladder.`,
      });
    }
  }

  return { status: "ok", attributions };
}
